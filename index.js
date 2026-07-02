const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
const fetch = require('node-fetch');
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, ApplicationCommandOptionType, PermissionFlagsBits, ActivityType, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const noblox = require('noblox.js');
const http = require('http');
const fs = require('fs');

const AYARLAR = {
    DISCORD_TOKEN: process.env.DISCORD_TOKEN,
    ROBLOX_COOKIE: process.env.ROBLOX_COOKIE,
    GROUP_ID: parseInt(process.env.GROUP_ID) || 972348115,
    LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID || "1519328796275380325",
    YETKILI_ROL_ID: process.env.YETKILI_ROL_ID || "1518357646971764859",
    BRANS_YETKILI_ROL_ID: "1518357724880961656",
    IZIN_ROL_ID: process.env.IZIN_ROL_ID || "0000000000000000000",
    OYUN_ID: process.env.OYUN_ID || "138257110169831",
    PORT: process.env.PORT || 3000,
    BOT_SAHIBI_ID: process.env.BOT_SAHIBI_ID || ""
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
    { name: '[OR-1] Acemi Er', value: 1 }, { name: '[OR-2] Onbaşı', value: 2 },
    { name: '[OR-3] Uzman Onbaşı', value: 3 }, { name: '[OR-4] Çavuş', value: 4 },
    { name: '[OR-5] Uzman Çavuş', value: 5 }, { name: '[OR-6] Astsubay Çavuş', value: 6 },
    { name: '[OR-7] Astsubay Üstçavuş', value: 7 }, { name: '[OR-8] Astsubay Başçavuş', value: 8 },
    { name: '[OR-9] Astsubay Kd. Başçavuş', value: 9 }, { name: '[OF-1/A] Asteğmen', value: 10 },
    { name: '[OF-1/B] Teğmen', value: 11 }, { name: '[OF-1/C] Üsteğmen', value: 12 },
    { name: '[OF-2] YüzBaşı', value: 13 }, { name: '[OF-3] Binbaşı', value: 14 },
    { name: '[OF-4] Yarbay', value: 15 }, { name: '[OF-5] Albay', value: 16 },
    { name: '[OF-6] Tuğgeneral', value: 17 }, { name: '[OF-7] Tümgeneral', value: 18 },
    { name: '[OF-8] Korgeneral', value: 19 }, { name: '[OF-9] Orgeneral', value: 20 }
];

let aktiflikVerisi = new Map();
let izinVerisi = new Map();
let cookieStatus = { aktif: false, sonHata: null, sonKontrol: null };

function verileriYukle() {
    try {
        if (fs.existsSync('./aktiflik.json')) aktiflikVerisi = new Map(JSON.parse(fs.readFileSync('./aktiflik.json')));
        if (fs.existsSync('./izinler.json')) izinVerisi = new Map(JSON.parse(fs.readFileSync('./izinler.json')));
        if (fs.existsSync('./cookie.json')) {
            const data = JSON.parse(fs.readFileSync('./cookie.json'));
            AYARLAR.ROBLOX_COOKIE = data.cookie || AYARLAR.ROBLOX_COOKIE;
        }
        console.log('[Veri] Yüklendi');
    } catch (e) { console.log('[Veri] Yeni dosya oluşturulacak'); }
}

function verileriKaydet() {
    try {
        fs.writeFileSync('./aktiflik.json', JSON.stringify([...aktiflikVerisi]));
        fs.writeFileSync('./izinler.json', JSON.stringify([...izinVerisi]));
        fs.writeFileSync('./cookie.json', JSON.stringify({ cookie: AYARLAR.ROBLOX_COOKIE }));
    } catch (e) { console.error('[Veri] Kayıt hatası:', e.message); }
}

setInterval(verileriKaydet, 60000);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates]
});

async function robloxGiris(cookie = null) {
    try {
        const kullanilacakCookie = cookie || AYARLAR.ROBLOX_COOKIE;
        if (!kullanilacakCookie) throw new Error("ROBLOX_COOKIE tanımlanmamış!");
        if (!kullanilacakCookie.includes('_|WARNING:-DO-NOT-SHARE-THIS')) throw new Error("Cookie eksik! _|WARNING:-DO-NOT-SHARE-THIS. ile başlamalı");
        const currentUser = await noblox.setCookie(kullanilacakCookie);
        console.log(`[Roblox] ✅ Başarılı: ${currentUser.UserName}`);
        cookieStatus = { aktif: true, sonHata: null, sonKontrol: Date.now() };
        AYARLAR.ROBLOX_COOKIE = kullanilacakCookie;
        verileriKaydet();
        return { basarili: true, user: currentUser.UserName };
    } catch (err) {
        console.error("[Roblox] ❌ Giriş başarısız:", err.message);
        cookieStatus = { aktif: false, sonHata: err.message, sonKontrol: Date.now() };
        await cookieHatasiLogla(err.message);
        return { basarili: false, hata: err.message };
    }
}

async function cookieHatasiLogla(hata) {
    const kanal = client.channels.cache.get(AYARLAR.LOG_CHANNEL_ID);
    if (kanal) {
        const embed = new EmbedBuilder().setColor(0xFF0000).setTitle('🚨 KRİTİK HATA: Roblox Cookie Öldü!').setDescription('**Bot şu an rütbe değiştiremiyor.**').addFields({ name: 'Hata Detayı', value: `\`\`\`${hata}\`\`\`` },{ name: 'ÇÖZÜM', value: 'Bot sahibine DM attım. `/cookie-yenile` komutuyla yeni cookie girilecek.' }).setTimestamp();
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('cookie_yenile_btn').setLabel('Cookie Yenile').setStyle(ButtonStyle.Danger).setEmoji('🔑'));
        kanal.send({ embeds: [embed], components: [row] }).catch(() => {});
    }
    if (AYARLAR.BOT_SAHIBI_ID) {
        try {
            const owner = await client.users.fetch(AYARLAR.BOT_SAHIBI_ID);
            const dmEmbed = new EmbedBuilder().setColor(0xFF0000).setTitle('🚨 TSA Bot: Cookie Öldü!').setDescription('Rütbe işlemleri durdu!').addFields({ name: 'Hata', value: `\`\`\`${hata}\`\`\`` },{ name: 'Ne Yapmalı?', value: '1. Almanya VPN aç\n2. roblox.com → F12 → Application → Cookies\n3. `.ROBLOSECURITY` değerini kopyala\n4. Sunucuda `/cookie-yenile`' }).setTimestamp();
            owner.send({ embeds: [dmEmbed] }).catch(() => {});
        } catch (e) {}
    }
}

setInterval(async () => {
    if (!cookieStatus.aktif) await robloxGiris();
    else {
        try { await noblox.getCurrentUser(); cookieStatus.sonKontrol = Date.now(); }
        catch (e) { cookieStatus.aktif = false; await cookieHatasiLogla(e.message); }
    }
}, 15 * 60 * 1000);

const KOMUTLAR = [
    { name: 'ping', description: 'Botun gecikme süresini ve Roblox bağlantısını gösterir.' },
    { name: 'durum', description: 'TSA botunun sistem durumunu gösterir.' },
    { name: 'cookie-yenile', description: 'Roblox cookie yeniler - SADECE BOT SAHİBİ' },
    { name: 'cookie-durum', description: 'Cookie durumunu kontrol eder.' },
    { name: 'rütbe-değiştir', description: 'Bir personelin rütbesini manuel olarak değiştirir.', options: [{ name: 'roblox-isim', description: 'Roblox kullanıcı adı', type: ApplicationCommandOptionType.String, required: true },{ name: 'yeni-rütbe', description: 'Atanacak yeni rütbe', type: ApplicationCommandOptionType.Integer, required: true, autocomplete: true }] },
    { name: 'terfi', description: 'Bir personeli bir üst rütbeye terfi ettirir.', options: [{ name: 'roblox-isim', description: 'Roblox kullanıcı adı', type: ApplicationCommandOptionType.String, required: true }] },
    { name: 'tenzil', description: 'Bir personeli bir alt rütbeye tenzil eder.', options: [{ name: 'roblox-isim', description: 'Roblox kullanıcı adı', type: ApplicationCommandOptionType.String, required: true }] },
    { name: 'profile', description: 'Bir personelin profilini gösterir.', options: [{ name: 'roblox-isim', description: 'Roblox kullanıcı adı', type: ApplicationCommandOptionType.String, required: true }] },
    { name: 'branş-ekle', description: 'Bir personele branş ekler.', options: [{ name: 'roblox-isim', description: 'Roblox kullanıcı adı', type: ApplicationCommandOptionType.String, required: true },{ name: 'branş', description: 'Eklenecek branş', type: ApplicationCommandOptionType.String, required: true, choices: Object.keys(BRANSLAR).map(b => ({ name: b, value: b })) }] },
    { name: 'branş-çıkar', description: 'Bir personelden branş çıkarır.', options: [{ name: 'roblox-isim', description: 'Roblox kullanıcı adı', type: ApplicationCommandOptionType.String, required: true },{ name: 'branş', description: 'Çıkarılacak branş', type: ApplicationCommandOptionType.String, required: true, choices: Object.keys(BRANSLAR).map(b => ({ name: b, value: b })) }] },
    { name: 'branş-temizle', description: 'Bir personelin TÜM branşlarını siler.', options: [{ name: 'roblox-isim', description: 'Roblox kullanıcı adı', type: ApplicationCommandOptionType.String, required: true }] },
    { name: 'branşlar', description: 'Bir personelin branşlarını listeler.', options: [{ name: 'roblox-isim', description: 'Roblox kullanıcı adı', type: ApplicationCommandOptionType.String, required: true }] },
    { name: 'izin-al', description: 'İzin talebinde bulunursun.', options: [{ name: 'sebep', description: 'İzin sebebi', type: ApplicationCommandOptionType.String, required: true },{ name: 'süre', description: 'Kaç gün', type: ApplicationCommandOptionType.Integer, required: true }] },
    { name: 'izin-iptal', description: 'Aktif iznini iptal eder.' },
    { name: 'izinler', description: 'Tüm aktif izinleri listeler.' },
    { name: 'aktiflik', description: 'Aktiflik istatistiklerini gösterir.' },
    { name: 'aktiflik-sıralama', description: 'En aktif personelleri sıralar.' },
    { name: 'afk-liste', description: 'Aktif olmayan personelleri listeler.' },
    { name: 'ses-gir', description: 'Botu ses kanalına sokar.', options: [{ name: 'kanal', description: 'Ses kanalı', type: ApplicationCommandOptionType.Channel, required: true }] },
    { name: 'ses-çık', description: 'Botu ses kanalından çıkarır.' }
];

async function komutlariKaydet() {
    try {
        const rest = new REST({ version: '10' }).setToken(AYARLAR.DISCORD_TOKEN);
        await rest.put(Routes.applicationCommands(client.user.id), { body: KOMUTLAR });
        console.log('[Discord] ✅ 20 komut yüklendi');
    } catch (error) { console.error('[Discord] Komut yükleme hatası:', error); }
}

client.once('ready', () => {
    console.log(`[Discord] ${client.user.tag} olarak giriş yapıldı!`);
    client.user.setActivity('TSA - Turkish Special Army', { type: ActivityType.Watching });
    verileriYukle();
    robloxGiris();
    komutlariKaydet();
});

client.on('interactionCreate', async interaction => {
    if (interaction.isAutocomplete()) {
        if (interaction.commandName === 'rütbe-değiştir') {
            const focused = interaction.options.getFocused().toLowerCase();
            const filtered = TUM_RUTBELER.filter(r => r.name.toLowerCase().includes(focused));
            await interaction.respond(filtered.slice(0, 25));
        }
        return;
    }
    if (interaction.isButton()) {
        if (interaction.customId === 'cookie_yenile_btn') {
            if (interaction.user.id !== AYARLAR.BOT_SAHIBI_ID) return interaction.reply({ content: '❌ Bu butonu sadece bot sahibi kullanabilir!', ephemeral: true });
            const modal = new ModalBuilder().setCustomId('cookie_yenile_modal').setTitle('🔑 Roblox Cookie Yenile');
            const input = new TextInputBuilder().setCustomId('cookie_input').setLabel('Yeni .ROBLOSECURITY Cookie').setStyle(TextInputStyle.Paragraph).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await interaction.showModal(modal);
        }
        return;
    }
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'cookie_yenile_modal') {
            const yeniCookie = interaction.options.getTextInputValue('cookie_input').trim();
            await interaction.deferReply({ ephemeral: true });
            const sonuc = await robloxGiris(yeniCookie);
            if (sonuc.basarili) await interaction.editReply({ content: `✅ Cookie güncellendi! Giriş yapıldı: **${sonuc.user}**` });
            else await interaction.editReply({ content: `❌ Cookie geçersiz!\n\`\`\`${sonuc.hata}\`\`\`` });
        }
        return;
    }
    if (!interaction.isChatInputCommand()) return;
    const { commandName, member, guild } = interaction;
    await interaction.deferReply();
    try {
        if (['rütbe-değiştir','terfi','tenzil','branş-ekle','branş-çıkar','branş-temizle'].includes(commandName)) {
            if (!member.permissions.has(PermissionFlagsBits.ManageRoles) && !member.roles.cache.has(AYARLAR.YETKILI_ROL_ID)) return interaction.editReply({ content: '❌ Bu komutu kullanamazsın!' });
        }
        if (['izinler','afk-liste'].includes(commandName)) {
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.editReply({ content: '❌ Yönetici yetkisi gerekli!' });
        }
        if (!cookieStatus.aktif && ['rütbe-değiştir','terfi','tenzil','branş-ekle','branş-çıkar','branş-temizle','profile','branşlar'].includes(commandName)) return interaction.editReply({ content: '❌ Roblox bağlantısı kopuk! `/cookie-durum` ile kontrol et.' });
        const logKanal = client.channels.cache.get(AYARLAR.LOG_CHANNEL_ID);
        if (commandName === 'ping') {
            const embed = new EmbedBuilder().setColor(cookieStatus.aktif ? 0x00FF00 : 0xFF0000).setTitle('🏓 Pong!').addFields({ name: 'Bot Gecikmesi', value: `${Date.now() - interaction.createdTimestamp}ms`, inline: true },{ name: 'API Gecikmesi', value: `${Math.round(client.ws.ping)}ms`, inline: true },{ name: 'Roblox', value: cookieStatus.aktif ? '✅ Bağlı' : '❌ Kopuk', inline: true });
            await interaction.editReply({ embeds: [embed] });
        } else if (commandName === 'durum') {
            const embed = new EmbedBuilder().setColor(0x0099FF).setTitle('🤖 TSA Bot Sistem Durumu').addFields({ name: 'Discord', value: '✅ Online', inline: true },{ name: 'Roblox API', value: cookieStatus.aktif ? '✅ Bağlı' : '❌ Kopuk', inline: true },{ name: 'Son Kontrol', value: cookieStatus.sonKontrol ? `<t:${Math.floor(cookieStatus.sonKontrol/1000)}:R>` : 'Yok', inline: true },{ name: 'Kayıtlı Aktiflik', value: `${aktiflikVerisi.size} kişi`, inline: true },{ name: 'Aktif İzin', value: `${izinVerisi.size} kişi`, inline: true }).setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        } else if (commandName === 'cookie-yenile') {
            if (interaction.user.id !== AYARLAR.BOT_SAHIBI_ID) return interaction.editReply({ content: '❌ Sadece bot sahibi kullanabilir!' });
            const modal = new ModalBuilder().setCustomId('cookie_yenile_modal').setTitle('🔑 Roblox Cookie Yenile');
            const input = new TextInputBuilder().setCustomId('cookie_input').setLabel('Yeni .ROBLOSECURITY Cookie').setStyle(TextInputStyle.Paragraph).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await interaction.showModal(modal);
        } else if (commandName === 'cookie-durum') {
            const embed = new EmbedBuilder().setColor(cookieStatus.aktif ? 0x00FF00 : 0xFF0000).setTitle('🍪 Cookie Durumu').addFields({ name: 'Durum', value: cookieStatus.aktif ? '✅ Aktif' : '❌ Ölü', inline: true },{ name: 'Son Kontrol', value: cookieStatus.sonKontrol ? `<t:${Math.floor(cookieStatus.sonKontrol/1000)}:R>` : 'Hiç', inline: true });
            if (cookieStatus.sonHata) embed.addFields({ name: 'Son Hata', value: `\`\`\`${cookieStatus.sonHata}\`\`\``, inline: false });
            await interaction.editReply({ embeds: [embed] });
        } else if (commandName === 'rütbe-değiştir') {
            const robloxIsim = interaction.options.getString('roblox-isim');
            const yeniRutbe = interaction.options.getInteger('yeni-rütbe');
            const userId = await noblox.getIdFromUsername(robloxIsim);
            const eskiRutbeIsim = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);
            await noblox.setRank(AYARLAR.GROUP_ID, userId, yeniRutbe);
            const yeniRutbeIsim = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);
            const embed = new EmbedBuilder().setColor(0x00FF00).setTitle('✅ Rütbe Değiştirildi').addFields({ name: 'Personel', value: robloxIsim, inline: true },{ name: 'Eski Rütbe', value: eskiRutbeIsim, inline: true },{ name: 'Yeni Rütbe', value: yeniRutbeIsim, inline: true },{ name: 'Yetkili', value: member.user.tag, inline: false }).setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            if (logKanal) logKanal.send({ embeds: [embed] });
        } else if (commandName === 'terfi') {
            const robloxIsim = interaction.options.getString('roblox-isim');
            const userId = await noblox.getIdFromUsername(robloxIsim);
            const eskiRutbeIsim = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);
            await noblox.promote(AYARLAR.GROUP_ID, userId);
            const yeniRutbeIsim = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);
            const embed = new EmbedBuilder().setColor(0x00FF00).setTitle('⬆️ Terfi Edildi').addFields({ name: 'Personel', value: robloxIsim, inline: true },{ name: 'Eski Rütbe', value: eskiRutbeIsim, inline: true },{ name: 'Yeni Rütbe', value: yeniRutbeIsim, inline: true },{ name: 'Yetkili', value: member.user.tag, inline: false }).setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            if (logKanal) logKanal.send({ embeds: [embed] });
        } else if (commandName === 'tenzil') {
            const robloxIsim = interaction.options.getString('roblox-isim');
            const userId = await noblox.getIdFromUsername(robloxIsim);
            const eskiRutbeIsim = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);
            await noblox.demote(AYARLAR.GROUP_ID, userId);
            const yeniRutbeIsim = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);
            const embed = new EmbedBuilder().setColor(0xFF6600).setTitle('⬇️ Tenzil Edildi').addFields({ name: 'Personel', value: robloxIsim, inline: true },{ name: 'Eski Rütbe', value: eskiRutbeIsim, inline: true },{ name: 'Yeni Rütbe', value: yeniRutbeIsim, inline: true },{ name: 'Yetkili', value: member.user.tag, inline: false }).setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            if (logKanal) logKanal.send({ embeds: [embed] });
        } else if (commandName === 'profile') {
            const robloxIsim = interaction.options.getString('roblox-isim');
            const userId = await noblox.getIdFromUsername(robloxIsim);
            const [playerInfo, rutbe, gruplar, branslar] = await Promise.all([noblox.getPlayerInfo(userId), noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId), noblox.getGroups(userId), noblox.getPlayerGroups(userId)]);
            const userBranslar = branslar.filter(g => Object.values(BRANSLAR).includes(g.Id)).map(g => g.Name);
            const embed = new EmbedBuilder().setColor(0x0099FF).setTitle(`👤 ${playerInfo.username} Profili`).setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png`).addFields({ name: 'TSA Rütbesi', value: rutbe, inline: true },{ name: 'Hesap Yaşı', value: `${Math.floor(playerInfo.age/365)} yıl`, inline: true },{ name: 'Branşlar', value: userBranslar.length > 0 ? userBranslar.join('\n') : 'Yok', inline: false });
            await interaction.editReply({ embeds: [embed] });
        } else if (commandName === 'branş-ekle') {
            const robloxIsim = interaction.options.getString('roblox-isim');
            const bransAdi = interaction.options.getString('branş');
            const userId = await noblox.getIdFromUsername(robloxIsim);
            await noblox.setRank(BRANSLAR[bransAdi], userId, 1);
            const embed = new EmbedBuilder().setColor(0x00FF00).setTitle('✅ Branş Eklendi').setDescription(`**${robloxIsim}** kullanıcısına **${bransAdi}** branşı eklendi.`).setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            if (logKanal) logKanal.send({ embeds: [embed] });
        } else if (commandName === 'branş-çıkar') {
            const robloxIsim = interaction.options.getString('roblox-isim');
            const bransAdi = interaction.options.getString('branş');
            const userId = await noblox.getIdFromUsername(robloxIsim);
            await noblox.setRank(BRANSLAR[bransAdi], userId, 0);
            const embed = new EmbedBuilder().setColor(0xFF0000).setTitle('❌ Branş Çıkarıldı').setDescription(`**${robloxIsim}** kullanıcısından **${bransAdi}** branşı çıkarıldı.`).setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            if (logKanal) logKanal.send({ embeds: [embed] });
        } else if (commandName === 'branş-temizle') {
            const robloxIsim = interaction.options.getString('roblox-isim');
            const userId = await noblox.getIdFromUsername(robloxIsim);
            for (const bransId of Object.values(BRANSLAR)) {
                try { await noblox.setRank(bransId, userId, 0); } catch (e) {}
            }
            const embed = new EmbedBuilder().setColor(0xFF0000).setTitle('🗑️ Tüm Branşlar Temizlendi').setDescription(`**${robloxIsim}** kullanıcısının tüm branşları silindi.`).setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            if (logKanal) logKanal.send({ embeds: [embed] });
        } else if (commandName === 'branşlar') {
            const robloxIsim = interaction.options.getString('roblox-isim');
            const userId = await noblox.getIdFromUsername(robloxIsim);
            const gruplar = await noblox.getPlayerGroups(userId);
            const userBranslar = gruplar.filter(g => Object.values(BRANSLAR).includes(g.Id));
            const embed = new EmbedBuilder().setColor(0x0099FF).setTitle(`🎖️ ${robloxIsim} Branşları`).setDescription(userBranslar.length > 0 ? userBranslar.map(g => `• ${g.Name} - ${g.Role}`).join('\n') : 'Hiçbir branşı yok.');
            await interaction.editReply({ embeds: [embed] });
        } else if (commandName === 'izin-al') {
            const sebep = interaction.options.getString('sebep');
            const sure = interaction.options.getInteger('süre');
            if (izinVerisi.has(member.id)) return interaction.editReply({ content: '❌ Zaten aktif iznin var!' });
            const bitis = Date.now() + (sure * 24 * 60 * 60 * 1000);
            izinVerisi.set(member.id, { sebep, bitis, baslangic: Date.now() });
            if (AYARLAR.IZIN_ROL_ID !== "0000000000000000000") {
                const rol = guild.roles.cache.get(AYARLAR.IZIN_ROL_ID);
                if (rol) await member.roles.add(rol);
            }
            const embed = new EmbedBuilder().setColor(0x00FF00).setTitle('✅ İzin Talebi Onaylandı').addFields({ name: 'Personel', value: member.user.tag, inline: true },{ name: 'Süre', value: `${sure} gün`, inline: true },{ name: 'Bitiş', value: `<t:${Math.floor(bitis/1000)}:R>`, inline: true },{ name: 'Sebep', value: sebep, inline: false }).setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            if (logKanal) logKanal.send({ embeds: [embed] });
        } else if (commandName === 'izin-iptal') {
            if (!izinVerisi.has(member.id)) return interaction.editReply({ content: '❌ Aktif iznin yok!' });
            izinVerisi.delete(member.id);
            if (AYARLAR.IZIN_ROL_ID !== "0000000000000000000") {
                const rol = guild.roles.cache.get(AYARLAR.IZIN_ROL_ID);
                if (rol) await member.roles.remove(rol);
            }
            await interaction.editReply({ content: '✅ İznin iptal edildi. Göreve dönebilirsin!' });
        } else if (commandName === 'izinler') {
            if (izinVerisi.size === 0) return interaction.editReply({ content: '📋 Aktif izin yok.' });
            const embed = new EmbedBuilder().setColor(0x0099FF).setTitle('📋 Aktif İzinler').setDescription([...izinVerisi.entries()].map(([id, data]) => `<@${id}> - ${data.sebep} - <t:${Math.floor(data.bitis/1000)}:R>`).join('\n'));
            await interaction.editReply({ embeds: [embed] });
        } else if (commandName === 'aktiflik') {
            const userData = aktiflikVerisi.get(member.id) || { mesaj: 0, ses: 0 };
            const embed = new EmbedBuilder().setColor(0x0099FF).setTitle('📊 Aktiflik İstatistiklerin').addFields({ name: 'Mesaj Sayısı', value: `${userData.mesaj}`, inline: true },{ name: 'Ses Süresi', value: `${Math.floor(userData.ses/60)} dakika`, inline: true });
            await interaction.editReply({ embeds: [embed] });
        } else if (commandName === 'aktiflik-sıralama') {
            const sirali = [...aktiflikVerisi.entries()].sort((a,b) => (b[1].mesaj + b[1].ses) - (a[1].mesaj + a[1].ses)).slice(0, 10);
            const embed = new EmbedBuilder().setColor(0xFFD700).setTitle('🏆 Aktiflik Sıralaması').setDescription(sirali.map((e,i) => `${i+1}. <@${e[0]}> - ${e[1].mesaj} mesaj, ${Math.floor(e[1].ses/60)}dk ses`).join('\n'));
            await interaction.editReply({ embeds: [embed] });
        } else if (commandName === 'afk-liste') {
            const tumUyeler = await guild.members.fetch();
            const afkUyeler = tumUyeler.filter(u => !u.user.bot && !aktiflikVerisi.has(u.id));
            const embed = new EmbedBuilder().setColor(0xFF0000).setTitle('😴 AFK Personel Listesi').setDescription(afkUyeler.size > 0 ? afkUyeler.map(u => `• ${u.user.tag}`).slice(0, 20).join('\n') : 'Herkes aktif!');
            await interaction.editReply({ embeds: [embed] });
        } else if (commandName === 'ses-gir') {
            const kanal = interaction.options.getChannel('kanal');
            if (kanal.type !== 2) return interaction.editReply({ content: '❌ Ses kanalı seçmelisin!' });
            joinVoiceChannel({ channelId: kanal.id, guildId: guild.id, adapterCreator: guild.voiceAdapterCreator });
            await interaction.editReply({ content: `✅ ${kanal.name} kanalına bağlandım!` });
        } else if (commandName === 'ses-çık') {
            const baglanti = getVoiceConnection(guild.id);
            if (!baglanti) return interaction.editReply({ content: '❌ Ses kanalında değilim!' });
            baglanti.destroy();
            await interaction.editReply({ content: '✅ Ses kanalından ayrıldım!' });
        }
    } catch (error) {
        console.error('[Komut Hatası]', error);
        await interaction.editReply({ content: `❌ Hata oluştu!\n\`\`\`${error.message}\`\`\`` }).catch(() => {});
    }
});

client.on('messageCreate', message => {
    if (message.author.bot) return;
    const data = aktiflikVerisi.get(message.author.id) || { mesaj: 0, ses: 0 };
    data.mesaj++;
    aktiflikVerisi.set(message.author.id, data);
});

client.on('voiceStateUpdate', (oldState, newState) => {
    if (!oldState.channelId && newState.channelId) {
        const data = aktiflikVerisi.get(newState.id) || { mesaj: 0, ses: 0, giris: null };
        data.giris = Date.now();
        aktiflikVerisi.set(newState.id, data);
    }
    if (oldState.channelId && !newState.channelId) {
        const data = aktiflikVerisi.get(oldState.id);
        if (data && data.giris) {
            data.ses += Math.floor((Date.now() - data.giris) / 1000);
            data.giris = null;
            aktiflikVerisi.set(oldState.id, data);
        }
    }
});

setInterval(() => {
    const simdi = Date.now();
    for (const [userId, data] of izinVerisi.entries()) {
        if (simdi >= data.bitis) {
            izinVerisi.delete(userId);
            const guild = client.guilds.cache.first();
            if (guild && AYARLAR.IZIN_ROL_ID !== "0000000000000000000") {
                const member = guild.members.cache.get(userId);
                const rol = guild.roles.cache.get(AYARLAR.IZIN_ROL_ID);
                if (member && rol) member.roles.remove(rol).catch(() => {});
            }
            const logKanal = client.channels.cache.get(AYARLAR.LOG_CHANNEL_ID);
            if (logKanal) logKanal.send({ content: `⏰ <@${userId}> kullanıcısının izni bitti!` });
        }
    }
}, 60000);

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html><html><head><title>TSA Bot</title></head><body style="background:#2c2f33;color:#fff;font-family:Arial;text-align:center;padding:50px;"><h1>🤖 TSA Bot Aktif</h1><p>Bot: ${client.user ? client.user.tag : 'Başlatılıyor...'}</p><p>Roblox: ${cookieStatus.aktif ? '✅ Bağlı' : '❌ Kopuk'}</p></body></html>`);
});

server.listen(AYARLAR.PORT, () => {
    console.log(`[HTTP] Sunucu ${AYARLAR.PORT} portunda çalışıyor`);
});

client.login(AYARLAR.DISCORD_TOKEN);
