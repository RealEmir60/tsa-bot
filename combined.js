const fs = require('fs');
const path = require('path');
const express = require('express');
require('dotenv').config();

const indexPath = path.join(__dirname, 'index.js');
let indexCode = fs.readFileSync(indexPath, 'utf8');

// index.js diskte değişmez; yalnızca hafızadaki kopyasında app.listen etkisizleştirilir.
indexCode = indexCode.replace(
  /app\.listen\s*\(/g,
  '// APP.LISTEN DEVRE DISI - COMBINED YONETIYOR - app.listen('
);

const tempPath = path.join(__dirname, 'index.noserver.js');
fs.writeFileSync(tempPath, indexCode, 'utf8');
console.log('✅ index.js serveri devre dışı bırakıldı; orijinal dosya değişmedi');

const app = express();
app.use(express.json({ limit: '32kb' }));

const marketModule = require('./market.js');
const registerMarketRoutes = typeof marketModule === 'function'
  ? marketModule
  : marketModule && marketModule.registerMarketRoutes;

if (typeof registerMarketRoutes !== 'function') {
  throw new TypeError('market.js registerMarketRoutes fonksiyonunu export etmiyor. Güncel market.js dosyasını yükleyin.');
}
registerMarketRoutes(app);

app.get('/', (_req, res) => res.send('OK - TSA Bot + Rütbe Market Aktif'));

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ TEK SERVER PORT ${PORT} - Discord ve market aktif`);
});

// Discord botu server açmadan başlatır.
require('./index.noserver.js');
