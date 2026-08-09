import {APPS_SCRIPT_BASE_URL} from './apiConfig';

export type AdminRole = 'full' | 'viewer';

export type AdminLoginResponse =
  | {
      ok: true;
      adminId: string;
      name: string;
      surname: string;
      role: AdminRole;
    }
  | {
      ok: false;
      error: string;
    };

export async function loginAdmin(params: {
  tenantId?: string;
  adminId: string;
  password: string;
}): Promise<AdminLoginResponse> {
  /**
   * Parametri in URL + body: dopo il redirect di script.google.com il body POST
   * può sparire (Error 411 / Network request failed su Android).
   */
  const fields = new URLSearchParams();
  fields.append('path', 'loginAdmin');
  if (params.tenantId) fields.append('tenantId', params.tenantId);
  fields.append('adminId', params.adminId);
  fields.append('password', params.password);

  const url = `${APPS_SCRIPT_BASE_URL}?${fields.toString()}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-store',
    },
    body: fields.toString(),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Risposta non JSON (${res.status}): ${text.slice(0, 100)}${
        text.length > 100 ? '...' : ''
      }`,
    );
  }
  let json: AdminLoginResponse;
  try {
    json = JSON.parse(text) as AdminLoginResponse;
  } catch {
    throw new Error(
      `Risposta non JSON (${res.status}): il server ha restituito HTML o testo non valido.`,
    );
  }
  return json;
}

