const fs = require('fs');
const path = require('path');
const express = require('express');
require('dotenv').config();

const indexPath = path.join(__dirname, 'index.js');
let indexCode;
try {
  indexCode = fs.readFileSync(indexPath, 'utf8');
} catch (error) {
  console.error(`⚠️ index.js okunamadı (${indexPath}):`, error.message);
  console.error('   Bu dosya Render projesinde durmalı (mevcut webhook/bot sunucun).');
  process.exit(1);
}

// index.js'teki app.listen çağrısını devre dışı bırak (port çakışması olmasın).
// index.js'in KENDİSİ değiştirilmez; geçici index.noserver.js kopyası üzerinde yapılır.
indexCode = indexCode.replace(/app\.listen\s*\(/g, '// DISABLED_BY_COMBINED app.listen(');
fs.writeFileSync(path.join(__dirname, 'index.noserver.js'), indexCode, 'utf8');

const app = express();
app.use(express.json({ limit: '32kb' }));

// Bozuk/eksik JSON gövdesi gelirse express 400 HTML döndürür; Roblox tarafı bunu
// JSONDecode ile okuyamaz ve "başarısız cevap" sanır. Bunun yerine JSON hata dön.
app.use((err, _req, res, _next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'JSON gövdesi okunamadı' });
  }
  return res.status(500).json({ success: false, error: 'Sunucu hatası' });
});

const marketModule = require('./market.js');
const registerMarketRoutes = typeof marketModule === 'function'
  ? marketModule
  : marketModule?.registerMarketRoutes;

if (typeof registerMarketRoutes !== 'function') {
  throw new TypeError('market.js registerMarketRoutes export etmiyor');
}
registerMarketRoutes(app);

app.get('/', (_req, res) => res.send('TSA Rank Market aktif'));

// index.js'teki rotaları yükle. Hata verirse market yine de ayakta kalmalı.
try {
  require('./index.noserver.js');
} catch (error) {
  console.error('⚠️ index.noserver.js yüklenemedi (rank market çalışmaya devam eder):', error.message);
}

const port = Number(process.env.PORT || 10000);
app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Rank Market sunucusu ${port} portunda aktif`);
  console.log('   Rotalar: GET /market-status, POST /setrank, GET /');
});
