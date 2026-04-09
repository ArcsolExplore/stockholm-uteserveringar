#!/usr/bin/env node
// Kör: node hamta_uteserveringar.js
// Kräver Node.js 18+ (inbyggd fetch) eller Node 16 med: npm install node-fetch

const API_KEY = '7946eebf-80c4-4361-83c2-8b75b338ab6c';
const OUTPUT_FILE = 'uteserveringar_stockholm.html';

const WFS_URL = `https://openstreetgs.stockholm.se/geoservice/api/${API_KEY}/wfs?` +
  `service=WFS&version=2.0.0&request=GetFeature` +
  `&typeName=od_gis:Markupplatelse_Punkt` +
  `&outputFormat=application/json` +
  `&srsName=EPSG:4326`;

async function main() {
  console.log('Hämtar uteserveringar från Trafikkontoret...');
  
  const res = await fetch(WFS_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  
  const geojson = await res.json();
  const all = geojson.features || [];
  const features = all.filter(f => /uteservering/i.test(f.properties?.Kategorityp || ''));
  const aktiva = features.filter(f => f.properties?.Arkivstatus !== 'Avslutad');
  console.log(`Hittade ${features.length} uteserveringar (${aktiva.length} ej avslutade) av ${all.length} markupplåtelser totalt.`);

  const html = generateHTML(aktiva);
  
  const fs = await import('fs');
  fs.writeFileSync(OUTPUT_FILE, html, 'utf8');
  console.log(`Klar! Öppna filen: ${OUTPUT_FILE}`);
}

function generateHTML(features) {
  const dataJson = JSON.stringify(features);
  return `<!DOCTYPE html>
<html lang="sv">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Uteserveringar i Stockholm</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f0; }
  #header { background: white; border-bottom: 1px solid #e5e5e5; padding: 14px 20px; display: flex; align-items: center; gap: 12px; }
  #header h1 { font-size: 16px; font-weight: 600; color: #111; }
  #count { font-size: 13px; color: #888; background: #f0f0ec; padding: 3px 10px; border-radius: 20px; }
  #map { width: 100%; height: calc(100vh - 53px); }
  .popup-name { font-weight: 600; font-size: 13px; margin-bottom: 3px; }
  .popup-addr { font-size: 12px; color: #555; }
  .popup-date { font-size: 11px; color: #999; margin-top: 4px; }
</style>
</head>
<body>
<div id="header">
  <h1>Uteserveringar i Stockholm</h1>
  <span id="count">Laddar...</span>
  <span style="font-size:12px;color:#aaa;margin-left:auto;">Data: Trafikkontoret, CC0</span>
</div>
<div id="map"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<script>
const features = ${dataJson};
document.getElementById('count').textContent = features.length + ' tillstånd';

const map = L.map('map').setView([59.334, 18.065], 13);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '© OpenStreetMap contributors © CARTO', maxZoom: 19
}).addTo(map);

const icon = L.divIcon({
  className: '',
  html: '<div style="width:11px;height:11px;background:#1D9E75;border:2px solid #085041;border-radius:50%;"></div>',
  iconSize: [11,11], iconAnchor: [5,5]
});

const bounds = [];
features.forEach(f => {
  if (!f.geometry?.coordinates) return;
  const [lng, lat] = f.geometry.coordinates;
  const p = f.properties || {};
  const name = p['Populärnamn'] || p.Plats_1 || 'Uteservering';
  const adress = [p.Plats_1, p.Gatunr_1].filter(Boolean).join(' ');
  const fmt = v => { if (!v) return ''; const s = String(v); return s.length>=8 ? s.substring(0,4)+'-'+s.substring(4,6)+'-'+s.substring(6,8) : s; };
  const from = fmt(p['Tillstånd_from']);
  const to = fmt(p['Tillstånd_tom']);
  
  L.marker([lat, lng], { icon })
    .addTo(map)
    .bindPopup(\`<div style="min-width:180px">
      <div class="popup-name">\${name}</div>
      \${adress ? \`<div class="popup-addr">\${adress}</div>\` : ''}
      \${from||to ? \`<div class="popup-date">\${from}\${to?' – '+to:''}</div>\` : ''}
    </div>\`);
  bounds.push([lat, lng]);
});

if (bounds.length) map.fitBounds(bounds, { padding: [40,40] });
</script>
</body>
</html>`;
}

main().catch(err => {
  console.error('Fel:', err.message);
  process.exit(1);
});
