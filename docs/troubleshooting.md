# 排错

先按顺序确认三件事，90% 的问题都在这三步里：

1. ComfyUI 自己能出图吗？
2. Ollama 自己能回复吗？
3. SillyTavern 能通过服务端代理访问这两个服务吗？

---

## 0. 最快诊断

打开 SillyTavern，按 `F12` → Console，然后：

1. 勾选“调试日志”；
2. 点“测试连接”；
3. 点“立即生成”。

Console 会打印：

```text
[K2 Auto Image] loaded
[K2 Auto Image] AI message rendered 12
[K2 Auto Image] final prompt masterpiece, ...
```

出错时会打印完整错误对象。先看最后一条红色错误，再到下面找对应小节。

---

## 1. 扩展面板不出现

### 检查目录

必须是：

```text
SillyTavern/public/scripts/extensions/third-party/k2-auto-image/
├─ manifest.json
├─ index.js
├─ settings.html
└─ style.css
```

常见错误：

- 多套了一层：`third-party/k2-auto-image/k2-auto-image/...`
- 把 `extension` 文件夹整个复制进去，变成 `third-party/k2-auto-image/extension/index.js`
- 只复制了 `index.js`，没有 `manifest.json` / `settings.html`

### 检查 manifest

```json
{
  "display_name": "K2 Auto Image",
  "loading_order": 100,
  "requires": [],
  "optional": [],
  "js": "index.js",
  "css": "style.css",
  "author": "...",
  "version": "0.1.0",
  "homePage": "..."
}
```

`js` / `css` 是相对扩展根目录的路径。

### 重启 + 硬刷新

```text
关闭 SillyTavern → 重新启动 → 浏览器 Ctrl+F5
```

只刷新页面不够：扩展列表是启动时扫描的。

### 看 Console

如果出现：

```text
Failed to load module script
```

通常是 `index.js` 里有语法错误，或者导入路径不对。运行：

```powershell
node --check .\extension\index.js
```

> `node --check` 只检查语法，不解析浏览器 import；但能抓出括号/字符串错误。

---

## 2. 读取工作流失败

错误：

```text
读取工作流失败: ...
```

或：

```text
工作流不是合法 JSON: Krea2_Default_T2I.json
```

### 检查文件位置

```text
SillyTavern/data/default-user/user/workflows/Krea2_Default_T2I.json
```

多用户时是：

```text
SillyTavern/data/<你的用户名>/user/workflows/
```

### 检查文件名

设置里的“工作流文件名”必须和磁盘上完全一致，包括大小写和 `.json`。

### 检查 JSON

```powershell
Get-Content "D:\SillyTavern\data\default-user\user\workflows\Krea2_Default_T2I.json" -Raw | ConvertFrom-Json
```

没有报错才是合法 JSON。

### 检查是否重启

新增工作流文件后，SillyTavern 不需要重启（每次请求都读磁盘），但扩展页面需要刷新才能重新读设置。

---

## 3. 工作流中还有未替换的占位符

错误：

```text
工作流中还有未替换的占位符：model。请在扩展设置里填写对应值，或从工作流中删除这些占位符。
```

原因：工作流里用了 `"%model%"`，但设置里“模型名”留空。

解决：

- 在设置里填模型文件名；或
- 把工作流里的 `"%model%"` 改成实际文件名；或
- 删除这个占位符，改用工作流里写死的值。

同理适用于 `%vae%`、`%clip_skip%`、`%char_ref_image%`。

### 注意

占位符必须带引号：

```json
"text": "%prompt%"
```

如果写成 `"text": %prompt%`，这本身不是合法 JSON，扩展读文件时就会报“工作流不是合法 JSON”。

---

## 4. 该工作流需要 %char_ref_image%

错误：

```text
该工作流需要 %char_ref_image%（角色参考图），请在设置中填写 ComfyUI input 目录下的文件名。
```

解决：

1. 把参考图放到 `ComfyUI/input/refs/你的图.png`；
2. 扩展设置里填 `refs/你的图.png`；
3. 确认工作流里的 `LoadImage` 节点用的是 `"%char_ref_image%"`。

如果你不想要参考图，把工作流里的 `LoadImage` 和相关节点删掉。

---

## 5. ComfyUI 返回 500 / 生图失败

错误：

```text
ComfyUI 生图失败: ComfyUI returned an error.
```

### 先手动验证

浏览器打开：

```text
http://127.0.0.1:8188
```

用同一个工作流跑一遍。如果网页也失败，问题在 ComfyUI，不在扩展。

### 常见原因

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| `Value not in list: ckpt_name` | 模型文件名不对 | 看 `ComfyUI/models/...` 里的实际文件名 |
| `Cannot execute because node ... does not exist` | 缺自定义节点 | 用 ComfyUI Manager 安装缺失节点 |
| `CLIPLoader` 报 `krea2` 不支持 | ComfyUI 太旧 | 升级 ComfyUI 到支持 Krea 2 的版本 |
| 显存不足 / OOM | 1024×1024 太大 | 降到 768×768 或 832×1216，步数降到 6 |
| 一直排队 | 上一次任务卡住 | ComfyUI 控制台按 `Ctrl+C` 重启，或点队列里的 cancel |
| 返回 200 但没有图 | 工作流没有 `SaveImage` | 加 `SaveImage` 节点，或确认输出节点存在 |

### 看 ComfyUI 控制台

Windows 直接看启动 ComfyUI 的终端；如果是 `run_nvidia_gpu.bat`，窗口里会打印节点异常和 traceback。

### 检查 URL

扩展里的地址必须是 **SillyTavern 服务端**能访问的：

- 同一台机器：`http://127.0.0.1:8188`
- SillyTavern 在 Docker，ComfyUI 在宿主机：`http://host.docker.internal:8188`
- 不要填 `http://localhost:8188` 如果 ST 在容器里（容器里的 localhost 是容器自己）

### CUDA error: illegal memory access

现象：ComfyUI 在 LoRA 加载/采样时直接退出，日志末尾是：

```text
ERROR lora diffusion_model... CUDA error: an illegal memory access was encountered
Fatal Python error: Aborted
```

这不是工作流 JSON 或扩展的问题，常见于 8GB 显存连续切换多个 SDXL LoRA 后的驱动/显存状态。处理顺序：

1. 完全退出 ComfyUI，重新启动，再跑同一个工作流；
2. 用 `启动ComfyUI-低显存.bat`（`--lowvram`）；
3. 把 SDXL 工作流分辨率降到 768×1152；
4. 降低 LoRA `strength_model` 或换一个 LoRA 文件；
5. 更新显卡驱动/ComfyUI。

重启后能恢复就说明是运行时状态问题，不需要改扩展代码。

---

## 6. 本地 LLM 返回 400 / 404

错误：

```text
本地 LLM 返回 400: ...
本地 LLM 返回 404: ...
```

### 检查地址

必须是：

```text
http://127.0.0.1:11434/v1
```

不是：

```text
http://127.0.0.1:11434
http://127.0.0.1:11434/v1/chat/completions
```

扩展会自己在后面拼 `/chat/completions`。

### 检查模型名

```powershell
ollama list
```

复制完整名称，例如：

```text
richardyoung/qwen2.5-7b-instruct-abliterated:latest
```

不要只写 `qwen2.5`。

### 手动测试

```powershell
curl.exe http://127.0.0.1:11434/v1/chat/completions `
  -H "Content-Type: application/json" `
  -d "{\"model\":\"你的模型名\",\"messages\":[{\"role\":\"user\",\"content\":\"只回复 OK\"}],\"stream\":false}"
```

能返回 JSON 才说明 Ollama 正常。

### 超时

错误：

```text
本地 LLM 超时。
```

- 首次加载 7B 模型可能要 1–2 分钟；
- 把“超时”调到 `300000` 或 `600000`；
- 检查显存是否被 ComfyUI 占满：先关 ComfyUI 跑一次 LLM，或调小 `OLLAMA_NUM_GPU`。

---

## 7. 有文字但没有图

按顺序检查：

1. **总开关是否打开**（默认关闭）
2. **最后一条是不是图片消息**：图片消息会被跳过，避免图生图
3. **正文是否少于 20 字**：太短会跳过
4. **是不是同一段正文**：签名去重，手动“立即生成”可以绕过
5. **上一张是否还在生成**：`busy` 锁会跳过新请求
6. **是否在生成期间切换了聊天**：会丢弃图片

打开调试日志，看有没有：

```text
[K2 Auto Image] AI message rendered 12
```

如果没有这一行，说明事件没触发：

- 消息不是 AI 消息；
- 扩展没加载；
- 总开关没开。

如果有这一行但没有 `final prompt`，说明卡在正文/设定/LLM。

---

## 8. 图片生成了但没显示

### 检查消息

Console 执行：

```js
const chat = SillyTavern.getContext().chat;
console.log(chat[chat.length - 1]);
```

看最后一条是否有：

```js
extra.media[0].url
```

### 检查文件

`url` 类似：

```text
user/images/Assistant_2026-11-03T...
```

文件应在：

```text
SillyTavern/data/default-user/user/images/
```

如果文件不存在，说明 `saveBase64AsFile()` 失败（看 Console 网络请求 `/api/images/upload`）。

### 刷新

图片消息写入后，SillyTavern 有时需要一次刷新才显示缩略图。先 `Ctrl+F5`。

### 版本

`extra.media` + `media_display` 是较新的媒体消息格式。SillyTavern 1.12 以前可能不支持，建议 1.13+。

---

## 9. 一次生成两张图

现象：一条 AI 文本后出现两张图。

原因通常是：

- 同时开了 SillyTavern 内置 Stable Diffusion 的“自动生成”；
- 或者开了 interactive mode，手动+自动各一次；
- 或者装了两个自动配图扩展。

解决：

1. 关闭内置 SD 扩展的自动生成；
2. 关闭 SD 的 `interactive_mode`；
3. 只保留一个自动配图扩展；
4. 确认扩展的 `busy` 锁生效（不要改 `runForMessage`）。

---

## 10. 图片和正文对不上

### 只取最后一条

扩展只读最后一条 AI 文本。如果你在生成期间 swipe 了新正文，可能对不上。

### `<game>` 标签

如果角色卡用 `<game>` 包正文，扩展只取 `<game>` 里的内容；其他内容（包括重要场景描写）会被丢掉。检查角色卡输出格式。

### 世界书没命中

- `keys` 是否至少 2 个字；
- 正文是否真的出现角色名；
- 条目是否 `disable`；
- `comment` 是否和正文完全一致（大小写敏感）。

打开调试日志，看最终 prompt 里有没有人物外形。

### 生成了错误的角色

1. 扩展**不会**按角色自动切换工作流；先确认设置里的“工作流”填的是你想要的那个文件；
2. 角色工作流的命名规则是 `Illustrious_<角色>_T2I.json` / `Krea2_Kisara_T2I.json`，换角色时手动改这个设置即可；
3. 确认工作流在 `data/<user>/user/workflows/` 且文件名大小写一致；
4. 想同时用两个角色时，可以在自己的工作流里串联两个 `LoraLoader`，或分别生成两张图。

---

## 11. 提示词照抄对白 / 写剧情

这是 7B 模型的常见问题。按顺序试：

1. 第一段 system 里强化“只写静止瞬间，不写对白/心理/剧情/连续动作”；
2. 把 `stage1_temperature` 降到 `0.5`；
3. 把 `stage1_max_tokens` 降到 `300`，逼它写短；
4. 把正文里的对白用正则删掉（在 `extractMainBody` 里加规则）；
5. 换 14B 模型。

不要用“请总结这段剧情”这类 system，它会诱导模型写叙事。

---

## 12. 画面风格偏写实 / 3D

1. 确认质量前缀最前面有 `modern Japanese TV anime, anime screencap`；
2. 确认负面词有 `photorealistic, 3d render, live action, photography, CGI`；
3. 确认第一段 system 第 7 条还在；
4. 如果模型仍然偏写实，把前缀改成 `2D anime illustration, flat colors, cel shading`，并降低 CFG 到 1；
5. 有些模型本身偏写实，换动漫向 checkpoint。

---

## 13. 生成很慢

正常范围：

- 7B LLM 两次调用：5–20 秒（GPU）；
- Krea 2 Turbo 1024×1024 / 8 steps：10–30 秒（8GB 笔记本）；
- SDXL 832×1216 / 28 steps：约 25–45 秒（8GB 笔记本，首次加载更久）；
- 总计：Krea2 约 25–60 秒，SDXL 约 30–70 秒。

如果超过 2 分钟：

- 检查是不是 CPU 跑 LLM：`ollama ps` 看 `100% GPU`；
- 检查 ComfyUI 是否在 CPU：启动日志看 `Using device: cuda`；
- 降低分辨率到 768；
- 降低步数到 6；
- 关闭其他占显存的程序。

---

## 14. 端口/防火墙

扩展走 SillyTavern 服务端代理，所以：

- 浏览器不需要直接访问 8188/11434；
- 只需要 SillyTavern 服务端能访问它们；
- 手机访问 SillyTavern 时，也是服务器去连 ComfyUI，不是手机连。

如果 SillyTavern 在另一台机器：

```text
ComfyUI 地址填 http://<那台机器IP>:8188
Ollama 地址填 http://<那台机器IP>:11434/v1
```

并确保那台机器的防火墙放行对应端口。

---

## 15. 收集日志

报告问题时请附上：

1. SillyTavern 版本（`/version` 或启动日志）；
2. ComfyUI 版本；
3. `ollama list` 输出；
4. 浏览器 Console 的完整错误；
5. ComfyUI 控制台的 traceback；
6. 你用的工作流（删掉隐私内容）。

不要附角色卡全文、生成图片或 API Key。

---

## 16. 仍然不行

最小化排查：

1. 用仓库自带的 `Krea2_Default_T2I.json`，不要改；
2. 用默认 1024×1024 / 8 steps / euler / simple；
3. 用 `ollama run` 确认模型能回复；
4. 用 ComfyUI 网页手动跑通工作流；
5. 在 SillyTavern 里点“测试连接”；
6. 点“立即生成”。

六步都通过，自动模式一定可用。仍失败就把第 15 节的日志发到仓库 Issue。
