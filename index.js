const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const fetch = require('node-fetch');
const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    REST, 
    Routes, 
    ApplicationCommandOptionType, 
    PermissionFlagsBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ActivityType, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle 
} = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const noblox = require('noblox.js');
const http = require('http');

// --- AYARLAR VE YAPILANDIRMA ---
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

// --- RENDER HTTP SUNUCUSU ---
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('TSA Karargah Botu Aktif!');
}).listen(AYARLAR.PORT);

// --- DISCORD CLIENT ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildVoiceStates
    ]
});

// --- KOMUT TANIMLAMALARI ---
const commands = [
    { name: 'ping', description: 'Botun gecikme süresini gösterir.' },
    {
        name: 'rütbe-değiştir',
        description: 'Personel rütbesini değiştirir.',
        options: [
            { name: 'roblox-isim', description: 'Roblox kullanıcı adı', type: ApplicationCommandOptionType.String, required: true },
            { name: 'rütbe', description: 'Yeni rütbe', type: ApplicationCommandOptionType.Integer, required: true, autocomplete: true },
            { name: 'sebep', description: 'Gerekçe', type: ApplicationCommandOptionType.String, required: true }
        ]
    },
    { 
        name: 'terfi', 
        description: 'Personeli +1 rütbe yükseltir.', 
        options: [
            { name: 'roblox-isim', description: 'Roblox kullanıcı adı', type: ApplicationCommandOptionType.String, required: true }, 
            { name: 'sebep', description: 'Terfi sebebi', type: ApplicationCommandOptionType.String, required: true }
        ] 
    },
    { 
        name: 'tenzil', 
        description: 'Personeli -1 rütbe düşürür.', 
        options: [
            { name: 'roblox-isim', description: 'Roblox kullanıcı adı', type: ApplicationCommandOptionType.String, required: true }, 
            { name: 'sebep', description: 'Tenzil sebebi', type: ApplicationCommandOptionType.String, required: true }
        ] 
    },
    { 
        name: 'profile', 
        description: 'Personel künye bilgisi.', 
        options: [
            { name: 'roblox-isim', description: 'Roblox kullanıcı adı', type: ApplicationCommandOptionType.String, required: true }
        ] 
    },
    { 
        name: 'grup-listele', 
        description: 'Kullanıcının üye olduğu gruplar.', 
        options: [
            { name: 'roblox-isim', description: 'Roblox kullanıcı adı', type: ApplicationCommandOptionType.String, required: true }
        ] 
    },
    { name: 'aktiflik-sorgu', description: 'Oyundaki anlık personel sayısı.' },
    { 
        name: 'yasakla', 
        description: 'Üyeyi sunucudan yasaklar.', 
        options: [
            { name: 'kullanıcı', description: 'Yasaklanacak kullanıcı', type: ApplicationCommandOptionType.User, required: true }, 
            { name: 'sebep', description: 'Yasaklanma sebebi', type: ApplicationCommandOptionType.String, required: true }
        ] 
    },
    { 
        name: 'temizle', 
        description: 'Mesajları temizler.', 
        options: [
            { name: 'adet', description: 'Silinecek mesaj sayısı', type: ApplicationCommandOptionType.Integer, required: true }
        ] 
    },
    { name: 'ses-katıl', description: 'Botu ses kanalına çağırır.' },
    { name: 'ses-ayrıl', description: 'Botu ses kanalından çıkarır.' },
    { 
        name: 'branş-istek', 
        description: 'Branş başvurusu yapar.', 
        options: [
            { name: 'roblox-isim', description: 'Roblox kullanıcı adı', type: ApplicationCommandOptionType.String, required: true }, 
            { name: 'branş', description: 'Talep edilen branş', type: ApplicationCommandOptionType.String, required: true, choices: Object.keys(BRANSLAR).map(b => ({ name: b, value: b })) }, 
            { name: 'sebep', description: 'Başvuru sebebi', type: ApplicationCommandOptionType.String, required: true }
        ] 
    },
    { 
        name: 'branş-at', 
        description: 'Personeli branşa atar.', 
        options: [
            { name: 'roblox-isim', description: 'Roblox kullanıcı adı', type: ApplicationCommandOptionType.String, required: true }, 
            { name: 'branş', description: 'Atanacak branş', type: ApplicationCommandOptionType.String, required: true, choices: Object.keys(BRANSLAR).map(b => ({ name: b, value: b })) }, 
            { name: 'rütbe', description: 'Atanacak rütbe', type: ApplicationCommandOptionType.Integer, required: true, autocomplete: true }, 
            { name: 'sebep', description: 'Atama sebebi', type: ApplicationCommandOptionType.String, required: true }
        ] 
    },
    { 
        name: 'duyuru', 
        description: 'Kurumsal duyuru yayınlar.', 
        options: [
            { name: 'kanal', description: 'Duyuru kanalı', type: ApplicationCommandOptionType.Channel, required: true }, 
            { name: 'içerik', description: 'Duyuru içeriği', type: ApplicationCommandOptionType.String, required: true }
        ] 
    },
    { name: 'karargah-durum', description: 'Grup genel durumu.' },
    { 
        name: 'sorgula', 
        description: 'Rütbe geçmişini sorgular.', 
        options: [
            { name: 'roblox-isim', description: 'Roblox kullanıcı adı', type: ApplicationCommandOptionType.String, required: true }
        ] 
    },
    { 
        name: 'toplu-rütbe', 
        description: 'Çoklu rütbe ataması.', 
        options: [
            { name: 'kullanicilar', description: 'Virgülle ayır: user1,user2', type: ApplicationCommandOptionType.String, required: true }, 
            { name: 'rütbe', description: 'Atanacak rütbe', type: ApplicationCommandOptionType.Integer, required: true, autocomplete: true }, 
            { name: 'sebep', description: 'Atama sebebi', type: ApplicationCommandOptionType.String, required: true }
        ] 
    },
    { name: 'yoklama', description: 'Ses kanalındakileri listeler.' },
    { 
        name: 'ceza', 
        description: 'Disiplin cezası uygular.', 
        options: [
            { name: 'roblox-isim', description: 'Roblox kullanıcı adı', type: ApplicationCommandOptionType.String, required: true }, 
            { name: 'sebep', description: 'Ceza sebebi', type: ApplicationCommandOptionType.String, required: true }
        ] 
    },
    { 
        name: 'nöbet', 
        description: 'Nöbet listesi ve rotasyonu.', 
        options: [
            { name: 'kişiler', description: 'user1,user2', type: ApplicationCommandOptionType.String, required: true }, 
            { name: 'süre', description: 'Nöbet süresi (dakika)', type: ApplicationCommandOptionType.Integer, required: true }
        ] 
    },
    { 
        name: 'aktiflik-duyuru', 
        description: 'Operasyon çağrısı yapar.', 
        options: [
            { name: 'kanal', description: 'Duyuru kanalı', type: ApplicationCommandOptionType.Channel, required: false }
        ] 
    }
];

// --- YARDIMCI FONKSİYONLAR ---
async function robloxGiris() {
    try {
        if (!AYARLAR.ROBLOX_COOKIE) throw new Error("Cookie eksik!");
        const user = await noblox.setCookie(AYARLAR.ROBLOX_COOKIE);
        console.log(`[Roblox] Giriş başarılı: ${user.UserName}`);
    } catch (err) {
        console.error("[Roblox] HATA:", err.message);
    }
}

async function logGonder(interaction, username, userId, eskiRutbe, yeniRutbe, sebep) {
    try {
        const thumb = await noblox.getPlayerThumbnail(userId, "150x150", "png", false, "Headshot");
        const embed = new EmbedBuilder()
            .setColor('#3b5998')
            .setTitle('🛡️ Karargah Rütbe Güncellemesi')
            .addFields(
                { name: 'Personel', value: `**${username}**`, inline: true },
                { name: 'İşlem Yapan', value: interaction.user.username, inline: true },
                { name: 'Eski Rütbe', value: eskiRutbe, inline: true },
                { name: 'Yeni Rütbe', value: yeniRutbe, inline: true },
                { name: 'Gerekçe', value: sebep || 'Belirtilmedi', inline: false }
            )
            .setThumbnail(thumb[0]?.imageUrl || null)
            .setTimestamp();

        const logKanal = client.channels.cache.get(AYARLAR.LOG_CHANNEL_ID);
        if (logKanal) await logKanal.send({ embeds: [embed] }).catch(() => {});
        return { embeds: [embed] };
    } catch (e) {
        return { content: `✅ İşlem başarılı (Log hatası: ${e.message})` };
    }
}

// --- EVENT HANDLERS ---
client.once('ready', async () => {
    console.log(`[Discord] ${client.user.tag} göreve hazır!`);
    client.user.setActivity('TSA | Karargah Denetimi', { type: ActivityType.Watching });
    await robloxGiris();

    const rest = new REST({ version: '10' }).setToken(AYARLAR.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('[Discord] Komutlar senkronize edildi.');
    } catch (e) { console.error("[Discord Komut Hatası]", e); }
});

client.on('interactionCreate', async (interaction) => {
    try {
        // Autocomplete
        if (interaction.isAutocomplete()) {
            const focused = interaction.options.getFocused().toLowerCase();
            const filtered = TUM_RUTBELER.filter(r => r.name.toLowerCase().includes(focused)).slice(0, 25);
            await interaction.respond(filtered.map(r => ({ name: r.name, value: r.value }))).catch(() => {});
            return;
        }

        // Button Interactions (Branş)
        if (interaction.isButton()) {
            if (!interaction.member.roles.cache.has(AYARLAR.BRANS_YETKILI_ROL_ID) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Yetkiniz yetersiz.', ephemeral: true });
            }
            if (interaction.customId.startsWith('brans_kabul_')) {
                const [,, rName, brans, uId] = interaction.customId.split('_');
                const modal = new ModalBuilder().setCustomId(`br_modal_${rName}_${brans}_${uId}`).setTitle(`${brans} Ataması`);
                const input = new TextInputBuilder().setCustomId('rid').setLabel('Rütbe ID (1-255)').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(input));
                await interaction.showModal(modal);
            } else if (interaction.customId.startsWith('brans_red_')) {
                await interaction.update({ content: '❌ Başvuru reddedildi.', embeds: [], components: [] });
            }
            return;
        }

        // Modal Submit
        if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('br_modal_')) {
                await interaction.deferReply({ ephemeral: true });
                const [,, rName, brans, uId] = interaction.customId.split('_');
                const rid = parseInt(interaction.fields.getTextInputValue('rid'));
                try {
                    const groupId = BRANSLAR[brans];
                    // Diğer branşlardan çıkar
                    for (const gId of Object.values(BRANSLAR)) {
                        try { if (await noblox.getRankInGroup(gId, uId) > 0) await noblox.setRank(gId, uId, 0); } catch(e){}
                    }
                    await new Promise(r => setTimeout(r, 1000));
                    await noblox.setRank(groupId, uId, rid);
                    const rNameNew = await noblox.getRankNameInGroup(groupId, uId);
                    await interaction.editReply(`✅ **${rName}** personeli **${brans}** branşına **${rNameNew}** olarak atandı.`);
                    await interaction.message.edit({ content: `✅ İşlem tamamlandı: ${brans}`, embeds: [], components: [] }).catch(() => {});
                } catch (err) { await interaction.editReply(`❌ Hata: ${err.message}`); }
            }
            return;
        }

        // Slash Commands
        if (!interaction.isChatInputCommand()) return;
        const { commandName, options, member, guild } = interaction;

        // Yetki Kontrolü
        const yetkiliKomutlar = ['rütbe-değiştir', 'terfi', 'tenzil', 'yasakla', 'branş-at', 'toplu-rütbe', 'duyuru', 'ceza', 'nöbet', 'aktiflik-duyuru', 'temizle', 'ses-katıl', 'ses-ayrıl'];
        if (yetkiliKomutlar.includes(commandName)) {
            if (!member.roles.cache.has(AYARLAR.YETKILI_ROL_ID) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Bu komut için Karargah Yetkilisi olmalısınız.', ephemeral: true });
            }
        }

        await interaction.deferReply().catch(() => {});

        // Komut Mantıkları
        if (commandName === 'ping') {
            await interaction.editReply(`🏓 Gecikme: **${client.ws.ping}ms**`);
        } 
        else if (commandName === 'rütbe-değiştir') {
            const name = options.getString('roblox-isim');
            const rid = options.getInteger('rütbe');
            const sebep = options.getString('sebep');
            const uId = await noblox.getIdFromUsername(name);
            const eski = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, uId);
            await noblox.setRank(AYARLAR.GROUP_ID, uId, rid);
            await new Promise(r => setTimeout(r, 1000));
            const yeni = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, uId);
            const res = await logGonder(interaction, name, uId, eski, yeni, sebep);
            await interaction.editReply(res);
        }
        else if (commandName === 'terfi') {
            const name = options.getString('roblox-isim');
            const sebep = options.getString('sebep');
            const uId = await noblox.getIdFromUsername(name);
            const eski = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, uId);
            await noblox.promote(AYARLAR.GROUP_ID, uId);
            await new Promise(r => setTimeout(r, 1000));
            const yeni = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, uId);
            const res = await logGonder(interaction, name, uId, eski, yeni, sebep);
            await interaction.editReply(res);
        }
        else if (commandName === 'tenzil') {
            const name = options.getString('roblox-isim');
            const sebep = options.getString('sebep');
            const uId = await noblox.getIdFromUsername(name);
            const eski = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, uId);
            await noblox.demote(AYARLAR.GROUP_ID, uId);
            await new Promise(r => setTimeout(r, 1000));
            const yeni = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, uId);
            const res = await logGonder(interaction, name, uId, eski, yeni, sebep);
            await interaction.editReply(res);
        }
        else if (commandName === 'aktiflik-sorgu') {
            const res = await fetch(`https://games.roblox.com/v1/games/multiget-place-details?placeIds=${AYARLAR.OYUN_ID}`);
            const data = await res.json();
            const uId = data[0]?.universeId;
            const res2 = await fetch(`https://games.roblox.com/v1/games?universeIds=${uId}`);
            const data2 = await res2.json();
            const count = data2.data[0]?.playing || 0;
            const embed = new EmbedBuilder().setColor('Green').setTitle('⚔️ Operasyon Aktifliği').setDescription(`Anlık Personel: **${count}**`).setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
        else if (commandName === 'profile') {
            const name = options.getString('roblox-isim');
            const uId = await noblox.getIdFromUsername(name);
            const rank = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, uId);
            const thumb = await noblox.getPlayerThumbnail(uId, "150x150", "png", false, "Headshot");
            const embed = new EmbedBuilder().setColor('Blue').setTitle(`Personel: ${name}`).setDescription(`Rütbe: **${rank}**`).setThumbnail(thumb[0]?.imageUrl).setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
        else if (commandName === 'temizle') {
            const adet = options.getInteger('adet');
            await interaction.channel.bulkDelete(Math.min(adet, 100), true);
            await interaction.editReply(`✅ ${adet} mesaj imha edildi.`);
        }
        else if (commandName === 'yasakla') {
            const user = options.getUser('kullanıcı');
            const sebep = options.getString('sebep');
            await guild.members.ban(user, { reason: sebep });
            await interaction.editReply(`🚫 **${user.tag}** sunucudan ihraç edildi. Sebep: ${sebep}`);
        }
        else if (commandName === 'ses-katıl') {
            const channel = member.voice.channel;
            if (!channel) return interaction.editReply("❌ Ses kanalında değilsiniz.");
            joinVoiceChannel({ channelId: channel.id, guildId: guild.id, adapterCreator: guild.voiceAdapterCreator });
            await interaction.editReply(`🔊 **${channel.name}** kanalına intikal edildi.`);
        }
        else if (commandName === 'ses-ayrıl') {
            const conn = getVoiceConnection(guild.id);
            if (conn) conn.destroy();
            await interaction.editReply("🔇 Ses kanalından ayrılındı.");
        }
        else if (commandName === 'branş-istek') {
            const name = options.getString('roblox-isim');
            const brans = options.getString('branş');
            const sebep = options.getString('sebep');
            const uId = await noblox.getIdFromUsername(name);
            const embed = new EmbedBuilder().setColor('Orange').setTitle('📋 Branş Başvurusu').addFields({ name: 'Personel', value: name }, { name: 'Branş', value: brans }, { name: 'Sebep', value: sebep }).setTimestamp();
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`brans_kabul_${name}_${brans}_${uId}`).setLabel('Kabul').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`brans_red_${name}`).setLabel('Red').setStyle(ButtonStyle.Danger)
            );
            const logKanal = client.channels.cache.get(AYARLAR.LOG_CHANNEL_ID);
            if (logKanal) await logKanal.send({ embeds: [embed], components: [row] });
            await interaction.editReply("✅ Başvurunuz karargaha iletildi.");
        }

    } catch (err) {
        console.error(err);
        const msg = `❌ Hata: ${err.message}`;
        if (interaction.deferred) await interaction.editReply(msg).catch(() => {});
        else await interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
    }
});

client.login(AYARLAR.DISCORD_TOKEN);
