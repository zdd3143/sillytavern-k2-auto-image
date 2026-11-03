# Changelog

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
