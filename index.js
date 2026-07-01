const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require("discord.js");
const express = require("express");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

// Keep alive
const app = express();
app.get("/", (req, res) => res.send("TSA BOT AKTİF"));
app.listen(3000);

// SLASH KOMUTLAR
const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Botu test eder"),

  new SlashCommandBuilder()
    .setName("duyuru")
    .setDescription("Duyuru gönderir")
    .addStringOption(option =>
      option.setName("mesaj")
        .setDescription("Duyuru mesajı")
        .setRequired(true)
    )
].map(cmd => cmd.toJSON());

// BOT READY
client.once("ready", async () => {
  console.log(`BOT GİRİŞ YAPTI: ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("Slash komutlar yüklendi");
});

// SLASH KOMUTLAR ÇALIŞTIRMA
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ping") {
    await interaction.reply("TSA sistem aktif ✔");
  }

  if (interaction.commandName === "duyuru") {
    const msg = interaction.options.getString("mesaj");

    await interaction.reply(`📢 Duyuru gönderildi: ${msg}`);

    const logChannel = interaction.guild.channels.cache.find(
      c => c.name === "log"
    );

    if (logChannel) {
      logChannel.send(`📌 Duyuru: ${msg}`);
    }
  }
});

client.login(process.env.TOKEN);
