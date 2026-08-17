import { useState } from "react";
import { formatTime, isNative, scheduleReminders, scheduleTest } from "../lib/notifications";
import { useApp } from "../lib/store";
import { normalizeUrl, testConnection } from "../lib/sync";
import type { ReminderTime } from "../lib/types";

const ACCENTS = ["#2dd4bf", "#ef4444", "#38bdf8", "#a78bfa", "#fbbf24"];
const FONTES = [
  { v: "serif", label: "Serif" },
  { v: "sans", label: "Sans" },
  { v: "mono", label: "Mono" },
] as const;

export function Settings() {
  const { settings, setPref, upcomingTeasers } = useApp();
  const [url, setUrl] = useState(settings.serverUrl);
  const [token, setToken] = useState(settings.token);
  const [teste, setTeste] = useState<string | null>(null);
  const [novoHorario, setNovoHorario] = useState("08:00");

  const salvarServidor = async () => {
    setTeste("Testando…");
    const limpa = normalizeUrl(url);
    try {
      const n = await testConnection(limpa, token);
      setPref("serverUrl", limpa);
      setPref("token", token);
      setUrl(limpa);
      setTeste(`Conectado — ${n} livro${n === 1 ? "" : "s"} disponíveis.`);
    } catch (e) {
      setTeste(e instanceof Error ? e.message : "Falha na conexão.");
    }
  };

  /** (Re)agenda os lembretes com as prévias dos próximos fragmentos. */
  const reagendar = async (on: boolean, reminders: ReminderTime[]) => {
    if (!on) {
      await scheduleReminders([], []);
      return;
    }
    const ok = await scheduleReminders(reminders, upcomingTeasers(reminders.length));
    if (!ok && isNative()) setTeste("Permissão de notificação negada nas configurações do Android.");
  };

  const addHorario = () => {
    const [h, m] = novoHorario.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return;
    const existe = settings.reminders.some((r) => r.hour === h && r.minute === m);
    if (existe) return;
    const next = [...settings.reminders, { hour: h, minute: m }].sort(
      (a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute)
    );
    setPref("reminders", next);
    if (settings.notificationsOn) void reagendar(true, next);
  };

  const removeHorario = (r: ReminderTime) => {
    const next = settings.reminders.filter((x) => !(x.hour === r.hour && x.minute === r.minute));
    setPref("reminders", next);
    if (settings.notificationsOn) void reagendar(true, next);
  };

  return (
    <div className="scroller">
      <h1 className="h1">Ajustes</h1>
      <p className="sub">Leitura, lembretes e conexão com a sua biblioteca.</p>

      {/* ── Leitura ─────────────────────────────────────────────────────── */}
      <div className="section">
        <div className="section__title">Leitura</div>

        <div className="field">
          <label className="field__label">
            Tamanho do fragmento — {settings.fragmentSize} palavras (~
            {Math.max(5, Math.round(settings.fragmentSize / 3.5))}s de leitura)
          </label>
          <input
            className="range"
            type="range"
            min={25}
            max={120}
            step={5}
            value={settings.fragmentSize}
            onChange={(e) => setPref("fragmentSize", Number(e.target.value))}
          />
        </div>

        <div className="field">
          <label className="field__label">
            Tamanho do texto — {Math.round(settings.fontScale * 100)}%
          </label>
          <input
            className="range"
            type="range"
            min={0.8}
            max={1.6}
            step={0.05}
            value={settings.fontScale}
            onChange={(e) => setPref("fontScale", Number(e.target.value))}
          />
        </div>

        <div className="field">
          <label className="field__label">Fonte do fragmento</label>
          <div className="seg">
            {FONTES.map((f) => (
              <button
                key={f.v}
                className="seg__item"
                data-on={settings.font === f.v}
                onClick={() => setPref("font", f.v)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="field__label">Cor de destaque</label>
          <div className="swatches">
            {ACCENTS.map((c) => (
              <button
                key={c}
                className="swatch"
                data-on={settings.accent === c}
                style={{ background: c }}
                onClick={() => setPref("accent", c)}
                aria-label={`Cor ${c}`}
              />
            ))}
          </div>
        </div>

        <div className="row">
          <div>
            <div className="row__label">Vibrar ao passar</div>
            <div className="row__hint">Um toque curto a cada fragmento.</div>
          </div>
          <button
            className="switch"
            data-on={settings.haptics}
            onClick={() => setPref("haptics", !settings.haptics)}
            aria-label="Vibração"
          />
        </div>
      </div>

      {/* ── Leitura dinâmica ────────────────────────────────────────────── */}
      <div className="section">
        <div className="section__title">Leitura dinâmica (RSVP)</div>

        <div className="field">
          <label className="field__label">Velocidade — {settings.wpm} palavras/min</label>
          <input
            className="range"
            type="range"
            min={150}
            max={800}
            step={10}
            value={settings.wpm}
            onChange={(e) => setPref("wpm", Number(e.target.value))}
          />
        </div>

        <div className="field">
          <label className="field__label">Fonte do RSVP</label>
          <div className="seg">
            {FONTES.map((f) => (
              <button
                key={f.v}
                className="seg__item"
                data-on={settings.rsvpFont === f.v}
                onClick={() => setPref("rsvpFont", f.v)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="row">
          <div>
            <div className="row__label">Emendar no próximo</div>
            <div className="row__hint">
              Ao terminar o fragmento, avança sozinho e continua a leitura dinâmica.
            </div>
          </div>
          <button
            className="switch"
            data-on={settings.rsvpAutoNext}
            onClick={() => setPref("rsvpAutoNext", !settings.rsvpAutoNext)}
            aria-label="Emendar no próximo"
          />
        </div>
      </div>

      {/* ── Lembretes ───────────────────────────────────────────────────── */}
      <div className="section">
        <div className="section__title">Lembretes</div>

        <div className="row">
          <div>
            <div className="row__label">Cutucar para ler</div>
            <div className="row__hint">
              Notificação diária em cada horário abaixo, com o começo do próximo trecho.
            </div>
          </div>
          <button
            className="switch"
            data-on={settings.notificationsOn}
            onClick={async () => {
              const on = !settings.notificationsOn;
              setPref("notificationsOn", on);
              await reagendar(on, settings.reminders);
            }}
            aria-label="Lembretes"
          />
        </div>

        <div className="field" style={{ marginTop: 16 }}>
          <label className="field__label">Horários</label>
          <div className="chips">
            {settings.reminders.map((r) => (
              <button key={formatTime(r)} className="chip" data-on onClick={() => removeHorario(r)}>
                {formatTime(r)} ✕
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <input
              className="input"
              style={{ flex: 1 }}
              type="time"
              value={novoHorario}
              onChange={(e) => setNovoHorario(e.target.value)}
            />
            <button className="btn btn--sm" onClick={addHorario}>
              Adicionar
            </button>
          </div>
        </div>

        <div className="field">
          <label className="field__label">Meta diária — {settings.dailyGoal} fragmentos</label>
          <input
            className="range"
            type="range"
            min={3}
            max={40}
            step={1}
            value={settings.dailyGoal}
            onChange={(e) => setPref("dailyGoal", Number(e.target.value))}
          />
        </div>

        <button
          className="btn btn--ghost btn--sm"
          onClick={async () => {
            const ok = await scheduleTest(upcomingTeasers(1)[0] ?? "Um fragmento agora?");
            setTeste(
              ok
                ? "Notificação de teste chega em 5 segundos."
                : isNative()
                  ? "Permissão de notificação negada."
                  : "Notificações só funcionam no aplicativo Android."
            );
          }}
        >
          Testar notificação
        </button>
      </div>

      {/* ── Servidor ────────────────────────────────────────────────────── */}
      <div className="section">
        <div className="section__title">Sua biblioteca</div>

        <div className="field">
          <label className="field__label">Endereço do site</label>
          <input
            className="input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="meusite.vercel.app"
            autoCapitalize="off"
            autoCorrect="off"
            inputMode="url"
          />
        </div>

        <div className="field">
          <label className="field__label">Token de sincronização</label>
          <input
            className="input"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </div>

        <p className="row__hint" style={{ marginTop: -6, marginBottom: 16 }}>
          É o <code>MOBILE_SYNC_TOKEN</code> definido nas variáveis de ambiente do site — não
          a senha dele. Assim dá para revogar o acesso deste aparelho sem trocar a senha.
        </p>

        <button
          className="btn btn--wide"
          onClick={salvarServidor}
          disabled={!url.trim() || !token.trim()}
        >
          Conectar
        </button>

        {teste && (
          <p className="row__hint" style={{ marginTop: 12 }}>
            {teste}
          </p>
        )}
      </div>

      <p className="row__hint" style={{ marginTop: 34, textAlign: "center" }}>
        Fragmentos · leitura em pedacinhos
      </p>
    </div>
  );
}
