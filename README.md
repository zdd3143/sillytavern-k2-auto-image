# SillyTavern K2 Auto Image

给 [SillyTavern](https://github.com/SillyTavern/SillyTavern) 用的**本地自动配图扩展**：每收到一条 AI 正文，就提取当前场景和人物设定，让本地 Qwen 写成生图提示词，再调用本地 ComfyUI 生成一张现代日本 TV 动画风格的插图，并自动贴回聊天。

默认使用 Krea 2 Turbo；也随仓库带了一批**按“底模 + 角色 + 文生图/图生图”命名**的 LoRA 工作流（`Illustrious_<角色>_T2I.json` / `Krea2_Kisara_T2I.json`），适合“不道德公会”这类多角色卡。扩展总是使用设置里指定的一个工作流，不自动切换。

整个流程都在本机完成：

- 不需要云端生图 API
- 不需要把聊天记录发给第三方
- 不修改 SillyTavern 核心文件
- 一条 AI 文本只生成一张图，图片消息不会再次触发

> 适用场景：本地跑 SillyTavern + ComfyUI + Ollama，想要“每轮自动配图”，但不想让生图模型读取整段聊天历史、也不想把角色卡发到云端。

---

## 功能

- **只读当前正文**：优先提取最后一条 AI 消息里的 `<game>...</game>`；没有 `<game>` 时自动剥离 `<think>`、`<options>`、`<summary>`、`<comment>`、变量/状态 JSON、HTML 标签和数值行。
- **人物设定**：读取当前角色卡的 `Description / Personality / Scenario`，以及角色卡世界书里与正文人物匹配的外形条目（基础信息、身高骨架、体脂、皮肤、面部、发型、日常外穿、鞋袜、配饰、体态、气味）。
- **两段式本地提示词**：第一段让 Qwen 按“剧情”写画面——先判断本段的高潮/转折，只画一个主动作，用静态痕迹（湿衣、血迹、被踢开的门、晃动的灯）暗示前因，不照抄对白、不罗列连续动作；第二段只做英文翻译，不再重复风格标签，也不把人物名写进提示词（外观由角色 LoRA 决定）。
- **固定动漫风格**：质量前缀锁定 `modern Japanese TV anime`，负面词排除 `photorealistic / 3d render / live action / CGI`。
- **角色 LoRA 工作流（手动切换）**：随仓库提供 8 个按“底模 + 角色 + 文生图/图生图”命名的工作流（7 个 `waiIllustriousSDXL_v170` + Illustrious 角色 LoRA，基萨拉为 Krea 2 Turbo + `Kisara_krea2` LoRA）。模型和 LoRA 写在各自工作流里；尺寸、步数、CFG、采样器、调度器都是占位符，选中工作流会自动套用推荐值，之后可在面板里自由修改。想用哪个角色，就在“工作流”下拉里选它，不会自动按角色切换。
- **一条文本一张图**：只处理没有媒体的 AI 消息；生成出的图片消息会被识别并跳过；同一正文有签名去重。
- **可配置**：ComfyUI 地址、工作流、分辨率、步数、CFG、采样器、种子、本地 LLM 地址/模型、两段 system prompt、质量前缀、负面词。
- **手动测试**：设置面板里有“测试连接”和“立即生成”，不用先发消息。

---

## 效果

生成示例（本地 Krea 2 Turbo，1024×1024，8 steps）：

| 场景 | 输出 |
| --- | --- |
| 白发魔女、夜晚森林、月光、黑色巫师帽 | 现代 TV 动画截图感，干净线稿、赛璐璐上色 |

> 仓库不附带生成图片；请用你自己的角色卡测试。

---

## 环境要求

| 组件 | 要求 | 本项目测试版本 |
| --- | --- | --- |
| SillyTavern | 支持 third-party 扩展和媒体消息，建议 1.12+ | 1.19.0 |
| ComfyUI | 支持 Krea 2 的 `CLIPLoader type=krea2`，建议较新版本 | 0.37.0 |
| 显卡 | 8GB 显存可跑 1024×1024 / 8 steps；更低显存建议 768 | RTX 4060 Laptop 8GB |
| Ollama | OpenAI 兼容 `/v1` 接口 | 最新版 |
| 本地 LLM | 7B 级别，中文写作 + 英文翻译 | `richardyoung/qwen2.5-7b-instruct-abliterated:latest` |
| 生图模型 | Krea 2 Turbo（基萨拉/默认）或 SDXL/Illustrious（7 个角色 LoRA） | 见下方模型表 |

### 模型文件

把以下文件放进 ComfyUI 对应目录（文件名必须与工作流一致，或自己改工作流）：

| 文件 | 放到 | 作用 |
| --- | --- | --- |
| `krea2Turbo_v10_2951489.safetensors` | `ComfyUI/models/diffusion_models/` | Krea 2 Turbo 主模型（基萨拉/默认） |
| `qwen3vl_4b_abliterated_fp8_scaled.safetensors` | `ComfyUI/models/text_encoders/` | Krea 2 文本编码器 |
| `qwen_image_vae.safetensors` | `ComfyUI/models/vae/` | Krea 2 VAE |
| `waiIllustriousSDXL_v170.safetensors` | `ComfyUI/models/checkpoints/` | SDXL/Illustrious 底模（7 个角色） |
| `hitamu-kyan-s1-illustriousxl-lora-nochekaiser.safetensors` 等 7 个角色 LoRA | `ComfyUI/models/loras/` | 对应角色外观；文件名见 `comfyui/characters/*.json` |
| `Kisara_krea2.safetensors` | `ComfyUI/models/loras/` | 基萨拉 Krea 2 LoRA |

> 模型权重和角色 LoRA 不包含在本仓库中，请从模型发布页自行下载并遵守其许可证。没有 Krea 2 或 SDXL 也可以换任意 ComfyUI 文生图工作流，只要保留本项目使用的占位符，见 [docs/configuration.md](docs/configuration.md)。

---

## 快速开始

### 1. 安装扩展

```powershell
git clone https://github.com/zdd3143/sillytavern-k2-auto-image.git
cd sillytavern-k2-auto-image

# 默认安装到 D:\SillyTavern；如你的路径不同，改 -SillyTavernPath
powershell -ExecutionPolicy Bypass -File .\install.ps1 -SillyTavernPath "D:\SillyTavern"

# 多用户部署时指定用户名（默认 default-user）
powershell -ExecutionPolicy Bypass -File .\install.ps1 -SillyTavernPath "D:\SillyTavern" -User "你的用户名"
```

安装脚本会做两件事：

1. 把 `extension/` 复制到 `SillyTavern/public/scripts/extensions/third-party/k2-auto-image/`
2. 把 `comfyui/Krea2_Default_T2I.json` 和 `comfyui/characters/*.json` 复制到 `SillyTavern/data/default-user/user/workflows/`

安装后工作流目录里应有 1 个默认工作流（`Krea2_Default_T2I.json`）+ 8 个角色 LoRA 工作流（`Illustrious_<角色>_T2I.json` / `Krea2_Kisara_T2I.json`）。

也可以手动复制，目录结构见 [docs/how-it-works.md](docs/how-it-works.md)。

### 2. 启动 Ollama 并准备模型

```powershell
ollama serve
ollama pull richardyoung/qwen2.5-7b-instruct-abliterated:latest
```

如果你用别的本地模型，在扩展设置里改“模型名”即可；不要求一定是 abliterated 版本。

### 3. 启动 ComfyUI

```powershell
# 在 ComfyUI 目录
python main.py --listen 127.0.0.1 --port 8188
```

浏览器打开 `http://127.0.0.1:8188`，确认能正常出图。

### 4. 重启 SillyTavern

安装扩展后需要重启 SillyTavern，然后**硬刷新**网页（`Ctrl+F5`）。

> 如果之前用 Quick Reply、内置 Stable Diffusion 的自动生成、或其他自动配图扩展，请先停用它们。两条管线同时监听同一条 AI 消息会各生成一张图，看起来像“重复出图”。

### 5. 配置并测试

打开 SillyTavern：

```text
扩展（积木图标） -> K2 自动配图
```

按顺序做：

1. 点 **测试连接**，确认 ComfyUI 和本地 LLM 都能连上
2. 点 **立即生成**，用当前最后一条 AI 正文生成一张图
3. 确认图片正常后，勾选 **每条 AI 回复后自动生成一张图片**

默认是关闭状态，避免安装后立刻产生额外请求。

---

## 它是怎么实现的

一句话：**SillyTavern 扩展只负责“取正文 + 写提示词 + 调 ComfyUI + 贴图”，ComfyUI 负责画，Ollama 负责写提示词。**

```text
AI 回复
  │
  ▼
CHARACTER_MESSAGE_RENDERED 事件
  │
  ├─ 忽略用户消息 / 系统消息 / 图片消息
  ├─ extractMainBody()          只取 <game> 或清洗后的正文
  ├─ getCharacterSetting()      角色卡 + 世界书外形条目
  ├─ callLocalLlm() × 2         中文分镜 -> 英文提示词
  ├─ quality_prefix + negative  固定动漫风格
  ├─ buildWorkflow()            按“工作流”设置替换占位符
  ├─ POST /api/sd/comfy/generate
  ├─ saveBase64AsFile()         保存到 SillyTavern 用户图片目录
  └─ chat.push + addOneMessage  作为图片消息贴回聊天
```

关键点：

- 扩展监听 `event_types.CHARACTER_MESSAGE_RENDERED`，不是轮询。
- 只处理**最后一条没有媒体的 AI 消息**；正文不足 20 字直接跳过。
- 生成出的图片消息也带 `extra.media`，所以下一次事件会被开头的媒体检查挡住，不会“图生图”。
- 同一段正文用 `chatId + send_date + 正文` 做签名，避免重复触发。
- 本地 LLM 走 SillyTavern 的服务端代理 `/api/backends/chat-completions/generate`，浏览器不直接跨域访问 Ollama。
- ComfyUI 走 SillyTavern 的服务端代理 `/api/sd/comfy/generate`，浏览器不直接跨域访问 8188。
- 图片通过 `/api/images/upload` 保存，消息结构沿用 SillyTavern 的 `extra.media` 格式。
- 每次生图只用设置里指定的**一个工作流**；想换角色 LoRA，就把对应文件名填进“工作流”，不按角色自动切换。

完整调用链、请求体和数据结构见 [docs/how-it-works.md](docs/how-it-works.md)。

---

## 配置说明

所有设置都在 **扩展 -> K2 自动配图** 面板里，保存在 SillyTavern 的 `settings.json` 的 `extension_settings.k2auto` 下。

最常改的几项：

| 设置 | 默认值 | 说明 |
| --- | --- | --- |
| 启用 | 关 | 勾选后每条 AI 回复自动生成 |
| ComfyUI 地址 | `http://127.0.0.1:8188` | 必须是 SillyTavern 服务端能访问的地址 |
| 工作流 | `Krea2_Default_T2I.json` | 位于 `data/default-user/user/workflows/`；想用某个角色 LoRA 就填对应文件名 |
| 宽 / 高 | 1024 / 1024 | 8GB 显存建议 768 或 1024 |
| 步数 / CFG | 8 / 1 | Krea 2 Turbo 用低步数、CFG 1 |
| 采样器 / 调度器 | `euler` / `simple` | 与工作流一致 |
| 本地 LLM 地址 | `http://127.0.0.1:11434/v1` | Ollama 的 OpenAI 兼容地址，保留 `/v1` |
| 本地 LLM 模型 | 见默认值 | `ollama list` 里的完整名称 |
| 回复后延迟 | 1800ms | 等聊天渲染稳定再开始 |
| 读取世界书 | 开 | 从角色卡 `character_book` 取外形设定 |
| 调试日志 | 关 | 打开后在浏览器 Console 看每步输出 |

完整表格（包括高级提示词参数）见 [docs/configuration.md](docs/configuration.md)。

---

## 工作流占位符

`comfyui/Krea2_Default_T2I.json` 是一个 ComfyUI **API 格式**工作流，扩展会替换以下占位符（必须保留引号，例如 `"%prompt%"`）：

| 占位符 | 替换为 |
| --- | --- |
| `%prompt%` | 质量前缀 + 英文提示词 |
| `%negative_prompt%` | 负面提示词 |
| `%seed%` | 种子，`-1` 时随机 |
| `%width%` / `%height%` | 分辨率 |
| `%steps%` | 步数 |
| `%scale%` | CFG |
| `%sampler%` / `%scheduler%` | 采样器 / 调度器 |
| `%denoise%` | 重绘幅度 |
| `%model%` / `%vae%` / `%clip_skip%` | 可选，设置面板留空则不覆盖 |
| `%char_ref_image%` | 可选，角色参考图文件名（位于 `ComfyUI/input`） |

### 内置角色工作流

| 角色 | 工作流 | 底模 | LoRA |
| --- | --- | --- | --- |
| 希塔姆·坎 | `Illustrious_Hitamu_T2I.json` | `waiIllustriousSDXL_v170` | `hitamu-kyan-s1-illustriousxl-lora-nochekaiser` |
| 梅伊德娜·安洁 | `Illustrious_Maidena_T2I.json` | 同上 | `maidena-ange-s1-illustriousxl-lora-nochekaiser` |
| 花畑·诺金斯 | `Illustrious_Hanabata_T2I.json` | 同上 | `hanabata-nohkins-s1-illustriousxl-lora-nochekaiser` |
| 艾诺梅 | `Illustrious_Enome_T2I.json` | 同上 | `enome-s1-illustriousxl-lora-nochekaiser` |
| 诺玛·露恩 | `Illustrious_Noma_T2I.json` | 同上 | `noma-rune-s1-illustriousxl-lora-nochekaiser` |
| 托琪希可·达娜 | `Illustrious_Tokishikko_T2I.json` | 同上 | `tokishikko_dana_V1_IL` |
| 基库鲁·马丹 | `Illustrious_Kikuru_T2I.json` | 同上 | `kikuru_futoku_884402` |
| 基萨拉 | `Krea2_Kisara_T2I.json` | Krea 2 Turbo | `Kisara_krea2` |

SDXL 角色工作流默认 832×1216、28 steps、CFG 6、`dpmpp_2m` / `karras`；基萨拉 1024×1024、8 steps、CFG 1、`euler` / `simple`。这些值写在工作流里，扩展不会用全局设置覆盖。

换别的模型/工作流时，只要工作流是 API 格式并保留这些占位符，扩展不需要改代码。详见 [docs/configuration.md](docs/configuration.md)。

---

## 常见问题

### 扩展面板不出现

- 确认目录是 `public/scripts/extensions/third-party/k2-auto-image/`
- 确认 `manifest.json` 和 `index.js` 在目录根部
- 重启 SillyTavern，然后 `Ctrl+F5`
- 打开浏览器 Console 看是否有红色报错

### 报“读取工作流失败”

- 工作流是否在 `data/default-user/user/workflows/Krea2_Default_T2I.json`
- 文件名是否和设置里完全一致（含大小写）
- 是否重启过 SillyTavern

### ComfyUI 返回 500

- ComfyUI 是否在运行：浏览器打开 `http://127.0.0.1:8188`
- 模型文件名是否和工作流一致
- 看 ComfyUI 控制台的节点报错；常见是模型没放对目录、`CLIPLoader type=krea2` 不支持（ComfyUI 太旧）
- 先用 ComfyUI 网页手动跑一遍同一个工作流

### 生成了错误的角色

- 扩展不按角色自动切换工作流；打开“调试日志”，确认“工作流”设置里填的是你想要的那个 `Illustrious_<角色>_T2I.json` 或 `Krea2_Kisara_T2I.json`
- 确认该工作流文件在 `data/default-user/user/workflows/` 且文件名大小写一致
- 换角色时手动改“工作流”设置即可

### ComfyUI 报 `CUDA error: an illegal memory access`

- 这是显卡/驱动在 LoRA 动态加载时的偶发错误，不是扩展的 JSON 问题
- 先完全退出 ComfyUI 再启动，通常可以恢复
- 8GB 显存连续切换多个 SDXL LoRA 后更容易出现；可改用 `启动ComfyUI-低显存.bat`，或把 SDXL 工作流的分辨率降到 768×1152
- 如果每次都崩，换一个 LoRA 文件或降低 `strength_model` 再试

### 本地 LLM 报 400 / 404

- 地址必须是 `http://127.0.0.1:11434/v1`（带 `/v1`）
- 模型名用 `ollama list` 的完整名称
- 先 `ollama run <模型名> "你好"` 确认模型可用

### 有文字但没有图

- 是否勾选“启用”
- 最后一条 AI 消息正文是否少于 20 字
- 最后一条是否已经是图片（图片消息会被跳过）
- 同一段正文是否已经生成过（签名去重）
- 打开“调试日志”，看 Console 停在哪一步

更多见 [docs/troubleshooting.md](docs/troubleshooting.md)。

---

## 性能与限制

- 一次生成 = 2 次本地 LLM 请求 + 1 次 ComfyUI 请求；7B Qwen + Krea 2 在 8GB 笔记本显卡上通常 **25–60 秒**，SDXL 28 steps 约 **30–50 秒**，首次加载模型可能更久。
- 一条 AI 文本只生成一张图；重新 swipe 出不同正文会再生成。
- 不支持一次回复生成多张、也不支持视频。
- 提示词质量高度依赖本地 LLM；7B 以下模型容易写得太短或照抄对白。
- 角色一致性由角色 LoRA 工作流提供；如果换成没有 LoRA 的工作流，需要自己在工作流里加 `LoadImage` 和参考图节点。
- 生成内容是否合适由使用者负责；请遵守当地法律、模型许可证和你分享平台的规则。

---

## 目录结构

```text
sillytavern-k2-auto-image/
├─ extension/                 # SillyTavern 第三方扩展
│  ├─ manifest.json
│  ├─ index.js                # 事件、提取、LLM、ComfyUI、贴图
│  ├─ settings.html           # 设置面板
│  └─ style.css
├─ comfyui/
│  ├─ Krea2_Default_T2I.json    # 默认 Krea2 API 工作流（带占位符）
│  └─ characters/             # 8 个角色 LoRA 工作流
│     ├─ Illustrious_Hitamu_T2I.json
│     ├─ Illustrious_Maidena_T2I.json
│     ├─ Illustrious_Hanabata_T2I.json
│     ├─ Illustrious_Enome_T2I.json
│     ├─ Illustrious_Noma_T2I.json
│     ├─ Illustrious_Tokishikko_T2I.json
│     ├─ Illustrious_Kikuru_T2I.json
│     └─ Krea2_Kisara_T2I.json
├─ prompts/                   # 默认提示词，便于复制/修改
│  ├─ stage1_zh.txt
│  ├─ stage2_en.txt
│  ├─ quality_prefix.txt
│  └─ negative.txt
├─ docs/
│  ├─ how-it-works.md         # 实现原理与调用链
│  ├─ configuration.md        # 全部配置项与工作流占位符
│  ├─ troubleshooting.md      # 排错
│  ├─ publishing.md           # 上传 GitHub 的步骤
│  └─ privacy-and-safety.md   # 数据与内容边界
├─ examples/
│  ├─ settings.snippet.json   # settings.json 参考片段
│  └─ character-book-entry.md # 世界书外形条目写法
├─ .github/
│  ├─ workflows/check.yml     # 语法/JSON 检查
│  └─ ISSUE_TEMPLATE/         # Issue 模板
├─ CHANGELOG.md
├─ CONTRIBUTING.md
├─ install.ps1
├─ uninstall.ps1
├─ LICENSE
└─ README.md
```

---

## 上传到 GitHub

仓库已经按可公开分享的结构整理好。最短流程：

```powershell
cd sillytavern-k2-auto-image
git init
git add .
git commit -m "Initial release: local K2 auto image for SillyTavern"
git branch -M main
git remote add origin https://github.com/zdd3143/sillytavern-k2-auto-image.git
git push -u origin main
```

上传前建议：

1. 仓库地址已按 `zdd3143/sillytavern-k2-auto-image` 填好；如果你 fork 或改名，同步替换 README 的 clone 地址和 `extension/manifest.json` 的 `homePage`
2. 确认没有把 `data/`、生成图片、模型权重、API Key 提交进去
3. 在仓库 About 里填一句简介和 topics：`sillytavern` `comfyui` `krea2` `ollama` `anime`
4. 打一个 `v0.4.0` tag / Release

详细步骤和可选的 Release 说明模板见 [docs/publishing.md](docs/publishing.md)。

---

## 许可证与致谢

- 本仓库的扩展代码和文档：MIT，见 [LICENSE](LICENSE)。
- SillyTavern 本体：AGPL-3.0；本扩展通过公开事件和服务端接口集成，不复制其核心代码。
- Krea 2 Turbo、Qwen、ComfyUI 及其节点：分别遵循各自许可证；模型权重不随本仓库分发。
- 思路来自本地 SillyTavern + ComfyUI + Ollama 的自动配图实践；感谢 SillyTavern、ComfyUI、Krea、Qwen 社区。
