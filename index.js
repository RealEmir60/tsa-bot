const fetch = require('node-fetch');
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, ApplicationCommandOptionType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const noblox = require('noblox.js');
const http = require('http');

const AYARLAR = {
    DISCORD_TOKEN: process.env.DISCORD_TOKEN,
    ROBLOX_COOKIE: process.env.ROBLOX_COOKIE,
    GROUP_ID: parseInt(process.env.GROUP_ID) || 972348115,
    LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID || "1519328796275380325",
    YETKILI_ROL_ID: process.env.YETKILI_ROL_ID || "1518357646971764859",
    OYUN_ID: process.env.OYUN_ID || "138257110169831"
};

const TUM_RUTBELER = [
    { name: '[OR-1] Acemi Er', value: 1 },
    { name: '[OR-2] Onbaşı', value: 2 },
    { name: '[OR-3] Uzman Onbaşı', value: 3 },
    { name: '[OR-4] Çavuş', value: 4 },
    { name: '[OR-5] Uzman Çavuş', value: 5 },
    { name: '[OR-6] Astsubay Çavuş', value: 6 },
    { name: '[OR-7] Astsubay Üstçavuş', value: 7 },
    { name: '[OR-8] Astsubay Başçavuş', value: 8 },
    { name: '[OR-9] Astsubay Kd. Başçavuş', value: 9 },
    { name: '[OF-1/A] Asteğmen', value: 10 },
    { name: '[OF-1/B] Teğmen', value: 11 },
    { name: '[OF-1/C] Üsteğmen', value: 12 },
    { name: '[OF-2] YüzBaşı', value: 13 },
    { name: '[OF-3] Binbaşı', value: 14 },
    { name: '[OF-4] Yarbay', value: 15 },
    { name: '[OF-5] Albay', value: 16 },
    { name: '[OF-6] Tuğgeneral', value: 17 },
    { name: '[OF-7] Tümgeneral', value: 18 },
    { name: '[OF-8] Korgeneral', value: 19 },
    { name: '[OF-9] Orgeneral', value: 20 },
    { name: 'Paşa', value: 23 },
    { name: 'Ordu Komutanı', value: 25 },
    { name: 'Disiplin Kurulu', value: 26 },
    { name: 'Lider', value: 27 },
    { name: 'Genel Kurmay', value: 29 },
    { name: 'Genel Kurmay Başkanı', value: 30 },
    { name: 'Yüksek Askeri Şura', value: 31 },
    { name: 'Yönetim Kurulu', value: 32 },
    { name: 'Yönetim Kurulu Başkan Y.', value: 33 },
    { name: 'Yönetim Kurulu Başkanı', value: 34 },
    { name: 'OF-10 Mareşal', value: 35 },
    { name: 'Yardımcı Grup Sahibi', value: 36 },
    { name: 'Rütbelendirme Botu', value: 40 },
    { name: 'Stajyer Geliştirme Ofisi', value: 250 },
    { name: 'Geliştirme Ofisi', value: 251 },
    { name: 'Geliştirme Ofisi Başkanı', value: 252 },
    { name: '2. Grup Sahibi', value: 253 },
    { name: 'Grup Sahibi', value: 254 },
    { name: 'TSA', value: 255 }
];

const ILK_25_RUTBE = TUM_RUTBELER.slice(0, 25);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates]
});

const commands = [
    {
        name: 'rütbe-değiştir',
        description: 'Belirtilen personelin rütbesini listeden seçerek veya aratarak değiştirir.',
        options: [
            { name: 'roblox-isim', description: 'Roblox kullanıcı adı', type: ApplicationCommandOptionType.String, required: true },
            { name: 'rütbe', description: 'Rütbe seçin veya aratın', type: ApplicationCommandOptionType.Integer, required: true, autocomplete: true },
            { name: 'sebep', description: 'İşlem gerekçesi', type: ApplicationCommandOptionType.String, required: true }
        ]
    },
    { name: 'ses-katıl', description: 'Botun, bulunduğunuz aktif askeri ses kanalına bağlanmasını sağlar.' },
    { name: 'ses-ayrıl', description: 'Botun bulunduğu ses kanalından ayrılmasını tetikler.' },
    {
        name: 'terfi',
        description: 'Kullanıcıyı grupta +1 rütbe yükseltir.',
        options: [
            { name: 'roblox-isim', description: 'Roblox kullanıcı adı', type: ApplicationCommandOptionType.String, required: true },
            { name: 'sebep', description: 'Terfi sebebi', type: ApplicationCommandOptionType.String, required: true }
        ]
    },
    {
        name: 'tenzil',
        description: 'Kullanıcının gruptaki rütbesini -1 derece düşürür.',
        options: [
            { name: 'roblox-isim', description: 'Roblox kullanıcı adı', type: ApplicationCommandOptionType.String, required: true },
            { name: 'sebep', description: 'Tenzil sebebi', type: ApplicationCommandOptionType.String, required: true }
        ]
    },
    {
        name: 'profile',
        description: 'Belirtilen personelin rütbe, grup ve Roblox bilgilerini getirir.',
        options: [
            { name: 'roblox-isim', description: 'Roblox kullanıcı adı', type: ApplicationCommandOptionType.String, required: true }
        ]
    },
    {
        name: 'grup-listele',
        description: 'Belirtilen Roblox kullanıcısının mevcut olduğu tüm grupları listeler.',
        options: [
            { name: 'roblox-isim', description: 'Roblox kullanıcı adı', type: ApplicationCommandOptionType.String, required: true }
        ]
    },
    {
        name: 'yasakla',
        description: 'Kuralları ihlal eden bir üyeyi sunucudan yasaklar.',
        options: [
            { name: 'kullanıcı', description: 'Yasaklanacak Discord üyesi', type: ApplicationCommandOptionType.User, required: true },
            { name: 'sebep', description: 'Yasaklanma askeri gerekçesi', type: ApplicationCommandOptionType.String, required: true }
        ]
    },
    { name: 'aktiflik-sorgu', description: 'Türk Askeri Oyunu içerisindeki anlık aktif oyuncu sayısını gösterir.' },
    { name: 'grup', description: 'TSA Roblox grup linkini gönderir.' },
    { name: 'rütbeler', description: 'TSA grubundaki tüm rütbeleri listeler.' },
    {
        name: 'duyuru',
        description: 'Seçilen kanala kurumsal bir duyuru gönderir.',
        options: [
            { name: 'kanal', description: 'Duyurunun atılacağı kanal', type: ApplicationCommandOptionType.Channel, required: true },
            { name: 'içerik', description: 'Duyuru metni', type: ApplicationCommandOptionType.String, required: true }
        ]
    },
    {
        name: 'eğitim-başlat',
        description: 'Karargah bünyesinde resmi bir eğitim duyurusu başlatır.',
        options: [
            { name: 'tür', description: 'Eğitim Türü', type: ApplicationCommandOptionType.String, required: true },
            { name: 'saat', description: 'Eğitim Saati (Örn: 20:00)', type: ApplicationCommandOptionType.String, required: true }
        ]
    },
    { name: 'karargah-durum', description: 'TSA grubunun genel durum özetini gösterir.' },
    {
        name: 'sorgula',
        description: 'Personelin son rütbe değişim loglarını gösterir',
        options: [
            { name: 'roblox-isim', description: 'Roblox kullanıcı adı', type: ApplicationCommandOptionType.String, required: true }
        ]
    },
    {
        name: 'toplu-rütbe',
        description: 'Birden fazla personeli aynı rütbeye atar',
        options: [
            { name: 'kullanicilar', description: 'Virgülle ayır: user1,user2,user3', type: ApplicationCommandOptionType.String, required: true },
            { name: 'rütbe', description: 'Atanacak rütbe', type: ApplicationCommandOptionType.Integer, required: true, autocomplete: true },
            { name: 'sebep', description: 'Ortak gerekçe', type: ApplicationCommandOptionType.String, required: true }
        ]
    },
    {
        name: 'temizle',
        description: 'Kanaldan belirtilen sayıda mesajı temizler.',
        options: [
            { name: 'adet', description: '1-100 arası silinecek mesaj sayısı', type: ApplicationCommandOptionType.Integer, required: true }
        ]
    },
    {
        name: 'davet',
        description: 'Roblox kullanıcısını oyuna davet eder.',
        options: [
            { name: 'roblox-isim', description: 'Davet edilecek Roblox kullanıcı adı', type: ApplicationCommandOptionType.String, required: true },
            { name: 'mesaj', description: 'Davet mesajı', type: ApplicationCommandOptionType.String, required: false }
        ]
    },
    {
        name: 'izin',
        description: 'Belirtilen Discord üyesine geçici yetkili rolü verir.',
        options: [
            { name: 'kullanıcı', description: 'Yetki verilecek Discord üyesi', type: ApplicationCommandOptionType.User, required: true },
            { name: 'süre', description: 'Dakika cinsinden süre. Örn: 60', type: ApplicationCommandOptionType.Integer, required: true }
        ]
    },
    {
        name: 'yoklama',
        description: 'Bulunduğun ses kanalındaki personelin rütbelerini listeler.'
    },
    {
        name: 'duyuru-sabitle',
        description: 'Duyuru atar ve kanala sabitler.',
        options: [
            { name: 'kanal', description: 'Duyuru kanalı', type: ApplicationCommandOptionType.Channel, required: true },
            { name: 'içerik', description: 'Duyuru metni', type: ApplicationCommandOptionType.String, required: true },
            { name: 'etiket', description: 'Everyone etiketlensin mi?', type: ApplicationCommandOptionType.Boolean, required: false }
        ]
    },
    {
        name: 'ceza',
        description: 'Personele disiplin cezası verir.',
        options: [
            { name: 'roblox-isim', description: 'Cezalı personel', type: ApplicationCommandOptionType.String, required: true },
            { name: 'sebep', description: 'Ceza sebebi', type: ApplicationCommandOptionType.String, required: true }
        ]
    },
    {
        name: 'nöbet',
        description: 'Nöbet listesi oluşturur.',
        options: [
            { name: 'kişiler', description: 'Virgülle ayır: user1,user2,user3', type: ApplicationCommandOptionType.String, required: true },
            { name: 'süre', description: 'Kaç dakikada bir değişsin', type: ApplicationCommandOptionType.Integer, required: true }
        ]
    },
    {
        name: 'aktiflik-duyuru',
        description: 'Oyuna davet duyurusu atar ve @here etiketler.',
        options: [
            { name: 'kanal', description: 'Duyurunun atılacağı kanal', type: ApplicationCommandOptionType.Channel, required: false }
        ]
    }
];

async function robloxGiris() {
    try {
        if (!AYARLAR.ROBLOX_COOKIE) throw new Error("ROBLOX_COOKIE tanımlanmamış!");
        const currentUser = await noblox.setCookie(AYARLAR.ROBLOX_COOKIE);
        console.log(`[Roblox] Başarılı: ${currentUser.UserName} olarak giriş yapıldı.`);
    } catch (err) {
        console.error("[Roblox] Giriş başarısız:", err.message);
    }
}

async function logGonder(interaction, robloxUsername, robloxUserId, eskiRutbe, yeniRutbe, sebep) {
    try {
        let avatarUrl = "https://www.roblox.com/images/ThumbnailHolder/Player.png";
        try {
            const avatarResmi = await noblox.getPlayerThumbnail(robloxUserId, "150x150", "png", false, "Headshot");
            if (avatarResmi && avatarResmi[0]) avatarUrl = avatarResmi[0].imageUrl;
        } catch (e) {}

        const logEmbed = new EmbedBuilder()
     .setColor('#3b5998')
     .setTitle('İşlem Başarılı Rütbe Değiştirildi')
     .addFields(
                { name: 'Kullanıcı', value: `${robloxUsername}`, inline: false },
                { name: 'İşlem Yapan', value: `${interaction.user.username}`, inline: false },
                { name: 'Eski Rütbe', value: `${eskiRutbe}`, inline: false },
                { name: 'Yeni Rütbe', value: `${yeniRutbe}`, inline: false },
                { name: 'Sebep', value: `${sebep || 'Belirtilmedi'}`, inline: false }
            )
     .setThumbnail(avatarUrl)
     .setTimestamp();

        const butonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
         .setLabel('Kullanıcı Bilgi')
         .setStyle(ButtonStyle.Link)
         .setURL(`https://www.roblox.com/users/${robloxUserId}/profile`)
        );

        const logKanali = client.channels.cache.get(AYARLAR.LOG_CHANNEL_ID);
        if (logKanali) await logKanali.send({ embeds: [logEmbed], components: [butonRow] });

        return { embeds: [logEmbed], components: [butonRow] };
    } catch (e) {
        console.error("[Log Hatası]", e.message);
        return { content: '❌ Log gönderilemedi ama işlem başarılı.' };
    }
}

client.once('clientReady', async () => {
    console.log(`[Discord] Bot aktif: ${client.user.tag}`);
    client.user.setActivity('TSA | Karargah Radarı', { type: 0 });
    await robloxGiris();

    if (!AYARLAR.DISCORD_TOKEN) return;
    const rest = new REST({ version: '10' }).setToken(AYARLAR.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('[Discord] Slash komutları başarıyla senkronize edildi!');
    } catch (error) {
        console.error("[Discord Komut Hatası]", error);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isAutocomplete()) {
        if (interaction.commandName === 'rütbe-değiştir' || interaction.commandName === 'toplu-rütbe') {
            const focusedValue = interaction.options.getFocused().toLowerCase();
            let secenekler =!focusedValue
         ? ILK_25_RUTBE
                : TUM_RUTBELER.filter(r => r.name.toLowerCase().includes(focusedValue)).slice(0, 25);
            try { await interaction.respond(secenekler); } catch (err) {}
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;
    const { commandName, options, member, guild } = interaction;

    const yetkiliKomutlari = ['rütbe-değiştir', 'terfi', 'tenzil', 'duyuru', 'eğitim-başlat', 'grup-listele', 'yasakla', 'ses-katıl', 'ses-ayrıl', 'toplu-rütbe', 'temizle', 'davet', 'izin', 'yoklama', 'duyuru-sabitle', 'ceza', 'nöbet', 'aktiflik-duyuru'];
    if (yetkiliKomutlari.includes(commandName)) {
        if (!member.roles.cache.has(AYARLAR.YETKILI_ROL_ID) &&!member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Bu askeri komutu kullanmak için yetkili karargah rolüne sahip olmalısınız.', ephemeral: true });
        }
    }

    await interaction.deferReply();

    try {
        if (commandName === 'ses-katıl') {
            const sesKanali = member.voice.channel;
            if (!sesKanali) return interaction.editReply("❌ Botu çağırabilmek için önce kendiniz bir ses kanalına girmelisiniz, komutanım.");
            joinVoiceChannel({
                channelId: sesKanali.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
                selfMute: false,
                selfDeaf: true
            });
            await interaction.editReply(`🔊 **${sesKanali.name}** kanalına intikal edildi. Nöbet başladı!`);
        }

        else if (commandName === 'ses-ayrıl') {
            const baglanti = getVoiceConnection(guild.id);
            if (!baglanti) return interaction.editReply("❌ Karargah botu şu anda herhangi bir ses kanalında aktif değil.");
            baglanti.destroy();
            await interaction.editReply("🛑 Ses kanalından başarıyla ayrılındı, nöbet tamamlandı.");
        }

        else if (commandName === 'rütbe-değiştir') {
            const username = options.getString('roblox-isim');
            const targetRankId = options.getInteger('rütbe');
            const sebep = options.getString('sebep');
            const userId = await noblox.getIdFromUsername(username);
            const eskiRutbe = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);
            await noblox.setRank(AYARLAR.GROUP_ID, userId, targetRankId);
            await new Promise(resolve => setTimeout(resolve, 1500));
            const yeniRutbe = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);
            const sonuc = await logGonder(interaction, username, userId, eskiRutbe, yeniRutbe, sebep);
            await interaction.editReply(sonuc);
        }

        else if (commandName === 'terfi') {
            const username = options.getString('roblox-isim');
            const sebep = options.getString('sebep');
            const userId = await noblox.getIdFromUsername(username);
            const eskiRutbe = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);
            await noblox.promote(AYARLAR.GROUP_ID, userId);
            await new Promise(resolve => setTimeout(resolve, 1500));
            const yeniRutbe = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);
            const sonuc = await logGonder(interaction, username, userId, eskiRutbe, yeniRutbe, sebep);
            await interaction.editReply(sonuc);
        }

        else if (commandName === 'tenzil') {
            const username = options.getString('roblox-isim');
            const sebep = options.getString('sebep');
            const userId = await noblox.getIdFromUsername(username);
            const eskiRutbe = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);
            await noblox.demote(AYARLAR.GROUP_ID, userId);
            await new Promise(resolve => setTimeout(resolve, 1500));
            const yeniRutbe = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);
            const sonuc = await logGonder(interaction, username, userId, eskiRutbe, yeniRutbe, sebep);
            await interaction.editReply(sonuc);
        }

        else if (commandName === 'aktiflik-sorgu') {
            try {
                let inputId = AYARLAR.OYUN_ID.toString().trim();
                const ceviriciUrl = `https://apis.roblox.com/universes/v1/places/${inputId}/universe`;
                const ceviriciRes = await fetch(ceviriciUrl);
                const ceviriciData = await ceviriciRes.json();
                let universeId = inputId;
                if (ceviriciData && ceviriciData.universeId) universeId = ceviriciData.universeId;
                const url = `https://games.roblox.com/v1/games?universeIds=${universeId}`;
                const response = await fetch(url);
                const data = await response.json();
                if (data && data.data && data.data.length > 0) {
                    const gercekAktifOyuncu = data.data[0].playing || 0;
                    const oyunEmbed = new EmbedBuilder()
                 .setColor('#2b2d31')
                 .setTitle('⚔ Türk Askeri Oyunu | Canlı Aktiflik Radarı')
                 .setDescription(`Anlık olarak operasyon bölgesinde bulunan net personel sayısı: **${gercekAktifOyuncu}**`)
                 .setTimestamp()
                 .setFooter({ text: 'Sistem: Karargah Canlı Senkronizasyonu Aktif' });
                    await interaction.editReply({ embeds: [oyunEmbed] });
                } else {
                    await interaction.editReply("❌ Oyun verileri Roblox sunucularından çekilemedi. Lütfen OYUN_ID değerini kontrol edin.");
                }
            } catch (err) {
                console.error("[Aktiflik Hatası]", err);
                await interaction.editReply(`❌ Aktiflik verisi işlenirken teknik bir sorun oluştu: ${err.message}`);
            }
        }

        else if (commandName === 'profile') {
            const username = options.getString('roblox-isim');
            const userId = await noblox.getIdFromUsername(username);
            const rankName = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);
            const avatarResmi = await noblox.getPlayerThumbnail(userId, "150x150", "png", false, "Headshot");
            const avatarUrl = avatarResmi[0]?.imageUrl || "https://www.roblox.com/images/ThumbnailHolder/Player.png";
            const profilEmbed = new EmbedBuilder()
         .setColor('#2b2d31')
         .setTitle(`| TSA | Personel Künye Bilgisi`)
         .setDescription(`**Kullanıcı Adı:** ${username}\n**Mevcut Rütbe:** ${rankName}`)
         .setThumbnail(avatarUrl);
            const profilButon = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setLabel('Profilini Aç').setStyle(ButtonStyle.Link).setURL(`https://www.roblox.com/users/${userId}/profile`)
            );
            await interaction.editReply({ embeds: [profilEmbed], components: [profilButon] });
        }

        else if (commandName === 'grup-listele') {
            const username = options.getString('roblox-isim');
            const userId = await noblox.getIdFromUsername(username);
            const gruplar = await noblox.getGroups(userId);
            let grupMetni = "";
            gruplar.slice(0, 15).forEach(g => {
                grupMetni += `• **${g.Name}** — *Rütbe: ${g.Role}*\n`;
            });
            const grupEmbed = new EmbedBuilder()
         .setColor('#2b2d31')
         .setTitle(`📂 ${username} Kullanıcısının Roblox Grupları`)
         .setDescription(grupMetni || "Bu kullanıcı herhangi bir Roblox grubuna üye değil.");
            await interaction.editReply({ embeds: [grupEmbed] });
        }

        else if (commandName === 'yasakla') {
            const hedefKullanici = options.getUser('kullanıcı');
            const sebep = options.getString('sebep');
            const sunucuUyesi = await guild.members.fetch(hedefKullanici.id).catch(() => null);
            if (!sunucuUyesi ||!sunucuUyesi.bannable) return interaction.editReply("❌ Kullanıcı bulunamadı veya botun yetkisi yetersiz.");
            await sunucuUyesi.ban({ reason: sebep });
            await interaction.editReply(`✅ ${hedefKullanici.tag} başarıyla sunucudan uzaklaştırıldı.`);
        }

        else if (commandName === 'grup') {
            await interaction.editReply('🪖 **TSA Roblox Grubu:** https://www.roblox.com/tr/communities/972348115/TSA-Turkish-Armed-Forces-Yeniden');
        }

        else if (commandName === 'rütbeler') {
            const roller = await noblox.getRoles(AYARLAR.GROUP_ID);
            let liste = "";
            roller.reverse().forEach(rol => {
                if(rol.rank!== 0) liste += `**${rol.rank}.** ${rol.name} — *${rol.memberCount} üye*\n`;
            });
            await interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2b2d31').setTitle('| TSA | Rütbeler').setDescription(liste.slice(0, 4000))] });
        }

        else if (commandName === 'duyuru') {
            const hedefKanal = options.getChannel('kanal');
            const icerik = options.getString('içerik');
            await hedefKanal.send({ embeds: [new EmbedBuilder().setColor('#ff0000').setTitle('📢 | TSA DUYURUSU').setDescription(icerik)] });
            await interaction.editReply(`✅ Duyuru iletildi.`);
        }

        else if (commandName === 'eğitim-başlat') {
            const tur = options.getString('tür');
            const saat = options.getString('saat');
            await interaction.editReply({ embeds: [new EmbedBuilder().setColor('#e67e22').setTitle('⚔ | TSA EĞİTİM BAŞLANGICI').setDescription(`**Eğitim:** ${tur}\n**Saat:** ${saat}`)] });
        }

        else if (commandName === 'karargah-durum') {
            const grupDetay = await noblox.getGroup(AYARLAR.GROUP_ID);
            await interaction.editReply(`📊 **Toplam Alay Personeli:** ${grupDetay.memberCount} Asker`);
        }

        else if (commandName === 'sorgula') {
            const username = options.getString('roblox-isim');
            const logKanali = client.channels.cache.get(AYARLAR.LOG_CHANNEL_ID);
            if (!logKanali) return interaction.editReply("❌ Log kanalı bulunamadı.");
            const messages = await logKanali.messages.fetch({ limit: 100 });
            const userLogs = messages.filter(m => m.embeds[0]?.fields?.find(f => f.name === 'Kullanıcı' && f.value === username)).first(5);
            if (!userLogs.length) return interaction.editReply(`❌ **${username}** için log kaydına rastlanmadı.`);
            let logText = userLogs.map(log => {
                const eski = log.embeds[0].fields.find(f => f.name === 'Eski Rütbe').value;
                const yeni = log.embeds[0].fields.find(f => f.name === 'Yeni Rütbe').value;
                const tarih = `<t:${Math.floor(log.createdTimestamp / 1000)}:R>`;
                return `**${eski}** → **${yeni}** ${tarih}`;
            }).join('\n');
            await interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2b2d31').setTitle(`📜 ${username} Rütbe Geçmişi`).setDescription(logText)] });
        }

        else if (commandName === 'toplu-rütbe') {
            const userList = options.getString('kullanicilar').split(',').map(u => u.trim());
            const targetRankId = options.getInteger('rütbe');
            const sebep = options.getString('sebep');
            const yeniRutbeAdi = TUM_RUTBELER.find(r => r.value === targetRankId).name;
            await interaction.editReply(`⏳ ${userList.length} personel işleniyor...`);
            let basarili = 0, hatali = [];
            for (const username of userList) {
                try {
                    const userId = await noblox.getIdFromUsername(username);
                    const eskiRutbe = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);
                    await noblox.setRank(AYARLAR.GROUP_ID, userId, targetRankId);
                    await logGonder(interaction, username, userId, eskiRutbe, yeniRutbeAdi, sebep);
                    basarili++;
                    await new Promise(r => setTimeout(r, 1500));
                } catch(e) { hatali.push(username); }
            }
            await interaction.editReply(`✅ Toplu atama bitti.\n**Başarılı:** ${basarili}\n**Hatalı:** ${hatali.join(', ') || 'Yok'}`);
        }

        else if (commandName === 'temizle') {
            const adet = options.getInteger('adet');
            if (adet < 1 || adet > 100) return interaction.editReply('❌ 1 ile 100 arasında bir sayı girmelisin.');
            const silinen = await interaction.channel.bulkDelete(adet, true);
            await interaction.editReply(`🧹 **${silinen.size}** mesaj temizlendi.`);
            setTimeout(() => interaction.deleteReply(), 3000);
        }

        else if (commandName === 'davet') {
            const username = options.getString('roblox-isim');
            const mesaj = options.getString('mesaj') || 'TSA Karargah tarafından oyuna davet edildiniz!';
            const userId = await noblox.getIdFromUsername(username);

            const davetEmbed = new EmbedBuilder()
         .setColor('#00ff00')
         .setTitle('🎮 TSA Oyun Daveti')
         .setDescription(`**${username}** için davet oluşturuldu.\n\n**Mesaj:** ${mesaj}`)
         .addFields({ name: 'Oyun Linki', value: `https://www.roblox.com/games/${AYARLAR.OYUN_ID}` })
         .setFooter({ text: `Davet eden: ${interaction.user.username}` });

            await interaction.editReply({ embeds: [davetEmbed] });
        }

        else if (commandName === 'izin') {
            const hedefUye = options.getMember('kullanıcı');
            const sureDk = options.getInteger('süre');
            if (!hedefUye) return interaction.editReply('❌ Kullanıcı bulunamadı.');

            await hedefUye.roles.add(AYARLAR.YETKILI_ROL_ID);
            await interaction.editReply(`✅ **${hedefUye.user.username}** kullanıcısına **${sureDk} dakika** yetkili rolü verildi.`);

            setTimeout(async () => {
                try {
                    if (hedefUye.roles.cache.has(AYARLAR.YETKILI_ROL_ID)) {
                        await hedefUye.roles.remove(AYARLAR.YETKILI_ROL_ID);
                        interaction.channel.send(`⏰ **${hedefUye.user.username}** kullanıcısının yetkili rolü süresi doldu, geri alındı.`);
                    }
                } catch(e) {}
            }, sureDk * 60 * 1000);
        }

        else if (commandName === 'yoklama') {
            const sesKanali = member.voice.channel;
            if (!sesKanali) return interaction.editReply("❌ Yoklama için bir ses kanalında olmalısın.");

            await interaction.editReply('⏳ Personel künyeleri kontrol ediliyor...');
            const uyeler = sesKanali.members.filter(m =>!m.user.bot);
            let yoklamaListesi = '';
            let sayac = 0;

            for (const [id, uye] of uyeler) {
                try {
                    const dcNick = uye.nickname || uye.user.username;
                    const match = dcNick.match(/\(([^)]+)\)/);
                    if (!match) {
                        yoklamaListesi += `❓ ${dcNick} - *Roblox ismi bulunamadı*\n`;
                        continue;
                    }
                    const robloxIsim = match[1];
                    const userId = await noblox.getIdFromUsername(robloxIsim);
                    const rutbe = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);
                    yoklamaListesi += `✅ **${robloxIsim}** - ${rutbe}\n`;
                    sayac++;
                    await new Promise(r => setTimeout(r, 800));
                } catch(e) {
                    yoklamaListesi += `❌ ${uye.user.username} - *Hata*\n`;
                }
            }

            const embed = new EmbedBuilder()
         .setColor('#00ff00')
         .setTitle(`📋 ${sesKanali.name} Yoklama Raporu`)
         .setDescription(yoklamaListesi || 'Kanalda personel yok.')
         .setFooter({ text: `Toplam ${sayac} personel tespit edildi` })
         .setTimestamp();

            await interaction.editReply({ content: '', embeds: [embed] });
        }

        else if (commandName === 'duyuru-sabitle') {
            const hedefKanal = options.getChannel('kanal');
            const icerik = options.getString('içerik');
            const etiketle = options.getBoolean('etiket') || false;

            const duyuruEmbed = new EmbedBuilder()
         .setColor('#ff0000')
         .setTitle('📢 | TSA RESMİ DUYURU')
         .setDescription(icerik)
         .setFooter({ text: `Duyuran: ${interaction.user.username}` })
         .setTimestamp();

            const mesaj = await hedefKanal.send({
                content: etiketle? '@everyone' : null,
                embeds: [duyuruEmbed]
            });
            await mesaj.pin();
            await interaction.editReply(`✅ Duyuru ${hedefKanal} kanalına atıldı ve sabitlendi.`);
        }

        else if (commandName === 'ceza') {
            const username = options.getString('roblox-isim');
            const sebep = options.getString('sebep');
            const userId = await noblox.getIdFromUsername(username);
            const rutbe = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);

            const cezaEmbed = new EmbedBuilder()
         .setColor('#ff0000')
         .setTitle('⚠️ Disiplin Cezası')
         .addFields(
                    { name: 'Personel', value: username, inline: true },
                    { name: 'Rütbe', value: rutbe, inline: true },
                    { name: 'Ceza Veren', value: interaction.user.username, inline: true },
                    { name: 'Sebep', value: sebep, inline: false }
                )
         .setTimestamp();

            const logKanali = client.channels.cache.get(AYARLAR.LOG_CHANNEL_ID);
            if (logKanali) await logKanali.send({ embeds: [cezaEmbed] });

            await interaction.editReply({ embeds: [cezaEmbed] });
        }

        else if (commandName === 'nöbet') {
            const kisiler = options.getString('kişiler').split(',').map(k => k.trim());
            const sureDk = options.getInteger('süre');

            await interaction.editReply(`🔔 Nöbet sistemi başlatıldı. **${sureDk}** dakikada bir değişim olacak.\n\n**Liste:** ${kisiler.join(' → ')}`);

            let si
