import { useState } from "react";

function ImportPage() {
  const [sections, setSections] = useState<any[]>([]);
  const [status, setStatus] = useState<string>("");

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("Uploading and ingesting...");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("http://127.0.0.1:8000/ingest", {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSections(data.sections || []);
      setStatus(`Ingested: ${data.title}, sections detected: ${data.sections?.length || 0}`);
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    }
  };

  return (
    <div className="panel">
      <h2>Import PDF & Chapters</h2>
      <p>Upload a PDF; chapters will be detected and stored locally.</p>
      <input type="file" accept="application/pdf" onChange={handleUpload} />
      <div className="status">{status}</div>
      {sections.length > 0 && (
        <div className="list">
          {sections.map((s, idx) => (
            <div key={idx} className="list-item">
              <div>{s.title}</div>
              <div className="muted">
                Pages {s.page_start} - {s.page_end}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ImportPage;
