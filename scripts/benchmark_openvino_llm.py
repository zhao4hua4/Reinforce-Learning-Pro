"""Quick throughput benchmark for the local OpenVINO LLM pipeline.

Usage:
  python scripts/benchmark_openvino_llm.py --model-dir data/artifacts/models/Qwen2.5-7B-Instruct-int4-ov

Optional performance knobs (applied via env for Intel CPUs):
  --threads N    -> sets OMP_NUM_THREADS / OV_NUM_THREADS
  --streams N    -> sets OV_NUM_STREAMS
  --cache-dir DIR -> sets OV_CACHE_DIR to reuse compiled blobs
"""

from __future__ import annotations

import argparse
import json
import os
import time
import multiprocessing

import openvino_genai as ov


def _strip_think(text: str) -> str:
  """Remove Qwen deliberate block if present."""
  if text.startswith("<think>"):
    end = text.find("</think>")
    if end != -1:
      return text[end + len("</think>") :].lstrip()
    # Fallback: drop first line to avoid returning only the tag
    return "\n".join(text.splitlines()[1:]).lstrip()
  return text


def _count_tokens(tokenizer: ov.Tokenizer, text: str) -> int:
  encoded = tokenizer.encode(text)
  # Newer openvino_genai returns a TokenizedInputs with tensor fields; fall back gracefully.
  for attr in ("input_ids", "ids"):
    if hasattr(encoded, attr):
      arr = getattr(encoded, attr)
      if hasattr(arr, "shape") and len(getattr(arr, "shape", [])) > 0:
        try:
          # shape like (1, N) -> take last dimension
          return int(arr.shape[-1])
        except Exception:
          pass
      try:
        return len(arr)  # type: ignore[arg-type]
      except Exception:
        pass
  try:
    return len(encoded)  # type: ignore[arg-type]
  except Exception:
    return 0


def main() -> None:
  parser = argparse.ArgumentParser(description="Benchmark OpenVINO LLM tokens/sec.")
  parser.add_argument(
    "--model-dir",
    default="data/artifacts/models/Qwen2.5-7B-Instruct-int4-ov",
    help="Path to the OpenVINO model directory.",
  )
  parser.add_argument("--device", default="CPU", help="Target device (CPU by default).")
  parser.add_argument("--max-new-tokens", type=int, default=128, help="Number of tokens to generate.")
  parser.add_argument("--temperature", type=float, default=0.1, help="Decoding temperature.")
  parser.add_argument("--top-p", type=float, default=0.9, help="Top-p sampling.")
  parser.add_argument("--threads", type=int, default=None, help="Set OMP_NUM_THREADS / OV_NUM_THREADS.")
  parser.add_argument("--streams", type=int, default=None, help="Set OV_NUM_STREAMS for parallel requests.")
  parser.add_argument("--cache-dir", type=str, default=None, help="Set OV_CACHE_DIR to reuse compiled blobs.")
  parser.add_argument(
    "--prompt",
    type=str,
    default="Give a concise three-sentence summary of the testing effect and why spacing helps learning.",
    help="Prompt to run.",
  )
  args = parser.parse_args()

  logical_cpus = multiprocessing.cpu_count()
  device_upper = args.device.upper()
  auto_threads = args.threads or (min(logical_cpus, 16) if device_upper == "CPU" else None)
  default_streams = 1 if device_upper in {"CPU", "NPU"} else 2  # GPU often benefits from a couple of streams
  auto_streams = args.streams if args.streams is not None else default_streams

  if auto_threads:
    os.environ["OMP_NUM_THREADS"] = str(auto_threads)
    os.environ["OV_NUM_THREADS"] = str(auto_threads)
  os.environ["OV_NUM_STREAMS"] = str(auto_streams)
  if args.cache_dir:
    os.environ["OV_CACHE_DIR"] = args.cache_dir
  print(f"[perf] device={device_upper} logical_cpus={logical_cpus} threads={auto_threads or 'n/a'} streams={auto_streams} cache_dir={args.cache_dir or ''}")

  pipe = ov.LLMPipeline(args.model_dir, device=args.device)
  tokenizer = pipe.get_tokenizer()

  messages = [
    {
      "role": "system",
    "content": "You are a concise assistant.",
  },
    {"role": "user", "content": args.prompt},
  ]
  if "qwen3" in args.model_dir.lower():
    messages[1]["content"] = "/nothink\n" + messages[1]["content"]
  print("--- Benchmark prompt (system) ---")
  print(messages[0]["content"])
  print("--- Benchmark prompt (user) ---")
  print(args.prompt)

  prompt_text = tokenizer.apply_chat_template(messages, add_generation_prompt=True)
  stop_strings: set[str] = set()  # allow full output; we'll strip <think> locally
  gen_cfg = ov.GenerationConfig(
    max_new_tokens=args.max_new_tokens,
    temperature=args.temperature,
    top_p=args.top_p,
    do_sample=False,
    stop_strings=stop_strings,
    include_stop_str_in_output=False,
    ignore_eos=False,
    # enable_thinking defaults to False; leaving it as-is to avoid forcing deliberate mode
  )

  start = time.perf_counter()
  output = pipe.generate(prompt_text, generation_config=gen_cfg)
  elapsed = time.perf_counter() - start
  cleaned = _strip_think(output)

  prompt_tokens = _count_tokens(tokenizer, prompt_text)
  gen_tokens = _count_tokens(tokenizer, cleaned)
  tps = gen_tokens / elapsed if elapsed > 0 else 0.0

  stats = {
    "prompt_tokens": prompt_tokens,
    "generated_tokens": gen_tokens,
    "elapsed_sec": round(elapsed, 3),
    "tokens_per_sec": round(tps, 2),
    "device": args.device,
    "threads": args.threads,
    "streams": args.streams,
  }
  print(json.dumps(stats, indent=2))
  print("\n--- Model output ---\n")
  if output.startswith("<think>"):
    end = output.find("</think>")
    think_block = output[: end + len("</think>")] if end != -1 else output
    print("== THINKING BLOCK ==")
    print(think_block.strip())
    print("\n== FINAL ==")
    print(cleaned.strip())
  else:
    print(cleaned.strip())


if __name__ == "__main__":
  main()
