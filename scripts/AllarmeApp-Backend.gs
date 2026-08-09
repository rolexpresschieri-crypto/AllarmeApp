/**
 * AllarmeApp – Backend Google Apps Script (multi-tenant)
 * - Risposte sempre JSON (try/catch in doPost/doGet)
 * - Supporto tenantId su tutti gli endpoint applicativi
 * - Login ente via tab "tenants"
 * - Scrittura righe in ordine colonne (array denso)
 * - Date/ore in Europe/Rome
 * - FCM: messaggi solo "data" + android.priority HIGH (compatibile con Notifee / background handler RN)
 * - sendAlarm: colonne address, city, prov; city e prov obbligatori; address/city/prov salvati in MAIUSCOLO
 * - VOLUNTEERS: latitude/longitude = coordinate residenza (inserimento manuale, fisse)
 * - Mappa: volontari ONLINE con pin sulla residenza da VOLUNTEERS (non GPS live su PRESENCE)
 * - ADMINS: colonna role = full (tutto) oppure viewer (solo elenco volontari online)
 */
const SHEET_ID = '10IQz-bgFIb0oAl2Kv-ZHGw6bzN88_cqymF8HWBuCGE4';
const TENANTS_SHEET = 'tenants';
const VOLUNTEERS_SHEET = 'VOLUNTEERS';
const SESSIONS_SHEET = 'SESSIONS';
const PRESENCE_SHEET = 'PRESENCE';
const ADMINS_SHEET = 'ADMINS';
const ALARM_TYPES_SHEET = 'ALARM_TYPES';
/** Nome foglio log allarmi (match senza distinzione maiuscole/minuscole: alarms, ALARMS, …). */
const ALARMS_SHEET = 'ALARMS';
const TOKENS_SHEET = 'TOKENS';

function getSheetByNameCaseInsensitive(spreadsheet, name) {
  var target = String(name || '').toLowerCase().trim();
  var sheets = spreadsheet.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (String(sheets[i].getName()).toLowerCase().trim() === target) {
      return sheets[i];
    }
  }
  return null;
}
/** Fuso orario per tutte le date scritte su Sheet: Roma (CET/CEST). */
const ROME_TZ = 'Europe/Rome';

function sha256(str) {
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    str,
    Utilities.Charset.UTF_8
  );
  return digest.map(function(b) {
    return ('0' + (b & 0xff).toString(16)).slice(-2);
  }).join('');
}

function doPost(e) {
  e = e || {};
  try {
    var mergedForPath = parseParams(e);
    var path = (mergedForPath.path || (e.parameter && e.parameter.path) || '').toString();
    if (path === 'loginTenant') return handleTenantLogin(e);
    if (path === 'loginVolunteer') return handleVolunteerLogin(e);
    if (path === 'logoutVolunteer') return handleVolunteerLogout(e);
    if (path === 'validateVolunteerSession') return handleValidateVolunteerSession(e);
    if (path === 'loginAdmin') return handleAdminLogin(e);
    if (path === 'sendAlarm') return handleSendAlarm(e);
    if (path === 'registerDevice') return handleRegisterDevice(e);
    if (path === 'forceLogoutVolunteers') return handleForceLogoutVolunteers(e);
    return jsonError('Unknown path');
  } catch (err) {
    return jsonError(String(err));
  }
}

function doGet(e) {
  e = e || {};
  try {
    var mergedForPath = parseParams(e);
    var path = (mergedForPath.path || (e.parameter && e.parameter.path) || '').toString();
    if (path === 'getOnlineVolunteers') return handleGetOnlineVolunteers(e);
    if (path === 'getAlarmTypes') return handleGetAlarmTypes(e);
    if (path === 'sendAlarm') return handleSendAlarm(e);
    if (path === 'loginAdmin') return handleAdminLogin(e);
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'ok',
        version: '2026-08-05-login-admin-get',
        message: 'AllarmeApp backend.',
        endpoints: [
          'getOnlineVolunteers',
          'sendAlarm',
          'loginVolunteer',
          'logoutVolunteer',
          'loginAdmin'
        ]
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return jsonError(String(err));
  }
}

function getSheetTimeZone() {
  return ROME_TZ;
}

function jsonOk(payload) {
  var out = { ok: true };
  for (var key in payload) {
    if (payload.hasOwnProperty(key) && key !== 'ok') out[key] = payload[key];
  }
  return ContentService
    .createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonError(message) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: message }))
    .setMimeType(ContentService.MimeType.JSON);
}

function parseParams(e) {
  var params = e.parameter || {};
  if (e.postData && e.postData.contents) {
    var contents = e.postData.contents.toString();
    contents.split('&').forEach(function(pair) {
      var kv = pair.split('=');
      if (kv.length >= 2) {
        var k = decodeURIComponent(kv[0].replace(/\+/g, ' '));
        var v = decodeURIComponent(kv.slice(1).join('=').replace(/\+/g, ' '));
        params[k] = v;
      }
    });
  }
  return params;
}

function getHeaderIndexOrError(header, colName, sheetName) {
  var idx = header.indexOf(colName);
  if (idx < 0) throw new Error(sheetName + ': missing ' + colName + ' column');
  return idx;
}

/** Normalizza intestazione foglio: trim, minuscolo, senza accenti (città → citta). */
function normalizeSheetHeader(v) {
  var s = String(v || '').trim().toLowerCase();
  try {
    if (typeof s.normalize === 'function') {
      s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
  } catch (ignore) {}
  if (s.length && s.charAt(s.length - 1) === '.') {
    s = s.slice(0, -1);
  }
  return s;
}

/**
 * Indice colonna per uno tra più alias (es. city / Città / CITTA).
 * Restituisce -1 se nessuna corrispondenza.
 */
function findColumnIndexByAliases(headerRow, aliases) {
  var norms = [];
  for (var i = 0; i < headerRow.length; i++) {
    norms.push(normalizeSheetHeader(headerRow[i]));
  }
  for (var a = 0; a < aliases.length; a++) {
    var want = normalizeSheetHeader(aliases[a]);
    for (var j = 0; j < norms.length; j++) {
      if (norms[j] === want) return j;
    }
  }
  return -1;
}

function isTrueCell(v) {
  return String(v).toUpperCase() === 'TRUE';
}

function getRequiredTenantId(params) {
  var tenantId = (params.tenantId || '').toString().trim();
  if (!tenantId) throw new Error('Missing tenantId');
  return tenantId;
}

/** =========================
 *  TENANT LOGIN
 *  ========================= */
function handleTenantLogin(e) {
  e = e || {};
  try {
    var params = parseParams(e);
    var tenantId = (params.tenantId || '').toString().trim();
    var password = (params.password || '').toString();
    if (!tenantId || !password) return jsonError('Missing tenantId or password');
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var tenants = ss.getSheetByName(TENANTS_SHEET);
    if (!tenants) return jsonError('Sheet tenants not found');
    var data = tenants.getDataRange().getValues();
    if (!data || data.length < 2) return jsonError('No tenants configured');
    var h = data[0];
    var idxTenantId = getHeaderIndexOrError(h, 'tenantId', 'tenants');
    var idxTenantName = h.indexOf('tenantName');
    var idxPasswordHash = getHeaderIndexOrError(h, 'passwordHash', 'tenants');
    var idxEnabled = h.indexOf('enabled');
    var inputHash = sha256(password);
    var rowMatch = null;
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (String(row[idxTenantId]).trim() !== tenantId) continue;
      if (idxEnabled >= 0 && !isTrueCell(row[idxEnabled])) continue;
      if (String(row[idxPasswordHash]).trim() !== inputHash) continue;
      rowMatch = row;
      break;
    }
    if (!rowMatch) return jsonError('INVALID_CREDENTIALS');
    return jsonOk({
      tenantId: tenantId,
      tenantName: idxTenantName >= 0 ? rowMatch[idxTenantName] : '',
      loginAt: Utilities.formatDate(new Date(), getSheetTimeZone(), 'dd/MM/yyyy HH.mm.ss')
    });
  } catch (err) {
    return jsonError(String(err));
  }
}

/** =========================
 *  VOLUNTEER LOGIN
 *  ========================= */
function handleVolunteerLogin(e) {
  e = e || {};
  try {
    var params = parseParams(e);
    var tenantId = getRequiredTenantId(params);
    var volunteerId = (params.volunteerId || '').toString().trim();
    var pin = (params.pin || '').toString();
    if (!volunteerId || !pin) return jsonError('Missing volunteerId or pin');
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var volunteers = ss.getSheetByName(VOLUNTEERS_SHEET);
    var sessions = ss.getSheetByName(SESSIONS_SHEET);
    var presence = ss.getSheetByName(PRESENCE_SHEET);
    if (!volunteers) return jsonError('Sheet VOLUNTEERS not found');
    if (!sessions) return jsonError('Sheet SESSIONS not found');
    if (!presence) return jsonError('Sheet PRESENCE not found');
    var data = volunteers.getDataRange().getValues();
    if (!data || data.length < 2) return jsonError('VOLUNTEERS empty');
    var header = data[0];
    var idxTenantId = getHeaderIndexOrError(header, 'tenantId', 'VOLUNTEERS');
    var idxVolunteerId = getHeaderIndexOrError(header, 'volunteerId', 'VOLUNTEERS');
    var idxPinHash = getHeaderIndexOrError(header, 'pinHash', 'VOLUNTEERS');
    var idxName = getHeaderIndexOrError(header, 'name', 'VOLUNTEERS');
    var idxSurname = getHeaderIndexOrError(header, 'surname', 'VOLUNTEERS');
    var idxActive = header.indexOf('active');
    var inputHash = sha256(pin);
    var rowMatch = null;
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (String(row[idxTenantId]).trim() !== tenantId) continue;
      if (String(row[idxVolunteerId]).trim() !== volunteerId) continue;
      if (idxActive >= 0 && !isTrueCell(row[idxActive])) continue;
      if (String(row[idxPinHash]).trim() !== inputHash) continue;
      rowMatch = row;
      break;
    }
    if (!rowMatch) return jsonError('INVALID_CREDENTIALS');
    var sessionId = 'S_' + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
    var now = new Date();
    var loginAt = Utilities.formatDate(now, getSheetTimeZone(), 'dd/MM/yyyy HH.mm.ss');
    // SESSIONS append
    var sessionsData = sessions.getDataRange().getValues();
    var sessionsHeader = sessionsData[0];
    var sIdxTenantId = getHeaderIndexOrError(sessionsHeader, 'tenantId', 'SESSIONS');
    var sIdxSessionId = getHeaderIndexOrError(sessionsHeader, 'sessionId', 'SESSIONS');
    var sIdxVolunteerId = getHeaderIndexOrError(sessionsHeader, 'volunteerId', 'SESSIONS');
    var sIdxLoginAt = sessionsHeader.indexOf('loginAt');
    var sIdxDeviceInfo = sessionsHeader.indexOf('deviceInfo');
    var sIdxAppVersion = sessionsHeader.indexOf('appVersion');
    var sessionRow = [];
    for (var c = 0; c < sessionsHeader.length; c++) sessionRow[c] = '';
    sessionRow[sIdxTenantId] = tenantId;
    sessionRow[sIdxSessionId] = sessionId;
    sessionRow[sIdxVolunteerId] = volunteerId;
    if (sIdxLoginAt >= 0) sessionRow[sIdxLoginAt] = loginAt;
    if (sIdxDeviceInfo >= 0) sessionRow[sIdxDeviceInfo] = 'android';
    if (sIdxAppVersion >= 0) sessionRow[sIdxAppVersion] = '1.00.00';
    sessions.appendRow(sessionRow);
    // PRESENCE upsert
    var presenceData = presence.getDataRange().getValues();
    var pHeader = presenceData[0];
    var pIdxTenantId = getHeaderIndexOrError(pHeader, 'tenantId', 'PRESENCE');
    var pIdxVolunteerId = getHeaderIndexOrError(pHeader, 'volunteerId', 'PRESENCE');
    var pIdxStatus = pHeader.indexOf('status');
    var pIdxLastSeenAt = pHeader.indexOf('lastSeenAt');
    var pIdxCurrentSessionId = pHeader.indexOf('currentSessionId');
    var found = false;
    for (var j = 1; j < presenceData.length; j++) {
      if (
        String(presenceData[j][pIdxTenantId]).trim() === tenantId &&
        String(presenceData[j][pIdxVolunteerId]).trim() === volunteerId
      ) {
        if (pIdxStatus >= 0) presence.getRange(j + 1, pIdxStatus + 1).setValue('ONLINE');
        if (pIdxLastSeenAt >= 0) presence.getRange(j + 1, pIdxLastSeenAt + 1).setValue(loginAt);
        if (pIdxCurrentSessionId >= 0) presence.getRange(j + 1, pIdxCurrentSessionId + 1).setValue(sessionId);
        found = true;
        break;
      }
    }
    if (!found) {
      var presenceRow = [];
      for (var cc = 0; cc < pHeader.length; cc++) presenceRow[cc] = '';
      presenceRow[pIdxTenantId] = tenantId;
      presenceRow[pIdxVolunteerId] = volunteerId;
      if (pIdxStatus >= 0) presenceRow[pIdxStatus] = 'ONLINE';
      if (pIdxLastSeenAt >= 0) presenceRow[pIdxLastSeenAt] = loginAt;
      if (pIdxCurrentSessionId >= 0) presenceRow[pIdxCurrentSessionId] = sessionId;
      presence.appendRow(presenceRow);
    }
    return jsonOk({
      volunteerId: volunteerId,
      name: rowMatch[idxName],
      surname: rowMatch[idxSurname],
      sessionId: sessionId,
      loginAt: loginAt
    });
  } catch (err) {
    return jsonError(String(err));
  }
}

/** =========================
 *  VALIDAZIONE SESSIONE VOLONTARIO (SESSIONS aperta su Sheet)
 *  ========================= */
function handleValidateVolunteerSession(e) {
  e = e || {};
  try {
    var params = parseParams(e);
    var tenantId = getRequiredTenantId(params);
    var volunteerId = (params.volunteerId || '').toString().trim();
    var sessionId = (params.sessionId || '').toString().trim();
    if (!volunteerId || !sessionId) return jsonError('Missing volunteerId or sessionId');
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sessions = ss.getSheetByName(SESSIONS_SHEET);
    if (!sessions) return jsonError('Sheet SESSIONS not found');
    var sData = sessions.getDataRange().getValues();
    if (!sData || sData.length < 2) return jsonOk({ valid: false });
    var sHeader = sData[0];
    var sIdxTenantId = getHeaderIndexOrError(sHeader, 'tenantId', 'SESSIONS');
    var sIdxSessionId = getHeaderIndexOrError(sHeader, 'sessionId', 'SESSIONS');
    var sIdxVolunteerId = getHeaderIndexOrError(sHeader, 'volunteerId', 'SESSIONS');
    var sIdxLogoutAt = sHeader.indexOf('logoutAt');
    var found = false;
    for (var i = 1; i < sData.length; i++) {
      if (String(sData[i][sIdxTenantId]).trim() !== tenantId) continue;
      if (String(sData[i][sIdxVolunteerId]).trim() !== volunteerId) continue;
      if (String(sData[i][sIdxSessionId]).trim() !== sessionId) continue;
      var closed = sIdxLogoutAt >= 0 ? String(sData[i][sIdxLogoutAt] || '').trim() : '';
      if (closed) return jsonOk({ valid: false });
      found = true;
      break;
    }
    return jsonOk({ valid: found });
  } catch (err) {
    return jsonError(String(err));
  }
}

/** =========================
 *  VOLUNTEER LOGOUT
 *  ========================= */
function handleVolunteerLogout(e) {
  e = e || {};
  try {
    var params = parseParams(e);
    var tenantId = getRequiredTenantId(params);
    var volunteerId = (params.volunteerId || '').toString().trim();
    var sessionId = (params.sessionId || '').toString().trim();
    if (!volunteerId || !sessionId) return jsonError('Missing volunteerId or sessionId');
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sessions = ss.getSheetByName(SESSIONS_SHEET);
    var presence = ss.getSheetByName(PRESENCE_SHEET);
    var tokensSheet = ss.getSheetByName(TOKENS_SHEET);
    if (!sessions) return jsonError('Sheet SESSIONS not found');
    if (!presence) return jsonError('Sheet PRESENCE not found');
    var logoutAt = Utilities.formatDate(new Date(), getSheetTimeZone(), 'dd/MM/yyyy HH.mm.ss');
    // PRESENCE -> OFFLINE (tenant + volunteer)
    var presenceData = presence.getDataRange().getValues();
    var pHeader = presenceData[0];
    var pIdxTenantId = getHeaderIndexOrError(pHeader, 'tenantId', 'PRESENCE');
    var pIdxVolunteerId = getHeaderIndexOrError(pHeader, 'volunteerId', 'PRESENCE');
    var pIdxStatus = pHeader.indexOf('status');
    var pIdxLastSeenAt = pHeader.indexOf('lastSeenAt');
    var pIdxCurrentSessionId = pHeader.indexOf('currentSessionId');
    for (var j = 1; j < presenceData.length; j++) {
      if (
        String(presenceData[j][pIdxTenantId]).trim() === tenantId &&
        String(presenceData[j][pIdxVolunteerId]).trim() === volunteerId
      ) {
        if (pIdxStatus >= 0) presence.getRange(j + 1, pIdxStatus + 1).setValue('OFFLINE');
        if (pIdxLastSeenAt >= 0) presence.getRange(j + 1, pIdxLastSeenAt + 1).setValue(logoutAt);
        if (pIdxCurrentSessionId >= 0) presence.getRange(j + 1, pIdxCurrentSessionId + 1).setValue('');
        break;
      }
    }
    // SESSIONS close (tenant + sessionId)
    var sessionsData = sessions.getDataRange().getValues();
    var sHeader = sessionsData[0];
    var sIdxTenantId = getHeaderIndexOrError(sHeader, 'tenantId', 'SESSIONS');
    var sIdxSessionId = getHeaderIndexOrError(sHeader, 'sessionId', 'SESSIONS');
    var sIdxLoginAt = sHeader.indexOf('loginAt');
    var sIdxLogoutAt = sHeader.indexOf('logoutAt');
    var sIdxClosedBy = sHeader.indexOf('closedBy');
    var sIdxDurationSec = sHeader.indexOf('durationSec');
    var sIdxDurationHours = sHeader.indexOf('durationHours');
    var sIdxLogoutReason = sHeader.indexOf('logoutReason');
    for (var i = 1; i < sessionsData.length; i++) {
      if (
        String(sessionsData[i][sIdxTenantId]).trim() === tenantId &&
        String(sessionsData[i][sIdxSessionId]).trim() === sessionId
      ) {
        var rowNum = i + 1;
        if (sIdxLogoutAt >= 0) sessions.getRange(rowNum, sIdxLogoutAt + 1).setValue(logoutAt);
        if (sIdxClosedBy >= 0) sessions.getRange(rowNum, sIdxClosedBy + 1).setValue('logout');
        if (sIdxLogoutReason >= 0) sessions.getRange(rowNum, sIdxLogoutReason + 1).setValue('logout');
        if (sIdxDurationSec >= 0 && sIdxLoginAt >= 0) {
          var durationSec = parseDurationSec(sessionsData[i][sIdxLoginAt], logoutAt);
          if (durationSec >= 0) {
            sessions.getRange(rowNum, sIdxDurationSec + 1).setValue(durationSec);
            if (sIdxDurationHours >= 0) {
              sessions.getRange(rowNum, sIdxDurationHours + 1).setValue(
                Math.round((durationSec / 3600) * 100) / 100
              );
            }
          }
        }
        break;
      }
    }
    // TOKENS deactivate for same tenant + volunteer
    if (tokensSheet) {
      var tokenData = tokensSheet.getDataRange().getValues();
      var tHeader = tokenData[0];
      var tIdxTenantId = getHeaderIndexOrError(tHeader, 'tenantId', 'TOKENS');
      var tIdxVolunteerId = getHeaderIndexOrError(tHeader, 'volunteerId', 'TOKENS');
      var tIdxActive = tHeader.indexOf('active');
      if (tIdxActive >= 0) {
        for (var k = 1; k < tokenData.length; k++) {
          if (
            String(tokenData[k][tIdxTenantId]).trim() === tenantId &&
            String(tokenData[k][tIdxVolunteerId]).trim() === volunteerId
          ) {
            tokensSheet.getRange(k + 1, tIdxActive + 1).setValue('FALSE');
          }
        }
      }
    }
    return jsonOk({ logoutAt: logoutAt });
  } catch (err) {
    return jsonError(String(err));
  }
}

/** =========================
 *  DATE HELPERS
 *  ========================= */
function parseSessionDateTime(str) {
  if (!str) return null;
  var parts = String(str).trim().split(' ');
  if (parts.length !== 2) return null;
  var dParts = parts[0].split('/');
  var tParts = parts[1].split('.');
  if (dParts.length !== 3 || tParts.length !== 3) return null;
  var year = parseInt(dParts[2], 10);
  var month = parseInt(dParts[1], 10) - 1;
  var day = parseInt(dParts[0], 10);
  var hour = parseInt(tParts[0], 10);
  var min = parseInt(tParts[1], 10);
  var sec = parseInt(tParts[2], 10);
  return new Date(year, month, day, hour, min, sec);
}

function normalizeCellToDate(cell) {
  if (!cell) return null;
  if (cell instanceof Date) return cell;
  var s = String(cell);
  if (s.indexOf('/') >= 0 && s.indexOf(' ') >= 0 && s.indexOf('.') >= 0) {
    return parseSessionDateTime(s);
  }
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function parseDurationSec(loginAtCell, logoutAtCell) {
  try {
    var loginDate = normalizeCellToDate(loginAtCell);
    var logoutDate = normalizeCellToDate(logoutAtCell);
    if (loginDate && logoutDate) {
      var sec = Math.round((logoutDate.getTime() - loginDate.getTime()) / 1000);
      return sec >= 0 ? sec : -1;
    }
  } catch (e) {}
  return -1;
}

/** =========================
 *  ONLINE VOLUNTEERS (GET)
 *  ========================= */
function handleGetOnlineVolunteers(e) {
  e = e || {};
  try {
    var params = parseParams(e);
    var tenantId = getRequiredTenantId(params);
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var volunteers = ss.getSheetByName(VOLUNTEERS_SHEET);
    var presence = ss.getSheetByName(PRESENCE_SHEET);
    if (!volunteers) return jsonError('Sheet VOLUNTEERS not found');
    if (!presence) return jsonError('Sheet PRESENCE not found');
    var volData = volunteers.getDataRange().getValues();
    var volHeader = volData[0];
    var vIdxTenantId = getHeaderIndexOrError(volHeader, 'tenantId', 'VOLUNTEERS');
    var vIdxId = getHeaderIndexOrError(volHeader, 'volunteerId', 'VOLUNTEERS');
    var vIdxName = getHeaderIndexOrError(volHeader, 'name', 'VOLUNTEERS');
    var vIdxSurname = getHeaderIndexOrError(volHeader, 'surname', 'VOLUNTEERS');
    var vLoc = getVolunteerResidenceColumnIndices(volHeader);
    var volMap = {};
    for (var i = 1; i < volData.length; i++) {
      if (String(volData[i][vIdxTenantId]).trim() !== tenantId) continue;
      var vid = String(volData[i][vIdxId] || '').trim();
      if (!vid) continue;
      var latVal =
        vLoc.lat >= 0
          ? parseFloat(String(volData[i][vLoc.lat] || '').replace(',', '.'))
          : NaN;
      var lngVal =
        vLoc.lng >= 0
          ? parseFloat(String(volData[i][vLoc.lng] || '').replace(',', '.'))
          : NaN;
      var hasResidence = isValidLatLng(latVal, lngVal);
      volMap[vid] = {
        name: volData[i][vIdxName],
        surname: volData[i][vIdxSurname],
        hasLocation: hasResidence,
        latitude: hasResidence ? latVal : null,
        longitude: hasResidence ? lngVal : null
      };
    }
    var presData = presence.getDataRange().getValues();
    var pHeader = presData[0];
    var pIdxTenantId = getHeaderIndexOrError(pHeader, 'tenantId', 'PRESENCE');
    var pIdxVolunteerId = getHeaderIndexOrError(pHeader, 'volunteerId', 'PRESENCE');
    var pIdxStatus = getHeaderIndexOrError(pHeader, 'status', 'PRESENCE');
    var pIdxLastSeenAt = pHeader.indexOf('lastSeenAt');
    var list = [];
    for (var j = 1; j < presData.length; j++) {
      if (String(presData[j][pIdxTenantId]).trim() !== tenantId) continue;
      if (String(presData[j][pIdxStatus]).toUpperCase() !== 'ONLINE') continue;
      var pid = String(presData[j][pIdxVolunteerId] || '').trim();
      if (!pid) continue;
      var info = volMap[pid];
      var lastSeenAt = (pIdxLastSeenAt >= 0 && presData[j][pIdxLastSeenAt])
        ? String(presData[j][pIdxLastSeenAt]).trim()
        : '';
      lastSeenAt = normalizeTimeString(lastSeenAt);
      var item = {
        volunteerId: pid,
        name: info ? info.name : '',
        surname: info ? info.surname : '',
        lastSeenAt: lastSeenAt,
        hasLocation: info ? !!info.hasLocation : false
      };
      if (info && info.hasLocation) {
        item.latitude = info.latitude;
        item.longitude = info.longitude;
      }
      list.push(item);
    }
    return jsonOk({ volunteers: list });
  } catch (err) {
    return jsonError(String(err));
  }
}

function normalizeTimeString(s) {
  if (!s) return '';
  var parts = s.split(' ');
  if (parts.length !== 2) return s;
  var timePart = parts[1];
  var seg = timePart.split('.');
  if (seg.length >= 1 && seg[0].length === 1) seg[0] = '0' + seg[0];
  return parts[0] + ' ' + seg.join('.');
}

function isValidLatLng(lat, lng) {
  if (isNaN(lat) || isNaN(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

/** Colonne coordinate residenza fisse sul tab VOLUNTEERS (inserimento manuale). */
function getVolunteerResidenceColumnIndices(volHeader) {
  return {
    lat: findColumnIndexByAliases(volHeader, [
      'latitude',
      'lat',
      'latitudine',
      'lat_residenza',
      'residenceLat'
    ]),
    lng: findColumnIndexByAliases(volHeader, [
      'longitude',
      'lng',
      'lon',
      'longitudine',
      'lng_residenza',
      'residenceLng'
    ])
  };
}

/** =========================
 *  ADMIN LOGIN
 *  ========================= */
function handleAdminLogin(e) {
  e = e || {};
  try {
    var params = parseParams(e);
    var tenantId = getRequiredTenantId(params);
    var adminId = (params.adminId || '').toString().trim();
    var password = (params.password || '').toString();
    if (!adminId || !password) return jsonError('Missing adminId or password');
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var admins = ss.getSheetByName(ADMINS_SHEET);
    if (!admins) return jsonError('Sheet ADMINS not found');
    var data = admins.getDataRange().getValues();
    if (!data || data.length < 2) return jsonError('ADMINS empty');
    var header = data[0];
    var idxTenantId = getHeaderIndexOrError(header, 'tenantId', 'ADMINS');
    var idxAdminId = getHeaderIndexOrError(header, 'adminId', 'ADMINS');
    var idxActive = header.indexOf('active');
    var idxPasswordHash = header.indexOf('passwordHash');
    var idxPasswordPlain = header.indexOf('password');
    var idxName = header.indexOf('name');
    var idxSurname = header.indexOf('surname');
    var idxRole = header.indexOf('role');
    var inputHash = sha256(password);
    var rowMatch = null;
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (String(row[idxTenantId]).trim() !== tenantId) continue;
      if (String(row[idxAdminId]).trim() !== adminId) continue;
      if (idxActive >= 0 && !isTrueCell(row[idxActive])) continue;
      var okPassword = false;
      if (idxPasswordHash >= 0 && row[idxPasswordHash]) {
        okPassword = String(row[idxPasswordHash]).trim() === inputHash;
      } else if (idxPasswordPlain >= 0 && row[idxPasswordPlain]) {
        okPassword = String(row[idxPasswordPlain]) === password;
      }
      if (okPassword) {
        rowMatch = row;
        break;
      }
    }
    if (!rowMatch) return jsonError('INVALID_CREDENTIALS');
    var roleRaw = idxRole >= 0 ? String(rowMatch[idxRole]).trim().toLowerCase() : 'full';
    var role = roleRaw === 'viewer' ? 'viewer' : 'full';
    return jsonOk({
      adminId: adminId,
      name: idxName >= 0 ? rowMatch[idxName] : '',
      surname: idxSurname >= 0 ? rowMatch[idxSurname] : '',
      role: role
    });
  } catch (err) {
    return jsonError(String(err));
  }
}

/** =========================
 *  ALARM TYPES (GET)
 *  ========================= */
function handleGetAlarmTypes(e) {
  e = e || {};
  try {
    var params = parseParams(e);
    var tenantId = getRequiredTenantId(params);
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(ALARM_TYPES_SHEET);
    if (!sheet) return jsonError('Sheet ALARM_TYPES not found');
    var data = sheet.getDataRange().getValues();
    if (!data || data.length < 2) return jsonError('ALARM_TYPES empty');
    var header = data[0];
    var idxTenantId = getHeaderIndexOrError(header, 'tenantId', 'ALARM_TYPES');
    var idxId = getHeaderIndexOrError(header, 'alarmId', 'ALARM_TYPES');
    var idxLabel = getHeaderIndexOrError(header, 'label', 'ALARM_TYPES');
    var idxDesc = header.indexOf('description');
    var idxPriority = header.indexOf('priority');
    var idxActive = header.indexOf('active');
    var list = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (String(row[idxTenantId]).trim() !== tenantId) continue;
      if (idxActive >= 0 && !isTrueCell(row[idxActive])) continue;
      if (!row[idxId] || !row[idxLabel]) continue;
      list.push({
        alarmId: row[idxId],
        label: row[idxLabel],
        description: idxDesc >= 0 ? row[idxDesc] : '',
        priority: idxPriority >= 0 ? row[idxPriority] : ''
      });
    }
    return jsonOk({ alarmTypes: list });
  } catch (err) {
    return jsonError(String(err));
  }
}

/** =========================
 *  SEND ALARM
 *  ========================= */
function handleSendAlarm(e) {
  e = e || {};
  try {
    var params = parseParams(e);
    var tenantId = getRequiredTenantId(params);
    var alarmId = (params.alarmId || '').toString().trim();
    var label = (params.label || '').toString().trim();
    var description = (params.description || '').toString().trim();
    var priority = (params.priority || '').toString().trim();
    var notes = (params.notes || '').toString().trim();
    var address = (params.address || '').toString().trim().toUpperCase();
    var city = (params.city || '').toString().trim().toUpperCase();
    var prov = (params.prov || '').toString().trim().toUpperCase();
    var recipientMode = (params.recipientMode || 'ALL').toString().trim().toUpperCase();
    var recipientVolunteerIdsRaw = (params.recipientVolunteerIds || '').toString().trim();
    if (!alarmId || !label) return jsonError('Missing alarmId or label');
    if (!city || !prov) return jsonError('Missing city or prov');
    var selectedIdsMap = {};
    if (recipientMode === 'SELECTED' && recipientVolunteerIdsRaw) {
      recipientVolunteerIdsRaw.split(',').forEach(function(x) {
        var id = String(x || '').trim();
        if (id) selectedIdsMap[id] = true;
      });
    }
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var alarmsSheet = getSheetByNameCaseInsensitive(ss, ALARMS_SHEET);
    if (!alarmsSheet) {
      return jsonError('Foglio allarmi non trovato: crea un tab "alarms" o "ALARMS"');
    }
    // Leggi intestazioni su una scansione larga: getLastColumn() spesso resta 1 se la riga 2 è vuota.
    var scanCols = Math.max(alarmsSheet.getLastColumn(), 40);
    var aHeader = alarmsSheet.getRange(1, 1, 1, scanCols).getValues()[0];
    var aIdxTenantId = findColumnIndexByAliases(aHeader, [
      'tenantId',
      'tenant_id',
      'tenant',
      'ente',
      'codiceEnte',
      'codice_ente',
      'idEnte',
      'id_ente'
    ]);
    if (aIdxTenantId < 0) {
      return jsonError(
        'ALARMS riga 1: colonna ente non trovata. Aggiungi tenantId (o Ente / codiceEnte).'
      );
    }
    var aIdxTs = findColumnIndexByAliases(aHeader, [
      'timestamp',
      'data',
      'dataOra',
      'date',
      'when'
    ]);
    var aIdxAlarmId = findColumnIndexByAliases(aHeader, [
      'alarmId',
      'alarm_id',
      'tipoAllarme',
      'tipo_allarme',
      'idAllarme'
    ]);
    var aIdxLabel = findColumnIndexByAliases(aHeader, [
      'label',
      'etichetta',
      'nome',
      'titolo'
    ]);
    var aIdxAddress = findColumnIndexByAliases(aHeader, [
      'address',
      'indirizzo',
      'addr'
    ]);
    var aIdxCity = findColumnIndexByAliases(aHeader, [
      'city',
      'citta',
      'città'
    ]);
    var aIdxProv = findColumnIndexByAliases(aHeader, [
      'prov',
      'provincia',
      'sigla'
    ]);
    var aIdxDesc = findColumnIndexByAliases(aHeader, ['description', 'descrizione', 'dettaglio']);
    var aIdxPriority = findColumnIndexByAliases(aHeader, ['priority', 'priorita', 'priorità']);
    var aIdxNotes = findColumnIndexByAliases(aHeader, ['notes', 'note', 'annotazioni']);
    var aIdxRecipientMode = findColumnIndexByAliases(aHeader, [
      'recipientMode',
      'recipient_mode',
      'modalitaDestinatari',
      'modalità destinatari'
    ]);
    var aIdxRecipientIds = findColumnIndexByAliases(aHeader, [
      'recipientVolunteerIds',
      'recipient_volunteer_ids',
      'volunteerIds',
      'destinatari'
    ]);
    if (aIdxCity < 0 || aIdxProv < 0) {
      return jsonError(
        'ALARMS riga 1: colonne città e provincia non trovate. Usa city e prov (oppure Città e Provincia / simili). Intestazioni viste: ' +
          JSON.stringify(aHeader)
      );
    }
    var ts = Utilities.formatDate(new Date(), getSheetTimeZone(), 'dd/MM/yyyy HH.mm.ss');
    var indexList = [
      aIdxTenantId,
      aIdxCity,
      aIdxProv,
      aIdxTs,
      aIdxAlarmId,
      aIdxLabel,
      aIdxAddress,
      aIdxDesc,
      aIdxPriority,
      aIdxNotes,
      aIdxRecipientMode,
      aIdxRecipientIds
    ];
    var maxIdx = 0;
    for (var ii = 0; ii < indexList.length; ii++) {
      if (indexList[ii] > maxIdx) maxIdx = indexList[ii];
    }
    var sheetMaxCols = alarmsSheet.getMaxColumns();
    var neededCols = maxIdx + 1;
    if (neededCols > sheetMaxCols) {
      try {
        alarmsSheet.insertColumnsAfter(sheetMaxCols, neededCols - sheetMaxCols);
        sheetMaxCols = alarmsSheet.getMaxColumns();
      } catch (colErr) {
        Logger.log('ALARMS insertColumnsAfter failed: ' + colErr);
      }
    }
    var lastCol = Math.max(neededCols, alarmsSheet.getLastColumn(), 12);
    if (lastCol > sheetMaxCols) lastCol = sheetMaxCols;
    var alarmRow = [];
    for (var c = 0; c < lastCol; c++) alarmRow[c] = '';
    alarmRow[aIdxTenantId] = tenantId;
    if (aIdxTs >= 0 && aIdxTs < lastCol) alarmRow[aIdxTs] = ts;
    if (aIdxAlarmId >= 0 && aIdxAlarmId < lastCol) alarmRow[aIdxAlarmId] = alarmId;
    if (aIdxLabel >= 0 && aIdxLabel < lastCol) alarmRow[aIdxLabel] = label;
    if (aIdxAddress >= 0 && aIdxAddress < lastCol) alarmRow[aIdxAddress] = address;
    if (aIdxCity >= 0 && aIdxCity < lastCol) alarmRow[aIdxCity] = city;
    if (aIdxProv >= 0 && aIdxProv < lastCol) alarmRow[aIdxProv] = prov;
    if (aIdxDesc >= 0 && aIdxDesc < lastCol) alarmRow[aIdxDesc] = description;
    if (aIdxPriority >= 0 && aIdxPriority < lastCol) alarmRow[aIdxPriority] = priority;
    if (aIdxNotes >= 0 && aIdxNotes < lastCol) alarmRow[aIdxNotes] = notes;
    if (aIdxRecipientMode >= 0 && aIdxRecipientMode < lastCol) alarmRow[aIdxRecipientMode] = recipientMode;
    if (aIdxRecipientIds >= 0 && aIdxRecipientIds < lastCol) alarmRow[aIdxRecipientIds] = recipientVolunteerIdsRaw;
    var writtenRow = -1;
    try {
      var targetRow = alarmsSheet.getLastRow() + 1;
      alarmsSheet.getRange(targetRow, 1, 1, alarmRow.length).setValues([alarmRow]);
      SpreadsheetApp.flush();
      writtenRow = targetRow;
    } catch (appendErr) {
      Logger.log('ALARMS setValues failed: ' + appendErr + ' — fallback appendRow');
      try {
        alarmsSheet.appendRow(alarmRow);
        SpreadsheetApp.flush();
        writtenRow = alarmsSheet.getLastRow();
      } catch (appendErr2) {
        Logger.log('ALARMS appendRow failed: ' + appendErr2);
        return jsonError('Scrittura foglio ALARMS non riuscita: ' + String(appendErr2));
      }
    }
    // Push notifications
    try {
      var presenceSheet = ss.getSheetByName(PRESENCE_SHEET);
      var tokensSheet = ss.getSheetByName(TOKENS_SHEET);
      if (presenceSheet && tokensSheet) {
        var presData = presenceSheet.getDataRange().getValues();
        var pHeader = presData[0];
        var pIdxTenantId = getHeaderIndexOrError(pHeader, 'tenantId', 'PRESENCE');
        var pIdxVolunteerId = getHeaderIndexOrError(pHeader, 'volunteerId', 'PRESENCE');
        var pIdxStatus = getHeaderIndexOrError(pHeader, 'status', 'PRESENCE');
        var onlineIds = {};
        for (var p = 1; p < presData.length; p++) {
          if (String(presData[p][pIdxTenantId]).trim() !== tenantId) continue;
          if (String(presData[p][pIdxStatus]).toUpperCase() !== 'ONLINE') continue;
          var vid = String(presData[p][pIdxVolunteerId] || '').trim();
          if (!vid) continue;
          if (recipientMode === 'SELECTED') {
            if (selectedIdsMap[vid]) onlineIds[vid] = true;
          } else {
            onlineIds[vid] = true;
          }
        }
        var tokenData = tokensSheet.getDataRange().getValues();
        var tHeader = tokenData[0];
        var tIdxTenantId = getHeaderIndexOrError(tHeader, 'tenantId', 'TOKENS');
        var tIdxVolunteerId = getHeaderIndexOrError(tHeader, 'volunteerId', 'TOKENS');
        var tIdxToken = getHeaderIndexOrError(tHeader, 'deviceToken', 'TOKENS');
        var tIdxActive = tHeader.indexOf('active');
        var title = 'ALLARME: ' + label;
        var locParts = [];
        if (address) locParts.push(address);
        locParts.push(city + (prov ? ' (' + prov + ')' : ''));
        var locLine = locParts.join(', ');
        var body = notes
          ? (locLine ? locLine + ' — ' + notes : notes)
          : (locLine || description || 'Emergenza in corso.');
        var dataPayload = {
          alarmId: String(alarmId),
          priority: String(priority),
          label: String(label),
          tenantId: String(tenantId),
          address: String(address),
          city: String(city),
          prov: String(prov)
        };
        for (var t = 1; t < tokenData.length; t++) {
          if (String(tokenData[t][tIdxTenantId]).trim() !== tenantId) continue;
          if (tIdxActive >= 0 && !isTrueCell(tokenData[t][tIdxActive])) continue;
          var volId = String(tokenData[t][tIdxVolunteerId] || '').trim();
          if (!volId || !onlineIds[volId]) continue;
          var deviceToken = String(tokenData[t][tIdxToken] || '').trim();
          if (!deviceToken) continue;
          try {
            sendFcmToToken(deviceToken, title, body, dataPayload);
          } catch (fcmErr) {
            Logger.log('FCM skip token: ' + fcmErr);
          }
        }
      }
    } catch (pushErr) {
      Logger.log('Push send error: ' + pushErr);
    }
    var lr = alarmsSheet.getLastRow();
    Logger.log(
      'sendAlarm OK: spreadsheet="' +
        ss.getName() +
        '" tab="' +
        alarmsSheet.getName() +
        '" lastRow=' +
        lr +
        ' addrIdx=' +
        aIdxAddress +
        ' cityIdx=' +
        aIdxCity +
        ' provIdx=' +
        aIdxProv
    );
    return jsonOk({
      sheetTitle: ss.getName(),
      sheetId: SHEET_ID,
      alarmsTab: alarmsSheet.getName(),
      lastRow: lr,
      writtenRow: writtenRow,
      writtenAt: ts,
      cols: {
        address: aIdxAddress,
        city: aIdxCity,
        prov: aIdxProv,
        tenantId: aIdxTenantId,
        timestamp: aIdxTs,
        alarmId: aIdxAlarmId,
        label: aIdxLabel
      },
      headerSeen: aHeader
    });
  } catch (err) {
    return jsonError(String(err));
  }
}

/** =========================
 *  REGISTER DEVICE TOKEN
 *  ========================= */
function handleRegisterDevice(e) {
  e = e || {};
  try {
    var params = parseParams(e);
    var tenantId = getRequiredTenantId(params);
    var volunteerId = (params.volunteerId || '').toString().trim();
    var token = (params.deviceToken || '').toString().trim();
    var platform = (params.platform || 'android').toString().trim();
    if (!volunteerId || !token) return jsonError('Missing volunteerId or deviceToken');
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(TOKENS_SHEET);
    if (!sheet) return jsonError('Sheet TOKENS not found');
    var data = sheet.getDataRange().getValues();
    var header = data[0];
    var idxTenantId = getHeaderIndexOrError(header, 'tenantId', 'TOKENS');
    var idxVolunteerId = getHeaderIndexOrError(header, 'volunteerId', 'TOKENS');
    var idxToken = getHeaderIndexOrError(header, 'deviceToken', 'TOKENS');
    var idxPlatform = header.indexOf('platform');
    var idxLastSeenAt = header.indexOf('lastSeenAt');
    var idxActive = header.indexOf('active');
    var ts = Utilities.formatDate(new Date(), getSheetTimeZone(), 'dd/MM/yyyy HH.mm.ss');
    var updated = false;
    for (var i = 1; i < data.length; i++) {
      if (
        String(data[i][idxTenantId]).trim() === tenantId &&
        String(data[i][idxVolunteerId]).trim() === volunteerId &&
        String(data[i][idxToken]).trim() === token
      ) {
        var rowNum = i + 1;
        if (idxPlatform >= 0) sheet.getRange(rowNum, idxPlatform + 1).setValue(platform);
        if (idxLastSeenAt >= 0) sheet.getRange(rowNum, idxLastSeenAt + 1).setValue(ts);
        if (idxActive >= 0) sheet.getRange(rowNum, idxActive + 1).setValue('TRUE');
        updated = true;
        break;
      }
    }
    if (!updated) {
      var row = [];
      for (var c = 0; c < header.length; c++) row[c] = '';
      row[idxTenantId] = tenantId;
      row[idxVolunteerId] = volunteerId;
      row[idxToken] = token;
      if (idxPlatform >= 0) row[idxPlatform] = platform;
      if (idxLastSeenAt >= 0) row[idxLastSeenAt] = ts;
      if (idxActive >= 0) row[idxActive] = 'TRUE';
      sheet.appendRow(row);
    }
    return jsonOk({});
  } catch (err) {
    return jsonError(String(err));
  }
}

/** =========================
 *  FORCE LOGOUT (ADMIN)
 *  ========================= */
function splitCsvIds(raw) {
  return String(raw || '')
    .split(',')
    .map(function(x) { return String(x || '').trim(); })
    .filter(function(x) { return !!x; });
}

function closeSessionById(sessionsSheet, sHeader, rowNum, loginAtCell, logoutAt, reason) {
  var sIdxLogoutAt = sHeader.indexOf('logoutAt');
  var sIdxClosedBy = sHeader.indexOf('closedBy');
  var sIdxDurationSec = sHeader.indexOf('durationSec');
  var sIdxDurationHours = sHeader.indexOf('durationHours');
  var sIdxLogoutReason = sHeader.indexOf('logoutReason');
  var sIdxLoginAt = sHeader.indexOf('loginAt');
  if (sIdxLogoutAt >= 0) sessionsSheet.getRange(rowNum, sIdxLogoutAt + 1).setValue(logoutAt);
  if (sIdxClosedBy >= 0) sessionsSheet.getRange(rowNum, sIdxClosedBy + 1).setValue(reason);
  if (sIdxLogoutReason >= 0) sessionsSheet.getRange(rowNum, sIdxLogoutReason + 1).setValue(reason);
  if (sIdxDurationSec >= 0 && sIdxLoginAt >= 0) {
    var durationSec = parseDurationSec(loginAtCell, logoutAt);
    if (durationSec >= 0) {
      sessionsSheet.getRange(rowNum, sIdxDurationSec + 1).setValue(durationSec);
      if (sIdxDurationHours >= 0) {
        var durationHours = Math.round((durationSec / 3600) * 100) / 100;
        sessionsSheet.getRange(rowNum, sIdxDurationHours + 1).setValue(durationHours);
      }
    }
  }
}

function handleForceLogoutVolunteers(e) {
  e = e || {};
  try {
    var params = parseParams(e);
    var tenantId = getRequiredTenantId(params);
    var volunteerIds = splitCsvIds(params.volunteerIds);
    if (!volunteerIds.length) return jsonError('Missing volunteerIds');
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var presence = ss.getSheetByName(PRESENCE_SHEET);
    var sessions = ss.getSheetByName(SESSIONS_SHEET);
    var tokens = ss.getSheetByName(TOKENS_SHEET);
    if (!presence) return jsonError('Sheet PRESENCE not found');
    if (!sessions) return jsonError('Sheet SESSIONS not found');
    if (!tokens) return jsonError('Sheet TOKENS not found');
    var now = new Date();
    var logoutAt = Utilities.formatDate(now, getSheetTimeZone(), 'dd/MM/yyyy HH.mm.ss');
    var idsMap = {};
    volunteerIds.forEach(function(id) { idsMap[id] = true; });
    // 1) PRESENCE -> OFFLINE + clear currentSessionId
    var pData = presence.getDataRange().getValues();
    var pHeader = pData[0];
    var pIdxTenantId = getHeaderIndexOrError(pHeader, 'tenantId', 'PRESENCE');
    var pIdxVolunteerId = getHeaderIndexOrError(pHeader, 'volunteerId', 'PRESENCE');
    var pIdxStatus = pHeader.indexOf('status');
    var pIdxLastSeenAt = pHeader.indexOf('lastSeenAt');
    var pIdxCurrentSessionId = pHeader.indexOf('currentSessionId');
    var touched = 0;
    for (var i = 1; i < pData.length; i++) {
      var rowTenant = String(pData[i][pIdxTenantId]).trim();
      var rowVid = String(pData[i][pIdxVolunteerId]).trim();
      if (rowTenant !== tenantId) continue;
      if (!idsMap[rowVid]) continue;
      if (pIdxStatus >= 0) presence.getRange(i + 1, pIdxStatus + 1).setValue('OFFLINE');
      if (pIdxLastSeenAt >= 0) presence.getRange(i + 1, pIdxLastSeenAt + 1).setValue(logoutAt);
      if (pIdxCurrentSessionId >= 0) presence.getRange(i + 1, pIdxCurrentSessionId + 1).setValue('');
      touched++;
    }
    // 2) SESSIONS -> close open sessions for selected volunteers in tenant
    var sData = sessions.getDataRange().getValues();
    var sHeader = sData[0];
    var sIdxTenantId = getHeaderIndexOrError(sHeader, 'tenantId', 'SESSIONS');
    var sIdxVolunteerId = getHeaderIndexOrError(sHeader, 'volunteerId', 'SESSIONS');
    var sIdxLogoutAt = sHeader.indexOf('logoutAt');
    var sIdxLoginAt = sHeader.indexOf('loginAt');
    for (var j = 1; j < sData.length; j++) {
      var sTenant = String(sData[j][sIdxTenantId]).trim();
      var sVid = String(sData[j][sIdxVolunteerId]).trim();
      if (sTenant !== tenantId) continue;
      if (!idsMap[sVid]) continue;
      var alreadyClosed = (sIdxLogoutAt >= 0) ? String(sData[j][sIdxLogoutAt] || '').trim() : '';
      if (alreadyClosed) continue;
      closeSessionById(
        sessions,
        sHeader,
        j + 1,
        sIdxLoginAt >= 0 ? sData[j][sIdxLoginAt] : '',
        logoutAt,
        'forceLogout'
      );
    }
    // 3) TOKENS -> active FALSE for selected volunteers in tenant
    var tData = tokens.getDataRange().getValues();
    var tHeader = tData[0];
    var tIdxTenantId = getHeaderIndexOrError(tHeader, 'tenantId', 'TOKENS');
    var tIdxVolunteerId = getHeaderIndexOrError(tHeader, 'volunteerId', 'TOKENS');
    var tIdxActive = tHeader.indexOf('active');
    if (tIdxActive >= 0) {
      for (var k = 1; k < tData.length; k++) {
        var tTenant = String(tData[k][tIdxTenantId]).trim();
        var tVid = String(tData[k][tIdxVolunteerId]).trim();
        if (tTenant !== tenantId) continue;
        if (!idsMap[tVid]) continue;
        tokens.getRange(k + 1, tIdxActive + 1).setValue('FALSE');
      }
    }
    return jsonOk({ count: touched, logoutAt: logoutAt });
  } catch (err) {
    return jsonError(String(err));
  }
}

/** =========================
 *  FCM HELPERS
 *  ========================= */
// Script Properties richiesti: FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY
function normalizeFcmPrivateKey(rawKey) {
  if (!rawKey || typeof rawKey !== 'string') {
    throw new Error('FCM_PRIVATE_KEY mancante. Imposta la proprietà nello script.');
  }
  var begin = '-----BEGIN PRIVATE KEY-----';
  var end = '-----END PRIVATE KEY-----';
  var k = String(rawKey).trim();
  k = k.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  k = k.replace(/\\n/g, '\n');
  if (k.indexOf(begin) === -1 || k.indexOf(end) === -1) {
    throw new Error('FCM_PRIVATE_KEY non valida (BEGIN/END mancanti).');
  }
  var m = k.match(/-----BEGIN PRIVATE KEY-----([\s\S]*?)-----END PRIVATE KEY-----/);
  if (!m || !m[1]) {
    throw new Error('FCM_PRIVATE_KEY non valida: contenuto interno non trovato.');
  }
  var body = String(m[1]).replace(/\s+/g, '');
  if (!body) {
    throw new Error('FCM_PRIVATE_KEY non valida: body vuoto.');
  }
  return begin + '\n' + body + '\n' + end + '\n';
}

function getFcmAccessToken() {
  var props = PropertiesService.getScriptProperties();
  var projectId = props.getProperty('FCM_PROJECT_ID');
  var clientEmail = props.getProperty('FCM_CLIENT_EMAIL');
  var rawKey = props.getProperty('FCM_PRIVATE_KEY');
  if (!projectId) throw new Error('FCM_PROJECT_ID mancante');
  if (!clientEmail) throw new Error('FCM_CLIENT_EMAIL mancante');
  var privateKey = normalizeFcmPrivateKey(rawKey);
  var now = Math.floor(Date.now() / 1000);
  var header = { alg: 'RS256', typ: 'JWT' };
  var claimSet = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };
  function base64url(obj) {
    var json = JSON.stringify(obj);
    var b64 = Utilities.base64EncodeWebSafe(Utilities.newBlob(json).getBytes());
    return b64.replace(/=+$/, '');
  }
  var unsignedJwt = base64url(header) + '.' + base64url(claimSet);
  var signatureBytes = Utilities.computeRsaSha256Signature(unsignedJwt, privateKey);
  var signature = Utilities.base64EncodeWebSafe(signatureBytes).replace(/=+$/, '');
  var jwt = unsignedJwt + '.' + signature;
  var resp = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    },
    muteHttpExceptions: true
  });
  var json = JSON.parse(resp.getContentText());
  if (!json.access_token) {
    throw new Error('FCM get token failed: ' + resp.getContentText());
  }
  return json.access_token;
}

/**
 * Solo payload `data` (+ android.priority HIGH): così React Native riceve il messaggio in background
 * e può mostrare Notifee con sirena loop + azione Interrompi.
 * title/body finiscono in data.title / data.body (stringhe).
 */
function sendFcmToToken(token, title, body, data) {
  var props = PropertiesService.getScriptProperties();
  var projectId = props.getProperty('FCM_PROJECT_ID');
  if (!projectId) throw new Error('FCM_PROJECT_ID mancante');
  var accessToken = getFcmAccessToken();
  var url = 'https://fcm.googleapis.com/v1/projects/' + projectId + '/messages:send';

  var dataFlat = { title: String(title), body: String(body) };
  var base = data || {};
  for (var k in base) {
    if (base.hasOwnProperty(k)) {
      dataFlat[k] = String(base[k]);
    }
  }

  var payload = {
    message: {
      token: token,
      data: dataFlat,
      android: {
        priority: 'HIGH',
        /** Riduce accavallamenti se arrivano più push in rapida successione. */
        collapse_key: 'allarme_emergency'
      }
    }
  };

  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json; charset=utf-8',
    headers: { Authorization: 'Bearer ' + accessToken },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  var status = resp.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error('FCM send failed: ' + status + ' ' + resp.getContentText());
  }
}

/** Esegui una volta per test push (inserisci token reale). */
function testSendAlarmToOne() {
  var token = 'PUT_REAL_DEVICE_TOKEN_HERE';
  sendFcmToToken(token, 'TEST ALLARME', 'Questo è un test di sirena', {
    alarmId: 'TEST',
    priority: '1',
    tenantId: 'nvansmi'
  });
  Logger.log('Invio test completato.');
}
