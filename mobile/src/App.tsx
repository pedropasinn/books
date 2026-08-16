import { useEffect, useRef, useState } from "react";
import { App as CapApp } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { IconFeed, IconFlame, IconGear, IconLibrary } from "./components/icons";
import { isNative, onNotificationTap, scheduleReminders } from "./lib/notifications";
import { AppProvider, useApp } from "./lib/store";
import { Feed } from "./screens/Feed";
import { Habito } from "./screens/Habito";
import { Library } from "./screens/Library";
import { Settings } from "./screens/Settings";

type Tab = "feed" | "biblioteca" | "habito" | "ajustes";

const TABS: { id: Tab; label: string; Icon: typeof IconFeed }[] = [
  { id: "feed", label: "Ler", Icon: IconFeed },
  { id: "biblioteca", label: "Livros", Icon: IconLibrary },
  { id: "habito", label: "Hábito", Icon: IconFlame },
  { id: "ajustes", label: "Ajustes", Icon: IconGear },
];

function Shell() {
  const {
    ready,
    settings,
    busy,
    error,
    clearError,
    upcomingTeasers,
    chrome,
    setChrome,
    fragments,
  } = useApp();
  const [tab, setTab] = useState<Tab>("feed");

  // O modo foco é só do feed, e só quando há texto na tela: no estado vazio
  // ("nenhum livro carregado") esconder as abas deixaria a pessoa sem saída.
  const focado = tab === "feed" && !chrome && fragments.length > 0;

  // Cor de destaque escolhida pelo usuário.
  useEffect(() => {
    document.documentElement.style.setProperty("--brand", settings.accent);
  }, [settings.accent]);

  // Barra de status transparente sobre o conteúdo (o app é edge-to-edge).
  useEffect(() => {
    if (!isNative()) return;
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
  }, []);

  // No modo foco some também a barra do sistema: aí é tela cheia de verdade.
  // Como o WebView já desenha por baixo dela (overlay), esconder não redimensiona
  // nada — o texto não pula.
  useEffect(() => {
    if (!isNative()) return;
    (focado ? StatusBar.hide() : StatusBar.show()).catch(() => {});
  }, [focado]);

  // Tocar na notificação abre direto no feed.
  useEffect(() => {
    void onNotificationTap(() => setTab("feed"));
  }, []);

  // `upcomingTeasers` muda de identidade a cada fragmento lido; num ref, para
  // o efeito abaixo não reagendar as notificações a cada virada de cartão.
  const teasersRef = useRef(upcomingTeasers);
  teasersRef.current = upcomingTeasers;

  // Reagenda os lembretes ao abrir e ao sair do app, para as prévias das
  // notificações acompanharem o ponto onde a leitura parou.
  useEffect(() => {
    if (!ready || !settings.notificationsOn) return;

    const refresh = () =>
      void scheduleReminders(settings.reminders, teasersRef.current(settings.reminders.length));

    refresh();
    if (!isNative()) return;

    const handle = CapApp.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) refresh();
    });
    return () => {
      void handle.then((h) => h.remove());
    };
  }, [ready, settings.notificationsOn, settings.reminders]);

  if (!ready) return <div className="empty" style={{ paddingTop: 120 }}>…</div>;

  return (
    <div className="app">
      <div className="app__body">
        {tab === "feed" && <Feed onGoToLibrary={() => setTab("biblioteca")} />}
        {tab === "biblioteca" && <Library onOpened={() => setTab("feed")} />}
        {tab === "habito" && <Habito />}
        {tab === "ajustes" && <Settings />}
      </div>

      {(busy || error) && (
        <div className="toast">
          <span>{error ?? busy}</span>
          {error && (
            <button className="btn btn--sm btn--ghost" onClick={clearError}>
              ok
            </button>
          )}
        </div>
      )}

      <nav className="tabs" data-hidden={focado} aria-hidden={focado}>
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className="tabs__item"
            data-on={tab === id}
            tabIndex={focado ? -1 : 0}
            onClick={() => {
              // Sair do feed traz os controles de volta, para não voltar depois
              // numa tela sem barra nenhuma e sem saber como recuperá-la.
              if (id !== "feed") setChrome(true);
              setTab(id);
            }}
          >
            <Icon />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
