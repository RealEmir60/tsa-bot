TOKEN=bot_token
CLIENT_ID=bot_id
GROUP_ID=972348115
OYUN_ID=138257110169831
YETKILI_ROL_ID=role_id
const { ApplicationCommandOptionType } = require("discord.js");

const commands = [

{
    name: "rütbe-değiştir",
    description: "Personelin rütbesini değiştir.",
    options: [
        {
            name: "roblox-isim",
            description: "Roblox kullanıcı adı",
            type: ApplicationCommandOptionType.String,
            required: true
        },
        {
            name: "rütbe",
            description: "Verilecek rütbe",
            type: ApplicationCommandOptionType.Integer,
            required: true,
            autocomplete: true
        },
        {
            name: "sebep",
            description: "Sebep",
            type: ApplicationCommandOptionType.String,
            required: true
        }
    ]
},

{
    name: "rütbe-terfi",
    description: "Personeli yükselt",
    options: [
        {
            name: "roblox-isim",
            type: ApplicationCommandOptionType.String,
            required: true
        },
        {
            name: "sebep",
            type: ApplicationCommandOptionType.String,
            required: true
        }
    ]
},

{
    name: "rütbe-tenzil",
    description: "Personeli düşür",
    options: [
        {
            name: "roblox-isim",
            type: ApplicationCommandOptionType.String,
            required: true
        },
        {
            name: "sebep",
            type: ApplicationCommandOptionType.String,
            required: true
        }
    ]
},

{
    name: "profile",
    description: "Roblox profil göster",
    options: [
        {
            name: "roblox-isim",
            type: ApplicationCommandOptionType.String,
            required: true
        }
    ]
},

{
    name: "aktiflik-sorgu",
    description: "Oyuncu sayısı"
},

{
    name: "ping",
    description: "Bot ping"
},

{
    name: "yardım",
    description: "Komut listesi"
}

];

module.exports = commands;
require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const commands = require("./commands");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
});

// BOT READY
client.once("ready", () => {
    console.log(`Bot hazır: ${client.user.tag}`);
});

// INTERACTION SYSTEM
client.on("interactionCreate", async (interaction) => {

    if (interaction.isChatInputCommand()) {

        const { commandName } = interaction;

        if (commandName === "ping") {
            return interaction.reply(`Ping: ${client.ws.ping}ms`);
        }

        if (commandName === "yardım") {
            return interaction.reply("Komutlar aktif");
        }

        if (commandName === "aktiflik-sorgu") {
            return interaction.reply("Aktif oyuncular yükleniyor...");
        }

        if (commandName === "profile") {
            const isim = interaction.options.getString("roblox-isim");
            return interaction.reply(`Profil: ${isim}`);
        }

        if (commandName === "rütbe-değiştir") {
            const isim = interaction.options.getString("roblox-isim");
            const rutbe = interaction.options.getInteger("rütbe");
            const sebep = interaction.options.getString("sebep");

            return interaction.reply(
                `Rütbe değiştirildi\n${isim} → ${rutbe}\nSebep: ${sebep}`
            );
        }
    }

    // AUTOCOMPLETE
    if (interaction.isAutocomplete()) {

        if (interaction.commandName === "rütbe-değiştir") {

            const choices = [
                { name: "Acemi", value: 1 },
                { name: "Er", value: 2 },
                { name: "Onbaşı", value: 3 }
            ];

            return interaction.respond(choices);
        }
    }
});

client.login(process.env.TOKEN);
require("dotenv").config();
const { REST, Routes } = require("discord.js");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = "SUNUCU_ID";

const commands = require("./commands");

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
    try {
        console.log("Komutlar yükleniyor...");

        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands }
        );

        console.log("Komutlar yüklendi!");
    } catch (err) {
        console.error(err);
    }
})();
