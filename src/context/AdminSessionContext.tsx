import React, {createContext, useCallback, useContext, useState} from 'react';

export type AdminRole = 'full' | 'viewer';

export type AdminSession = {
  adminId: string;
  name: string;
  surname: string;
  role: AdminRole;
};

type AdminSessionContextType = {
  session: AdminSession | null;
  setSession: (session: AdminSession | null) => void;
  clearSession: () => void;
  isViewer: boolean;
  isFull: boolean;
};

const AdminSessionContext = createContext<AdminSessionContextType | null>(null);

export function normalizeAdminRole(role?: string): AdminRole {
  const normalized = (role || 'full').toLowerCase().trim();
  return normalized === 'viewer' ? 'viewer' : 'full';
}

export function AdminSessionProvider({children}: {children: React.ReactNode}) {
  const [session, setSessionState] = useState<AdminSession | null>(null);

  const setSession = useCallback((next: AdminSession | null) => {
    setSessionState(next);
  }, []);

  const clearSession = useCallback(() => {
    setSessionState(null);
  }, []);

  const role = session?.role ?? 'full';

  return (
    <AdminSessionContext.Provider
      value={{
        session,
        setSession,
        clearSession,
        isViewer: role === 'viewer',
        isFull: role === 'full',
      }}>
      {children}
    </AdminSessionContext.Provider>
  );
}

export function useAdminSession() {
  const ctx = useContext(AdminSessionContext);
  if (!ctx) {
    throw new Error('useAdminSession must be used within AdminSessionProvider');
  }
  return ctx;
}
