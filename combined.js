// combined.js - INDEX'E DOKUNMADAN CALISIR, PORT CAKISMASI YOK
const fs = require('fs');
const path = require('path');

// 1. index.js'i oku, içindeki app.listen'i etkisiz hale getir (diskteki dosya değişmez, sadece hafızada)
const indexPath = path.join(__dirname, 'index.js');
let indexCode = fs.readFileSync(indexPath, 'utf-8');

// app.listen satırını bul ve yorum yap - diskteki orijinal bozulmaz
indexCode = indexCode.replace(/app\.listen\s*\(/g, '// APP.LISTEN DEVRE DISI - COMBINED YONETIYOR - app.listen(');

const tempPath = path.join(__dirname, 'index.noserver.js');
fs.writeFileSync(tempPath, indexCode);

console.log('✅ index.js serveri devre dışı bırakıldı (diskteki dosya bozulmadı)');

// 2. Market API için tek server
const express = require('express');
const app = express();
app.use(express.json());

const roblox = require('./roblox.js');
require('dotenv').config();

let giris = false;
async function login() {
  try {
    await roblox.directLogin(process.env.ROBLOX_COOKIE);
    giris = true;
    console.log(`✅ MARKET BOT: ${roblox.botUserName} giriş yaptı`);
  } catch(e) {
    console.error('Market login hata:', e.message);
    giris = false;
  }
}
login();
setInterval(login, 30*60*1000);

app.get('/', (req,res) => res.send('OK - TSA Bot + Market Aktif'));
app.get('/market', (req,res) => res.send('Market Aktif'));
app.get('/market-status', (req,res) => res.json({ marketAktif: true, giris, botAd: roblox.botUserName, botId: roblox.botUserId }));

app.post('/setrank', async (req,res) => {
  try {
    const { key, userId, rank, groupId } = req.body;
    console.log(`[MARKET] ${userId} -> ${rank}`);
    if (key !== 'key43') return res.status(403).json({error:'Gecersiz anahtar'});
    if (!giris) return res.status(500).json({error:'Roblox girisi yok'});
    const gid = groupId || process.env.GROUP_ID || '972348115';
    await roblox.setRank(gid, parseInt(userId), parseInt(rank));
    console.log(`[MARKET BASARILI] ${userId} -> ${rank}`);
    res.json({success:true});
  } catch(e) {
    console.error('[MARKET HATA]:', e.message);
    res.status(500).json({error:e.message});
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`✅ TEK SERVER PORT ${PORT} - Hem Discord hem Market aktif`));

// 3. Discord botu başlat (server açmadan)
require('./index.noserver.js');
