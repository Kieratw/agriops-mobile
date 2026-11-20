import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AgriOpsApi } from '../mobile/src/services/agriOpsApi.ts';

const farmId = '11111111-1111-1111-1111-111111111111';
const fieldId = '22222222-2222-2222-2222-222222222222';
const fieldCropId = '33333333-3333-3333-3333-333333333333';
const otherId = '44444444-4444-4444-4444-444444444444';
const crop = { farmId, fieldId, fieldCropId, cropName: 'Pszenica', activeFrom: '2026-08-01' };
const observation = {
  farmId, fieldId, fieldCropId, observationId: otherId, observedAtUtc: '2026-11-12T06:00:00Z',
  note: 'Wschody', photos: [{}],
};

test('field cards are restricted to the selected field and fail closed for a foreign farm', async t => {
  const otherField = { ...crop, fieldId: otherId };
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json([otherField, crop]));
  const api = new AgriOpsApi('https://example.com');
  assert.deepEqual(await api.fieldCrops(crop), [crop]);
  assert.match(fetch.mock.calls[0].arguments[0], new RegExp(`/farms/${farmId}/field-cards\\?mode=open`));
  fetch.mock.mockImplementation(async () => Response.json([{ ...crop, farmId: otherId }]));
  await assert.rejects(api.fieldCrops(crop), /niepoprawne dane uprawy/);
});

test('observation history rejects a foreign farm, field, or cycle', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ items: [observation] }));
  const api = new AgriOpsApi('https://example.com');
  assert.equal((await api.observations(crop))[0].photoCount, 1);
  for (const key of ['farmId', 'fieldId', 'fieldCropId']) {
    fetch.mock.mockImplementation(async () => Response.json({ items: [{ ...observation, [key]: otherId }] }));
    await assert.rejects(api.observations(crop), /niepoprawne dane obserwacji/);
  }
});

test('observation upload preserves cookie and Origin and lets native fetch set the multipart boundary', async t => {
  // Native FormData accepts a URI descriptor. Stub append to inspect it before serialization.
  const append = t.mock.method(FormData.prototype, 'append', () => {});
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json(observation, { status: 201 }));
  const api = new AgriOpsApi('https://api.example.com', 'https://example.com');
  const photo = { uri: 'file:///cache/photo.jpg', name: 'obserwacja.jpg', type: 'image/jpeg' };
  const result = await api.createObservation(crop, '  Wschody  ', photo, { latitude: 50, longitude: 19, accuracy: null });
  const [[url, request]] = fetch.mock.calls.map(call => call.arguments);
  assert.equal(url, `https://api.example.com/api/farms/${farmId}/field-crops/${fieldCropId}/observations`);
  assert.equal(request.method, 'POST');
  assert.equal(request.credentials, 'include');
  assert.equal(request.headers.Origin, 'https://example.com');
  assert.equal(request.headers['Content-Type'], undefined);
  assert.ok(request.body instanceof FormData);
  assert.deepEqual(append.mock.calls.slice(1).map(call => call.arguments), [
    ['note', 'Wschody'], ['photos', photo], ['latitude', '50'], ['longitude', '19'],
  ]);
  assert.equal(result.observationId, observation.observationId);
});
