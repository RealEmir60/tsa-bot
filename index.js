const { Client, GatewayIntentBits, EmbedBuilder, ActivityType } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const noblox = require('noblox.js');
require('dotenv').config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMembers]
});

const AYARLAR = {
    GROUP_ID: parseInt(process.env.GROUP_ID),
    YETKILI_ROL_ID: process.env.YETKILI_ROL_ID,
    LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID
};

client.on('ready', async () => {
    await noblox.setCookie(process.env.ROBLOX_COOKIE);
    client.user.setActivity("TSA | Turkish Special Army", { type: ActivityType.Playing });
    console.log("Bot aktif, komutlar yüklendi.");
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // Yetki Kontrolü
    if (!interaction.member.roles.cache.has(AYARLAR.YETKILI_ROL_ID)) {
        return interaction.reply({ content: "❌ Yetkiniz yetersiz.", ephemeral: true });
    }

    await interaction.deferReply();
    const { commandName, options } = interaction;

    try {
        const robloxIsim = options.getString('roblox-isim');
        const id = await noblox.getIdFromUsername(robloxIsim);

        if (commandName === 'terfi') {
            await noblox.promote(AYARLAR.GROUP_ID, id);
            interaction.editReply(`📈 **${robloxIsim}** başarıyla terfi edildi.`);
        } 
        else if (commandName === 'tenzil') {
            await noblox.demote(AYARLAR.GROUP_ID, id);
            interaction.editReply(`📉 **${robloxIsim}** tenzil edildi.`);
        }
        else if (commandName === 'rütbe-değiştir') {
            const rank = options.getInteger('rütbe');
            await noblox.setRank(AYARLAR.GROUP_ID, id, rank);
            interaction.editReply(`✅ **${robloxIsim}** kullanıcısının rütbesi güncellendi.`);
        }
        else if (commandName === 'yasakla') {
            await noblox.exile(AYARLAR.GROUP_ID, id);
            interaction.editReply(`🚫 **${robloxIsim}** gruptan atıldı.`);
        }
        else if (commandName === 'ses-katıl') {
            joinVoiceChannel({ channelId: interaction.member.voice.channelId, guildId: interaction.guild.id, adapterCreator: interaction.guild.voiceAdapterCreator });
            interaction.editReply("🔊 Ses kanalına bağlandım.");
        }
        else if (commandName === 'ses-ayrıl') {
            getVoiceConnection(interaction.guild.id).destroy();
            interaction.editReply("🔇 Ses kanalından ayrıldım.");
        }
    } catch (e) {
        interaction.editReply(`❌ Hata: ${e.message}`);
    }
});

client.login(process.env.DISCORD_TOKEN);
