const { Client, GatewayIntentBits } = require("discord.js");
const express = require("express");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Render açık kalsın diye
const app = express();
app.get("/", (req, res) => res.send("TSA BOT AKTİF"));
app.listen(3000);

client.on("ready", () => {
  console.log(`BOT GİRİŞ YAPTI: ${client.user.tag}`);
});

client.on("messageCreate", (message) => {
  if (message.author.bot) return;

  if (message.content === "!ping") {
    message.reply("TSA sistem aktif ✔");
  }

  if (message.content.startsWith("!duyuru ")) {
    if (!message.member.permissions.has("Administrator")) {
      return message.reply("Yetkin yok!");
    }

    const msg = message.content.slice(9);
    message.channel.send(`📢 TSA DUYURU: ${msg}`);
  }

  if (message.content.startsWith("!rütbe ")) {
    const user = message.mentions.users.first();
    const rank = message.content.split(" ")[2];

    if (!user || !rank) {
      return message.reply("Kullanım: !rütbe @kullanıcı rütbe");
    }

    message.channel.send(`📌 ${user.tag} için yeni rütbe: **${rank}**`);
  }
});

client.login(process.env.TOKEN);
