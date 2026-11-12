import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../mobile/src/config.ts';
import { fetchTerminalDashboard, pairingCodeFromUrl, redeemPairing } from '../mobile/src/services/terminalApi.ts';

const code = 'a'.repeat(43);

test('Android accepts the expected HTTPS pairing link and its fragment only', () => {
  const origin = new URL(config.appOrigin).origin;
  assert.equal(pairingCodeFromUrl(`${origin}/terminal/pair#${code}`), code);
  assert.equal(pairingCodeFromUrl(` ${origin}/terminal/pair#${code}\n`), code);
  assert.equal(pairingCodeFromUrl(code), null);
  for (const url of [
    `http://${new URL(origin).host}/terminal/pair#${code}`,
    `https://outside.example/terminal/pair#${code}`,
    `${origin}/terminal/pair/another#${code}`,
    `${origin}/terminal/pair?code=${code}`,
    `${origin}/terminal/pair?redirect=elsewhere#${code}`,
    `${origin}/terminal/pair#short`,
  ]) assert.equal(pairingCodeFromUrl(url), null);
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
