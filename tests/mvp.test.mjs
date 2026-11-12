import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AgriOpsApi } from '../mobile/src/services/agriOpsApi.ts';
import {
  clearOwnerLocalData,
  loadObservationDraft,
  loadSoilSampleDraft,
  pruneTerminalReports,
  saveObservationDraft,
  saveSoilSampleDraft,
} from '../mobile/src/services/secureDrafts.ts';

const farmId = '11111111-1111-1111-1111-111111111111';
const fieldId = '22222222-2222-2222-2222-222222222222';
const soilTestId = '33333333-3333-3333-3333-333333333333';
const otherId = '44444444-4444-4444-4444-444444444444';

function createMemoryStorage() {
  const map = new Map();
  return {
    map,
    async getItemAsync(key) { return map.get(key) ?? null; },
    async setItemAsync(key, value) { map.set(key, value); },
    async deleteItemAsync(key) { map.delete(key); },
  };
}

test('soil tests and sample points validate farm isolation and send normalized coordinates', async t => {
  const samplePoint = {
    soilSamplePointId: otherId,
    fieldId,
    fieldName: 'Pole A',
    sampleLabel: 'P1',
    latitude: 52.002,
    longitude: 19.002,
    gpsAccuracyMeters: null,
    depthCmFrom: 0,
    depthCmTo: 20,
    soilType: 'Średnia',
    ph: 6.4,
    p2O5MgPer100g: 15.2,
    k2OMgPer100g: 18.0,
    mgMgPer100g: 7.5,
    notes: 'Ręczny punkt z mapy',
  };
  const soilTest = {
    soilTestId,
    farmId,
    sampleDate: '2026-11-12',
    labName: 'OSChR',
    sourceType: 'MANUAL',
    status: 'COMPLETED',
    samplePointCount: 1,
    notes: 'Jesień',
    samplePoints: [samplePoint],
  };

  const requests = [];
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith('/soil-tests')) {
      return Response.json(options?.method === 'POST' ? soilTest : [soilTest], { status: options?.method === 'POST' ? 201 : 200 });
    }
    return Response.json(soilTest, { status: 200 });
  });

  const api = new AgriOpsApi('https://example.com', 'https://app.example.com');
  const list = await api.soilTests(farmId);
  assert.equal(list.length, 1);
  assert.equal(list[0].samplePointCount, 1);

  const detail = await api.soilTest(farmId, soilTestId);
  assert.equal(detail.samplePoints[0].sampleLabel, 'P1');

  const created = await api.createSoilTest(farmId, {
    sampleDate: '2026-11-12',
    labName: 'OSChR',
    status: 'COMPLETED',
    samplePoints: [{
      fieldId,
      sampleLabel: 'P1',
      latitude: 52.002,
      longitude: 19.002,
      depthCmFrom: 0,
      depthCmTo: 20,
      ph: 6.4,
    }],
  });
  assert.equal(created.soilTestId, soilTestId);

  const updated = await api.addSoilSamplePoint(farmId, soilTestId, {
    fieldId,
    sampleLabel: 'P1',
    latitude: 52.002,
    longitude: 19.002,
    depthCmFrom: 0,
    depthCmTo: 20,
  });
  assert.equal(updated.samplePoints[0].sampleLabel, 'P1');
  assert.equal(requests[3].url, `https://example.com/api/farms/${farmId}/soil-tests/${soilTestId}/sample-points`);

  fetch.mock.mockImplementation(async () => Response.json([{ ...soilTest, farmId: otherId }]));
  await assert.rejects(api.soilTests(farmId), /niepoprawne dane próby glebowej/);
});

test('soil cultivation order creation and approval enforce farm and field scope', async t => {
  const operation = {
    fieldOperationId: otherId,
    farmId,
    operationType: 'SOIL_CULTIVATION',
    operationDate: '2026-11-12',
    status: 'PLANNED',
    isAllDay: true,
    fields: [{ fieldId, fieldName: 'Pole A', areaHa: 4.2 }],
    machines: [{ machineId: soilTestId, machineName: 'John Deere 6155M' }],
    notes: 'Przejazd agregatem',
  };

  let lastRequest;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    lastRequest = { url, options };
    return Response.json(options?.method === 'PATCH' ? { ...operation, status: 'COMPLETED' } : [operation]);
  });

  const api = new AgriOpsApi('https://example.com', 'https://app.example.com');
  const list = await api.operations(farmId, fieldId);
  assert.equal(list.length, 1);
  assert.deepEqual(list[0].machineNames, ['John Deere 6155M']);
  assert.equal(list[0].totalAreaHa, 4.2);

  const approved = await api.approveOperation(farmId, otherId);
  assert.equal(approved.status, 'COMPLETED');
  assert.equal(lastRequest.url, `https://example.com/api/farms/${farmId}/documentation/${otherId}/status`);
});

test('observation photo preview converts image stream to in-memory data URI and rejects non-image content', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(new Uint8Array([137, 80, 78, 71]), {
    status: 200,
    headers: { 'content-type': 'image/png' },
  }));
  const api = new AgriOpsApi('https://example.com');
  const uri = await api.observationPhotoDataUri(farmId, fieldId, otherId);
  assert.match(uri, /^data:image\/png;base64,/);

  fetch.mock.mockImplementation(async () => new Response('html', {
    status: 200,
    headers: { 'content-type': 'text/html' },
  }));
  await assert.rejects(api.observationPhotoDataUri(farmId, fieldId, otherId), /nieobsługiwany format obrazu/);
});

test('terminal reports are pruned to the newest entries', async () => {
  const reports = {};
  for (let i = 0; i < 15; i++) {
    reports[`job${i}`] = { jobId: `job${i}`, startedAtUtc: `2026-11-${String(i + 1).padStart(2, '0')}T08:00:00Z`,
      finishedAtUtc: null, areaHa: '', hours: '', note: '', submittedAtUtc: null };
  }
  const kept = pruneTerminalReports(reports);
  assert.equal(Object.keys(kept).length, 10);
  assert.ok(kept.job14 && !kept.job0);
});

test('secure drafts persist soil and observation drafts and wipe all tracked owner items on logout', async () => {
  const storage = createMemoryStorage();
  await saveSoilSampleDraft(storage, {
    farmId,
    fieldId,
    sampleDate: '2026-11-12',
    labName: 'OSChR',
    status: 'DRAFT',
    notes: 'Szkic',
    reminderEnabled: true,
    updatedAtUtc: '2026-11-12T10:00:00Z',
    points: [{
      sampleLabel: 'P1',
      latitude: 52.002,
      longitude: 19.002,
      gpsAccuracyMeters: null,
      locationSource: 'manual',
      depthCmFrom: '0',
      depthCmTo: '20',
      soilType: 'Średnia',
      ph: '6.5',
      p2O5: '',
      k2O: '',
      mg: '',
      notes: '',
    }],
  });
  await saveObservationDraft(storage, {
    farmId,
    fieldId,
    fieldCropId: soilTestId,
    note: 'Szkic obserwacji',
    latitude: 52.002,
    longitude: 19.002,
    accuracy: 4,
    locationSource: 'gps',
    updatedAtUtc: '2026-11-12T10:00:00Z',
  });

  assert.equal((await loadSoilSampleDraft(storage, farmId, fieldId))?.points[0].locationSource, 'manual');
  assert.equal((await loadObservationDraft(storage, farmId, otherId)), null);
  assert.equal((await loadObservationDraft(storage, farmId, soilTestId))?.note, 'Szkic obserwacji');

  await clearOwnerLocalData(storage);
  assert.equal(await loadSoilSampleDraft(storage, farmId, fieldId), null);
  assert.equal(await loadObservationDraft(storage, farmId, soilTestId), null);
  assert.equal(storage.map.size, 0);
});
