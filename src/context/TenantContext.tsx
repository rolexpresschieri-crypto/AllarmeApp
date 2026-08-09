import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TenantSession = {
  tenantId: string;
  tenantName?: string;
  loginAt?: string;
};

type TenantContextType = {
  tenant: TenantSession | null;
  /** true dopo la prima lettura AsyncStorage (evita navigazione splash errata). */
  tenantHydrated: boolean;
  setTenant: (value: TenantSession | null) => void;
  clearTenant: () => void;
};

const TENANT_STORAGE_KEY = 'allarmeapp_tenant_v1';

const TenantContext = createContext<TenantContextType | null>(null);

export function TenantProvider({children}: {children: React.ReactNode}) {
  const [tenant, setTenantState] = useState<TenantSession | null>(null);
  const [tenantHydrated, setTenantHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(TENANT_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as TenantSession;
          if (parsed?.tenantId?.trim()) {
            setTenantState({
              tenantId: parsed.tenantId.trim(),
              tenantName: parsed.tenantName,
              loginAt: parsed.loginAt,
            });
          }
        }
      } catch {
        // ignora
      } finally {
        setTenantHydrated(true);
      }
    })();
  }, []);

  const setTenant = useCallback(async (value: TenantSession | null) => {
    setTenantState(value);
    try {
      if (value?.tenantId?.trim()) {
        await AsyncStorage.setItem(TENANT_STORAGE_KEY, JSON.stringify(value));
      } else {
        await AsyncStorage.removeItem(TENANT_STORAGE_KEY);
      }
    } catch {
      // ignora
    }
  }, []);

  const clearTenant = useCallback(async () => {
    setTenantState(null);
    try {
      await AsyncStorage.removeItem(TENANT_STORAGE_KEY);
    } catch {
      // ignora
    }
  }, []);

  return (
    <TenantContext.Provider
      value={{tenant, tenantHydrated, setTenant, clearTenant}}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error('useTenant must be used within TenantProvider');
  }
  return ctx;
}
