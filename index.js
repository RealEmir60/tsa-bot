const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, REST, Routes, ActivityType } = require('discord.js');
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
    GROUP_ID: parseInt(process.env.GROUP_ID),
    DM_YETKILI_ROL: '1518357646971764859',
    VERI_DOSYASI: './tsa_veri.json'
};

let VERI = { izinler: {}, aktiflik: {}, sesSuresi: {} };
if (fs.existsSync(CONFIG.VERI_DOSYASI)) {
    try { VERI = JSON.parse(fs.readFileSync(CONFIG.VERI_DOSYASI)); } catch(e) {}
}
function veriKaydet() { fs.writeFileSync(CONFIG.VERI_DOSYASI, JSON.stringify(VERI, null, 2)); }

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
});

const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });

// --- KOMUTLAR ---
const komutlar = [
    new SlashCommandBuilder().setName('ses-katıl').setDescription('Botu sesli kanala sokar').addChannelOption(o=>o.setName('kanal').setDescription('Kanal').setRequired(true)),
    new SlashCommandBuilder().setName('ses-çıkış').setDescription('Botu sesli kanaldan çıkarır'),
    new SlashCommandBuilder().setName('şarkı-çal').setDescription('YouTube linki ile müzik çalar').addStringOption(o=>o.setName('link').setDescription('Link').setRequired(true)),
    new SlashCommandBuilder().setName('dm-mesaj').setDescription('Özel DM atar').addUserOption(o=>o.setName('kullanici').setDescription('Kullanıcı').setRequired(true)).addStringOption(o=>o.setName('mesaj').setDescription('Mesaj').setRequired(true)),
    new SlashCommandBuilder().setName('durum').setDescription('Sunucu durumunu gösterir'),
    new SlashCommandBuilder().setName('rütbeler').setDescription('Grup rütbelerini listeler'),
    new SlashCommandBuilder().setName('aktiflik').setDescription('Aktiflik raporu').addUserOption(o=>o.setName('kullanici').setDescription('Asker').setRequired(false))
].map(c=>c.toJSON());

// --- ETKİNLİKLER ---
client.once('clientReady', async () => {
    const rest = new REST({version:'10'}).setToken(CONFIG.TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), {body: komutlar});
    console.log(`[Discord] ${client.user.tag} hazır.`);
});

const createEmbed = (title, desc, color = 0x0099FF) => new EmbedBuilder().setColor(color).setTitle(title).setDescription(desc).setTimestamp();

client.on('interactionCreate', async i => {
    if(!i.isChatInputCommand()) return;

    if(i.commandName === 'şarkı-çal') {
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
    
    else if(i.commandName === 'dm-mesaj') {
        if(!i.member.roles.cache.has(CONFIG.DM_YETKILI_ROL)) return i.reply({content: 'Yetkin yok!', ephemeral: true});
        const k = i.options.getUser('kullanici');
        const m = i.options.getString('mesaj');
        try { await k.send(m); i.reply({content: 'DM iletildi.', ephemeral: true}); } 
        catch(e) { i.reply({content: 'Kullanıcının DM kutusu kapalı.', ephemeral: true}); }
    }

    else if(i.commandName === 'durum') {
        i.reply({embeds: [createEmbed('🎖️ TSA Karargah', `Sunucuda ${i.guild.memberCount} asker var.`)]});
    }

    else if(i.commandName === 'rütbeler') {
        await i.deferReply();
        try {
            const roles = await noblox.getRoles(CONFIG.GROUP_ID);
            const list = roles.map(r => `• **${r.Name}**`).join('\n');
            i.editReply({embeds: [createEmbed('🎖️ Rütbeler', list)]});
        } catch(e) { i.editReply('Hata oluştu.'); }
    }

    else if(i.commandName === 'aktiflik') {
        const h = i.options.getUser('kullanici') || i.user;
        i.reply({embeds: [createEmbed('📊 Aktiflik', `${h.username}: ${VERI.sesSuresi[h.id] || 0} saniye ses, ${VERI.aktiflik[h.id] || 0} mesaj.`)]});
    }
    
    else if(i.commandName === 'ses-katıl') {
        const channel = i.options.getChannel('kanal');
        joinVoiceChannel({channelId: channel.id, guildId: i.guild.id, adapterCreator: i.guild.voiceAdapterCreator});
        i.reply('✅ Bağlanıldı.');
    }
    
    else if(i.commandName === 'ses-çıkış') {
        getVoiceConnection(i.guild.id)?.destroy();
        i.reply('🔇 Çıkış yapıldı.');
    }
});

// --- SES TAKİP & MESAJ SAYACI ---
client.on('messageCreate', msg => {
    if(msg.author.bot) return;
    VERI.aktiflik[msg.author.id] = (VERI.aktiflik[msg.author.id] || 0) + 1;
    veriKaydet();
});

let sesGirisleri = {};
client.on('voiceStateUpdate', (oldS, newS) => {
    if (!oldS.channelId && newS.channelId) sesGirisleri[newS.id] = Date.now();
    else if (oldS.channelId && !newS.channelId && sesGirisleri[oldS.id]) {
        VERI.sesSuresi[oldS.id] = (VERI.sesSuresi[oldS.id] || 0) + Math.floor((Date.now() - sesGirisleri[oldS.id]) / 1000);
        veriKaydet();
        delete sesGirisleri[oldS.id];
    }
});

client.login(CONFIG.TOKEN);
