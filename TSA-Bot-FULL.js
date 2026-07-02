const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, REST, Routes, PermissionFlagsBits, ActivityType } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection, NoSubscriberBehavior } = require('@discordjs/voice');
const play = require('play-dl');
const fs = require('fs');
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
    GRUP_LINK: 'https://www.roblox.com/tr/communities/972348115/TSA-Turkish-Armed-Forces-Yeniden',
    OYUN_LINK: 'https://www.roblox.com/tr/games/138257110169831/T-rk-Asker-Oyunu',
    VERI_DOSYASI: './tsa_veri.json'
};

let VERI = { izinler: {}, aktiflik: {} };
if (fs.existsSync(CONFIG.VERI_DOSYASI)) {
    try { VERI = JSON.parse(fs.readFileSync(CONFIG.VERI_DOSYASI)); } catch(e) {}
}
function veriKaydet(){ fs.writeFileSync(CONFIG.VERI_DOSYASI, JSON.stringify(VERI, null, 2)); }

const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });

const komutlar = [
    new SlashCommandBuilder().setName('ses-katıl').setDescription('Botu sesli kanala sokar').addChannelOption(o=>o.setName('kanal').setDescription('Kanal').setRequired(true)),
    new SlashCommandBuilder().setName('ses-çıkış').setDescription('Botu sesli kanaldan çıkarır'),
    new SlashCommandBuilder().setName('çal').setDescription('Müzik çalar').addStringOption(o=>o.setName('link').setDescription('YouTube linki').setRequired(true)),
    new SlashCommandBuilder().setName('aktiflik-sıralama').setDescription('Aktiflik sıralamasını gösterir'),
    new SlashCommandBuilder().setName('temizle').setDescription('Mesaj siler').addIntegerOption(o=>o.setName('adet').setDescription('1-100 arası').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    new SlashCommandBuilder().setName('duyuru').setDescription('Duyuru gönderir').addStringOption(o=>o.setName('mesaj').setDescription('Duyuru').setRequired(true)).addChannelOption(o=>o.setName('kanal').setDescription('Kanal')).setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('izin-al').setDescription('İzin talebi oluşturur').addStringOption(o=>o.setName('sebep').setDescription('İzin sebebi').setRequired(true)).addIntegerOption(o=>o.setName('gun').setDescription('Kaç gün').setRequired(true)),
    new SlashCommandBuilder().setName('izin-iptal').setDescription('İznini iptal eder'),
    new SlashCommandBuilder().setName('izin-listesi').setDescription('Aktif izinleri listeler'),
    new SlashCommandBuilder().setName('grup').setDescription('TSA Roblox grup linkini atar'),
    new SlashCommandBuilder().setName('oyun').setDescription('TSA Roblox oyun linkini atar')
].map(c=>c.toJSON());

client.once('clientReady', async () => {
    console.log(`[Discord] | TSA Bot | ${client.user.tag} aktif!`);
    
    // Durumu ayarla
    client.user.setPresence({
        activities: [{ name: 'TSA- Turkish Special Army', type: ActivityType.Playing }],
        status: 'online'
    });
    
    const rest = new REST({version:'10'}).setToken(CONFIG.TOKEN);
    try{await rest.put(Routes.applicationCommands(client.user.id),{body:komutlar});console.log(`[Discord] ✅ ${komutlar.length} komut yüklendi`)}catch(e){console.error(e)}
});

client.on('messageCreate', async msg => {
    if(msg.author.bot) return;
    if(msg.content.trim() === ':') {
        const embed = new EmbedBuilder()
           .setColor(0x0099FF)
           .setTitle('🪖 TSA Roblox Grubu')
           .setDescription(`**Katılmak için tıkla:**\n${CONFIG.GRUP_LINK}`)
           .setURL(CONFIG.GRUP_LINK)
           .setThumbnail('https://tr.rbxcdn.com/180DAY-AvatarHeadshot-A1A1A1-Png/150/150/AvatarHeadshot/Webp/noFilter')
           .setFooter({text: 'Turkish Special Army'});
        await msg.reply({embeds: [embed]});
    }

    if(!VERI.aktiflik[msg.author.id]) VERI.aktiflik[msg.author.id] = 0;
    VERI.aktiflik[msg.author.id]++;
    if(VERI.aktiflik[msg.author.id] % 50 === 0) veriKaydet();
});

client.on('interactionCreate', async i => {
    if(!i.isChatInputCommand()) return;
    const n = i.commandName;

    try {
        if(n==='ses-katıl'){
            const k=i.options.getChannel('kanal');
            if(!k.isVoiceBased())return i.reply({content:'❌ Ses kanalı seç!',ephemeral:true});
            const c=joinVoiceChannel({channelId:k.id,guildId:i.guild.id,adapterCreator:i.guild.voiceAdapterCreator});
            c.subscribe(player);
            await i.reply({content:`✅ ${k} kanalına katıldım!`,ephemeral:true});
        }
        else if(n==='ses-çıkış'){
            const c=getVoiceConnection(i.guild.id);
            if(!c)return i.reply({content:'❌ Kanalda değilim!',ephemeral:true});
            player.stop();c.destroy();
            await i.reply({content:'✅ Sesli kanaldan çıktım!',ephemeral:true});
        }
        else if(n==='çal'){
            await i.deferReply();
            const link=i.options.getString('link');
            const c=getVoiceConnection(i.guild.id);
            if(!c)return i.editReply('❌ Önce `/ses-katıl` kullan!');
            try{
                const s=await play.stream(link,{discordPlayerCompatibility:true});
                const r=createAudioResource(s.stream,{inputType:s.type});
                player.play(r);
                await i.editReply(`🎵 Çalıyor: ${link}`);
            }catch(e){await i.editReply('❌ Çalınamadı!');}
        }
        else if(n==='aktiflik-sıralama'){
            const s=Object.entries(VERI.aktiflik).sort((a,b)=>b[1]-a[1]).slice(0,10);
            const embed=new EmbedBuilder()
               .setColor(0xFFD700)
               .setTitle('📊 Aktiflik Sıralaması - Top 10')
               .setDescription(s.length?s.map((v,i)=>`**${i+1}.** <@${v[0]}> - ${v[1]} mesaj`).join('\n'):'Veri yok')
               .setFooter({text:'TSA Aktiflik Sistemi'})
               .setTimestamp();
            await i.reply({embeds:[embed]});
        }
        else if(n==='temizle'){
            const a=i.options.getInteger('adet');
            if(a<1||a>100)return i.reply({content:'❌ 1-100 arası!',ephemeral:true});
            await i.channel.bulkDelete(a,true);
            await i.reply({content:`✅ ${a} mesaj silindi!`,ephemeral:true});
        }
        else if(n==='duyuru'){
            const m=i.options.getString('mesaj');
            const k=i.options.getChannel('kanal')||i.channel;
            const embed=new EmbedBuilder()
               .setColor(0xFF0000)
               .setTitle('📢 TSA DUYURU')
               .setDescription(m)
               .setAuthor({name:i.user.username,iconURL:i.user.displayAvatarURL()})
               .setFooter({text:'Turkish Special Army Komutanlığı'})
               .setTimestamp();
            await k.send({content:'@everyone',embeds:[embed]});
            await i.reply({content:`✅ Duyuru ${k} kanalına gönderildi!`,ephemeral:true});
        }
        else if(n==='izin-al'){
            const s=i.options.getString('sebep'),g=i.options.getInteger('gun');
            const bitis=new Date();bitis.setDate(bitis.getDate()+g);
            VERI.izinler[i.user.id]={sebep:s,bitis:bitis.toISOString(),tarih:new Date().toISOString()};
            veriKaydet();
            const embed=new EmbedBuilder()
               .setColor(0x00FF00)
               .setTitle('✅ İzin Talebi Onaylandı')
               .addFields(
                    {name:'Asker',value:`${i.user}`,inline:true},
                    {name:'Süre',value:`${g} gün`,inline:true},
                    {name:'Bitiş',value:`<t:${Math.floor(bitis.getTime()/1000)}:D>`,inline:true},
                    {name:'Sebep',value:s,inline:false}
                );
            await i.reply({embeds:[embed]});
        }
        else if(n==='izin-iptal'){
            if(!VERI.izinler[i.user.id])return i.reply({content:'❌ Aktif iznin yok!',ephemeral:true});
            delete VERI.izinler[i.user.id];veriKaydet();
            await i.reply({content:'✅ İznin iptal edildi!',ephemeral:true});
        }
        else if(n==='izin-listesi'){
            const l=Object.entries(VERI.izinler);
            if(l.length===0)return i.reply({content:'📭 Aktif izin yok.',ephemeral:true});
            const embed=new EmbedBuilder()
               .setColor(0x0099FF)
               .setTitle('📋 Aktif İzin Listesi')
               .setDescription(l.map(([id,v])=>`<@${id}> - ${v.sebep} - Bitiş: <t:${Math.floor(new Date(v.bitis).getTime()/1000)}:R>`).join('\n'))
               .setFooter({text:`Toplam ${l.length} kişi izinli`});
            await i.reply({embeds:[embed]});
        }
        else if(n==='grup'){
            const embed=new EmbedBuilder()
               .setColor(0x0099FF)
               .setTitle('🪖 TSA Roblox Grubu')
               .setDescription(`**Resmi TSA Grubuna Katıl:**\n${CONFIG.GRUP_LINK}`)
               .setURL(CONFIG.GRUP_LINK)
               .setThumbnail('https://tr.rbxcdn.com/180DAY-AvatarHeadshot-A1A1A1-Png/150/150/AvatarHeadshot/Webp/noFilter')
               .setFooter({text:'Turkish Special Army'});
            await i.reply({embeds:[embed]});
        }
        else if(n==='oyun'){
            const embed=new EmbedBuilder()
               .setColor(0x00FF00)
               .setTitle('🎮 TSA Türk Asker Oyunu')
               .setDescription(`**Oyuna Giriş:**\n${CONFIG.OYUN_LINK}`)
               .setURL(CONFIG.OYUN_LINK)
               .setImage('https://tr.rbxcdn.com/180DAY-GameIcon-A1A1A1A1A1A1A1A1A1-Png/256/256/GameIcon/Webp/noFilter')
               .setFooter({text:'TSA Resmi Oyunu'});
            await i.reply({embeds:[embed]});
        }
    }catch(e){console.error(e);await i.reply({content:'❌ Hata!',ephemeral:true}).catch(()=>{})}
});
