import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { isPointInsideField, parseFieldGeometry } from '../mobile/src/map/geometry.ts';
import { createMapHtml } from '../mobile/src/map/mapHtml.ts';

const ring = [[19, 52], [19.01, 52], [19.01, 52.01], [19, 52]];

test('polygon and multipolygon retain longitude/latitude order and holes', () => {
  for (const geometry of [
    { type: 'Polygon', coordinates: [ring, ring] },
    { type: 'MultiPolygon', coordinates: [[ring], [ring]] },
  ]) {
    assert.deepEqual(parseFieldGeometry(JSON.stringify(geometry)), geometry);
  }
});

test('point-in-field check accepts points inside polygon and within 5m tolerance, rejects outside or inside hole', () => {
  const square = {
    type: 'Polygon',
    coordinates: [
      [[19.0, 52.0], [19.01, 52.0], [19.01, 52.01], [19.0, 52.01], [19.0, 52.0]],
      [[19.004, 52.004], [19.006, 52.004], [19.006, 52.006], [19.004, 52.006], [19.004, 52.004]],
    ],
  };
  assert.equal(isPointInsideField(square, 52.002, 19.002), true);
  assert.equal(isPointInsideField(square, 52.0, 19.005), true);
  // ~2 meters outside southern boundary (within 5m tolerance)
  assert.equal(isPointInsideField(square, 51.99998, 19.005), true);
  // Outside polygon (> 5m)
  assert.equal(isPointInsideField(square, 51.999, 19.005), false);
  // Inside inner hole (> 5m from hole edge)
  assert.equal(isPointInsideField(square, 52.005, 19.005), false);
});

test('unsupported, unclosed and out-of-range geometry is rejected', () => {
  for (const value of [null, '', '{bad', 'null',
    JSON.stringify({ type: 'Point', coordinates: [19, 52] }),
    JSON.stringify({ type: 'Polygon', coordinates: [[...ring.slice(0, 3), [20, 53]]] }),
    JSON.stringify({ type: 'Polygon', coordinates: [[[190, 52], ...ring.slice(1)]] }),
    JSON.stringify({ type: 'Polygon', coordinates: [[['19', 52], ...ring.slice(1)]] }),
    JSON.stringify({ type: 'MultiPolygon', coordinates: [] }),
  ]) assert.equal(parseFieldGeometry(value), null);
});

test('oversized geometry is rejected before rendering', () => {
  assert.equal(parseFieldGeometry(' '.repeat(2_000_001)), null);
  const geometry = { type: 'Polygon', coordinates: [Array.from({ length: 50_001 }, () => [19, 52])] };
  assert.equal(parseFieldGeometry(JSON.stringify(geometry)), null);
});

test('untrusted names cannot escape the map script or become HTML', () => {
  const name = '</script><script>globalThis.compromised=true</script>\u2028';
  const html = createMapHtml([{
    fieldId: '22222222-2222-2222-2222-222222222222', nazwa: name,
    geometry: { type: 'Polygon', coordinates: [ring] },
    token: 'not-for-webview',
  }]);
  assert.equal(html.includes(name), false);
  assert.equal(html.includes('not-for-webview'), false);
  assert.ok(html.includes('label.textContent = field.name'));
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 2);
  for (const [, script] of scripts) assert.doesNotThrow(() => new Script(script));
  assert.ok(html.includes('connect-src \'none\''));
});

test('live location centers once, follows updates, and clears both layers', () => {
  const window = {};
  const moves = [];
  const map = {
    setView(point, zoom) { moves.push(['center', ...point, zoom]); return this; },
    panTo(point) { moves.push(['pan', ...point]); },
  };
  function layer() {
    return {
      visible: false,
      addTo() { this.visible = true; return this; },
      setLatLng(point) { this.point = [...point]; return this; },
      setRadius(radius) { this.radius = radius; return this; },
      bringToFront() { return this; },
      remove() { this.visible = false; },
    };
  }
  const dot = layer();
  const ring = layer();
  const L = {
    map: () => map,
    tileLayer: () => ({ addTo() { return this; }, on() {} }),
    featureGroup: () => ({
      addTo() { return this; },
      eachLayer() {},
      getBounds: () => ({ isValid: () => false }),
    }),
    circleMarker: () => dot,
    circle: () => ring,
  };
  const script = createMapHtml().match(/<script>([\s\S]*?)<\/script>/)[1];
  new Script(script).runInNewContext({ L, window, setTimeout() {} });
  moves.length = 0;
  window.agriOpsLocation({ latitude: 52, longitude: 19, accuracy: 20 }, true);
  window.agriOpsLocation({ latitude: 52.01, longitude: 19, accuracy: 15 }, true);
  window.agriOpsLocation({ latitude: 52.02, longitude: 19, accuracy: 10 }, false);
  assert.deepEqual(moves, [['center', 52, 19, 16], ['pan', 52.01, 19]]);
  assert.deepEqual(dot.point, [52.02, 19]);
  assert.equal(ring.radius, 10);
  window.agriOpsLocation(null, false);
  assert.equal(dot.visible, false);
  assert.equal(ring.visible, false);
});
