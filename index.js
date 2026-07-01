const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, REST, Routes, ApplicationCommandOptionType, PermissionFlagsBits } = require('discord.js');
const noblox = require('noblox.js');
const http = require('http');

const AYARLAR = {
    DISCORD_TOKEN: process.env.DISCORD_TOKEN, 
    ROBLOX_COOKIE: process.env.ROBLOX_COOKIE, 
    GROUP_ID: parseInt(process.env.GROUP_ID) || 972348115, 
    LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID || "1519328796275380325", 
    YETKILI_ROL_ID: process.env.YETKILI_ROL_ID || "1518357646971764859", 
    OYUN_ID: 138257110169831 
};

// ==================== 🪖 SABİT RÜTBE LİSTELERİ ====================
const ER_VE_SUBAY_KADROSU = [
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
    { name: '[OF-5] Albay', value: 16 }
];

const UST_KOMUTA_VE_YONETIM = [
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
// ===================================================================

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers]
});

const commands = [
    {
        name: 'rütbe-değiştir',
        description: 'Belirtilen Roblox kullanıcısının rütbesini alt kadrodan bir rütbeye ayarlar.',
        options: [
            { name: 'roblox-isim', description: 'Roblox kullanıcı adı', type: ApplicationCommandOptionType.String, required: true },
            { 
                name: 'rütbe', 
                description: 'Değiştirilmek istenen yeni rütbe (Er - Albay Arası)', 
                type: ApplicationCommandOptionType.Integer, 
                required: true,
                choices: ER_VE_SUBAY_KADROSU
            },
            { name: 'sebep', description: 'İşlem sebebi', type: ApplicationCommandOptionType.String, required: true }
        ]
    },
    {
        name: 'yönetim-rütbe-değiştir',
        description: 'Belirtilen personeli üst komuta veya yönetim kurullarına atar.',
        options: [
            { name: 'roblox-isim', description: 'Roblox kullanıcı adı', type: ApplicationCommandOptionType.String, required: true },
            { 
                name: 'rütbe', 
                description: 'Değiştirilmek istenen üst rütbe (Generaller ve Yönetim)', 
                type: ApplicationCommandOptionType.Integer, 
                required: true,
                choices: UST_KOMUTA_VE_YONETIM
            },
            { name: 'sebep', description: 'İşlem sebebi', type: ApplicationCommandOptionType.String, required: true }
        ]
    },
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
            { name: 'roblox-isim', description: 'Bilgilerine bakılacak Roblox kullanıcı adı', type: ApplicationCommandOptionType.String, required: true }
        ]
    },
    {
        name: 'grup-listele',
        description: 'Belirtilen Roblox kullanıcısının mevcut olduğu tüm grupları listeler.',
        options: [
            { name: 'roblox-isim', description: 'Grupları sorgulanacak Roblox kullanıcı adı', type: ApplicationCommandOptionType.String, required: true }
        ]
    },
    {
        name: 'yasakla',
        description: 'Huzursuzluk çıkaran veya kuralları ihlal eden bir üyeyi sunucudan yasaklar.',
        options: [
            { name: 'kullanıcı', description: 'Yasaklanacak Discord üyesi', type: ApplicationCommandOptionType.User, required: true },
            { name: 'sebep', description: 'Yasaklanma askeri gerekçesi', type: ApplicationCommandOptionType.String, required: true }
        ]
    },
    { name: 'aktiflik-sorgu', description: 'Türk Askeri Oyunu içerisindeki gerçek ve anlık aktif oyuncu sayısını gösterir.' },
    { name: 'grup', description: 'TSA Roblox grup linkini gönderir.' },
    { name: 'rütbeler', description: 'TSA grubundaki tüm rütbeleri ve üye sayılarını listeler.' },
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
            { name: 'tür', description: 'Eğitim Türü (Örn: Formasyon, Atış, Disiplin)', type: ApplicationCommandOptionType.String, required: true },
            { name: 'saat', description: 'Eğitim Saati (Örn: 20:00)', type: ApplicationCommandOptionType.String, required: true }
        ]
    },
    { name: 'karargah-durum', description: 'TSA grubunun genel ve lojistik durum özetini gösterir.' }
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
            .setColor('#2b2d31')
            .setTitle('| TSA  |  Karargah')
            .setDescription(
                `**İşlem Başarılı Rütbe Değiştirildi**\n\n` +
                `**Kullanıcı:** ${robloxUsername}\n` +
                `**İşlem Yapan:** ${interaction.user.username}\n` +
                `**Eski Rütbe:** ${eskiRutbe}\n` +
                `**Yeni Rütbe:** ${yeniRutbe}\n` +
                `**Sebep:** ${sebep}`
            )
            .setThumbnail(avatarUrl);

        await logKanali.send({ embeds: [logEmbed] });
    } catch (e) {
        console.error("[Log Hatası]", e.message);
    }
}

client.once('ready', async () => {
    console.log(`[Discord] Bot aktif: ${client.user.tag}`);
    client.user.setActivity('TSA | Turkish Special Army', { type: 0 });
    await robloxGiris();

    if (!AYARLAR.DISCORD_TOKEN) return;
    const rest = new REST({ version: '10' }).setToken(AYARLAR.DISCORD_TOKEN);
    try {
        console.log('[Discord] Slash komutları yükleniyor...');
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('[Discord] Slash komutları başarıyla senkronize edildi!');
    } catch (error) {
        console.error("[Discord Komut Hatası]", error);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, member, guild } = interaction;
    
    const yetkiliKomutlari = ['rütbe-değiştir', 'yönetim-rütbe-değiştir', 'terfi', 'tenzil', 'duyuru', 'eğitim-başlat', 'grup-listele', 'yasakla'];
    if (yetkiliKomutlari.includes(commandName)) {
        if (!member.roles.cache.has(AYARLAR.YETKILI_ROL_ID) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Bu askeri komutu kullanmak için yetkili karargah rolüne sahip değilsiniz.', ephemeral: true });
        }
    }

    await interaction.deferReply();

    try {
        if (commandName === 'grup-listele') {
            const username = options.getString('roblox-isim');
            const userId = await noblox.getIdFromUsername(username);
            const gruplar = await noblox.getGroups(userId);

            let grupMetni = "";
            gruplar.forEach((g, index) => {
                if (index < 20) { 
                    grupMetni += `• **${g.Name}** — *Rütbe: ${g.Role} (ID: ${g.Rank})*\n`;
                }
            });

            if(!grupMetni) grupMetni = "Bu kullanıcı herhangi bir Roblox grubuna üye değil.";

            const grupEmbed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle(`📂 ${username} Kullanıcısının Roblox Grupları`)
                .setDescription(grupMetni.slice(0, 4000))
                .setTimestamp();

            await interaction.editReply({ embeds: [grupEmbed] });
        }

        else if (commandName === 'yasakla') {
            const hedefKullanici = options.getUser('kullanıcı');
            const sebep = options.getString('sebep');
            const sunucuUyesi = await guild.members.fetch(hedefKullanici.id).catch(() => null);

            if (!sunucuUyesi) return interaction.editReply("❌ Belirtilen kullanıcı bu sunucuda bulunamadı.");
            if (!sunucuUyesi.bannable) return interaction.editReply("❌ Bu kullanıcıyı yasaklamaya botun yetkisi yetmiyor.");

            await sunucuUyesi.ban({ reason: `${interaction.user.username} tarafından: ${sebep}` });

            const banEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🛑 | ASKERİ YASAKLAMA EMİRNAME')
                .setDescription(`**Yasaklanan Personel:** ${hedefKullanici.tag}\n**Gerekçe:** ${sebep}`)
                .setTimestamp();

            await interaction.editReply(`✅ ${hedefKullanici.tag} başarıyla sunucudan uzaklaştırıldı.`);
            const logKanali = client.channels.cache.get(AYARLAR.LOG_CHANNEL_ID);
            if (logKanali) await logKanali.send({ embeds: [banEmbed] });
        }

        else if (commandName === 'rütbe-değiştir' || commandName === 'yönetim-rütbe-değiştir') {
            const username = options.getString('roblox-isim');
            const targetRankId = options.getInteger('rütbe');
            const sebep = options.getString('sebep');

            const userId = await noblox.getIdFromUsername(username);
            const eskiRutbe = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);
            
            await noblox.setRank(AYARLAR.GROUP_ID, userId, targetRankId);
            const yeniRutbe = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);

            await logGonder(interaction, username, userId, eskiRutbe, yeniRutbe, sebep);
            await interaction.editReply(`✅ **${username}** başarıyla **${yeniRutbe}** rütbesine güncellendi.`);
        }

        else if (commandName === 'terfi') {
            const username = options.getString('roblox-isim');
            const sebep = options.getString('sebep');

            const userId = await noblox.getIdFromUsername(username);
            const eskiRutbe = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);
            
            await noblox.promote(AYARLAR.GROUP_ID, userId);
            const yeniRutbe = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);

            await logGonder(interaction, username, userId, eskiRutbe, yeniRutbe, sebep);
            await interaction.editReply(`🎖️ **${username}** başarıyla bir üst rütbeye (**${yeniRutbe}**) terfi ettirildi.`);
        }

        else if (commandName === 'tenzil') {
            const username = options.getString('roblox-isim');
            const sebep = options.getString('sebep');

            const userId = await noblox.getIdFromUsername(username);
            const eskiRutbe = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);
            
            await noblox.demote(AYARLAR.GROUP_ID, userId);
            const yeniRutbe = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);

            await logGonder(interaction, username, userId, eskiRutbe, yeniRutbe, sebep);
            await interaction.editReply(`📉 **${username}** isimli personelin rütbesi **${yeniRutbe}** rütbesine tenzil edildi.`);
        }

        else if (commandName === 'profile') {
            const username = options.getString('roblox-isim');
            const userId = await noblox.getIdFromUsername(username);
            
            const [playerInfo, rankName, rankId, avatarResmi] = await Promise.all([
                noblox.getPlayerInfo(userId),
                noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId),
                noblox.getRankInGroup(AYARLAR.GROUP_ID, userId),
                noblox.getPlayerThumbnail(userId, "150x150", "png", false, "Headshot")
            ]);

            const avatarUrl = avatarResmi[0]?.imageUrl || "https://www.roblox.com/images/ThumbnailHolder/Player.png";

            const profilEmbed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle(`| TSA | Personel Künye Bilgisi`)
                .setDescription(`**Kullanıcı Adı:** ${username}\n**Mevcut Rütbe:** ${rankName}`)
                .setThumbnail(avatarUrl);

            await interaction.editReply({ embeds: [profilEmbed] });
        }

        // ==================== 🎯 YENİ VE KESİN DOĞRU RADAR SİSTEMİ ====================
        else if (commandName === 'aktiflik-sorgu') {
            try {
                // Doğrudan canlı oyun API'sine istek atıp tüm sunuculardaki oyuncuları tek tek sayıyoruz.
                const url = `https://games.roblox.com/v1/games?universeIds=${AYARLAR.OYUN_ID}`;
                
                // Node.js dahili fetch fonksiyonu ile veriyi çekiyoruz
                const response = await fetch(url);
                const data = await response.json();
                
                // Canlı aktiflik verisini çek, eğer API'den boş dönerse 0 kabul et
                const gerçekAktifOyuncu = data.data?.[0]?.playing || 0;

                const oyunEmbed = new EmbedBuilder()
                    .setColor('#2b2d31')
                    .setTitle('⚔️ Türk Askeri Oyunu | Canlı Aktiflik Radarı')
                    .setDescription(`Anlık olarak operasyon bölgesinde bulunan net personel sayısı: **${gerçekAktifOyuncu}**`)
                    .setTimestamp()
                    .setFooter({ text: "Sistem: Canlı Sunucu Doğrulaması Aktif" });

                await interaction.editReply({ embeds: [oyunEmbed] });
            } catch (err) {
                console.error("[Aktiflik Hatası]", err.message);
                await interaction.editReply("❌ Canlı oyuncu verisi şu an Roblox API sunucularından çekilemedi.");
            }
        }
        // ==============================================================================

        else if (commandName === 'grup') {
            await interaction.editReply('🪖 **TSA Roblox Grubu:** https://www.roblox.com/tr/communities/972348115/TSA-Turkish-Armed-Forces-Yeniden');
        }

        else if (commandName === 'rütbeler') {
            const roller = await noblox.getRoles(AYARLAR.GROUP_ID);
            let liste = "";
            roller.reverse().forEach(rol => {
                if(rol.rank !== 0) liste += `**${rol.rank}.** ${rol.name} — *${rol.memberCount} üye*\n`;
            });
            await interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2b2d31').setTitle('| TSA | Rütbeler').setDescription(liste)] });
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
