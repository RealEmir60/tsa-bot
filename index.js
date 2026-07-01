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
const http = require('http');

// --- AYARLAR VE YAPILANDIRMA ---
const AYARLAR = {
    DISCORD_TOKEN: process.env.DISCORD_TOKEN,
    ROBLOX_API_KEY: process.env.ROBLOX_API_KEY, // Artık sadece API Key kullanılıyor
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

// --- ROBLOX OPENCLOUD YARDIMCI FONKSİYONLARI ---
const RobloxAPI = {
    async request(url, method = 'GET', body = null) {
        const options = {
            method,
            headers: {
                'x-api-key': AYARLAR.ROBLOX_API_KEY,
                'Content-Type': 'application/json'
            }
        };
        if (body) options.body = JSON.stringify(body);
        const res = await fetch(url, options);
        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: res.statusText }));
            throw new Error(err.message || `API Hatası: ${res.status}`);
        }
        return res.json();
    },

    async getIdFromUsername(username) {
        const data = await this.request('https://apis.roblox.com/cloud/v2/users:batchGetByUsernames', 'POST', { usernames: [username] });
        if (!data.users || data.users.length === 0) throw new Error("Kullanıcı bulunamadı.");
        return data.users[0].path.split('/')[1];
    },

    async getRankInGroup(groupId, userId) {
        const data = await this.request(`https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships/${userId}`);
        return data.role.rank;
    },

    async getRankNameInGroup(groupId, userId) {
        const data = await this.request(`https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships/${userId}`);
        return data.role.displayName;
    },

    async setRank(groupId, userId, rankId) {
        // OpenCloud Group Member Update (Experimental)
        return this.request(`https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships/${userId}`, 'PATCH', {
            role: `groups/${groupId}/roles/${rankId}`
        });
    },

    async getThumbnail(userId) {
        const res = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`);
        const data = await res.json();
        return data.data[0]?.imageUrl || null;
    }
};

// --- RENDER HTTP SUNUCUSU ---
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('TSA Karargah Botu (OpenCloud) Aktif!');
}).listen(AYARLAR.PORT);

// --- DISCORD CLIENT ---
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates]
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
    { name: 'terfi', description: 'Personeli +1 rütbe yükseltir.', options: [{ name: 'roblox-isim', description: 'Roblox kullanıcı adı', type: ApplicationCommandOptionType.String, required: true }, { name: 'sebep', description: 'Terfi sebebi', type: ApplicationCommandOptionType.String, required: true }] },
    { name: 'tenzil', description: 'Personeli -1 rütbe düşürür.', options: [{ name: 'roblox-isim', description: 'Roblox kullanıcı adı', type: ApplicationCommandOptionType.String, required: true }, { name: 'sebep', description: 'Tenzil sebebi', type: ApplicationCommandOptionType.String, required: true }] },
    { name: 'profile', description: 'Personel künye bilgisi.', options: [{ name: 'roblox-isim', description: 'Roblox kullanıcı adı', type: ApplicationCommandOptionType.String, required: true }] },
    { name: 'aktiflik-sorgu', description: 'Oyundaki anlık personel sayısı.' },
    { name: 'yasakla', description: 'Üyeyi sunucudan yasaklar.', options: [{ name: 'kullanıcı', description: 'Yasaklanacak kullanıcı', type: ApplicationCommandOptionType.User, required: true }, { name: 'sebep', description: 'Yasaklanma sebebi', type: ApplicationCommandOptionType.String, required: true }] },
    { name: 'temizle', description: 'Mesajları temizler.', options: [{ name: 'adet', description: 'Silinecek mesaj sayısı', type: ApplicationCommandOptionType.Integer, required: true }] },
    { name: 'duyuru', description: 'Kurumsal duyuru yayınlar.', options: [{ name: 'kanal', description: 'Duyuru kanalı', type: ApplicationCommandOptionType.Channel, required: true }, { name: 'içerik', description: 'Duyuru içeriği', type: ApplicationCommandOptionType.String, required: true }] }
];

// --- YARDIMCI FONKSİYONLAR ---
async function logGonder(interaction, username, userId, eskiRutbe, yeniRutbe, sebep, tip = "GÜNCELLEME") {
    try {
        const thumb = await RobloxAPI.getThumbnail(userId);
        const embed = new EmbedBuilder()
            .setColor('#2C3E50')
            .setAuthor({ name: 'TSA KARARGAH DENETLEME', iconURL: client.user.displayAvatarURL() })
            .setTitle(`🎖️ Rütbe ${tip}`)
            .addFields(
                { name: '👤 Personel', value: `**${username}**`, inline: true },
                { name: '👮 Yetkili', value: interaction.user.username, inline: true },
                { name: '📉 Eski Rütbe', value: eskiRutbe, inline: true },
                { name: '📈 Yeni Rütbe', value: yeniRutbe, inline: true },
                { name: '📝 Gerekçe', value: sebep || 'Belirtilmedi', inline: false }
            )
            .setThumbnail(thumb)
            .setFooter({ text: 'Turkish Special Army | Karargah Sistemi' })
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
    console.log(`[Discord] ${client.user.tag} OpenCloud sistemiyle göreve hazır!`);
    client.user.setActivity('TSA | Turkish Special Army', { type: ActivityType.Playing });

    const rest = new REST({ version: '10' }).setToken(AYARLAR.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('[Discord] Komutlar senkronize edildi.');
    } catch (e) { console.error(e); }
});

client.on('interactionCreate', async (interaction) => {
    try {
        if (interaction.isAutocomplete()) {
            const focused = interaction.options.getFocused().toLowerCase();
            const filtered = TUM_RUTBELER.filter(r => r.name.toLowerCase().includes(focused)).slice(0, 25);
            await interaction.respond(filtered.map(r => ({ name: r.name, value: r.value }))).catch(() => {});
            return;
        }

        if (!interaction.isChatInputCommand()) return;
        const { commandName, options, member, guild } = interaction;

        const yetkiliKomutlar = ['rütbe-değiştir', 'terfi', 'tenzil', 'yasakla', 'duyuru', 'temizle'];
        if (yetkiliKomutlar.includes(commandName)) {
            if (!member.roles.cache.has(AYARLAR.YETKILI_ROL_ID) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Bu komut için Karargah Yetkilisi olmalısınız.', ephemeral: true });
            }
        }

        await interaction.deferReply().catch(() => {});

        if (commandName === 'ping') {
            await interaction.editReply(`📡 Komuta Merkezi Gecikme: **${client.ws.ping}ms**`);
        } 
        else if (commandName === 'rütbe-değiştir') {
            const name = options.getString('roblox-isim');
            const rid = options.getInteger('rütbe');
            const sebep = options.getString('sebep');
            const uId = await RobloxAPI.getIdFromUsername(name);
            const eski = await RobloxAPI.getRankNameInGroup(AYARLAR.GROUP_ID, uId);
            await RobloxAPI.setRank(AYARLAR.GROUP_ID, uId, rid);
            await new Promise(r => setTimeout(r, 2000));
            const yeni = await RobloxAPI.getRankNameInGroup(AYARLAR.GROUP_ID, uId);
            const res = await logGonder(interaction, name, uId, eski, yeni, sebep);
            await interaction.editReply(res);
        }
        else if (commandName === 'profile') {
            const name = options.getString('roblox-isim');
            const uId = await RobloxAPI.getIdFromUsername(name);
            const rank = await RobloxAPI.getRankNameInGroup(AYARLAR.GROUP_ID, uId);
            const thumb = await RobloxAPI.getThumbnail(uId);
            const embed = new EmbedBuilder()
                .setColor('#3498DB')
                .setTitle(`🎖️ Personel Künyesi: ${name}`)
                .addFields({ name: 'Rütbe', value: `**${rank}**`, inline: true }, { name: 'Roblox ID', value: uId, inline: true })
                .setThumbnail(thumb)
                .setFooter({ text: 'TSA Karargah Bilgi Sistemi' })
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
        else if (commandName === 'temizle') {
            const adet = options.getInteger('adet');
            await interaction.channel.bulkDelete(Math.min(adet, 100), true);
            await interaction.editReply(`✅ **${adet}** adet operasyon kaydı imha edildi.`);
        }
        else if (commandName === 'yasakla') {
            const user = options.getUser('kullanıcı');
            const sebep = options.getString('sebep');
            await guild.members.ban(user, { reason: sebep });
            await interaction.editReply(`🚫 **${user.tag}** sunucudan ihraç edildi. Sebep: ${sebep}`);
        }
        else if (commandName === 'duyuru') {
            const kanal = options.getChannel('kanal');
            const icerik = options.getString('içerik');
            const embed = new EmbedBuilder()
                .setColor('#C0392B')
                .setTitle('📢 TSA KARARGAH DUYURUSU')
                .setDescription(icerik)
                .setFooter({ text: 'Turkish Special Army Yönetimi' })
                .setTimestamp();
            await kanal.send({ content: '@everyone', embeds: [embed] });
            await interaction.editReply(`✅ Duyuru ${kanal} kanalında yayınlandı.`);
        }

    } catch (err) {
        console.error(err);
        const msg = `❌ **HATA:** ${err.message}\n*(Not: API Key yetkilerinizi Roblox panelinden kontrol edin)*`;
        if (interaction.deferred) await interaction.editReply(msg).catch(() => {});
        else await interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
    }
});

client.login(AYARLAR.DISCORD_TOKEN);
