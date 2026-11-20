import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AgriOpsApi, ApiError, normalizeApiUrl } from '../mobile/src/services/agriOpsApi.ts';

const farmId = '11111111-1111-1111-1111-111111111111';
const field = { fieldId: '22222222-2222-2222-2222-222222222222', farmId, nazwa: 'Pole A', nr: '1', powierzchnia: 4.2, roslina: null };

test('production API configuration rejects credentials, HTTP and URL parameters', () => {
  for (const url of ['http://example.com', 'https://user:password@example.com', 'https://example.com/api', 'https://example.com?token=secret']) {
    assert.throws(() => normalizeApiUrl(url, false));
  }
  assert.equal(normalizeApiUrl(' https://example.com/ ', false), 'https://example.com');
  assert.equal(normalizeApiUrl('http://10.0.2.2:5000', true), 'http://10.0.2.2:5000');
  assert.throws(() => normalizeApiUrl('http://10.0.2.2:5000', false));
});

test('fields read uses the farm-scoped endpoint and the existing cookie session', async t => {
  let request;
  t.mock.method(globalThis, 'fetch', async (url, options) => { request = { url, options }; return Response.json([field]); });
  const result = await new AgriOpsApi('https://example.com').fields(farmId);
  assert.equal(request.url, `https://example.com/api/farms/${farmId}/fields?includeInactive=false`);
  assert.equal(request.options.credentials, 'include');
  assert.equal(request.options.method, 'GET');
  assert.equal(result[0].nazwa, 'Pole A');
});

test('a cross-farm field response is not displayed', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json([{ ...field, farmId: '33333333-3333-3333-3333-333333333333' }]));
  await assert.rejects(new AgriOpsApi('https://example.com').fields(farmId), /niepoprawne dane pola/);
});

test('authentication failure is surfaced instead of becoming an empty list', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 401 }));
  await assert.rejects(new AgriOpsApi('https://example.com').fields(farmId), error =>
    error instanceof ApiError && error.status === 401 && /Zaloguj się ponownie/.test(error.message));
});

test('malformed fields and invalid farm identifiers are rejected', async t => {
  const mocked = t.mock.method(globalThis, 'fetch', async () => Response.json([{ ...field, powierzchnia: '4.2' }]));
  const api = new AgriOpsApi('https://example.com');
  await assert.rejects(api.fields('not-a-farm'), /Niepoprawny identyfikator/);
  assert.equal(mocked.mock.callCount(), 0);
  await assert.rejects(api.fields(farmId), /niepoprawne dane pola/);
});

test('login sends credentials to the configured server as a cookie-session request', async t => {
  let request;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    request = { url, options };
    return Response.json({});
  });
  await new AgriOpsApi('https://example.com', 'https://app.example.com').login(' test@example.com ', 'test-only');
  assert.equal(request.url, 'https://example.com/api/auth/login');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.credentials, 'include');
  assert.equal(request.options.headers.Origin, 'https://app.example.com');
  assert.deepEqual(JSON.parse(request.options.body), { email: 'test@example.com', password: 'test-only' });
});

test('logout accepts the backend empty 204 response', async t => {
  let headers;
  t.mock.method(globalThis, 'fetch', async (_, options) => {
    headers = options.headers;
    return new Response(null, { status: 204 });
  });
  await new AgriOpsApi('https://example.com', 'https://app.example.com').logout();
  assert.equal(headers.Origin, 'https://app.example.com');
});

test('forbidden access is distinguishable from an expired session', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 403 }));
  await assert.rejects(new AgriOpsApi('https://example.com').fields(farmId), error =>
    error instanceof ApiError && error.status === 403);
});

test('network failure produces an actionable message', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Network request failed'); });
  await assert.rejects(new AgriOpsApi('https://example.com').farms(), /Brak połączenia z serwerem/);
});

test('field boundaries are preserved while missing or invalid shapes do not hide fields', async t => {
  const geometry = { type: 'Polygon', coordinates: [[[19, 52], [19.01, 52], [19.01, 52.01], [19, 52]]] };
  t.mock.method(globalThis, 'fetch', async () => Response.json([
    { ...field, geomJson: JSON.stringify(geometry) },
    { ...field, geomJson: '{invalid' },
    { ...field, geomJson: null },
  ]));
  const result = await new AgriOpsApi('https://example.com').fields(farmId);
  assert.equal(result.length, 3);
  assert.deepEqual(result[0].geometry, geometry);
  assert.equal(result[1].geometry, null);
  assert.equal(result[2].geometry, null);
});
