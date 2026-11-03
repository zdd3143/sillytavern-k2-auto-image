# Changelog

## 0.7.0

修复“生成的图和描述对不上”：根因是 SDXL 每个 `CLIPTextEncode` 只读 77 个 token，长提示词的后半段被 ComfyUI 静默截断。

### 变更

- 7 个 `Illustrious_*_T2I.json` 增加第二个正向编码器 `%prompt_2%`（节点 20）和 `ConditioningConcat`（节点 22）；`KSampler.positive` 改接拼接后的条件，可用约 154 个 token
- `buildWorkflow()` 检测到 `%prompt_2%` 时，用 `splitPromptForTwoEncoders()` 按句子边界把提示词切成两段（总词数上限 110）
- `buildPrompt()` 对第二段英文执行 `stripCjk()`，清除模型偶发带出的中文，避免占用 token
- `stage2_system` 增加“英文、70 词以内”的明确要求；说明“先删背景细节，再删主动作”
- 文档：占位符表补充 `%prompt_2%`，新增“长提示词：两个编码器”小节和截断排错项
- 角色工作流保存图片的前缀恢复为 `SillyTavern/K2Auto_*` 子目录
- 版本号 0.7.0

## 0.6.0

角色工作流的采样参数改为占位符，步数 / CFG / 采样器 / 调度器 / denoise 可以在酒馆面板里直接修改。

### 变更

- 8 个角色工作流（`Illustrious_*_T2I.json`、`Krea2_Kisara_T2I.json`）的 `KSampler` 不再写死参数，改用 `%steps%` / `%scale%` / `%sampler%` / `%scheduler%` / `%denoise%`
- 选中工作流时仍自动套用推荐值作为初始值；之后在面板里改数值会真正传给 ComfyUI
- 工作流预设增加 `denoise: 1`，避免从其他工作流切过来时残留旧值
- 文档同步：角色工作流只写死模型和 LoRA，采样参数由面板控制
- 版本号 0.6.0

## 0.5.0

选中工作流时自动套用推荐生成参数。

### 变更

- 下拉选择自带工作流后，自动设置推荐的宽高 / 步数 / CFG / 采样器 / 调度器：
  - `Krea2_Default_T2I.json`、`Krea2_Kisara_T2I.json`：1024×1024、8 步、CFG 1、`euler` + `simple`
  - `Illustrious_<角色>_T2I.json`：832×1216、28 步、CFG 6、`dpmpp_2m` + `karras`
- 自动套用后仍可在面板里手动修改
- 设置面板提示同步更新
- 版本号 0.5.0

### 说明

- 角色工作流里的步数 / CFG / 采样器是写死在工作流 JSON 里的，自动套用主要保证面板数值与实际一致；`Krea2_Default_T2I.json` 用占位符，参数会真正生效

## 0.4.1

工作流改成下拉选择；默认工作流按同一命名规则改名。

### 变更

- 设置面板的“工作流”由文本框改为下拉框：点一下展开 `data/<user>/user/workflows/` 里的全部工作流，选一个后自动收起
- 下拉项显示中文名（如 `Illustrious 希塔姆 · 文生图`），实际保存的仍是文件名
- 默认工作流 `Krea2_Turbo_T2I.json` → `Krea2_Default_T2I.json`，现在所有自带工作流都遵循 `底模_角色_方式`：
  - `Krea2_Default_T2I.json`（默认，无角色 LoRA）
  - `Krea2_Kisara_T2I.json`
  - `Illustrious_<角色>_T2I.json`
- 相关引用（安装/卸载脚本、README、docs、示例设置）同步更新
- 版本号 0.4.1

### 升级提示

- 旧文件 `Krea2_Turbo_T2I.json` 不会再被使用，可手动删除 `data/<user>/user/workflows/` 下的旧文件
- 如果 `settings.json` 里 `extension_settings.k2auto.workflow_name` 仍是旧名，改选一次下拉项即可

## 0.4.0

删除角色自动路由；工作流文件保留，改为“底模 + 角色 + 生成方式”命名。

### 变更

- **移除角色自动路由**：不再根据角色卡名/正文角色名自动切换工作流；每次生图只使用设置里指定的一个工作流
- 删除 `CHARACTER_WORKFLOW_PRESETS`、`normalizeLookup()`、`getCharacterPresets()`、`resolveCharacterWorkflow()`，以及 `character_workflows` 设置和“角色 → 工作流”JSON 输入框
- 8 个角色工作流按新规则重命名：
  - `K2_IG_Hitamu.json` → `Illustrious_Hitamu_T2I.json`（其余 6 个 SDXL 角色同理）
  - `K2_IG_Kisara.json` → `Krea2_Kisara_T2I.json`
- 工作流内 `filename_prefix` 同步改为 `K2Auto_Illustrious_<角色>` / `K2Auto_Krea2_Kisara`
- 设置面板“默认工作流（未匹配到角色时使用）”改回“工作流”
- `uninstall.ps1 -RemoveWorkflow` 改为匹配新文件名
- 版本号 0.4.0

### 升级提示

- 如果你之前设置过“角色 → 工作流 JSON”，升级后该设置会被忽略；直接在工作流设置里填写想用的文件名即可
- 旧文件名 `K2_IG_*.json` 不会再被扩展使用，可手动删除 `data/<user>/user/workflows/` 下的旧文件

## 0.3.0

剧情向提示词（按情节写画面）。

### 新增

- 第一段（中文）改为“电影定格分镜”：动笔前先判断本段的高潮/转折与主动作
- 只画一个主动作，禁止“先…然后…接着…”式叙述，用静态痕迹（湿衣、血迹、被踢开的门、晃动的灯）暗示前因
- 剧情保留正文的地点、道具、天气、时间、光线与人物状态，不再只写摆拍人像
- 第二段（英文）不再重复输出风格标签（质量前缀由调用方统一前置）
- 第二段不再写入人物名 tag，改用“the blue-haired man”等外观短描述，避免与角色 LoRA 冲突

### 变更

- `DEFAULT_STAGE1` / `DEFAULT_STAGE2`、`prompts/stage1_zh.txt` / `stage2_en.txt` 一并更新
- 版本号 0.3.0

### 已知限制

- 剧情画面依赖本地 Qwen 对“高潮/转折”的判断；正文过短或纯叙述时可能偏静态
- 本地许可版允许露骨描写（仓库默认版保持非露骨）

## 0.2.0

角色自适应 LoRA 工作流。

### 新增

- 内置 8 个“不道德公会”角色 → 工作流映射
- 7 个 SDXL/Illustrious 角色 LoRA 工作流，1 个 Krea 2 基萨拉工作流
- 按角色卡名/头像优先、正文最后提及者兜底的路由逻辑
- “角色 → 工作流 JSON”覆盖框，可自定义别名、工作流和尺寸
- `install.ps1` 自动复制 `comfyui/characters/*.json`
- 排错文档补充角色选错、CUDA illegal memory access、SDXL 耗时

### 变更

- `loadWorkflow()` / `buildWorkflow()` / `generateImage()` 接受工作流和尺寸参数
- 设置面板的“工作流文件名”改为“默认工作流（未匹配到角色时使用）”
- 版本号 0.2.0

### 已知限制

- SDXL 角色工作流需要 `waiIllustriousSDXL_v170` 和对应角色 LoRA；仓库不分发模型
- 角色匹配依赖别名；角色卡名/正文都不出现时回退默认工作流
- 只支持一条文本一张图，不支持视频

## 0.1.0

首个公开版本。

### 功能

- 监听 `CHARACTER_MESSAGE_RENDERED`，每条 AI 正文自动生成一张图
- 只读取最后一条 AI 消息，优先 `<game>`，不发送聊天历史
- 角色卡字段 + 角色卡世界书外形条目
- 两段式本地 Qwen 提示词：中文分镜 → 英文提示词
- 固定现代日本 TV 动画质量前缀与负面词
- ComfyUI API 工作流占位符替换
- 一条正文一张图，图片消息跳过，签名去重，`busy` 防并发
- 图片消息的说话人优先取触发消息，临时聊天不会误用 `name2`
- 设置面板、测试连接、立即生成、调试日志
- PowerShell 安装/卸载脚本
- 实现原理、配置、排错、发布、隐私文档

### 已知限制

- 只支持一条文本一张图
- 不支持视频
- 默认工作流是纯文生图，不含角色一致性节点
- 依赖 SillyTavern 的 `/api/sd/comfy/*` 路由和 `extra.media` 消息格式
