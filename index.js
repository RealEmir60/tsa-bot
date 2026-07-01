const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const express = require("express");
const fetch = require("node-fetch");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const app = express();
app.use(express.json());

// 🌐 ENV
const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;

// 🎮 SABİTLER
const PLACE_ID = "138257110169831";
const GROUP_ID = "972348115";

const GROUP_LINK =
  "https://www.roblox.com/tr/communities/972348115/TSA-Turkish-Armed-Forces-Yeniden";

// 🌐 SERVER
app.get("/", (req, res) => res.send("TSA BOT AKTİF"));

// 🔥 ROBLOX RANK SYSTEM
app.post("/rank", async (req, res) => {
  const { user, rank, sebep, type, author } = req.body;

  try {
    await fetch(
      `https://apis.roblox.com/cloud/v2/groups/${GROUP_ID}/memberships/${user}`,
      {
        method: "PATCH",
        headers: {
          "x-api-key": ROBLOX_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          role: rank
        })
      }
    );

    console.log(`📌 ${type} | ${user} → ${rank} | ${sebep} | Yetkili: ${author}`);

    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

app.listen(3000, () => console.log("SERVER AKTİF"));

// 📌 KOMUTLAR
const commands = [
  new SlashCommandBuilder()
    .setName("aktiflik-sorgula")
    .setDescription("Oyundaki oyuncu sayısını gösterir"),

  new SlashCommandBuilder()
    .setName("grup")
    .setDescription("TSA grup linkini gösterir"),

  // 🔥 GÜZEL PANEL KOMUTU
  new SlashCommandBuilder()
    .setName("rütbe-değiştir")
    .setDescription("Roblox rütbe değiştir (panel)")
    .addStringOption(o =>
      o.setName("user")
        .setDescription("Roblox User ID")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("rank")
        .setDescription("Verilecek rank ID")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("sebep")
        .setDescription("İşlem sebebi")
        .setRequired(true)
    )
].map(c => c.toJSON());

// 🚀 BOT READY
client.once("ready", async () => {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(client.user.id, GUILD_ID),
    { body: commands }
  );

  console.log(`BOT GİRİŞ: ${client.user.tag}`);
});

// 🎮 ROBLOX PLAYER COUNT (SAĞLAM)
async function getPlayers() {
  try {
    const res = await fetch(
      `https://games.roblox.com/v1/games?universeIds=${PLACE_ID}`
    );

    const data = await res.json();
    return data.data?.[0]?.playing || 0;
  } catch {
    return 0;
  }
}

// 📌 COMMAND HANDLER
client.on("interactionCreate", async i => {
  if (!i.isChatInputCommand()) return;

  // 🎮 AKTİFLİK
  if (i.commandName === "aktiflik-sorgula") {
    const count = await getPlayers();

    const embed = new EmbedBuilder()
      .setTitle("🎮 TSA Aktiflik Sistemi")
      .setDescription(`Şu anda **${count} kişi** oyunda`)
      .setColor("Green");

    return i.reply({ embeds: [embed] });
  }

  // 🏷 GRUP
  if (i.commandName === "grup") {
    return i.reply(`🏷 TSA Grup:\n${GROUP_LINK}`);
  }

  // 🔥 RÜTBE PANELİ (GÜZEL GÖRÜNÜM)
  if (i.commandName === "rütbe-değiştir") {
    const user = i.options.getString("user");
    const rank = i.options.getString("rank");
    const sebep = i.options.getString("sebep");

    const embed = new EmbedBuilder()
      .setTitle("⚡ Rütbe İşlemi Başlatıldı")
      .addFields(
        { name: "👤 User", value: user, inline: true },
        { name: "🎖 Rank", value: rank, inline: true },
        { name: "📝 Sebep", value: sebep, inline: false }
      )
      .setColor("Blue");

    await fetch("http://localhost:3000/rank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user,
        rank,
        sebep,
        type: "rütbe-değiştir",
        author: i.user.tag
      })
    });

    return i.reply({ embeds: [embed] });
  }
});

client.login(TOKEN);
