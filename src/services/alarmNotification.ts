import notifee, {EventType, type Event} from '@notifee/react-native';
import type {FirebaseMessagingTypes} from '@react-native-firebase/messaging';
import {NativeModules, Platform} from 'react-native';

type AlarmSoundNativeModule = {
  cancelAllTrayNotifications(): Promise<void>;
  startSiren(title: string, body: string): Promise<void>;
  stopSiren(): Promise<void>;
};

const alarmSoundNative =
  NativeModules.AlarmSoundModule as AlarmSoundNativeModule | undefined;

async function androidClearTrayNotifications(): Promise<void> {
  if (Platform.OS !== 'android' || !alarmSoundNative?.cancelAllTrayNotifications) {
    return;
  }
  try {
    await alarmSoundNative.cancelAllTrayNotifications();
  } catch {
    /* modulo nativo assente su build vecchie */
  }
}

async function androidStartAlarmSiren(
  title: string,
  body: string,
): Promise<void> {
  if (Platform.OS !== 'android' || !alarmSoundNative?.startSiren) {
    return;
  }
  try {
    await alarmSoundNative.startSiren(title, body);
  } catch {
    /* fall-back: niente sirena né notifica (dovrebbe non succedere mai) */
  }
}

async function androidStopAlarmSiren(): Promise<void> {
  if (Platform.OS !== 'android' || !alarmSoundNative?.stopSiren) {
    return;
  }
  try {
    await alarmSoundNative.stopSiren();
  } catch {
    /* ignore */
  }
}

/** Ferma solo la sirena; lascia il box blu Home e la notifica di riepilogo. */
export async function stopAlarmSirenOnly(): Promise<void> {
  await androidStopAlarmSiren();
}

/** Ferma sirena + rimuove notifica tray (azione da Home: Reset notifica). */
export async function stopAlarmSirenAndClearTray(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  await androidStopAlarmSiren();
  await androidClearTrayNotifications();
  try {
    await notifee.cancelNotification(ALARM_NOTIFICATION_ID);
  } catch {
    /* ignore */
  }
}

/**
 * ID storici di Notifee — manteniamo le costanti perché vecchie versioni dell'app
 * potrebbero avere ancora una notifica Notifee residua in tray. La nuova flow
 * usa solo la notifica del foreground service nativo (una sola voce).
 */
export const ALARM_NOTIFICATION_ID = 'emergency_alarm_active';
export const ALARM_CHANNEL_ID = 'alarm_alert_v3';
export const ALARM_SUMMARY_CHANNEL_ID = 'alarm_summary_v1';
export const STOP_SIREN_ACTION_ID = 'stop_siren';

const handledAlarmDedupeKeys = new Map<string, number>();
const DEDUPE_TTL_MS = 120_000;

function pruneAlarmDedupe(): void {
  const now = Date.now();
  for (const [k, t] of handledAlarmDedupeKeys) {
    if (now - t > DEDUPE_TTL_MS) {
      handledAlarmDedupeKeys.delete(k);
    }
  }
}

function alarmDedupeKey(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
): string | null {
  if (remoteMessage.messageId) {
    return remoteMessage.messageId;
  }
  const d = remoteMessage.data;
  if (!d) {
    return null;
  }
  const alarmId = String(d.alarmId ?? '');
  const tenantId = String(d.tenantId ?? '');
  const sent = remoteMessage.sentTime ?? 0;
  if (!alarmId && !tenantId) {
    return null;
  }
  return `${tenantId}|${alarmId}|${sent}`;
}

function shouldSkipDuplicateAlarmDelivery(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
): boolean {
  pruneAlarmDedupe();
  const key = alarmDedupeKey(remoteMessage);
  if (!key) {
    return false;
  }
  if (handledAlarmDedupeKeys.has(key)) {
    return true;
  }
  handledAlarmDedupeKeys.set(key, Date.now());
  return false;
}

export function parseAlarmContent(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
): {title: string; body: string} {
  /** Preferisci sempre `data`: così non si mischia col payload `notification` di FCM (doppia notifica). */
  const title =
    (remoteMessage.data?.title as string | undefined) ??
    remoteMessage.notification?.title ??
    'Allarme';
  const body =
    (remoteMessage.data?.body as string | undefined) ??
    remoteMessage.notification?.body ??
    '';
  return {title, body};
}

export async function displayAndroidAlarmNotification(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  if (shouldSkipDuplicateAlarmDelivery(remoteMessage)) {
    return;
  }
  const {title, body} = parseAlarmContent(remoteMessage);
  const safeTitle = title.trim() || 'Allarme';
  const safeBody =
    body.trim() ||
    'Emergenza in corso. Sirena fino a 20 min (anche a schermo spento). Puoi fermarla prima con Interrompi sirena.';

  const tenantId = (remoteMessage.data?.tenantId as string | undefined)?.trim();
  if (tenantId) {
    const {saveLastAlarmNotification} = await import('./lastAlarmNotification');
    await saveLastAlarmNotification(tenantId, safeTitle, safeBody);
  }

  /**
   * Pulisce eventuali notifiche residue Notifee delle vecchie versioni.
   * La notifica del foreground service in corso non viene rimossa da cancelAll
   * mentre il service è attivo, quindi è sicuro chiamare anche se il service gira.
   */
  await androidClearTrayNotifications();
  try {
    await notifee.cancelNotification(ALARM_NOTIFICATION_ID);
  } catch {
    /* ignore */
  }

  /**
   * UNA sola notifica per allarme: la notifica obbligatoria del foreground service
   * (canale alarm_siren_fgs_v2, HIGH importance, niente suono sul canale).
   * La sirena vera la suona MediaPlayer; la notifica fa heads-up senza emettere
   * un secondo suono. Così non ci sono più 2 notifiche affiancate.
   */
  await androidStartAlarmSiren(safeTitle, safeBody);
}

/**
 * Chiamato dagli eventi Notifee. Con la nuova flow il bottone "Interrompi sirena"
 * vive sulla notifica nativa (PendingIntent → service), quindi questo handler
 * scatta solo se l'utente preme il bottone su una notifica Notifee residua di
 * una vecchia versione installata prima dell'aggiornamento.
 */
export async function cancelAlarmIfStopPressed(event: Event): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  if (event.type !== EventType.ACTION_PRESS) {
    return;
  }
  if (event.detail.pressAction?.id !== STOP_SIREN_ACTION_ID) {
    return;
  }
  await androidStopAlarmSiren();
  try {
    await notifee.cancelNotification(ALARM_NOTIFICATION_ID);
  } catch {
    /* ignore */
  }
}
