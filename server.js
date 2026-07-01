const express = require("express");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());

// 🔑 ROBLOX API KEY BURAYA DEĞİL, ENV'E KOYULACAK
const API_KEY = process.env.ROBLOX_API_KEY;

// 🏷 GROUP ID
const GROUP_ID = "972348115";

// 🔥 RÜTBE İŞLEMLERİ (ROBLOX CONNECTOR)
app.post("/rank", async (req, res) => {
  const { user, rank, sebep, type } = req.body;

  try {
    const response = await fetch(
      `https://apis.roblox.com/cloud/v2/groups/${GROUP_ID}/memberships/${user}`,
      {
        method: "PATCH",
        headers: {
          "x-api-key": API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          role: rank
        })
      }
    );

    console.log(`📌 ${type} | User: ${user} | Rank: ${rank} | Sebep: ${sebep}`);

    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

app.listen(4000, () => console.log("🚀 TSA BACKEND AKTİF"));
