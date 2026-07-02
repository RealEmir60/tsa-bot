const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, REST, Routes, PermissionFlagsBits } = require('discord.js');
const noblox = require('noblox.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    ROBLOX_COOKIE: process.env.ROBLOX_COOKIE,
    GROUP_ID: parseInt(process.env.GROUP_ID) || 972348115,
    UNIVERSE_ID: process.env.UNIVERSE_ID || "138257110169831",
    LOG_CHANNEL: process.env.LOG_CHANNEL || null,
    VERI_DOSYASI: './tsa_veri.json'
};

let VERI = {
    komutlar: {},
    devriyeler: {},
    cezalar: {},
    karaliste: {},
    rutbeler: {},
    sonId: 0
};

const TSA_RUTBELERI = {
    1: "Er",
    2: "Onbaşı",
    3: "Çavuş",
    4: "Uzman Çavuş",
    5: "Astsubay",
    6: "Teğmen",
    7: "Üsteğmen",
    8: "Yüzbaşı",
    9: "Binbaşı",
    10: "Yarbay",
    11: "Albay",
    12: "Tuğgeneral",
    13: "Tümgeneral",
    14: "Korgeneral",
    15: "Orgeneral",
    255: "TSA Komutanı"
};

function veriYukle() {
    try {
        if (fs.existsSync(CONFIG.VERI_DOSYASI)) {
            const data = fs.readFileSync(CONFIG.VERI_DOSYASI, 'utf8');
            VERI = JSON.parse(data);
            console.log('[Veri] Yüklendi');
        } else {
            console.log('[Veri] Yeni dosya oluşturuluyor');
            veriKaydet();
        }
    } catch (err) {
        console.log('[Veri] Hata:', err.message);
        VERI = { komutlar: {}, devriyeler: {}, cezalar: {}, karaliste: {}, rutbeler: {}, sonId: 0 };
    }
}

function veriKaydet() {
    try {
        fs.writeFileSync(CONFIG.VERI_DOSYASI, JSON.stringify(VERI, null, 2));
    } catch (err) {
        console.log('[Veri] Kaydetme hatası:', err.message);
    }
}

function yetkiKontrol(member) {
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    const roller = member.roles.cache;
    return roller.some(rol => {
        const rutbeAdi = rol.name.toLowerCase();
        return Object.values(TSA_RUTBELERI).some(r => rutbeAdi.includes(r.toLowerCase()));
    });
}

function kullaniciRutbeGetir(member) {
    const roller = member.roles.cache;
    for (const [id, rutbe] of Object.entries(TSA_RUTBELERI).reverse()) {
        if (roller.some(rol => rol.name.toLowerCase().includes(rutbe.toLowerCase()))) {
            return { id: parseInt(id), ad: rutbe };
        }
    }
    return { id: 0, ad: "Sivil" };
}

const komutlar = [
    new SlashCommandBuilder()
        .setName('komut-ver')
        .setDescription('Bir askere komut verir')
        .addUserOption(option => option.setName('asker').setDescription('Komut verilecek asker').setRequired(true))
        .addStringOption(option => option.setName('komut').setDescription('Verilecek komut').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('komut-bilgi')
        .setDescription('Verilen komutun bilgilerini gösterir')
        .addIntegerOption(option => option.setName('id').setDescription('Komut ID').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('komut-geri-al')
        .setDescription('Verilen komutu geri alır')
        .addIntegerOption(option => option.setName('id').setDescription('Komut ID').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('devriye-katıl')
        .setDescription('Devriyeye katılır'),
    
    new SlashCommandBuilder()
        .setName('devriye-ayrıl')
        .setDescription('Devriyeden ayrılır'),
    
    new SlashCommandBuilder()
        .setName('devriye-durum')
        .setDescription('Aktif devriye durumunu gösterir'),
    
    new SlashCommandBuilder()
        .setName('idrak-asker')
        .setDescription('Asker hakkında bilgi verir')
        .addUserOption(option => option.setName('asker').setDescription('Bilgisi alınacak asker').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('rapor-ver')
        .setDescription('Günlük rapor verir')
        .addStringOption(option => option.setName('mesaj').setDescription('Rapor mesajı').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('ceza-ver')
        .setDescription('Bir askere ceza verir')
        .addUserOption(option => option.setName('asker').setDescription('Ceza verilecek asker').setRequired(true))
        .addStringOption(option => option.setName('sebep').setDescription('Ceza sebebi').setRequired(true))
        .addIntegerOption(option => option.setName('sure').setDescription('Ceza süresi dakika').setRequired(false)),
    
    new SlashCommandBuilder()
        .setName('ceza-kaldır')
        .setDescription('Askerin cezasını kaldırır')
        .addUserOption(option => option.setName('asker').setDescription('Cezası kaldırılacak asker').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('ceza-bilgi')
        .setDescription('Askerin ceza bilgisini gösterir')
        .addUserOption(option => option.setName('asker').setDescription('Bilgisi alınacak asker').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('kara-liste-ekle')
        .setDescription('Kullanıcıyı kara listeye ekler')
        .addUserOption(option => option.setName('kullanici').setDescription('Kara listeye eklenecek kullanıcı').setRequired(true))
        .addStringOption(option => option.setName('sebep').setDescription('Sebep').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('kara-liste-kaldır')
        .setDescription('Kullanıcıyı kara listeden çıkarır')
        .addUserOption(option => option.setName('kullanici').setDescription('Kara listeden çıkarılacak kullanıcı').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('kara-liste-kontrol')
        .setDescription('Kullanıcının kara listede olup olmadığını kontrol eder')
        .addUserOption(option => option.setName('kullanici').setDescription('Kontrol edilecek kullanıcı').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('rütbe-değiştir')
        .setDescription('Askerin rütbesini günceller')
        .addUserOption(option => option.setName('asker').setDescription('Rütbesi değiştirilecek asker').setRequired(true))
        .addStringOption(option => option.setName('rutbe').setDescription('Yeni rütbe seçin veya aratın').setRequired(true).setAutocomplete(true)),
    
    new SlashCommandBuilder()
        .setName('rütbe-düşür')
        .setDescription('Askerin rütbesini düşürür')
        .addUserOption(option => option.setName('asker').setDescription('Rütbesi düşürülecek asker').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('rütbeler')
        .setDescription('TSA rütbelerini listeler'),
    
    new SlashCommandBuilder()
        .setName('ses-gir')
        .setDescription('Botu sesli kanala sokar')
        .addChannelOption(option => option.setName('kanal').setDescription('Girilecek ses kanalı').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('ses-çık')
        .setDescription('Botu sesli kanaldan çıkarır'),
    
    new SlashCommandBuilder()
        .setName('aktiflik-sorgu')
        .setDescription('Roblox oyunundaki anlık aktif oyuncu sayısını gösterir'),
    
    new SlashCommandBuilder()
        .setName('yardım')
        .setDescription('Tüm komutları listeler')
].map(command => command.toJSON());

client.once('ready', async () => {
    console.log(`[Discord] | TSA | ${client.user.tag} aktif edildi.`);
    veriYukle();
    
    try {
        await noblox.setCookie(CONFIG.ROBLOX_COOKIE);
        const currentUser = await noblox.getCurrentUser();
        console.log(`[Roblox] Başarılı: ${currentUser.UserName}`);
    } catch (err) {
        console.log(`[Roblox] Hata: ${err.message}`);
    }

    const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
    try {
        console.log('[Discord] Komutlar senkronize ediliyor...');
        await rest.put(Routes.applicationCommands(client.user.id), { body: komutlar });
        console.log(`[Discord] Toplam ${komutlar.length} komut başarıyla sisteme yüklendi.`);
    } catch (error) {
        console.error('[Discord] Komut yükleme hatası:', error);
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isAutocomplete()) {
        if (interaction.commandName === 'rütbe-değiştir') {
            const focusedValue = interaction.options.getFocused().toLowerCase();
            const choices = Object.values(TSA_RUTBELERI);
            
            let filtered;
            if (focusedValue.length >= 3) {
                filtered = choices.filter(choice => choice.toLowerCase().includes(focusedValue));
            } else {
                filtered = choices.slice(0, 25);
            }
            
            await interaction.respond(
                filtered.slice(0, 25).map(choice => ({ name: choice, value: choice }))
            ).catch(() => {});
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {
        if (commandName === 'komut-ver') {
            const asker = interaction.options.getUser('asker');
            const komut = interaction.options.getString('komut');
            
            if (VERI.karaliste[asker.id]) {
                return interaction.reply({ content: '❌ Bu kullanıcı kara listede!', ephemeral: true });
            }
            
            VERI.sonId++;
            VERI.komutlar[VERI.sonId] = {
                id: VERI.sonId,
                veren: interaction.user.id,
                alan: asker.id,
                komut: komut,
                tarih: new Date().toISOString(),
                durum: 'aktif'
            };
            veriKaydet();
            
            const embed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle('✅ Komut Verildi')
                .addFields(
                    { name: 'ID', value: `${VERI.sonId}`, inline: true },
                    { name: 'Asker', value: `${asker}`, inline: true },
                    { name: 'Komut', value: komut, inline: false },
                    { name: 'Veren', value: `${interaction.user}`, inline: true }
                )
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed] });
            
            if (CONFIG.LOG_CHANNEL) {
                const logChannel = interaction.guild.channels.cache.get(CONFIG.LOG_CHANNEL);
                if (logChannel) logChannel.send({ embeds: [embed] }).catch(() => {});
            }
        }
        
        else if (commandName === 'komut-bilgi') {
            const id = interaction.options.getInteger('id');
            const komut = VERI.komutlar[id];
            
            if (!komut) {
                return interaction.reply({ content: '❌ Komut bulunamadı!', ephemeral: true });
            }
            
            const embed = new EmbedBuilder()
                .setColor(0x0099ff)
                .setTitle(`📋 Komut #${id}`)
                .addFields(
                    { name: 'Veren', value: `<@${komut.veren}>`, inline: true },
                    { name: 'Alan', value: `<@${komut.alan}>`, inline: true },
                    { name: 'Durum', value: komut.durum, inline: true },
                    { name: 'Komut', value: komut.komut, inline: false }
                )
                .setTimestamp(new Date(komut.tarih));
            
            await interaction.reply({ embeds: [embed] });
        }
        
        else if (commandName === 'komut-geri-al') {
            const id = interaction.options.getInteger('id');
            
            if (!VERI.komutlar[id]) {
                return interaction.reply({ content: '❌ Komut bulunamadı!', ephemeral: true });
            }
            
            if (VERI.komutlar[id].veren !== interaction.user.id && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Bu komutu sadece veren kişi geri alabilir!', ephemeral: true });
            }
            
            VERI.komutlar[id].durum = 'iptal';
            veriKaydet();
            
            await interaction.reply({ content: `✅ #${id} numaralı komut geri alındı.`, ephemeral: true });
        }
        
        else if (commandName === 'devriye-katıl') {
            if (VERI.devriyeler[interaction.user.id]) {
                return interaction.reply({ content: '❌ Zaten devriyedesin!', ephemeral: true });
            }
            
            VERI.devriyeler[interaction.user.id] = {
                baslangic: new Date().toISOString(),
                kullanici: interaction.user.username
            };
            veriKaydet();
            
            await interaction.reply({ content: '✅ Devriyeye katıldın! Görevinde başarılar.', ephemeral: true });
        }
        
        else if (commandName === 'devriye-ayrıl') {
            if (!VERI.devriyeler[interaction.user.id]) {
                return interaction.reply({ content: '❌ Devriyede değilsin!', ephemeral: true });
            }
            
            const baslangic = new Date(VERI.devriyeler[interaction.user.id].baslangic);
            const sure = Math.floor((new Date() - baslangic) / 1000 / 60);
            
            delete VERI.devriyeler[interaction.user.id];
            veriKaydet();
            
            await interaction.reply({ content: `✅ Devriyeden ayrıldın! Toplam süre: ${sure} dakika.`, ephemeral: true });
        }
        
        else if (commandName === 'devriye-durum') {
            const aktifler = Object.keys(VERI.devriyeler);
            
            if (aktifler.length === 0) {
                return interaction.reply({ content: '📭 Şu anda devriyede kimse yok.', ephemeral: true });
            }
            
            const liste = aktifler.map(id => {
                const baslangic = new Date(VERI.devriyeler[id].baslangic);
                const sure = Math.floor((new Date() - baslangic) / 1000 / 60);
                return `<@${id}> - ${sure} dk`;
            }).join('\n');
            
            const embed = new EmbedBuilder()
                .setColor(0xffaa00)
                .setTitle('🚨 Devriye Durumu')
                .setDescription(`**Aktif:** ${aktifler.length} kişi\n\n${liste}`)
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed] });
        }
        
        else if (commandName === 'idrak-asker') {
            const asker = interaction.options.getUser('asker');
            const member = await interaction.guild.members.fetch(asker.id).catch(() => null);
            
            if (!member) {
                return interaction.reply({ content: '❌ Kullanıcı sunucuda bulunamadı.', ephemeral: true });
            }
            
            const rutbe = kullaniciRutbeGetir(member);
            const cezalar = Object.values(VERI.cezalar).filter(c => c.alan === asker.id).length;
            const komutlar = Object.values(VERI.komutlar).filter(k => k.alan === asker.id).length;
            const karaListe = VERI.karaliste[asker.id] ? '⛔ Evet' : '✅ Hayır';
            
            const embed = new EmbedBuilder()
                .setColor(0x0099ff)
                .setTitle(`🎖️ Asker Bilgisi`)
                .setThumbnail(asker.displayAvatarURL())
                .addFields(
                    { name: 'Asker', value: `${asker}`, inline: true },
                    { name: 'Rütbe', value: rutbe.ad, inline: true },
                    { name: 'Kara Liste', value: karaListe, inline: true },
                    { name: 'Toplam Komut', value: `${komutlar}`, inline: true },
                    { name: 'Toplam Ceza', value: `${cezalar}`, inline: true },
                    { name: 'Sunucuya Katılım', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true }
                );
            
            await interaction.reply({ embeds: [embed] });
        }
        
        else if (commandName === 'rapor-ver') {
            const mesaj = interaction.options.getString('mesaj');
            const rutbe = kullaniciRutbeGetir(interaction.member);
            
            const embed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle('📝 Günlük Rapor')
                .setDescription(mesaj)
                .setAuthor({ name: `${rutbe.ad} ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
                .setFooter({ text: `TSA Rapor Sistemi` })
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed] });
        }
        
        else if (commandName === 'ceza-ver') {
            const asker = interaction.options.getUser('asker');
            const sebep = interaction.options.getString('sebep');
            const sure = interaction.options.getInteger('sure') || 0;
            
            VERI.sonId++;
            VERI.cezalar[VERI.sonId] = {
                id: VERI.sonId,
                veren: interaction.user.id,
                alan: asker.id,
                sebep: sebep,
                sure: sure,
                tarih: new Date().toISOString(),
                aktif: true
            };
            veriKaydet();
            
            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('⚠️ Ceza Verildi')
                .addFields(
                    { name: 'Asker', value: `${asker}`, inline: true },
                    { name: 'Veren', value: `${interaction.user}`, inline: true },
                    { name: 'Sebep', value: sebep, inline: false },
                    { name: 'Süre', value: sure > 0 ? `${sure} dakika` : 'Süresiz', inline: true },
                    { name: 'ID', value: `${VERI.sonId}`, inline: true }
                )
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed] });
            
            try {
                await asker.send({ embeds: [embed.setDescription('TSA disiplin sistemi tarafından cezalandırıldınız.')] });
            } catch (e) {}
        }
        
        else if (commandName === 'ceza-kaldır') {
            const asker = interaction.options.getUser('asker');
            const ceza = Object.values(VERI.cezalar).find(c => c.alan === asker.id && c.aktif);
            
            if (!ceza) {
                return interaction.reply({ content: '❌ Aktif ceza bulunamadı!', ephemeral: true });
            }
            
            ceza.aktif = false;
            ceza.kaldiran = interaction.user.id;
            ceza.kaldirmaTarihi = new Date().toISOString();
            veriKaydet();
            
            await interaction.reply({ content: `✅ ${asker} kullanıcısının cezası kaldırıldı.`, ephemeral: true });
        }
        
        else if (commandName === 'ceza-bilgi') {
            const asker = interaction.options.getUser('asker');
            const cezalar = Object.values(VERI.cezalar).filter(c => c.alan === asker.id);
            
            if (cezalar.length === 0) {
                return interaction.reply({ content: `✅ ${asker} kullanıcısının ceza kaydı yok.`, ephemeral: true });
            }
            
            const aktifler = cezalar.filter(c => c.aktif);
            const bitmisler = cezalar.filter(c => !c.aktif);
            
            const embed = new EmbedBuilder()
                .setColor(0xff9900)
                .setTitle(`⚖️ Ceza Bilgisi - ${asker.username}`)
                .addFields(
                    { name: 'Toplam Ceza', value: `${cezalar.length}`, inline: true },
                    { name: 'Aktif', value: `${aktifler.length}`, inline: true },
                    { name: 'Bitmiş', value: `${bitmisler.length}`, inline: true }
                );
            
            if (aktifler.length > 0) {
                embed.addFields({ name: 'Aktif Cezalar', value: aktifler.map(c => `**#${c.id}** - ${c.sebep} (${c.sure > 0 ? c.sure + ' dk' : 'Süresiz'})`).join('\n') });
            }
            
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        else if (commandName === 'kara-liste-ekle') {
            const kullanici = interaction.options.getUser('kullanici');
            const sebep = interaction.options.getString('sebep');
            
            VERI.karaliste[kullanici.id] = {
                sebep: sebep,
                ekleyen: interaction.user.id,
                tarih: new Date().toISOString()
            };
            veriKaydet();
            
            const embed = new EmbedBuilder()
                .setColor(0x000000)
                .setTitle('⛔ Kara Listeye Eklendi')
                .addFields(
                    { name: 'Kullanıcı', value: `${kullanici}`, inline: true },
                    { name: 'Ekleyen', value: `${interaction.user}`, inline: true },
                    { name: 'Sebep', value: sebep, inline: false }
                )
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed] });
        }
        
        else if (commandName === 'kara-liste-kaldır') {
            const kullanici = interaction.options.getUser('kullanici');
            
            if (!VERI.karaliste[kullanici.id]) {
                return interaction.reply({ content: '❌ Bu kullanıcı kara listede değil!', ephemeral: true });
            }
            
            delete VERI.karaliste[kullanici.id];
            veriKaydet();
            
            await interaction.reply({ content: `✅ ${kullanici} kara listeden çıkarıldı.`, ephemeral: true });
        }
        
        else if (commandName === 'kara-liste-kontrol') {
            const kullanici = interaction.options.getUser('kullanici');
            const kayit = VERI.karaliste[kullanici.id];
            
            if (!kayit) {
                return interaction.reply({ content: `✅ ${kullanici} kara listede değil.`, ephemeral: true });
            }
            
            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('⛔ Kara Liste Kaydı')
                .addFields(
                    { name: 'Kullanıcı', value: `${kullanici}`, inline: true },
                    { name: 'Ekleyen', value: `<@${kayit.ekleyen}>`, inline: true },
                    { name: 'Sebep', value: kayit.sebep, inline: false }
                )
                .setTimestamp(new Date(kayit.tarih));
            
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        else if (commandName === 'rütbe-değiştir') {
            const asker = interaction.options.getUser('asker');
            const rutbe = interaction.options.getString('rutbe');
            
            VERI.rutbeler[asker.id] = {
                rutbe: rutbe,
                veren: interaction.user.id,
                tarih: new Date().toISOString()
            };
            veriKaydet();
            
            const embed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle('🎖️ Rütbe Güncellendi')
                .addFields(
                    { name: 'Asker', value: `${asker}`, inline: true },
                    { name: 'Yeni Rütbe', value: rutbe, inline: true },
                    { name: 'Değişikliği Yapan', value: `${interaction.user}`, inline: true }
                )
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed] });
            
            if (CONFIG.LOG_CHANNEL) {
                const logChannel = interaction.guild.channels.cache.get(CONFIG.LOG_CHANNEL);
                if (logChannel) logChannel.send({ embeds: [embed] }).catch(() => {});
            }
        }
        
        else if (commandName === 'rütbe-düşür') {
            const asker = interaction.options.getUser('asker');
            
            if (!VERI.rutbeler[asker.id]) {
                return interaction.reply({ content: '❌ Bu kullanıcının rütbe kaydı yok!', ephemeral: true });
            }
            
            const eskiRutbe = VERI.rutbeler[asker.id].rutbe;
            delete VERI.rutbeler[asker.id];
            veriKaydet();
            
            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('📉 Rütbe Düşürüldü')
                .addFields(
                    { name: 'Asker', value: `${asker}`, inline: true },
                    { name: 'Düşürülen Rütbe', value: eskiRutbe, inline: true },
                    { name: 'İşlemi Yapan', value: `${interaction.user}`, inline: true }
                )
                .setTimestamp();
                
            await interaction.reply({ embeds: [embed] });
            
            if (CONFIG.LOG_CHANNEL) {
                const logChannel = interaction.guild.channels.cache.get(CONFIG.LOG_CHANNEL);
                if (logChannel) logChannel.send({ embeds: [embed] }).catch(() => {});
            }
        }
        
        else if (commandName === 'rütbeler') {
            const embed = new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle('🎖️ TSA Rütbeler')
                .setDescription(Object.entries(TSA_RUTBELERI).map(([id, name]) => `**${id}** - ${name}`).join('\n'))
                .setFooter({ text: 'TSA Komuta Kademesi' });
            
            await interaction.reply({ embeds: [embed] });
        }
        
        else if (commandName === 'ses-gir') {
            const kanal = interaction.options.getChannel('kanal');
            
            if (!kanal.isVoiceBased()) {
                return interaction.reply({ content: '❌ Bu bir ses kanalı değil!', ephemeral: true });
            }
            
            try {
                joinVoiceChannel({
                    channelId: kanal.id,
                    guildId: interaction.guild.id,
                    adapterCreator: interaction.guild.voiceAdapterCreator,
                });
                
                await interaction.reply({ content: `✅ ${kanal} kanalına girildi!`, ephemeral: true });
            } catch (err) {
                await interaction.reply({ content: '❌ Ses kanalına girilemedi!', ephemeral: true });
            }
        }
        
        else if (commandName === 'ses-çık') {
            const connection = getVoiceConnection(interaction.guild.id);
            
            if (!connection) {
                return interaction.reply({ content: '❌ Zaten bir sesli kanalda değilim!', ephemeral: true });
            }
            
            connection.destroy();
            await interaction.reply({ content: '✅ Sesli kanaldan çıkıldı!', ephemeral: true });
        }
        
        else if (commandName === 'aktiflik-sorgu') {
            await interaction.deferReply();
            
            try {
                const universeId = CONFIG.UNIVERSE_ID;
                const res = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
                const data = await res.json();
                
                if (!data.data || data.data.length === 0) {
                    return interaction.editReply('❌ Oyun bilgisi bulunamadı! Lütfen UNIVERSE_ID değerini kontrol edin.');
                }
                
                const oyun = data.data[0];
                
                let iconUrl = 'https://www.roblox.com/images/TemplateUnlisted.png';
                try {
                    const thumbRes = await fetch(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&returnPolicy=PlaceHolder&size=512x512&format=Png`);
                    const thumbData = await thumbRes.json();
                    if (thumbData.data && thumbData.data.length > 0) {
                        iconUrl = thumbData.data[0].imageUrl;
                    }
                } catch (e) {}

                const embed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('🎮 TSA Aktiflik Durumu')
                    .addFields(
                        { name: 'Oyun Adı', value: oyun.name || 'Bilinmiyor', inline: false },
                        { name: 'Aktif Oyuncu', value: `**${oyun.playing || 0}** kişi`, inline: true },
                        { name: 'Toplam Ziyaret', value: `${(oyun.visits || 0).toLocaleString()}`, inline: true },
                        { name: 'Favori', value: `${(oyun.favoritedCount || 0).toLocaleString()}`, inline: true }
                    )
                    .setThumbnail(iconUrl)
                    .setTimestamp()
                    .setFooter({ text: 'TSA Aktiflik Sistemi' });
                
                await interaction.editReply({ embeds: [embed] });
            } catch (err) {
                console.error(err);
                await interaction.editReply('❌ Aktiflik bilgisi çekilirken bir hata oluştu.');
            }
        }
        
        else if (commandName === 'yardım') {
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('📋 TSA Bot Komutları')
                .setDescription('**Toplam 21 Komut**')
                .addFields(
                    { name: '👮 Komut Sistemi', value: '`/komut-ver` `/komut-bilgi` `/komut-geri-al`', inline: false },
                    { name: '🚨 Devriye Sistemi', value: '`/devriye-katıl` `/devriye-ayrıl` `/devriye-durum`', inline: false },
                    { name: '🎖️ Asker Sistemi', value: '`/idrak-asker` `/rapor-ver`', inline: false },
                    { name: '⚖️ Ceza Sistemi', value: '`/ceza-ver` `/ceza-kaldır` `/ceza-bilgi`', inline: false },
                    { name: '⛔ Kara Liste', value: '`/kara-liste-ekle` `/kara-liste-kaldır` `/kara-liste-kontrol`', inline: false },
                    { name: '🎖️ Rütbe Sistemi', value: '`/rütbe-değiştir` `/rütbe-düşür` `/rütbeler`', inline: false },
                    { name: '🔊 Ses Sistemi', value: '`/ses-gir` `/ses-çık`', inline: false },
                    { name: '🎮 Diğer', value: '`/aktiflik-sorgu` `/yardım`', inline: false }
                )
                .setFooter({ text: 'TSA Bot v2.0 | Tüm komutlar aktif' })
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
    } catch (error) {
        console.error('Komut hatası:', error);
        const hataMsg = '❌ Bir hata oluştu! Lütfen tekrar deneyin.';
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: hataMsg }).catch(() => {});
        } else {
            await interaction.reply({ content: hataMsg, ephemeral: true }).catch(() => {});
        }
    }
});

const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.send('TSA Bot Aktif - 21 Komut Yüklü');
});

app.get('/health', (req, res) => {
    res.json({ status: 'online', komutlar: 21, uptime: process.uptime() });
});

app.listen(3000, () => {
    console.log('[HTTP] Sunucu 3000 portunda çalışıyor');
});

process.on('unhandledRejection', error => {
    console.error('Yakalanmamış hata:', error);
});

client.login(CONFIG.TOKEN);
