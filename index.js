const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.on("ready", () => {
  console.log(`BOT GİRİŞ YAPTI: ${client.user.tag}`);
});

// basit test komutu
client.on("messageCreate", (message) => {
  if (message.author.bot) return;

  if (message.content === "!ping") {
    message.reply("TSA sistem aktif ✔ Pong!");
  }

  if (message.content === "!rank") {
    message.reply("Rütbe sistemi yakında aktif olacak.");
  }
});

client.login(process.env.TOKEN);
