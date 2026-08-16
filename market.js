const roblox = require('./roblox.js');
require('dotenv').config();

function registerMarketRoutes(app) {
  let giris = false;

  async function login() {
    try {
      await roblox.directLogin(process.env.ROBLOX_COOKIE);
      giris = true;
      console.log(`✅ MARKET BOT: ${roblox.botUserName} (${roblox.botUserId}) giriş yapıldı`);
    } catch (e) {
      giris = false;
      console.error('❌ Market cookie hatası:', e.message);
    }
  }

  login();
  setInterval(login, 30 * 60 * 1000);

  app.get('/market', (_req, res) => res.send('Market Aktif'));
  app.get('/market-status', (_req, res) => res.json({
    marketAktif: true,
    giris,
    botAd: roblox.botUserName,
    botId: roblox.botUserId,
  }));

  app.post('/setrank', async (req, res) => {
    try {
      const { key, userId, rank, groupId } = req.body;
      const expectedKey = process.env.MARKET_KEY || 'key43';
      if (key !== expectedKey) {
        return res.status(403).json({ error: 'Geçersiz anahtar' });
      }
      if (!giris) {
        return res.status(503).json({ error: 'Roblox girişi yok, cookie kontrol et' });
      }

      const gid = String(groupId || process.env.GROUP_ID || '972348115');
      const u = Number.parseInt(userId, 10);
      const r = Number.parseInt(rank, 10);
      // Gerçek Roblox role rank değerleri 1-255 aralığındadır.
      if (!Number.isInteger(u) || !Number.isInteger(r) || r < 1 || r > 255) {
        return res.status(400).json({ error: 'Geçersiz userId veya rank' });
      }

      console.log(`[MARKET İSTEK] ${u} -> rank ${r} / grup ${gid}`);
      await roblox.setRank(gid, u, r);
      console.log(`[MARKET BAŞARILI] ${u} -> rank ${r}`);
      return res.json({ success: true, userId: u, rank: r, groupId: gid });
    } catch (e) {
      console.error('[MARKET HATA]:', e.message);
      return res.status(500).json({ error: e.message });
    }
  });
}

module.exports = { registerMarketRoutes };
