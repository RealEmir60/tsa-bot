const roblox = require('./roblox.js');
require('dotenv').config();

function registerMarketRoutes(app) {
  let loggedIn = false;

  async function login() {
    try {
      await roblox.directLogin(process.env.ROBLOX_COOKIE);
      loggedIn = true;
      console.log(`✅ RANK MARKET BOT: ${roblox.botUserName} (${roblox.botUserId}) giriş yaptı`);
    } catch (error) {
      loggedIn = false;
      console.error('❌ Roblox bot girişi başarısız:', error.message);
    }
  }

  void login();
  setInterval(login, 30 * 60 * 1000);

  app.get('/market-status', (_req, res) => {
    res.json({ marketAktif: true, giris: loggedIn, botAd: roblox.botUserName, botId: roblox.botUserId });
  });

  app.post('/setrank', async (req, res) => {
    try {
      const expectedKey = process.env.MARKET_KEY || 'key43';
      const userId = Number.parseInt(req.body?.userId, 10);
      const rank = Number.parseInt(req.body?.rank, 10);
      const groupId = String(req.body?.groupId || process.env.GROUP_ID || '972348115');

      if (req.body?.key !== expectedKey) return res.status(403).json({ success: false, error: 'Geçersiz anahtar' });
      if (!loggedIn) return res.status(503).json({ success: false, error: 'Roblox botu giriş yapmadı' });
      if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ success: false, error: 'Geçersiz userId' });
      if (!Number.isInteger(rank) || rank < 1 || rank > 255) return res.status(400).json({ success: false, error: 'Geçersiz rank' });

      console.log(`[RANK MARKET] ${userId} -> ${rank} / grup ${groupId}`);
      await roblox.setRank(groupId, userId, rank);
      console.log(`[RANK MARKET BAŞARILI] ${userId} -> ${rank}`);
      return res.json({ success: true, userId, rank, groupId });
    } catch (error) {
      console.error('[RANK MARKET HATA]', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  });
}

module.exports = registerMarketRoutes;
module.exports.registerMarketRoutes = registerMarketRoutes;
