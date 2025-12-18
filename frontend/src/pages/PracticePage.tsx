import { useEffect, useMemo, useState } from "react";
import type { Card } from "../api";
import { askLLM, fetchCards, fetchPracticeNext, gradeAnswer, liveQuestion, startSession } from "../api";

type LiveQ = { raw?: string; question?: any; progress?: string };

function PracticePage() {
  const [card, setCard] = useState<Card | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [userAnswer, setUserAnswer] = useState("");
  const [result, setResult] = useState<string>("");
  const [liveQ, setLiveQ] = useState<LiveQ | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ total: number; correct: number; perSection: Record<string, { correct: number; total: number }> }>({
    total: 0,
    correct: 0,
    perSection: {},
  });
  const [chat, setChat] = useState<{ role: "user" | "llm"; text: string }[]>([]);
  const [followup, setFollowup] = useState("");
  const [latency, setLatency] = useState<Record<string, number>>({});
  const [sessionId, setSessionId] = useState<string | null>(null);

  const sections = useMemo(() => {
    const s = new Set<string>();
    cards.forEach((c) => {
      const sec = (c.metadata as any)?.section || [];
      sec.forEach((x: string) => s.add(x));
    });
    return Array.from(s);
  }, [cards]);

  const weaknesses = useMemo(() => {
    const entries = Object.entries(stats.perSection).map(([sec, s]) => ({
      section: sec,
      total: s.total,
      correct: s.correct,
      accuracy: s.total ? s.correct / s.total : 0,
    }));
    return entries.sort((a, b) => a.accuracy - b.accuracy).slice(0, 3);
  }, [stats]);

  const recordLatency = (key: string, start: number) => {
    setLatency((prev) => ({ ...prev, [key]: Math.round(performance.now() - start) }));
  };

  const loadNext = async (sectionsOverride?: string[]) => {
    const started = performance.now();
    setLoading(true);
    setResult("");
    setLiveQ(null);
    try {
      const activeSections = sectionsOverride ?? (selectedSections.length ? selectedSections : undefined);
      const { card: c } = await fetchPracticeNext(activeSections);
      setCard(c);
      setUserAnswer("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      recordLatency("next", started);
    }
  };

  const handleStudySection = async (sec: string) => {
    setSelectedSections([sec]);
    await loadNext([sec]);
  };

  useEffect(() => {
    (async () => {
      try {
        const sess = await startSession();
        setSessionId(sess.session_id);
        const data = await fetchCards();
        setCards(data);
      } catch (err) {
        // ignore for now
      }
      await loadNext();
    })();
  }, []);

  const handleGrade = async () => {
    if (!card) return;
    const started = performance.now();
    setLoading(true);
    setError(null);
    try {
      const isOpen = !card.options || card.options.length === 0;
      const res = await gradeAnswer({
        card_id: card.id,
        card_type: card.card_type,
        question: card.question,
        expected_answer: card.answer,
        user_answer: userAnswer,
        options: card.options,
        source_id: card.source_id,
        source_page: card.source_page,
        use_llm: isOpen,
        session_id: sessionId,
      });
      setResult(`Correct: ${res.is_correct} | Score: ${res.score.toFixed(2)}`);
      setStats((prev) => {
        const sec = ((card.metadata as any)?.section || ["general"])[0];
        const perSection = { ...prev.perSection };
        const existing = perSection[sec] || { correct: 0, total: 0 };
        const correct = existing.correct + (res.is_correct ? 1 : 0);
        const total = existing.total + 1;
        perSection[sec] = { correct, total };
        return {
          total: prev.total + 1,
          correct: prev.correct + (res.is_correct ? 1 : 0),
          perSection,
        };
      });
      // Tutor follow-up
      const source = card.source_snippet || "";
      const tutorPrompt = `You are a friendly, concise tutor continuing a conversation. Lead with a short question or invitation to reflect, then give one specific encouragement/correction grounded in the expected answer, and close with a nudge for the learner to respond. Avoid labels like "Feedback:"; write 2-3 sentences max.\nQuestion: ${card.question}\nExpected: ${card.answer}\nUser answer: ${userAnswer}\nResult: Correct=${res.is_correct} Score=${res.score}\nContext: ${source}`;
      try {
        const resp = await askLLM(tutorPrompt);
        setChat((c) => [...c, { role: "llm", text: resp }]);
      } catch (e) {
        /* ignore */
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      recordLatency("grade", started);
    }
  };

  const handleLive = async () => {
    if (!card) return;
    const started = performance.now();
    setLoading(true);
    setLiveQ({ progress: "" });
    setError(null);
    try {
      const content = card.source_snippet || card.question;
      const q = await liveQuestion(content, card.card_type || "short_answer", (chunk) => {
        setLiveQ((prev) => ({ ...(prev || {}), progress: (prev?.progress || "") + chunk }));
      });
      setLiveQ(q);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      recordLatency("live", started);
    }
  };

  const handleFollowup = async () => {
    if (!followup.trim()) return;
    const started = performance.now();
    setLoading(true);
    setError(null);
    setChat((c) => [...c, { role: "user", text: followup }]);
    try {
      const source = card ? card.source_snippet || "" : "";
      const resp = await askLLM(`Question: ${followup}\nContext:\n${source}`);
      setChat((c) => [...c, { role: "llm", text: resp }]);
      setFollowup("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      recordLatency("chat", started);
    }
  };

  const handleNewVariant = async () => {
    if (!card) return;
    const started = performance.now();
    setLoading(true);
    setError(null);
    const source = card.source_snippet || card.question;
    try {
      const prompt = `Create a fresh practice question on the same concept, matching the card type (${card.card_type}). Provide question, short answer, and a one-line hint. Use this source:\n${source}`;
      const resp = await askLLM(prompt);
      setChat((c) => [...c, { role: "llm", text: resp }]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      recordLatency("regen", started);
    }
  };

  return (
    <div className="panel">
      <h2>Practice</h2>
      <div className="panel-body">
        <div className="main-column">
          <button onClick={() => loadNext()} disabled={loading}>
            Next Card
          </button>
          {sections.length > 0 && (
            <div className="filter">
              <div className="muted">Filter by sections:</div>
              <div className="chips">
                {sections.map((sec) => (
                  <label key={sec} className="chip">
                    <input
                      type="checkbox"
                      checked={selectedSections.includes(sec)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedSections((prev) => [...prev, sec]);
                        } else {
                          setSelectedSections((prev) => prev.filter((x) => x !== sec));
                        }
                      }}
                    />
                    {sec}
                  </label>
                ))}
              </div>
            </div>
          )}
          {error && <div className="status error">{error}</div>}
          {card && (
            <div className="card-item">
              <div className="muted">{card.card_type}</div>
              <div className="question">{card.question}</div>
              {card.options && card.options.length > 0 ? (
                <div className="options">
                  {card.options.map((opt) => (
                    <label key={opt} className="chip">
                      <input
                        type={card.card_type === "single_choice" ? "radio" : "checkbox"}
                        name="options"
                        checked={userAnswer.split(";").includes(opt)}
                        onChange={(e) => {
                          if (card.card_type === "single_choice") {
                            setUserAnswer(opt);
                          } else {
                            const parts = new Set(userAnswer.split(";").filter(Boolean));
                            if (e.target.checked) parts.add(opt);
                            else parts.delete(opt);
                            setUserAnswer(Array.from(parts).join(";"));
                          }
                        }}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              ) : (
                <textarea
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="Your answer..."
                  rows={4}
                  className="answer-box"
                />
              )}
              <div className="actions">
                <button onClick={handleGrade} disabled={loading}>
                  Grade
                </button>
                <button onClick={handleLive} disabled={loading}>
                  Generate Live Question/Explanation
                </button>
                <button onClick={handleNewVariant} disabled={loading}>
                  New Question Variant
                </button>
              </div>
              {liveQ && (
                <div className="live">
                  <div className="muted">Live generation</div>
                  {liveQ.progress && <pre>{liveQ.progress}</pre>}
                  {liveQ.question && <pre>{JSON.stringify(liveQ.question, null, 2)}</pre>}
                  {liveQ.raw && <pre>{liveQ.raw}</pre>}
                </div>
              )}
            </div>
          )}
          {result && <div className="status">{result}</div>}
          <div className="latency-row">
            {latency.next !== undefined && <div className="muted">Next: {latency.next} ms</div>}
            {latency.grade !== undefined && <div className="muted">Grade: {latency.grade} ms</div>}
            {latency.live !== undefined && <div className="muted">Live: {latency.live} ms</div>}
            {latency.chat !== undefined && <div className="muted">Chat: {latency.chat} ms</div>}
            {latency.regen !== undefined && <div className="muted">Variant: {latency.regen} ms</div>}
          </div>
          <div className="metrics">
            <div className="metric">
              <div className="muted">Total</div>
              <div>
                {stats.correct} / {stats.total}
              </div>
              <div className="bar">
                <span style={{ width: `${stats.total ? (stats.correct / stats.total) * 100 : 0}%` }}></span>
              </div>
            </div>
            {Object.entries(stats.perSection).map(([sec, s]) => (
              <div className="metric" key={sec}>
                <div className="muted">{sec}</div>
                <div>
                  {s.correct} / {s.total}
                </div>
                <div className="bar">
                  <span style={{ width: `${s.total ? (s.correct / s.total) * 100 : 0}%` }}></span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="sidebar chat-pane">
          <div className="muted">Co-learning chat</div>
          <div className="chat-window">
            {chat.map((m, idx) => (
              <div key={idx} className={`chat-bubble ${m.role}`}>
                <div className="muted">{m.role}</div>
                <div>{m.text}</div>
              </div>
            ))}
          </div>
          <div className="weaknesses">
            <div className="muted">Weak areas (focus first)</div>
            {weaknesses.length === 0 && <div className="muted">No data yet</div>}
            {weaknesses.map((w) => (
              <div key={w.section} className="weak-item">
                <div>{w.section}</div>
                <div className="muted">
                  {w.correct} / {w.total} correct ({Math.round(w.accuracy * 100)}%)
                </div>
                <div className="bar">
                  <span style={{ width: `${w.accuracy * 100}%` }}></span>
                </div>
                <button onClick={() => handleStudySection(w.section)} disabled={loading}>
                  Study this
                </button>
              </div>
            ))}
          </div>
          <textarea
            value={followup}
            onChange={(e) => setFollowup(e.target.value)}
            rows={3}
            className="answer-box"
            placeholder="Ask a follow-up or request an explanation..."
          />
          <div className="actions">
            <button onClick={handleFollowup} disabled={loading}>
              Ask LLM
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PracticePage;
