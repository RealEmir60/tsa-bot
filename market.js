const express = require("express");
const app = express();
app.use(express.json());
const roblox = require("./roblox.js");
require("dotenv").config();

let giris = false;
async function login() {
  try {
    await roblox.directLogin(process.env.ROBLOX_COOKIE);
    giris = true;
    console.log(`✅ MARKET BOT: ${roblox.botUserName} (${roblox.botUserId}) giris yapildi`);
  } catch(e) {
    console.error("❌ Market cookie hatasi:", e.message);
    giris = false;
  }
}
login();
setInterval(login, 30*60*1000);

app.get("/", (req,res) => res.send("OK"));
app.get("/market", (req,res) => res.send("Market Aktif"));
app.get("/market-status", (req,res) => res.json({ marketAktif: true, giris, botAd: roblox.botUserName }));

app.post("/setrank", async (req,res) => {
  try {
    const { key, userId, rank, groupId } = req.body;
    console.log(`[MARKET ISTEK] userId=${userId} rank=${rank} groupId=${groupId} key=${key}`);
    if (key !== "key43") return res.status(403).json({error:"Gecersiz anahtar"});
    if (!giris) return res.status(500).json({error:"Roblox girisi yok, cookie kontrol et"});
    const gid = groupId || process.env.GROUP_ID || "972348115";
    const r = parseInt(rank);
    const u = parseInt(userId);
    if (!r || !u) return res.status(400).json({error:"Gecersiz rank veya userId"});
    await roblox.setRank(gid, u, r);
    console.log(`[MARKET BASARILI] ${u} -> ${r}`);
    res.json({success:true, userId: u, rank: r, groupId: gid});
  } catch(e) {
    console.error("[MARKET HATA]:", e.message);
    res.status(500).json({error:e.message});
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`✅ Market API PORT ${PORT} uzerinde aktif - /setrank hazir`));
