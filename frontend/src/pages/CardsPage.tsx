import { useEffect, useState } from "react";
import type { Card } from "../api";
import { fetchCards } from "../api";

function CardsPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await fetchCards();
        setCards(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="panel">
      <h2>Cards (pre-generated)</h2>
      {loading && <div className="status">Loading...</div>}
      {error && <div className="status error">{error}</div>}
      <div className="list">
        {cards.map((c) => (
          <div className="card-item" key={c.id}>
            <div className="muted">{c.card_type}</div>
            <div className="question">{c.question}</div>
            {c.options && <div className="muted">Options: {c.options.join(" | ")}</div>}
            <div className="muted">Answer: {c.answer}</div>
            {c.source_page && <div className="muted">Page: {c.source_page}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default CardsPage;
