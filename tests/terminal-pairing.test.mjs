import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../mobile/src/config.ts';
import {
  fetchTerminalDashboard,
  fieldDeepLinkFromUrl,
  pairingCodeFromInput,
  pairingCodeFromUrl,
  redeemPairing,
} from '../mobile/src/services/terminalApi.ts';

const code = 'a'.repeat(43);
const fieldId = '22222222-2222-2222-2222-222222222222';

test('Android accepts the expected HTTPS pairing link, raw code input, and verified field deep links', () => {
  const origin = new URL(config.appOrigin).origin;
  assert.equal(pairingCodeFromUrl(`${origin}/terminal/pair#${code}`), code);
  assert.equal(pairingCodeFromInput(` ${origin}/terminal/pair#${code} `), code);
  assert.equal(pairingCodeFromInput(` #${code} `), code);
  assert.equal(pairingCodeFromInput(code), code);
  for (const url of [
    `http://${new URL(origin).host}/terminal/pair#${code}`,
    `https://outside.example/terminal/pair#${code}`,
    `${origin}/terminal/pair/another#${code}`,
    `${origin}/terminal/pair?code=${code}`,
    `${origin}/terminal/pair?redirect=elsewhere#${code}`,
    `${origin}/terminal/pair#short`,
  ]) assert.equal(pairingCodeFromUrl(url), null);

  assert.equal(fieldDeepLinkFromUrl(`${origin}/fields/${fieldId}`), fieldId);
  assert.equal(fieldDeepLinkFromUrl(`${origin}/fields/${fieldId}?extra=1`), null);
  assert.equal(fieldDeepLinkFromUrl(`https://outside.example/fields/${fieldId}`), null);
  assert.equal(fieldDeepLinkFromUrl(`${origin}/fields/not-a-uuid`), null);
});

test('phone polls the terminal API without cookies and sends a session token only to the dashboard', async t => {
  t.mock.property(config, 'apiUrl', 'https://api.example.test');
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, ...options });
    return url.endsWith('/redeem') ? new Response(null, { status: 204 }) : new Response(null, { status: 401 });
  });
  const claim = { code, secret: 'b'.repeat(64) };
  const token = 'c'.repeat(64);
  const signal = new AbortController().signal;
  assert.equal(await redeemPairing(claim, signal), null);
  await assert.rejects(fetchTerminalDashboard(token, signal), { status: 401 });
  assert.equal(requests[0].url, 'https://api.example.test/api/terminal/pairing/redeem');
  assert.deepEqual(JSON.parse(requests[0].body), claim);
  assert.equal(requests[0].credentials, 'omit');
  assert.equal(requests[1].url, 'https://api.example.test/api/terminal/dashboard');
  assert.equal(requests[1].headers.Authorization, `Terminal ${token}`);
});
