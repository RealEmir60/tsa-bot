const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const fetch = require('node-fetch');
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, ApplicationCommandOptionType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ActivityType, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const noblox = require('noblox.js');
const http = require('http');

const AYARLAR = {
    DISCORD_TOKEN: process.env.DISCORD_TOKEN,
    ROBLOX_COOKIE: process.env.ROBLOX_COOKIE,
    GROUP_ID: parseInt(process.env.GROUP_ID) || 972348115,
    LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID || "1519328796275380325",
    YETKILI_ROL_ID: process.env.YETKILI_ROL_ID || "1518357646971764859",
    BRANS_YETKILI_ROL_ID: "1518357724880961656",
    OYUN_ID: process.env.OYUN_ID || "138257110169831",
    PORT: process.env.PORT || 3000
};

// Render için basit bir HTTP sunucusu (Botun kapanmasını engeller)
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot Aktif!');
}).listen(AYARLAR.PORT);

const BRANSLAR = {
    "Özel Kuvvetler Komutanlığı": 901158188,
    "Askeri İnzibat": 751296173,
    "Deniz Kuvvetleri Komutanlığı": 594898013,
    "Hava Kuvvetleri Komutanlığı": 850943288,
    "Jandarma Genel Komutanlığı": 523316183,
    "Kara Kuvvetleri Komutanlığı": 683890016,
    "Milli İstihbarat Teşkilatı": 460437686,
    "Sürücü Okulu": 315627660
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
    { name: 'ping', description: 'Botun gecikme süresini gösterir.' },
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
    { name: 'yoklama', description: 'Bulunduğun ses kanalındaki personelin rütbelerini listeler.' },
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
    },
    {
        name: 'branş-istek',
        description: 'Branş başvurusu yapar.',
        options: [
            { name: 'roblox-isim', description: 'Roblox kullanıcı adın', type: ApplicationCommandOptionType.String, required: true },
            { name: 'branş', description: 'Başvurmak istediğin branş', type: ApplicationCommandOptionType.String, required: true, choices: Object.keys(BRANSLAR).map(b => ({ name: b, value: b })) },
            { name: 'sebep', description: 'Neden bu branşa geçmek istiyorsun?', type: ApplicationCommandOptionType.String, required: true }
        ]
    },
    {
        name: 'branş-at',
        description: 'Personeli direkt branşa atar.',
        options: [
            { name: 'roblox-isim', description: 'Roblox kullanıcı adı', type: ApplicationCommandOptionType.String, required: true },
            { name: 'branş', description: 'Atanacak branş', type: ApplicationCommandOptionType.String, required: true, choices: Object.keys(BRANSLAR).map(b => ({ name: b, value: b })) },
            { name: 'rütbe', description: 'Verilecek rütbe', type: ApplicationCommandOptionType.Integer, required: true, autocomplete: true },
            { name: 'sebep', description: 'Atama sebebi', type: ApplicationCommandOptionType.String, required: true }
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
        if (logKanali) await logKanali.send({ embeds: [logEmbed], components: [butonRow] }).catch(() => {});

        return { embeds: [logEmbed], components: [butonRow] };
    } catch (e) {
        console.error("[Log Hatası]", e.message);
        return { content: '❌ Log gönderilemedi ama işlem başarılı.' };
    }
}

client.once('ready', async () => {
    console.log(`[Discord] Bot aktif: ${client.user.tag}`);
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
    // Unknown Interaction hatasını önlemek için try-catch
    try {
        if (interaction.isAutocomplete()) {
            if (interaction.commandName === 'rütbe-değiştir' || interaction.commandName === 'toplu-rütbe' || interaction.commandName === 'branş-at') {
                const focusedValue = interaction.options.getFocused().toLowerCase().trim();
                let secenekler;
                if (!focusedValue) {
                    secenekler = ILK_25_RUTBE;
                } else {
                    secenekler = TUM_RUTBELER.filter(r => {
                        const nameLower = r.name.toLowerCase();
                        if (nameLower.startsWith(focusedValue)) return true;
                        if (nameLower.includes(focusedValue)) return true;
                        const parts = nameLower.split(' ');
                        return parts.some(p => p.startsWith(focusedValue));
                    }).slice(0, 25);
                }
                await interaction.respond(secenekler).catch(() => {});
            }
            return;
        }

        if (interaction.isButton()) {
            if (interaction.customId.startsWith('brans_kabul_')) {
                if (!interaction.member.roles.cache.has(AYARLAR.BRANS_YETKILI_ROL_ID) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: '❌ Branş onayı için yetkin yok.', ephemeral: true }).catch(() => {});
                }

                const [,, robloxIsim, brans, userId] = interaction.customId.split('_');
                const modal = new ModalBuilder()
                    .setCustomId(`brans_rutbe_modal_${robloxIsim}_${brans}_${userId}`)
                    .setTitle(`${brans} Rütbe Seç`);

                const rutbeInput = new TextInputBuilder()
                    .setCustomId('rutbe_id')
                    .setLabel('Rütbe ID girin (1-255)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Örn: 1 = Acemi Er')
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(rutbeInput));
                await interaction.showModal(modal).catch(() => {});
            }
            else if (interaction.customId.startsWith('brans_red_')) {
                if (!interaction.member.roles.cache.has(AYARLAR.BRANS_YETKILI_ROL_ID) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: '❌ Branş reddi için yetkin yok.', ephemeral: true }).catch(() => {});
                }
                const [,, robloxIsim] = interaction.customId.split('_');
                await interaction.update({
                    content: `❌ **${robloxIsim}** kullanıcısının branş başvurusu reddedildi.`,
                    embeds: [],
                    components: []
                }).catch(() => {});
            }
            return;
        }

        if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('brans_rutbe_modal_')) {
                await interaction.deferReply({ ephemeral: true }).catch(() => {});
                const [,,, robloxIsim, brans, userId] = interaction.customId.split('_');
                const rutbeId = parseInt(interaction.fields.getTextInputValue('rutbe_id'));
                const bransGroupId = BRANSLAR[brans];

                try {
                    const rbxUserId = parseInt(userId);
                    for (const [bransAdi, groupId] of Object.entries(BRANSLAR)) {
                        try {
                            const rank = await noblox.getRankInGroup(groupId, rbxUserId);
                            if (rank > 0) await noblox.setRank(groupId, rbxUserId, 0);
                        } catch (e) {}
                    }
                    await new Promise(r => setTimeout(r, 1000));
                    await noblox.setRank(bransGroupId, rbxUserId, rutbeId);
                    const yeniRutbe = await noblox.getRankNameInGroup(bransGroupId, rbxUserId);

                    await interaction.editReply(`✅ **${robloxIsim}** → **${brans}** → **${yeniRutbe}** atandı.`).catch(() => {});
                    const logKanali = client.channels.cache.get(AYARLAR.LOG_CHANNEL_ID);
                    if (logKanali) {
                        const embed = new EmbedBuilder()
                            .setColor('#00ff00')
                            .setTitle('✅ Branş Ataması Yapıldı')
                            .addFields(
                                { name: 'Personel', value: robloxIsim, inline: true },
                                { name: 'Branş', value: brans, inline: true },
                                { name: 'Rütbe', value: yeniRutbe, inline: true },
                                { name: 'Onaylayan', value: interaction.user.username, inline: true }
                            )
                            .setTimestamp();
                        await logKanali.send({ embeds: [embed] }).catch(() => {});
                    }
                    await interaction.message.edit({
                        content: `✅ **${robloxIsim}** başvurusu onaylandı → **${brans}** → **${yeniRutbe}**`,
                        embeds: [],
                        components: []
                    }).catch(() => {});
                } catch (err) {
                    await interaction.editReply(`❌ Hata: ${err.message}`).catch(() => {});
                }
            }
            return;
        }

        if (!interaction.isChatInputCommand()) return;
        const { commandName, options, member, guild } = interaction;

        const yetkiliKomutlari = ['rütbe-değiştir', 'terfi', 'tenzil', 'duyuru', 'eğitim-başlat', 'grup-listele', 'yasakla', 'ses-katıl', 'ses-ayrıl', 'toplu-rütbe', 'temizle', 'davet', 'izin', 'yoklama', 'duyuru-sabitle', 'ceza', 'nöbet', 'aktiflik-duyuru'];
        const bransYetkiliKomutlari = ['branş-at'];

        if (yetkiliKomutlari.includes(commandName)) {
            if (!member.roles.cache.has(AYARLAR.YETKILI_ROL_ID) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Bu askeri komutu kullanmak için yetkili karargah rolüne sahip olmalısınız.', ephemeral: true }).catch(() => {});
            }
        }
        if (bransYetkiliKomutlari.includes(commandName)) {
            if (!member.roles.cache.has(AYARLAR.BRANS_YETKILI_ROL_ID) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Branş işlemleri için Branş Yetkilisi rolüne sahip olmalısın.', ephemeral: true }).catch(() => {});
            }
        }

        await interaction.deferReply().catch(() => {});

        if (commandName === 'ping') {
            await interaction.editReply(`🏓 Pong! Bot gecikmesi: **${client.ws.ping}ms**`).catch(() => {});
        }
        else if (commandName === 'branş-istek') {
            const robloxIsim = options.getString('roblox-isim');
            const brans = options.getString('branş');
            const sebep = options.getString('sebep');
            const userId = await noblox.getIdFromUsername(robloxIsim);
            const embed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('📋 Yeni Branş Başvurusu')
                .addFields(
                    { name: 'Başvuran', value: `${interaction.user.username} (${robloxIsim})`, inline: false },
                    { name: 'Talep Edilen Branş', value: brans, inline: false },
                    { name: 'Sebep', value: sebep, inline: false }
                )
                .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png`)
                .setTimestamp();
            const butonlar = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`brans_kabul_${robloxIsim}_${brans}_${userId}`).setLabel('Kabul Et').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`brans_red_${robloxIsim}`).setLabel('Reddet').setStyle(ButtonStyle.Danger)
            );
            const logKanali = client.channels.cache.get(AYARLAR.LOG_CHANNEL_ID);
            if (logKanali) await logKanali.send({ embeds: [embed], components: [butonlar] }).catch(() => {});
            await interaction.editReply(`✅ **${brans}** branşına başvurun alındı. Yetkililer inceleyecek.`).catch(() => {});
        }
        else if (commandName === 'branş-at') {
            const robloxIsim = options.getString('roblox-isim');
            const brans = options.getString('branş');
            const rutbeId = options.getInteger('rütbe');
            const sebep = options.getString('sebep');
            const bransGroupId = BRANSLAR[brans];
            const userId = await noblox.getIdFromUsername(robloxIsim);
            for (const [bransAdi, groupId] of Object.entries(BRANSLAR)) {
                try {
                    const rank = await noblox.getRankInGroup(groupId, userId);
                    if (rank > 0) await noblox.setRank(groupId, userId, 0);
                } catch (e) {}
            }
            await new Promise(r => setTimeout(r, 1000));
            await noblox.setRank(bransGroupId, userId, rutbeId);
            const yeniRutbe = await noblox.getRankNameInGroup(bransGroupId, userId);
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Branş Ataması Yapıldı')
                .addFields(
                    { name: 'Personel', value: robloxIsim, inline: true },
                    { name: 'Branş', value: brans, inline: true },
                    { name: 'Rütbe', value: yeniRutbe, inline: true },
                    { name: 'Atayan', value: interaction.user.username, inline: true },
                    { name: 'Sebep', value: sebep, inline: false }
                )
                .setTimestamp();
            const logKanali = client.channels.cache.get(AYARLAR.LOG_CHANNEL_ID);
            if (logKanali) await logKanali.send({ embeds: [embed] }).catch(() => {});
            await interaction.editReply({ embeds: [embed] }).catch(() => {});
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
            await interaction.editReply(sonuc).catch(() => {});
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
            await interaction.editReply(sonuc).catch(() => {});
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
            await interaction.editReply(sonuc).catch(() => {});
        }
        else if (commandName === 'aktiflik-sorgu') {
            try {
                let inputId = AYARLAR.OYUN_ID.toString().trim();
                const universeRes = await fetch(`https://games.roblox.com/v1/games/multiget-place-details?placeIds=${inputId}`);
                const universeData = await universeRes.json();
                if (!universeData || universeData.length === 0) return interaction.editReply("❌ Oyun bulunamadı.").catch(() => {});
                const universeId = universeData[0].universeId;
                const response = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
                const data = await response.json();
                if (data && data.data && data.data.length > 0) {
                    const gercekAktifOyuncu = data.data[0].playing || 0;
                    const oyunEmbed = new EmbedBuilder()
                        .setColor('#2b2d31')
                        .setTitle('⚔ Türk Askeri Oyunu | Canlı Aktiflik Radarı')
                        .setDescription(`Anlık olarak operasyon bölgesinde bulunan net personel sayısı: **${gercekAktifOyuncu}**`)
                        .setTimestamp();
                    await interaction.editReply({ embeds: [oyunEmbed] }).catch(() => {});
                } else {
                    await interaction.editReply("❌ Oyun verileri çekilemedi.").catch(() => {});
                }
            } catch (err) {
                await interaction.editReply(`❌ Hata: ${err.message}`).catch(() => {});
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
            await interaction.editReply({ embeds: [profilEmbed], components: [profilButon] }).catch(() => {});
        }
        else if (commandName === 'yasakla') {
            const hedefKullanici = options.getUser('kullanıcı');
            const sebep = options.getString('sebep');
            const sunucuUyesi = await guild.members.fetch(hedefKullanici.id).catch(() => null);
            if (!sunucuUyesi || !sunucuUyesi.bannable) return interaction.editReply("❌ Bu kullanıcı yasaklanamaz.").catch(() => {});
            await sunucuUyesi.ban({ reason: sebep });
            const banEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('⛔ Kullanıcı Yasaklandı')
                .addFields({ name: 'Yasaklanan', value: hedefKullanici.tag, inline: true }, { name: 'Sebep', value: sebep, inline: false })
                .setTimestamp();
            await interaction.editReply({ embeds: [banEmbed] }).catch(() => {});
        }
        else if (commandName === 'temizle') {
            const adet = options.getInteger('adet');
            await interaction.channel.bulkDelete(Math.min(adet, 100), true);
            await interaction.editReply(`✅ Başarıyla ${adet} adet mesaj silindi.`).catch(() => {});
        }
        else if (commandName === 'duyuru') {
            const kanal = options.getChannel('kanal');
            const icerik = options.getString('içerik');
            const duyuruEmbed = new EmbedBuilder().setColor('#00ff00').setTitle('📢 Yeni Duyuru').setDescription(icerik).setTimestamp();
            await kanal.send({ embeds: [duyuruEmbed] }).catch(() => {});
            await interaction.editReply('✅ Duyuru başarıyla gönderildi.').catch(() => {});
        }
        // Diğer basit komutlar benzer şekilde eklenebilir...

    } catch (error) {
        console.error("[Genel Hata]", error);
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: `❌ Hata: ${error.message}`, ephemeral: true });
            } else {
                await interaction.editReply(`❌ Hata: ${error.message}`);
            }
        } catch (e) {}
    }
});

client.login(AYARLAR.DISCORD_TOKEN);

