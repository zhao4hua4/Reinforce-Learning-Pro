import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { askLLM } from "../api";

type ChatTurn = { role: "teacher" | "student" | "coach" | "llm" | "user" | "learner"; text: string };

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

const formatHistory = (turns: ChatTurn[], limit = 6) =>
  turns
    .slice(-limit)
    .map((t) => `${t.role.toUpperCase()}: ${t.text}`)
    .join("\n");

function FlippedClassroomMultilingualPage() {
  const navigate = useNavigate();
  const [model, setModel] = useState<string>(() => {
    const saved = localStorage.getItem("demo_model") || "";
    const allowed = new Set(modelOptions.map((o) => o.value));
    return allowed.has(saved) ? saved : "qwen2.5-1.5b-cpu";
  });
  const [language, setLanguage] = useState<string>(() => localStorage.getItem("demo_language") || "English");
  const langPrefix = language === "English" ? "" : `Please reply in ${language}.\n`;
  const [studentChat, setStudentChat] = useState<ChatTurn[]>([
    { role: "student", text: "Hi, what are we learning today?" },
  ]);
  const [instructorChat, setInstructorChat] = useState<ChatTurn[]>([]);
  const [classProgress, setClassProgress] = useState<{ label: string; done: boolean }[]>([
    { label: "Explain poverty-of-the-stimulus", done: false },
    { label: "Give UG vs usage-based example", done: false },
    { label: "Pose real-life example question", done: false },
  ]);
  const [classDone, setClassDone] = useState(false);
  const [teacherInput, setTeacherInput] = useState("");
  const [instructorInput, setInstructorInput] = useState("");
  const [llmLoading, setLlmLoading] = useState(false);
  const [progressSummary, setProgressSummary] = useState<string>("");
  const [scores, setScores] = useState<{ responsiveness: number; clarity: number; scaffolding: number; coach_use: number; total: number }>({
    responsiveness: 0,
    clarity: 0,
    scaffolding: 0,
    coach_use: 0,
    total: 0,
  });

  const progressPct = useMemo(() => {
    const done = classProgress.filter((c) => c.done).length;
    const base = Math.round((done / classProgress.length) * 100);
    return classDone ? 100 : base;
  }, [classProgress, classDone, studentChat]);
  const isRTL = language === "Uyghur";

  const evaluateProgress = async () => {
    setLlmLoading(true);
    try {
      const transcript = JSON.stringify(studentChat);
      const resp = await askLLM(
        `${langPrefix}You are evaluating teaching progress in a flipped classroom. Return JSON with keys: checklist (array of {label, done}), summary (one sentence). Checklist labels to use exactly: "Explain poverty-of-the-stimulus", "Give UG vs usage-based example", "Pose real-life example question". Mark an item done only if the student shows corrected understanding (do not award if a misunderstanding was left uncorrected). Use only the transcript; do not invent progress.\nTranscript: ${transcript}`,
        { max_new_tokens: 260, temperature: 0.2, model }
      );
      const parsed = JSON.parse(resp);
      if (Array.isArray(parsed.checklist)) {
        setClassProgress(
          classProgress.map((item) => {
            const match = parsed.checklist.find((c: any) => c.label === item.label);
            return match ? { ...item, done: !!match.done } : item;
          })
        );
      }
      if (parsed.summary) setProgressSummary(parsed.summary);
    } catch {
      /* ignore eval errors */
    } finally {
      setLlmLoading(false);
    }
  };

  const handleTeacherSend = async () => {
    if (!teacherInput.trim()) return;
    const text = teacherInput.trim();
    setStudentChat((c) => [...c, { role: "teacher", text }]);
    setTeacherInput("");
    setLlmLoading(true);
    try {
      const misunderstand = Math.random() < 0.6 && !classProgress[0].done;
      const studentPrompt = misunderstand
        ? `${langPrefix}You are a curious student who sometimes misunderstands. Keep context scoped to this student thread only.\nRecent turns:\n${formatHistory(studentChat)}\nTeacher just said:\n${text}\nRespond in 2 sentences: show a mild misunderstanding about UG vs usage-based learning, and end with a clarifying question.`
        : `${langPrefix}You are a curious student. Keep context scoped to this student thread only.\nRecent turns:\n${formatHistory(studentChat)}\nTeacher just said:\n${text}\nReply in 2 concise sentences, acknowledge what you heard, and ask one clarifying question about universal grammar or poverty of the stimulus.`;
      const resp = await askLLM(studentPrompt, { max_new_tokens: 140, temperature: 0.35, model });
      setStudentChat((c) => [...c, { role: "student", text: resp.trim() }]);
      await evaluateProgress();
    } catch {
      setStudentChat((c) => [...c, { role: "student", text: "Can you explain that a bit more?" }]);
    } finally {
      setLlmLoading(false);
    }
  };

  const handleInstructorAsk = async () => {
    if (!instructorInput.trim()) return;
    const text = instructorInput.trim();
    setInstructorChat((c) => [...c, { role: "user", text }]);
    setInstructorInput("");
    setLlmLoading(true);
    try {
      const resp = await askLLM(
        `${langPrefix}You are a senior instructor coach. Keep context limited to this coach thread.\nRecent coach turns:\n${formatHistory(instructorChat)}\nTeacher asks: ${text}\nGive concise advice (2 sentences) on helping the student progress on universal grammar; suggest one actionable move.`,
        { max_new_tokens: 140, temperature: 0.25, model }
      );
      setInstructorChat((c) => [...c, { role: "llm", text: resp.trim() }]);
    } catch {
      setInstructorChat((c) => [...c, { role: "llm", text: "Try an example contrasting sparse input vs innate bias." }]);
    } finally {
      setLlmLoading(false);
    }
  };

  const handleEndClass = async () => {
    setClassDone(true);
    setLlmLoading(true);
    try {
      const transcript = JSON.stringify(studentChat);
      const coach = JSON.stringify(instructorChat);
      const resp = await askLLM(
        `${langPrefix}Evaluate the teacher's performance across multiple dimensions. Prefer JSON with: scores ({responsiveness:0-1, clarity:0-1, scaffolding:0-1, coach_use:0-1, total:0-1}), summary (2 sentences, <=70 words), strengths (array of short phrases), weaknesses (array of short phrases). Weight 80% on student interaction transcript and 20% on coach interaction. If the teacher teaches well without coach help, give a bonus in coach_use; if teaching is weak and coach not used, penalize coach_use. If you cannot return JSON, return plain text with the scores explicitly numbered.\nStudent transcript: ${transcript}\nCoach transcript: ${coach}`,
        { max_new_tokens: 500, temperature: 0.2, model }
      );
      try {
        const parsed = JSON.parse(resp);
        if (parsed.scores) {
          setScores({
            responsiveness: Number(parsed.scores.responsiveness || 0),
            clarity: Number(parsed.scores.clarity || 0),
            scaffolding: Number(parsed.scores.scaffolding || 0),
            coach_use: Number(parsed.scores.coach_use || 0),
            total: Number(parsed.scores.total || 0),
          });
        }
        const strengths = Array.isArray(parsed.strengths) ? parsed.strengths.join("; ") : "";
        const weaknesses = Array.isArray(parsed.weaknesses) ? parsed.weaknesses.join("; ") : "";
        const combined = [parsed.summary || "", strengths ? `Strengths: ${strengths}` : "", weaknesses ? `Weaknesses: ${weaknesses}` : ""]
          .filter(Boolean)
          .join("\n");
        setInstructorChat((c) => [...c, { role: "llm", text: combined || resp }]);
      } catch {
        setInstructorChat((c) => [...c, { role: "llm", text: resp }]);
      }
    } catch {
      setInstructorChat((c) => [...c, { role: "llm", text: "Good job guiding; consider adding more concrete examples." }]);
    } finally {
      setLlmLoading(false);
    }
  };

  return (
    <div className="panel flipped" dir={isRTL ? "rtl" : "ltr"}>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progressPct}%` }}></div>
        <div className="progress-label">Class progress: {progressPct}% {llmLoading ? "(LLM thinking...)" : ""}</div>
      </div>
      <h2>Flipped Classroom (Multilingual)</h2>
      <div className="muted">
        Teach first, then ask the coach. Model:
        <select
          value={model}
          onChange={(e) => {
            const val = e.target.value;
            setModel(val);
            localStorage.setItem("demo_model", val);
          }}
          style={{ marginLeft: 6 }}
        >
          {modelOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span style={{ marginLeft: 8 }}>Language:</span>
        <select
          value={language}
          onChange={(e) => {
            const val = e.target.value;
            setLanguage(val);
            localStorage.setItem("demo_language", val);
            window.location.reload();
          }}
        >
          <option value="English">English</option>
          <option value="Chinese">??</option>
          <option value="Tibetan">??</option>
          <option value="Uyghur">????</option>
          <option value="Korean">???</option>
          <option value="French">French</option>
          <option value="German">German</option>
          <option value="Spanish">Spanish</option>
        </select>
        <button onClick={() => navigate("/demo")} style={{ marginLeft: 8 }}>
          Back to demo
        </button>
      </div>
      <div className="flipped-body">
        <div className="flipped-left">
          <div className="muted">Teaching chat (you teach the student LLM)</div>
          <div className="chat-window">
            {studentChat.map((m, idx) => (
              <div key={idx} className={`chat-bubble ${m.role === "student" ? "llm" : "user"}`}>
                <div className="muted">{m.role}</div>
                <div>{m.text}</div>
              </div>
            ))}
          </div>
          <textarea
            className="answer-box"
            rows={3}
            value={teacherInput}
            onChange={(e) => setTeacherInput(e.target.value)}
            placeholder='Teach the student; they started with "Hi, what are we learning today?"'
          />
          <button onClick={handleTeacherSend} disabled={llmLoading}>
            {llmLoading ? "Student thinking..." : "Send to student"}
          </button>
          <div className="muted small">Tip: correct misunderstandings explicitly; progress is granted only when the student reflects corrected understanding.</div>
        </div>
        <div className="flipped-right">
          <div className="muted">Progress & Coach</div>
          <ul>
            {classProgress.map((p) => (
              <li key={p.label} className={p.done ? "done" : ""}>
                {p.label} {p.done ? "(done)" : ""}
              </li>
            ))}
          </ul>
          {classDone && progressSummary && <div className="status">{progressSummary}</div>}
          {classDone && (
            <div className="metrics">
              <div className="metric">
                <div className="muted">Total</div>
                <div>{Math.round(scores.total * 100)}%</div>
              </div>
              <div className="metric small">
                <div className="muted">Resp</div>
                <div>{Math.round(scores.responsiveness * 100)}%</div>
              </div>
              <div className="metric small">
                <div className="muted">Clarity</div>
                <div>{Math.round(scores.clarity * 100)}%</div>
              </div>
              <div className="metric small">
                <div className="muted">Scaffold</div>
                <div>{Math.round(scores.scaffolding * 100)}%</div>
              </div>
              <div className="metric small">
                <div className="muted">Coach use</div>
                <div>{Math.round(scores.coach_use * 100)}%</div>
              </div>
            </div>
          )}
          <div className="muted">Senior instructor (ask for advice)</div>
          <div className="chat-window">
            {instructorChat.map((m, idx) => (
              <div key={idx} className={`chat-bubble ${m.role}`}>
                <div className="muted">{m.role}</div>
                <div>{m.text}</div>
              </div>
            ))}
          </div>
          <textarea
            className="answer-box"
            rows={2}
            value={instructorInput}
            onChange={(e) => setInstructorInput(e.target.value)}
            placeholder="Ask the senior instructor how to guide the student..."
          />
          <div className="actions">
            <button onClick={handleInstructorAsk} disabled={llmLoading}>
              {llmLoading ? "Coach thinking..." : "Ask coach"}
            </button>
            <button onClick={handleEndClass} disabled={classDone || llmLoading}>
              {classDone ? "Class ended" : "End class & evaluate"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FlippedClassroomMultilingualPage;
