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
    ActivityType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const noblox = require('noblox.js');
const http = require('http');
const fs = require('fs');

// --- AYARLAR ---
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
    BOT_SAHIBI_ID: process.env.BOT_SAHIBI_ID || "" // Cookie yenileme için
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

// --- VERİTABANI ---
let aktiflikVerisi = new Map();
let izinVerisi = new Map();
let cookieStatus = { aktif: false, sonHata: null, sonKontrol: null };

function verileriYukle() {
    try {
        if (fs.existsSync('./aktiflik.json')) {
            aktiflikVerisi = new Map(JSON.parse(fs.readFileSync('./aktiflik.json')));
        }
        if (fs.existsSync('./izinler.json')) {
            izinVerisi = new Map(JSON.parse(fs.readFileSync('./izinler.json')));
        }
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
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// --- COOKIE YÖNETİM SİSTEMİ ---
async function robloxGiris(cookie = null) {
    try {
        const kullanilacakCookie = cookie || AYARLAR.ROBLOX_COOKIE;
        if (!kullanilacakCookie) throw new Error("ROBLOX_COOKIE tanımlanmamış!");
        if (!kullanilacakCookie.includes('_|WARNING:-DO-NOT-SHARE-THIS')) {
            throw new Error("Cookie eksik! _|WARNING:-DO-NOT-SHARE-THIS. ile başlamalı");
        }
        const currentUser = await noblox.setCookie(kullanilacakCookie);
        console.log(`[Roblox] ✅ Başarılı: ${currentUser.UserName} olarak giriş yapıldı.`);
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
        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🚨 KRİTİK HATA: Roblox Cookie Öldü!')
            .setDescription('**Bot şu an rütbe değiştiremiyor, terfi/tenzil yapamıyor.**')
            .addFields(
                { name: 'Hata Detayı', value: `\`\`\`${hata}\`\`\``, inline: false },
                { name: 'ÇÖZÜM', value: 'Bot sahibine DM attım. `/cookie-yenile` komutuyla yeni cookie girilecek.', inline: false },
                { name: 'Durum', value: 'Bot online ama Roblox işlemleri durdu.', inline: false }
            )
            .setTimestamp();
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('cookie_yenile_btn')
                .setLabel('Cookie Yenile')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔑')
        );
        
        kanal.send({ embeds: [embed], components: [row] }).catch(() => {});
    }
    
    // Bot sahibine DM
    if (AYARLAR.BOT_SAHIBI_ID) {
        try {
            const owner = await client.users.fetch(AYARLAR.BOT_SAHIBI_ID);
            const dmEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('🚨 TSA Bot: Cookie Öldü!')
                .setDescription('Rütbe işlemleri durdu komutanım!')
                .addFields(
                    { name: 'Hata', value: `\`\`\`${hata}\`\`\`` },
                    { name: 'Ne Yapmalı?', value: '1. Almanya VPN aç\n2. roblox.com → F12 → Application → Cookies\n3. `.ROBLOSECURITY` değerini kopyala\n4. Sunucuda `/cookie-yenile` komutunu kullan' }
                )
                .setTimestamp();
            owner.send({ embeds: [dmEmbed] }).catch(() => {});
        } catch (e) {}
    }
}

setInterval(async () => {
    if (!cookieStatus.aktif) {
        await robloxGiris();
    } else {
        try {
            await noblox.getCurrentUser();
            cookieStatus.sonKontrol = Date.now();
        } catch (e) {
            cookieStatus.aktif = false;
            await cookieHatasiLogla(e.message);
        }
    }
}, 15 * 60 * 1000);

// --- YARDIMCI FONKSİYONLAR ---
function parseRobloxDate(robloxDate) {
    if (!robloxDate) return 'Bilinmiyor';
    const date = new Date(robloxDate);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

async function handleInteractionError(interaction, error) {
    console.error(`[Hata] Komut: ${interaction.commandName || 'Bilinmeyen'} | Hata: ${error.message}`);
    const errorMessage = { content: '❌ Komut çalıştırılırken bir hata oluştu.', ephemeral: true };
    try {
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
        } else {
            await interaction.reply(errorMessage);
        }
    } catch (e) {}
}

async function logGonder(embed) {
    try {
        const kanal = await client.channels.fetch(AYARLAR.LOG_CHANNEL_ID);
        if (kanal) await kanal.send({ embeds: [embed] });
    } catch (error) { console.error("Log gönderilemedi:", error.message); }
}

// --- BOT BAŞLANGICI ---
client.once('ready', async () => {
    console.log(`[Discord] ${client.user.tag} göreve hazır!`);
    await robloxGiris();
    verileriYukle();
    
    const commands = [
        {
            name: 'rütbe-değiştir',
            description: 'Bir personelin rütbesini değiştirir.',
            default_member_permissions: PermissionFlagsBits.ManageRoles.toString(),
            options: [
                { name: 'roblox-isim', description: 'Rütbesi değiştirilecek kişi', type: ApplicationCommandOptionType.String, required: true },
                { name: 'yeni-rütbe', description: 'Yeni rütbe', type: ApplicationCommandOptionType.Integer, required: true, autocomplete: true },
                { name: 'sebep', description: 'Rütbe değişim sebebi', type: ApplicationCommandOptionType.String, required: false }
            ]
        },
        {
            name: 'terfi',
            description: 'Bir personeli bir üst rütbeye terfi ettirir.',
            default_member_permissions: PermissionFlagsBits.ManageRoles.toString(),
            options: [{ name: 'roblox-isim', description: 'Terfi edecek kişi', type: ApplicationCommandOptionType.String, required: true }]
        },
        {
            name: 'tenzil',
            description: 'Bir personeli bir alt rütbeye tenzil eder.',
            default_member_permissions: PermissionFlagsBits.ManageRoles.toString(),
            options: [{ name: 'roblox-isim', description: 'Tenzil edilecek kişi', type: ApplicationCommandOptionType.String, required: true }]
        },
        {
            name: 'profile',
            description: 'Bir personelin askeri künyesini gösterir.',
            options: [{ name: 'roblox-isim', description: 'Künyesi gösterilecek kişi', type: ApplicationCommandOptionType.String, required: true }]
        },
        {
            name: 'cookie-yenile',
            description: 'Bot sahibine özel: Roblox cookie yeniler.',
            options: [{ name: 'yeni-cookie', description: 'Yeni .ROBLOSECURITY cookie değeri', type: ApplicationCommandOptionType.String, required: true }]
        },
        {
            name: 'cookie-durum',
            description: 'Roblox cookie durumunu gösterir.',
            default_member_permissions: PermissionFlagsBits.ManageRoles.toString()
        },
        {
            name: 'izin-al',
            description: 'İzin alırsınız. İzin süresince aktiflik takibinden muaf olursunuz.',
            options: [
                { name: 'roblox-isim', description: 'Roblox kullanıcı adınız', type: ApplicationCommandOptionType.String, required: true },
                { name: 'süre', description: 'İzin süresi (gün)', type: ApplicationCommandOptionType.Integer, required: true, min_value: 1, max_value: 30 },
                { name: 'sebep', description: 'İzin sebebi', type: ApplicationCommandOptionType.String, required: true }
            ]
        },
        {
            name: 'izin-iptal',
            description: 'Aktif izninizi iptal eder.',
            options: [{ name: 'roblox-isim', description: 'Roblox kullanıcı adınız', type: ApplicationCommandOptionType.String, required: true }]
        },
        {
            name: 'izinler',
            description: 'Aktif izinli personelleri listeler.',
            default_member_permissions: PermissionFlagsBits.ManageRoles.toString()
        },
        {
            name: 'ses-gir',
            description: 'Botu bulunduğunuz ses kanalına sokar.',
            default_member_permissions: PermissionFlagsBits.ManageRoles.toString()
        },
        {
            name: 'ses-çık',
            description: 'Botu ses kanalından çıkarır.',
            default_member_permissions: PermissionFlagsBits.ManageRoles.toString()
        },
        {
            name: 'ping',
            description: 'Botun gecikme süresini gösterir.'
        },
        {
            name: 'durum',
            description: 'Botun sistem durumunu gösterir.'
        }
    ];
    
    const rest = new REST({ version: '10' }).setToken(AYARLAR.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('[Discord] Komutlar başarıyla yüklendi.');
    } catch (error) { console.error('[Discord] Komut yükleme hatası:', error); }
    
    client.user.setActivity('TSA | /rütbe-değiştir', { type: ActivityType.Watching });
});

// --- INTERACTION HANDLER ---
client.on('interactionCreate', async interaction => {
    // Autocomplete
    if (interaction.isAutocomplete()) {
        if (interaction.commandName === 'rütbe-değiştir') {
            const focusedValue = interaction.options.getFocused().toLowerCase();
            const filtered = TUM_RUTBELER.filter(r => r.name.toLowerCase().includes(focusedValue));
            await interaction.respond(filtered.slice(0, 25));
        }
        return;
    }
    
    // Button
    if (interaction.isButton()) {
        if (interaction.customId === 'cookie_yenile_btn') {
            if (interaction.user.id !== AYARLAR.BOT_SAHIBI_ID) {
                return interaction.reply({ content: '❌ Bu butonu sadece bot sahibi kullanabilir.', ephemeral: true });
            }
            const modal = new ModalBuilder()
                .setCustomId('cookie_modal')
                .setTitle('Cookie Yenile');
            const cookieInput = new TextInputBuilder()
                .setCustomId('cookie_input')
                .setLabel('Yeni .ROBLOSECURITY Cookie')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setPlaceholder('_|WARNING:-DO-NOT-SHARE-THIS...');
            const row = new ActionRowBuilder().addComponents(cookieInput);
            modal.addComponents(row);
            await interaction.showModal(modal);
        }
        return;
    }
    
    // Modal Submit
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'cookie_modal') {
            await interaction.deferReply({ ephemeral: true });
            const yeniCookie = interaction.fields.getTextInputValue('cookie_input');
            const sonuc = await robloxGiris(yeniCookie);
            if (sonuc.basarili) {
                await interaction.editReply(`✅ Cookie yenilendi! Giriş yapıldı: **${sonuc.user}**`);
                const logEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ Cookie Yenilendi')
                    .setDescription(`Bot sahibi ${interaction.user.tag} tarafından cookie yenilendi.`)
                    .addFields({ name: 'Yeni Hesap', value: sonuc.user })
                    .setTimestamp();
                await logGonder(logEmbed);
            } else {
                await interaction.editReply(`❌ Cookie geçersiz: \`\`\`${sonuc.hata}\`\`\``);
            }
        }
        return;
    }
    
    if (!interaction.isChatInputCommand()) return;
    const { commandName } = interaction;

    try {
        await interaction.deferReply({ ephemeral: commandName !== 'profile' });

        const cookieGerekli = ['rütbe-değiştir', 'terfi', 'tenzil', 'profile'];
        if (cookieGerekli.includes(commandName) && !cookieStatus.aktif) {
            return interaction.editReply('❌ **Roblox Cookie Ölü!** Bot sahibine DM attım. `/cookie-yenile` ile güncelleyin.');
        }

        if (commandName === 'cookie-yenile') {
            if (interaction.user.id !== AYARLAR.BOT_SAHIBI_ID) {
                return interaction.editReply('❌ Bu komutu sadece bot sahibi kullanabilir.');
            }
            const yeniCookie = interaction.options.getString('yeni-cookie');
            const sonuc = await robloxGiris(yeniCookie);
            if (sonuc.basarili) {
                await interaction.editReply(`✅ Cookie yenilendi! Giriş yapıldı: **${sonuc.user}**`);
            } else {
                await interaction.editReply(`❌ Cookie geçersiz: \`\`\`${sonuc.hata}\`\`\``);
            }
        }
        
        else if (commandName === 'cookie-durum') {
            const embed = new EmbedBuilder()
                .setColor(cookieStatus.aktif ? 0x00FF00 : 0xFF0000)
                .setTitle('🔑 Cookie Durumu')
                .addFields(
                    { name: 'Durum', value: cookieStatus.aktif ? '✅ Aktif' : '❌ Ölü', inline: true },
                    { name: 'Son Kontrol', value: cookieStatus.sonKontrol ? `<t:${Math.floor(cookieStatus.sonKontrol/1000)}:R>` : 'Hiç', inline: true },
                    { name: 'Son Hata', value: cookieStatus.sonHata ? `\`\`\`${cookieStatus.sonHata}\`\`\`` : 'Yok' }
                )
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
        
        else if (commandName === 'rütbe-değiştir') {
            const robloxIsim = interaction.options.getString('roblox-isim');
            const yeniRutbeRank = interaction.options.getInteger('yeni-rütbe');
            const sebep = interaction.options.getString('sebep') || 'Belirtilmedi';
            
            const userId = await noblox.getIdFromUsername(robloxIsim);
            const eskiRutbeIsim = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);
            
            await noblox.setRank(AYARLAR.GROUP_ID, userId, yeniRutbeRank);
            const yeniRutbeIsim = TUM_RUTBELER.find(r => r.value === yeniRutbeRank).name;
            
            await interaction.editReply(`✅ **${robloxIsim}** başarıyla **${yeniRutbeIsim}** rütbesine atandı.`);
            
            const logEmbed = new EmbedBuilder()
                .setColor(0x00FF00).setTitle('Rütbe Değişimi')
                .addFields(
                    { name: 'Personel', value: robloxIsim, inline: true },
                    { name: 'Yetkili', value: interaction.user.tag, inline: true },
                    { name: 'Eski Rütbe', value: eskiRutbeIsim, inline: false },
                    { name: 'Yeni Rütbe', value: yeniRutbeIsim, inline: false },
                    { name: 'Sebep', value: sebep }
                ).setTimestamp();
            await logGonder(logEmbed);
        }
        
        else if (commandName === 'terfi') {
            const robloxIsim = interaction.options.getString('roblox-isim');
            const userId = await noblox.getIdFromUsername(robloxIsim);
            const eskiRutbeIsim = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);
            
            await noblox.promote(AYARLAR.GROUP_ID, userId);
            const yeniRutbeIsim = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);
            
            await interaction.editReply(`⬆️ **${robloxIsim}** terfi etti: **${eskiRutbeIsim}** → **${yeniRutbeIsim}**`);
        }
        
        else if (commandName === 'tenzil') {
            const robloxIsim = interaction.options.getString('roblox-isim');
            const userId = await noblox.getIdFromUsername(robloxIsim);
            const eskiRutbeIsim = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);
            
            await noblox.demote(AYARLAR.GROUP_ID, userId);
            const yeniRutbeIsim = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);
            
            await interaction.editReply(`⬇️ **${robloxIsim}** tenzil edildi: **${eskiRutbeIsim}** → **${yeniRutbeIsim}**`);
        }
        
        else if (commandName === 'profile') {
            const robloxIsim = interaction.options.getString('roblox-isim');
            const userId = await noblox.getIdFromUsername(robloxIsim);
            const [playerInfo, rankName, avatarUrl] = await Promise.all([
                noblox.getPlayerInfo(userId),
                noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId),
                noblox.getPlayerThumbnail(userId, 420, 'png', true, 'headshot')
            ]);
            
            const embed = new EmbedBuilder()
                .setColor(0x0099FF).setTitle(`Askeri Künye: ${playerInfo.username}`)
                .setThumbnail(avatarUrl[0]?.imageUrl)
                .addFields(
                    { name: 'Rütbe', value: rankName, inline: true },
                    { name: 'Katılım Tarihi', value: parseRobloxDate(playerInfo.joinDate), inline: true },
                    { name: 'Roblox ID', value: userId.toString(), inline: true }
                ).setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
        
        else if (commandName === 'ses-gir') {
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const voiceChannel = member.voice.channel;
            if (!voiceChannel) {
                return interaction.editReply('❌ Bir ses kanalında olmalısın komutanım.');
            }
            joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: interaction.guild.id,
                adapterCreator: interaction.guild.voiceAdapterCreator,
            });
            await interaction.editReply(`✅ **${voiceChannel.name}** kanalına katıldım.`);
        }
        
        else if (commandName === 'ses-çık') {
            const connection = getVoiceConnection(interaction.guild.id);
            if (!connection) {
                return interaction.editReply('❌ Zaten bir ses kanalında değilim.');
            }
            connection.destroy();
            await interaction.editReply('✅ Ses kanalından ayrıldım.');
        }
        
        else if (commandName === 'ping') {
            await interaction.editReply(`🏓 Pong! ${client.ws.ping}ms`);
        }
        
        else if (commandName === 'durum') {
            const embed = new EmbedBuilder()
                .setColor(cookieStatus.aktif ? 0x00FF00 : 0xFF0000)
                .setTitle('🤖 Bot Durumu')
                .addFields(
                    { name: 'Discord', value: '✅ Online', inline: true },
                    { name: 'Roblox', value: cookieStatus.aktif ? '✅ Bağlı' : '❌ Cookie Ölü', inline: true },
                    { name: 'Ping', value: `${client.ws.ping}ms`, inline: true },
                    { name: 'Aktif Kayıt', value: `${aktiflikVerisi.size} kişi`, inline: true },
                    { name: 'İzinli', value: `${izinVerisi.size} kişi`, inline: true }
                )
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
        
    } catch (error) {
        await handleInteractionError(interaction, error);
    }
});

// --- WEB SUNUCU ---
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('TSA Bot Aktif');
});
server.listen(AYARLAR.PORT);

client.login(AYARLAR.DISCORD_TOKEN);
