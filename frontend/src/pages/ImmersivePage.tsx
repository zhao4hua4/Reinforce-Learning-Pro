import { useEffect, useMemo, useState } from "react";
import { askLLM, fetchLearnCard, fetchPracticeNext, fetchTestQuestions, gradeAnswer, startSession } from "../api";
import type { Card } from "../api";

type Phase = "learn" | "test" | "done";
type GeneratedQ = { question: string; answer: string; options?: string[] | null; card_type?: string; explanation?: string };

function ImmersivePage() {
  const [card, setCard] = useState<Card | null>(null);
  const [phase, setPhase] = useState<Phase>("learn");
  const [chat, setChat] = useState<{ role: "user" | "llm"; text: string }[]>([]);
  const [userInput, setUserInput] = useState("");
  const [learnTurns, setLearnTurns] = useState(0);
  const [testQ, setTestQ] = useState<GeneratedQ | null>(null);
  const [testSet, setTestSet] = useState<GeneratedQ[]>([]);
  const [testIndex, setTestIndex] = useState(0);
  const [testAnswer, setTestAnswer] = useState("");
  const [result, setResult] = useState<string>("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, correct: 0 });
  const [learningCard, setLearningCard] = useState<string>("");

  const contextSnippet = useMemo(() => card?.source_snippet || card?.question || "", [card]);
  const progress = useMemo(() => {
    if (!card) return 0;
    if (phase === "learn") return Math.min(40, (learnTurns + 1) * 15);
    if (phase === "test" && testSet.length > 0) return 50 + Math.round(((testIndex + 1) / testSet.length) * 50);
    if (phase === "done") return 100;
    return 0;
  }, [card, phase, learnTurns, testIndex, testSet]);

  useEffect(() => {
    (async () => {
      const sess = await startSession();
      setSessionId(sess.session_id);
      await loadKnowledgePoint();
    })();
  }, []);

  const loadKnowledgePoint = async () => {
    setPhase("learn");
    setLearnTurns(0);
    setTestQ(null);
    setTestSet([]);
    setTestIndex(0);
    setResult("");
    setTestAnswer("");
    setChat([]);
    setLearningCard("");
    setLoading(true);
    try {
      const { card: c } = await fetchPracticeNext();
      setCard(c);
      await buildLearningCard(c);
    } catch (err: any) {
      setChat([{ role: "llm", text: `Could not load content: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const buildLearningCard = async (c: Card) => {
    try {
      const resp = await fetchLearnCard({
        source_id: c.source_id || undefined,
        card_question: c.question,
        card_answer: c.answer,
        context: c.source_snippet || undefined,
        min_words: 180,
        max_words: 320,
      });
      setLearningCard(resp.text);
      if (resp.prompts && resp.prompts.length > 0) {
        setChat([{ role: "llm", text: resp.prompts[0] }]);
      }
    } catch (err: any) {
      const fallback = `${c.question}\nSource: ${c.source_snippet || ""}`;
      setLearningCard(`${fallback}\n(Expansion failed: ${err.message})`);
    }
  };

  const handleNext = async () => {
    if (phase === "learn") {
      await continueLearn();
    } else {
      await loadKnowledgePoint();
    }
  };

  const continueLearn = async () => {
    if (!card) return;
    const userText = userInput.trim();
    const snippet = contextSnippet;
    setUserInput("");
    setLoading(true);
    try {
      if (userText) {
        setChat((c) => [...c, { role: "user", text: userText }]);
      }
      const prompt = `You are a co-learning tutor. Always address the learner as "you". Use the snippet as ground truth and keep it interactive: acknowledge what they said, invite self-evaluation ("Does your answer fit the main idea?"), and ask one probing question to extend or connect beyond the snippet (but still grounded). Keep it concise (2-3 sentences), no meta talk.\nSnippet:\n${snippet}\nLearner reply: ${userText || "(no reply)"}\nReply in second person, end with a question to invite a response.`;
      const resp = await askLLM(prompt, { max_new_tokens: 512, temperature: 0.3 });
      setChat((c) => [...c, { role: "llm", text: resp }]);
      const turns = learnTurns + 1;
      setLearnTurns(turns);
      if (turns >= 2) {
        await generateTest();
      }
    } catch (err: any) {
      setChat((c) => [...c, { role: "llm", text: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const generateTest = async () => {
    if (!card) return;
    setPhase("test");
    setResult("");
    setTestAnswer("");
    setLoading(true);
    try {
      const content = learningCard || contextSnippet;
      const resp = await fetchTestQuestions({ content, source_id: card.source_id || undefined, question_count: 3 });
      const qs = resp.questions.map((q, idx) => ({
        question: q.question,
        answer: q.answer,
        options: q.options,
        card_type: q.card_type,
        explanation: q.answer,
        id: `${card.id}_test_${idx + 1}`,
      }));
      setTestSet(qs);
      setTestIndex(0);
      setTestQ(qs[0] || null);
    } catch (err: any) {
      setResult(`Could not generate test questions: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitTest = async () => {
    if (!testQ) return;
    setLoading(true);
    try {
      const res = await gradeAnswer({
        card_id: testQ.question || "live_card",
        card_type: testQ.card_type || "short_answer",
        question: testQ.question,
        expected_answer: testQ.answer,
        user_answer: testAnswer,
        options: testQ.options || undefined,
        session_id: sessionId,
      });
      setResult(`Correct: ${res.is_correct} | Score: ${res.score.toFixed(2)}${res.details?.expected ? ` | Expected: ${res.details.expected}` : ""}`);
      setStats((s) => ({ total: s.total + 1, correct: s.correct + (res.is_correct ? 1 : 0) }));
      const follow = await askLLM(
        `Coach the learner step by step, addressing them as "you". Give one brief encouragement, then one hint to move closer to the correct idea (without giving the full answer), then a single probing question that invites them to refine or extend their answer. Base it on this question and answer.\nQuestion: ${testQ.question}\nExpected answer: ${testQ.answer}\nUser answer: ${testAnswer}\nResult: ${res.is_correct ? "correct" : "incorrect"}.`,
        { max_new_tokens: 256, temperature: 0.2 }
      );
      setChat((c) => [...c, { role: "llm", text: follow }]);
      const nextIndex = testIndex + 1;
      if (nextIndex < testSet.length) {
        setTestIndex(nextIndex);
        setTestQ(testSet[nextIndex]);
        setTestAnswer("");
        setResult("");
      } else {
        setPhase("done");
      }
    } catch (err: any) {
      setResult(`Grading failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAskSelection = async () => {
    const selection = window.getSelection()?.toString().trim();
    const content = selection || learningCard || contextSnippet;
    if (!content) {
      setResult("Select text from the learning note first.");
      return;
    }
    setLoading(true);
    try {
      const resp = await askLLM(
        `You are a co-learning tutor. The learner selected this text:\n${content}\nProvide a concise explanation in second person and ask one guiding question that invites them to connect or extend the idea beyond the snippet (but stay grounded). Do not restate test answers.`,
        { max_new_tokens: 300, temperature: 0.25 }
      );
      setChat((c) => [...c, { role: "llm", text: resp }]);
    } catch (err: any) {
      setResult(`Ask failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const renderTestInput = () => {
    if (!testQ) return null;
    if (testQ.options && testQ.options.length > 0) {
      const isSingle = (testQ.card_type || "").toLowerCase() === "single_choice";
      return (
        <div className="options">
          {testQ.options.map((opt) => (
            <label key={opt} className="chip">
              <input
                type={isSingle ? "radio" : "checkbox"}
                name="imm-options"
                checked={testAnswer.split(";").includes(opt)}
                onChange={(e) => {
                  if (isSingle) {
                    setTestAnswer(opt);
                  } else {
                    const parts = new Set(testAnswer.split(";").filter(Boolean));
                    if (e.target.checked) parts.add(opt);
                    else parts.delete(opt);
                    setTestAnswer(Array.from(parts).join(";"));
                  }
                }}
              />
              {opt}
            </label>
          ))}
        </div>
      );
    }
    return (
      <textarea
        value={testAnswer}
        onChange={(e) => setTestAnswer(e.target.value)}
        rows={3}
        className="answer-box"
        placeholder="Your answer..."
      />
    );
  };

  return (
    <div className="panel immersive">
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }}></div>
        <div className="progress-label">Progress: {progress}%</div>
      </div>
      <h2>Immersive Learn → Test → Relearn</h2>
      <div className="muted">Co-learning guided by AI; minimal controls to stay focused.</div>
      <div className="panel-body immersive-body">
        <div className="main-column">
          <div className="card-item">
            <div className="muted">{phase === "learn" ? "Learn & Reflect" : phase === "test" ? "Test what you grasped" : "Review result"}</div>
            <div className="question">{card?.question || "Loading..."}</div>
            {learningCard ? (
              <div className="learning-card-block" onMouseUp={() => {}}>
                <div className="learning-card-text">{learningCard}</div>
                <div className="learning-actions">
                  <button onClick={handleAskSelection} disabled={loading}>
                    Ask about selection
                  </button>
                </div>
              </div>
            ) : (
              contextSnippet && <div className="muted">Context: {contextSnippet}</div>
            )}
          </div>
          {phase === "test" && testQ && (
            <div className="card-item">
              <div className="question">{testQ.question}</div>
              {renderTestInput()}
              <button onClick={handleSubmitTest} disabled={loading}>
                Submit
              </button>
              <div className="muted">
                Question {testIndex + 1} of {testSet.length || 1}
              </div>
            </div>
          )}
          {result && <div className="status">{result}</div>}
          {phase === "done" && (
            <button onClick={handleNext} disabled={loading}>
              Next
            </button>
          )}
        </div>
        <div className="sidebar chat-pane">
          <div className="muted">Progress</div>
          <div className="bar">
            <span style={{ width: `${progress}%` }}></span>
          </div>
          <div className="muted">Overall: {progress}%</div>
          <div className="metric">
            <div className="muted">Tested</div>
            <div>
              {stats.correct} / {stats.total}
            </div>
            <div className="bar">
              <span style={{ width: `${stats.total ? (stats.correct / stats.total) * 100 : 0}%` }}></span>
            </div>
          </div>
          <div className="muted">Co-learning chat</div>
          <div className="chat-window">
            {chat.map((m, idx) => (
              <div key={idx} className={`chat-bubble ${m.role}`}>
                <div className="muted">{m.role}</div>
                <div>{m.text}</div>
              </div>
            ))}
          </div>
          {phase === "learn" && (
            <>
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                className="answer-box"
                rows={3}
                placeholder="Your thoughts or questions..."
              />
              <button onClick={handleNext} disabled={loading}>
                Respond & Next
              </button>
            </>
          )}
          <div className="muted small">
            - Select text in the learning card and click “Ask about selection.”<br />
            - AI will guide you with hints; keep responding to progress.
          </div>
        </div>
      </div>
    </div>
  );
}

export default ImmersivePage;
