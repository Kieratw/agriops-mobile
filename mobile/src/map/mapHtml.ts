import type { Field } from '../services/agriOpsApi';

type MapField = Pick<Field, 'fieldId' | 'nazwa' | 'geometry'>;
export type MapMarker = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
};

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

export function createMapHtml(
  fields: readonly MapField[] = [],
  markers: readonly MapMarker[] = [],
  selectable = false,
): string {
  const data = safeJson(fields.filter(field => field.geometry).map(field => ({
    id: field.fieldId,
    name: field.nazwa,
    geometry: field.geometry,
  })));
  const markerData = safeJson(markers.filter(marker =>
    Number.isFinite(marker.latitude) && Number.isFinite(marker.longitude) &&
    marker.latitude >= -90 && marker.latitude <= 90 &&
    marker.longitude >= -180 && marker.longitude <= 180
  ).map(marker => ({
    id: String(marker.id),
    label: String(marker.label),
    latitude: marker.latitude,
    longitude: marker.longitude,
  })));

  // Sesja API i dane logowania pozostają poza WebView.
  return `<!doctype html><html lang="pl"><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' https://unpkg.com; style-src 'unsafe-inline' https://unpkg.com; img-src data: https://mapy.geoportal.gov.pl; connect-src 'none'; form-action 'none'; base-uri 'none';">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="anonymous">
<style>html,body,#map{height:100%;margin:0;background:#e8ebe5}body{font-family:system-ui}#message{position:absolute;top:16px;left:50%;transform:translateX(-50%);z-index:1000;background:white;padding:12px 16px;border-radius:8px;max-width:75%;font-size:13px}.leaflet-control-attribution{font-size:10px}</style>
</head><body><div id="map"></div><div id="message">Wczytywanie mapy…</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin="anonymous" onerror="document.getElementById('message').textContent='Nie udało się pobrać mapy. Sprawdź internet.'"></script>
<script>
if (typeof L !== 'undefined') {
  const map = L.map('map', { zoomControl: true, preferCanvas: true }).setView([52.1, 19.4], 7);
  const tiles = L.tileLayer('https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMTS/StandardResolution?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTOFOTOMAPA&STYLE=default&FORMAT=image/jpeg&TILEMATRIXSET=EPSG:3857&TILEMATRIX=EPSG:3857:{z}&TILEROW={y}&TILECOL={x}', {
    minZoom: 6, maxZoom: 19, attribution: '© GUGiK / Geoportal.gov.pl'
  }).addTo(map);
  const features = ${data};
  const points = ${markerData};
  const canSelect = ${selectable ? 'true' : 'false'};
  const shapes = L.featureGroup().addTo(map);
  const sampleLayer = L.featureGroup().addTo(map);
  const byId = Object.create(null);
  const normal = { color: '#d9f78b', weight: 3, fillColor: '#a9d96a', fillOpacity: 0.18 };
  const selected = { color: '#ffffff', weight: 4, fillColor: '#c5ef73', fillOpacity: 0.4 };

  function emitPoint(latlng) {
    if (!canSelect || !latlng || typeof window === 'undefined' || !window.ReactNativeWebView) return;
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'selectPoint',
      latitude: latlng.lat,
      longitude: latlng.lng,
    }));
  }

  features.forEach(function(field) {
    const shape = L.geoJSON(field.geometry, { style: normal }).addTo(shapes);
    const label = document.createElement('span');
    label.textContent = field.name;
    shape.bindTooltip(label, { sticky: true });
    shape.on('click', function(event) {
      if (canSelect && event && event.latlng) {
        emitPoint(event.latlng);
      } else {
        window.agriOpsFocusField(field.id);
      }
    });
    byId[field.id] = shape;
  });

  points.forEach(function(item) {
    const marker = L.circleMarker([item.latitude, item.longitude], {
      radius: 7, color: '#ffffff', weight: 2, fillColor: '#2f5b1e', fillOpacity: 0.95
    }).addTo(sampleLayer);
    if (typeof document !== 'undefined' && marker.bindTooltip) {
      const label = document.createElement('span');
      label.textContent = item.label;
      marker.bindTooltip(label, { permanent: false, direction: 'top' });
    }
  });

  if (canSelect && map.on) {
    map.on('click', function(event) {
      if (event && event.latlng) emitPoint(event.latlng);
    });
  }

  window.agriOpsFocusField = function(id) {
    shapes.eachLayer(function(shape) { shape.setStyle(normal); });
    const target = id ? byId[id] : shapes;
    if (!target) return;
    if (id) target.setStyle(selected);
    const bounds = target.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 17, animate: false });
  };
  window.agriOpsFocusField(null);

  const selectedPin = L.circleMarker([0, 0], {
    radius: 9, color: '#ffffff', weight: 3, fillColor: '#d97706', fillOpacity: 1, interactive: false
  });
  window.agriOpsSelectedPoint = function(point) {
    if (!point || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) {
      selectedPin.remove();
      return;
    }
    selectedPin.setLatLng([point.latitude, point.longitude]).addTo(map).bringToFront();
  };

  const locationDot = L.circleMarker([0, 0], {
    radius: 8, color: '#fff', weight: 3, fillColor: '#1473e6', fillOpacity: 1, interactive: false
  });
  const accuracyRing = L.circle([0, 0], {
    color: '#1473e6', weight: 1, fillOpacity: 0.12, interactive: false
  });
  let centered = false;
  window.agriOpsLocation = function(position, follow) {
    if (!position) {
      locationDot.remove();
      accuracyRing.remove();
      centered = false;
      return;
    }
    const point = [position.latitude, position.longitude];
    if (position.accuracy > 0) {
      accuracyRing.setLatLng(point).setRadius(position.accuracy).addTo(map);
    } else {
      accuracyRing.remove();
    }
    locationDot.setLatLng(point).addTo(map).bringToFront();
    if (follow && !centered) {
      const zoom = position.accuracy > 250 ? 13 : 16;
      map.setView(point, zoom, { animate: false });
    } else if (follow) {
      map.panTo(point, { animate: false });
    }
    centered = follow;
  };

  let loaded = false;
  tiles.on('tileload', function() {
    loaded = true;
    document.getElementById('message').style.display = 'none';
  });
  tiles.on('tileerror', function() {
    if (!loaded) document.getElementById('message').textContent = 'Brak połączenia z Geoportalem. Spróbuj ponownie.';
  });
  setTimeout(function() {
    if (!loaded) document.getElementById('message').textContent = 'Mapa wymaga internetu. Sprawdź połączenie i spróbuj ponownie.';
  }, 15000);
}
</script></body></html>`;
}

export const mapHtml = createMapHtml();
