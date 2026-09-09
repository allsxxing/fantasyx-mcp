// gcal.mjs — minimal Google Calendar v3 REST client authenticated via a service-account
// JWT bearer grant. Deliberately dependency-free (no `googleapis`): this repo is
// conviction-minimal on deps, and four HTTP calls a day don't justify that package's
// transitive surface. Uses only Node 20 built-ins (node:crypto).
//
// Auth: RFC 7523 JWT bearer grant — build a signed JWT asserting the service account as
// issuer, exchange it at Google's token endpoint for a short-lived access token, then call
// the Calendar API with it as a normal Bearer token. No refresh-token persistence problem
// (unlike src/connectors/mcp-proxy.ts's OAuth refresh flow) because a service account
// mints a fresh token every run from its own private key.

import { createSign } from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Exchange a service-account key (the parsed JSON, not the raw string) for a short-lived
 * OAuth access token via the JWT bearer grant.
 * @param {{ client_email: string, private_key: string }} serviceAccount
 */
export async function getAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: serviceAccount.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(serviceAccount.private_key).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const jwt = `${unsigned}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`gcal: token exchange failed (${res.status}): ${await res.text()}`);
  }
  const json = await res.json();
  return json.access_token;
}

async function calendarFetch(accessToken, path, init = {}) {
  const res = await fetch(`${CALENDAR_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  return res;
}

/** GET a single event by its client-assigned id. Returns null on 404/410 (does not exist). */
export async function getEvent(accessToken, calendarId, eventId) {
  const res = await calendarFetch(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`);
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) throw new Error(`gcal: GET event ${eventId} failed (${res.status}): ${await res.text()}`);
  return res.json();
}

/**
 * Upsert an event by its client-assigned deterministic id: PATCH if it exists, POST
 * (insert, with that id) if it does not (404/410). Never lists or deletes — this function
 * can only ever touch the exact id it's given.
 */
export async function upsertEvent(accessToken, calendarId, eventId, body) {
  const existing = await getEvent(accessToken, calendarId, eventId);
  if (existing) {
    const res = await calendarFetch(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`gcal: PATCH event ${eventId} failed (${res.status}): ${await res.text()}`);
    return { action: 'patched', event: await res.json() };
  }
  const res = await calendarFetch(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    body: JSON.stringify({ id: eventId, ...body }),
  });
  if (!res.ok) throw new Error(`gcal: POST event ${eventId} failed (${res.status}): ${await res.text()}`);
  return { action: 'inserted', event: await res.json() };
}
