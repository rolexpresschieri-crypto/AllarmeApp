import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {useTenant} from './TenantContext';
import {
  clearLastAlarmNotification,
  loadLastAlarmNotification,
  StoredAlarmNotification,
  subscribeLastAlarmNotification,
} from '../services/lastAlarmNotification';

type LastAlarmNotificationContextType = {
  notification: StoredAlarmNotification | null;
  hasNotification: boolean;
  resetNotification: () => Promise<void>;
};

const LastAlarmNotificationContext =
  createContext<LastAlarmNotificationContextType | null>(null);

export function LastAlarmNotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const {tenant} = useTenant();
  const tenantId = tenant?.tenantId?.trim();
  const [notification, setNotification] =
    useState<StoredAlarmNotification | null>(null);

  const reload = useCallback(async () => {
    if (!tenantId) {
      setNotification(null);
      return;
    }
    const stored = await loadLastAlarmNotification(tenantId);
    setNotification(stored);
  }, [tenantId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    return subscribeLastAlarmNotification(() => {
      void reload();
    });
  }, [reload]);

  const resetNotification = useCallback(async () => {
    if (!tenantId) {
      setNotification(null);
      return;
    }
    await clearLastAlarmNotification(tenantId);
    setNotification(null);
  }, [tenantId]);

  return (
    <LastAlarmNotificationContext.Provider
      value={{
        notification,
        hasNotification: !!notification?.text?.trim(),
        resetNotification,
      }}>
      {children}
    </LastAlarmNotificationContext.Provider>
  );
}

export function useLastAlarmNotification() {
  const ctx = useContext(LastAlarmNotificationContext);
  if (!ctx) {
    throw new Error(
      'useLastAlarmNotification must be used within LastAlarmNotificationProvider',
    );
  }
  return ctx;
}
