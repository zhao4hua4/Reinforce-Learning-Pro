import { exportCsv, exportMd, exportAnki } from "../api";

function ExportPage() {
  return (
    <div className="panel">
      <h2>Export</h2>
      <p>Download pre-generated cards as CSV or Markdown.</p>
      <div className="actions">
        <button onClick={() => exportCsv()}>Download CSV</button>
        <button onClick={() => exportMd()}>Download Markdown</button>
        <button onClick={() => exportAnki()}>Download Anki TSV</button>
      </div>
    </div>
  );
}

export default ExportPage;
