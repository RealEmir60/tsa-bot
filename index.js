const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, REST, Routes, ActivityType, PermissionFlagsBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection, NoSubscriberBehavior } = require('@discordjs/voice');
const play = require('play-dl');
const fs = require('fs');
const express = require('express');
const noblox = require('noblox.js');
require('dotenv').config();

// WEB
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('TSA Bot Aktif'));
app.listen(PORT, '0.0.0.0', () => console.log(`[Web] ${PORT}`));

// CONFIG
const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    GROUP_ID: parseInt(process.env.GROUP_ID) || 972348115,
    DM_YETKILI_ROL: '1518357646971764859',
    EGITIM_YETKILI_ROL: '1518397406578741348',
    IZIN_ROL_ID: process.env.IZIN_ROL_ID,
    YETKILI_ROL_ID: process.env.YETKILI_ROL_ID,
    LOG_KANAL_ID: process.env.LOG_KANAL_ID,
    UYARI_1_ROL_ID: process.env.UYARI_1_ROL_ID,
    UYARI_2_ROL_ID: process.env.UYARI_2_ROL_ID,
    UYARI_3_ROL_ID: process.env.UYARI_3_ROL_ID,
    HABER_ROL_ID: process.env.HABER_ROL_ID,
    HABER_KANAL_ID: process.env.HABER_KANAL_ID,
    VERI_DOSYASI: './tsa_veri.json'
};

let VERI = { izinler: {}, aktiflik: {}, sesSuresi: {}, uyarilar: {} };
if (fs.existsSync(CONFIG.VERI_DOSYASI)) {
    try { VERI = JSON.parse(fs.readFileSync(CONFIG.VERI_DOSYASI)); } catch {}
    VERI.izinler = VERI.izinler || {}; VERI.aktiflik = VERI.aktiflik || {}; VERI.sesSuresi = VERI.sesSuresi || {}; VERI.uyarilar = VERI.uyarilar || {};
}
function veriKaydet(){ fs.writeFileSync(CONFIG.VERI_DOSYASI, JSON.stringify(VERI, null, 2)); }

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });
const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });

const komutlar = [
    new SlashCommandBuilder().setName('ping').setDescription('Bot gecikmesi'),
    new SlashCommandBuilder().setName('profil').setDescription('Künye').addUserOption(o=>o.setName('kullanici')),
    new SlashCommandBuilder().setName('liderlik').setDescription('Liderlik'),
    new SlashCommandBuilder().setName('grup-bilgi').setDescription('Grup bilgisi'),
    new SlashCommandBuilder().setName('rütbeler').setDescription('Rütbeler'),
    new SlashCommandBuilder().setName('rütbe-bak').setDescription('Rütbe sorgu').addStringOption(o=>o.setName('isim').setRequired(true)),
    new SlashCommandBuilder().setName('grup').setDescription('Grup link'),
    new SlashCommandBuilder().setName('oyun').setDescription('Oyun link'),
    new SlashCommandBuilder().setName('temizle').setDescription('Sil').addIntegerOption(o=>o.setName('miktar').setRequired(true).setMinValue(1).setMaxValue(100)).setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    new SlashCommandBuilder().setName('kick').setDescription('At').addUserOption(o=>o.setName('kullanici').setRequired(true)).addStringOption(o=>o.setName('sebep')).setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    new SlashCommandBuilder().setName('ban').setDescription('Ban').addUserOption(o=>o.setName('kullanici').setRequired(true)).addStringOption(o=>o.setName('sebep')).setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    new SlashCommandBuilder().setName('kilitle').setDescription('Kilitle').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    new SlashCommandBuilder().setName('kilit-aç').setDescription('Aç').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    new SlashCommandBuilder().setName('izin-al').setDescription('İzin').addStringOption(o=>o.setName('sebep').setRequired(true)).addIntegerOption(o=>o.setName('gun').setRequired(true)),
    new SlashCommandBuilder().setName('izin-iptal').setDescription('İptal'),
    new SlashCommandBuilder().setName('izin-listesi').setDescription('Liste'),
    new SlashCommandBuilder().setName('eğitim-duyuru').setDescription('Eğitim').addStringOption(o=>o.setName('konu').setRequired(true)).addStringOption(o=>o.setName('saat').setRequired(true)).addStringOption(o=>o.setName('yer').setRequired(true)).addStringOption(o=>o.setName('not')),
    new SlashCommandBuilder().setName('dm-mesaj').setDescription('DM').addUserOption(o=>o.setName('kullanici').setRequired(true)).addStringOption(o=>o.setName('mesaj').setRequired(true)),
    new SlashCommandBuilder().setName('ses-katıl').setDescription('Sese gir').addChannelOption(o=>o.setName('kanal').setRequired(true)),
    new SlashCommandBuilder().setName('ses-çıkış').setDescription('Çık'),
    new SlashCommandBuilder().setName('şarkı-çal').setDescription('Müzik').addStringOption(o=>o.setName('link').setRequired(true)),
    new SlashCommandBuilder().setName('rol-ver').setDescription('Rol ver').addUserOption(o=>o.setName('kullanici').setRequired(true)).addRoleOption(o=>o.setName('rol').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    new SlashCommandBuilder().setName('rol-al').setDescription('Rol al').addUserOption(o=>o.setName('kullanici').setRequired(true)).addRoleOption(o=>o.setName('rol').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    new SlashCommandBuilder().setName('uyarı-ver').setDescription('Uyarı').addUserOption(o=>o.setName('kullanici').setRequired(true)).addStringOption(o=>o.setName('sebep').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    new SlashCommandBuilder().setName('uyarı-sil').setDescription('Uyarı sil').addUserOption(o=>o.setName('kullanici').setRequired(true)).addIntegerOption(o=>o.setName('sira').setRequired(true).setMinValue(1).setMaxValue(3)).setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    new SlashCommandBuilder().setName('sicil').setDescription('Sicil').addUserOption(o=>o.setName('kullanici')),
    new SlashCommandBuilder().setName('haber-yap').setDescription('Haber').addStringOption(o=>o.setName('baslik').setRequired(true)).addStringOption(o=>o.setName('icerik').setRequired(true)).addAttachmentOption(o=>o.setName('gorsel')),
    new SlashCommandBuilder().setName('yardım').setDescription('Yardım')
].map(c=>c.toJSON());

client.once('ready', async () => {
    await new REST({version:'10'}).setToken(CONFIG.TOKEN).put(Routes.applicationCommands(client.user.id), {body: komutlar});
    console.log(`${client.user.tag} hazır`);
    client.user.setActivity('TSA | /yardım', { type: ActivityType.Watching });
});

const createEmbed = (t,d,c=0x0099FF)=> new EmbedBuilder().setColor(c).setTitle(t).setDescription(d).setTimestamp();

client.on('interactionCreate', async i => {
    if(!i.isChatInputCommand()) return;
    const cmd = i.commandName;

    if(cmd==='ping') return i.reply(`Pong ${client.ws.ping}ms`);

    if(cmd==='haber-yap'){
        if(!i.member.roles.cache.has(CONFIG.HABER_ROL_ID)) return i.reply({content:'❌ Yetkin yok', ephemeral:true});
        const kanal = i.guild.channels.cache.get(CONFIG.HABER_KANAL_ID);
        if(!kanal) return i.reply({content:'❌ Kanal yok', ephemeral:true});
        const baslik = i.options.getString('baslik');
        const icerik = i.options.getString('icerik');
        const gorsel = i.options.getAttachment('gorsel');
        const embed = new EmbedBuilder().setColor(0x1E90FF).setTitle(`📰 ${baslik}`).setDescription(icerik).setAuthor({name:'TSA RESMİ HABER', iconURL:i.guild.iconURL()}).setFooter({text:`Haber Yapan: ${i.user.username}`, iconURL:i.user.displayAvatarURL()}).setTimestamp();
        if(gorsel?.contentType?.startsWith('image/')) embed.setImage(gorsel.url);
        await i.deferReply({ephemeral:true});
        await kanal.send({content:'@everyone', embeds:[embed]});
        return i.editReply(`✅ ${kanal} kanalına gönderildi`);
    }

    if(cmd==='uyarı-ver'){
        if(!i.member.roles.cache.has(CONFIG.YETKILI_ROL_ID)) return i.reply({content:'❌ Yetkin yok', ephemeral:true});
        const hedef = i.options.getMember('kullanici'); const sebep = i.options.getString('sebep');
        VERI.uyarilar[hedef.id] = VERI.uyarilar[hedef.id]||[];
        VERI.uyarilar[hedef.id].push({sebep, yetkili:i.user.id, tarih:new Date().toISOString()}); veriKaydet();
        const sayi = VERI.uyarilar[hedef.id].length;
        const roller = [CONFIG.UYARI_1_ROL_ID, CONFIG.UYARI_2_ROL_ID, CONFIG.UYARI_3_ROL_ID];
        if(roller[sayi-1]) await hedef.roles.add(roller[sayi-1]).catch(()=>{});
        try{ await hedef.send({embeds:[new EmbedBuilder().setColor(0xFF0000).setTitle('⚠️ TSA UYARI').setDescription(`Sebep: ${sebep}
Uyarı: ${sayi}/3`)]});}catch{}
        if(sayi===3) setTimeout(()=>hedef.kick('3 uyarı').catch(()=>{}),5000);
        return i.reply({embeds:[createEmbed('Uyarı Verildi', `${hedef} - ${sebep} (${sayi}/3)`, 0xFFA500)]});
    }

    if(cmd==='uyarı-sil'){
        if(!i.member.roles.cache.has(CONFIG.YETKILI_ROL_ID)) return i.reply({content:'❌ Yetkin yok', ephemeral:true});
        const hedef = i.options.getMember('kullanici'); const sira = i.options.getInteger('sira');
        if(!VERI.uyarilar[hedef.id] || VERI.uyarilar[hedef.id].length < sira) return i.reply({content:'Uyarı yok', ephemeral:true});
        VERI.uyarilar[hedef.id].splice(sira-1,1); veriKaydet();
        return i.reply({content:`${sira}. uyarı silindi`, ephemeral:true});
    }

    if(cmd==='sicil'){
        const hedef = i.options.getMember('kullanici')||i.member; const u = VERI.uyarilar[hedef.id]||[];
        if(!u.length) return i.reply({embeds:[createEmbed('Temiz Sicil','Yok',0x00FF00)]});
        return i.reply({embeds:[createEmbed(`Sicil: ${hedef.user.username}`, u.map((x,j)=>`${j+1}. ${x.sebep}`).join('
'), 0xFFA500)], ephemeral:true});
    }

    if(cmd==='profil'){
        const t = i.options.getUser('kullanici')||i.user;
        const msj = VERI.aktiflik[t.id]||0; const ses = ((VERI.sesSuresi[t.id]||0)/3600).toFixed(1); const uy = (VERI.uyarilar[t.id]||[]).length;
        return i.reply({embeds:[new EmbedBuilder().setColor(0x00FF00).setTitle(`Künye: ${t.username}`).addFields({name:'Mesaj',value:`${msj}`,inline:true},{name:'Ses',value:`${ses}h`,inline:true},{name:'Uyarı',value:`${uy}/3`,inline:true})]});
    }

    if(cmd==='rütbe-bak'){
        await i.deferReply(); const name = i.options.getString('isim');
        try{ const id = await noblox.getIdFromUsername(name); const rank = await noblox.getRankNameInGroup(CONFIG.GROUP_ID, id); return i.editReply(`${name}: ${rank}`);}catch{ return i.editReply('Hata');}
    }

    if(cmd==='rol-ver'){
        if(!i.member.roles.cache.has(CONFIG.YETKILI_ROL_ID)) return i.reply({content:'Yetkin yok', ephemeral:true});
        const u = i.options.getMember('kullanici'); const r = i.options.getRole('rol'); await u.roles.add(r); return i.reply(`✅ ${u} +${r.name}`);
    }
    if(cmd==='rol-al'){
        if(!i.member.roles.cache.has(CONFIG.YETKILI_ROL_ID)) return i.reply({content:'Yetkin yok', ephemeral:true});
        const u = i.options.getMember('kullanici'); const r = i.options.getRole('rol'); await u.roles.remove(r); return i.reply(`✅ ${u} -${r.name}`);
    }

    if(cmd==='grup-bilgi'){ await i.deferReply(); try{ const g = await noblox.getGroup(CONFIG.GROUP_ID); return i.editReply(`${g.name} - ${g.memberCount} üye`);}catch{ return i.editReply('Hata');}}
    if(cmd==='rütbeler'){ await i.deferReply(); try{ const rs = await noblox.getRoles(CONFIG.GROUP_ID); return i.editReply(rs.map(r=>r.name).join(', '));}catch{ return i.editReply('Hata');}}
    if(cmd==='grup') return i.reply('https://www.roblox.com/groups/972348115');
    if(cmd==='oyun') return i.reply('https://www.roblox.com/games/138257110169831');
    if(cmd==='temizle'){ const m=i.options.getInteger('miktar'); await i.channel.bulkDelete(m,true); return i.reply({content:`${m} silindi`, ephemeral:true});}
    if(cmd==='kick'){ const u=i.options.getUser('kullanici'); await i.guild.members.kick(u.id); return i.reply(`${u.tag} atıldı`);}
    if(cmd==='ban'){ const u=i.options.getUser('kullanici'); await i.guild.members.ban(u.id); return i.reply(`${u.tag} banlandı`);}
    if(cmd==='kilitle'){ await i.channel.permissionOverwrites.edit(i.guild.roles.everyone,{SendMessages:false}); return i.reply('Kilitlendi');}
    if(cmd==='kilit-aç'){ await i.channel.permissionOverwrites.edit(i.guild.roles.everyone,{SendMessages:null}); return i.reply('Açıldı');}
    if(cmd==='izin-al'){ const s=i.options.getString('sebep'); const g=i.options.getInteger('gun'); VERI.izinler[i.user.id]={sebep:s, bitis:new Date(Date.now()+g*86400000).toISOString()}; veriKaydet(); if(CONFIG.IZIN_ROL_ID) await i.member.roles.add(CONFIG.IZIN_ROL_ID).catch(()=>{}); return i.reply({content:'İzin alındı', ephemeral:true});}
    if(cmd==='izin-iptal'){ delete VERI.izinler[i.user.id]; veriKaydet(); if(CONFIG.IZIN_ROL_ID) await i.member.roles.remove(CONFIG.IZIN_ROL_ID).catch(()=>{}); return i.reply({content:'İptal', ephemeral:true});}
    if(cmd==='izin-listesi'){ const l=Object.entries(VERI.izinler).map(([id,v])=>`<@${id}>: ${v.sebep}`).join('
')||'Yok'; return i.reply({embeds:[createEmbed('İzinliler',l)]});}
    if(cmd==='eğitim-duyuru'){ const k=i.options.getString('konu'); const s=i.options.getString('saat'); const y=i.options.getString('yer'); return i.reply({content:'@everyone', embeds:[new EmbedBuilder().setTitle('EĞİTİM').setDescription(`${k}
${s}
${y}`)]});}
    if(cmd==='dm-mesaj'){ if(!i.member.roles.cache.has(CONFIG.DM_YETKILI_ROL)) return i.reply({content:'Yetkin yok',ephemeral:true}); const u=i.options.getUser('kullanici'); const m=i.options.getString('mesaj'); await u.send(m).catch(()=>{}); return i.reply({content:'Gönderildi',ephemeral:true});}
    if(cmd==='ses-katıl'){ const k=i.options.getChannel('kanal'); joinVoiceChannel({channelId:k.id,guildId:i.guild.id,adapterCreator:i.guild.voiceAdapterCreator}); return i.reply('Girildi');}
    if(cmd==='ses-çıkış'){ getVoiceConnection(i.guild.id)?.destroy(); return i.reply('Çıkıldı');}
    if(cmd==='şarkı-çal'){ const l=i.options.getString('link'); const vc=i.member.voice.channel; if(!vc) return i.reply({content:'Seste değilsin',ephemeral:true}); const conn=joinVoiceChannel({channelId:vc.id,guildId:i.guild.id,adapterCreator:i.guild.voiceAdapterCreator}); const s=await play.stream(l); player.play(createAudioResource(s.stream,{inputType:s.type})); conn.subscribe(player); return i.reply('Çalıyor');}
    if(cmd==='liderlik'){ const top=Object.entries(VERI.aktiflik).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([id,c],j)=>`${j+1}. <@${id}>: ${c}`).join('
'); return i.reply({embeds:[createEmbed('Liderlik',top||'Yok')]})}
    if(cmd==='yardım'){ return i.reply({embeds:[createEmbed('Komutlar', komutlar.map(c=>`/${c.name}`).join(', '))], ephemeral:true});}
});

client.on('messageCreate', m=>{ if(!m.author.bot){ VERI.aktiflik[m.author.id]=(VERI.aktiflik[m.author.id]||0)+1; veriKaydet(); }});
let ses={}; client.on('voiceStateUpdate',(o,n)=>{ if(!o.channelId&&n.channelId) ses[n.id]=Date.now(); else if(o.channelId&&!n.channelId&&ses[o.id]){ VERI.sesSuresi[o.id]=(VERI.sesSuresi[o.id]||0)+Math.floor((Date.now()-ses[o.id])/1000); veriKaydet(); delete ses[o.id]; }});
client.login(CONFIG.TOKEN);
