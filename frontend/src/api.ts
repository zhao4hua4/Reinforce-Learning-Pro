export type Card = {
  id: string;
  card_type: string;
  question: string;
  answer: string;
  options?: string[] | null;
  source_id?: string | null;
  source_page?: number | null;
  source_snippet?: string | null;
  metadata?: Record<string, unknown>;
};

export type Module = {
  id: string;
  title: string;
  language: string;
  learning_note: string;
  example?: string;
  prompts: string[];
  questions: {
    id: string;
    card_type: string;
    question: string;
    options?: string[] | null;
    answer: string;
    hint?: string;
    forceWrong?: boolean;
  }[];
  checklist: string[];
};

const API_BASE = "http://127.0.0.1:8000";

export async function askLLM(
  prompt: string,
  config?: { max_new_tokens?: number; temperature?: number; top_p?: number; model?: string }
): Promise<string> {
  const res = await fetch(`${API_BASE}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      max_new_tokens: config?.max_new_tokens ?? 256,
      temperature: config?.temperature ?? 0.1,
      top_p: config?.top_p ?? 0.9,
      model: config?.model,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.text;
}

export async function fetchCards(): Promise<Card[]> {
  const res = await fetch(`${API_BASE}/cards`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchPracticeNext(sections?: string[]): Promise<{ card: Card; weight: number }> {
  const res = await fetch(`${API_BASE}/practice/next`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sections }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function startSession(): Promise<{ session_id: string }> {
  const res = await fetch(`${API_BASE}/session/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function expandLearning(content: string, min_words = 150, max_words = 300): Promise<{ text: string }> {
  const res = await fetch(`${API_BASE}/expand`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, min_words, max_words }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchLearnCard(payload: {
  source_id?: string | null;
  card_question?: string | null;
  card_answer?: string | null;
  context?: string | null;
  min_words?: number;
  max_words?: number;
}): Promise<{ text: string; prompts: string[] }> {
  const res = await fetch(`${API_BASE}/learn_card`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchTestQuestions(payload: {
  content?: string | null;
  source_id?: string | null;
  question_count?: number;
}): Promise<{ questions: { card_type: string; question: string; answer: string; options?: string[] | null }[] }> {
  const res = await fetch(`${API_BASE}/generate_tests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function gradeAnswer(payload: {
  card_id: string;
  card_type: string;
  question: string;
  expected_answer: string;
  user_answer: string;
  options?: string[] | null;
  source_id?: string | null;
  source_page?: number | null;
  source_snippet?: string | null;
  metadata?: Record<string, unknown>;
  session_id?: string | null;
  use_llm?: boolean;
}): Promise<{ is_correct: boolean; score: number; details: Record<string, string> }> {
  const res = await fetch(`${API_BASE}/grade`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function liveQuestion(content: string, card_type: string, onChunk?: (chunk: string) => void) {
  const res = await fetch(`${API_BASE}/live_question`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, card_type, max_new_tokens: 256, temperature: 0.1, top_p: 0.9 }),
  });
  if (!res.ok) throw new Error(await res.text());
  if (res.body && onChunk) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      full += chunk;
      onChunk(chunk);
    }
    try {
      return JSON.parse(full);
    } catch {
      return { raw: full };
    }
  } else {
    const txt = await res.text();
    try {
      return JSON.parse(txt);
    } catch {
      return { raw: txt };
    }
  }
}

export async function exportCsv(): Promise<void> {
  const res = await fetch(`${API_BASE}/export/csv`);
  if (!res.ok) throw new Error(await res.text());
  const blob = await res.blob();
  downloadBlob(blob, "cards.csv");
}

export async function exportMd(): Promise<void> {
  const res = await fetch(`${API_BASE}/export/md`);
  if (!res.ok) throw new Error(await res.text());
  const blob = await res.blob();
  downloadBlob(blob, "cards.md");
}

export async function exportAnki(): Promise<void> {
  const res = await fetch(`${API_BASE}/export/anki`);
  if (!res.ok) throw new Error(await res.text());
  const blob = await res.blob();
  downloadBlob(blob, "cards_anki.txt");
}

export async function fetchModules(): Promise<Module[]> {
  const res = await fetch(`${API_BASE}/modules`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchModule(id: string): Promise<Module> {
  const res = await fetch(`${API_BASE}/modules/${id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteModule(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/modules/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
}

export async function generateModule(payload: { text: string; language?: string; model_name?: string }): Promise<{ module: Module }> {
  const res = await fetch(`${API_BASE}/modules/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
