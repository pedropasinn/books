import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { ReminderTime } from "./types";

/**
 * Lembretes de leitura.
 *
 * São notificações LOCAIS diárias e repetitivas: uma por horário configurado,
 * agendadas no aparelho — funcionam sem internet e com o app fechado. O corpo
 * traz o começo do PRÓXIMO fragmento, não um texto genérico: a isca é o texto
 * em si. Como o agendamento só roda com o app aberto, a lista de iscas é
 * reescrita a cada abertura/fechamento para não envelhecer.
 */

const CHANNEL_ID = "leitura";
/** Faixa de ids reservada aos lembretes (para cancelar sem tocar em outros). */
const BASE_ID = 4200;

const NUDGES = [
  "Um fragmento agora?",
  "Dá tempo de ler um pedacinho.",
  "Continue de onde parou.",
  "30 segundos de leitura.",
  "Seu livro está esperando.",
];

export const isNative = () => Capacitor.isNativePlatform();

export async function ensureChannel(): Promise<void> {
  if (!isNative()) return;
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: "Lembretes de leitura",
      description: "Cutucadas para ler um fragmento",
      importance: 4,
      visibility: 1,
    });
  } catch {
    /* canal já existe ou plataforma não suporta */
  }
}

/** Pede a permissão (Android 13+ exige POST_NOTIFICATIONS em runtime). */
export async function requestPermission(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const current = await LocalNotifications.checkPermissions();
    if (current.display === "granted") return true;
    const asked = await LocalNotifications.requestPermissions();
    return asked.display === "granted";
  } catch {
    return false;
  }
}

export async function cancelReminders(): Promise<void> {
  if (!isNative()) return;
  try {
    const pending = await LocalNotifications.getPending();
    const ours = pending.notifications.filter((n) => n.id >= BASE_ID && n.id < BASE_ID + 100);
    if (ours.length) await LocalNotifications.cancel({ notifications: ours });
  } catch {
    /* ignore */
  }
}

/**
 * (Re)agenda um lembrete diário por horário configurado.
 * `teasers` são prévias dos próximos fragmentos — uma por horário, na ordem.
 */
export async function scheduleReminders(
  reminders: ReminderTime[],
  teasers: string[]
): Promise<boolean> {
  if (!isNative()) return false;

  await cancelReminders();
  if (!reminders.length) return true;

  const granted = await requestPermission();
  if (!granted) return false;

  await ensureChannel();

  const notifications = reminders.map((r, i) => ({
    id: BASE_ID + i,
    channelId: CHANNEL_ID,
    title: teasers[i] ? "Fragmentos" : NUDGES[i % NUDGES.length],
    body: teasers[i] ?? NUDGES[i % NUDGES.length],
    smallIcon: "ic_stat_fragmentos",
    // `on` é o agendador "cron" do plugin: ele casa hora+minuto e se reagenda
    // sozinho a cada disparo. (`at` + `repeats` NÃO serve aqui — o plugin usa
    // como intervalo a distância até o primeiro disparo, não 24h.)
    schedule: {
      on: { hour: r.hour, minute: r.minute },
      allowWhileIdle: true,
    },
    extra: { open: "feed" },
  }));

  try {
    await LocalNotifications.schedule({ notifications });
    return true;
  } catch {
    return false;
  }
}

/** Dispara uma notificação daqui a alguns segundos, para conferir se chega. */
export async function scheduleTest(body: string): Promise<boolean> {
  if (!isNative()) return false;
  if (!(await requestPermission())) return false;
  await ensureChannel();
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: BASE_ID + 99,
          channelId: CHANNEL_ID,
          title: "Fragmentos",
          body,
          smallIcon: "ic_stat_fragmentos",
          schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true },
        },
      ],
    });
    return true;
  } catch {
    return false;
  }
}

/** Chama `onOpen` quando o usuário toca numa notificação. */
export async function onNotificationTap(onOpen: () => void): Promise<void> {
  if (!isNative()) return;
  try {
    await LocalNotifications.addListener("localNotificationActionPerformed", onOpen);
  } catch {
    /* ignore */
  }
}

export const formatTime = (t: ReminderTime) =>
  `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`;
