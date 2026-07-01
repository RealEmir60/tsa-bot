const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require("discord.js");
const fetch = require("node-fetch");
const express = require("express");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// keep alive
const app = express();
app.get("/", (req, res) => res.send("TSA BOT AKTİF"));
app.listen(3000);

// 🔥 KOMUTLAR
const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Bot test"),

  new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Roblox rank gösterir")
    .addStringOption(opt =>
      opt.setName("userid")
        .setDescription("Roblox User ID")
        .setRequired(true)
    )
].map(c => c.toJSON());

// BOT READY
client.once("ready", async () => {
  console.log("BOT GİRİŞ YAPTI:", client.user.tag);

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("Slash komutlar yüklendi");
});

// 🔥 RANK ÇEKME
async function getRank(userId) {
  const groupId = process.env.GROUP_ID || "972348115";

  try {
    const res = await fetch(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);
    const data = await res.json();

    const group = data.data.find(g => g.group.id == groupId);

    if (!group) return null;

    return {
      name: group.role.name,
      rank: group.role.rank
    };

  } catch (err) {
    console.log("Hata:", err);
    return null;
  }
}

// SLASH INTERACTION
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ping") {
    interaction.reply("TSA bot aktif ✔");
  }

  if (interaction.commandName === "rank") {
    const userId = interaction.options.getString("userid");

    const rank = await getRank(userId);

    if (!rank) {
      return interaction.reply("Rank bulunamadı ❌");
    }

    interaction.reply(
      `🎖 Roblox Rank:\n**${rank.name}**\nSeviye: ${rank.rank}`
    );
  }
});

client.login(process.env.TOKEN);
