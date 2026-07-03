const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, REST, Routes, ActivityType, PermissionFlagsBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection, NoSubscriberBehavior } = require('@discordjs/voice');
const play = require('play-dl');
const fs = require('fs');
const express = require('express');
const noblox = require('noblox.js');
require('dotenv').config();

// --- WEB SUNUCUSU ---
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('TSA Bot Aktif'));
app.listen(PORT, '0.0.0.0', () => console.log(`[Web] Sunucu ${PORT} portunda aktif.`));

// --- CONFIG & VERİ ---
const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    GROUP_ID: parseInt(process.env.GROUP_ID) || 972348115,
    DM_YETKILI_ROL: '1518357646971764859',
    EGITIM_YETKILI_ROL: '1518397406578741348',
    IZIN_ROL_ID: process.env.IZIN_ROL_ID,
    YETKILI_ROL_ID: process.env.YETKILI_ROL_ID,
    LOG_KANAL_ID: process.env.LOG_KANAL_ID,
    VERI_DOSYASI: './tsa_veri.json'
};

let VERI = { izinler: {}, aktiflik: {}, sesSuresi: {} };
if (fs.existsSync(CONFIG.VERI_DOSYASI)) {
    try {
        VERI = JSON.parse(fs.readFileSync(CONFIG.VERI_DOSYASI));
        if (!VERI.izinler) VERI.izinler = {};
        if (!VERI.aktiflik) VERI.aktiflik = {};
        if (!VERI.sesSuresi) VERI.sesSuresi = {};
    } catch(e) { console.error("Veri okuma hatası:", e); }
}

let kaydetTimeout = null;
function veriKaydet() {
    if (kaydetTimeout) clearTimeout(kaydetTimeout);
    kaydetTimeout = setTimeout(() => {
        fs.writeFileSync(CONFIG.VERI_DOSYASI, JSON.stringify(VERI, null, 2));
    }, 5000);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });

// --- KOMUT TANIMLARI ---
const komutlar = [
    new SlashCommandBuilder().setName('ping').setDescription('Botun gecikme süresini gösterir'),
    new SlashCommandBuilder().setName('durum').setDescription('Sunucu durumunu gösterir'),
    new SlashCommandBuilder().setName('rütbeler').setDescription('Grup rütbelerini listeler'),
    new SlashCommandBuilder().setName('grup-bilgi').setDescription('Roblox grubu hakkında bilgi verir'),
    new SlashCommandBuilder().setName('profil').setDescription('Bir kullanıcının askeri künyesini gösterir').addUserOption(o=>o.setName('kullanici').setDescription('Bakılacak kullanıcı')),
    new SlashCommandBuilder().setName('liderlik').setDescription('Mesaj ve ses liderlik tablosunu gösterir'),
    new SlashCommandBuilder().setName('grup').setDescription('Roblox grup linkini gösterir'),
    new SlashCommandBuilder().setName('oyun').setDescription('Roblox oyun linkini gösterir'),
    new SlashCommandBuilder().setName('temizle').setDescription('Belirtilen miktarda mesaj siler').addIntegerOption(o=>o.setName('miktar').setDescription('Silinecek mesaj sayısı').setRequired(true).setMinValue(1).setMaxValue(100)).setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    new SlashCommandBuilder().setName('kick').setDescription('Kullanıcıyı sunucudan atar').addUserOption(o=>o.setName('kullanici').setDescription('Atılacak kullanıcı').setRequired(true)).addStringOption(o=>o.setName('sebep').setDescription('Atılma sebebi')).setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    new SlashCommandBuilder().setName('ban').setDescription('Kullanıcıyı yasaklar').addUserOption(o=>o.setName('kullanici').setDescription('Yasaklanacak kullanıcı').setRequired(true)).addStringOption(o=>o.setName('sebep').setDescription('Yasaklanma sebebi')).setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    new SlashCommandBuilder().setName('kilitle').setDescription('Kanalı mesaj gönderimine kapatır').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    new SlashCommandBuilder().setName('kilit-aç').setDescription('Kanalı tekrar mesaj gönderimine açar').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    new SlashCommandBuilder().setName('izin-al').setDescription('İzin talebi oluştur').addStringOption(o=>o.setName('sebep').setDescription('Sebep').setRequired(true)).addIntegerOption(o=>o.setName('gun').setDescription('Gün').setRequired(true)),
    new SlashCommandBuilder().setName('izin-iptal').setDescription('İzni iptal eder'),
    new SlashCommandBuilder().setName('izin-listesi').setDescription('İzinlileri gösterir'),
    new SlashCommandBuilder().setName('eğitim-duyuru').setDescription('Eğitim duyurusu hazırlar')
       .addStringOption(o=>o.setName('konu').setDescription('Eğitim konusu').setRequired(true))
       .addStringOption(o=>o.setName('saat').setDescription('Eğitim saati (Örn: 20:00)').setRequired(true))
       .addStringOption(o=>o.setName('yer').setDescription('Eğitim yeri').setRequired(true))
       .addStringOption(o=>o.setName('not').setDescription('Ekstra notlar')),
    new SlashCommandBuilder().setName('dm-mesaj').setDescription('Özel DM atar').addUserOption(o=>o.setName('kullanici').setDescription('Kullanıcı').setRequired(true)).addStringOption(o=>o.setName('mesaj').setDescription('Mesaj').setRequired(true)),
    new SlashCommandBuilder().setName('ses-katıl').setDescription('Botu sesli kanala sokar').addChannelOption(o=>o.setName('kanal').setDescription('Kanal').setRequired(true)),
    new SlashCommandBuilder().setName('ses-çıkış').setDescription('Botu sesli kanaldan çıkarır'),
    new SlashCommandBuilder().setName('şarkı-çal').setDescription('Link ile müzik çalar').addStringOption(o=>o.setName('link').setDescription('Link').setRequired(true)),
    new SlashCommandBuilder().setName('rütbe-bak').setDescription('Roblox kullanıcısının gruptaki rütbesini gösterir').addStringOption(o=>o.setName('isim').setDescription('Roblox kullanıcı adı').setRequired(true)),
    new SlashCommandBuilder().setName('rol-ver').setDescription('Kullanıcıya Discord rolü verir').addUserOption(o=>o.setName('kullanici').setDescription('Rol verilecek kişi').setRequired(true)).addRoleOption(o=>o.setName('rol').setDescription('Verilecek rol').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    new SlashCommandBuilder().setName('yardım').setDescription('Tüm komutları listeler')
].map(c=>c.toJSON());

// --- ETKİNLİKLER ---
client.once('ready', async () => {
    const rest = new REST({version:'10'}).setToken(CONFIG.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), {body: komutlar});
        console.log(`[Discord] ${client.user.tag} hazır.`);
        client.user.setActivity('TSA | /yardım', { type: ActivityType.Watching });
    } catch (error) { console.error('[Discord] Komut yükleme hatası:', error); }

    setInterval(izinKontrol, 1000 * 60 * 60);
});

const createEmbed = (title, desc, color = 0x0099FF) => new EmbedBuilder().setColor(color).setTitle(title).setDescription(desc).setTimestamp();

// --- İZİN KONTROLÜ ---
async function izinKontrol() {
    const simdi = new Date();
    for (const [userId, data] of Object.entries(VERI.izinler)) {
        const bitis = new Date(data.bitis);
        const kalanZaman = bitis.getTime() - simdi.getTime();
        if (kalanZaman > 0 && kalanZaman <= 24 * 60 * 60 * 1000 &&!data.hatirlatmaGonderildi) {
            try {
                const user = await client.users.fetch(userId);
                await user.send({ embeds: [createEmbed('📢 İzin Bilgilendirme', `Merhaba **${user.username}**,\n\nAldığınız izin yarın sona erecektir.`)] });
                VERI.izinler[userId].hatirlatmaGonderildi = true;
                veriKaydet();
            } catch (e) {}
        }
        if (kalanZaman <= 0) {
            for (const guild of client.guilds.cache.values()) {
                const member = await guild.members.fetch(userId).catch(() => null);
                if (member && CONFIG.IZIN_ROL_ID) {
                    await member.roles.remove(CONFIG.IZIN_ROL_ID).catch(() => {});
                    break;
                }
            }
            delete VERI.izinler[userId];
            veriKaydet();
        }
    }
}

client.on('interactionCreate', async i => {
    if(!i.isChatInputCommand()) return;

    if (i.commandName === 'ping') {
        return i.reply(`🏓 Pong! Gecikme: **${client.ws.ping}ms**`);
    }

    else if (i.commandName === 'profil') {
        const target = i.options.getUser('kullanici') || i.user;
        const msj = VERI.aktiflik[target.id] || 0;
        const ses = ((VERI.sesSuresi[target.id] || 0) / 3600).toFixed(1);
        const izin = VERI.izinler[target.id]? `✅ İzinli (Bitiş: ${new Date(VERI.izinler[target.id].bitis).toLocaleDateString('tr-TR')})` : '❌ İzinli değil';

        const embed = new EmbedBuilder()
           .setColor(0x00FF00)
           .setTitle(`🎖 Askeri Künye: ${target.username}`)
           .setThumbnail(target.displayAvatarURL())
           .addFields(
                { name: '💬 Mesaj Sayısı', value: `\`${msj.toLocaleString()}\``, inline: true },
                { name: '🔊 Ses Süresi', value: `\`${ses} saat\``, inline: true },
                { name: '📅 İzin Durumu', value: izin, inline: false }
            )
           .setTimestamp();
        return i.reply({ embeds: [embed] });
    }

    else if (i.commandName === 'grup-bilgi') {
        await i.deferReply();
        try {
            const info = await noblox.getGroup(CONFIG.GROUP_ID);
            const embed = new EmbedBuilder()
               .setColor(0xFF4500)
               .setTitle(`🏘 Grup Bilgisi: ${info.name}`)
               .setURL(`https://www.roblox.com/groups/${CONFIG.GROUP_ID}`)
               .setThumbnail(info.emblemUrl || null)
               .addFields(
                    { name: '👤 Sahibi', value: info.owner? info.owner.username : 'Yok', inline: true },
                    { name: '👥 Üye Sayısı', value: `\`${info.memberCount.toLocaleString()}\``, inline: true },
                    { name: '📝 Açıklama', value: info.description? (info.description.substring(0, 500) + '...') : 'Açıklama yok.' }
                );
            return i.editReply({ embeds: [embed] });
        } catch (e) { return i.editReply('Grup bilgileri alınırken hata oluştu. Grup public mi kontrol edin.'); }
    }

    else if (i.commandName === 'rütbeler') {
        await i.deferReply();
        try {
            const roles = await noblox.getRoles(CONFIG.GROUP_ID);
            const list = roles.sort((a,b) => b.rank - a.rank).map(r => `• **${r.name}** (Rank: ${r.rank})`).join('\n');
            return i.editReply({ embeds: [createEmbed('🎖 TSA Rütbeleri', list)] });
        } catch (e) { return i.editReply('Rütbeler çekilemedi. Roblox API izin vermiyor olabilir.'); }
    }

    else if (i.commandName === 'rütbe-bak') {
        await i.deferReply();
        const username = i.options.getString('isim');
        try {
            const userId = await noblox.getIdFromUsername(username);
            if (!userId) return i.editReply({ content: `❌ **${username}** adlı Roblox kullanıcısı bulunamadı.` });

            const rankName = await noblox.getRankNameInGroup(CONFIG.GROUP_ID, userId);
            const rankId = await noblox.getRankInGroup(CONFIG.GROUP_ID, userId);

            if (rankId === 0) return i.editReply({ content: `❌ **${username}** TSA grubunda değil.` });

            const embed = new EmbedBuilder()
              .setColor(0x2ECC71)
              .setTitle('🎖 TSA Rütbe Sorgu')
              .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png`)
              .addFields(
                    { name: '👤 Roblox İsmi', value: `\`${username}\``, inline: true },
                    { name: '🎖 Rütbe', value: `\`${rankName}\``, inline: true },
                    { name: '🆔 Rütbe ID', value: `\`${rankId}\``, inline: true },
                    { name: '🔗 Profil', value: `[Tıkla](https://www.roblox.com/users/${userId}/profile)` }
                )
              .setTimestamp();

            return i.editReply({ embeds: [embed] });
        } catch (e) {
            console.error(e);
            return i.editReply('❌ Roblox API hatası. Kullanıcı adı doğru mu? Grup public mi?');
        }
    }

    else if (i.commandName === 'rol-ver') {
        if (!CONFIG.YETKILI_ROL_ID ||!i.member.roles.cache.has(CONFIG.YETKILI_ROL_ID)) {
            return i.reply({ content: '❌ Bu komutu kullanmak için yetkin yok!', ephemeral: true });
        }

        const hedefKullanici = i.options.getMember('kullanici');
        const verilecekRol = i.options.getRole('rol');

        if (i.guild.members.me.roles.highest.position <= verilecekRol.position) {
            return i.reply({ content: '❌ Benim yetkim bu rolü vermeye yetmiyor. Rolümü daha üste taşı.', ephemeral: true });
        }

        if (i.member.roles.highest.position <= verilecekRol.position && i.user.id!== i.guild.ownerId) {
            return i.reply({ content: '❌ Kendinden yüksek veya aynı seviyede rol veremezsin.', ephemeral: true });
        }

        try {
            await hedefKullanici.roles.add(verilecekRol);
            const embed = createEmbed(
                '✅ Rol Verildi',
                `${hedefKullanici} kullanıcısına ${verilecekRol} rolü başarıyla verildi.`,
                0x00FF00
            ).setFooter({ text: `Yetkili: ${i.user.username}`, iconURL: i.user.displayAvatarURL() });

            i.reply({ embeds: [embed] });

            if (CONFIG.LOG_KANAL_ID) {
                const logKanal = i.guild.channels.cache.get(CONFIG.LOG_KANAL_ID);
                if (logKanal) logKanal.send({ embeds: [embed] });
            }
        } catch (e) {
            return i.reply({ content: `❌ Rol verilemedi: ${e.message}`, ephemeral: true });
        }
    }

    else if (i.commandName === 'eğitim-duyuru') {
        if (!i.member.roles.cache.has(CONFIG.EGITIM_YETKILI_ROL)) return i.reply({ content: 'Bu komutu kullanmak için yetkiniz yok!', ephemeral: true });

        const konu = i.options.getString('konu');
        const saat = i.options.getString('saat');
        const yer = i.options.getString('yer');
        const not = i.options.getString('not') || 'Belirtilmedi';

        const embed = new EmbedBuilder()
           .setColor(0xFF0000)
           .setTitle('📢 TSA EĞİTİM DUYURUSU')
           .setDescription('@everyone\n\nSunucumuzda yeni bir eğitim planlanmıştır. Tüm askerlerin katılımı beklenmektedir!')
           .addFields(
                { name: '📖 Konu', value: konu, inline: true },
                { name: '⏰ Saat', value: saat, inline: true },
                { name: '📍 Yer', value: yer, inline: true },
                { name: '📝 Notlar', value: not }
            )
           .setThumbnail(i.guild.iconURL())
           .setFooter({ text: `Eğitmen: ${i.user.username}`, iconURL: i.user.displayAvatarURL() })
           .setTimestamp();

        return i.reply({ content: '@everyone', embeds: [embed] });
    }

    else if (i.commandName === 'liderlik') {
        const msjSiralama = Object.entries(VERI.aktiflik).sort(([,a],[,b])=>b-a).slice(0,10);
        let desc = "🏆 **TSA Liderlik Tablosu**\n\n";
        const emojis = ["🥇", "🥈", "🥉", "4⃣", "5⃣", "6⃣", "7⃣", "8⃣", "9⃣", "🔟"];
        msjSiralama.forEach(([id, count], index) => {
            const sesSaat = ((VERI.sesSuresi[id] || 0) / 3600).toFixed(1);
            desc += `${emojis[index] || "🔹"} **${index+1}.** <@${id}> — ${count.toLocaleString()} mesaj | ${sesSaat} saat ses\n`;
        });
        return i.reply({ embeds: [createEmbed('🏆 TSA Liderlik', desc || 'Veri yok.', 0xFFD700)] });
    }

    else if (i.commandName === 'yardım') {
        const komutListesi = komutlar.map(c => `**/${c.name}** - ${c.description}`).join('\n');
        return i.reply({ embeds: [createEmbed('📜 TSA Bot Komutları', komutListesi)], ephemeral: true });
    }

    else if (i.commandName === 'temizle') {
        const m = i.options.getInteger('miktar');
        await i.deferReply({ ephemeral: true });
        try {
            const deleted = await i.channel.bulkDelete(m, true);
            return i.editReply(`🧹 **${deleted.size}** mesaj silindi. 14 günden eski mesajlar silinemez.`);
        } catch (e) {
            return i.editReply(`❌ Hata: ${e.message}`);
        }
    }
    else if (i.commandName === 'kick') {
        const u = i.options.getUser('kullanici');
        const s = i.options.getString('sebep') || 'Sebep yok';
        await i.guild.members.kick(u.id, s);
        i.reply(`👢 **${u.tag}** atıldı. Sebep: ${s}`);
    }
    else if (i.commandName === 'ban') {
        const u = i.options.getUser('kullanici');
        const s = i.options.getString('sebep') || 'Sebep yok';
        await i.guild.members.ban(u.id, { reason: s });
        i.reply(`🔨 **${u.tag}** yasaklandı. Sebep: ${s}`);
    }
    else if (i.commandName === 'kilitle') {
        await i.channel.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: false });
        i.reply('🔒 Kanal kilitlendi.');
    }
    else if (i.commandName === 'kilit-aç') {
        await i.channel.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: null });
        i.reply('🔓 Kanal açıldı.');
    }
    else if (i.commandName === 'grup') {
        i.reply('🏘 **TSA | Resmi Grubumuz:**\nhttps://www.roblox.com/tr/communities/972348115/TSA-Turkish-Armed-Forces-Yeniden');
    }
    else if (i.commandName === 'oyun') {
        i.reply('🎮 **TSA | Resmi Oyunumuz:**\nhttps://www.roblox.com/tr/games/138257110169831');
    }
    else if (i.commandName === 'izin-al') {
        const s = i.options.getString('sebep'), g = i.options.getInteger('gun');
        const b = new Date(); b.setDate(b.getDate() + g);
        VERI.izinler[i.user.id] = { sebep: s, bitis: b.toISOString(), hatirlatmaGonderildi: false };
        veriKaydet();
        if(CONFIG.IZIN_ROL_ID) i.member.roles.add(CONFIG.IZIN_ROL_ID).catch(()=>{});
        i.reply({ content: `✅ **${g}** gün izin alındı. Bitiş: **${b.toLocaleDateString('tr-TR')}**`, ephemeral: true });
    }
    else if (i.commandName === 'izin-iptal') {
        delete VERI.izinler[i.user.id]; veriKaydet();
        if(CONFIG.IZIN_ROL_ID) i.member.roles.remove(CONFIG.IZIN_ROL_ID).catch(()=>{});
        i.reply({ content: '✅ İzin iptal edildi.', ephemeral: true });
    }
    else if (i.commandName === 'izin-listesi') {
        const l = Object.entries(VERI.izinler).map(([id,v])=>`<@${id}>: ${v.sebep} (${new Date(v.bitis).toLocaleDateString('tr-TR')})`).join('\n');
        i.reply({ embeds: [createEmbed('📋 Aktif İzinliler', l || 'Aktif izinli yok.')] });
    }
    else if (i.commandName === 'şarkı-çal') {
        const link = i.options.getString('link');
        const channel = i.member.voice.channel;
        if(!channel) return i.reply({content: 'Ses kanalında olmalısın!', ephemeral: true});
        const connection = joinVoiceChannel({channelId: channel.id, guildId: i.guild.id, adapterCreator: i.guild.voiceAdapterCreator});
        const stream = await play.stream(link);
        const resource = createAudioResource(stream.stream, { inputType: stream.type });
        player.play(resource);
        connection.subscribe(player);
        i.reply('🎶 Müzik başlatıldı.');
    }
    else if (i.commandName === 'ses-katıl') {
        joinVoiceChannel({channelId: i.options.getChannel('kanal').id, guildId: i.guild.id, adapterCreator: i.guild.voiceAdapterCreator});
        i.reply('✅ Bağlanıldı.');
    }
    else if (i.commandName === 'ses-çıkış') {
        getVoiceConnection(i.guild.id)?.destroy();
        i.reply('🔇 Çıkış yapıldı.');
    }
    else if (i.commandName === 'dm-mesaj') {
        if (!i.member.roles.cache.has(CONFIG.DM_YETKILI_ROL)) return i.reply({ content: 'Yetkiniz yok!', ephemeral: true });
        const k = i.options.getUser('kullanici');
        const m = i.options.getString('mesaj');
        try {
            await k.send({ embeds: [createEmbed('📩 TSA Duyuru', m)] });
            i.reply({ content: `✅ DM gönderildi: ${k.tag}`, ephemeral: true });
        } catch { i.reply({ content: '❌ DM atılamadı.', ephemeral: true }); }
    }
});

// --- VERİ TAKİBİ ---
client.on('messageCreate', msg => {
    if(msg.author.bot) return;
    VERI.aktiflik[msg.author.id] = (VERI.aktiflik[msg.author.id] || 0) + 1;
    veriKaydet();
});

let sesGirisleri = {};
client.on('voiceStateUpdate', (oldS, newS) => {
    if (!oldS.channelId && newS.channelId) sesGirisleri[newS.id] = Date.now();
    else if (oldS.channelId &&!newS.channelId && sesGirisleri[oldS.id]) {
        VERI.sesSuresi[oldS.id] = (VERI.sesSuresi[oldS.id] || 0) + Math.floor((Date.now() - sesGirisleri[oldS.id]) / 1000);
        veriKaydet();
        delete sesGirisleri[oldS.id];
    }
});

process.on('unhandledRejection', err => {
    console.error('Yakalanamayan Hata:', err);
});

process.on('uncaughtException', err => {
    console.error('Yakalanamayan Exception:', err);
});

client.login(CONFIG.TOKEN);
