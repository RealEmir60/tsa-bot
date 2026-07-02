onst dns = require('dns');
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
const fs = require('fs'); // Veri kaydetmek için

// --- AYARLAR ---
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

// --- ROBLOX GİRİŞ ---
async function robloxGiris() {
    try {
        if (!AYARLAR.ROBLOX_COOKIE) throw new Error("ROBLOX_COOKIE tanımlanmamış!");
        const currentUser = await noblox.setCookie(AYARLAR.ROBLOX_COOKIE);
        console.log(`[Roblox] Başarılı: ${currentUser.UserName} olarak giriş yapıldı.`);
    } catch (err) {
        console.error("[Roblox] Giriş başarısız:", err.message);
    }
}
setInterval(robloxGiris, 6 * 60 * 60 * 1000);

// --- AKTİFLİK TAKİP SİSTEMİ ---
let aktiflikVerisi = new Map();
// Bot açılırken eski veriyi yükle
try {
    const data = fs.readFileSync('aktiflik.json', 'utf8');
    aktiflikVerisi = new Map(JSON.parse(data));
    console.log('[Aktiflik] Eski veriler yüklendi.');
} catch (e) {}

// Her 5 dakikada bir oyunu tara
setInterval(async () => {
    try {
        const res = await fetch(`https://games.roblox.com/v1/games/multiget-place-details?placeIds=${AYARLAR.OYUN_ID}`);
        const data = await res.json();
        if (!data[0]) return;
        const universeId = data[0].universeId;

        const sunucular = await noblox.getGameInstances(universeId).catch(() => []);
        const aktifIdler = [];
        for (const sunucu of sunucular) {
            try {
                const oyuncular = await noblox.getPlayersInServer(universeId, sunucu.id);
                aktifIdler.push(...oyuncular.map(o => o.id));
            } catch (e) {}
        }

        const simdi = Date.now();
        // Giriş
        for (const id of aktifIdler) {
            if (!aktiflikVerisi.has(id)) {
                aktiflikVerisi.set(id, { giris: simdi, toplam: 0, sonGorulme: simdi });
            } else {
                const veri = aktiflikVerisi.get(id);
                if (veri.giris === 0) veri.giris = simdi; // Tekrar girdi
                veri.sonGorulme = simdi;
            }
        }

        // Çıkış
        for (const [id, veri] of aktiflikVerisi.entries()) {
            if (!aktifIdler.includes(id) && veri.giris > 0) {
                const sure = Math.floor((simdi - veri.giris) / 60000);
                veri.toplam += sure;
                veri.giris = 0;
            }
        }

        // Veriyi kaydet
        fs.writeFileSync('aktiflik.json', JSON.stringify([...aktiflikVerisi]));
    } catch (err) {
        console.error('[Aktiflik] Tarama hatası:', err.message);
    }
}, 5 * 60 * 1000);

// --- HTTP SUNUCUSU ---
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('TSA Karargah Botu Aktif!');
}).listen(AYARLAR.PORT);

// --- DISCORD CLIENT ---
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates]
});

// --- KOMUTLAR ---
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
    { name: 'grup-listele', description: 'Kullanıcının üye olduğu gruplar.', options: [{ name: 'roblox-isim', description: 'Roblox kullanıcı adı', type: ApplicationCommandOptionType.String, required: true }] },
    {
        name: 'aktiflik',
        description: 'Personelin aktiflik süresini gösterir.',
        options: [{ name: 'roblox-isim', description: 'Roblox kullanıcı adı', type: ApplicationCommandOptionType.String, required: true }]
    },
    { name: 'aktiflik-sıralama', description: 'En aktif 10 personeli listeler.' },
    { name: 'afk-liste', description: '7 gündür oyuna girmeyenleri listeler.' },
    { name: 'temizle', description: 'Mesajları temizler.', options: [{ name: 'adet', description: 'Silinecek mesaj sayısı', type: ApplicationCommandOptionType.Integer, required: true }] },
    { name: 'duyuru', description: 'Kurumsal duyuru yayınlar.', options: [{ name: 'kanal', description: 'Duyuru kanalı', type: ApplicationCommandOptionType.Channel, required: true }, { name: 'içerik', description: 'Duyuru içeriği', type: ApplicationCommandOptionType.String, required: true }] }
];

// --- LOG FONKSİYONU ---
async function logGonder(interaction, username, userId, eskiRutbe, yeniRutbe, sebep) {
    try {
        const avatarResmi = await noblox.getPlayerThumbnail(userId, "150x150", "png", false, "Headshot");
        const thumb = avatarResmi[0]?.imageUrl || null;
        const embed = new EmbedBuilder()
          .setColor('#2C3E50')
          .setAuthor({ name: 'TSA KARARGAH DENETLEME', iconURL: client.user.displayAvatarURL() })
          .setTitle(`🎖 Rütbe Güncellendi`)
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

// --- EVENTLER ---
client.once('ready', async () => {
    console.log(`[Discord] ${client.user.tag} göreve hazır!`);
    client.user.setActivity('TSA | Turkish Special Army', { type: ActivityType.Playing });
    await robloxGiris();

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
        const { commandName, options, member } = interaction;

        const yetkiliKomutlar = ['rütbe-değiştir', 'terfi', 'tenzil', 'temizle', 'duyuru'];
        if (yetkiliKomutlar.includes(commandName)) {
            if (!member.roles.cache.has(AYARLAR.YETKILI_ROL_ID) &&!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Bu komut için Karargah Yetkilisi olmalısınız.', ephemeral: true });
            }
        }

        await interaction.deferReply().catch(() => {});

        if (commandName === 'ping') {
            await interaction.editReply(`📡 Gecikme: **${client.ws.ping}ms**`);
        }
        else if (commandName === 'rütbe-değiştir') {
            const name = options.getString('roblox-isim');
            const rid = options.getInteger('rütbe');
            const sebep = options.getString('sebep');
            const uId = await noblox.getIdFromUsername(name);
            const eski = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, uId);
            await noblox.setRank(AYARLAR.GROUP_ID, uId, rid);
            await new Promise(r => setTimeout(r, 2000));
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
            await new Promise(r => setTimeout(r, 2000));
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
            await new Promise(r => setTimeout(r, 2000));
            const yeni = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, uId);
            const res = await logGonder(interaction, name, uId, eski, yeni, sebep);
            await interaction.editReply(res);
        }
        else if (commandName === 'profile') {
            const name = options.getString('roblox-isim');
            const uId = await noblox.getIdFromUsername(name);
            const rank = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, uId);
            const thumb = await noblox.getPlayerThumbnail(uId, "150x150", "png", false, "Headshot");
            const veri = aktiflikVerisi.get(uId) || { toplam: 0 };
            const saat = Math.floor(veri.toplam / 60);
            const dk = veri.toplam % 60;

            const embed = new EmbedBuilder().setColor('#3498DB')
              .setTitle(`🎖 Personel: ${name}`)
              .addFields(
                    { name: 'Rütbe', value: rank, inline: true },
                    { name: 'Toplam Aktiflik', value: `${saat}s ${dk}dk`, inline: true },
                    { name: 'ID', value: uId.toString(), inline: true }
                )
              .setThumbnail(thumb[0]?.imageUrl).setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
        else if (commandName === 'aktiflik') {
            const name = options.getString('roblox-isim');
            const uId = await noblox.getIdFromUsername(name);
            const veri = aktiflikVerisi.get(uId) || { toplam: 0, giris: 0 };

            let anlikDurum = '🔴 Çevrimdışı';
            let anlikSure = 0;
            if (veri.giris > 0) {
                anlikDurum = '🟢 Oyunda';
                anlikSure = Math.floor((Date.now() - veri.giris) / 60000);
            }

            const toplamSaat = Math.floor(veri.toplam / 60);
            const toplamDk = veri.toplam % 60;

            const embed = new EmbedBuilder()
              .setColor('#00FF00')
              .setTitle(`📊 ${name} Aktiflik Raporu`)
              .addFields(
                    { name: 'Durum', value: anlikDurum, inline: true },
                    { name: 'Anlık Süre', value: `${anlikSure} dakika`, inline: true },
                    { name: 'Toplam Süre', value: `${toplamSaat} saat ${toplamDk} dakika`, inline: true }
                )
              .setFooter({ text: 'Veri her 5dk güncellenir' })
              .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
        else if (commandName === 'aktiflik-sıralama') {
            const siralama = [...aktiflikVerisi.entries()]
              .sort((a, b) => b[1].toplam - a[1].toplam)
              .slice(0, 10);

            let aciklama = '';
            for (let i = 0; i < siralama.length; i++) {
                const [id, veri] = siralama[i];
                const isim = await noblox.getUsernameFromId(id).catch(() => `ID:${id}`);
                const saat = Math.floor(veri.toplam / 60);
                const dk = veri.toplam % 60;
                aciklama += `**${i+1}.** ${isim} - ${saat}s ${dk}dk\n`;
            }

            const embed = new EmbedBuilder()
              .setColor('#FFD700')
              .setTitle('🏆 En Aktif 10 Personel')
              .setDescription(aciklama || 'Veri yok')
              .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
        else if (commandName === 'afk-liste') {
            const grupUyeleri = await noblox.getPlayers(AYARLAR.GROUP_ID, 255).catch(() => []);
            const afklar = [];
            const birHafta = 7 * 24 * 60 * 60 * 1000;

            for (const uye of grupUyeleri) {
                const veri = aktiflikVerisi.get(uye.userId);
                if (!veri || Date.now() - veri.sonGorulme > birHafta) {
                    afklar.push(uye.username);
                }
            }

            const embed = new EmbedBuilder()
              .setColor('#FF0000')
              .setTitle('😴 7 Gün AFK Listesi')
              .setDescription(afklar.slice(0, 20).join('\n') || 'AFK personel yok. Helal olsun!')
              .setFooter({ text: `Toplam ${afklar.length} kişi` })
              .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
        else if (commandName === 'grup-listele') {
            const name = options.getString('roblox-isim');
            const uId = await noblox.getIdFromUsername(name);
            const groups = await noblox.getGroups(uId);
            const list = groups.map(g => `• **${g.Name}**: ${g.Role}`).join('\n') || 'Grup bulunamadı.';
            const embed = new EmbedBuilder().setColor('Grey').setTitle(`${name} - Grup Listesi`).setDescription(list.slice(0, 4000)).setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
        else if (commandName === 'temizle') {
            const adet = options.getInteger('adet');
            await interaction.channel.bulkDelete(Math.min(adet, 100), true);
            await interaction.editReply(`✅ **${adet}** mesaj silindi.`);
        }
        else if (commandName === 'duyuru') {
            const kanal = options.getChannel('kanal');
            const icerik = options.getString('içerik');
            const embed = new EmbedBuilder().setColor('#C0392B').setTitle('📢 KARARGAH DUYURUSU').setDescription(icerik).setTimestamp();
            await kanal.send({ content: '@everyone', embeds: [embed] });
            await interaction.editReply(`✅ Duyuru ${kanal} kanalında yayınlandı.`);
        }

    } catch (err) {
        console.error(err);
        const msg = `❌ **HATA:** ${err.message}`;
        if (interaction.deferred) await interaction.editReply(msg).catch(() => {});
        else await interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
    }
});

client.login(AYARLAR.DISCORD_TOKEN);
