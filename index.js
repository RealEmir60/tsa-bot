const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require("discord.js");
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

// 🏷 SABİTLER
const PLACE_ID = "138257110169831";
const GROUP_LINK =
  "https://www.roblox.com/tr/communities/972348115/TSA-Turkish-Armed-Forces-Yeniden";

// 🚀 WEB SERVER (Render açık kalsın)
app.get("/", (req, res) => res.send("TSA BOT AKTİF"));

// 🔥 RÜTBE API (BOT + SERVER AYNI DOSYA)
app.post("/rank", async (req, res) => {
  const API_KEY = process.env.ROBLOX_API_KEY;
  const GROUP_ID = "972348115";

  const { user, rank, sebep, type } = req.body;

  try {
    await fetch(
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

    console.log(`📌 ${type} | ${user} → ${rank} | ${sebep}`);

    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

app.listen(3000, () => console.log("SERVER AKTİF"));

// 📌 SLASH KOMUTLAR
const commands = [
  new SlashCommandBuilder()
    .setName("aktiflik-sorgula")
    .setDescription("Oyundaki oyuncu sayısını gösterir"),

  new SlashCommandBuilder()
    .setName("grup")
    .setDescription("Grup linkini gösterir"),

  new SlashCommandBuilder()
    .setName("terfi")
    .addStringOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("sebep").setRequired(true))
    .setDescription("Terfi işlemi"),

  new SlashCommandBuilder()
    .setName("tenzil")
    .addStringOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("sebep").setRequired(true))
    .setDescription("Tenzil işlemi"),

  new SlashCommandBuilder()
    .setName("rütbe-değiştir")
    .addStringOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("rank").setRequired(true))
    .addStringOption(o => o.setName("sebep").setRequired(true))
    .setDescription("Rütbe değiştir")
].map(c => c.toJSON());

// 🚀 BOT READY
client.once("ready", async () => {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(client.user.id, GUILD_ID),
    { body: commands }
  );

  console.log(`BOT GİRİŞ YAPTI: ${client.user.tag}`);
});

// 🎮 ROBLOX AKTİFLİK
async function getPlayers() {
  const res = await fetch(
    `https://games.roblox.com/v1/games?universeIds=${PLACE_ID}`
  );
  const data = await res.json();
  return data.data?.[0]?.playing || 0;
}

// 📌 KOMUTLAR
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // AKTİFLİK
  if (interaction.commandName === "aktiflik-sorgula") {
    const count = await getPlayers();
    return interaction.reply(`🎮 Oyunda **${count} kişi** var`);
  }

  // GRUP
  if (interaction.commandName === "grup") {
    return interaction.reply(`🏷 ${GROUP_LINK}`);
  }

  // RÜTBE İŞLEMLERİ
  if (
    ["terfi", "tenzil", "rütbe-değiştir"].includes(interaction.commandName)
  ) {
    const user = interaction.options.getString("user");
    const rank = interaction.options.getString("rank");
    const sebep = interaction.options.getString("sebep");

    await fetch("http://localhost:3000/rank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user,
        rank,
        sebep,
        type: interaction.commandName
      })
    });

    return interaction.reply("✔ İşlem gönderildi");
  }
});

client.login(TOKEN);
