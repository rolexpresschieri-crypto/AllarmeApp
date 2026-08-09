import {APPS_SCRIPT_BASE_URL} from './apiConfig';

export type AlarmType = {
  alarmId: string;
  label: string;
  description: string;
  priority: string | number;
};

export type SendAlarmResponse =
  | {
      ok: true;
      /** Dove ha scritto lo Script (confronta col foglio che hai aperto). */
      sheetTitle?: string;
      sheetId?: string;
      alarmsTab?: string;
      lastRow?: number;
      writtenRow?: number;
      writtenAt?: string;
      /** Indici 0-based delle colonne riconosciute nel foglio ALARMS. -1 = non trovata. */
      cols?: {
        address?: number;
        city?: number;
        prov?: number;
        tenantId?: number;
        timestamp?: number;
        alarmId?: number;
        label?: number;
      };
      /** Riga 1 letta dal foglio (utile per diagnosi colonne). */
      headerSeen?: unknown[];
    }
  | {ok: false; error: string};

export async function getAlarmTypes(params?: {tenantId?: string}): Promise<{
  ok: true;
  alarmTypes: AlarmType[];
}> {
  const query = new URLSearchParams();
  query.append('path', 'getAlarmTypes');
  if (params?.tenantId) query.append('tenantId', params.tenantId);
  const url = `${APPS_SCRIPT_BASE_URL}?${query.toString()}`;
  const res = await fetch(url, {method: 'GET'});
  const text = await res.text();

  if (!res.ok) {
    throw new Error(
      `Risposta non JSON (${res.status}): ${text.slice(0, 100)}${
        text.length > 100 ? '...' : ''
      }`,
    );
  }

  let json: {ok: boolean; error?: string; alarmTypes?: AlarmType[]};
  try {
    json = JSON.parse(text) as {
      ok: boolean;
      error?: string;
      alarmTypes?: AlarmType[];
    };
  } catch {
    throw new Error(
      `Risposta non JSON (${res.status}): il server ha restituito HTML o testo non valido.`,
    );
  }

  if (!json.ok || !Array.isArray(json.alarmTypes)) {
    throw new Error(json.error || 'Risposta non valida da getAlarmTypes');
  }

  return {ok: true, alarmTypes: json.alarmTypes};
}

export async function sendAlarm(params: {
  tenantId?: string;
  alarmId: string;
  label: string;
  description: string;
  priority: string | number;
  /** Opzionale */
  address: string;
  /** Obbligatori lato server/UI */
  city: string;
  prov: string;
  notes: string;
  recipientMode: 'ALL' | 'SELECTED';
  recipientVolunteerIds: string[];
}): Promise<SendAlarmResponse> {
  const tenantTrim = params.tenantId?.trim() ?? '';
  if (!tenantTrim) {
    throw new Error(
      'Codice ente mancante: torna indietro e ricarica l’ente (tenant) prima di inviare l’allarme.',
    );
  }

  /**
   * Tutti i campi sia in query sia nel body POST: dopo il redirect di script.google.com il body
   * può sparire su React Native, ma i parametri nell’URL restano in e.parameter.
   * Funziona anche con deploy vecchi (solo doPost) senza doGet sendAlarm.
   */
  const fields = new URLSearchParams();
  fields.append('path', 'sendAlarm');
  fields.append('_nonce', String(Date.now()));
  fields.append('tenantId', tenantTrim);
  fields.append('alarmId', params.alarmId);
  fields.append('label', params.label);
  fields.append('description', params.description);
  fields.append('priority', String(params.priority ?? ''));
  fields.append('address', params.address);
  fields.append('city', params.city);
  fields.append('prov', params.prov);
  fields.append('notes', params.notes);
  fields.append('recipientMode', params.recipientMode);
  fields.append('recipientVolunteerIds', params.recipientVolunteerIds.join(','));

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
      `HTTP ${res.status}: ${text.slice(0, 280)}${text.length > 280 ? '…' : ''}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error(
      `Il server non ha restituito JSON (HTML o errore?). Inizio risposta:\n${text.slice(0, 280)}${
        text.length > 280 ? '…' : ''
      }`,
    );
  }

  const json = parsed as Record<string, unknown>;
  if (typeof json.ok !== 'boolean') {
    throw new Error(
      `Risposta imprevista dal backend (manca ok:true/false). Controlla il deploy Apps Script.\n${text.slice(
        0,
        280,
      )}${text.length > 280 ? '…' : ''}`,
    );
  }

  return json as SendAlarmResponse;
}


