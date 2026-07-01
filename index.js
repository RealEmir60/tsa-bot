const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const express = require("express");
const fetch = require("node-fetch");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const app = express();
app.use(express.json());

// ================= CONFIG =================
const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;

const GROUP_ID = "972348115";
const PLACE_ID = "138257110169831";

const LOG_CHANNEL_ID = "1519328796275380325";
const AUTH_ROLE_ID = "1518357646971764859";

// ================= MEMORY =================
const cooldown = new Map();
const history = new Map();

// ================= SERVER =================
app.get("/", (req, res) => res.send("TSA BOT ACTIVE"));

app.listen(3000, () => console.log("SERVER RUNNING"));

// ================= HELPERS =================
function hasPerm(member) {
  return member.roles.cache.has(AUTH_ROLE_ID);
}

function checkCooldown(id) {
  const now = Date.now();
  const last = cooldown.get(id);

  if (last && now - last < 4000) return false;

  cooldown.set(id, now);
  return true;
}

function addHistory(user, action, data) {
  if (!history.has(user)) history.set(user, []);
  history.get(user).push({ action, data, time: Date.now() });
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
  } catch (e) {
    console.log("LOG ERROR:", e.message);
  }
}

// ================= ROBLOX =================
async function getPlayers() {
  try {
    const res = await fetch(`https://games.roblox.com/v1/games?universeIds=${PLACE_ID}`);
    const data = await res.json();
    return data.data?.[0]?.playing || 0;
  } catch {
    return 0;
  }
}

async function getUserGroups(userId) {
  const res = await fetch(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
  return await res.json();
}

async function getGroupRoles() {
  const res = await fetch(`https://groups.roblox.com/v1/groups/${GROUP_ID}/roles`);
  return await res.json();
}

// ================= SLASH COMMANDS =================
const commands = [
  new SlashCommandBuilder()
    .setName("aktiflik-sorgula")
    .setDescription("Oyundaki oyuncu sayısını gösterir"),

  new SlashCommandBuilder()
    .setName("grup")
    .setDescription("Grup linkini gösterir"),

  new SlashCommandBuilder()
    .setName("rütbeler")
    .setDescription("Grup rütbelerini listeler"),

  new SlashCommandBuilder()
    .setName("rütbe-bilgi")
    .setDescription("Kullanıcının rütbesini gösterir")
    .addStringOption(o =>
      o.setName("user")
        .setDescription("Roblox User ID")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Roblox profil bilgisi")
    .addStringOption(o =>
      o.setName("user")
        .setDescription("Roblox User ID")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("terfi")
    .setDescription("Kullanıcıyı terfi ettirir")
    .addStringOption(o =>
      o.setName("user")
        .setDescription("Roblox User ID")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("sebep")
        .setDescription("Sebep")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("tenzil")
    .setDescription("Kullanıcıyı tenzil eder")
    .addStringOption(o =>
      o.setName("user")
        .setDescription("Roblox User ID")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("sebep")
        .setDescription("Sebep")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("rütbe-değiştir")
    .setDescription("Manuel rütbe değiştirir")
    .addStringOption(o =>
      o.setName("user")
        .setDescription("Roblox User ID")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("rank")
        .setDescription("Yeni rütbe")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("sebep")
        .setDescription("Sebep")
        .setRequired(true)
    )
].map(c => c.toJSON());

// ================= READY =================
client.once("ready", async () => {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(client.user.id, GUILD_ID),
    { body: commands }
  );

  console.log("BOT READY");
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async i => {
  if (!i.isChatInputCommand()) return;

  if (!checkCooldown(i.user.id))
    return i.reply({ content: "⏳ cooldown", ephemeral: true });

  // GRUP
  if (i.commandName === "grup") {
    return i.reply("https://www.roblox.com/tr/communities/972348115/TSA-Turkish-Armed-Forces-Yeniden");
  }

  // AKTİFLİK
  if (i.commandName === "aktiflik-sorgula") {
    const count = await getPlayers();
    return i.reply(`🎮 Oyunda ${count} kişi`);
  }

  // RÜTBELER
  if (i.commandName === "rütbeler") {
    const roles = await getGroupRoles();

    const list = roles.roles
      .sort((a, b) => a.rank - b.rank)
      .map(r => `🔹 ${r.name}`)
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
    const data = await getUserGroups(user);

    const g = data.data.find(x => x.group.id == GROUP_ID);
    if (!g) return i.reply("❌ yok");

    return i.reply(`🎖 ${g.role.name}`);
  }

  // PROFILE
  if (i.commandName === "profile") {
    const user = i.options.getString("user");
    const data = await getUserGroups(user);

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

    addHistory(user, i.commandName, { rank, sebep });

    await sendLog({
      title: "⚙️ RÜTBE İŞLEMİ",
      color: "Blue",
      fields: [
        { name: "User", value: user, inline: true },
        { name: "İşlem", value: i.commandName, inline: true },
        { name: "Sebep", value: sebep }
      ]
    });

    return i.reply("✔ işlem başarılı");
  }
});

client.login(TOKEN);
