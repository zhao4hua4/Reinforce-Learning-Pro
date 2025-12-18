# Reinforce Learning Pro（强化学习Pro）

中文 | [English README](README.en.md)

> 重要：本仓库目前仅在**当前开发机（Windows 11）**上完整跑通过；其他操作系统/硬件组合未系统测试；Conda 在本机也未验证。  
> 请直接跳到下方的「**已验证环境（当前开发机）**」与「**本机已验证运行方式（Windows 11）**」按步骤执行。

强化学习Pro 是一个**端侧（离线）自适应学习系统**：把学习科学里被反复验证的机制（检索练习/测试效应、间隔效应、反馈与纠错）落到可运行的工程闭环里，并用 **Intel OpenVINO × Qwen（Qwen3 系列）** 的端侧推理能力，让学习者在**弱网/无网**条件下也能获得高质量、可持续的学习支持。

本项目强调 **Human-centred AI（以人为中心的AI）**：系统围绕学习者的权利、能力与情境设计，而不是让学习者去适配技术。尤其面向**少数民族母语学习**与资源不均地区，我们把“母语优先”作为主流程能力（而不是一个可有可无的翻译插件），目标是：

- 让学习者用自己的语言理解世界级材料（降低认知负荷）
- 让练习与测验在目标语言中直接生成（减少语义漂移）
- 让离线设备也能提供“诊断—反馈—再出题—再巩固”的循环支持

项目理念与理论框架（强烈建议阅读）：
- 魔搭社区文章：端侧AI创新挑战赛：强化学习Pro（Learn/3227）
  [https://www.modelscope.cn/learn/3227](https://www.modelscope.cn/learn/3227)

---

## 这是什么项目（一句话）

一套由 LLM 驱动的**共同学习（Co-learning）**学习系统：学习者先反思，AI 再回应；做完测试后，系统只围绕薄弱点生成追练题，形成“学—测—强化”的闭环；并在翻转课堂（Flipped Classroom）流程中提供教师训练脚本与教练式评价。

---

## 为什么它值得投入（核心创新点）

### 1) 端侧离线：把高质量学习支持带到网络之外
- 使用 OpenVINO 在 Intel 硬件（CPU / GPU / NPU）上进行端侧推理，降低云端成本与延迟。
- 在弱网、离线、受限设备下也可运行，服务偏远地区与资源不均场景。

### 2) 共同学习（Co-learning）而非“问答工具”
本项目把 LLM 明确定位为**共同学习伙伴**：
- **第二人称对话**：始终以“你”为主语，促进自我监控（metacognition）与迁移。
- **短、聚焦、可追问**：避免长篇元话语，减少无关认知负荷，让注意回到知识点与检索过程。
- **结构化反馈**：鼓励 + 部分提示 + 追问（不直接泄露答案），维持努力性检索。
- **学习者能动性（agentic engagement）**：通过“Ask-about-selection（选中片段提问）”把对话焦点交给学习者。

### 3) Learn → Test → Reinforce：把“测试效应”工程化
- Learn：短学习卡 + 反思输入，AI 用共同学习方式回应。
- Test：低风险测验（默认 3 题），只呈现对错与提示，驱动检索练习。
- Reinforce：对错题点加权，为每个错题点生成新的选择题，并跨错题点再生成一个新的简答题，形成围绕薄弱点的追加练习。

### 4) 母语优先：让少数民族用母语学习世界级材料
- 支持语言（UI/LLM）：English、中文、藏语、维吾尔语（RTL）、朝鲜语、French、German、Spanish。
- **目标语言直接生成测验与追练题**：不是“先英语生成再翻译”，减少语义漂移并保持表达自然性。
- **维吾尔语 RTL**：容器级 `dir="rtl"` 支持阅读方向一致性，减少“语言对了但体验违和”的额外负担。

### 5) 翻转课堂（Flipped Classroom）脚本化与可评估
- 教师先驱动、学生在教师消息后再回应。
- AI 教练在末尾按维度评分（如清晰度、支架式引导等）并给出改进建议。
- 把“名师才能稳定执行的高阶训练流程”做成可复制脚本。

---

## 主要入口（建议从这里开始体验）

启动后端与前端后：
- Demo（共同学习 + 学—测—强化）：`http://127.0.0.1:5173/demo`
- 翻转课堂：`http://127.0.0.1:5173/demo/flipped`
- 多语种翻转课堂：`http://127.0.0.1:5173/demo/flipped-multilingual`

> 重要说明：语言切换会触发页面重载，以确保 UI/LLM 输出与状态一致；选择会保存在本地（localStorage）。

---

## 已验证环境（当前开发机）

本仓库目前只在以下设备与版本组合上进行过完整跑通与日常开发验证：

- 操作系统：Microsoft Windows 11 家庭中文版 64 位（Build 26100）
- 设备：HP Pavilion Plus Laptop 16-ab1xxx
- CPU：Intel(R) Core(TM) Ultra 7 155H（16 核 / 22 线程）
- 内存：32 GB
- GPU：Intel(R) Arc(TM) Graphics（Driver 31.0.101.5447）
- NPU：Intel(R) AI Boost（ComputeAccelerator）
- Python：3.10.9（Windows `py` launcher）
- Node.js：v24.11.1（npm 11.6.2）
- OpenVINO：`openvino==2025.3.0`、`openvino-genai==2025.3.0.0`、`openvino-tokenizers==2025.3.0.0`

> 兼容性声明：本文档给出的运行方式仅在以上环境验证可用；其他操作系统/硬件/版本组合目前**未系统测试**。
>
> Conda 声明：仓库提供了 [`backend/environment.yml`](backend/environment.yml) 作为参考，但 **Conda 在本机未验证**。下面提供的是在当前设备上“实测可用”的 `.venv + pip` 方式。

---

## 本机已验证运行方式（Windows 11）

### 依赖
- Python 3.10.9（已验证）
- Node.js v24.11.1（已验证）
- npm 11.6.2（已验证）

### 1) 下载代码
```bash
git clone https://github.com/zhao4hua4/Reinforce-Learning-Pro
cd Reinforce\ Learning\ Pro
```

### 2) 创建虚拟环境并安装后端依赖（本机已验证）
在仓库根目录创建 `.venv`：

```powershell
py -3.10 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -U pip
```

安装依赖（按本机已验证版本固定 OpenVINO 相关包；其余依赖允许 pip 自动解析）：

```powershell
.\.venv\Scripts\python.exe -m pip install `
  openvino==2025.3.0 `
  openvino-genai==2025.3.0.0 `
  openvino-tokenizers==2025.3.0.0 `
  fastapi==0.122.0 `
  uvicorn==0.38.0 `
  pydantic-settings==2.12.0 `
  httpx numpy pandas rich tiktoken pymupdf
```

#### 2.1) 下载端侧模型权重（OpenVINO IR，仓库不包含）

由于模型权重体积很大，**本仓库不会把模型文件上传到 GitHub**。如果你想使用“On-Device”模型，需要把 OpenVINO 优化后的模型（IR + tokenizer）下载到**固定目录**，目录名必须与后端预设完全一致，下载完成后即可直接在前端选择模型使用。

先安装 Hugging Face Hub 的 `hf` 命令（已在本机验证可用）：
```powershell
.\.venv\Scripts\python.exe -m pip install -U huggingface_hub
```

然后在仓库根目录执行以下命令（每条命令会下载一个模型到指定目录；下载体积较大，请确保磁盘空间充足）：

```powershell
# Qwen2.5-1.5B (CPU)  -> data/artifacts/models/qwen2.5-1.5b-int4-ov
.\.venv\Scripts\hf.exe download OpenVINO/qwen2.5-1.5b-int4-ov --local-dir "data/artifacts/models/qwen2.5-1.5b-int4-ov"

# Qwen3-4B (CPU/GPU)  -> data/artifacts/models/qwen3-4b-int4-ov
.\.venv\Scripts\hf.exe download OpenVINO/qwen3-4b-int4-ov --local-dir "data/artifacts/models/qwen3-4b-int4-ov"

# Qwen3-8B (CPU/GPU)  -> data/artifacts/models/Qwen3-8B-int4-ov
.\.venv\Scripts\hf.exe download OpenVINO/Qwen3-8B-int4-ov --local-dir "data/artifacts/models/Qwen3-8B-int4-ov"

# Qwen3-8B (NPU)      -> data/artifacts/models/Qwen3-8B-int4-cw-ov
.\.venv\Scripts\hf.exe download OpenVINO/Qwen3-8B-int4-cw-ov --local-dir "data/artifacts/models/Qwen3-8B-int4-cw-ov"

# Qwen3-14B (GPU)     -> data/artifacts/models/Qwen3-14B-int4-ov
.\.venv\Scripts\hf.exe download OpenVINO/Qwen3-14B-int4-ov --local-dir "data/artifacts/models/Qwen3-14B-int4-ov"
```

可选提示：
- 如果遇到 Hugging Face 访问权限/登录问题：运行 `.\.venv\Scripts\hf.exe auth login` 再下载。
- 如果你只打算用远程模型（`Remote:`），可以跳过本步骤。

### 3) 启动后端（FastAPI）
后端服务默认运行在 `http://127.0.0.1:8000`：

**PowerShell（推荐）**
```powershell
$env:PYTHONPATH = "$PWD\backend"
.\.venv\Scripts\python.exe -m uvicorn rlpro_backend.api.server:app --host 127.0.0.1 --port 8000
```

**CMD**
```cmd
set PYTHONPATH=%CD%\backend
.\.venv\Scripts\python.exe -m uvicorn rlpro_backend.api.server:app --host 127.0.0.1 --port 8000
```

> 前端固定请求 `http://127.0.0.1:8000`（见 [`frontend/src/api.ts`](frontend/src/api.ts)），请保持端口一致。

### 4) 启动前端（React + Vite）
```bash
cd frontend
npm install
npm run dev -- --host --port 5173
```

> Windows 如果 PowerShell 执行策略阻止 `npm`，可用 `npm.cmd`：
> `npm.cmd run dev -- --host --port 5173`

### 5) 打开页面（重点入口）
- Demo（共同学习 + 学—测—强化）：`http://127.0.0.1:5173/demo`
- 翻转课堂：`http://127.0.0.1:5173/demo/flipped`
- 多语种翻转课堂：`http://127.0.0.1:5173/demo/flipped-multilingual`

### 其他系统与方式（未验证）
- macOS / Linux：目前未系统测试；欢迎贡献可复现的安装与运行说明。
- Conda：本机未验证（仓库保留 `backend/environment.yml` 供参考）。

---

## 模型与设备（On-Device / Remote）

前端模型选择器会展示：
- On-Device：Qwen2.5-1.5B（CPU）
- On-Device：Qwen3-4B（CPU / GPU）
- On-Device：Qwen3-8B（CPU / GPU / NPU）
- On-Device：Qwen3-14B（GPU）
- Remote：Qwen3-Next-80B（API 对照）

模型文件默认放在：
- [`data/artifacts/models/`](data/artifacts/models/) 下的 `<模型目录>`

> 注意：GPU/NPU 的首次加载可能较慢（模型编译/缓存）；部署时建议使用缓存目录与预热。

---

## 项目结构（面向开发者）
- [`backend/`](backend/)：FastAPI + Pydantic；LLM 生成接口、模块化学习数据接口等
- [`frontend/`](frontend/)：React + TypeScript + Vite；Demo、模块学习、翻转课堂 UI
- [`data/`](data/)：数据与模型目录（如 [`data/artifacts/models/`](data/artifacts/models/)）
- [`docs/`](docs/)：更完整的系统说明（参见 [`docs/system_overview.md`](docs/system_overview.md)）
- [`scripts/`](scripts/)：脚本与基准测试（如 OpenVINO token/s 基准）

---

## （可选）配置远程 LLM（OpenAI 兼容接口）

如果你希望对比“端侧模型”和“云端大模型”（或临时需要更强的推理/更长上下文），本项目也支持调用**OpenAI 兼容**的远程接口。相关配置位于：[`backend/rlpro_backend/config.py`](backend/rlpro_backend/config.py)。

后端配置项（原始代码片段，便于定位）：
```python
# NOTE: These defaults are hard-coded for demo purposes; remove or override before publishing.
remote_api_key: str = Field("SAMPLE_API_KEY", description="API key for remote OpenAI-compatible endpoint (e.g., DashScope)")
remote_base_url: str = Field("https://dashscope.aliyuncs.com/compatible-mode/v1", description="Base URL for remote OpenAI-compatible endpoint")
remote_default_model: str = Field("qwen3-next-80b-a3b-instruct", description="Default remote model name (e.g., qwen3-next-80b-a3b-instruct)")
```

重要提醒：
- 以上默认值里 `SAMPLE_API_KEY` 只是占位符；**不配置真实 Key 时，远程调用会失败**。
- `remote_base_url` 需要是“OpenAI 兼容接口的 base URL”（后端会自动拼接 `/chat/completions`）。
  - 例如 DashScope 兼容模式： [https://dashscope.aliyuncs.com/compatible-mode/v1](https://dashscope.aliyuncs.com/compatible-mode/v1)
- 修改环境变量后需要**重启后端**才能生效。

### 配置方式 A：启动前在 PowerShell 设置环境变量（推荐）
```powershell
$env:RLPRO_REMOTE_API_KEY = "<YOUR_API_KEY>"
$env:RLPRO_REMOTE_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
$env:RLPRO_REMOTE_DEFAULT_MODEL = "qwen3-next-80b-a3b-instruct"
```

然后再按本文档的“启动后端（FastAPI）”命令运行。

### 配置方式 B：在仓库根目录创建 `.env`（更方便长期使用）
在仓库根目录新建 `.env` 文件（不要提交到公开仓库）：
```env
RLPRO_REMOTE_API_KEY=<YOUR_API_KEY>
RLPRO_REMOTE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
RLPRO_REMOTE_DEFAULT_MODEL=qwen3-next-80b-a3b-instruct
```

### 如何在前端启用远程模型
- 在模型选择器中选择以 `Remote:` 开头的选项（例如 `Remote: Qwen3-Next-80B (API)`）。
- 如果你想调用其他远程模型名称：可以在前端模型选择器增加选项，或设置 `RLPRO_REMOTE_DEFAULT_MODEL` 作为默认远程模型名。

---

## 进一步阅读
- 系统详细说明（更偏产品/教学/工程细节）：[`docs/system_overview.md`](docs/system_overview.md)
- 概念与理论框架（ModelScope）：[https://www.modelscope.cn/learn/3227](https://www.modelscope.cn/learn/3227)
