const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, REST, Routes, ApplicationCommandOptionType } = require('discord.js');
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

// Canlı rütbeler yüklenene kadar yedek olarak duracak acil durum listesi
let GRUP_RUTBELERI = [
    { name: 'Yükleniyor... Lütfen az sonra tekrar deneyin.', value: 0 }
];

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const commands = [
    {
        name: 'rütbe-değiştir',
        description: 'Belirtilen Roblox kullanıcısının rütbesini değiştirir.',
        options: [
            { name: 'roblox-isim', description: 'Roblox kullanıcı adı', type: ApplicationCommandOptionType.String, required: true },
            { 
                name: 'rütbe', 
                description: 'Değiştirilmek istenen yeni rütbe', 
                type: ApplicationCommandOptionType.Integer, 
                required: true,
                autocomplete: true 
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
        name: 'aktiflik-sorgu',
        description: 'Türk Askeri Oyunu içerisindeki aktif oyuncu sayısını gösterir.'
    },
    {
        name: 'grup',
        description: 'TSA Roblox grup linkini gönderir.'
    },
    {
        name: 'rütbeler',
        description: 'TSA grubundaki tüm rütbeleri ve üye sayılarını listeler.'
    },
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
    {
        name: 'karargah-durum',
        description: 'TSA grubunun genel ve lojistik durum özetini gösterir.'
    }
];

async function robloxGiris() {
    try {
        if (!AYARLAR.ROBLOX_COOKIE) return console.error("[Roblox] Hata: ROBLOX_COOKIE tanımlanmamış!");
        await noblox.setCookie(AYARLAR.ROBLOX_COOKIE);
        const botKullanici = await noblox.getAuthenticatedUser();
        console.log(`[Roblox] Başarılı: ${botKullanici.UserName} olarak giriş yapıldı.`);
        
        // Rütbeleri çekip GRUP_RUTBELERI listesini tamamiyle güncelliyoruz
        const roller = await noblox.getRoles(AYARLAR.GROUP_ID);
        const geciciListe = roller.filter(r => r.rank !== 0).map(r => ({
            name: `${r.name} (ID: ${r.rank})`,
            value: r.rank
        })).reverse();

        if (geciciListe.length > 0) {
            GRUP_RUTBELERI = geciciListe;
            console.log(`[Roblox] ${GRUP_RUTBELERI.length} adet grup rütbesi başarıyla hafızaya alındı.`);
        }
    } catch (err) {
        console.error("[Roblox] Giriş veya rütbe yükleme başarısız:", err.message);
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
            .setURL(`https://www.roblox.com/users/${robloxUserId}/profile`)
            .setDescription(
                `**İşlem Başarılı Rütbe Değiştirildi**\n\n` +
                `**Kullanıcı:** ${robloxUsername}\n` +
                `**İşlem Yapan:** ${interaction.user.username}\n` +
                `**Eski Rütbe:** ${eskiRutbe}\n` +
                `**Yeni Rütbe:** ${yeniRutbe}\n` +
                `**Sebep:** ${sebep}`
            )
            .setThumbnail(avatarUrl);

        const buton = new ButtonBuilder()
            .setLabel('Kullanıcı Bilgi')
            .setURL(`https://www.roblox.com/users/${robloxUserId}/profile`)
            .setStyle(ButtonStyle.Link);

        const row = new ActionRowBuilder().addComponents(buton);
        await logKanali.send({ embeds: [logEmbed], components: [row] });
    } catch (e) {
        console.error("[Log Hatası]", e.message);
    }
}

client.once('ready', async () => {
    console.log(`[Discord] Bot aktif: ${client.user.tag}`);
    await robloxGiris();

    if (!AYARLAR.DISCORD_TOKEN) return;
    const rest = new REST({ version: '10' }).setToken(AYARLAR.DISCORD_TOKEN);
    try {
        console.log('[Discord] Slash komutları yükleniyor...');
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('[Discord] Slash komutları dinamik olarak kaydedildi!');
    } catch (error) {
        console.error("[Discord Komut Hatası]", error);
    }
});

// CANLI OTO-TAMAMLAMA YÖNETİCİSİ
client.on('interactionCreate', async (interaction) => {
    if (interaction.isAutocomplete()) {
        if (interaction.commandName === 'rütbe-değiştir') {
            try {
                const focusedValue = interaction.options.focused().toLowerCase();
                
                // Hafızadaki rütbeleri filtrelenmiş olarak getir
                let filtrelenmis = GRUP_RUTBELERI.filter(choice => 
                    choice.name.toLowerCase().includes(focusedValue)
                );
                
                // Discord 25'ten fazla seçenekte hata verir, üst sınırı koruyoruz
                await interaction.respond(filtrelenmis.slice(0, 25));
            } catch (err) {
                console.error("[Autocomplete Hatası] Seçenekler zamanında iletilemedi:", err.message);
            }
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, member } = interaction;
    
    const yetkiliKomutlari = ['rütbe-değiştir', 'terfi', 'tenzil', 'duyuru', 'eğitim-başlat'];
    if (yetkiliKomutlari.includes(commandName)) {
        if (!member.roles.cache.has(AYARLAR.YETKILI_ROL_ID)) {
            return interaction.reply({ content: '❌ Bu askeri komutu kullanmak için yetkili karargah rolüne sahip değilsiniz.', ephemeral: true });
        }
    }

    await interaction.deferReply();

    try {
        if (commandName === 'rütbe-değiştir') {
            const username = options.getString('roblox-isim');
            const targetRankId = options.getInteger('rütbe');
            const sebep = options.getString('sebep');

            if (targetRankId === 0) {
                return interaction.editReply("❌ Geçersiz rütbe seçimi! Lütfen listeden geçerli bir rütbe seçin.");
            }

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
                .setDescription(
                    `**Kullanıcı Adı:** ${username}\n` +
                    `**Roblox ID:** ${userId}\n` +
                    `**Mevcut Rütbe:** ${rankName} (ID: ${rankId})\n\n` +
                    `**Hesap Yaşı:** ${playerInfo.age} Gün\n` +
                    `**Gruba Katılım:** ${playerInfo.joinDate ? new Date(playerInfo.joinDate).toLocaleDateString('tr-TR') : 'Bilinmiyor'}`
                )
                .setThumbnail(avatarUrl);

            const buton = new ButtonBuilder()
                .setLabel('Roblox Profilini Aç')
                .setURL(`https://www.roblox.com/users/${userId}/profile`)
                .setStyle(ButtonStyle.Link);

            const row = new ActionRowBuilder().addComponents(buton);
            await interaction.editReply({ embeds: [profilEmbed], components: [row] });
        }

        else if (commandName === 'aktiflik-sorgu') {
            const oyunDetay = await noblox.getUniverseInfo([AYARLAR.OYUN_ID]);
            const aktifOyuncu = oyunDetay[0]?.playing || 0;

            const oyunEmbed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle('⚔️ Türk Askeri Oyunu | Aktiflik Durumu')
                .setDescription(`Anlık olarak operasyon bölgesinde bulunan personel sayısı: **${aktifOyuncu}**`)
                .setURL('https://www.roblox.com/tr/games/138257110169831/T-rk-Asker-Oyunu');

            await interaction.editReply({ embeds: [oyunEmbed] });
        }

        else if (commandName === 'grup') {
            const grupEmbed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle('🪖 TSA | Turkish Armed Forces')
                .setDescription('Türk Silahlı Kuvvetleri bünyesine katılmak ve resmi rütbe işlemlerinizi takip etmek için grubumuza katılın.')
                .setURL('https://www.roblox.com/tr/communities/972348115/TSA-Turkish-Armed-Forces-Yeniden#!/about');

            await interaction.editReply({ embeds: [grupEmbed] });
        }

        else if (commandName === 'rütbeler') {
            const roller = await noblox.getRoles(AYARLAR.GROUP_ID);
            let liste = "";
            roller.reverse().forEach(rol => {
                if(rol.rank !== 0) { 
                    liste += `**${rol.rank}.** ${rol.name} — *${rol.memberCount} üye*\n`;
                }
            });

            const rutbeEmbed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle('| TSA | Grup Rütbeleri')
                .setDescription(liste);

            await interaction.editReply({ embeds: [rutbeEmbed] });
        }

        else if (commandName === 'duyuru') {
            const hedefKanal = options.getChannel('kanal');
            const icerik = options.getString('içerik');

            const duyuruEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('📢 | TSA KARARGAH DUYURUSU')
                .setDescription(icerik)
                .setTimestamp()
                .setFooter({ text: `Duyuruyu Yapan: ${interaction.user.username}` });

            await hedefKanal.send({ embeds: [duyuruEmbed] });
            await interaction.editReply(`✅ Duyuru başarıyla ${hedefKanal} kanalına iletildi.`);
        }

        else if (commandName === 'eğitim-başlat') {
            const tur = options.getString('tür');
            const saat = options.getString('saat');

            const egitemEmbed = new EmbedBuilder()
                .setColor('#e67e22')
                .setTitle('⚔️ | TSA EĞİTİM VE DOKTRİN KOMUTANLIĞI')
                .setDescription(
                    `**Eğitim Türü:** ${tur}\n` +
                    `**Başlangıç Saati:** ${saat}\n\n` +
                    `Tüm personelin belirtilen saatte hazır kıta olması önemle rica olunur.`
                )
                .setTimestamp()
                .setFooter({ text: `Eğitimi Yöneten: ${interaction.user.username}` });

            await interaction.editReply({ embeds: [egitemEmbed] });
        }

        else if (commandName === 'karargah-durum') {
            const grupDetay = await noblox.getGroup(AYARLAR.GROUP_ID);
            
            const durumEmbed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle('| TSA | Karargah Lojistik Raporu')
                .setDescription(
                    `📊 **Toplam Alay Personeli:** ${grupDetay.memberCount} Asker\n` +
                    `🛡️ **Grup Durumu:** Aktif ve Göreve Hazır\n` +
                    `🔗 **Resmi Bağlantı:** [Roblox TSA Grubu](https://www.roblox.com/tr/communities/972348115/TSA-Turkish-Armed-Forces-Yeniden#!/about)`
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [durumEmbed] });
        }

    } catch (error) {
        console.error("[Komut Hatası]", error);
        if (interaction.deferred) {
            await interaction.editReply(`❌ Karargah sistem hatası: ${error.message}`);
        }
    }
});

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('TSA Karargah Sistemi Canli ve Aktif!\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[Render] Port dinleniyor: ${PORT}`);
});

if (AYARLAR.DISCORD_TOKEN) {
    client.login(AYARLAR.DISCORD_TOKEN).catch(err => {
        console.error("[Discord] Giriş başarısız:", err.message);
    });
}
