// market.js - index.js'e dokunmadan ayrı çalışır
const express = require("express");
const app2 = express();
app2.use(express.json());
const roblox = require("./roblox.js");
require("dotenv").config();

let giris = false;
async function login() {
  try {
    await roblox.directLogin(process.env.ROBLOX_COOKIE);
    giris = true;
    console.log(`✅ MARKET BOT: ${roblox.botUserName} giriş yaptı`);
  } catch(e) {
    console.error("Market cookie hatası:", e.message);
    giris = false;
  }
}
login();
setInterval(login, 30*60*1000);

app2.get("/market", (req,res) => res.send("Market Aktif"));
app2.post("/setrank", async (req,res) => {
  try {
    if (req.body.key !== "key43") return res.status(403).json({error:"key"});
    if (!giris) return res.status(500).json({error:"giris yok"});
    const gid = req.body.groupId || process.env.GROUP_ID || "972348115";
    await roblox.setRank(gid, parseInt(req.body.userId), parseInt(req.body.rank));
    console.log(`[MARKET] ${req.body.userId} -> ${req.body.rank}`);
    res.json({success:true});
  } catch(e) {
    res.status(500).json({error:e.message});
  }
});

app2.listen(3001, () => console.log("Market API 3001 portunda"));
