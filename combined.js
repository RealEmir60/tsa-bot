const fs = require('fs');
const path = require('path');
const express = require('express');
require('dotenv').config();

const indexPath = path.join(__dirname, 'index.js');
let indexCode = fs.readFileSync(indexPath, 'utf8');

// Sadece geçici index.noserver.js kopyası düzenlenir; index.js değiştirilmez.
indexCode = indexCode.replace(/app\.listen\s*\(/g, '// DISABLED_BY_COMBINED app.listen(');
fs.writeFileSync(path.join(__dirname, 'index.noserver.js'), indexCode, 'utf8');

const app = express();
app.use(express.json({ limit: '32kb' }));

const marketModule = require('./market.js');
const registerMarketRoutes = typeof marketModule === 'function'
  ? marketModule
  : marketModule?.registerMarketRoutes;

if (typeof registerMarketRoutes !== 'function') {
  throw new TypeError('market.js registerMarketRoutes export etmiyor');
}
registerMarketRoutes(app);

app.get('/', (_req, res) => res.send('TSA Rank Market aktif'));

const port = Number(process.env.PORT || 10000);
app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Rank Market sunucusu ${port} portunda aktif`);
});

require('./index.noserver.js');
