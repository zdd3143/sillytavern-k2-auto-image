# 上传到 GitHub

这个仓库已经按公开分享的结构整理好。按下面步骤，10 分钟内可以发布第一版。

---

## 1. 上传前检查

### 1.1 仓库地址

本仓库已按 `zdd3143/sillytavern-k2-auto-image` 填好：

- `README.md` 的 clone / remote 地址
- `extension/manifest.json` 的 `homePage`
- 本文档里的示例地址

仓库名建议保持：

```text
sillytavern-k2-auto-image
```

如果你 fork、改名或换账号，记得同步替换 README、manifest 和本文档里的地址。

### 1.2 确认没有隐私文件

不要提交：

```text
data/
*.png（生成图/截图除非你确认无隐私）
*.safetensors
*.ckpt
*.gguf
settings.json
config.yaml
.env
```

`.gitignore` 已经覆盖常见项。提交前再跑一次：

```powershell
git status --short
```

### 1.3 确认没有密钥

搜索：

```powershell
git grep -n -i "api[_-]key\|bearer \|sk-\|token"
```

扩展本身不保存密钥；如果你在测试时把 key 写进文档或脚本，删掉。

### 1.4 确认模型许可证

仓库**不包含**模型权重。README 里只写文件名和下载来源，不直接分发：

- Krea 2 Turbo：遵守其模型许可证
- Qwen：遵守 Qwen 许可证
- ComfyUI：GPL-3.0
- SillyTavern：AGPL-3.0

如果你在 README 里放了模型下载链接，确认链接指向官方/授权页面。

---

## 2. 创建本地仓库

```powershell
cd D:\ABB-test1\sillytavern-k2-auto-image

git init
git add .
git commit -m "Initial release: local K2 auto image for SillyTavern"
git branch -M main
```

检查将要提交的文件：

```powershell
git ls-files
```

应该看到：

```text
.gitignore
LICENSE
README.md
comfyui/Krea2_Turbo_T2I.json
docs/...
extension/index.js
extension/manifest.json
extension/settings.html
extension/style.css
install.ps1
prompts/...
uninstall.ps1
```

不应该看到 `data/`、图片、模型。

---

## 3. 在 GitHub 创建仓库

1. 打开 <https://github.com/new>
2. Repository name：`sillytavern-k2-auto-image`
3. Description：

```text
Local automatic anime illustration for SillyTavern — Ollama prompt writer + ComfyUI Krea 2 Turbo, no cloud APIs.
```

4. 选择 **Public**
5. **不要**勾选 “Add a README / .gitignore / license”（本地已有）
6. 点 Create repository

然后：

```powershell
git remote add origin https://github.com/zdd3143/sillytavern-k2-auto-image.git
git push -u origin main
```

如果使用 SSH：

```powershell
git remote add origin git@github.com:zdd3143/sillytavern-k2-auto-image.git
git push -u origin main
```

---

## 4. 仓库设置

### About

点仓库右上角齿轮，填：

**Description**

```text
Local automatic anime illustration for SillyTavern — Ollama prompt writer + ComfyUI Krea 2 Turbo, no cloud APIs.
```

**Topics**

```text
sillytavern
sillytavern-extension
comfyui
krea2
ollama
qwen
anime
text-to-image
local-ai
```

**Website** 可留空，或填你的说明页。

### Discussions / Issues

建议开启 Issues，方便别人报告环境问题。可以加一个 Issue 模板：

```text
.github/ISSUE_TEMPLATE/bug_report.md
```

内容至少要求：

- SillyTavern 版本
- ComfyUI 版本
- `ollama list`
- Console 错误
- ComfyUI traceback

不要要求用户上传角色卡或生成图片。

---

## 5. 发布 Release

```powershell
git tag v0.1.0
git push origin v0.1.0
```

在 GitHub：

1. 进入 **Releases → Draft a new release**
2. Choose tag：`v0.1.0`
3. Title：`v0.1.0 — first public release`
4. Description：

```markdown
## K2 Auto Image v0.1.0

First public release.

### Features
- Auto-generate one anime illustration after each AI message
- Reads only the current `<game>` body, not chat history
- Character card + character-book visual profile
- Two-stage local Qwen prompt writing (Chinese storyboard → English prompt)
- ComfyUI Krea 2 Turbo workflow with placeholders
- One image per text message, media messages skipped

### Requirements
- SillyTavern 1.13+
- ComfyUI with Krea 2 support
- Ollama + a 7B-class model
- 8 GB VRAM recommended

### Install
See README quick start.

### Notes
Model weights are not included. Default prompts are non-explicit for public distribution.
```

5. 如果要附加 zip，**只打包源码**，不要带模型/图片：

```powershell
# 在仓库上一级目录
Compress-Archive -Path .\sillytavern-k2-auto-image\* `
  -DestinationPath .\sillytavern-k2-auto-image-v0.1.0.zip
```

GitHub 会自动提供 Source code (zip)，通常不需要手动上传。

---

## 6. 加截图（可选但推荐）

建议放 2–3 张：

1. SillyTavern 里的设置面板
2. 一张生成结果（选非露骨、无隐私的）
3. ComfyUI 工作流截图（可选）

放在：

```text
docs/images/settings.png
docs/images/example.png
```

README 顶部加：

```markdown
![设置面板](docs/images/settings.png)
![生成示例](docs/images/example.png)
```

注意：

- 截图里不要出现角色卡私密内容、聊天记录、API Key；
- 不要放露骨图片；
- 图片体积控制在 1MB 以内，必要时压缩。

---

## 7. 可选：加 CI 语法检查

GitHub Actions 只做轻量检查，不跑模型：

```text
.github/workflows/check.yml
```

```yaml
name: check

on:
  push:
  pull_request:

jobs:
  syntax:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Check extension syntax
        run: node --check extension/index.js
      - name: Validate workflow JSON
        run: node -e "JSON.parse(require('fs').readFileSync('comfyui/Krea2_Turbo_T2I.json','utf8')); console.log('workflow json ok')"
```

> `node --check` 不解析浏览器 import，但能抓语法错误；工作流 JSON 能被解析即可。

---

## 8. 后续维护

### 版本号

- `extension/manifest.json` 的 `version`
- Git tag
- Release 标题

三处保持一致。

### 更新日志

建议加 `CHANGELOG.md`：

```markdown
# Changelog

## 0.1.0
- Initial release
```

### 兼容性

SillyTavern 升级后重点检查：

- `CHARACTER_MESSAGE_RENDERED` 是否还在
- `/api/sd/comfy/workflow`、`/api/sd/comfy/generate` 是否还在
- `extra.media` 消息格式是否变化

如果接口变了，在 `extension/index.js` 里改对应 fetch 即可，不需要碰核心。

---

## 9. 分享文案模板

发帖时可以直接用：

```text
给 SillyTavern 写了一个本地自动配图扩展：

每收到一条 AI 正文，就用本地 Qwen 把当前场景和人物设定写成生图提示词，
再交给本地 ComfyUI（Krea 2 Turbo）生成一张现代日本 TV 动画风格的插图，
自动贴回聊天。

特点：
- 只读最后一条正文，不把聊天历史发给生图模型
- 支持角色卡 + 世界书外形设定
- 两段式提示词，减少照抄对白
- 一条文本一张图，图片消息不会再次触发
- 全部本地，不需要云端 API
- 不修改 SillyTavern 核心，升级不冲突

需要：SillyTavern + ComfyUI + Ollama + 8GB 显存
仓库：https://github.com/zdd3143/sillytavern-k2-auto-image
```

---

## 10. 常见发布问题

### `git push` 被拒

先确认远程地址：

```powershell
git remote -v
```

如果是 HTTPS 且开启了 2FA，用 Personal Access Token 作为密码，或改用 SSH。

### 文件太大

GitHub 单文件限制 100MB。模型权重不要提交；如果误提交：

```powershell
git rm --cached path\to\large.file
```

然后提交。历史里仍有大文件时，需要用 `git filter-repo` 清理。

### 中文乱码

确保文件是 UTF-8。PowerShell 写文件时用：

```powershell
Set-Content -Encoding utf8 ...
```

本仓库文件已经是 UTF-8。

### 想改仓库名

GitHub 改名后，更新：

- `README.md` 的 clone 地址
- `extension/manifest.json` 的 `homePage`
- 本地 `git remote set-url origin ...`
