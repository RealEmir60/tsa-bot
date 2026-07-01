const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const express = require("express");
const fetch = require("node-fetch");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const app = express();
app.use(express.json());

// ================== ENV ==================
const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;

// ================== CONSTANTS ==================
const GROUP_ID = "972348115";
const PLACE_ID = "138257110169831";

const LOG_CHANNEL_ID = "1519328796275380325";
const AUTH_ROLE_ID = "1518357646971764859";

const GROUP_LINK =
  "https://www.roblox.com/tr/communities/972348115/TSA-Turkish-Armed-Forces-Yeniden";

// ================== MEMORY ==================
const cooldown = new Map();
const history = new Map();

// ================== SERVER ==================
app.get("/", (req, res) => res.send("TSA BOT AKTİF"));

// ================== ROBLOX API ==================
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
        { name: "User", value: user, inline: true },
        { name: "İşlem", value: type, inline: true },
        { name: "Sebep", value: sebep },
        { name: "Yetkili", value: author }
      ]
    });

    addHistory(user, type, { rank, sebep, author });

    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

app.listen(3000, () => console.log("SERVER AKTİF"));

// ================== HELPERS ==================
function hasPerm(member) {
  return member.roles.cache.has(AUTH_ROLE_ID);
}

function cooldownCheck(id) {
  const now = Date.now();
  const last = cooldown.get(id);
  if (last && now - last < 4000) return false;
  cooldown.set(id, now);
  return true;
}

function addHistory(user, type, data) {
  if (!history.has(user)) history.set(user, []);
  history.get(user).push({ type, data, time: Date.now() });
}

async function sendLog(data) {
  try {
    const ch = await client.channels.fetch(LOG_CHANNEL_ID);
    if (!ch) return;

    const embed = new EmbedBuilder()
      .setTitle(data.title)
      .setColor(data.color || "Grey")
      .addFields(data.fields || [])
      .setTimestamp();

    ch.send({ embeds: [embed] });
  } catch {}
}

// ================== ROBLOX ==================
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

async function getGroups(userId) {
  const res = await fetch(
    `https://groups.roblox.com/v1/users/${userId}/groups/roles`
  );
  return await res.json();
}

async function getRoles() {
  const res = await fetch(
    `https://groups.roblox.com/v1/groups/${GROUP_ID}/roles`
  );
  return await res.json();
}

// ================== COMMANDS ==================
const commands = [
  new SlashCommandBuilder().setName("aktiflik-sorgula").setDescription("Oyuncu sayısı"),
  new SlashCommandBuilder().setName("grup").setDescription("Grup link"),

  new SlashCommandBuilder()
    .setName("rütbeler")
    .setDescription("Grup rütbeleri"),

  new SlashCommandBuilder()
    .setName("rütbe-bilgi")
    .setDescription("Kullanıcı rütbesi")
    .addStringOption(o => o.setName("user").setRequired(true)),

  new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Roblox profil")
    .addStringOption(o => o.setName("user").setRequired(true)),

  new SlashCommandBuilder()
    .setName("terfi")
    .setDescription("Terfi")
    .addStringOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("sebep").setRequired(true)),

  new SlashCommandBuilder()
    .setName("tenzil")
    .setDescription("Tenzil")
    .addStringOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("sebep").setRequired(true)),

  new SlashCommandBuilder()
    .setName("rütbe-değiştir")
    .setDescription("Manuel rütbe")
    .addStringOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("rank").setRequired(true))
    .addStringOption(o => o.setName("sebep").setRequired(true))
].map(c => c.toJSON());

// ================== READY ==================
client.once("ready", async () => {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(client.user.id, GUILD_ID),
    { body: commands }
  );

  console.log("BOT AKTİF");
});

// ================== HANDLER ==================
client.on("interactionCreate", async i => {
  if (!i.isChatInputCommand()) return;

  if (!cooldownCheck(i.user.id))
    return i.reply({ content: "⏳ cooldown", ephemeral: true });

  // GRUP
  if (i.commandName === "grup") {
    return i.reply(GROUP_LINK);
  }

  // AKTİFLİK
  if (i.commandName === "aktiflik-sorgula") {
    const c = await getPlayers();
    return i.reply(`🎮 Oyunda ${c} kişi`);
  }

  // RÜTBELER
  if (i.commandName === "rütbeler") {
    const roles = await getRoles();

    const list = roles.roles
      .sort((a, b) => a.rank - b.rank)
      .map(r => `🔹 ${r.name} (${r.rank})`)
      .join("\n");

    return i.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🏷 Rütbeler")
          .setDescription(list)
          .setColor("Gold")
      ]
    });
  }

  // RÜTBE BİLGİ
  if (i.commandName === "rütbe-bilgi") {
    const user = i.options.getString("user");
    const data = await getGroups(user);

    const g = data.data.find(x => x.group.id == GROUP_ID);
    if (!g) return i.reply("yok");

    return i.reply(`🎖 ${g.role.name}`);
  }

  // PROFILE
  if (i.commandName === "profile") {
    const user = i.options.getString("user");
    const data = await getGroups(user);

    const list = data.data.slice(0, 8).map(g =>
      `🏷 ${g.group.name} → ${g.role.name}`
    ).join("\n");

    return i.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("👤 Profile")
          .setDescription(list)
          .setColor("Purple")
      ]
    });
  }

  // YETKİLİ KOMUTLAR
  if (["terfi", "tenzil", "rütbe-değiştir"].includes(i.commandName)) {
    if (!hasPerm(i.member))
      return i.reply({ content: "❌ yetki yok", ephemeral: true });

    const user = i.options.getString("user");
    const sebep = i.options.getString("sebep");
    const rank = i.options.getString("rank") || "auto";

    await fetch("http://localhost:3000/rank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user,
        rank,
        sebep,
        type: i.commandName,
        author: i.user.tag
      })
    });

    return i.reply("✔ işlem");
  }
});

client.login(TOKEN);
