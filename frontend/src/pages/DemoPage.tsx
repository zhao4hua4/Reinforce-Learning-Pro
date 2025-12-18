import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { askLLM } from "../api";

type DemoQuestion = {
  id: string;
  card_type: "single_choice" | "multiple_choice" | "short_answer";
  question: string;
  options?: string[];
  answer: string;
  hint: string;
  forceWrong?: boolean;
};

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

const learningCard = {
  title: "Immersive: Innateness and Universal Grammar (Section 5.2)",
  text: `Universal grammar posits that humans are born with grammatical constraints that guide language acquisition. Children learn rapidly despite sparse and noisy input (poverty of the stimulus), leading innateness advocates to argue for built-in biases. Critical periods and specific language impairments are cited as evidence for biological underpinnings. Usage-based and statistical learning views counter that children can extract constructions from distributional patterns without a rich innate grammar. Cross-linguistic universals may reflect innate constraints, communicative pressures, or historical convergence rather than hard-wired blueprints.`,
  example: "Deaf children of hearing parents create systematic sign systems even with limited input, suggesting generalisation beyond provided examples.",
  prompts: [
    "What evidence would convince you that grammar learning needs more than general pattern discovery?",
    "How might usage-based learning explain rapid acquisition without an elaborate innate grammar?",
  ],
};

const baseQuestions: DemoQuestion[] = [
  {
    id: "demo_q1",
    card_type: "multiple_choice",
    question: "What is the core claim of the poverty-of-the-stimulus argument?",
    options: [
      "Children fully learn grammar from explicit instruction",
      "Input is too sparse/noisy to explain rapid grammar learning without innate constraints",
      "Statistical learning alone instantly yields adult grammar",
      "Adults relearn grammar each generation",
    ],
    answer: "Input is too sparse/noisy to explain rapid grammar learning without innate constraints",
    hint: "Focus on why input alone might be insufficient.",
  },
  {
    id: "demo_q2",
    card_type: "short_answer",
    question: "Give one piece of evidence often cited for language-specific biological mechanisms.",
    answer: "Critical period effects or specific language impairments that selectively affect grammar.",
    hint: "Think about timing or selective deficits.",
    forceWrong: true,
  },
  {
    id: "demo_q3",
    card_type: "single_choice",
    question: "Which view emphasises extracting constructions from distributional patterns without positing rich innate grammar?",
    options: ["Usage-based/statistical learning", "Strong UG-only view", "Pure behaviourism", "Motor theory"],
    answer: "Usage-based/statistical learning",
    hint: "Pick the pattern-based account.",
  },
];

function DemoPage() {
  const navigate = useNavigate();
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
  const [language, setLanguage] = useState<string>(() => localStorage.getItem("demo_language") || "English");
  const [translating, setTranslating] = useState(false);
  const [model, setModel] = useState<string>(() => {
    const saved = localStorage.getItem("demo_model") || "";
    const allowed = new Set(modelOptions.map((o) => o.value));
    return allowed.has(saved) ? saved : "qwen2.5-1.5b-cpu";
  });
  const [adhocQuestions, setAdhocQuestions] = useState<DemoQuestion[]>([]);
  const [adhocIndex, setAdhocIndex] = useState(0);
  const [loopComplete, setLoopComplete] = useState<boolean>(() => localStorage.getItem("demo_complete") === "true");
  const [missedMain, setMissedMain] = useState(false);
  const [missedQuestions, setMissedQuestions] = useState<{ question: DemoQuestion; userAnswer: string }[]>([]);
  const [translatedQuestions, setTranslatedQuestions] = useState<DemoQuestion[] | null>(null);
  const [translatedCard, setTranslatedCard] = useState<typeof learningCard | null>(null);
  const isRTL = language === "Uyghur";
  const [uiText, setUiText] = useState<Record<string, string>>({
    heading: "Immersive: Universal Grammar (5.2)",
    loopLabel: "Learn - Test - Reinforce loop with minimal controls.",
    learningNote: "Learning Note",
    yourReflection: "Your reflection",
    respond: "Respond & Next",
    reflectionPlaceholder: "Share a thought or question, then click Respond & Next",
    testLabel: "Test",
    submit: "Submit",
    reinforce: "Reinforce testing *",
    followUp: "Submit follow-up",
    loopComplete: "Loop complete",
    restart: "Restart Loop",
    continueFlipped: "Continue to Flipped Classroom",
    chatTitle: "Co-learning chat",
    askSelection: "Ask about selection",
    chatSend: "Send",
    chatSendIng: "Sending...",
    chatPlaceholder: "Ask the tutor anything about UG... then click Send",
    reflectionTip: "Tip: add a reflection and click Respond to unlock the test phase.",
    answerHidden: "Answers are hidden; you will only see correct/incorrect and hints.",
    chatTip:
      '- Highlight a sentence in the learning note and click "Ask about selection."\n- Use this chat anytime to keep the co-learning dialogue going (does not gate progress).',
  });

  const langPrefix = language === "English" ? "" : `Please reply in ${language}.\n`;
  const materialLanguage = "English";
  const testSet = language === materialLanguage ? baseQuestions : translatedQuestions || baseQuestions;
  const testQ = testSet[testIndex];

  const formatHistory = (turns: { role: string; text: string }[], limit = 4) =>
    turns
      .slice(-limit)
      .map((t) => `${t.role.toUpperCase()}: ${t.text}`)
      .join("\n");

  const cleanLLM = (text: string) => {
    const cleaned = text.replace(/you are a co-?learning tutor[^.]*\.?/gi, "").trim();
    return cleaned || "How does this fit the main idea? What evidence would you add?";
  };

  const progress = useMemo(() => {
    if (phase === "learn") return Math.min(60, learnTurns * 20);
    if (phase === "test") return 60 + Math.round(((testIndex + 1) / testSet.length) * 20);
    if (phase === "reinforce") return 80 + Math.round(((adhocIndex + 1) / Math.max(adhocQuestions.length, 1)) * 20);
    return 100;
  }, [phase, learnTurns, testIndex, testSet.length, adhocIndex, adhocQuestions.length]);

  const translateSentences = async (text: string) => {
    const sentences =
      text
        .split(/(?<=[.!?。！？])\s+/u)
        .map((s) => s.trim())
        .filter(Boolean) || [text];
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

  const translateAllContent = async () => {
    if (language === materialLanguage) {
      setTranslatedCard(null);
      setTranslatedQuestions(null);
      return;
    }
    setTranslating(true);
    try {
      const title = await askLLM(`${langPrefix}Translate this title into ${language}: ${learningCard.title}`, {
        max_new_tokens: 120,
        temperature: 0.2,
        model,
      });
      const text = await translateSentences(learningCard.text);
      const example = await askLLM(`${langPrefix}Translate this example into ${language}: ${learningCard.example}`, {
        max_new_tokens: 120,
        temperature: 0.2,
        model,
      });
      const prompts: string[] = [];
      for (const p of learningCard.prompts) {
        const resp = await askLLM(`${langPrefix}Translate this prompt into ${language}: ${p}`, {
          max_new_tokens: 120,
          temperature: 0.2,
          model,
        });
        prompts.push(resp.trim());
      }
      setTranslatedCard({ title: title.trim(), text, example: example.trim(), prompts });

      const translatedQs: DemoQuestion[] = [];
      for (const q of baseQuestions) {
        const tq: DemoQuestion = { ...q };
        tq.question = (
          await askLLM(`${langPrefix}Translate this question into ${language}: ${q.question}`, {
            max_new_tokens: 160,
            temperature: 0.2,
            model,
          })
        ).trim();
        if (q.options && q.options.length) {
          const opts: string[] = [];
          for (const opt of q.options) {
            const o = await askLLM(`${langPrefix}Translate this option into ${language}: ${opt}`, {
              max_new_tokens: 80,
              temperature: 0.2,
              model,
            });
            opts.push(o.trim());
          }
          tq.options = opts;
          const translatedAnswer = await askLLM(`${langPrefix}Translate this answer into ${language}: ${q.answer}`, {
            max_new_tokens: 100,
            temperature: 0.2,
            model,
          });
          tq.answer = translatedAnswer.trim();
        } else {
          const ans = await askLLM(`${langPrefix}Translate this answer into ${language}: ${q.answer}`, {
            max_new_tokens: 140,
            temperature: 0.2,
            model,
          });
          tq.answer = ans.trim();
        }
        const hint = await askLLM(`${langPrefix}Translate this hint into ${language}: ${q.hint}`, {
          max_new_tokens: 120,
          temperature: 0.2,
          model,
        });
        tq.hint = hint.trim();
        translatedQs.push(tq);
      }
      setTranslatedQuestions(translatedQs);
    } catch {
      /* ignore translate errors */
    } finally {
      setTranslating(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        setLlmLoading(true);
        const resp = await askLLM(
          `${langPrefix}You are a co-learning tutor. Recent context:\n${formatHistory(chat)}\nStart by addressing the learner as "you" with one engaging question about universal grammar and poverty of the stimulus. Keep it 2 sentences and end with a question.`,
          { max_new_tokens: 120, temperature: 0.25, model }
        );
        setChat([{ role: "llm", text: cleanLLM(resp) }]);
      } catch {
        setChat([{ role: "llm", text: "Think about why sparse input might still lead you to full grammar. What do you think?" }]);
      } finally {
        setLlmLoading(false);
      }
    })();
  }, [model, language]);

  useEffect(() => {
    const translateUI = async () => {
      if (language === "English") {
        setUiText({
          heading: "Immersive: Universal Grammar (5.2)",
          loopLabel: "Learn - Test - Reinforce loop with minimal controls.",
          learningNote: "Learning Note",
          yourReflection: "Your reflection",
          respond: "Respond & Next",
          reflectionPlaceholder: "Share a thought or question, then click Respond & Next",
          testLabel: "Test",
          submit: "Submit",
          reinforce: "Reinforce testing *",
          followUp: "Submit follow-up",
          loopComplete: "Loop complete",
          restart: "Restart Loop",
          continueFlipped: "Continue to Flipped Classroom",
          chatTitle: "Co-learning chat",
          askSelection: "Ask about selection",
          chatSend: "Send",
          chatSendIng: "Sending...",
          chatPlaceholder: "Ask the tutor anything about UG... then click Send",
          reflectionTip: "Tip: add a reflection and click Respond to unlock the test phase.",
          answerHidden: "Answers are hidden; you will only see correct/incorrect and hints.",
          chatTip:
            '- Highlight a sentence in the learning note and click "Ask about selection."\n- Use this chat anytime to keep the co-learning dialogue going (does not gate progress).',
        });
        return;
      }
      try {
        const labels = [
          "Immersive: Universal Grammar (5.2)",
          "Learn - Test - Reinforce loop with minimal controls.",
          "Learning Note",
          "Your reflection",
          "Respond & Next",
          "Test",
          "Submit",
          "Reinforce testing *",
          "Submit follow-up",
          "Loop complete",
          "Restart Loop",
          "Continue to Flipped Classroom",
          "Co-learning chat",
          "Ask about selection",
          "Send",
          "Sending...",
          "Ask the tutor anything about UG... then click Send",
          "Share a thought or question, then click Respond & Next",
          "Tip: add a reflection and click Respond to unlock the test phase.",
          "Answers are hidden; you will only see correct/incorrect and hints.",
          '- Highlight a sentence in the learning note and click "Ask about selection." - Use this chat anytime to keep the co-learning dialogue going (does not gate progress).',
        ];
        const translated: string[] = [];
        for (const label of labels) {
          const resp = await askLLM(`${langPrefix}Translate this UI label concisely into ${language}: ${label}`, {
            max_new_tokens: 80,
            temperature: 0.1,
            model,
          });
          translated.push(resp.trim());
        }
        setUiText({
          heading: translated[0] || labels[0],
          loopLabel: translated[1] || labels[1],
          learningNote: translated[2] || labels[2],
          yourReflection: translated[3] || labels[3],
          respond: translated[4] || labels[4],
          testLabel: translated[5] || labels[5],
          submit: translated[6] || labels[6],
          reinforce: translated[7] || labels[7],
          followUp: translated[8] || labels[8],
          loopComplete: translated[9] || labels[9],
          restart: translated[10] || labels[10],
          continueFlipped: translated[11] || labels[11],
          chatTitle: translated[12] || labels[12],
          askSelection: translated[13] || labels[13],
          chatSend: translated[14] || labels[14],
          chatSendIng: translated[15] || labels[15],
          chatPlaceholder: translated[16] || labels[16],
          reflectionPlaceholder: translated[17] || labels[17],
          reflectionTip: translated[18] || labels[18],
          answerHidden: translated[19] || labels[19],
          chatTip: translated[20] || labels[20],
        });
      } catch {
        // keep existing UI text
      }
    };
    translateUI();
    translateAllContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const handleAskSelection = async () => {
    const content = window.getSelection()?.toString().trim() || learningCard.text;
    try {
      setLlmLoading(true);
      const resp = await askLLM(
        `${langPrefix}You are a co-learning tutor. Keep context scoped to this learner only.\nRecent turns:\n${formatHistory(chat)}\nThe learner selected this text:\n${content}\nExplain in second person, invite self-evaluation, and ask one probing question that connects or extends beyond the snippet (but stay grounded). Keep the reply to 2-3 sentences in one short paragraph.`,
        { max_new_tokens: 200, temperature: 0.25, model }
      );
      setChat((c) => [
        ...c,
        { role: "llm", text: cleanLLM(resp) },
        { role: "llm", text: "What do you think? How would you apply this in your own language or context?" },
      ]);
    } catch {
      setChat((c) => [...c, { role: "llm", text: "How does this piece fit the main idea? What evidence would you add?" }]);
    } finally {
      setLlmLoading(false);
    }
  };

  const handleNext = async () => {
    if (phase === "learn") {
      const content = window.getSelection()?.toString().trim() || userInput || learningCard.text;
      setLoading(true);
      setLlmLoading(true);
      try {
        const resp = await askLLM(
          `${langPrefix}You are a co-learning tutor. Keep memory only for this learner.\nRecent turns:\n${formatHistory(chat)}\nThe learner responded. In second person, acknowledge briefly, invite them to check alignment with the main idea, and ask one question to connect or extend (stay grounded in the snippet).\nText:\n${content}`,
          { max_new_tokens: 200, temperature: 0.25, model }
        );
        setChat((c) => [...c, { role: "user", text: userInput || "(no input)" }, { role: "llm", text: cleanLLM(resp) }]);
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
      localStorage.removeItem("demo_complete");
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
    if (language === materialLanguage) {
      setResult(baseResult);
    } else {
      try {
        const translatedResult = await askLLM(`${langPrefix}Translate this result into ${language}:\n${baseResult}`, {
          max_new_tokens: 100,
          temperature: 0.2,
          model,
        });
        setResult(translatedResult.trim());
      } catch {
        setResult(baseResult);
      }
    }
    let updatedMisses = missedQuestions;
    if (!correct) {
      setMissedMain(true);
      updatedMisses = [...missedQuestions, { question: testQ, userAnswer: userEntry }];
      setMissedQuestions(updatedMisses);
    }
    try {
      setLlmLoading(true);
      const follow = await askLLM(
        `${langPrefix}Coach the learner step by step, addressing them as "you". Keep thread-specific context only.\nRecent turns:\n${formatHistory(chat)}\nGive one brief encouragement, one hint toward the correct idea (without giving it fully), and one probing question.\nQuestion: ${testQ.question}\nExpected: ${testQ.answer}\nUser answer: ${userEntry}\nResult: ${correct ? "correct" : "incorrect"}.`,
        { max_new_tokens: 180, temperature: 0.2, model }
      );
      setChat((c) => [...c, { role: "user", text: `${testQ.question} :: ${userEntry}` }, { role: "llm", text: cleanLLM(follow) }]);
    } catch {
      setChat((c) => [...c, { role: "llm", text: `Hint: ${testQ.hint}` }]);
    } finally {
      setLlmLoading(false);
    }
    const nextIndex = testIndex + 1;
    if (nextIndex < testSet.length) {
      setTestIndex(nextIndex);
      setUserAnswer("");
    } else {
      if (missedMain || !correct || updatedMisses.length > 0) {
        await generateAdhocQuestionsV2(updatedMisses);
        setPhase("reinforce");
        setAdhocIndex(0);
        setUserAnswer("");
      } else {
        setPhase("done");
        setLoopComplete(true);
        localStorage.setItem("demo_complete", "true");
      }
    }
  };
  // New: per-missed-question generation (choice per missed item + one short answer)
  const generateAdhocQuestionsV2 = async (missedList?: { question: DemoQuestion; userAnswer: string }[]) => {
    const missed = missedList && missedList.length ? missedList : missedQuestions;
    const contextBase = missed
      .map((m, idx) => `Q${idx + 1}: ${m.question.question} | Expected: ${m.question.answer} | User: ${m.userAnswer}`)
      .join("\n");

    const buildFallback = () => {
      setAdhocQuestions([
        {
          id: "adhoc_choice_1",
          card_type: "single_choice",
          question: "Which scenario best illustrates poverty-of-the-stimulus?",
          options: [
            "Child learns grammar despite limited examples",
            "Adult relearns vocabulary",
            "Child memorises times tables",
            "Teacher drills irregular verbs only",
          ],
          answer: "Child learns grammar despite limited examples",
          hint: "Sparse input but rich grammar outcome.",
        },
        {
          id: "adhoc_short_1",
          card_type: "short_answer",
          question: "Give a real-life example from your language where children generalise beyond input.",
          answer: "Children form novel sentences not heard before.",
          hint: "Think of novel sentence creation.",
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
          `${langPrefix}Generate 1 short_answer follow-up question in ${language} based on these missed items.\nContext:\n${contextBase}\nDo not repeat or translate the original questions; create a new question on the same knowledge point.\nReturn JSON object: {id, card_type=\"short_answer\", question, answer}. No hint. Return only JSON.`,
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
            question: "Provide a new example illustrating the same point.",
            answer: "Example here.",
            hint: "Ground it in the missed concept.",
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

  const handleAdhocSubmit = () => {
    const q = adhocQuestions[adhocIndex];
    setChat((c) => [
      ...c,
      { role: "user", text: `Follow-up: ${q.question} :: ${userAnswer || "(no input)"}` },
      { role: "llm", text: cleanLLM(q.hint) },
    ]);
    setUserAnswer("");
    const next = adhocIndex + 1;
    if (next < adhocQuestions.length) {
      setAdhocIndex(next);
    } else {
      setPhase("done");
      setLoopComplete(true);
      localStorage.setItem("demo_complete", "true");
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

  const handleChatSend = async () => {
    if (!chatInput.trim()) return;
    setLlmLoading(true);
    try {
      const resp = await askLLM(
        `${langPrefix}You are a co-learning tutor. Keep memory scoped to this learner only.\nRecent turns:\n${formatHistory(chat)}\nThe learner asks:\n${chatInput}\nReply in second person, invite them to check alignment with the learning note on UG, and ask one probing question. Keep it to 2 sentences.`,
        { max_new_tokens: 200, temperature: 0.25, model }
      );
      setChat((c) => [...c, { role: "user", text: chatInput }, { role: "llm", text: cleanLLM(resp) }]);
    } catch {
      setChat((c) => [...c, { role: "llm", text: "Consider how your question ties to UG and poverty-of-the-stimulus. What evidence would you add?" }]);
    } finally {
      setChatInput("");
      setLlmLoading(false);
    }
  };

  const cardDisplay = translatedCard && language !== materialLanguage ? translatedCard : learningCard;

  return (
    <div className="panel immersive" dir={isRTL ? "rtl" : "ltr"}>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }}></div>
        <div className="progress-label">
          Progress: {progress}% {llmLoading ? "(LLM thinking...)" : ""}
        </div>
      </div>
      <h2>{uiText.heading}</h2>
      <div className="muted">
        {uiText.loopLabel} Model:
        <select
          value={model}
          onChange={(e) => {
            const val = e.target.value;
            setModel(val);
            localStorage.setItem("demo_model", val);
          }}
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
          <option value="Chinese">中文</option>
          <option value="Tibetan">藏语</option>
          <option value="Uyghur">维吾尔语</option>
          <option value="Korean">朝鲜语</option>
          <option value="French">French</option>
          <option value="German">German</option>
          <option value="Spanish">Spanish</option>
        </select>
        <button onClick={translateAllContent} disabled={translating || llmLoading} style={{ marginLeft: 8 }}>
          {translating ? "Translating..." : "Translate all"}
        </button>
      </div>

      <div className="panel-body immersive-body">
        <div className="main-column">
          <div className="card-item">
            <div className="muted">{uiText.learningNote}</div>
            <div className="learning-card-block">
              <div className="learning-card-text">
                <strong>{cardDisplay.title}</strong>
                <br />
                {cardDisplay.text}
                <br />
                <em>Example:</em> {cardDisplay.example}
                <br />
                <em>Reflect:</em> {cardDisplay.prompts.join(" | ")}
              </div>
              <div className="learning-actions">
                <button onClick={handleAskSelection} disabled={loading || llmLoading}>
                  {llmLoading ? "Asking..." : uiText.askSelection}
                </button>
              </div>
            </div>
          </div>

          {phase === "learn" && (
            <div className="card-item">
              <div className="muted">{uiText.yourReflection}</div>
                <textarea
                  className="answer-box"
                  rows={3}
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder={uiText.reflectionPlaceholder}
                />
              <button onClick={handleNext} disabled={loading || llmLoading}>
                {llmLoading ? "Waiting..." : uiText.respond}
              </button>
              <div className="muted small">{uiText.reflectionTip}</div>
            </div>
          )}

          {phase === "test" && testQ && (
            <div className="card-item">
              <div className="muted">{uiText.testLabel}</div>
              <div className="question">{testQ.question}</div>
              {renderTestInput(testQ)}
              <button onClick={handleSubmit} disabled={loading || llmLoading}>
                {llmLoading ? "Grading..." : uiText.submit}
              </button>
              <div className="muted">
                Question {testIndex + 1} of {testSet.length}
              </div>
              <div className="muted small">{uiText.answerHidden}</div>
            </div>
          )}

          {phase === "reinforce" && adhocQuestions.length > 0 && (
            <div className="card-item">
              <div className="muted">{uiText.reinforce}</div>
              <div className="question">{adhocQuestions[adhocIndex].question}</div>
              {renderTestInput(adhocQuestions[adhocIndex])}
              <button onClick={handleAdhocSubmit} disabled={llmLoading}>
                {uiText.followUp}
              </button>
              <div className="muted">
                Follow-up {adhocIndex + 1} of {adhocQuestions.length}
              </div>
            </div>
          )}

          {phase === "done" && (
            <div className="card-item">
              <div className="muted">{uiText.loopComplete}</div>
              <div className="actions">
                <button onClick={handleNext}>{uiText.restart}</button>
                <button onClick={() => navigate("/demo/flipped")} disabled={!loopComplete}>
                  {uiText.continueFlipped}
                </button>
              </div>
            </div>
          )}

          {result && <pre className="status">{result}</pre>}
        </div>

        <div className="sidebar chat-pane">
          <div className="muted">{uiText.coLearningChat}</div>
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
            placeholder={uiText.chatPlaceholder}
          />
          <button onClick={handleChatSend} disabled={llmLoading}>
            {llmLoading ? uiText.chatSendIng : uiText.chatSend}
          </button>
          <div className="muted small">{uiText.chatTip}</div>
        </div>
      </div>
    </div>
  );
}

export default DemoPage;



