import {APPS_SCRIPT_BASE_URL} from './apiConfig';

export async function registerDevice(params: {
  tenantId?: string;
  volunteerId: string;
  deviceToken: string;
  platform: 'android' | 'ios';
}): Promise<{ok: boolean; error?: string}> {
  const url = `${APPS_SCRIPT_BASE_URL}?path=registerDevice`;

  const body = new URLSearchParams();
  if (params.tenantId) body.append('tenantId', params.tenantId);
  body.append('volunteerId', params.volunteerId);
  body.append('deviceToken', params.deviceToken);
  body.append('platform', params.platform);

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
  let json: {ok: boolean; error?: string};
  try {
    json = JSON.parse(text) as {ok: boolean; error?: string};
  } catch {
    throw new Error(
      `Risposta non JSON (${res.status}): il server ha restituito HTML o testo non valido.`,
    );
  }
  return json;
}

