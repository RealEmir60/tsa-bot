const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require("discord.js");
const fetch = require("node-fetch");
const express = require("express");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const app = express();
app.get("/", (req, res) => res.send("TSA BOT AKTİF"));
app.listen(3000);

// 🌐 BACKEND URL (Render linkini buraya koyacaksın)
const BACKEND_URL = process.env.BACKEND_URL;

// 🎮 PLACE ID
const PLACE_ID = "138257110169831";

// 🏷 GRUP LINK
const GROUP_LINK =
  "https://www.roblox.com/tr/communities/972348115/TSA-Turkish-Armed-Forces-Yeniden";

// 📌 KOMUTLAR
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
    .setDescription("Rütbe değiştir")
].map(c => c.toJSON());

// 🚀 BOT READY
client.once("ready", async () => {
  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
    { body: commands }
  );

  console.log("BOT READY");
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

  // 🔥 RÜTBE KOMUTLARI
  if (["terfi", "tenzil", "rütbe-değiştir"].includes(interaction.commandName)) {
    const user = interaction.options.getString("user");
    const rank = interaction.options.getString("rank");
    const sebep = interaction.options.getString("sebep") || interaction.options.getString("sebep");

    const type = interaction.commandName;

    await fetch(`${BACKEND_URL}/rank`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user,
        rank,
        sebep,
        type
      })
    });

    return interaction.reply("✔ İşlem gönderildi (Roblox’a aktarılıyor)");
  }
});

client.login(process.env.TOKEN);
