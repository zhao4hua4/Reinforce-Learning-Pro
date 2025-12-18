# Reinforce Learning Pro

English | [中文 README](README.md)

Reinforce Learning Pro is an **on-device (offline) adaptive learning system** that operationalizes learning-science mechanisms (practice testing / retrieval, spacing, feedback & error-correction) into a runnable loop, powered by **Intel OpenVINO × Qwen (Qwen3 family)**.

The project is built with a **Human-centred AI** lens: the system should adapt to learners’ contexts, rights, and constraints—especially for low-connectivity regions and minority-language learners. “Native-language-first” is treated as a core capability (not a plug-in), aiming to reduce cognitive load and enable world-class learning experiences in learners’ own languages.

Concept & framing (recommended):
- ModelScope Learn/3227: [https://www.modelscope.cn/learn/3227](https://www.modelscope.cn/learn/3227)

---

## What you can do
- **Try the demo**: `/demo` showcases the Learn → Test → Reinforce loop, co-learning tutoring, and “Ask-about-selection”.
- **Practice flipped classroom**: `/demo/flipped` and `/demo/flipped-multilingual` provide a replicable teacher-first script plus AI coach evaluation.
- **Use the main app**: module dashboard/import/learn flow for turning content into modules and running a demo-like learning loop.
- **Run on-device**: CPU / GPU / NPU options depending on model availability.

---

## Quickstart (run locally)

## Tested environment (current dev machine)

This repository has been fully run and iterated on **only** in the following environment:

- OS: Microsoft Windows 11 Home (Chinese), 64-bit (Build 26100)
- Device: HP Pavilion Plus Laptop 16-ab1xxx
- CPU: Intel(R) Core(TM) Ultra 7 155H (16 cores / 22 logical)
- RAM: 32 GB
- GPU: Intel(R) Arc(TM) Graphics (Driver 31.0.101.5447)
- NPU: Intel(R) AI Boost (ComputeAccelerator)
- Python: 3.10.9 (`py` launcher)
- Node.js: v24.11.1 (npm 11.6.2)
- OpenVINO: `openvino==2025.3.0`, `openvino-genai==2025.3.0.0`, `openvino-tokenizers==2025.3.0.0`

> Compatibility note: the steps below are “known good” only on the machine above. Other OS/hardware/version combinations have **not** been systematically tested.
>
> Conda note: [`backend/environment.yml`](backend/environment.yml) exists as a reference, but **Conda was not tested on this machine**. The verified method below uses `.venv + pip`.

### Prerequisites
- Python 3.10.9 (verified)
- Node.js v24.11.1 (verified)
- npm 11.6.2 (verified)

### 1) Clone
```bash
git clone <your-repo-url>
cd Reinforce\ Learning\ Pro
```

### 2) Backend (FastAPI)
Backend runs at `http://127.0.0.1:8000`.

Create a virtualenv at repo root and install deps (verified on the dev machine above):

```powershell
py -3.10 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -U pip
.\.venv\Scripts\python.exe -m pip install `
  openvino==2025.3.0 `
  openvino-genai==2025.3.0.0 `
  openvino-tokenizers==2025.3.0.0 `
  fastapi==0.122.0 `
  uvicorn==0.38.0 `
  pydantic-settings==2.12.0 `
  httpx numpy pandas rich tiktoken pymupdf
```

#### 2.1) Download on-device model weights (OpenVINO IR; not included in GitHub)

Model weights are too large to ship in the GitHub repository. To use **On-Device** models, download the OpenVINO-optimized model artifacts (IR + tokenizer) into the **exact** folders expected by the backend presets. If the folder names/paths differ, model selection will not work out-of-the-box.

Install the Hugging Face Hub CLI (`hf`) (verified on the dev machine above):
```powershell
.\.venv\Scripts\python.exe -m pip install -U huggingface_hub
```

Run the following from the repository root (each command downloads a model into the correct directory; large downloads — ensure enough disk space):

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

Optional notes:
- If you hit auth/gated access: run `.\.venv\Scripts\hf.exe auth login` and retry.
- If you only plan to use `Remote:` models, you can skip this step.

Set `PYTHONPATH` and start:

**PowerShell**
```powershell
$env:PYTHONPATH = "$PWD\backend"
.\.venv\Scripts\python.exe -m uvicorn rlpro_backend.api.server:app --host 127.0.0.1 --port 8000
```

**CMD**
```cmd
set PYTHONPATH=%CD%\backend
.\.venv\Scripts\python.exe -m uvicorn rlpro_backend.api.server:app --host 127.0.0.1 --port 8000
```

> The frontend currently targets `http://127.0.0.1:8000` (see [`frontend/src/api.ts`](frontend/src/api.ts)).

### 3) Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev -- --host --port 5173
```

> On Windows, if PowerShell execution policy blocks `npm`, use `npm.cmd`.

### 4) Open the key pages
- Main app: `http://127.0.0.1:5173/`
- Demo: `http://127.0.0.1:5173/demo`
- Flipped classroom: `http://127.0.0.1:5173/demo/flipped`
- Multilingual flipped classroom: `http://127.0.0.1:5173/demo/flipped-multilingual`

### Other OS / setups (not tested)
- macOS / Linux: not tested yet.
- Conda: not tested on the dev machine (kept as reference via `backend/environment.yml`).

---

## Native-language experience (why it matters)
- Supported UI/LLM languages: English, Chinese, Tibetan, Uyghur (RTL), Korean, French, German, Spanish.
- Follow-up questions are generated **directly** in the target language (not “generate in English then translate”), reducing semantic drift and cognitive overhead.
- Uyghur uses container-level `dir="rtl"` to keep reading direction and layout coherent.

---

## Models (On-Device / Remote)
The model selector exposes:
- On-Device: Qwen2.5-1.5B (CPU)
- On-Device: Qwen3-4B (CPU / GPU)
- On-Device: Qwen3-8B (CPU / GPU / NPU)
- On-Device: Qwen3-14B (GPU)
- Remote: Qwen3-Next-80B (API comparator)

Models are expected under:
- [`data/artifacts/models/`](data/artifacts/models/) `<model-dir>`

---

## (Optional) Remote LLM configuration (OpenAI-compatible)

If you want to compare on-device models with a cloud LLM (or temporarily need a stronger remote model), the backend can call an **OpenAI-compatible** remote endpoint. Configuration lives in [`backend/rlpro_backend/config.py`](backend/rlpro_backend/config.py).

Relevant settings (source snippet for quick discovery):
```python
# NOTE: These defaults are hard-coded for demo purposes; remove or override before publishing.
remote_api_key: str = Field("SAMPLE_API_KEY", description="API key for remote OpenAI-compatible endpoint (e.g., DashScope)")
remote_base_url: str = Field("https://dashscope.aliyuncs.com/compatible-mode/v1", description="Base URL for remote OpenAI-compatible endpoint")
remote_default_model: str = Field("qwen3-next-80b-a3b-instruct", description="Default remote model name (e.g., qwen3-next-80b-a3b-instruct)")
```

Notes:
- `SAMPLE_API_KEY` is a placeholder; **remote calls will fail** until you set a real key.
- `remote_base_url` should be the OpenAI-compatible base URL (the backend appends `/chat/completions` automatically).
  - Example (DashScope compatible mode): [https://dashscope.aliyuncs.com/compatible-mode/v1](https://dashscope.aliyuncs.com/compatible-mode/v1)
- Restart the backend after changing env vars.

### Option A: Set env vars in PowerShell before starting the backend (recommended)
```powershell
$env:RLPRO_REMOTE_API_KEY = "<YOUR_API_KEY>"
$env:RLPRO_REMOTE_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
$env:RLPRO_REMOTE_DEFAULT_MODEL = "qwen3-next-80b-a3b-instruct"
```

### Option B: Create a `.env` at repo root (convenient for repeated runs)
Create `.env` at the repository root (do not commit it):
```env
RLPRO_REMOTE_API_KEY=<YOUR_API_KEY>
RLPRO_REMOTE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
RLPRO_REMOTE_DEFAULT_MODEL=qwen3-next-80b-a3b-instruct
```

### Enable remote models in the UI
- Select a model labeled `Remote:` (for example `Remote: Qwen3-Next-80B (API)`).
- To use a different remote model name, add a new `Remote:` option in the frontend selector, or set `RLPRO_REMOTE_DEFAULT_MODEL`.

---

## Repository layout
- [`backend/`](backend/): FastAPI + Pydantic APIs
- [`frontend/`](frontend/): React + TypeScript + Vite UI
- [`data/`](data/): local data + model artifacts
- [`docs/`](docs/): deeper documentation (see [`docs/system_overview.md`](docs/system_overview.md))
- [`scripts/`](scripts/): helpers and OpenVINO benchmarks

---

## Further reading
- Detailed system guide: [`docs/system_overview.md`](docs/system_overview.md)
- Concept & framing (ModelScope): [https://www.modelscope.cn/learn/3227](https://www.modelscope.cn/learn/3227)
