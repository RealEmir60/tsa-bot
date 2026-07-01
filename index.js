const { Client, GatewayIntentBits } = require("discord.js");
const fetch = require("node-fetch");
const express = require("express");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Render açık kalsın diye mini server
const app = express();
app.get("/", (req, res) => res.send("TSA BOT AKTİF"));
app.listen(3000);

// BOT
client.on("ready", () => {
  console.log("BOT GİRİŞ YAPTI:", client.user.tag);
});

client.on("messageCreate", (message) => {
  if (message.author.bot) return;

  if (message.content === "!ping") {
    message.reply("TSA bot çalışıyor ✔");
  }
});

client.login(process.env.TOKEN);
