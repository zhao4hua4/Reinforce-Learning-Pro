import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { deleteModule, fetchModules, type Module } from "../api";

function ModulesDashboardPage() {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchModules();
      setModules(list);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this module?")) return;
    setLoading(true);
    try {
      await deleteModule(id);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel">
      <h2>Modules Dashboard</h2>
      <div className="actions">
        <button onClick={() => navigate("/modules/import")} disabled={loading}>
          New module
        </button>
      </div>
      {error && <div className="status error">{error}</div>}
      {loading && <div className="status">Loading...</div>}
      <div className="list">
        {modules.map((m) => (
          <div key={m.id} className="list-item">
            <div className="question">{m.title}</div>
            <div className="muted">Language: {m.language}</div>
            <div className="actions">
              <Link to={`/modules/${m.id}`}>Learn</Link>
              <button onClick={() => handleDelete(m.id)} disabled={loading}>
                Delete
              </button>
            </div>
          </div>
        ))}
        {modules.length === 0 && !loading && <div className="muted">No modules yet (demo content excluded).</div>}
      </div>
    </div>
  );
}

export default ModulesDashboardPage;
