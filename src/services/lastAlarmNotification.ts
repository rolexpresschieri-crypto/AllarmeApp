import AsyncStorage from '@react-native-async-storage/async-storage';

export type StoredAlarmNotification = {
  text: string;
  receivedAt: string;
};

const storageKey = (tenantId: string) =>
  `allarmeapp:${tenantId}:last_alarm_notification`;

const listeners = new Set<() => void>();

export function subscribeLastAlarmNotification(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(): void {
  listeners.forEach(listener => listener());
}

export async function loadLastAlarmNotification(
  tenantId: string,
): Promise<StoredAlarmNotification | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(tenantId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as StoredAlarmNotification;
    if (!parsed?.text?.trim()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function saveLastAlarmNotification(
  tenantId: string,
  title: string,
  body: string,
): Promise<void> {
  const safeTitle = title.trim() || 'Allarme';
  const safeBody = body.trim();
  const text = safeBody ? `${safeTitle}\n${safeBody}` : safeTitle;
  const payload: StoredAlarmNotification = {
    text,
    receivedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(storageKey(tenantId), JSON.stringify(payload));
  notifyListeners();
}

export async function clearLastAlarmNotification(tenantId: string): Promise<void> {
  await AsyncStorage.removeItem(storageKey(tenantId));
  notifyListeners();
}
