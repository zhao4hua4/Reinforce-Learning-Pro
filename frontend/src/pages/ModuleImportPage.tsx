import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { generateModule } from "../api";

const modelOptions = [
  { value: "qwen2.5-1.5b-cpu", label: "On-Device: Qwen2.5-1.5B (CPU)" },
  { value: "qwen3-4b-cpu", label: "On-Device: Qwen3-4B (CPU)" },
  { value: "qwen3-4b-gpu", label: "On-Device: Qwen3-4B (GPU)" },
  { value: "qwen3-8b-cpu", label: "On-Device: Qwen3-8B (CPU)" },
  { value: "qwen3-8b-gpu", label: "On-Device: Qwen3-8B (GPU)" },
  { value: "qwen3-8b-npu", label: "On-Device: Qwen3-8B (NPU)" },
  { value: "qwen3-14b-gpu", label: "On-Device: Qwen3-14B (GPU)" },
  { value: "qwen3-next-80b-a3b-instruct", label: "Remote: Qwen3-Next-80B (API)" },
];

function ModuleImportPage() {
  const [text, setText] = useState("");
  const [language, setLanguage] = useState("English");
  const [model, setModel] = useState<string>("qwen2.5-1.5b-cpu");
  const [status, setStatus] = useState("");
  const isRTL = language === "Uyghur";
  const navigate = useNavigate();

  const handleGenerate = async () => {
    if (!text.trim()) {
      setStatus("Please paste up to 1000 words.");
      return;
    }
    setStatus("Generating materials...");
    try {
      const resp = await generateModule({ text, language, model_name: model === "local" ? undefined : model });
      setStatus("Module generated.");
      navigate(`/modules/${resp.module.id}`);
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  };

  return (
    <div className="panel" dir={isRTL ? "rtl" : "ltr"}>
      <h2>Import & Generate Module</h2>
      <div className="muted">Paste up to 1000 words; we will generate a learning note, test questions, and flipped-classroom checklist.</div>
      <div className="actions" style={{ marginTop: 8 }}>
        <label>
          Language:
          <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ marginLeft: 6 }}>
            <option value="English">English</option>
            <option value="Chinese">中文</option>
            <option value="Tibetan">藏语</option>
            <option value="Uyghur">维吾尔语</option>
            <option value="Korean">朝鲜语</option>
            <option value="French">French</option>
            <option value="German">German</option>
            <option value="Spanish">Spanish</option>
          </select>
        </label>
        <label style={{ marginLeft: 12 }}>
          Model:
          <select value={model} onChange={(e) => setModel(e.target.value)} style={{ marginLeft: 6 }}>
            {modelOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <textarea
        className="answer-box"
        style={{ marginTop: 8 }}
        rows={12}
        maxLength={8000}
        placeholder="Paste content here (up to 1000 words)..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button onClick={handleGenerate}>Generate learning materials</button>
      <div className="status">{status}</div>
    </div>
  );
}

export default ModuleImportPage;
