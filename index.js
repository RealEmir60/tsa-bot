const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, ApplicationCommandOptionType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const noblox = require('noblox.js');
const http = require('http');

// Gerekli kütüphane eksikliği durumunda (Node 18 altı için)
if (!global.fetch) {
    global.fetch = require('node-fetch');
}

const AYARLAR = {
    DISCORD_TOKEN: process.env.DISCORD_TOKEN, 
    ROBLOX_COOKIE: process.env.ROBLOX_COOKIE, 
    GROUP_ID: parseInt(process.env.GROUP_ID) || 972348115, 
    LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID || "1519328796275380325", 
    YETKILI_ROL_ID: process.env.YETKILI_ROL_ID || "1518357646971764859", 
    OYUN_ID: process.env.OYUN_ID || "138257110169831"
};

// ==================== 🎖️ RÜTBELER LİSTESİ ====================
const TUM_RUTBELER = [
    { name: '[OR-1] Acemi Er', value: 1 }, { name: '[OR-2] Onbaşı', value: 2 },
    { name: '[OR-3] Uzman Onbaşı', value: 3 }, { name: '[OR-4] Çavuş', value: 4 },
    { name: '[OR-5] Uzman Çavuş', value: 5 }, { name: '[OR-6] Astsubay Çavuş', value: 6 },
    { name: '[OR-7] Astsubay Üstçavuş', value: 7 }, { name: '[OR-8] Astsubay Başçavuş', value: 8 },
    { name: '[OR-9] Astsubay Kd. Başçavuş', value: 9 }, { name: '[OF-1/A] Asteğmen', value: 10 },
    { name: '[OF-1/B] Teğmen', value: 11 }, { name: '[OF-1/C] Üsteğmen', value: 12 },
    { name: '[OF-2] Yüzbaşı', value: 13 }, { name: '[OF-3] Binbaşı', value: 14 },
    { name: '[OF-4] Yarbay', value: 15 }, { name: '[OF-5] Albay', value: 16 },
    { name: '[OF-6] Tuğgeneral', value: 17 }, { name: '[OF-7] Tümgeneral', value: 18 },
    { name: '[OF-8] Korgeneral', value: 19 }, { name: '[OF-9] Orgeneral', value: 20 },
    { name: 'Paşa', value: 23 }, { name: 'Ordu Komutanı', value: 25 },
    { name: 'Disiplin Kurulu', value: 26 }, { name: 'Lider', value: 27 },
    { name: 'Genel Kurmay', value: 29 }, { name: 'Genel Kurmay Başkanı', value: 30 },
    { name: 'Yüksek Askeri Şura', value: 31 }, { name: 'Yönetim Kurulu', value: 32 },
    { name: 'Yönetim Kurulu Başkan Y.', value: 33 }, { name: 'Yönetim Kurulu Başkanı', value: 34 },
    { name: 'OF-10 Mareşal', value: 35 }, { name: 'Yardımcı Grup Sahibi', value: 36 },
    { name: 'Rütbelendirme Botu', value: 40 }, { name: 'Stajyer Geliştirme Ofisi', value: 250 },
    { name: 'Geliştirme Ofisi', value: 251 }, { name: 'Geliştirme Ofisi Başkanı', value: 252 },
    { name: '2. Grup Sahibi', value: 253 }, { name: 'Grup Sahibi', value: 254 },
    { name: 'TSA', value: 255 }
];

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates]
});

// ==================== 🛠️ LOG FONKSİYONU ====================
async function logGonder(interaction, robloxUsername, robloxUserId, eskiRutbe, yeniRutbe, sebep) {
    try {
        const logKanali = await client.channels.fetch(AYARLAR.LOG_CHANNEL_ID).catch(() => null);
        if (!logKanali) return;

        const embed = new EmbedBuilder()
            .setColor('#3b5998')
            .setTitle('🎖️ İdari İşlem Kaydı')
            .addFields(
                { name: 'Personel', value: robloxUsername, inline: true },
                { name: 'İşlem Yapan', value: interaction.user.username, inline: true },
                { name: 'Eski Rütbe', value: eskiRutbe, inline: true },
                { name: 'Yeni Rütbe', value: yeniRutbe, inline: true },
                { name: 'Gerekçe', value: sebep || 'Belirtilmedi' }
            )
            .setTimestamp();
        
        await logKanali.send({ embeds: [embed] });
    } catch (e) { console.error("Log hatası:", e); }
}

client.once('ready', async () => {
    console.log(`[BOT] ${client.user.tag} aktif!`);
    await noblox.setCookie(AYARLAR.ROBLOX_COOKIE).catch(console.error);
});

client.on('interactionCreate', async (interaction) => {
    // Autocomplete (Rütbe Arama)
    if (interaction.isAutocomplete()) {
        const focused = interaction.options.getFocused().toLowerCase();
        const filtered = TUM_RUTBELER.filter(r => r.name.toLowerCase().includes(focused)).slice(0, 25);
        await interaction.respond(filtered).catch(() => {});
        return;
    }

    if (!interaction.isChatInputCommand()) return;
    
    // Yetki Kontrolü
    const yetkiliKomutlari = ['rütbe-değiştir', 'terfi', 'tenzil', 'yasakla', 'duyuru'];
    if (yetkiliKomutlari.includes(interaction.commandName)) {
        if (!interaction.member.roles.cache.has(AYARLAR.YETKILI_ROL_ID) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Yetkiniz yetersiz.', ephemeral: true });
        }
    }

    await interaction.deferReply();

    try {
        const { commandName, options } = interaction;
        const username = options.getString('roblox-isim');
        
        // Rütbe komutları için ID al
        let userId;
        if (username) userId = await noblox.getIdFromUsername(username);

        switch (commandName) {
            case 'terfi':
                const eskiT = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);
                await noblox.promote(AYARLAR.GROUP_ID, userId);
                const yeniT = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);
                await logGonder(interaction, username, userId, eskiT, yeniT, options.getString('sebep'));
                interaction.editReply(`🎖️ **${username}** terfi edildi: ${yeniT}`);
                break;

            case 'tenzil':
                const eskiDe = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);
                await noblox.demote(AYARLAR.GROUP_ID, userId);
                const yeniDe = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);
                await logGonder(interaction, username, userId, eskiDe, yeniDe, options.getString('sebep'));
                interaction.editReply(`📉 **${username}** tenzil edildi: ${yeniDe}`);
                break;

            case 'aktiflik-sorgu':
                const res = await fetch(`https://games.roblox.com/v1/games?universeIds=${AYARLAR.OYUN_ID}`);
                const data = await res.json();
                interaction.editReply(`⚔️ Aktif oyuncu: **${data.data[0]?.playing || 0}**`);
                break;

            default:
                interaction.editReply("Komut işlendi.");
                break;
        }
    } catch (err) {
        interaction.editReply(`❌ Hata: ${err.message}`);
    }
});

client.login(AYARLAR.DISCORD_TOKEN);
