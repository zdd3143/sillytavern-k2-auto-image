# 实现原理

这篇文档解释扩展为什么这样写、每一步发生了什么，以及你在改造时应该看哪里。

## 1. 总体设计

自动配图分成四个独立的部分：

| 部分 | 职责 | 技术 |
| --- | --- | --- |
| SillyTavern 扩展 | 监听消息、提取正文、组织提示词、贴图 | 浏览器端 ES module |
| 本地 LLM | 把正文和人物设定写成英文提示词 | Ollama / OpenAI 兼容 `/v1` |
| ComfyUI | 执行工作流、返回图片 | HTTP API |
| SillyTavern 服务端 | 代理 LLM 和 ComfyUI 请求、保存图片 | 内置 API |

扩展本身**不加载模型、不跑 Python**，它只做编排。

```text
┌──────────────────────┐
│  SillyTavern 前端     │
│  k2-auto-image       │
│                      │
│  事件 → 提取 → 提示词 │
└──────────┬───────────┘
           │ 服务端代理（同源，无 CORS）
           ▼
┌──────────────────────┐       ┌──────────────────┐
│ SillyTavern Server    │──────▶│ Ollama :11434/v1 │
│                      │       └──────────────────┘
│ /api/backends/...    │
│ /api/sd/comfy/...    │──────▶┌──────────────────┐
│ /api/images/upload   │       │ ComfyUI :8188    │
└──────────────────────┘       └──────────────────┘
```

### 为什么不改 SillyTavern 核心

最初的版本直接改 `public/scripts/extensions/stable-diffusion/index.js`，能工作，但有两个问题：

1. SillyTavern 一升级，补丁就被覆盖；
2. 分享给别人时必须分发一个改过的核心文件，容易和别人的扩展冲突。

所以这个仓库改成**第三方扩展**，只使用 SillyTavern 已经暴露的事件和服务端接口：

- `event_types.CHARACTER_MESSAGE_RENDERED`
- `/api/backends/chat-completions/generate`
- `/api/sd/comfy/workflow`
- `/api/sd/comfy/generate`
- `/api/images/upload`（由 `saveBase64AsFile()` 调用）

这样升级 SillyTavern 时，只要这些接口不变，扩展不用动。

---

## 2. 一次生成的完整调用链

```text
用户/模型产生一条 AI 消息
        │
        ▼
SillyTavern 渲染消息
        │
        ▼
eventSource.emit(CHARACTER_MESSAGE_RENDERED, messageId)
        │
        ▼
onCharacterMessageRendered(messageId)
        │
        ├─ settings.enabled? ──否──▶ return
        ├─ 是 user / system / 图片消息? ──是──▶ return
        ├─ extractMainBody(mes).length < 20? ──是──▶ return
        │
        ▼
runForMessage(message)
        │
        ├─ busy? ──是──▶ 跳过（防并发）
        ├─ delay(settings.delay_ms)
        │
        ▼
processMessage(message)
        │
        ├─ 计算签名，重复则跳过
        ├─ buildPrompt(body)
        │    ├─ getCharacterSetting(body)
        │    ├─ callLocalLlm(stage1)  中文分镜
        │    └─ callLocalLlm(stage2)  英文翻译
        ├─ generateImage(prompt)
        │    ├─ loadWorkflow()
        │    ├─ buildWorkflow() 替换占位符
        │    └─ POST /api/sd/comfy/generate
        └─ appendImage(result, prompt, message.name)
             ├─ saveBase64AsFile()
             ├─ chat.push(message)
             ├─ emit(MESSAGE_RECEIVED)
             ├─ addOneMessage(message)
             ├─ emit(CHARACTER_MESSAGE_RENDERED)  ← 图片消息，会被媒体检查挡住
             └─ saveChat()
```

---

## 3. 正文提取：只看当前这一幕

入口是 `extractMainBody(text)`（`extension/index.js`）。

优先级：

1. 如果消息里有 `<game>...</game>`，只取这些块，多个块用空行连接；
2. 否则依次删除：
   - ` ```json ... ``` ` 代码块
   - `<think>...</think>`
   - `<options>...</options>`
   - `<summary>...</summary>`
   - `<comment>...</comment>`
   - `<UpdateVariable>...</UpdateVariable>`
   - `<StatusPlaceHolderImpl />`
   - 所有剩余 HTML 标签
3. 再按行过滤明显的数据行：
   - 以 `[` 或 `{` 开头、以 `]` 或 `}` 结尾的行
   - `HP:`、`MP:`、`好感:`、`信任:`、`亲密:`、`状态:`、`属性:`、`数据:`、`金币:`、`经验:`、`等级:` 等

这样做的原因：角色卡经常把“正文”和“状态栏/选项/内心思考”混在一条消息里。如果把整条消息喂给 LLM，模型会把选项和数值也写进画面描述。

### 为什么只取最后一条

`getLastTextMessage()` 从聊天末尾往前找，跳过：

- 用户消息
- 系统消息
- 带 `extra.media` 的图片消息

找到第一条正文长度 ≥ 20 的消息就停。

这保证：

- 不会把历史剧情拼进当前画面；
- 图片消息不会再次触发（图片没有正文）；
- 手动“立即生成”也只会用最后一条文本。

---

## 4. 人物设定：角色卡 + 世界书

`getCharacterSetting(body)` 合并两部分。

### 4.1 角色卡字段

`getCardSetting(character)` 读取：

```js
character.name
character.description
character.personality
character.scenario
```

用 `substituteParams()` 展开 `{{char}}`、`{{user}}` 等宏，然后按 `Name / Description / Personality / Scenario` 拼接。

可以在设置里关闭 `include_card_fields`。

### 4.2 角色卡世界书

`getBookSetting(character, body)`：

1. 从 `character.data.character_book.entries` 取条目（兼容 `character.character_book` 和对象/数组两种 entries）；
2. 跳过 `disable` 的条目；
3. 用条目的 `keys`（或 `key`）在正文里做不区分大小写的匹配；
4. 如果没命中关键词，但条目 `comment` 出现在正文里，也算命中；
5. 按正文中出现的位置排序，最多取 3 个条目；
6. 每个条目交给 `extractVisualProfile()` 提取外形段落。

### 4.3 外形段落过滤

`extractVisualProfile(content)` 只保留这些二级段落：

- `基础信息`
- `外形与体型` 下的：
  - 身高与骨架
  - 体脂与体型
  - 皮肤
  - 面部
  - 发型
  - 日常外穿
  - 鞋袜
  - 配饰
  - 体态与走姿
  - 气味

并丢弃包含以下词的整行：

```text
乳房 乳头 乳晕 阴 肛门 生殖 性器 体液 自慰 内衣 胸罩 内裤 下体 私处
```

如果条目没有结构化段落，就退回前 1800 字的原文。

> 这段过滤是为了让公开仓库的默认行为保持克制，同时保留“画对人”所需的外形信息。你可以在自己的分支里改 `extractVisualProfile()`。

### 4.4 角色 → 工作流路由

`resolveCharacterWorkflow(body)` 决定这次用哪个工作流，逻辑在 `extension/index.js`：

```js
const CHARACTER_WORKFLOW_PRESETS = [
  { id: 'hitamu', label: '希塔姆·坎', aliases: [...], workflow: 'K2_IG_Hitamu.json', width: 832, height: 1216 },
  // ...
];
```

1. 用 `resolveActiveCharacter()` 取当前角色卡：优先 `context.characterId`；群聊回退最后一条 AI 消息的 `original_avatar` / `name`。
2. 把角色卡 `name`、`data.name`、`avatar` 和正文都做 `normalizeLookup()`：转小写并去掉空格、`·`、标点、括号。
3. 每个 preset 的别名与卡名/正文比对：
   - 卡名命中：`score += 100`
   - 正文每出现一次：`score += 1`
   - 同分时取正文里 `lastIndex` 更大的（最后被提到的人）。
4. 没有命中任何角色时，回退 `settings.workflow_name`（默认 `Krea2_Turbo_T2I.json`）。

`processMessage()` 把路由结果原样传给 `generateImage(prompt, route)`：

```js
const route = resolveCharacterWorkflow(body);
const result = await generateImage(prompt, route);
```

`buildWorkflow()` 用 `route.workflow` 读文件，用 `route.width/height` 覆盖尺寸；工作流里的模型、LoRA、步数、CFG 不读全局设置，所以每个角色可以有自己的底模和采样参数。

路由结果可以在设置面板“角色 → 工作流 JSON”里覆盖，格式是数组；解析失败会回退内置映射。

---

## 5. 两段式提示词

`buildPrompt(body)` 调两次本地 LLM。

### 第一段：中文分镜

System prompt 在 `DEFAULT_STAGE1`，核心约束：

- 开头写“人物姓名 + 镜头类型”
- 写外貌、发型、服装、姿势、表情
- 写环境、光线、色调、构图、画风
- 只写一个静止瞬间，不写对白/心理/剧情/连续动作
- 人物占画面主体
- 画风锁定现代日本 TV 动画
- 100–160 字

User 消息结构：

```text
<人物设定>
...角色卡和世界书...
</人物设定>

<正文>
...extractMainBody 的结果...
</正文>
```

### 第二段：英文翻译

System prompt 在 `DEFAULT_STAGE2`：

- 只翻译，不新增剧情
- 保留人物、服装、姿势、表情、环境、光线、构图、风格
- 必须包含现代日本 TV 动画的英文标签
- 禁止转成 photorealistic / 3D / CGI / live-action
- 只输出英文

最终提示词：

```js
`${settings.quality_prefix} ${english}`
```

质量前缀在 `DEFAULT_QUALITY_PREFIX`，默认：

```text
masterpiece, best quality, modern Japanese TV anime, anime screencap,
crisp digital lineart, soft cel shading, clean color blocks,
detailed eyes, vibrant colors, high resolution, cinematic composition,
volumetric lighting, sharp focus, intricate hair and clothing details.
```

### 为什么分两段

7B 模型如果直接用英文 system 同时要求“理解剧情 + 写画面 + 翻译”，很容易：

- 照抄对白
- 写成一整段连续动作
- 把状态栏数字写进 prompt
- 英文语法崩坏

拆成“中文理解/构图”和“英文翻译”两个短任务，7B 模型更稳，也方便你单独替换其中一段。

---

## 6. 调本地 LLM

`callLocalLlm(system, user, temperature, maxTokens)`：

```http
POST /api/backends/chat-completions/generate
Content-Type: application/json
```

```json
{
  "chat_completion_source": "custom",
  "custom_url": "http://127.0.0.1:11434/v1",
  "model": "richardyoung/qwen2.5-7b-instruct-abliterated:latest",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "stream": false,
  "temperature": 0.7,
  "max_tokens": 400
}
```

为什么走 SillyTavern 服务端而不是浏览器直连 Ollama：

- 浏览器直连 `127.0.0.1:11434` 会遇到 CORS；
- 服务端代理还能统一处理自定义 API Key、超时和日志；
- 用户不需要在 Ollama 上开 `OLLAMA_ORIGINS`。

响应兼容：

```js
data.choices[0].message.content
data.choices[0].text
data.content
```

并去掉 `<think>...</think>`。

超时由 `AbortController` 控制，默认 240 秒。

---

## 7. 调 ComfyUI

### 7.1 读取工作流

```http
POST /api/sd/comfy/workflow
```

```json
{ "file_name": "Krea2_Turbo_T2I.json" }
```

这个接口从当前用户的 `data/<user>/user/workflows/` 读取文件，返回原始 JSON 文本。`file_name` 来自角色路由结果（`K2_IG_*.json`）或默认设置。

读取前会先请求 `/api/sd/comfy/workflows` 校验文件名存在，避免 SillyTavern 在文件缺失时静默回退到 `Default_Comfy_Workflow.json`。

### 7.2 替换占位符

`replacePlaceholders(template, values)` 只替换**带引号的占位符**：

```js
result.replaceAll(`"%${key}%"`, JSON.stringify(value))
```

例如：

```json
"text": "%prompt%"
```

变成：

```json
"text": "masterpiece, ... a white-haired witch ..."
```

数值占位符也一样：

```json
"seed": "%seed%"
```

变成：

```json
"seed": 123456789
```

> 占位符必须保留引号。工作流 JSON 里写成 `%prompt%`（没有引号）不是合法 JSON，扩展不会替换。

### 7.3 生图

```http
POST /api/sd/comfy/generate
```

```json
{
  "url": "http://127.0.0.1:8188",
  "prompt": "{\"prompt\": { ...ComfyUI API graph... }}"
}
```

注意 `prompt` 是**字符串**，里面是 `{ "prompt": graph }`。这是 SillyTavern 的 ComfyUI 路由约定。

返回：

```json
{
  "format": "png",
  "data": "iVBORw0KGgoAAA..."
}
```

### 7.4 工作流格式

`comfyui/Krea2_Turbo_T2I.json` 是 **API 格式**，不是 ComfyUI 网页里“另存为”的 UI 格式。

API 格式长这样：

```json
{
  "3": {
    "class_type": "KSampler",
    "inputs": {
      "seed": "%seed%",
      "steps": "%steps%",
      "cfg": "%scale%",
      "sampler_name": "%sampler%",
      "scheduler": "%scheduler%",
      "denoise": "%denoise%",
      "model": ["4", 0],
      "positive": ["6", 0],
      "negative": ["7", 0],
      "latent_image": ["5", 0]
    }
  }
}
```

节点 id 是字符串，连线是 `["上游节点id", 输出序号]`。

角色工作流（`comfyui/characters/K2_IG_*.json`）也是同一格式，区别是：

- SDXL 角色用 `CheckpointLoaderSimple` 加载 `waiIllustriousSDXL_v170.safetensors`，再用 `LoraLoader` 加载对应角色 LoRA；
- `LoraLoader` 的 `model` 接底模输出 0，`clip` 接底模输出 1；
- 采样参数写死为 28 steps / CFG 6 / `dpmpp_2m` / `karras`；
- 只有 `%prompt%`、`%negative_prompt%`、`%seed%`、`%width%`、`%height%` 是占位符，模型/LoRA/步数/CFG 不开放覆盖。

如果你只有 UI 格式工作流，可以用 ComfyUI 的“Save (API Format)”导出，或者用 `ComfyUI-to-API` 类工具转换。

---

## 8. 保存图片并贴回聊天

`appendImage()` 做五件事：

1. `saveBase64AsFile(data, name, filename, format)` 把 base64 写到 SillyTavern 用户图片目录；
2. 检查聊天有没有在生成期间被切换；
3. 构造一条“只有图片、没有正文”的消息；
4. `chat.push(message)` + `addOneMessage(message)` 让它立刻出现在界面；
5. `saveChat()` 持久化。

说话人优先用触发消息的 `message.name`；手动“立即生成”时用最后一条 AI 消息的名字，再退回角色/群组名。这样在临时聊天里也不会把 `name2` 的 “SillyTavern System” 写进消息和图片目录。

消息结构：

```js
{
  name: speakerName || getSpeakerName(context),
  is_user: false,
  is_system: false,
  send_date: getMessageTimeStamp(),
  mes: settings.image_message_text || '',
  extra: {
    media: [{
      url: imagePath,
      type: MEDIA_TYPE.IMAGE,
      title: prompt,
      source: MEDIA_SOURCE.GENERATED,
    }],
    media_display: MEDIA_DISPLAY.GALLERY,
    media_index: 0,
    inline_image: false,
    k2auto: true,
  },
}
```

几个字段的作用：

| 字段 | 作用 |
| --- | --- |
| `extra.media[].url` | 图片在 ST 用户目录里的相对路径 |
| `type` | `MEDIA_TYPE.IMAGE` |
| `source` | `MEDIA_SOURCE.GENERATED`，让 ST 知道这是生成图 |
| `media_display` | `GALLERY`，显示为图库卡片 |
| `media_index` | 多图时的索引，这里固定 0 |
| `inline_image` | `false`，不把 base64 塞进消息正文 |
| `k2auto` | 自定义标记，方便以后过滤/统计 |

`title` 存完整提示词，方便你在 ST 里查看这张图是怎么写出来的。

---

## 9. 去重与防并发

### 签名

```js
signatureFor(chatId, message, body)
```

把 `chatId | send_date | body` 做 32 位哈希，返回 `hash:length`。

- 同一段正文只生成一次；
- 重新 swipe 出不同正文，`send_date` 和 body 都变，会重新生成；
- 手动“立即生成”绕过签名，方便调试。

### 媒体检查

`hasMedia(message)` 检查 `extra.media.length > 0`。

图片消息被 `appendImage()` 发出 `CHARACTER_MESSAGE_RENDERED` 后，`onCharacterMessageRendered` 第一道检查就会挡住它，所以不会“图生图”。

### busy 锁

`runForMessage()` 用模块级 `busy` 布尔值防并发。生成期间再来消息会直接跳过（手动按钮会提示“上一张还在生成中”）。

---

## 10. 设置持久化

所有设置挂在：

```js
extension_settings.k2auto
```

修改后调用 `saveSettingsDebounced()`，SillyTavern 会写进当前用户的 `settings.json`。

默认值在 `DEFAULT_SETTINGS`：

```js
{
  enabled: false,
  comfy_url: 'http://127.0.0.1:8188',
  workflow_name: 'Krea2_Turbo_T2I.json',
  width: 1024,
  height: 1024,
  steps: 8,
  scale: 1,
  sampler: 'euler',
  scheduler: 'simple',
  denoise: 1,
  seed: -1,
  ...
  llm_url: 'http://127.0.0.1:11434/v1',
  llm_model: 'richardyoung/qwen2.5-7b-instruct-abliterated:latest',
  llm_timeout_ms: 240000,
  delay_ms: 1800,
  ...
}
```

默认关闭 `enabled`，避免安装后立刻对历史消息或新消息产生请求。

---

## 11. 扩展加载流程

`init()`：

1. 用 `renderExtensionTemplateAsync('third-party/k2-auto-image', 'settings')` 把 `settings.html` 渲染到扩展设置容器；
2. 读 `extension_settings.k2auto`，缺的字段用 `DEFAULT_SETTINGS` 补齐；
3. 把设置值写回所有 `k2auto_*` 输入框；
4. 绑定 input/change 事件；
5. 绑定“测试连接”“立即生成”按钮；
6. 注册 `CHARACTER_MESSAGE_RENDERED` 监听。

SillyTavern 在页面初始化时加载 `manifest.json` 里声明的 `index.js` 和 `style.css`。

---

## 12. 改造指南

### 换生图模型

1. 在 ComfyUI 里搭好新工作流；
2. 用“Save (API Format)”导出；
3. 把要动态替换的值改成带引号的占位符；
4. 把 JSON 放到 `data/default-user/user/workflows/`；
5. 扩展设置里改“工作流文件名”，必要时改宽高/步数/CFG/采样器。

扩展代码不需要动。

### 换本地 LLM

只改设置里的 `llm_url` 和 `llm_model`。

只要接口兼容 OpenAI Chat Completions，并且 SillyTavern 的 `custom` 源能访问，就能用。

### 改画风

改三个地方：

1. `quality_prefix`：正向风格词；
2. `negative_prompt`：排除项；
3. `stage1_system` / `stage2_system`：描述和翻译时的风格约束。

`prompts/` 目录里有同样的默认文本，方便复制。

### 加角色一致性

默认工作流是纯文生图。要做角色固定，可以在工作流里加：

- `LoadImage` 读取 `ComfyUI/input/` 下的参考图；
- IP-Adapter / InstantID / PuLID 等节点；
- 把参考图文件名放到扩展设置的 `ref_image`，工作流里用 `"%char_ref_image%"`。

这属于工作流改造，扩展只负责替换文件名。

---

## 13. 已知边界

- 只支持一条 AI 文本生成一张图；
- 只处理最后一条 AI 消息，不补历史；
- 依赖 SillyTavern 的 `extra.media` 消息格式，过老的版本可能不兼容；
- 依赖 `/api/sd/comfy/*` 路由，极简部署或禁用相关模块时可能不存在；
- 本地 LLM 的质量决定提示词质量，7B 以下模型容易写得太短；
- 生成期间切换聊天会丢弃图片（避免贴错会话）。

---

## 14. 相关文件

| 文件 | 内容 |
| --- | --- |
| `extension/index.js` | 全部逻辑 |
| `extension/settings.html` | 设置面板 |
| `extension/style.css` | 面板样式 |
| `extension/manifest.json` | 扩展元数据 |
| `comfyui/Krea2_Turbo_T2I.json` | 默认 API 工作流 |
| `prompts/*.txt` | 默认提示词文本 |
| `docs/configuration.md` | 每个设置项 |
| `docs/troubleshooting.md` | 排错 |
