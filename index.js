const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, REST, Routes, ActivityType } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection, AudioPlayerStatus, NoSubscriberBehavior } = require('@discordjs/voice');
const play = require('play-dl'); const noblox = require('noblox.js'); const fs = require('fs'); const express = require('express'); require('dotenv').config();
const app=express(); app.get('/',(_,r)=>r.send('OK')); app.listen(process.env.PORT||3000,'0.0.0.0');

const C={TOKEN:process.env.DISCORD_TOKEN,YETKILI:process.env.YETKILI_ROL_ID||'1518357646971764859',DM:process.env.DM_YETKILI_ROL||'1518357646971764859',EGITIM:process.env.EGITIM_YETKILI_ROL||'1518397406578741348',HABER_R:process.env.HABER_ROL_ID,HABER_K:process.env.HABER_KANAL_ID,IZIN:process.env.IZIN_ROL_ID,U1:process.env.UYARI_1_ROL_ID,U2:process.env.UYARI_2_ROL_ID,U3:process.env.UYARI_3_ROL_ID,GROUP:972348115,VERI:'./data.json'};
let D={uyari:{},izin:{}}; if(fs.existsSync(C.VERI))D=JSON.parse(fs.readFileSync(C.VERI)); const save=()=>fs.writeFileSync(C.VERI,JSON.stringify(D,null,2));

const client=new Client({intents:[3276799]}); const player=createAudioPlayer({behaviors:{noSubscriber:NoSubscriberBehavior.Pause}}); let q=[];

const cmds=[ /* 23 komut */
 new SlashCommandBuilder().setName('ping').setDescription('Ping'),
 new SlashCommandBuilder().setName('yardim').setDescription('Yardim'),
 new SlashCommandBuilder().setName('profil').setDescription('Profil').addUserOption(o=>o.setName('kullanici').setDescription('Kisi')),
 new SlashCommandBuilder().setName('haber-yap').setDescription('Haber').addStringOption(o=>o.setName('baslik').setDescription('Baslik').setRequired(true)).addStringOption(o=>o.setName('icerik').setDescription('Icerik').setRequired(true)).addStringOption(o=>o.setName('resim').setDescription('URL')),
 new SlashCommandBuilder().setName('temizle').setDescription('Sil').addIntegerOption(o=>o.setName('adet').setDescription('Adet').setRequired(true)),
 new SlashCommandBuilder().setName('kilitle').setDescription('Kilitle'),
 new SlashCommandBuilder().setName('kilit-ac').setDescription('Ac'),
 new SlashCommandBuilder().setName('rol-ver').setDescription('Rol ver').addUserOption(o=>o.setName('kullanici').setDescription('Kisi').setRequired(true)).addRoleOption(o=>o.setName('rol').setDescription('Rol').setRequired(true)),
 new SlashCommandBuilder().setName('rol-al').setDescription('Rol al').addUserOption(o=>o.setName('kullanici').setDescription('Kisi').setRequired(true)).addRoleOption(o=>o.setName('rol').setDescription('Rol').setRequired(true)),
 new SlashCommandBuilder().setName('uyari-ver').setDescription('Uyari').addUserOption(o=>o.setName('kullanici').setDescription('Kisi').setRequired(true)).addStringOption(o=>o.setName('sebep').setDescription('Sebep').setRequired(true)),
 new SlashCommandBuilder().setName('uyari-sil').setDescription('Sil').addUserOption(o=>o.setName('kullanici').setDescription('Kisi').setRequired(true)).addIntegerOption(o=>o.setName('no').setDescription('No').setRequired(true)),
 new SlashCommandBuilder().setName('sicil').setDescription('Sicil').addUserOption(o=>o.setName('kullanici').setDescription('Kisi')),
 new SlashCommandBuilder().setName('izin-al').setDescription('Izin').addStringOption(o=>o.setName('sebep').setDescription('Sebep').setRequired(true)).addStringOption(o=>o.setName('sure').setDescription('Sure')),
 new SlashCommandBuilder().setName('izin-bitir').setDescription('Bitir').addUserOption(o=>o.setName('kullanici').setDescription('Kisi').setRequired(true)),
 new SlashCommandBuilder().setName('izin-listesi').setDescription('Liste'),
 new SlashCommandBuilder().setName('dm-duyuru').setDescription('DM').addStringOption(o=>o.setName('mesaj').setDescription('Mesaj').setRequired(true)),
 new SlashCommandBuilder().setName('egitim-duyuru').setDescription('Egitim').addStringOption(o=>o.setName('tur').setDescription('Tur').setRequired(true)).addStringOption(o=>o.setName('tarih').setDescription('Tarih').setRequired(true)),
 new SlashCommandBuilder().setName('oyun').setDescription('Oyun').addStringOption(o=>o.setName('link').setDescription('Link').setRequired(true)),
 new SlashCommandBuilder().setName('muzik-cal').setDescription('Cal').addStringOption(o=>o.setName('sarki').setDescription('Sarki').setRequired(true)),
 new SlashCommandBuilder().setName('muzik-durdur').setDescription('Durdur'),
 new SlashCommandBuilder().setName('muzik-gec').setDescription('Gec'),
 new SlashCommandBuilder().setName('grup-bilgi').setDescription('Grup'),
 new SlashCommandBuilder().setName('rutbeler').setDescription('Rutbeler'),
 new SlashCommandBuilder().setName('liderlik').setDescription('Liderlik')
].map(c=>c.toJSON());

client.once('ready',async()=>{
 client.user.setPresence({activities:[{name:'TSA - Turkish Special Army',type:ActivityType.Playing}],status:'online'});
 const rest=new REST({version:'10'}).setToken(C.TOKEN);
 await rest.put(Routes.applicationCommands(client.user.id),{body:cmds});
 if(process.env.ROBLOX_COOKIE)await noblox.setCookie(process.env.ROBLOX_COOKIE).catch(()=>{});
 console.log('Hazir - CLIENT_ID gerekmedi');
});

client.on('interactionCreate',async i=>{ if(!i.isChatInputCommand())return; const n=i.commandName;
 try{
  if(n==='ping')return i.reply(`🏓 ${client.ws.ping}ms`);
  if(n==='yardim')return i.reply({ephemeral:true,content:cmds.map(c=>`/${c.name}`).join(' ')});
  if(n==='profil'){const u=i.options.getUser('kullanici')||i.user; const m=await i.guild.members.fetch(u.id); return i.reply({embeds:[new EmbedBuilder().setTitle(u.tag).setThumbnail(u.displayAvatarURL()).addFields({name:'Uyarı',value:`${D.uyari[u.id]?.length||0}/3`},{name:'İzin',value:D.izin[u.id]?'Var':'Yok'})]});}
  if(n==='temizle'){if(!i.member.roles.cache.has(C.YETKILI))return i.reply({ephemeral:true,content:'Yok'}); await i.channel.bulkDelete(i.options.getInteger('adet'),true); return i.reply({ephemeral:true,content:'ok'});}
  if(n==='kilitle'){await i.channel.permissionOverwrites.edit(i.guild.id,{SendMessages:false}); return i.reply('🔒');}
  if(n==='kilit-ac'){await i.channel.permissionOverwrites.edit(i.guild.id,{SendMessages:null}); return i.reply('🔓');}
  if(n==='rol-ver'){await i.options.getMember('kullanici').roles.add(i.options.getRole('rol')); return i.reply('ok');}
  if(n==='rol-al'){await i.options.getMember('kullanici').roles.remove(i.options.getRole('rol')); return i.reply('ok');}
  if(n==='haber-yap'){const e=new EmbedBuilder().setTitle(i.options.getString('baslik')).setDescription(i.options.getString('icerik')); const r=i.options.getString('resim'); if(r)e.setImage(r); await i.guild.channels.cache.get(C.HABER_K)?.send({content:'@everyone',embeds:[e]}); return i.reply({ephemeral:true,content:'ok'});}
  if(n==='uyari-ver'){D.uyari[i.options.getUser('kullanici').id]=D.uyari[i.options.getUser('kullanici').id]||[]; D.uyari[i.options.getUser('kullanici').id].push({s:i.options.getString('sebep')}); save(); return i.reply('verildi');}
  if(n==='uyari-sil'){D.uyari[i.options.getUser('kullanici').id].splice(i.options.getInteger('no')-1,1); save(); return i.reply('silindi');}
  if(n==='sicil'){const l=D.uyari[(i.options.getUser('kullanici')||i.user).id]||[]; return i.reply({embeds:[new EmbedBuilder().setDescription(l.map((x,idx)=>`${idx+1}. ${x.s}`).join('\n')||'Temiz')]});}
  if(n==='izin-al'){D.izin[i.user.id]={s:i.options.getString('sebep')}; save(); if(C.IZIN)i.member.roles.add(C.IZIN); return i.reply({ephemeral:true,content:'alindi'});}
  if(n==='izin-bitir'){delete D.izin[i.options.getUser('kullanici').id]; save(); return i.reply('bitti');}
  if(n==='izin-listesi'){return i.reply({embeds:[new EmbedBuilder().setTitle('İzin').setDescription(Object.keys(D.izin).map(id=>`<@${id}>`).join('\n')||'yok')]});}
  if(n==='dm-duyuru'){await i.deferReply({ephemeral:true}); let c=0; for(const m of (await i.guild.members.fetch()).values()){try{await m.send(i.options.getString('mesaj'));c++;}catch{}} return i.editReply(`${c}`);}
  if(n==='egitim-duyuru'){return i.reply({content:'@everyone',embeds:[new EmbedBuilder().setTitle(i.options.getString('tur')).setDescription(i.options.getString('tarih'))]});}
  if(n==='oyun'){return i.reply({content:'@everyone',embeds:[new EmbedBuilder().setTitle('Oyun').setDescription(i.options.getString('link'))]});}
  if(n==='muzik-cal'){const vc=i.member.voice.channel; const s=await play.stream(i.options.getString('sarki')); q.push(s); if(player.state.status!=='playing'){const c=joinVoiceChannel({channelId:vc.id,guildId:i.guild.id,adapterCreator:i.guild.voiceAdapterCreator}); const r=createAudioResource(s.stream,{inputType:s.type}); player.play(r); c.subscribe(player);} return i.reply('ok');}
  if(n==='muzik-durdur'){getVoiceConnection(i.guild.id)?.destroy(); return i.reply('ok');}
  if(n==='muzik-gec'){player.stop(); return i.reply('ok');}
  if(n==='grup-bilgi'){const g=await noblox.getGroup(C.GROUP); return i.reply({embeds:[new EmbedBuilder().setTitle(g.name).setDescription(`${g.memberCount} üye`)]});}
  if(n==='rutbeler'){const r=await noblox.getRoles(C.GROUP); return i.reply({embeds:[new EmbedBuilder().setDescription(r.map(x=>x.name).join('\n'))]});}
  if(n==='liderlik'){const r=await noblox.getRoles(C.GROUP); return i.reply({embeds:[new EmbedBuilder().setDescription(r.filter(x=>x.rank>200).map(x=>x.name).join('\n'))]});}
 }catch(e){console.error(e);}
});
client.login(C.TOKEN);
