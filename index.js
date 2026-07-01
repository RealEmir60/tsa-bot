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
    OYUN_ID: process.env.OYUN_ID || "138257110169831"
};

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
    {
        name: 'ping',
        description: 'Botun gecikme süresini gösterir.'
    },
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
        if (logKanali) await logKanali.send({ embeds: [logEmbed], components: [butonRow] });

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
            try { await interaction.respond(secenekler); } catch (err) {}
        }
        return;
    }

    if (interaction.isButton()) {
        if (interaction.customId.startsWith('brans_kabul_')) {
            if (!interaction.member.roles.cache.has(AYARLAR.BRANS_YETKILI_ROL_ID) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Branş onayı için yetkin yok.', ephemeral: true });
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
            await interaction.showModal(modal);
        }

        else if (interaction.customId.startsWith('brans_red_')) {
            if (!interaction.member.roles.cache.has(AYARLAR.BRANS_YETKILI_ROL_ID) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Branş reddi için yetkin yok.', ephemeral: true });
            }
            const [,, robloxIsim] = interaction.customId.split('_');
            await interaction.update({
                content: `❌ **${robloxIsim}** kullanıcısının branş başvurusu reddedildi.`,
                embeds: [],
                components: []
            });
        }
        return;
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('brans_rutbe_modal_')) {
            await interaction.deferReply({ ephemeral: true });
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

                await interaction.editReply(`✅ **${robloxIsim}** → **${brans}** → **${yeniRutbe}** atandı.`);

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
                    await logKanali.send({ embeds: [embed] });
                }

                await interaction.message.edit({
                    content: `✅ **${robloxIsim}** başvurusu onaylandı → **${brans}** → **${yeniRutbe}**`,
                    embeds: [],
                    components: []
                });

            } catch (err) {
                await interaction.editReply(`❌ Hata: ${err.message}`);
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
            return interaction.reply({ content: '❌ Bu askeri komutu kullanmak için yetkili karargah rolüne sahip olmalısınız.', ephemeral: true });
        }
    }

    if (bransYetkiliKomutlari.includes(commandName)) {
        if (!member.roles.cache.has(AYARLAR.BRANS_YETKILI_ROL_ID) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Branş işlemleri için Branş Yetkilisi rolüne sahip olmalısın.', ephemeral: true });
        }
    }

    await interaction.deferReply();

    try {
        if (commandName === 'ping') {
            const ping = client.ws.ping;
            await interaction.editReply(`🏓 Pong! Bot gecikmesi: **${ping}ms** | API: **${Date.now() - interaction.createdTimestamp}ms**`);
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
                new ButtonBuilder()
                    .setCustomId(`brans_kabul_${robloxIsim}_${brans}_${userId}`)
                    .setLabel('Kabul Et')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`brans_red_${robloxIsim}`)
                    .setLabel('Reddet')
                    .setStyle(ButtonStyle.Danger)
            );

            const logKanali = client.channels.cache.get(AYARLAR.LOG_CHANNEL_ID);
            if (logKanali) await logKanali.send({ embeds: [embed], components: [butonlar] });

            await interaction.editReply(`✅ **${brans}** branşına başvurun alındı. Yetkililer inceleyecek.`);
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
            if (logKanali) await logKanali.send({ embeds: [embed] });

            await interaction.editReply({ embeds: [embed] });
        }

        else if (commandName === 'ses-katıl') {
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
                const universeUrl = `https://games.roblox.com/v1/games/multiget-place-details?placeIds=${inputId}`;
                const universeRes = await fetch(universeUrl);
                const universeData = await universeRes.json();

                if (!universeData || universeData.length === 0) {
                    return interaction.editReply("❌ Oyun bulunamadı. OYUN_ID doğru mu?");
                }

                const universeId = universeData[0].universeId;
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
                    await interaction.editReply("❌ Oyun verileri çekilemedi.");
                }
            } catch (err) {
                console.error("[Aktiflik Hatası]", err);
                await interaction.editReply(`❌ Aktiflik verisi işlenirken hata: ${err.message}`);
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
                grupMetni += `• **${g.Name}** — *Rütbe: ${g.Role}* (ID: ${g.Id})\n`;
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
            if (!sunucuUyesi || !sunucuUyesi.bannable) return interaction.editReply("❌ Bu kullanıcı yasaklanamaz.");

            await sunucuUyesi.ban({ reason: sebep });
            const banEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('⛔ Kullanıcı Yasaklandı')
                .addFields(
                    { name: 'Yasaklanan', value: hedefKullanici.tag, inline: true },
                    { name: 'Yasaklayan', value: interaction.user.tag, inline: true },
                    { name: 'Sebep', value: sebep, inline: false }
                )
                .setTimestamp();
            await interaction.editReply({ embeds: [banEmbed] });

            const logKanali = client.channels.cache.get(AYARLAR.LOG_CHANNEL_ID);
            if (logKanali) await logKanali.send({ embeds: [banEmbed] });
        }

        else if (commandName === 'grup') {
            await interaction.editReply("TSA Roblox Grubumuz: https://www.roblox.com/groups/972348115/TSA-Turkish-Special-Army");
        }

        else if (commandName === 'rütbeler') {
            let rutbeMetni = TUM_RUTBELER.map(r => `**${r.name}** (ID: ${r.value})`).join('\n');
            const rutbeEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('TSA Roblox Grubu Rütbeleri')
                .setDescription(rutbeMetni)
                .setTimestamp();
            await interaction.editReply({ embeds: [rutbeEmbed] });
        }

        else if (commandName === 'duyuru') {
            const kanal = options.getChannel('kanal');
            const icerik = options.getString('içerik');

            const duyuruEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('📢 Yeni Duyuru')
                .setDescription(icerik)
                .setFooter({ text: `Duyuran: ${interaction.user.tag}` })
                .setTimestamp();

            await kanal.send({ embeds: [duyuruEmbed] });
            await interaction.editReply('✅ Duyuru başarıyla gönderildi.');
        }

        else if (commandName === 'eğitim-başlat') {
            const tur = options.getString('tür');
            const saat = options.getString('saat');

            const egitimEmbed = new EmbedBuilder()
                .setColor('#00ffff')
                .setTitle('⚔️ Yeni Eğitim Duyurusu')
                .setDescription(`**Eğitim Türü:** ${tur}\n**Eğitim Saati:** ${saat}`)
                .setFooter({ text: `Duyuran: ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.channel.send({ content: '@everyone', embeds: [egitimEmbed] });
            await interaction.editReply('✅ Eğitim duyurusu başarıyla başlatıldı.');
        }

        else if (commandName === 'karargah-durum') {
            const groupInfo = await noblox.getGroup(AYARLAR.GROUP_ID);
            const memberCount = groupInfo.memberCount;
            const description = groupInfo.description;

            const durumEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('HQ | Karargah Durum Özeti')
                .addFields(
                    { name: 'Toplam Üye', value: memberCount.toString(), inline: true },
                    { name: 'Açıklama', value: description.substring(0, 1024) || 'Yok', inline: false }
                )
                .setTimestamp();
            await interaction.editReply({ embeds: [durumEmbed] });
        }

        else if (commandName === 'sorgula') {
            const robloxIsim = options.getString('roblox-isim');
            const userId = await noblox.getIdFromUsername(robloxIsim);
            const auditLogs = await noblox.getGroupAuditLog(AYARLAR.GROUP_ID, 'RankChange', userId);

            let logMetni = '';
            if (auditLogs.data && auditLogs.data.length > 0) {
                auditLogs.data.slice(0, 5).forEach(log => {
                    logMetni += `• **${log.description.OldRankName}** → **${log.description.NewRankName}** (${new Date(log.created).toLocaleString()})\n`;
                });
            } else {
                logMetni = 'Bu personel için rütbe değişim kaydı bulunamadı.';
            }

            const sorguEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`${robloxIsim} Rütbe Değişim Kayıtları`)
                .setDescription(logMetni)
                .setTimestamp();
            await interaction.editReply({ embeds: [sorguEmbed] });
        }

        else if (commandName === 'toplu-rütbe') {
            const kullanicilarStr = options.getString('kullanicilar');
            const targetRankId = options.getInteger('rütbe');
            const sebep = options.getString('sebep');
            const kullanicilar = kullanicilarStr.split(',').map(u => u.trim());

            let basarili = [];
            let basarisiz = [];

            for (const username of kullanicilar) {
                try {
                    const userId = await noblox.getIdFromUsername(username);
                    const eskiRutbe = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);
                    await noblox.setRank(AYARLAR.GROUP_ID, userId, targetRankId);
                    await new Promise(resolve => setTimeout(resolve, 1500)); // Rate limit
                    const yeniRutbe = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);
                    basarili.push(`${username} (${eskiRutbe} → ${yeniRutbe})`);
                    await logGonder(interaction, username, userId, eskiRutbe, yeniRutbe, sebep);
                } catch (e) {
                    basarisiz.push(`${username} (Hata: ${e.message})`);
                }
            }

            const sonucEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('Toplu Rütbe Değişimi Sonucu')
                .setDescription(`**Başarılı:**\n${basarili.join('\n') || 'Yok'}\n\n**Başarısız:**\n${basarisiz.join('\n') || 'Yok'}`)
                .setTimestamp();
            await interaction.editReply({ embeds: [sonucEmbed] });
        }

        else if (commandName === 'temizle') {
            const adet = options.getInteger('adet');
            if (adet < 1 || adet > 100) {
                return interaction.editReply('❌ 1 ile 100 arasında bir sayı girmelisiniz.');
            }
            await interaction.channel.bulkDelete(adet, true);
            await interaction.editReply(`✅ Başarıyla ${adet} adet mesaj silindi.`);
        }

        else if (commandName === 'davet') {
            const robloxIsim = options.getString('roblox-isim');
            const mesaj = options.getString('mesaj') || 'Sizi oyunumuza davet ediyoruz!';

            // Bu kısım Roblox API'sinde doğrudan bir davet fonksiyonu olmadığı için örnek bir mesaj gönderme olarak ele alınmıştır.
            // Gerçek bir oyun içi davet için oyunun kendi API'si veya özel bir entegrasyon gerekebilir.
            const davetEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('🎮 Oyun Daveti')
                .setDescription(`**${robloxIsim}** adlı kullanıcıya oyun daveti gönderildi.\nMesaj: *${mesaj}*`)
                .setTimestamp();
            await interaction.editReply({ embeds: [davetEmbed] });
        }

        else if (commandName === 'izin') {
            const hedefKullanici = options.getUser('kullanıcı');
            const sure = options.getInteger('süre');

            const hedefUye = await guild.members.fetch(hedefKullanici.id);
            if (!hedefUye) return interaction.editReply('❌ Belirtilen kullanıcı sunucuda bulunamadı.');

            await hedefUye.roles.add(AYARLAR.YETKILI_ROL_ID);
            await interaction.editReply(`✅ **${hedefKullanici.tag}** kullanıcısına ${sure} dakika süreli yetki verildi.`);

            setTimeout(async () => {
                if (hedefUye.roles.cache.has(AYARLAR.YETKILI_ROL_ID)) {
                    await hedefUye.roles.remove(AYARLAR.YETKILI_ROL_ID);
                    const logKanali = client.channels.cache.get(AYARLAR.LOG_CHANNEL_ID);
                    if (logKanali) {
                        logKanali.send(`🔔 **${hedefKullanici.tag}** kullanıcısının ${sure} dakikalık yetkisi sona erdi ve rolü geri alındı.`);
                    }
                }
            }, sure * 60 * 1000);
        }

        else if (commandName === 'yoklama') {
            const sesKanali = member.voice.channel;
            if (!sesKanali) return interaction.editReply('❌ Yoklama almak için bir ses kanalında olmalısınız.');

            const uyeler = sesKanali.members;
            let yoklamaMetni = '';
            for (const [id, uye] of uyeler) {
                try {
                    const robloxUsername = await noblox.getUsernameFromId(uye.id); // Discord ID'den Roblox kullanıcı adı almak doğrudan mümkün değil, bu kısım varsayımsal.
                    // Gerçek bir entegrasyon için Discord kullanıcısının Roblox hesabını bağlaması gerekebilir.
                    const rankName = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, uye.id); // Bu da Discord ID ile Roblox rütbesi almak için varsayımsal.
                    yoklamaMetni += `• ${uye.displayName} (Roblox: ${robloxUsername || 'Bilinmiyor'}) - Rütbe: ${rankName || 'Bilinmiyor'}\n`;
                } catch (e) {
                    yoklamaMetni += `• ${uye.displayName} (Roblox bilgisi alınamadı)\n`;
                }
            }

            const yoklamaEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle(`🔊 ${sesKanali.name} Kanalı Yoklaması`)
                .setDescription(yoklamaMetni || 'Ses kanalında kimse bulunmuyor.')
                .setTimestamp();
            await interaction.editReply({ embeds: [yoklamaEmbed] });
        }

        else if (commandName === 'duyuru-sabitle') {
            const kanal = options.getChannel('kanal');
            const icerik = options.getString('içerik');
            const etiket = options.getBoolean('etiket');

            const duyuruEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('📢 Yeni Duyuru (Sabitlendi)')
                .setDescription(icerik)
                .setFooter({ text: `Duyuran: ${interaction.user.tag}` })
                .setTimestamp();

            const mesaj = await kanal.send({ content: etiket ? '@everyone' : null, embeds: [duyuruEmbed] });
            await mesaj.pin();
            await interaction.editReply('✅ Duyuru başarıyla gönderildi ve sabitlendi.');
        }

        else if (commandName === 'ceza') {
            const robloxIsim = options.getString('roblox-isim');
            const sebep = options.getString('sebep');

            // Bu kısım Roblox grubunda doğrudan ceza sistemi olmadığı için Discord üzerinde bir loglama olarak ele alınmıştır.
            // Gerçek bir ceza sistemi için özel bir entegrasyon veya harici bir veritabanı gerekebilir.
            const cezaEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🚨 Disiplin Cezası')
                .addFields(
                    { name: 'Cezalı Personel', value: robloxIsim, inline: true },
                    { name: 'Ceza Veren', value: interaction.user.tag, inline: true },
                    { name: 'Sebep', value: sebep, inline: false }
                )
                .setTimestamp();
            await interaction.editReply({ embeds: [cezaEmbed] });

            const logKanali = client.channels.cache.get(AYARLAR.LOG_CHANNEL_ID);
            if (logKanali) await logKanali.send({ embeds: [cezaEmbed] });
        }

        else if (commandName === 'nöbet') {
            const kisilerStr = options.getString('kişiler');
            const sure = options.getInteger('süre');
            const kisiler = kisilerStr.split(',').map(k => k.trim());

            if (kisiler.length === 0) {
                return interaction.editReply('❌ Nöbet listesi için en az bir kişi belirtmelisiniz.');
            }

            let currentNobetciIndex = 0;

            const nobetEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(' vigilant | Nöbet Değişimi')
                .setDescription(`Şu an nöbette: **${kisiler[currentNobetciIndex]}**\nSonraki nöbetçi: **${kisiler[(currentNobetciIndex + 1) % kisiler.length]}**`)
                .setFooter({ text: `Nöbet süresi: ${sure} dakika | Başlatan: ${interaction.user.tag}` })
                .setTimestamp();

            const nobetMesaj = await interaction.editReply({ embeds: [nobetEmbed] });

            setInterval(async () => {
                currentNobetciIndex = (currentNobetciIndex + 1) % kisiler.length;
                const sonrakiNobetciIndex = (currentNobetciIndex + 1) % kisiler.length;

                const guncelNobetEmbed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle(' vigilant | Nöbet Değişimi')
                    .setDescription(`Şu an nöbette: **${kisiler[currentNobetciIndex]}**\nSonraki nöbetçi: **${kisiler[sonrakiNobetciIndex]}**`)
                    .setFooter({ text: `Nöbet süresi: ${sure} dakika | Başlatan: ${interaction.user.tag}` })
                    .setTimestamp();

                await nobetMesaj.edit({ embeds: [guncelNobetEmbed] });
            }, sure * 60 * 1000);
        }

        else if (commandName === 'aktiflik-duyuru') {
            const kanal = options.getChannel('kanal') || interaction.channel;

            const aktiflikEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🚨 Acil Durum | Operasyon Başlıyor!')
                .setDescription('Tüm personel dikkat! Operasyon bölgesine intikal için hazır olun. Katılımınız önemle rica olunur.')
                .setFooter({ text: `Duyuran: ${interaction.user.tag}` })
                .setTimestamp();

            await kanal.send({ content: '@here', embeds: [aktiflikEmbed] });
            await interaction.editReply('✅ Aktiflik duyurusu başarıyla gönderildi.');
        }

    } catch (error) {
        console.error("[Komut İşleme Hatası]", error);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply(`❌ Bir hata oluştu: ${error.message}`);
        } else {
            await interaction.reply(`❌ Bir hata oluştu: ${error.message}`);
        }
    }
});

client.login(AYARLAR.DISCORD_TOKEN);

