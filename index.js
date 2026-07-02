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
let cookieStatus = { aktif: false, sonHata: null };

function verileriYukle() {
    try {
        if (fs.existsSync('./aktiflik.json')) {
            aktiflikVerisi = new Map(JSON.parse(fs.readFileSync('./aktiflik.json')));
        }
        if (fs.existsSync('./izinler.json')) {
            izinVerisi = new Map(JSON.parse(fs.readFileSync('./izinler.json')));
        }
        console.log('[Veri] Yüklendi');
    } catch (e) { console.log('[Veri] Yeni dosya oluşturulacak'); }
}

function verileriKaydet() {
    try {
        fs.writeFileSync('./aktiflik.json', JSON.stringify([...aktiflikVerisi]));
        fs.writeFileSync('./izinler.json', JSON.stringify([...izinVerisi]));
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

// --- COOKIE KONTROL SİSTEMİ ---
async function robloxGiris() {
    try {
        if (!AYARLAR.ROBLOX_COOKIE) throw new Error("ROBLOX_COOKIE tanımlanmamış!");
        if (!AYARLAR.ROBLOX_COOKIE.includes('_|WARNING:-DO-NOT-SHARE-THIS')) {
            throw new Error("Cookie eksik! _|WARNING:-DO-NOT-SHARE-THIS. ile başlamalı");
        }
        const currentUser = await noblox.setCookie(AYARLAR.ROBLOX_COOKIE);
        console.log(`[Roblox] ✅ Başarılı: ${currentUser.UserName} olarak giriş yapıldı.`);
        cookieStatus = { aktif: true, sonHata: null };
        return true;
    } catch (err) {
        console.error("[Roblox] ❌ Giriş başarısız:", err.message);
        cookieStatus = { aktif: false, sonHata: err.message };
        await cookieHatasiLogla(err.message);
        return false;
    }
}

async function cookieHatasiLogla(hata) {
    const kanal = client.channels.cache.get(AYARLAR.LOG_CHANNEL_ID);
    if (!kanal) return;
    
    const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('🚨 KRİTİK HATA: Roblox Cookie Öldü!')
        .setDescription('**Bot şu an rütbe değiştiremiyor, terfi/tenzil yapamıyor.**')
        .addFields(
            { name: 'Hata Detayı', value: `\`\`\`${hata}\`\`\``, inline: false },
            { name: 'ACİL ÇÖZÜM', value: '1. Bot hesabı 2FA Authenticator **KAPAT**\n2. Account PIN **KAPAT**\n3. **Almanya VPN** → roblox.com → F12\n4. Application → Cookies → `.ROBLOSECURITY` kopyala\n5. Render `ROBLOX_COOKIE` güncelle → Deploy', inline: false },
            { name: 'Durum', value: 'Bot online ama Roblox işlemleri durdu.', inline: false }
        )
        .setTimestamp()
        .setFooter({ text: 'TSA Karargah Bot | Cookie Sistemi' });
    
    kanal.send({ embeds: [embed] }).catch(() => {});
    
    // Bot sahibine DM at
    try {
        const owner = await client.users.fetch(client.application.owner.id);
        owner.send(`🚨 **TSA Bot Uyarı:** Roblox cookie öldü komutanım! Rütbe işlemleri durdu. Log kanala detay attım.`).catch(() => {});
    } catch (e) {}
}

// 15 dakikada bir cookie kontrol
setInterval(async () => {
    if (!cookieStatus.aktif) {
        await robloxGiris();
    } else {
        try {
            await noblox.getCurrentUser();
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
    const errorMessage = { content: '❌ Komut çalıştırılırken bir hata oluştu. Lütfen tekrar deneyin.', ephemeral: true };
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
                { name: 'yeni-rütbe', description: 'Yeni rütbe', type: ApplicationCommandOptionType.Integer, required: true, choices: TUM_RUTBELER },
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
            name: 'branş-ekle',
            description: 'Bir personele branş ekler.',
            default_member_permissions: PermissionFlagsBits.ManageRoles.toString(),
            options: [
                { name: 'roblox-isim', description: 'Branş eklenecek kişi', type: ApplicationCommandOptionType.String, required: true },
                { name: 'branş', description: 'Eklenecek branş', type: ApplicationCommandOptionType.String, required: true, choices: Object.keys(BRANSLAR).map(b => ({ name: b, value: b })) }
            ]
        },
        {
            name: 'branş-çıkar',
            description: 'Bir personelden branş çıkarır.',
            default_member_permissions: PermissionFlagsBits.ManageRoles.toString(),
            options: [
                { name: 'roblox-isim', description: 'Branş çıkarılacak kişi', type: ApplicationCommandOptionType.String, required: true },
                { name: 'branş', description: 'Çıkarılacak branş', type: ApplicationCommandOptionType.String, required: true, choices: Object.keys(BRANSLAR).map(b => ({ name: b, value: b })) }
            ]
        },
        {
            name: 'branş-temizle',
            description: 'Bir personelin tüm branşlarını siler.',
            default_member_permissions: PermissionFlagsBits.ManageRoles.toString(),
            options: [{ name: 'roblox-isim', description: 'Branşları silinecek kişi', type: ApplicationCommandOptionType.String, required: true }]
        },
        {
            name: 'branşlar',
            description: 'Bir personelin branşlarını listeler.',
            options: [{ name: 'roblox-isim', description: 'Branşları gösterilecek kişi', type: ApplicationCommandOptionType.String, required: true }]
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
            name: 'aktiflik',
            description: 'Bir personelin oyun aktiflik süresini gösterir.',
            options: [{ name: 'roblox-isim', description: 'Aktifliği gösterilecek kişi', type: ApplicationCommandOptionType.String, required: true }]
        },
        {
            name: 'aktiflik-sıralama',
            description: 'En aktif 10 personeli sıralar.',
            default_member_permissions: PermissionFlagsBits.ManageRoles.toString()
        },
        {
            name: 'afk-liste',
            description: '7 gündür aktif olmayan personelleri listeler.',
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

// --- KOMUTLAR ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName } = interaction;

    try {
        await interaction.deferReply({ ephemeral: commandName !== 'profile' && commandName !== 'branşlar' });

        // Cookie kontrolü gerektiren komutlar
        const cookieGerekli = ['rütbe-değiştir', 'terfi', 'tenzil', 'profile', 'branş-ekle', 'branş-çıkar', 'branş-temizle'];
        if (cookieGerekli.includes(commandName) && !cookieStatus.aktif) {
            return interaction.editReply('❌ **Roblox Cookie Ölü!** Rütbe işlemleri yapılamıyor. Log kanala detay attım, cookie yenile komutanım.');
        }

        if (commandName === 'rütbe-değiştir') {
            const robloxIsim = interaction.options.getString('roblox-isim');
            const yeniRutbeRank = interaction.options.getInteger('yeni-rütbe');
            const sebep = interaction.options.getString('sebep') || 'Belirtilmedi';
            
            const userId = await noblox.getIdFromUsername(robloxIsim);
            const eskiRank = await noblox.getRankInGroup(AYARLAR.GROUP_ID, userId);
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
            const eskiRank = await noblox.getRankInGroup(AYARLAR.GROUP_ID, userId);
            const eskiRutbeIsim = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);
            
            await noblox.promote(AYARLAR.GROUP_ID, userId);
            const yeniRank = await noblox.getRankInGroup(AYARLAR.GROUP_ID, userId);
            const yeniRutbeIsim = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);
            
            await interaction.editReply(`⬆️ **${robloxIsim}** terfi etti: **${eskiRutbeIsim}** → **${yeniRutbeIsim}**`);
            
            const logEmbed = new EmbedBuilder()
                .setColor(0x00FF00).setTitle('Terfi')
                .addFields(
                    { name: 'Personel', value: robloxIsim, inline: true },
                    { name: 'Yetkili', value: interaction.user.tag, inline: true },
                    { name: 'Eski Rütbe', value: eskiRutbeIsim },
                    { name: 'Yeni Rütbe', value: yeniRutbeIsim }
                ).setTimestamp();
            await logGonder(logEmbed);
        }
        
        else if (commandName === 'tenzil') {
            const robloxIsim = interaction.options.getString('roblox-isim');
            const userId = await noblox.getIdFromUsername(robloxIsim);
            const eskiRutbeIsim = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);
            
            await noblox.demote(AYARLAR.GROUP_ID, userId);
            const yeniRutbeIsim = await noblox.getRankNameInGroup(AYARLAR.GROUP_ID, userId);
            
            await interaction.editReply(`⬇️ **${robloxIsim}** tenzil edildi: **${eskiRutbeIsim}** → **${yeniRutbeIsim}**`);
            
            const logEmbed = new EmbedBuilder()
                .setColor(0xFF0000).setTitle('Tenzil')
                .addFields(
                    { name: 'Personel', value: robloxIsim, inline: true },
                    { name: 'Yetkili', value: interaction.user.tag, inline: true },
                    { name: 'Eski Rütbe', value: eskiRutbeIsim },
                    { name: 'Yeni Rütbe', value: yeniRutbeIsim }
                ).setTimestamp();
            await logGonder(logEmbed);
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
                    { name: 'Roblox ID', value: userId.toString(), inline: true },
                    { name: 'Profil', value: `[Link](https://www.roblox.com/users/${userId}/profile)` }
                ).setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
        
        else if (commandName === 'izin-al') {
            const robloxIsim = interaction.options.getString('roblox-isim');
            const sure = interaction.options.getInteger('süre');
            const sebep = interaction.options.getString('sebep');
            const userId = await noblox.getIdFromUsername(robloxIsim);
            
            const bitisTarihi = new Date();
            bitisTarihi.setDate(bitisTarihi.getDate() + sure);
            
            izinVerisi.set(userId.toString(), {
                isim: robloxIsim,
                sebep: sebep,
                bitis: bitisTarihi.getTime(),
                veren: interaction.user.id
            });
            
            // Discord rolü ver
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const izinRol = interaction.guild.roles.cache.get(AYARLAR.IZIN_ROL_ID);
            if (izinRol) await member.roles.add(izinRol);
            
            await interaction.editReply(`✅ **${robloxIsim}** için **${sure} günlük** izin verildi.\n**Sebep:** ${sebep}\n**Bitiş:** ${bitisTarihi.toLocaleDateString('tr-TR')}`);
            
            const logEmbed = new EmbedBuilder()
                .setColor(0xFFFF00).setTitle('İzin Verildi')
                .addFields(
                    { name: 'Personel', value: robloxIsim, inline: true },
                    { name: 'Süre', value: `${sure} gün`, inline: true },
                    { name: 'Yetkili', value: interaction.user.tag, inline: true },
                    { name: 'Sebep', value: sebep },
                    { name: 'Bitiş Tarihi', value: bitisTarihi.toLocaleDateString('tr-TR') }
                ).setTimestamp();
            await logGonder(logEmbed);
        }
        
        else if (commandName === 'izin-iptal') {
            const robloxIsim = interaction.options.getString('roblox-isim');
            const userId = await noblox.getIdFromUsername(robloxIsim);
            
            if (!izinVerisi.has(userId.toString())) {
                return interaction.editReply('❌ Bu personelin aktif izni yok.');
            }
            
            izinVerisi.delete(userId.toString());
            
            // Discord rolü al
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const izinRol = interaction.guild.roles.cache.get(AYARLAR.IZIN_ROL_ID);
            if (izinRol) await member.roles.remove(izinRol);
            
            await interaction.editReply(`✅ **${robloxIsim}** izni iptal edildi.`);
        }
        
        else if (commandName === 'izinler') {
            if (izinVerisi.size === 0) {
                return interaction.editReply('✅ Şu an izinli personel yok.');
            }
            
            let liste = '';
            const simdi = Date.now();
            for (const [id, data] of izinVerisi.entries()) {
                const kalanGun = Math.ceil((data.bitis - simdi) / (1000 * 60 * 60 * 24));
                if (kalanGun > 0) {
                    liste += `**${data.isim}** - ${kalanGun} gün kaldı | Sebep: ${data.sebep}\n`;
                }
            }
            
            const embed = new EmbedBuilder()
                .setColor(0xFFFF00)
                .setTitle('📋 Aktif İzinli Personeller')
                .setDescription(liste || 'Aktif izin yok')
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
        
        else if (commandName === 'aktiflik') {
            const robloxIsim = interaction.options.getString('roblox-isim');
            const userId = await noblox.getIdFromUsername(robloxIsim);
            const veri = aktiflikVerisi.get(userId.toString());
            
            if (!veri) {
                return interaction.editReply(`❌ **${robloxIsim}** için aktiflik verisi bulunamadı.`);
            }
            
            const saat = Math.floor(veri.dakika / 60);
            const dakika = veri.dakika % 60;
            
            await interaction.editReply(`⏱️ **${robloxIsim}** toplam **${saat} saat ${dakika} dakika** oyunda aktif.\nSon görülme: ${new Date(veri.sonGorulme).toLocaleString('tr-TR')}`);
        }
        
        else if (commandName === 'aktiflik-sıralama') {
            const sirali = [...aktiflikVerisi.entries()]
                .sort((a, b) => b[1].dakika - a[1].dakika)
                .slice(0, 10);
            
            if (sirali.length === 0) {
                return interaction.editReply('❌ Aktiflik verisi yok.');
            }
            
            let liste = '';
            for (let i = 0; i < sirali.length; i++) {
                const [id, veri] = sirali[i];
                const saat = Math.floor(veri.dakika / 60);
                liste += `**${i + 1}.** ${veri.isim} - ${saat} saat\n`;
            }
            
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🏆 En Aktif 10 Personel')
                .setDescription(liste)
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
        
        else if (commandName === 'afk-liste') {
            const birHaftaOnce = Date.now() - (7 * 24 * 60 * 60 * 1000);
            const afkler = [...aktiflikVerisi.entries()]
                .filter(([id, veri]) => veri.sonGorulme < birHaftaOnce && !izinVerisi.has(id))
                .slice(0, 20);
            
            if (afkler.length === 0) {
                return interaction.editReply('✅ 7 gündür AFK olan personel yok.');
            }
            
            let liste = '';
            for (const [id, veri] of afkler) {
                const gun = Math.floor((Date.now() - veri.sonGorulme) / (1000 * 60 * 60 * 24));
                liste += `**${veri.isim}** - ${gun} gündür yok\n`;
            }
            
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('😴 AFK Personel Listesi (7+ Gün)')
                .setDescription(liste)
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
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

// --- İZİN KONTROL SİSTEMİ ---
setInterval(async () => {
    const simdi = Date.now();
    for (const [userId, data] of izinVerisi.entries()) {
        if (data.bitis <= simdi) {
            izinVerisi.delete(userId);
            try {
                const guild = client.guilds.cache.first();
                const member = await guild.members.fetch(data.veren);
                const izinRol = guild.roles.cache.get(AYARLAR.IZIN_ROL_ID);
                if (izinRol) await member.roles.remove(izinRol);
                
                const logEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('İzin Süresi Bitti')
                    .setDescription(`**${data.isim}** izni bitti. Aktiflik takibine geri döndü.`)
                    .setTimestamp();
                await logGonder(logEmbed);
            } catch (e) {}
        }
    }
}, 5 * 60 * 1000); // 5 dakikada bir kontrol

// --- AKTİFLİK TAKİP SİSTEMİ ---
setInterval(async () => {
    if (!cookieStatus.aktif) return;
    try {
        const oyundakiler = await noblox.getPlayersInGame(AYARLAR.OYUN_ID);
        for (const player of oyundakiler) {
            if (izinVerisi.has(player.id.toString())) continue; // İzinli olanları sayma
            
            const mevcut = aktiflikVerisi.get(player.id.toString()) || { isim: player.name, dakika: 0, sonGorulme: Date.now() };
            mevcut.dakika += 5;
            mevcut.sonGorulme = Date.now();
            aktiflikVerisi.set(player.id.toString(), mevcut);
        }
    } catch (e) {}
}, 5 * 60 * 1000); // 5 dakikada bir tara

// --- WEB SUNUCU ---
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('TSA Bot Aktif');
});
server.listen(AYARLAR.PORT);

client.login(AYARLAR.DISCORD_TOKEN);
