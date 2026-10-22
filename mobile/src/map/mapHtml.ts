// Mapa korzysta z publicznych danych; nie przekazujemy do niej sesji API.
export const mapHtml = `<!doctype html><html lang="pl"><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' https://unpkg.com; style-src 'unsafe-inline' https://unpkg.com; img-src data: https://mapy.geoportal.gov.pl; connect-src 'none';">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="anonymous">
<style>html,body,#map{height:100%;margin:0;background:#e8ebe5}body{font-family:system-ui}#message{position:absolute;top:16px;left:50%;transform:translateX(-50%);z-index:1000;background:white;padding:12px 16px;border-radius:8px;max-width:75%;font-size:13px} .leaflet-control-attribution{font-size:10px}</style>
</head><body><div id="map"></div><div id="message">Wczytywanie mapy…</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin="anonymous" onerror="document.getElementById('message').textContent='Nie udało się pobrać mapy. Sprawdź internet.'"></script>
<script>
if(typeof L!=='undefined'){
const map=L.map('map',{zoomControl:true}).setView([52.1,19.4],7);
const tiles=L.tileLayer('https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMTS/StandardResolution?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTOFOTOMAPA&STYLE=default&FORMAT=image/jpeg&TILEMATRIXSET=EPSG:3857&TILEMATRIX=EPSG:3857:{z}&TILEROW={y}&TILECOL={x}',{minZoom:6,maxZoom:19,attribution:'© GUGiK / Geoportal.gov.pl'}).addTo(map);
let loaded=false;
tiles.on('tileload',()=>{loaded=true;document.getElementById('message').style.display='none'});
tiles.on('tileerror',()=>{if(!loaded){document.getElementById('message').textContent='Brak połączenia z Geoportalem. Spróbuj ponownie.'}});
setTimeout(()=>{if(!loaded)document.getElementById('message').textContent='Mapa wymaga internetu. Sprawdź połączenie i spróbuj ponownie.'},15000);
}
</script></body></html>`;
