const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const express = require("express");
const fetch = require("node-fetch");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const app = express();
app.use(express.json());

// 🌐 ENV
const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;

// 📌 SABİTLER
const GROUP_ID = "972348115";
const PLACE_ID = "138257110169831";

const LOG_CHANNEL_ID = "1519328796275380325";
const AUTH_ROLE_ID = "1518357646971764859";

const GROUP_LINK =
  "https://www.roblox.com/tr/communities/972348115/TSA-Turkish-Armed-Forces-Yeniden";

// 🌐 SERVER
app.get("/", (req, res) => res.send("TSA BOT AKTİF"));

// 🔥 ROBLOX RANK API
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
        body: JSON.stringify({ role: rank })
      }
    );

    await sendLog({
      title: "⚙️ RANK İŞLEMİ",
      color: "Blue",
      fields: [
        { name: "👤 User", value: user, inline: true },
        { name: "🎖 Rank", value: rank, inline: true },
        { name: "📝 Sebep", value: sebep },
        { name: "⚙️ Type", value: type },
        { name: "👮 Yetkili", value: author }
      ]
    });

    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

app.listen(3000, () => console.log("SERVER AKTİF"));

// 🔐 YETKİ KONTROL
function hasPermission(member) {
  return member.roles.cache.has(AUTH_ROLE_ID);
}

// 📢 PRO LOG SİSTEMİ (EMBED)
async function sendLog({ title, color, fields }) {
  try {
    const channel = await client.channels.fetch(LOG_CHANNEL_ID);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(color || "Grey")
      .addFields(fields)
      .setTimestamp();

    channel.send({ embeds: [embed] });
  } catch (err) {
    console.log("LOG HATA:", err.message);
  }
}

// 🎮 ROBLOX AKTİFLİK
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

// 📌 SLASH KOMUTLAR
const commands = [
  new SlashCommandBuilder().setName("aktiflik-sorgula").setDescription("Oyuncu sayısı"),
  new SlashCommandBuilder().setName("grup").setDescription("Grup linki"),

  new SlashCommandBuilder()
    .setName("terfi")
    .addStringOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("sebep").setRequired(true))
    .setDescription("Terfi"),

  new SlashCommandBuilder()
    .setName("tenzil")
    .addStringOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("sebep").setRequired(true))
    .setDescription("Tenzil"),

  new SlashCommandBuilder()
    .setName("rütbe-değiştir")
    .addStringOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("rank").setRequired(true))
    .addStringOption(o => o.setName("sebep").setRequired(true))
    .setDescription("Manuel rütbe değiştir")
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

// 📌 KOMUTLAR
client.on("interactionCreate", async i => {
  if (!i.isChatInputCommand()) return;

  // ❌ YETKİ KONTROLÜ
  if (["terfi", "tenzil", "rütbe-değiştir"].includes(i.commandName)) {
    if (!hasPermission(i.member)) {
      return i.reply({ content: "❌ Yetkin yok", ephemeral: true });
    }
  }

  // 🎮 AKTİFLİK
  if (i.commandName === "aktiflik-sorgula") {
    const count = await getPlayers();

    const embed = new EmbedBuilder()
      .setTitle("🎮 TSA Aktiflik")
      .setDescription(`Şu anda **${count} kişi** oyunda`)
      .setColor("Green");

    return i.reply({ embeds: [embed] });
  }

  // 🏷 GRUP
  if (i.commandName === "grup") {
    return i.reply(`🏷 ${GROUP_LINK}`);
  }

  // ⬆ TERFİ
  if (i.commandName === "terfi") {
    const user = i.options.getString("user");
    const sebep = i.options.getString("sebep");

    await fetch("http://localhost:3000/rank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user,
        rank: "PROMOTE", // backend tarafında handle edilebilir
        sebep,
        type: "terfi",
        author: i.user.tag
      })
    });

    return i.reply("⬆ Terfi işlemi gönderildi");
  }

  // ⬇ TENZİL
  if (i.commandName === "tenzil") {
    const user = i.options.getString("user");
    const sebep = i.options.getString("sebep");

    await fetch("http://localhost:3000/rank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user,
        rank: "DEMOTE",
        sebep,
        type: "tenzil",
        author: i.user.tag
      })
    });

    return i.reply("⬇ Tenzil işlemi gönderildi");
  }

  // 🎖 MANUEL
  if (i.commandName === "rütbe-değiştir") {
    const user = i.options.getString("user");
    const rank = i.options.getString("rank");
    const sebep = i.options.getString("sebep");

    await fetch("http://localhost:3000/rank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user,
        rank,
        sebep,
        type: "manuel",
        author: i.user.tag
      })
    });

    return i.reply("🎖 Rütbe değiştirildi");
  }
});

client.login(TOKEN);
