import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useTenant} from './TenantContext';
import {validateVolunteerSession} from '../services/volunteerApi';

export type VolunteerSession = {
  volunteerId: string;
  name: string;
  surname: string;
  sessionId: string;
  loginAt: string;
};

type VolunteerSessionContextType = {
  session: VolunteerSession | null;
  setSession: (s: VolunteerSession | null) => void;
  clearSession: () => void;
};

const VolunteerSessionContext =
  createContext<VolunteerSessionContextType | null>(null);

export function VolunteerSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const {tenant, tenantHydrated} = useTenant();
  const tenantId = tenant?.tenantId?.trim();
  const storageKey = tenantId
    ? `allarmeapp:${tenantId}:volunteer_session`
    : 'allarmeapp_volunteer_session';
  const [session, setSessionState] = useState<VolunteerSession | null>(null);

  useEffect(() => {
    if (!tenantHydrated) {
      return;
    }
    if (!tenantId) {
      setSessionState(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (cancelled) {
          return;
        }
        if (raw) {
          const parsed: VolunteerSession = JSON.parse(raw);
          if (parsed?.volunteerId && parsed?.sessionId) {
            setSessionState(parsed);
            return;
          }
        }
        setSessionState(null);
      } catch {
        if (!cancelled) {
          setSessionState(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storageKey, tenantId, tenantHydrated]);

  useEffect(() => {
    if (!tenantHydrated || !tenantId || !session) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await validateVolunteerSession({
          tenantId,
          volunteerId: session.volunteerId,
          sessionId: session.sessionId,
        });
        if (cancelled || !res) {
          return;
        }
        if (!res.valid) {
          setSessionState(null);
          try {
            await AsyncStorage.removeItem(storageKey);
          } catch {
            // ignora
          }
        }
      } catch {
        // offline: mantieni sessione locale
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    tenantHydrated,
    tenantId,
    session?.volunteerId,
    session?.sessionId,
    storageKey,
  ]);

  const setSession = useCallback(
    async (s: VolunteerSession | null) => {
      setSessionState(s);
      try {
        if (s && tenantId) {
          await AsyncStorage.setItem(storageKey, JSON.stringify(s));
        } else if (tenantId) {
          await AsyncStorage.removeItem(storageKey);
        }
      } catch {
        // ignora
      }
    },
    [storageKey, tenantId],
  );

  const clearSession = useCallback(async () => {
    setSessionState(null);
    try {
      await AsyncStorage.removeItem(storageKey);
    } catch {
      // ignora
    }
  }, [storageKey]);

  return (
    <VolunteerSessionContext.Provider value={{session, setSession, clearSession}}>
      {children}
    </VolunteerSessionContext.Provider>
  );
}

export function useVolunteerSession() {
  const ctx = useContext(VolunteerSessionContext);
  if (!ctx)
    throw new Error('useVolunteerSession must be used within VolunteerSessionProvider');
  return ctx;
}
