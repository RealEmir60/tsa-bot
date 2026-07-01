const { Client, GatewayIntentBits, EmbedBuilder, ActivityType, PermissionFlagsBits } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const noblox = require('noblox.js');
require('dotenv').config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates]
});

// Senin verdiğin tam rütbe listesi
const TUM_RUTBELER = [
    { name: '255. TSA', value: 255 }, { name: '254. Grup Sahibi', value: 254 },
    { name: '253. 2. Grup Sahibi', value: 253 }, { name: '252. Geliştirme Ofisi Başkanı', value: 252 },
    { name: '251. Geliştirme Ofisi', value: 251 }, { name: '250. Stajyer Geliştirme Ofisi', value: 250 },
    { name: '40. Rütbelendirme Botu', value: 40 }, { name: '36. Yardımcı Grup Sahibi', value: 36 },
    { name: '35. OF-10 Mareşal', value: 35 }, { name: '34. Yönetim Kurulu Başkanı', value: 34 },
    { name: '33. Yönetim Kurulu Başkan Y.', value: 33 }, { name: '32. Yönetim Kurulu', value: 32 },
    { name: '31. Yüksek Askeri Şura', value: 31 }, { name: '30. Genel Kurmay Başkanı', value: 30 },
    { name: '29. Genel Kurmay', value: 29 }, { name: '27. Lider', value: 27 },
    { name: '26. Disiplin Kurulu', value: 26 }, { name: '25. Ordu Komutanı', value: 25 },
    { name: '23. Paşa', value: 23 }, { name: '20. [OF-9] Orgeneral', value: 20 },
    { name: '19. [OF-8] Korgeneral', value: 19 }, { name: '18. [OF-7] Tümgeneral', value: 18 },
    { name: '17. [OF-6] Tuğgeneral', value: 17 }, { name: '16. [OF-5] Albay', value: 16 },
    { name: '15. [OF-4] Yarbay', value: 15 }, { name: '14. [OF-3] Binbaşı', value: 14 },
    { name: '13. [OF-2] YüzBaşı', value: 13 }, { name: '12. [OF-1/C] Üsteğmen', value: 12 },
    { name: '11. [OF-1/B] Teğmen', value: 11 }, { name: '10. [OF-1/A] Asteğmen', value: 10 },
    { name: '9. [OR-9] Astsubay Kıdemli Başçavuş', value: 9 }, { name: '8. [OR-8] Astsubay Başçavuş', value: 8 },
    { name: '7. [OR-7] Astsubay Üstçavuş', value: 7 }, { name: '6. [OR-6] Astsubay Çavuş', value: 6 },
    { name: '5. [OR-5] Uzman Çavuş', value: 5 }, { name: '4. [OR-4] Çavuş', value: 4 },
    { name: '3. [OR-3] Uzman Onbaşı', value: 3 }, { name: '2. [OR-2] Onbaşı', value: 2 },
    { name: '1. [OR-1] Acemi Er', value: 1 }
];

// Log Fonksiyonu
async function logGonder(guild, baslik, renk, aciklama) {
    const logKanal = guild.channels.cache.get(process.env.LOG_CHANNEL_ID);
    if (logKanal) {
        const embed = new EmbedBuilder().setTitle(baslik).setColor(renk).setDescription(aciklama).setTimestamp();
        logKanal.send({ embeds: [embed] });
    }
}

client.on('ready', async () => {
    await noblox.setCookie(process.env.ROBLOX_COOKIE);
    client.user.setActivity("TSA | Turkish Special Army Oynuyor", { type: ActivityType.Playing });
    console.log(`[Karargah] Bot Operasyona Hazır.`);
});

client.on('interactionCreate', async (interaction) => {
    // 1. Autocomplete (Rütbe Arama)
    if (interaction.isAutocomplete()) {
        const focused = interaction.options.getFocused().toLowerCase();
        const filtered = TUM_RUTBELER.filter(r => r.name.toLowerCase().includes(focused)).slice(0, 25);
        return interaction.respond(filtered);
    }

    if (!interaction.isChatInputCommand()) return;
    
    // Yetki Kontrolü
    if (!interaction.member.roles.cache.has(process.env.YETKILI_ROL_ID)) {
        return interaction.reply({ content: "❌ Bu işlem için yetkiniz yok.", ephemeral: true });
    }

    await interaction.deferReply();

    try {
        const { commandName, options, member, guild } = interaction;

        if (commandName === 'rütbe-değiştir') {
            const user = options.getString('roblox-isim');
            const rank = options.getInteger('rütbe');
            const sebep = options.getString('sebep');
            
            const id = await noblox.getIdFromUsername(user);
            const rName = TUM_RUTBELER.find(r => r.value === rank).name;
            await noblox.setRank(parseInt(process.env.GROUP_ID), id, rank);
            
            interaction.editReply(`✅ ${user} kullanıcısına ${rName} verildi.`);
            logGonder(guild, "🛡️ Rütbe Değişimi", 0x00FF00, `Yetkili: ${member.user.tag}\nKullanıcı: ${user}\nYeni Rütbe: ${rName}\nSebep: ${sebep}`);
        } 
        else if (commandName === 'terfi') {
            const id = await noblox.getIdFromUsername(options.getString('roblox-isim'));
            await noblox.promote(parseInt(process.env.GROUP_ID), id);
            interaction.editReply("📈 Terfi başarılı.");
        }
        else if (commandName === 'ses-kanalına-katıl') {
            const channel = member.voice.channel;
            if (!channel) return interaction.editReply("❌ Önce bir ses kanalına gir!");
            joinVoiceChannel({ channelId: channel.id, guildId: guild.id, adapterCreator: guild.voiceAdapterCreator });
            interaction.editReply("🔊 Kanala bağlandım.");
        }
        else if (commandName === 'ses-kanalından-ayrıl') {
            const connection = getVoiceConnection(guild.id);
            if (connection) connection.destroy();
            interaction.editReply("🔇 Kanaldan ayrıldım.");
        }
        // Diğer komutlar buraya...
    } catch (e) {
        interaction.editReply(`❌ Hata: ${e.message}`);
    }
});

client.login(process.env.DISCORD_TOKEN);
