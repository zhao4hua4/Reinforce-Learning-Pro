import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import ModuleImportPage from "./pages/ModuleImportPage";
import ModulesDashboardPage from "./pages/ModulesDashboardPage";
import ModuleLearnPage from "./pages/ModuleLearnPage";
import DemoPage from "./pages/DemoPage";
import FlippedClassroomPage from "./pages/FlippedClassroomPage";
import FlippedClassroomMultilingualPage from "./pages/FlippedClassroomMultilingualPage";

function App() {
  const location = useLocation();
  const isDemo = location.pathname.startsWith("/demo");
  return (
    <div className="app">
      {!isDemo && (
        <header className="app-header">
          <div>
            <div className="app-title">Reinforce Learning Pro</div>
            <div className="app-subtitle">Local/Remote Qwen sandbox</div>
          </div>
          <nav className="nav">
            <NavLink to="/" end>
              Modules
            </NavLink>
            <NavLink to="/modules/import">Import</NavLink>
          </nav>
        </header>
      )}
      <main className="app-main">
        <Routes>
          <Route path="/" element={<ModulesDashboardPage />} />
          <Route path="/modules" element={<ModulesDashboardPage />} />
          <Route path="/modules/import" element={<ModuleImportPage />} />
          <Route path="/modules/:id" element={<ModuleLearnPage />} />
          <Route path="/demo" element={<DemoPage />} />
          <Route path="/demo/flipped" element={<FlippedClassroomPage />} />
          <Route path="/demo/flipped-multilingual" element={<FlippedClassroomMultilingualPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
