import {APPS_SCRIPT_BASE_URL} from './apiConfig';

export type VolunteerLoginResponse =
  | {
      ok: true;
      volunteerId: string;
      name: string;
      surname: string;
      sessionId: string;
      loginAt: string;
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Verifica se la sessione volontario è ancora aperta sul foglio SESSIONS (logout non eseguito).
 */
export async function validateVolunteerSession(params: {
  tenantId?: string;
  volunteerId: string;
  sessionId: string;
}): Promise<{valid: boolean}> {
  const url = `${APPS_SCRIPT_BASE_URL}?path=validateVolunteerSession`;
  const body = new URLSearchParams();
  if (params.tenantId) {
    body.append('tenantId', params.tenantId);
  }
  body.append('volunteerId', params.volunteerId);
  body.append('sessionId', params.sessionId);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Risposta non JSON (${res.status}): ${text.slice(0, 100)}${text.length > 100 ? '...' : ''}`,
    );
  }
  let json: {ok?: boolean; valid?: boolean; error?: string};
  try {
    json = JSON.parse(text) as {ok?: boolean; valid?: boolean; error?: string};
  } catch {
    throw new Error('validateVolunteerSession: risposta non JSON');
  }
  /** Errore server o path non deployato: lancia → la sessione locale non viene cancellata. */
  if (!json.ok) {
    throw new Error(json.error || 'validateVolunteerSession: ok false');
  }
  /** Solo `valid: false` esplicito dal backend chiude la sessione; campo assente = ancora valida. */
  return {valid: json.valid !== false};
}

export async function loginVolunteer(params: {
  tenantId?: string;
  volunteerId: string;
  pin: string;
}): Promise<VolunteerLoginResponse> {
  const url = `${APPS_SCRIPT_BASE_URL}?path=loginVolunteer`;

  const body = new URLSearchParams();
  if (params.tenantId) body.append('tenantId', params.tenantId);
  body.append('volunteerId', params.volunteerId);
  body.append('pin', params.pin);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Risposta non JSON (${res.status}): ${text.slice(0, 100)}${text.length > 100 ? '...' : ''}`,
    );
  }
  let json: VolunteerLoginResponse;
  try {
    json = JSON.parse(text) as VolunteerLoginResponse;
  } catch {
    throw new Error(`Risposta non JSON (${res.status}): il server ha restituito HTML o testo non valido.`);
  }
  return json;
}

export async function logoutVolunteer(params: {
  tenantId?: string;
  volunteerId: string;
  sessionId: string;
}): Promise<{ok: true; logoutAt: string} | {ok: false; error: string}> {
  const url = `${APPS_SCRIPT_BASE_URL}?path=logoutVolunteer`;

  const body = new URLSearchParams();
  if (params.tenantId) body.append('tenantId', params.tenantId);
  body.append('volunteerId', params.volunteerId);
  body.append('sessionId', params.sessionId);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Risposta non JSON (${res.status}): ${text.slice(0, 100)}${text.length > 100 ? '...' : ''}`,
    );
  }
  const json = JSON.parse(text) as {ok: boolean; error?: string; logoutAt?: string};
  if (!json.ok) {
    return {ok: false, error: json.error || 'Logout fallito'};
  }
  return {ok: true, logoutAt: json.logoutAt || ''};
}

export type OnlineVolunteerItem = {
  volunteerId: string;
  name: string;
  surname: string;
  lastSeenAt: string;
  /** true se latitude/longitude residenza sono impostate sul tab VOLUNTEERS */
  hasLocation?: boolean;
  latitude?: number;
  longitude?: number;
};

export async function getOnlineVolunteers(params?: {tenantId?: string}): Promise<{
  ok: true;
  volunteers: OnlineVolunteerItem[];
}> {
  const query = new URLSearchParams();
  query.append('path', 'getOnlineVolunteers');
  if (params?.tenantId) query.append('tenantId', params.tenantId);
  const url = `${APPS_SCRIPT_BASE_URL}?${query.toString()}`;
  const res = await fetch(url, {method: 'GET'});
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Risposta non JSON (${res.status}): ${text.slice(0, 100)}`);
  }
  const json = JSON.parse(text) as {ok: boolean; error?: string; volunteers?: OnlineVolunteerItem[]};
  if (!json.ok || !Array.isArray(json.volunteers)) {
    throw new Error(json.error || 'Risposta non valida');
  }
  return {ok: true, volunteers: json.volunteers};
}

export async function forceLogoutVolunteers(params: {
  tenantId?: string;
  volunteerIds: string[];
}): Promise<{ok: true; count?: number} | {ok: false; error: string}> {
  const url = `${APPS_SCRIPT_BASE_URL}?path=forceLogoutVolunteers`;
  const body = new URLSearchParams();
  if (params.tenantId) body.append('tenantId', params.tenantId);
  body.append('volunteerIds', params.volunteerIds.join(','));

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Risposta non JSON (${res.status}): ${text.slice(0, 100)}${text.length > 100 ? '...' : ''}`,
    );
  }
  const json = JSON.parse(text) as {ok: boolean; error?: string; count?: number};
  if (!json.ok) {
    return {ok: false, error: json.error || 'Force logout fallito'};
  }
  return {ok: true, count: json.count};
}

