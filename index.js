const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, REST, Routes, PermissionFlagsBits, ActivityType } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection, NoSubscriberBehavior } = require('@discordjs/voice');
const play = require('play-dl');
const fs = require('fs');
const express = require('express');
require('dotenv').config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
});

const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    IZIN_ROL_ID: process.env.IZIN_ROL_ID,
    DM_YETKILI_ROL: '1518357646971764859',
    GRUP_LINK: 'https://www.roblox.com/tr/communities/972348115/TSA-Turkish-Armed-Forces-Yeniden',
    OYUN_LINK: 'https://www.roblox.com/tr/games/138257110169831/T-rk-Asker-Oyunu',
    VERI_DOSYASI: './tsa_veri.json'
};

// Data işlemleri
let VERI = { izinler: {}, aktiflik: {} };
if (fs.existsSync(CONFIG.VERI_DOSYASI)) { try { VERI = JSON.parse(fs.readFileSync(CONFIG.VERI_DOSYASI)); } catch(e) {} }
function veriKaydet() { fs.writeFileSync(CONFIG.VERI_DOSYASI, JSON.stringify(VERI, null, 2)); }

const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });

// Komutlar
const komutlar = [
    new SlashCommandBuilder().setName('ses-katıl').setDescription('Botu sesli kanala sokar').addChannelOption(o=>o.setName('kanal').setDescription('Kanal').setRequired(true)),
    new SlashCommandBuilder().setName('ses-çıkış').setDescription('Botu sesli kanaldan çıkarır'),
    new SlashCommandBuilder().setName('çal').setDescription('Müzik çalar').addStringOption(o=>o.setName('link').setDescription('Link').setRequired(true)),
    new SlashCommandBuilder().setName('temizle').setDescription('Mesaj siler').addIntegerOption(o=>o.setName('adet').setDescription('1-100').setRequired(true)),
    new SlashCommandBuilder().setName('izin-al').setDescription('İzin talebi oluştur').addStringOption(o=>o.setName('sebep').setDescription('Sebep').setRequired(true)).addIntegerOption(o=>o.setName('gun').setDescription('Gün').setRequired(true)),
    new SlashCommandBuilder().setName('izin-iptal').setDescription('İzni iptal eder'),
    new SlashCommandBuilder().setName('izin-listesi').setDescription('İzinlileri gösterir'),
    new SlashCommandBuilder().setName('dm-duyuru').setDescription('Kullanıcıya özel duyuru').addUserOption(o=>o.setName('kullanici').setDescription('Kullanıcı').setRequired(true)).addStringOption(o=>o.setName('mesaj').setDescription('Mesaj').setRequired(true)),
    new SlashCommandBuilder().setName('grup').setDescription('Grup linkini atar'),
    new SlashCommandBuilder().setName('oyun').setDescription('Oyun linkini atar'),
    new SlashCommandBuilder().setName('aktiflik-sıralama').setDescription('Sıralamayı gösterir')
].map(c=>c.toJSON());

client.once('ready', async () => {
    const rest = new REST({version:'10'}).setToken(CONFIG.TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), {body: komutlar});
    console.log(`[${client.user.tag}] Başarıyla başlatıldı.`);
});

// UI Helper
const createEmbed = (title, desc, color = 0x0099FF) => new EmbedBuilder().setColor(color).setTitle(title).setDescription(desc).setTimestamp().setFooter({text: 'TSA Komutanlığı'});

client.on('interactionCreate', async i => {
    if(!i.isChatInputCommand()) return;

    if(i.commandName === 'dm-duyuru') {
        if(!i.member.roles.cache.has(CONFIG.DM_YETKILI_ROL)) return i.reply({embeds: [createEmbed('❌ Yetki Hatası', 'Yetkiniz yok.', 0xFF0000)], ephemeral: true});
        const k = i.options.getUser('kullanici');
        const m = i.options.getString('mesaj');
        try {
            await k.send({content: `${k}`, embeds: [createEmbed('📢 ÖZEL BİLDİRİM', `Merhaba ${k},\n\n${m}`, 0xFFD700)]});
            await i.reply({embeds: [createEmbed('✅ Gönderildi', `${k} kişisine iletildi.`, 0x00FF00)], ephemeral: true});
        } catch(e) { await i.reply({embeds: [createEmbed('❌ Hata', 'DM kapalı.', 0xFF0000)], ephemeral: true}); }
    }
    else if(i.commandName === 'izin-al') {
        const s = i.options.getString('sebep'), g = i.options.getInteger('gun');
        const b = new Date(); b.setDate(b.getDate() + g);
        VERI.izinler[i.user.id] = {sebep: s, bitis: b.toISOString()};
        veriKaydet();
        if(CONFIG.IZIN_ROL_ID) await i.member.roles.add(CONFIG.IZIN_ROL_ID).catch(()=>{});
        await i.reply({embeds: [createEmbed('✅ Onaylandı', `**${i.user.username}**, izniniz kaydedildi.\nBitiş: <t:${Math.floor(b.getTime()/1000)}:D>`, 0x00FF00)], ephemeral: true});
    }
    else if(i.commandName === 'izin-iptal') {
        delete VERI.izinler[i.user.id]; veriKaydet();
        if(CONFIG.IZIN_ROL_ID) await i.member.roles.remove(CONFIG.IZIN_ROL_ID).catch(()=>{});
        await i.reply({embeds: [createEmbed('✅ İptal Edildi', 'İzniniz sistemden silindi.', 0xFFFF00)], ephemeral: true});
    }
    else if(i.commandName === 'izin-listesi') {
        const l = Object.entries(VERI.izinler);
        if(l.length === 0) return i.reply({embeds: [createEmbed('📭 Liste Boş', 'Şu an izinli kimse yok.', 0x0099FF)], ephemeral: true});
        await i.reply({embeds: [createEmbed('📋 Aktif İzinliler', l.map(([id,v])=>`<@${id}>: ${v.sebep}`).join('\n'))], ephemeral: true});
    }
    else if(i.commandName === 'ses-katıl') {
        const k = i.options.getChannel('kanal');
        joinVoiceChannel({channelId: k.id, guildId: i.guild.id, adapterCreator: i.guild.voiceAdapterCreator}).subscribe(player);
        await i.reply({embeds: [createEmbed('🔊 Bağlanıldı', `${k} kanalına giriş yapıldı.`, 0x00FF00)], ephemeral: true});
    }
    else if(i.commandName === 'ses-çıkış') {
        const c = getVoiceConnection(i.guild.id);
        if(c) { c.destroy(); await i.reply({embeds: [createEmbed('🔇 Çıkış Yapıldı', 'Ses kanalından ayrıldım.', 0xFF0000)], ephemeral: true}); }
    }
    else if(i.commandName === 'grup') {
        await i.reply({embeds: [createEmbed('🪖 TSA Grubu', `[Grup Linki İçin Tıkla](${CONFIG.GRUP_LINK})`, 0x0099FF)]});
    }
    else if(i.commandName === 'oyun') {
        await i.reply({embeds: [createEmbed('🎮 TSA Oyunu', `[Oyuna Gitmek İçin Tıkla](${CONFIG.OYUN_LINK})`, 0x00FF00)]});
    }
    else if(i.commandName === 'temizle') {
        const a = i.options.getInteger('adet');
        await i.channel.bulkDelete(a, true);
        await i.reply({embeds: [createEmbed('🧹 Temizlendi', `${a} adet mesaj silindi.`, 0x00FF00)], ephemeral: true});
    }
    else if(i.commandName === 'aktiflik-sıralama') {
        const s = Object.entries(VERI.aktiflik).sort((a,b)=>b[1]-a[1]).slice(0,10);
        await i.reply({embeds: [createEmbed('📊 Aktiflik', s.map((v,n)=>`${n+1}. <@${v[0]}> - **${v[1]} mesaj**`).join('\n') || 'Veri yok', 0xFFD700)]});
    }
});

client.login(CONFIG.TOKEN);
