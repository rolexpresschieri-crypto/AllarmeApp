import {APPS_SCRIPT_BASE_URL} from './apiConfig';

export type TenantLoginResponse =
  | {
      ok: true;
      tenantId: string;
      tenantName?: string;
      loginAt?: string;
    }
  | {
      ok: false;
      error: string;
    };

export async function loginTenant(params: {
  tenantId: string;
  password: string;
}): Promise<TenantLoginResponse> {
  const url = `${APPS_SCRIPT_BASE_URL}?path=loginTenant`;

  const body = new URLSearchParams();
  body.append('tenantId', params.tenantId);
  body.append('password', params.password);

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
      `Risposta non JSON (${res.status}): ${text.slice(0, 100)}${
        text.length > 100 ? '...' : ''
      }`,
    );
  }

  let json: TenantLoginResponse;
  try {
    json = JSON.parse(text) as TenantLoginResponse;
  } catch {
    throw new Error(
      `Risposta non JSON (${res.status}): il server ha restituito HTML o testo non valido.`,
    );
  }
  return json;
}
