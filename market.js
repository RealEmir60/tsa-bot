const roblox = require('./roblox.js');
require('dotenv').config();

// ===== roblox.js arayüz doğrulaması =====
// Yanlış/eksik export varsa sunucu hiç açılmasın; hatayı ilk saniyede göster.
const requiredExports = ['directLogin', 'setRank', 'botUserName', 'botUserId'];
for (const name of requiredExports) {
  if (roblox[name] === undefined) {
    console.error(`❌ roblox.js içinde '${name}' bulunamadı!`);
    console.error('   roblox.js şunları sağlamalı:');
    console.error('   - directLogin(cookie)      -> bot girişi');
    console.error('   - setRank(groupId, userId, rankId) -> rütbe değiştirme');
    console.error('   - botUserName / botUserId  -> giriş yapınca bot bilgileri');
    console.error('   Örnek bir roblox.js paketteki "roblox.js.ornek" dosyasındadır.');
    process.exit(1);
  }
}

// Roblox aynı anda çok fazla rank değiştirme isteğine karşı hesabı geçici olarak
// kısıtlayabilir. Bu yüzden gelen /setrank istekleri paralel değil, sırayla ve
// aralarında minimum bir gecikmeyle işlenir.
const MIN_GAP_MS = 1200;
let queue = Promise.resolve();
let lastRunAt = 0;

function enqueue(task) {
  const run = () => {
    const wait = Math.max(0, lastRunAt + MIN_GAP_MS - Date.now());
    return new Promise((resolve) => setTimeout(resolve, wait)).then(() => {
      lastRunAt = Date.now();
      return task();
    });
  };
  const result = queue.then(run, run);
  // Bir istek hata verirse kuyruğun geri kalanını kilitlememesi için yut.
  queue = result.catch(() => {});
  return result;
}

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

// Zaman aşımı koruması: Roblox API'si (noblox) cevap vermezse istek sonsuza dek
// beklemesin. Aksi halde /setrank 45 sn+ bekletir, oyunda "bağlantı kurulamadı"
// hatası görünür ve kuyruk asılı isteğin arkasında KİLİTLENİR.
function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(label + ' zaman aşımı (' + Math.floor(ms / 1000) + ' sn)')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function registerMarketRoutes(app) {
  let loggedIn = false;
  let loginInProgress = false;

  async function login() {
    if (loginInProgress) return; // aynı anda iki giriş başlatma
    loginInProgress = true;
    try {
      await withTimeout(roblox.directLogin(process.env.ROBLOX_COOKIE), 20000, 'Roblox giriş');
      loggedIn = true;
      log(`✅ RANK MARKET BOT: ${roblox.botUserName} (${roblox.botUserId}) giriş yaptı`);
    } catch (error) {
      loggedIn = false;
      console.error('❌ Roblox bot girişi başarısız:', error.message);
      // Render yeniden başlattıktan sonra ilk giriş bazen patlar; 15 sn sonra tekrar dene.
      setTimeout(login, 15000);
    } finally {
      loginInProgress = false;
    }
  }

  void login();
  setInterval(login, 30 * 60 * 1000); // oturumu taze tut

  app.get('/market-status', (_req, res) => {
    res.json({
      marketAktif: true,
      giris: loggedIn,
      botAd: roblox.botUserName,
      botId: roblox.botUserId,
      calismaSuresi: Math.floor(process.uptime()) + ' sn',
    });
  });

  app.post('/setrank', async (req, res) => {
    const expectedKey = process.env.MARKET_KEY || 'key43';
    const userId = Number.parseInt(req.body?.userId, 10);
    const rank = Number.parseInt(req.body?.rank, 10);
    const groupId = String(req.body?.groupId || process.env.GROUP_ID || '972348115');

    if (req.body?.key !== expectedKey) return res.status(403).json({ success: false, error: 'Geçersiz anahtar' });
    if (!loggedIn) return res.status(503).json({ success: false, error: 'Roblox botu giriş yapmadı, birazdan tekrar dene' });
    if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ success: false, error: 'Geçersiz userId' });
    if (!Number.isInteger(rank) || rank < 1 || rank > 255) return res.status(400).json({ success: false, error: 'Geçersiz rank' });
    if (process.env.GROUP_ID && String(groupId) !== String(process.env.GROUP_ID)) {
      return res.status(400).json({ success: false, error: 'Grup ID uyuşmuyor' });
    }

    log(`[RANK MARKET İSTEK] userId=${userId} rank=${rank} grup=${groupId}`);

    try {
      const result = await enqueue(async () => {
        log(`[RANK MARKET] ${userId} -> ${rank} / grup ${groupId}`);
        await withTimeout(roblox.setRank(groupId, userId, rank), 20000, 'Roblox setRank');
        log(`[RANK MARKET BAŞARILI] ${userId} -> ${rank}`);
        return { success: true, userId, rank, groupId };
      });
      return res.json(result);
    } catch (error) {
      console.error('[RANK MARKET HATA]', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  });
}

module.exports = registerMarketRoutes;
module.exports.registerMarketRoutes = registerMarketRoutes;
