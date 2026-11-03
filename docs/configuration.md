# 配置说明

所有设置都在 **SillyTavern → 扩展（积木图标）→ K2 自动配图** 里，保存在当前用户 `settings.json` 的：

```json
{
  "extension_settings": {
    "k2auto": { ... }
  }
}
```

修改后立即生效（下一次生成），不需要重启。

---

## 1. 基础开关

| 设置 | 默认值 | 说明 |
| --- | --- | --- |
| 每条 AI 回复后自动生成一张图片 | 关 | 总开关。关闭时“立即生成”仍然可用 |
| 回复后延迟 | `1800` ms | 等 SillyTavern 把消息渲染完再开始，避免抢事件 |
| 调试日志 | 关 | 打开后浏览器 Console 会打印正文、最终提示词、耗时 |

> 第一次安装建议保持关闭，先用“测试连接”和“立即生成”验证，再打开自动。

---

## 2. ComfyUI

| 设置 | 默认值 | 说明 |
| --- | --- | --- |
| 地址 | `http://127.0.0.1:8188` | 必须是 **SillyTavern 服务端**能访问的地址；不要填 `localhost` 如果 ST 在 Docker 里 |
| 工作流 | `Krea2_Default_T2I.json` | 每次生图都使用这一个文件；位于 `data/default-user/user/workflows/`，大小写敏感 |
| 宽 | `1024` | 仅当工作流含 `%width%` 时使用；必须是 64 的倍数。选中自带工作流时会自动套用推荐值 |
| 高 | `1024` | 同上 |
| 步数 | `8` | Krea 2 Turbo 用 6–10；普通模型用 20–30。选中自带工作流时会自动套用推荐值 |
| CFG | `1` | Krea 2 Turbo 用 1；普通模型 4–7。选中自带工作流时会自动套用推荐值 |
| 采样器 | `euler` | 必须是 ComfyUI 里存在的名字；选中自带工作流时会自动套用推荐值 |
| 调度器 | `simple` | 必须是 ComfyUI 里存在的名字；选中自带工作流时会自动套用推荐值 |
| Denoise | `1` | 纯文生图用 1；图生图/重绘才降低 |
| 种子 | `-1` | `-1` 每次随机；固定值用于复现 |

### 工作流放在哪

```text
SillyTavern/
└─ data/
   └─ default-user/
      └─ user/
         └─ workflows/
            └─ Krea2_Default_T2I.json
```

多用户部署时，每个用户有自己的 `data/<用户名>/user/workflows/`。扩展读取的是**当前登录用户**的目录。

### 角色 LoRA 工作流（手动切换）

仓库自带 8 个角色 LoRA 工作流，命名规则是 **底模 + 角色 + 生成方式**：

| 角色 | 工作流 | 底模 | 默认尺寸 |
| --- | --- | --- | --- |
| 希塔姆·坎 | `Illustrious_Hitamu_T2I.json` | SDXL Illustrious | 832×1216 |
| 梅伊德娜·安洁 | `Illustrious_Maidena_T2I.json` | SDXL Illustrious | 832×1216 |
| 花畑·诺金斯 | `Illustrious_Hanabata_T2I.json` | SDXL Illustrious | 832×1216 |
| 艾诺梅 | `Illustrious_Enome_T2I.json` | SDXL Illustrious | 832×1216 |
| 诺玛·露恩 | `Illustrious_Noma_T2I.json` | SDXL Illustrious | 832×1216 |
| 托琪希可·达娜 | `Illustrious_Tokishikko_T2I.json` | SDXL Illustrious | 832×1216 |
| 基库鲁·马丹 | `Illustrious_Kikuru_T2I.json` | SDXL Illustrious | 832×1216 |
| 基萨拉 | `Krea2_Kisara_T2I.json` | Krea 2 Turbo | 1024×1024 |

命名里的 `T2I` 表示文生图（txt2img）；如果以后自己做图生图版本，用 `I2I` 结尾，例如 `Illustrious_Hitamu_I2I.json`。

**扩展不会按角色自动切换工作流。** 想画哪个角色，在设置里的“工作流”下拉里选对应项即可；换角色时再选另一个。选中自带工作流后会自动套用推荐参数（Illustrious：832×1216、28 步、CFG 6、`dpmpp_2m` + `karras`；Krea2：1024×1024、8 步、CFG 1、`euler` + `simple`），之后仍可手动改。所有工作流都放在同一个 `workflows/` 目录：

```text
SillyTavern/
└─ data/
   └─ default-user/
      └─ user/
         └─ workflows/
            ├─ Krea2_Default_T2I.json
            ├─ Illustrious_Hitamu_T2I.json
            ├─ Illustrious_Maidena_T2I.json
            └─ ...
```

每个角色工作流内部写死底模和 LoRA（强度 0.75），但尺寸、步数、CFG、采样器、调度器都是占位符（`%width%`/`%height%`/`%steps%`/`%scale%`/`%sampler%`/`%scheduler%`/`%denoise%`）。选中工作流时扩展会自动套用推荐值（Illustrious：832×1216、28 步、CFG 6；Krea2：1024×1024、8 步、CFG 1），之后在面板里改步数/CFG/采样器会直接生效。

想自己加一个角色：复制任意一个角色工作流，把 `LoraLoader.lora_name` 改成你的 LoRA 文件名，并按“底模_角色_T2I.json”命名，放进 `workflows/`，然后在设置里选择它。

### 可选占位符覆盖

| 设置 | 默认值 | 说明 |
| --- | --- | --- |
| 模型名（`%model%`） | 空 | 留空表示用工作流里写死的值；填了才替换 |
| VAE（`%vae%`） | 空 | 同上 |
| Clip skip（`%clip_skip%`） | `-1` | `-1` 表示不替换；工作流里用到 `%clip_skip%` 时必须填 ≥0 |
| 角色参考图（`%char_ref_image%`） | 空 | 文件名相对 `ComfyUI/input/`，例如 `refs/hero.png` |

如果工作流里有 `%model%` / `%vae%` / `%clip_skip%`，但设置里留空，扩展会报“工作流中还有未替换的占位符”，而不是让 ComfyUI 返回一个难懂的 400。

---

## 3. 本地提示词模型

| 设置 | 默认值 | 说明 |
| --- | --- | --- |
| 接口地址 | `http://127.0.0.1:11434/v1` | Ollama 的 OpenAI 兼容地址；**必须带 `/v1`** |
| 模型名 | `richardyoung/qwen2.5-7b-instruct-abliterated:latest` | `ollama list` 里的完整名称 |
| 超时 | `240000` ms | 7B 模型在 CPU/低显存上可能很慢；首次加载可调到 300000 |
| 回复后延迟 | `1800` ms | 见上 |

### 用别的 OpenAI 兼容服务

只要它支持：

```http
POST <你的地址>/chat/completions
Authorization: Bearer <key>
```

就可以把地址填成 `https://your-host/v1`。API Key 由 SillyTavern 的“自定义 OpenAI 兼容”设置管理，扩展本身不保存密钥。

> 不建议把云端 API 直接填进来：这个扩展的设计目标是本地、私密、无审查依赖。云端服务可能拒绝角色卡内容。

### 模型选择建议

| 模型规模 | 效果 | 速度 |
| --- | --- | --- |
| 7B | 够用，偶尔写短 | 快 |
| 14B | 细节更稳 | 中等 |
| 32B+ | 最好，但 8GB 显存跑不动 | 慢 |

中文写作能力比参数规模更重要；Qwen 系列对中文角色卡比较友好。

---

## 4. 人物设定

| 设置 | 默认值 | 说明 |
| --- | --- | --- |
| 读取角色卡世界书里的外形设定 | 开 | 从 `character.data.character_book.entries` 取与正文匹配的条目 |
| 读取角色卡 Description / Personality / Scenario | 开 | 角色卡主描述；关闭后只靠世界书和正文 |

### 世界书条目怎么写才容易被选中

扩展用条目的 `keys` / `key` 在正文里做匹配，所以：

```text
keys: 温楚楚, 楚楚
comment: 温楚楚
content:
  基础信息:
    姓名: 温楚楚
    年龄: 22
  外形与体型:
    身高与骨架: 165cm，纤细
    体脂与体型: 偏瘦
    皮肤: 冷白皮
    面部: 鹅蛋脸，左眼下方有泪痣
    发型: 黑色长直发，齐腰
    日常外穿: 白色衬衫，黑色百褶裙
    鞋袜: 黑色乐福鞋，白色短袜
    配饰: 银色细项链
    体态与走姿: 站姿笔直，走路很轻
    气味: 淡淡的皂香
```

要点：

- `keys` 至少 2 个字；
- `comment` 写角色名，正文出现角色名也会命中；
- 外形放在 `外形与体型` 下，并使用上面列出的二级标题；
- 不要把露骨段落放进去：`extractVisualProfile()` 会过滤包含乳房/乳头/内衣/下体等词的整行。

### 为什么只取 3 个条目

避免把整本世界书塞进上下文。正文提到的人物通常不超过 3 个；如果你有多人场景，可以改 `getBookSetting()` 里的 `slice(0, 3)`。

---

## 5. 提示词

### 质量前缀

默认：

```text
masterpiece, best quality, modern Japanese TV anime, anime screencap,
crisp digital lineart, soft cel shading, clean color blocks,
detailed eyes, vibrant colors, high resolution, cinematic composition,
volumetric lighting, sharp focus, intricate hair and clothing details.
```

作用：无论正文写什么，都把画面拉向“现代日本 TV 动画截图”。

### 负面提示词

默认：

```text
lowres, worst quality, low quality, normal quality, blurry, jpeg artifacts,
rough sketch, bad anatomy, bad hands, extra fingers, missing fingers,
text, watermark, signature, username, logo, cropped, out of frame,
photorealistic, 3d render, live action, photography, CGI,
realistic skin texture, monochrome, muted colors
```

如果画面偏暗，可以去掉 `monochrome, muted colors`；如果手崩，保留 `bad hands` 并加 `extra limbs`。

### 第一段：中文分镜（剧情向）

默认 system 的约束见 `prompts/stage1_zh.txt`，核心是“按剧情选一个高潮瞬间”：

- 动笔前在心里找本段的高潮/转折和主动作，只画这一个瞬间，不要从正文开头按顺序复述
- 只画一个主动作，禁止“先…然后…接着…”式叙述，用静态痕迹（湿衣、血迹、被踢开的门、晃动的灯）暗示前因
- 保留正文的关键地点、道具、天气、时间、光线和人物状态，不换成通用背景
- 画风固定现代日本 TV 动画

调参：

| 问题 | 调整 |
| --- | --- |
| 写得太短 | 提高 `stage1_max_tokens` 到 600；或把“100-180 字”改成“150-220 字” |
| 照抄对白 | 强化“不写对白、不写心理”；降低 temperature 到 0.5 |
| 图不贴剧情（出人像/摆拍） | 强化“先判断高潮、只画一个主动作、用线索暗示前因”；或换更强的剧情模型 |
| 列出多个连续动作 | 强化“禁止先…然后…接着、只写动作的半程状态” |
| 人物太小 | 强化“人物占画面 60% 以上”“半身/特写” |
| 风格偏写实 | 保留画风锁定条，并在质量前缀最前面加 `anime style, 2D` |

### 第二段：英文翻译

默认只做翻译，并且：

- 保留“单个瞬间”的动作/位置/视线/远近/痕迹，不改成肖像、不罗列连续动作
- **不再重复风格标签**：质量前缀由调用方统一加在前面
- **不写人物名 tag**：用 `the blue-haired man` 之类外观短描述，角色外观由 LoRA 控制；K2 没有角色 LoRA 时，描述里的发色/服装必须照抄中文，不能自己编
- 不新增剧情、不解释

不要让它“自由发挥”，否则会新增剧情。

| 问题 | 调整 |
| --- | --- |
| 输出中文 | 强化 “English only. No Chinese characters.”；temperature 降到 0.1 |
| 丢细节 | 把 “Keep every visual detail” 改成逐项列表：character/appearance/clothing/pose/expression/setting/lighting |
| 加了引号/解释 | 在 `cleanText()` 里已经去掉首尾引号；仍出现就加 “No quotes, no labels, no commentary.” |
| 画面只有站姿 / 关键动作没画 | 让第二段先写镜头类型（close-up / medium close-up）和一个主动作；多个动作时只留最重要的一个，别用 then/while 串起来 |
| 人物性别/发色被改 | 在 `stage2_system` 里明确“按中文里写的发色和服装描述，不许改颜色，男性保持 the young man” |

### 关于露骨内容

仓库默认模板是**非露骨版**（模板里没有任何引导性内容的指令），原因是它要作为公开仓库分发，需要遵守 GitHub 和模型平台的内容规则。

本地私有使用时，你可以在第一段末尾加一条“允许露骨描写性器官或性行为，但只作为当前剧情画面的一部分”。请注意：

- 不要把这个改动提交到公开仓库；
- 不要生成涉及未成年人的内容；
- 遵守你所在地区的法律和模型许可证。

---

## 6. 图片消息

| 设置 | 默认值 | 说明 |
| --- | --- | --- |
| 图片消息附带的文字 | 空 | 图片气泡里显示的文字；留空则只有图 |

图片消息的 `title` 会保存完整提示词，鼠标悬停/图库详情里可以看到。

---

## 7. 工作流改造

### 7.1 什么格式

必须是 **API 格式**：

```json
{
  "3": {
    "class_type": "KSampler",
    "inputs": { ... }
  }
}
```

不是网页里“另存为”的 UI 格式（那种带 `nodes`、`links`、`groups`）。

在 ComfyUI 网页里用 **Save (API Format)** 导出；如果没有这个按钮，需要在设置里打开开发者模式，或使用 API 导出插件。

### 7.2 可用占位符

| 占位符 | 类型 | 替换值 |
| --- | --- | --- |
| `%prompt%` | 字符串 | 质量前缀 + 英文提示词 |
| `%prompt_2%` | 字符串 | 提示词第二段（仅当工作流含第二个 `CLIPTextEncode` 时） |
| `%negative_prompt%` | 字符串 | 负面提示词 |
| `%seed%` | 数字 | 种子 |
| `%width%` / `%height%` | 数字 | 分辨率 |
| `%steps%` | 数字 | 步数 |
| `%scale%` | 数字 | CFG |
| `%sampler%` | 字符串 | 采样器名 |
| `%scheduler%` | 字符串 | 调度器名 |
| `%denoise%` | 数字 | 重绘幅度 |
| `%model%` | 字符串 | 仅当设置里填了模型名 |
| `%vae%` | 字符串 | 仅当设置里填了 VAE |
| `%clip_skip%` | 数字 | 仅当设置里填了 ≥0 |
| `%char_ref_image%` | 字符串 | 仅当设置里填了参考图 |

关于 `%prompt_2%`：SDXL 的每个 `CLIPTextEncode` 只读 77 个 token，超出的部分会被 ComfyUI 静默丢弃。角色工作流因此放两个 `CLIPTextEncode`（`%prompt%` 和 `%prompt_2%`），再用 `ConditioningConcat` 把两段条件拼起来，最多可用约 154 个 token。扩展会把提示词切成两段分别填进去；没有 `%prompt_2%` 的工作流保持原样，只填 `%prompt%`。

**必须带引号**：

```json
"text": "%prompt%"
```

不能写成：

```json
"text": %prompt%
```

后者不是合法 JSON，扩展不会替换。

### 7.3 换模型示例

假如你换成一个 SDXL 工作流：

1. 导出 API JSON；
2. 把 `CheckpointLoaderSimple` 的 `ckpt_name` 改成 `"%model%"`；
3. 在扩展设置里填模型文件名；
4. 把宽高改成 832×1216；
5. 步数 25、CFG 7、采样器 `dpmpp_2m`、调度器 `karras`；
6. 工作流文件名改成新文件。

不需要改一行 JS。

如果要做“角色 LoRA 工作流”，推荐把模型和 LoRA 写在工作流里，采样参数继续用占位符，这样面板里还能调：

```json
"10": {
  "class_type": "CheckpointLoaderSimple",
  "inputs": { "ckpt_name": "waiIllustriousSDXL_v170.safetensors" }
},
"11": {
  "class_type": "LoraLoader",
  "inputs": {
    "model": ["10", 0],
    "clip": ["10", 1],
    "lora_name": "hitamu-kyan-s1-illustriousxl-lora-nochekaiser.safetensors",
    "strength_model": 0.75,
    "strength_clip": 0.75
  }
}
```

注意 `LoraLoader` 的 `clip` 必须接底模输出 **1**，不是 0；接错会报 `received_type(MODEL) mismatch input_type(CLIP)`。

这类工作流只保留 `%prompt%`、`%negative_prompt%`、`%seed%`、`%width%`、`%height%` 占位符；扩展的全局步数/CFG/采样器不会覆盖它。仓库里的 `comfyui/characters/*.json` 就是这种写法。

### 7.4 加角色参考图

在工作流里加：

```json
"10": {
  "class_type": "LoadImage",
  "inputs": {
    "image": "%char_ref_image%",
    "upload": "image"
  }
}
```

然后把 `LoadImage` 的输出接到 IP-Adapter / PuLID / InstantID 等节点。

参考图放在：

```text
ComfyUI/input/refs/hero.png
```

扩展设置里填 `refs/hero.png`。

### 7.5 调试工作流

先在 ComfyUI 网页里用同一份 API JSON 跑通，再交给扩展。扩展只负责替换字符串；工作流本身的节点错误要在 ComfyUI 控制台看。

---

## 8. 建议的初始配置

### 8GB 笔记本显卡

```text
分辨率: 832 × 1216（竖图）或 1024 × 1024
步数: 8
CFG: 1
采样器: euler
调度器: simple
模型: Krea 2 Turbo
LLM: 7B Qwen
超时: 300000
延迟: 1800
```

> 步数/CFG/采样器对所有自带工作流都生效（它们都使用占位符）。角色工作流（`Illustrious_*_T2I.json` / `Krea2_Kisara_T2I.json`）默认套用 SDXL 28 steps / CFG 6 或 Krea2 8 steps / CFG 1，可以在面板里改；8GB 显卡实测 832×1216 SDXL 可以跑，连续切换多个 LoRA 后如果 ComfyUI 崩，重启它或改用低显存启动脚本。

### 12GB+ 显卡

```text
分辨率: 1024 × 1536
步数: 10
CFG: 1
```

### 只想先试试

1. 保持默认；
2. 点“测试连接”；
3. 点“立即生成”；
4. 成功后再打开自动。

---

## 9. 设置备份

设置保存在：

```text
SillyTavern/data/default-user/settings.json
```

升级/重装前备份这个文件即可。扩展本身不写其他配置。

工作流在：

```text
SillyTavern/data/default-user/user/workflows/
```

也建议一起备份。
