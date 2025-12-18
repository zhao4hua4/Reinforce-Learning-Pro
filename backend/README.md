# Backend Skeleton

FastAPI + Pydantic 架构，用于 PDF → 片段 → 卡片 → 练习的闭环。当前仅搭建目录与占位文件，尚未实现业务逻辑。

## 目录
- `rlpro_backend/`
  - `api/`：FastAPI 应用与路由。
  - `adapters/`：本地 LLM、向量检索等适配器。
  - `models/`：领域模型（文档、片段、卡片、会话）。
  - `services/`：解析、切分、生成、调度、判分、讲解等服务。
  - `storage/`：本地存储抽象及实现。
  - `services/pipelines/`：端到端流水线编排占位。
- `tests/`：单元/集成测试。
- `logs/`：运行日志（默认忽略）。

## 环境
```bash
conda env create -f environment.yml
conda activate rlpro
```

## 开发提示（后续）
- `uvicorn rlpro_backend.api.server:app --reload`
- 环境变量前缀 `RLPRO_`（详见 `config.py`）。
- 数据与生成物存于 `data/` 下，仓储实现位于 `storage/`（未实现）。
