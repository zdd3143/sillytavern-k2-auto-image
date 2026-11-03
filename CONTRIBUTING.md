# Contributing

欢迎 Issue 和 PR。这个项目优先保持“小、可读、本地优先”。

## 可以提什么

- 兼容新版 SillyTavern / ComfyUI 的修复
- 更稳的正文提取（新标签、状态栏格式）
- 更好的世界书外形提取
- 工作流示例（SDXL、Illustrious、NoobAI 等）
- 文档、错别字、排错经验
- 性能优化（减少 LLM 调用、缓存）

## 不要提交什么

- 模型权重（`.safetensors`、`.ckpt`、`.gguf`）
- 生成图片、聊天记录、角色卡全文
- API Key、Token、Cookie
- 露骨内容或针对未成年人的内容
- 修改 SillyTavern 核心的补丁（请用扩展接口）

## 开发环境

- Node.js 20+（只用于 `node --check`）
- SillyTavern 1.13+
- ComfyUI（能跑 Krea 2 或其他文生图工作流）
- Ollama + 任意 7B 模型

## 本地测试

1. 把仓库放到任意目录；
2. 运行 `install.ps1` 安装到测试用 SillyTavern；
3. 重启 SillyTavern，硬刷新；
4. 打开 Console，勾选调试日志；
5. 点“测试连接”和“立即生成”；
6. 发一条 ≥20 字的 AI 消息，确认只生成一张图。

语法检查：

```powershell
node --check .\extension\index.js
node -e "JSON.parse(require('fs').readFileSync('comfyui/Krea2_Turbo_T2I.json','utf8'))"
```

## 代码风格

- 原生 ES module，不引入构建步骤；
- 2 空格缩进？不，仓库用 4 空格（跟随现有文件）；
- 函数尽量小，命名说清楚；
- 新逻辑先写注释说明“为什么”，不要只写“做什么”；
- 不引入新依赖，除非有充分理由。

## PR 检查清单

- [ ] `node --check extension/index.js` 通过
- [ ] 工作流 JSON 能解析
- [ ] 没有提交 `data/`、图片、模型、密钥
- [ ] README/配置文档同步更新
- [ ] 默认 `enabled` 仍是 `false`
- [ ] 没有把露骨内容设为默认
- [ ] 测试过“一条文本只生成一张图”

## 提交信息

用简短英文或中文都可以，例如：

```text
fix: skip media messages before prompt generation
feat: support %clip_skip% placeholder
docs: add SDXL workflow example
```
