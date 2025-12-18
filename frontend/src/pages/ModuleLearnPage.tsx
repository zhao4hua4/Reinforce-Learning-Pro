import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { askLLM, fetchModule, type Module } from "../api";

type DemoQuestion = Module["questions"][number];

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

function ModuleLearnPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [module, setModule] = useState<Module | null>(null);
  const [chat, setChat] = useState<{ role: "user" | "llm"; text: string }[]>([]);
  const [userInput, setUserInput] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [userAnswer, setUserAnswer] = useState("");
  const [result, setResult] = useState("");
  const [phase, setPhase] = useState<"learn" | "test" | "reinforce" | "done">("learn");
  const [learnTurns, setLearnTurns] = useState(0);
  const [testIndex, setTestIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [llmLoading, setLlmLoading] = useState(false);
  const [model, setModel] = useState<string>(() => {
    const saved = localStorage.getItem("demo_model") || "";
    const allowed = new Set(modelOptions.map((o) => o.value));
    return allowed.has(saved) ? saved : "qwen2.5-1.5b-cpu";
  });
  const [adhocQuestions, setAdhocQuestions] = useState<DemoQuestion[]>([]);
  const [adhocIndex, setAdhocIndex] = useState(0);
  const [loopComplete, setLoopComplete] = useState(false);
  const [missedMain, setMissedMain] = useState(false);
  const [missedQuestions, setMissedQuestions] = useState<{ question: DemoQuestion; userAnswer: string }[]>([]);
  const [language, setLanguage] = useState<string>(() => localStorage.getItem("demo_language") || "English");
  const [translation, setTranslation] = useState<string>("");
  const [translating, setTranslating] = useState(false);
  const isRTL = language === "Uyghur";
  const langPrefix = language === "English" ? "" : `Please reply in ${language}.\n`;
  const testSet = module?.questions || [];
  const testQ = testSet[testIndex];

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const m = await fetchModule(id);
      setModule(m);
      await translateAllContent(m);
    };
    load();
  }, [id, language, langPrefix, model]);

  const translateSentences = async (text: string) => {
    const sentences = text.split(/(?<=[?????!?])/).map((s) => s.trim()).filter(Boolean);
    const outputs: string[] = [];
    for (const sentence of sentences) {
      const resp = await askLLM(
        `${langPrefix}Translate this sentence into ${language}. Keep meaning and tone; no added explanations.\nSentence: ${sentence}`,
        { max_new_tokens: 200, temperature: 0.2, model }
      );
      outputs.push(resp.trim());
    }
    return outputs.join(" ");
  };

  const translateAllContent = async (m?: Module | null) => {
    const mod = m || module;
    if (!mod) return;
    if (language === mod.language) {
      setTranslation("");
      return;
    }
    setTranslating(true);
    try {
      const note = await translateSentences(mod.learning_note);
      setTranslation(note);
    } catch {
      setTranslation("");
    } finally {
      setTranslating(false);
    }
  };

  const progress = useMemo(() => {
    if (phase === "learn") return Math.min(60, learnTurns * 20);
    if (phase === "test") return 60 + Math.round(((testIndex + 1) / Math.max(testSet.length, 1)) * 20);
    if (phase === "reinforce") return 80 + Math.round(((adhocIndex + 1) / Math.max(adhocQuestions.length, 1)) * 20);
    return 100;
  }, [phase, learnTurns, testIndex, testSet.length, adhocIndex, adhocQuestions.length]);

  useEffect(() => {
    if (!module) return;
    (async () => {
      try {
        setLlmLoading(true);
        const resp = await askLLM(
          `${langPrefix}You are a co-learning tutor. Start with one engaging question about the module topic. Keep it 2 sentences and end with a question.`,
          { max_new_tokens: 120, temperature: 0.25, model }
        );
        setChat([{ role: "llm", text: resp.trim() }]);
      } catch {
        setChat([{ role: "llm", text: "Think about the main idea. What do you think?" }]);
      } finally {
        setLlmLoading(false);
      }
    })();
  }, [module, langPrefix, model, language]);

  const handleAskSelection = async () => {
    const content = window.getSelection()?.toString().trim() || module?.learning_note || "";
    try {
      setLlmLoading(true);
      const resp = await askLLM(
        `${langPrefix}You are a co-learning tutor. The learner selected this text:\n${content}\nExplain in second person, invite self-evaluation, and ask one probing question that connects or extends beyond the snippet (but stay grounded). Keep the reply to 2-3 sentences in one short paragraph.`,
        { max_new_tokens: 200, temperature: 0.25, model }
      );
      setChat((c) => [
        ...c,
        { role: "llm", text: resp.trim() },
        { role: "llm", text: "What do you think? How would you apply this?" },
      ]);
    } catch {
      setChat((c) => [...c, { role: "llm", text: "How does this fit the main idea? What evidence would you add?" }]);
    } finally {
      setLlmLoading(false);
    }
  };

  const handleNext = async () => {
    if (phase === "learn") {
      const content = window.getSelection()?.toString().trim() || userInput || module?.learning_note || "";
      setLoading(true);
      setLlmLoading(true);
      try {
        const resp = await askLLM(
          `${langPrefix}You are a co-learning tutor. The learner responded. In second person, acknowledge briefly, invite them to check alignment with the main idea, and ask one question to connect or extend (stay grounded in the snippet).\nText:\n${content}`,
          { max_new_tokens: 200, temperature: 0.25, model }
        );
        setChat((c) => [...c, { role: "user", text: userInput || "(no input)" }, { role: "llm", text: resp.trim() }]);
      } catch {
        setChat((c) => [...c, { role: "llm", text: "Does your view fit the main point? How would you extend it?" }]);
      } finally {
        setLoading(false);
        setLlmLoading(false);
      }
      setUserInput("");
      const turns = learnTurns + 1;
      setLearnTurns(turns);
      if (turns >= 2) {
        setPhase("test");
        setTestIndex(0);
        setResult("");
        setUserAnswer("");
        setMissedMain(false);
        setMissedQuestions([]);
      }
    } else if (phase === "done") {
      setPhase("learn");
      setLearnTurns(0);
      setTestIndex(0);
      setResult("");
      setUserAnswer("");
      setChat((c) => [...c, { role: "llm", text: "Restarting the loop. What stands out to you now?" }]);
      setLoopComplete(false);
      setMissedMain(false);
      setAdhocQuestions([]);
      setAdhocIndex(0);
      setMissedQuestions([]);
    }
  };

  const handleSubmit = async () => {
    if (!testQ) return;
    const userEntry = testQ.forceWrong ? "wrong answer" : userAnswer;
    const correct =
      testQ.card_type === "multiple_choice" || testQ.card_type === "single_choice"
        ? userEntry.trim() === testQ.answer
        : userEntry.toLowerCase().includes(testQ.answer.toLowerCase().split(" ")[0]);
    const baseResult = `Your answer: ${userEntry} ??${correct ? "correct" : "incorrect"}`;
    setResult(baseResult);
    let updatedMisses = missedQuestions;
    if (!correct) {
      setMissedMain(true);
      updatedMisses = [...missedQuestions, { question: testQ, userAnswer: userEntry }];
      setMissedQuestions(updatedMisses);
    }
    try {
      setLlmLoading(true);
      const follow = await askLLM(
        `${langPrefix}Coach the learner step by step, addressing them as "you". Give one brief encouragement, one hint toward the correct idea (without giving it fully), and one probing question.\nQuestion: ${testQ.question}\nExpected: ${testQ.answer}\nUser answer: ${userEntry}\nResult: ${correct ? "correct" : "incorrect"}.`,
        { max_new_tokens: 180, temperature: 0.2, model }
      );
      setChat((c) => [...c, { role: "user", text: `${testQ.question} :: ${userEntry}` }, { role: "llm", text: follow.trim() }]);
    } catch {
      setChat((c) => [...c, { role: "llm", text: `Hint: ${testQ.hint || ""}` }]);
    } finally {
      setLlmLoading(false);
    }
    const nextIndex = testIndex + 1;
    if (nextIndex < testSet.length) {
      setTestIndex(nextIndex);
      setUserAnswer("");
    } else {
      if (missedMain || !correct || updatedMisses.length > 0) {
        await generateAdhocQuestions(updatedMisses);
        setPhase("reinforce");
        setAdhocIndex(0);
        setUserAnswer("");
      } else {
        setPhase("done");
        setLoopComplete(true);
      }
    }
  };

  const generateAdhocQuestions = async (missedList?: { question: DemoQuestion; userAnswer: string }[]) => {
    const missed = missedList && missedList.length ? missedList : missedQuestions;
    const contextBase = missed
      .map((m, idx) => `Q${idx + 1}: ${m.question.question} | Expected: ${m.question.answer} | User: ${m.userAnswer}`)
      .join("\n");

    const buildFallback = () => {
      setAdhocQuestions([
        {
          id: "adhoc_choice_1",
          card_type: "single_choice",
          question: "Which scenario best illustrates the main point?",
          options: ["Option A", "Option B", "Option C", "Option D"],
          answer: "Option A",
          hint: "Think about the core claim.",
        },
        {
          id: "adhoc_short_1",
          card_type: "short_answer",
          question: "Give a real-life example supporting the idea.",
          answer: "Example here.",
          hint: "Keep it concise.",
        },
      ]);
    };

    try {
      setLlmLoading(true);
      const choiceQuestions: DemoQuestion[] = [];
      for (const [idx, miss] of missed.entries()) {
        try {
          const resp = await askLLM(
            `${langPrefix}Generate 1 follow-up choice question in ${language} for this missed item.\nDo not translate or repeat the original question; create a new question on the same knowledge point.\nQuestion: ${miss.question.question}\nExpected answer: ${miss.question.answer}\nUser answer: ${miss.userAnswer}\nReturn JSON array with one object: {id, card_type (single_choice or multiple_choice), question, options (4 strings), answer}. No hint. Return only JSON.`,
            { max_new_tokens: 400, temperature: 0.35, top_p: 0.9, model }
          );
          const parsed = JSON.parse(resp);
          const obj = Array.isArray(parsed) ? parsed[0] : parsed;
          if (obj && obj.question) {
            choiceQuestions.push({
              id: obj.id || `adhoc_choice_${idx + 1}`,
              card_type: (obj.card_type as any) || "single_choice",
              question: obj.question,
              options: obj.options || ["Option A", "Option B", "Option C", "Option D"],
              answer: obj.answer || "",
              hint: "",
            });
          }
        } catch {
          choiceQuestions.push({
            id: `adhoc_choice_${idx + 1}`,
            card_type: "single_choice",
            question: "Which statement best fits the idea?",
            options: ["Option A", "Option B", "Option C", "Option D"],
            answer: "Option A",
            hint: "Think about the core claim.",
          });
        }
      }

      let shortQuestions: DemoQuestion[] = [];
      try {
        const shortResp = await askLLM(
          `${langPrefix}Generate 1 short_answer follow-up question in ${language} based on these missed items.\nContext:\n${contextBase}\nDo not repeat or translate the original questions; create a new question on the same knowledge point.\nReturn JSON object: {id, card_type="short_answer", question, answer}. No hint. Return only JSON.`,
          { max_new_tokens: 400, temperature: 0.35, top_p: 0.9, model }
        );
        const parsed = JSON.parse(shortResp);
        const obj = Array.isArray(parsed) ? parsed[0] : parsed;
        if (obj && obj.question) {
          shortQuestions = [
            {
              id: obj.id || "adhoc_short_1",
              card_type: "short_answer",
              question: obj.question,
              answer: obj.answer || "",
              hint: "",
            },
          ];
        }
      } catch {
        shortQuestions = [
          {
            id: "adhoc_short_1",
            card_type: "short_answer",
            question: "Give a real-life example supporting the idea.",
            answer: "Example here.",
            hint: "Keep it concise.",
          },
        ];
      }

      if (!choiceQuestions.length && !shortQuestions.length) {
        buildFallback();
        return;
      }

      setAdhocQuestions([...choiceQuestions, ...shortQuestions]);
    } catch {
      buildFallback();
    } finally {
      setLlmLoading(false);
    }
  };

  const renderTestInput = (q: DemoQuestion) => {
    if (!q) return null;
    if (q.options && q.options.length > 0) {
      const isSingle = q.card_type === "single_choice";
      return (
        <div className="options">
          {q.options.map((opt) => (
            <label key={opt} className="chip">
              <input
                type={isSingle ? "radio" : "checkbox"}
                name={q.id}
                checked={userAnswer.split(";").includes(opt)}
                onChange={(e) => {
                  if (isSingle) {
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
      );
    }
    return (
      <textarea
        className="answer-box"
        rows={3}
        value={userAnswer}
        onChange={(e) => setUserAnswer(e.target.value)}
        placeholder="Type your answer"
      />
    );
  };

  const handleAdhocSubmit = () => {
    const q = adhocQuestions[adhocIndex];
    if (!q) return;
    const userEntry = userAnswer || "";
    const correct =
      q.card_type === "multiple_choice" || q.card_type === "single_choice"
        ? userEntry.trim() === (q.answer || "")
        : (q.answer || "").toLowerCase()
            .split(" ")
            .some((token) => token && userEntry.toLowerCase().includes(token));
    const feedback = correct ? "Correct!" : `Expected: ${q.answer}`;
    setChat((c) => [...c, { role: "user", text: `${q.question} :: ${userEntry}` }, { role: "llm", text: feedback }]);
    setUserAnswer("");
    const next = adhocIndex + 1;
    if (next < adhocQuestions.length) {
      setAdhocIndex(next);
    } else {
      setPhase("done");
      setLoopComplete(true);
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim()) return;
    setLlmLoading(true);
    try {
      const resp = await askLLM(
        `${langPrefix}You are a co-learning tutor. Keep memory scoped to this learner only.\nRecent turns:\n${chat
          .map((t) => `${t.role}: ${t.text}`)
          .join("\n")}\nLearner asks: ${chatInput}\nReply in second person with one brief insight and one probing question (2 sentences).`,
        { max_new_tokens: 200, temperature: 0.25, model }
      );
      setChat((c) => [...c, { role: "user", text: chatInput }, { role: "llm", text: resp.trim() }]);
    } catch {
      setChat((c) => [...c, { role: "llm", text: "Consider how this fits the main idea. What evidence would you add?" }]);
    } finally {
      setChatInput("");
      setLlmLoading(false);
    }
  };

  if (!module) {
    return (
      <div className="panel">
        <div className="status">Loading module...</div>
      </div>
    );
  }

  return (
    <div className="panel immersive" dir={isRTL ? "rtl" : "ltr"}>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }}></div>
        <div className="progress-label">
          Progress: {progress}% {llmLoading ? "(LLM thinking...)" : ""}
        </div>
      </div>
      <h2>{module.title}</h2>
      <div className="muted">
        Language: {language} | Model:
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
        <span style={{ marginLeft: 8 }}>UI/LLM Language:</span>
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
          <option value="Chinese">中文</option>
          <option value="Tibetan">藏语</option>
          <option value="Uyghur">维吾尔语</option>
          <option value="Korean">朝鲜语</option>
          <option value="French">French</option>
          <option value="German">German</option>
          <option value="Spanish">Spanish</option>
        </select>
        <button onClick={() => translateAllContent()} disabled={translating || llmLoading} style={{ marginLeft: 8 }}>
          {translating ? "Translating..." : "Translate all"}
        </button>
        <button onClick={() => navigate("/modules")} style={{ marginLeft: 8 }}>
          Back to modules
        </button>
      </div>
      <div className="panel-body immersive-body">
        <div className="main-column">
          <div className="card-item">
            <div className="muted">Learning Note</div>
            <div className="learning-card-block">
              <div className="learning-card-text">
                <strong>{module.title}</strong>
                <br />
                {translation || module.learning_note}
                <br />
                <em>Example:</em> {module.example}
                <br />
                <em>Reflect:</em> {(module.prompts || []).join(" | ")}
              </div>
              <div className="learning-actions">
                <button onClick={handleAskSelection} disabled={loading || llmLoading}>
                  {llmLoading ? "Asking..." : "Ask about selection"}
                </button>
              </div>
            </div>
          </div>

          {phase === "learn" && (
            <div className="card-item">
              <div className="muted">Your reflection</div>
              <textarea
                className="answer-box"
                rows={3}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Share a thought or question, then click Respond & Next"
              />
              <button onClick={handleNext} disabled={loading || llmLoading}>
                {llmLoading ? "Waiting..." : "Respond & Next"}
              </button>
            </div>
          )}

          {phase === "test" && testQ && (
            <div className="card-item">
              <div className="muted">Test</div>
              <div className="question">{testQ.question}</div>
              {renderTestInput(testQ)}
              <button onClick={handleSubmit} disabled={loading || llmLoading}>
                {llmLoading ? "Grading..." : "Submit"}
              </button>
              <div className="muted">
                Question {testIndex + 1} of {testSet.length}
              </div>
              <div className="muted small">Answers are hidden; you will only see correct/incorrect and hints.</div>
            </div>
          )}

          {phase === "reinforce" && adhocQuestions.length > 0 && (
            <div className="card-item">
              <div className="muted">Reinforce testing</div>
              <div className="question">{adhocQuestions[adhocIndex].question}</div>
              {renderTestInput(adhocQuestions[adhocIndex])}
              <button onClick={handleAdhocSubmit} disabled={llmLoading}>
                Submit follow-up
              </button>
              <div className="muted">
                Follow-up {adhocIndex + 1} of {adhocQuestions.length}
              </div>
            </div>
          )}

          {phase === "done" && (
            <div className="card-item">
              <div className="muted">Loop complete</div>
              <div className="actions">
                <button onClick={handleNext}>Restart Loop</button>
                <button onClick={() => navigate("/demo/flipped-multilingual")} disabled={!loopComplete}>
                  Continue to Flipped Classroom
                </button>
              </div>
            </div>
          )}

          {result && <pre className="status">{result}</pre>}
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
          <textarea
            className="answer-box"
            rows={3}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Ask the tutor anything... then click Send"
          />
          <button onClick={handleChatSend} disabled={llmLoading}>
            {llmLoading ? "Sending..." : "Send"}
          </button>
          <div className="muted small">
            - Highlight a sentence in the learning note and click "Ask about selection."
            <br />
            - Use this chat anytime to keep the co-learning dialogue going (does not gate progress).
          </div>
        </div>
      </div>
    </div>
  );
}

export default ModuleLearnPage;




