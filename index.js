// ==================== 📦 OTOMATİK BAĞIMLILIK KONTROLÜ & LOJİSTİK DESTEK ====================
const { execSync } = require('child_process');
try {
    require('@discordjs/voice');
    require('libsodium-wrappers');
} catch (e) {
    console.log('[Karargah] Eksik ses modülleri tespit edildi, bulutta otomatik kurulum başlatılıyor...');
    try {
        execSync('npm install @discordjs/voice libsodium-wrappers --no-save', { stdio: 'inherit' });
        console.log('[Karargah] Ses modülleri başarıyla entegre edildi!');
    } catch (err) {
        console.error('[Karargah] Modül yükleme hatası:', err.message);
    }
}
// =========================================================================================

const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, ApplicationCommandOptionType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ActivityType } = require('discord.js');
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

// ==================== 🪖 TÜM RÜTBELERİN TAM LİSTESİ ====================
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
    { name: 'karargah-durum', description: 'TSA grubunun genel durum özetini gösterir.' }
];

async function robloxGiris() {
    try {
        if (!AYARLAR.ROBLOX_COOKIE) return console.error("[Roblox] Hata: ROBLOX_COOKIE tanımlanmamış!");
        await noblox.setCookie(AYARLAR.ROBLOX_COOKIE);
        const botKullanici = await noblox.getAuthenticatedUser();
        console.log(`[Roblox] Başarılı: ${botKullanici.UserName} olarak giriş yapıldı.`);
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

        const logKanali = client.channels.cache.get(AYARLAR.LOG_CHANNEL_ID);
        if (!logKanali) return;

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
            .setThumbnail(avatarUrl);

        const butonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Kullanıcı Bilgi')
                .setStyle(ButtonStyle.Link)
                .setURL(`https://www.roblox.com/users/${robloxUserId}/profile`)
        );

        await logKanali.send({ embeds: [logEmbed], components: [butonRow] });
    } catch (e) {
        console.error("[Log Hatası]", e.message);
    }
}

client.once('ready', async () => {
    console.log(`[Discord] Bot aktif: ${client.user.tag}`);
    
    // ⚔️ HEDEF DÜZELTME: "TSA | Turkish Special Army Oynuyor" Aktivitesi Netleştirildi.
    client.user.setActivity('TSA | Turkish Special Army', { type: ActivityType.Playing });
    
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
        if (interaction.commandName === 'rütbe-değiştir') {
            const focusedValue = interaction.options.getFocused().toLowerCase();
            let secenekler = !focusedValue 
                ? ILK_25_RUTBE 
                : TUM_RUTBELER.filter(r => r.name.toLowerCase().includes(focusedValue)).slice(0, 25);
            try { await interaction.respond(secenekler); } catch (err) {}
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;
    const { commandName, options, member, guild } = interaction;
    
    const yetkiliKomutlari = ['rütbe-değiştir', 'terfi', 'tenzil', 'duyuru', 'eğitim-başlat', 'grup-listele', 'yasakla', 'ses-katıl', 'ses-ayrıl'];
    if (yetkiliKomutlari.includes(commandName)) {
        if (!member.roles.cache.has(AYARLAR.YETKILI_ROL_ID) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Bu askeri komutu kullanmak için yetkili karargah rolüne sahip değilsiniz.', ephemeral: true });
        }
    }

    await interaction.deferReply();

    try {
        if (commandName === 'ses-katıl') {
            const sesKanali = member.voice.channel;
            if (!sesKanali) {
                return interaction.editReply("❌ Botu çağırabilmek için önce kendiniz bir ses kanalına girmelisiniz, komutanım.");
            }

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
            if (!baglanti) {
                return interaction.editReply("❌ Karargah botu şu anda herhangi bir ses kanalında aktif değil.");
            }

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

            await logGonder(interaction, username, userId, eskiRutbe, yeniRutbe, sebep);
            await interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2b2d31').setDescription(`✅ **${username}** personeli başarıyla **${yeniRutbe}** kadrosuna atandı.`)] });
        }

        else if (commandName === 'terfi') {
            const username = options.getString('roblox-isim');
            const sebep = options.getString('sebep');

            const userId = await noblox.getIdFromUsername(username);
            const eskiRutbe = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);
            
            await noblox.promote(AYARLAR.GROUP_ID, userId);
            await new Promise(resolve => setTimeout(resolve, 1500));
            const yeniRutbe = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);

            await logGonder(interaction, username, userId, eskiRutbe, yeniRutbe, sebep);
            await interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2b2d31').setDescription(`🎖️ **${username}** başarıyla bir üst rütbeye (**${yeniRutbe}**) terfi ettirildi.`)] });
        }

        else if (commandName === 'tenzil') {
            const username = options.getString('roblox-isim');
            const sebep = options.getString('sebep');

            const userId = await noblox.getIdFromUsername(username);
            const eskiRutbe = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);
            
            await noblox.demote(AYARLAR.GROUP_ID, userId);
            await new Promise(resolve => setTimeout(resolve, 1500));
            const yeniRutbe = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);

            await logGonder(interaction, username, userId, eskiRutbe, yeniRutbe, sebep);
            await interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2b2d31').setDescription(`📉 **${username}** isimli personelin rütbesi **${yeniRutbe}** rütbesine tenzil edildi.`)] });
        }

        else if (commandName === 'aktiflik-sorgu') {
            try {
                let inputId = AYARLAR.OYUN_ID.trim();
                let nihaiUniverseId = inputId;

                let url = `https://games.roblox.com/v1/games?universeIds=${inputId}`;
                let response = await fetch(url);
                let data = await response.json();

                if (!data || !data.data || data.data.length === 0) {
                    const ceviriciUrl = `https://apis.roblox.com/universes/v1/places/${inputId}/universe`;
                    const ceviriciRes = await fetch(ceviriciUrl);
                    const ceviriciData = await ceviriciRes.json();
                    
                    if (ceviriciData && ceviriciData.universeId) {
                        nihaiUniverseId = ceviriciData.universeId;
                        url = `https://games.roblox.com/v1/games?universeIds=${nihaiUniverseId}`;
                        response = await fetch(url);
                        data = await response.json();
                    }
                }
                
                let gercekAktifOyuncu = 0;
                if(data && data.data && data.data[0]) {
                    gercekAktifOyuncu = data.data[0].playing || 0;
                }

                const oyunEmbed = new EmbedBuilder()
                    .setColor('#2b2d31')
                    .setTitle('⚔️ Türk Askeri Oyunu | Canlı Aktiflik Radarı')
                    .setDescription(`Anlık olarak operasyon bölgesinde bulunan net personel sayısı: **${gercekAktifOyuncu}**`)
                    .setTimestamp()
                    .setFooter({ text: `Sistem: Akıllı Kimlik Doğrulaması Aktif` });

                await interaction.editReply({ embeds: [oyunEmbed] });
            } catch (err) {
                console.error("[Aktiflik Hatası]", err);
                await interaction.editReply("❌ Canlı oyuncu verisi şu an Roblox API sunucularından çekilemedi.");
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

            if (!sunucuUyesi || !sunucuUyesi.bannable) return interaction.editReply("❌ Kullanıcı bulunamadı veya botun yetkisi yetersiz.");

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
                if(rol.rank !== 0) liste += `**${rol.rank}.** ${rol.name} — *${rol.memberCount} üye*\n`;
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
            await interaction.editReply({ embeds: [new EmbedBuilder().setColor('#e67e22').setTitle('⚔️ | TSA EĞİTİM BAŞLANGICI').setDescription(`**Eğitim:** ${tur}\n**Saat:** ${saat}`)] });
        }

        else if (commandName === 'karargah-durum') {
            const grupDetay = await noblox.getGroup(AYARLAR.GROUP_ID);
            await interaction.editReply(`📊 **Toplam Alay Personeli:** ${grupDetay.memberCount} Asker`);
        }

    } catch (error) {
        console.error("[Komut Hatası]", error);
        if (interaction.deferred) await interaction.editReply(`❌ Karargah sistem hatası: ${error.message}`);
    }
});

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('TSA Karargah Sistemi Canli ve Aktif!\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`[Render] Port dinleniyor: ${PORT}`));

if (AYARLAR.DISCORD_TOKEN) client.login(AYARLAR.DISCORD_TOKEN);
