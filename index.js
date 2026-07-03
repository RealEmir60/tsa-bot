const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, REST, Routes, ActivityType, PermissionFlagsBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection, AudioPlayerStatus, NoSubscriberBehavior } = require('@discordjs/voice');
const play = require('play-dl'); const noblox = require('noblox.js'); const fs = require('fs'); const express = require('express'); require('dotenv').config();
const app=express(); app.get('/',(_,r)=>r.send('TSA Full')); app.listen(process.env.PORT||3000,'0.0.0.0');

const C={TOKEN:process.env.DISCORD_TOKEN,CLIENT_ID:process.env.CLIENT_ID,YETKILI:process.env.YETKILI_ROL_ID||'1518357646971764859',DM:process.env.DM_YETKILI_ROL||'1518357646971764859',EGITIM:process.env.EGITIM_YETKILI_ROL||'1518397406578741348',HABER_R:process.env.HABER_ROL_ID,HABER_K:process.env.HABER_KANAL_ID,IZIN:process.env.IZIN_ROL_ID,U1:process.env.UYARI_1_ROL_ID,U2:process.env.UYARI_2_ROL_ID,U3:process.env.UYARI_3_ROL_ID,GROUP:parseInt(process.env.GROUP_ID)||972348115,VERI:'./tsa.json'};
let D={uyari:{},izin:{}}; if(fs.existsSync(C.VERI))D=JSON.parse(fs.readFileSync(C.VERI)); const save=()=>fs.writeFileSync(C.VERI,JSON.stringify(D,null,2));
const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent,GatewayIntentBits.GuildVoiceStates]});
const player=createAudioPlayer({behaviors:{noSubscriber:NoSubscriberBehavior.Pause}}); let queue=[];

const cmds=[
 new SlashCommandBuilder().setName('ping').setDescription('Ping'),
 new SlashCommandBuilder().setName('yardim').setDescription('Yardim'),
 new SlashCommandBuilder().setName('profil').setDescription('Profil').addUserOption(o=>o.setName('kullanici').setDescription('Kisi')),
 new SlashCommandBuilder().setName('haber-yap').setDescription('Haber').addStringOption(o=>o.setName('baslik').setDescription('Baslik').setRequired(true)).addStringOption(o=>o.setName('icerik').setDescription('Icerik').setRequired(true)).addStringOption(o=>o.setName('resim').setDescription('URL')),
 new SlashCommandBuilder().setName('temizle').setDescription('Sil').addIntegerOption(o=>o.setName('adet').setDescription('1-100').setRequired(true)),
 new SlashCommandBuilder().setName('kilitle').setDescription('Kilitle'),
 new SlashCommandBuilder().setName('kilit-ac').setDescription('Ac'),
 new SlashCommandBuilder().setName('rol-ver').setDescription('Rol ver').addUserOption(o=>o.setName('kullanici').setDescription('Kisi').setRequired(true)).addRoleOption(o=>o.setName('rol').setDescription('Rol').setRequired(true)),
 new SlashCommandBuilder().setName('rol-al').setDescription('Rol al').addUserOption(o=>o.setName('kullanici').setDescription('Kisi').setRequired(true)).addRoleOption(o=>o.setName('rol').setDescription('Rol').setRequired(true)),
 new SlashCommandBuilder().setName('uyari-ver').setDescription('Uyari').addUserOption(o=>o.setName('kullanici').setDescription('Kisi').setRequired(true)).addStringOption(o=>o.setName('sebep').setDescription('Sebep').setRequired(true)),
 new SlashCommandBuilder().setName('uyari-sil').setDescription('Sil').addUserOption(o=>o.setName('kullanici').setDescription('Kisi').setRequired(true)).addIntegerOption(o=>o.setName('no').setDescription('No').setRequired(true)),
 new SlashCommandBuilder().setName('sicil').setDescription('Sicil').addUserOption(o=>o.setName('kullanici').setDescription('Kisi')),
 new SlashCommandBuilder().setName('izin-al').setDescription('Izin').addStringOption(o=>o.setName('sebep').setDescription('Sebep').setRequired(true)).addStringOption(o=>o.setName('sure').setDescription('Sure')),
 new SlashCommandBuilder().setName('izin-bitir').setDescription('Bitir').addUserOption(o=>o.setName('kullanici').setDescription('Kisi').setRequired(true)),
 new SlashCommandBuilder().setName('izin-listesi').setDescription('Izinli listesi'),
 new SlashCommandBuilder().setName('dm-duyuru').setDescription('DM').addStringOption(o=>o.setName('mesaj').setDescription('Mesaj').setRequired(true)),
 new SlashCommandBuilder().setName('egitim-duyuru').setDescription('Egitim').addStringOption(o=>o.setName('tur').setDescription('Tur').setRequired(true)).addStringOption(o=>o.setName('tarih').setDescription('Tarih').setRequired(true)),
 new SlashCommandBuilder().setName('oyun').setDescription('Oyun').addStringOption(o=>o.setName('link').setDescription('Link').setRequired(true)),
 new SlashCommandBuilder().setName('muzik-cal').setDescription('Cal').addStringOption(o=>o.setName('sarki').setDescription('Sarki').setRequired(true)),
 new SlashCommandBuilder().setName('muzik-durdur').setDescription('Durdur'),
 new SlashCommandBuilder().setName('muzik-gec').setDescription('Gec'),
 new SlashCommandBuilder().setName('grup-bilgi').setDescription('Grup bilgi'),
 new SlashCommandBuilder().setName('rutbeler').setDescription('Rutbeler'),
 new SlashCommandBuilder().setName('liderlik').setDescription('Liderlik')
].map(c=>c.toJSON());

client.once('ready',async()=>{await new REST({version:'10'}).setToken(C.TOKEN).put(Routes.applicationCommands(C.CLIENT_ID),{body:cmds}); if(process.env.ROBLOX_COOKIE)await noblox.setCookie(process.env.ROBLOX_COOKIE).catch(()=>{}); console.log('TSA Hazir');});

client.on('interactionCreate',async i=>{ if(!i.isChatInputCommand())return; const n=i.commandName;
 try{
  if(n==='ping')return i.reply(`🏓 ${client.ws.ping}ms`);
  if(n==='yardim')return i.reply({embeds:[new EmbedBuilder().setTitle('TSA').setDescription(cmds.map(c=>`/${c.name}`).join(', '))],ephemeral:true});
  if(n==='profil'){const u=i.options.getUser('kullanici')||i.user; const m=await i.guild.members.fetch(u.id); const uy=D.uyari[u.id]?.length||0; const iz=D.izin[u.id]?`Var (${D.izin[u.id].s})`:'Yok'; return i.reply({embeds:[new EmbedBuilder().setTitle(u.tag).setThumbnail(u.displayAvatarURL()).addFields({name:'Uyarı',value:`${uy}/3`,inline:true},{name:'İzin',value:iz,inline:true},{name:'Katılım',value:`<t:${Math.floor(m.joinedTimestamp/1000)}:D>`,inline:true})]});}
  if(n==='temizle'){if(!i.member.roles.cache.has(C.YETKILI))return i.reply({ephemeral:true,content:'Yetki yok'}); const a=i.options.getInteger('adet'); await i.channel.bulkDelete(a,true); return i.reply({ephemeral:true,content:`${a} silindi`});}
  if(n==='kilitle'){await i.channel.permissionOverwrites.edit(i.guild.roles.everyone,{SendMessages:false}); return i.reply('🔒');}
  if(n==='kilit-ac'){await i.channel.permissionOverwrites.edit(i.guild.roles.everyone,{SendMessages:null}); return i.reply('🔓');}
  if(n==='rol-ver'){if(!i.member.roles.cache.has(C.YETKILI))return i.reply({ephemeral:true,content:'Yetki yok'}); const u=i.options.getMember('kullanici'); await u.roles.add(i.options.getRole('rol')); return i.reply('Verildi');}
  if(n==='rol-al'){if(!i.member.roles.cache.has(C.YETKILI))return i.reply({ephemeral:true,content:'Yetki yok'}); const u=i.options.getMember('kullanici'); await u.roles.remove(i.options.getRole('rol')); return i.reply('Alindi');}
  if(n==='haber-yap'){if(!i.member.roles.cache.has(C.HABER_R))return i.reply({ephemeral:true,content:'Yetki yok'}); await i.deferReply({ephemeral:true}); const k=i.guild.channels.cache.get(C.HABER_K); const e=new EmbedBuilder().setTitle(i.options.getString('baslik')).setDescription(i.options.getString('icerik')); const r=i.options.getString('resim'); if(r)e.setImage(r); await k.send({content:'@everyone',embeds:[e]}); return i.editReply('ok');}
  if(n==='uyari-ver'){if(!i.member.roles.cache.has(C.YETKILI))return i.reply({ephemeral:true,content:'Yetki yok'}); const h=i.options.getMember('kullanici'); D.uyari[h.id]=D.uyari[h.id]||[]; D.uyari[h.id].push({s:i.options.getString('sebep'),t:Date.now()}); save(); return i.reply(`${h} uyarildi`);}
  if(n==='uyari-sil'){if(!i.member.roles.cache.has(C.YETKILI))return i.reply({ephemeral:true,content:'Yetki yok'}); D.uyari[i.options.getUser('kullanici').id].splice(i.options.getInteger('no')-1,1); save(); return i.reply('silindi');}
  if(n==='sicil'){const h=i.options.getUser('kullanici')||i.user; const l=D.uyari[h.id]||[]; return i.reply({embeds:[new EmbedBuilder().setTitle('Sicil').setDescription(l.map((x,idx)=>`${idx+1}. ${x.s}`).join('\n')||'Temiz')]});}
  if(n==='izin-al'){D.izin[i.user.id]={s:i.options.getString('sebep'),su:i.options.getString('sure')||'1g',t:Date.now()}; save(); if(C.IZIN)i.member.roles.add(C.IZIN); return i.reply({ephemeral:true,content:'Izin alindi'});}
  if(n==='izin-bitir'){if(!i.member.roles.cache.has(C.YETKILI))return i.reply({ephemeral:true,content:'Yetki yok'}); const h=i.options.getMember('kullanici'); delete D.izin[h.id]; save(); if(C.IZIN)h.roles.remove(C.IZIN); return i.reply('Bitirildi');}
  if(n==='izin-listesi'){if(!i.member.roles.cache.has(C.YETKILI))return i.reply({ephemeral:true,content:'Yetki yok'}); const list=Object.entries(D.izin).map(([id,v])=>`<@${id}> - ${v.s} (${v.su})`).join('\n')||'Yok'; return i.reply({embeds:[new EmbedBuilder().setTitle('Izindekiler').setDescription(list)]});}
  if(n==='dm-duyuru'){if(!i.member.roles.cache.has(C.DM))return i.reply({ephemeral:true,content:'Yetki yok'}); await i.deferReply({ephemeral:true}); let c=0; for(const m of (await i.guild.members.fetch()).values()){if(m.user.bot)continue; try{await m.send(i.options.getString('mesaj'));c++;}catch{}} return i.editReply(`${c} DM`);}
  if(n==='egitim-duyuru'){if(!i.member.roles.cache.has(C.EGITIM))return i.reply({ephemeral:true,content:'Yetki yok'}); return i.reply({content:'@everyone',embeds:[new EmbedBuilder().setTitle('Egitim').addFields({name:'Tur',value:i.options.getString('tur')},{name:'Tarih',value:i.options.getString('tarih')})]});}
  if(n==='oyun'){if(!i.member.roles.cache.has(C.YETKILI))return i.reply({ephemeral:true,content:'Yetki yok'}); return i.reply({content:'@everyone',embeds:[new EmbedBuilder().setTitle('Oyun').setDescription(`[Katıl](${i.options.getString('link')})`)]});}
  if(n==='muzik-cal'){const vc=i.member.voice.channel; if(!vc)return i.reply({ephemeral:true,content:'Ses kanalina gir'}); await i.deferReply(); const st=await play.stream(i.options.getString('sarki')); queue.push({st}); if(player.state.status!=='playing')playNext(i.guild,vc); return i.editReply('Eklendi');}
  if(n==='muzik-durdur'){getVoiceConnection(i.guild.id)?.destroy(); queue=[]; player.stop(); return i.reply('Durdu');}
  if(n==='muzik-gec'){player.stop(); return i.reply('Gecildi');}
  if(n==='grup-bilgi'){await i.deferReply(); const g=await noblox.getGroup(C.GROUP); return i.editReply({embeds:[new EmbedBuilder().setTitle(g.name).setDescription(g.description?.slice(0,200)||'Yok').addFields({name:'Uye',value:`${g.memberCount}`,inline:true},{name:'ID',value:`${C.GROUP}`,inline:true})]});}
  if(n==='rutbeler'){await i.deferReply(); const r=await noblox.getRoles(C.GROUP); return i.editReply({embeds:[new EmbedBuilder().setTitle('Rutbeler').setDescription(r.map(x=>`${x.rank} - ${x.name}`).join('\n'))]});}
  if(n==='liderlik'){await i.deferReply(); const r=await noblox.getRoles(C.GROUP); return i.editReply({embeds:[new EmbedBuilder().setTitle('Liderlik').setDescription(r.filter(x=>x.rank>=200).map(x=>x.name).join('\n'))]});}
 }catch(e){console.error(e); i.reply({ephemeral:true,content:'Hata'}).catch(()=>{});}
});

function playNext(g,vc){if(!queue.length){getVoiceConnection(g.id)?.destroy();return;} const it=queue.shift(); const c=joinVoiceChannel({channelId:vc.id,guildId:g.id,adapterCreator:g.voiceAdapterCreator}); const r=createAudioResource(it.st.stream,{inputType:it.st.type}); player.play(r); c.subscribe(player); player.once(AudioPlayerStatus.Idle,()=>playNext(g,vc));}
client.login(C.TOKEN);
