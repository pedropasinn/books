import { displayStreak, lastDays } from "../lib/habit";
import { useApp } from "../lib/store";

/** Hábito: streak, meta do dia, últimas duas semanas e os trechos salvos. */
export function Habito() {
  const { stats, streak, todayCount, settings, saved, toggleSaved } = useApp();

  const dias = lastDays(stats, 14);
  const pico = Math.max(settings.dailyGoal, ...dias.map((d) => d.fragments), 1);
  const total = stats.reduce((s, d) => s + d.fragments, 0);
  const atual = displayStreak(streak);

  return (
    <div className="scroller">
      <h1 className="h1">Hábito</h1>
      <p className="sub">
        A meta é pequena de propósito: {settings.dailyGoal} fragmentos por dia mantêm a sequência viva.
      </p>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat__value" style={{ color: atual > 0 ? "var(--brand)" : undefined }}>
            {atual}
          </div>
          <div className="stat__label">Sequência</div>
        </div>
        <div className="stat">
          <div className="stat__value">{streak.best}</div>
          <div className="stat__label">Recorde</div>
        </div>
        <div className="stat">
          <div className="stat__value">{total}</div>
          <div className="stat__label">Total</div>
        </div>
      </div>

      <div className="section">
        <div className="section__title">
          Hoje · {todayCount}/{settings.dailyGoal}
        </div>
        <div className="spark">
          {dias.map((d) => (
            <div key={d.day} className="spark__day" title={`${d.day}: ${d.fragments}`}>
              <div
                className={`spark__bar${d.fragments ? "" : " spark__bar--empty"}`}
                style={{ height: `${Math.max(4, (d.fragments / pico) * 100)}%` }}
              />
            </div>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 10.5,
            color: "var(--muted-dim)",
            marginTop: 6,
          }}
        >
          <span>14 dias atrás</span>
          <span>hoje</span>
        </div>
      </div>

      <div className="section">
        <div className="section__title">Trechos salvos · {saved.length}</div>
        {!saved.length && (
          <div className="empty">
            Toque no marcador durante a leitura para guardar um fragmento aqui.
          </div>
        )}
        {saved.map((s) => (
          <div key={s.id} className="tile">
            <div className="tile__quote">{s.text}</div>
            <div className="tile__top" style={{ marginTop: 10 }}>
              <span className="tile__meta">
                {s.bookTitle} · {s.chapterTitle}
              </span>
              <button
                className="tile__meta"
                style={{ color: "var(--muted)" }}
                onClick={() =>
                  toggleSaved({
                    bookSlug: s.bookSlug,
                    chapterNumber: s.chapterNumber,
                    chapterTitle: s.chapterTitle,
                    index: 0,
                    startWord: s.startWord,
                    endWord: s.startWord,
                    text: s.text,
                  })
                }
              >
                remover
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
