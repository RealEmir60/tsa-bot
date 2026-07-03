const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, REST, Routes, ActivityType } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection, AudioPlayerStatus, NoSubscriberBehavior } = require('@discordjs/voice');
const play = require('play-dl');
const fs = require('fs');
const express = require('express');
require('dotenv').config();

// ==================== EXPRESS ====================
const app = express();
app.get('/', (_, res) => res.send('OK'));
app.listen(process.env.PORT || 3000, '0.0.0.0');

// ==================== CONFIG ====================
const config = {
  TOKEN: process.env.DISCORD_TOKEN,
  BOT_SAHIBI: process.env.BOT_SAHIBI_ID,
  YONETICI_ROL: process.env.YONETICI_ROL_ID,
  IZIN_ROL: process.env.IZIN_ROL_ID,
  UYARI_1_ROL: process.env.UYARI_1_ROL_ID,
  UYARI_2_ROL: process.env.UYARI_2_ROL_ID,
  UYARI_3_ROL: process.env.UYARI_3_ROL_ID,
  HABER_ROL: process.env.HABER_ROL_ID,
  HABER_KANAL: process.env.HABER_KANAL_ID,
  LOG_KANAL: process.env.LOG_CHANNEL_ID,
  DATA_FILE: './data.json'
};

const EGITIM_ROL_ID = '1518397406578741348';
const EGITIM_KANAL_ID = '1518357904779116554';

// ==================== DATA ====================
let data = { uyari: {}, izin: {} };

if (fs.existsSync(config.DATA_FILE)) {
  try {
    data = JSON.parse(fs.readFileSync(config.DATA_FILE, 'utf8'));
  } catch {}
}

const saveData = () => fs.writeFileSync(config.DATA_FILE, JSON.stringify(data, null, 2));

// ==================== MUSIC ====================
const player = createAudioPlayer({
  behaviors: { noSubscriber: NoSubscriberBehavior.Pause }
});
let queue = [];

player.on(AudioPlayerStatus.Idle, () => {
  if (queue.length > 0) {
    const next = queue.shift();
    const resource = createAudioResource(next.stream, { inputType: next.type });
    player.play(resource);
  }
});

// ==================== CLIENT ====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// ==================== SLASH COMMANDS ====================
const commands = [
  new SlashCommandBuilder().setName('ping').setDescription('Bot pingini gösterir'),
  new SlashCommandBuilder().setName('yardim').setDescription('Tüm komutları listeler'),

  new SlashCommandBuilder()
    .setName('profil')
    .setDescription('Kullanıcı profilini gösterir')
    .addUserOption(o => o.setName('kullanici').setDescription('Discord kullanıcısı')),

  // ==================== YÖNETİCİ ====================
  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kullanıcıyı atar')
    .addUserOption(o => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
    .addStringOption(o => o.setName('sebep').setDescription('Sebep')),

  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Kullanıcıyı banlar')
    .addUserOption(o => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
    .addStringOption(o => o.setName('sebep').setDescription('Sebep')),

  new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Kullanıcının banını kaldırır')
    .addStringOption(o => o.setName('kullaniciid').setDescription('Kullanıcı ID').setRequired(true)),

  new SlashCommandBuilder()
    .setName('temizle')
    .setDescription('Mesaj siler')
    .addIntegerOption(o => o.setName('adet').setDescription('Adet').setRequired(true)),

  new SlashCommandBuilder()
    .setName('yavas-mod')
    .setDescription('Kanalı yavaşlatır')
    .addIntegerOption(o => o.setName('saniye').setDescription('Yavaşlatma süresi (0-21600)').setRequired(true)),

  new SlashCommandBuilder().setName('kilitle').setDescription('Kanalı kilitler'),
  new SlashCommandBuilder().setName('kilit-ac').setDescription('Kanal kilidini açar'),

  new SlashCommandBuilder()
    .setName('rol-ver')
    .setDescription('Rol verir')
    .addUserOption(o => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
    .addRoleOption(o => o.setName('rol').setDescription('Rol').setRequired(true)),

  new SlashCommandBuilder()
    .setName('rol-al')
    .setDescription('Rol alır')
    .addUserOption(o => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
    .addRoleOption(o => o.setName('rol').setDescription('Rol').setRequired(true)),

  // ==================== UYARI ====================
  new SlashCommandBuilder()
    .setName('uyari-ver')
    .setDescription('Uyarı verir')
    .addUserOption(o => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
    .addStringOption(o => o.setName('sebep').setDescription('Sebep').setRequired(true)),

  new SlashCommandBuilder()
    .setName('uyari-sil')
    .setDescription('Uyarı siler')
    .addUserOption(o => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
    .addIntegerOption(o => o.setName('no').setDescription('Numara').setRequired(true)),

  new SlashCommandBuilder().setName('uyari-liste').setDescription('Tüm uyarıları listeler'),

  new SlashCommandBuilder()
    .setName('sicil')
    .setDescription('Sicil gösterir')
    .addUserOption(o => o.setName('kullanici').setDescription('Kullanıcı')),

  // ==================== IZIN ====================
  new SlashCommandBuilder()
    .setName('izin-al')
    .setDescription('İzin al')
    .addStringOption(o => o.setName('sebep').setDescription('Sebep').setRequired(true))
    .addStringOption(o => o.setName('bitis').setDescription('Bitiş tarihi')),

  new SlashCommandBuilder().setName('izin-bitir').setDescription('Kendi iznini bitir'),
  new SlashCommandBuilder().setName('izin-listesi').setDescription('İzinlileri listeler'),

  // ==================== SES ====================
  new SlashCommandBuilder().setName('ses-gir').setDescription('Botu ses kanalına çeker'),
  new SlashCommandBuilder().setName('ses-cik').setDescription('Botu ses kanalından çıkarır'),

  // ==================== DUYURU ====================
  new SlashCommandBuilder()
    .setName('haber-yap')
    .setDescription('Haber yapar')
    .addStringOption(o => o.setName('baslik').setDescription('Başlık').setRequired(true))
    .addStringOption(o => o.setName('icerik').setDescription('İçerik').setRequired(true))
    .addStringOption(o => o.setName('resim').setDescription('Resim URL')),

  new SlashCommandBuilder()
    .setName('egitim-duyuru')
    .setDescription('Eğitim duyurusu')
    .addUserOption(o => o.setName('host').setDescription('Host').setRequired(true))
    .addUserOption(o => o.setName('cohost').setDescription('Co-Host').setRequired(true))
    .addStringOption(o => o.setName('tur').setDescription('Tür').setRequired(true))
    .addStringOption(o => o.setName('zaman').setDescription('Zaman').setRequired(true)),

  new SlashCommandBuilder().setName('oyun').setDescription('Oyun linkini atar'),
  new SlashCommandBuilder().setName('grup').setDescription('Grup linkini atar'),

  new SlashCommandBuilder()
    .setName('dm-mesaj')
    .setDescription('Tek kişiye DM atar')
    .addUserOption(o => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
    .addStringOption(o => o.setName('mesaj').setDescription('Mesaj').setRequired(true)),

  // ==================== MUZIK ====================
  new SlashCommandBuilder()
    .setName('muzik-cal')
    .setDescription('Müzik çalar')
    .addStringOption(o => o.setName('sarki').setDescription('Şarkı').setRequired(true)),

  new SlashCommandBuilder().setName('muzik-durdur').setDescription('Müziği durdurur'),
  new SlashCommandBuilder().setName('muzik-gec').setDescription('Şarkıyı geçer'),
  new SlashCommandBuilder().setName('muzik-kuyruk').setDescription('Kuyruğu gösterir'),

  // ==================== RÜTBELER (STATİK) ====================
  new SlashCommandBuilder().setName('rutbeler').setDescription('Grup rütbe tablosunu gösterir'),
  new SlashCommandBuilder().setName('liderlik').setDescription('En aktif üyeleri gösterir')
].map(c => c.toJSON());

// ==================== READY ====================
client.once('ready', async () => {
  console.log(`✅ ${client.user.tag} hazır`);

  client.user.setPresence({
    activities: [{ name: 'TSA - Turkish Special Army', type: ActivityType.Playing }],
    status: 'online'
  });

  const rest = new REST({ version: '10' }).setToken(config.TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
});

// ==================== INTERACTION ====================
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const cmd = interaction.commandName;
  const isYonetici = interaction.member.roles.cache.has(config.YONETICI_ROL);
  const isEgitimHost = interaction.member.roles.cache.has(EGITIM_ROL_ID);

  try {
    // ==================== HERKES ====================
    if (cmd === 'ping') {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('Blue').setDescription(`🏓 Ping: **${client.ws.ping}ms**`)] });
    }

    if (cmd === 'yardim') {
      const list = commands.map(c => `/${c.name}`).join(' • ');
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('Purple').setTitle('📋 Komutlar').setDescription(list)] });
    }

    if (cmd === 'profil') {
      const user = interaction.options.getUser('kullanici') || interaction.user;
      const embed = new EmbedBuilder()
        .setColor('Green')
        .setTitle(`${user.tag} Profili`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '⚠️ Uyarı', value: `${data.uyari[user.id]?.length || 0}/3`, inline: true },
          { name: '📋 İzin', value: data.izin[user.id] ? '✅ Var' : '❌ Yok', inline: true }
        )
        .setFooter({ text: 'TSA Discord Bot' });
      return interaction.reply({ embeds: [embed] });
    }

    // ==================== YÖNETİCİ KONTROLÜ ====================
    if (['kick', 'ban', 'unban', 'temizle', 'yavas-mod', 'rol-ver', 'rol-al', 'uyari-ver', 'uyari-sil', 'uyari-liste', 'dm-mesaj'].includes(cmd) && !isYonetici) {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription('❌ Sadece YONETICI_ROL_ID rolüne sahip olanlar kullanabilir!')] });
    }

    // ==================== KICK / BAN / UNBAN ====================
    if (cmd === 'kick') {
      const user = interaction.options.getUser('kullanici');
      const sebep = interaction.options.getString('sebep') || 'Sebep yok';
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!member) return interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription('Kullanıcı bulunamadı')] });
      await member.kick(sebep);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('Orange').setDescription(`👢 ${user.tag} atıldı.`)] });
    }

    if (cmd === 'ban') {
      const user = interaction.options.getUser('kullanici');
      const sebep = interaction.options.getString('sebep') || 'Sebep yok';
      await interaction.guild.members.ban(user.id, { reason: sebep });
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription(`🔨 ${user.tag} banlandı.`)] });
    }

    if (cmd === 'unban') {
      const userId = interaction.options.getString('kullaniciid');
      try {
        await interaction.guild.members.unban(userId);
        return interaction.reply({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`✅ <@${userId}> banı kaldırıldı.`)] });
      } catch {
        return interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription('Ban kaldırılamadı.')] });
      }
    }

    // ==================== TEMİZLE / YAVAŞ-MOD ====================
    if (cmd === 'temizle') {
      const amount = interaction.options.getInteger('adet');
      await interaction.channel.bulkDelete(amount, true);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('Blue').setDescription(`✅ ${amount} mesaj silindi`)] });
    }

    if (cmd === 'yavas-mod') {
      const saniye = interaction.options.getInteger('saniye');
      if (saniye < 0 || saniye > 21600) {
        return interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription('0-21600 saniye arası olmalı!')] });
      }
      await interaction.channel.setRateLimitPerUser(saniye);
      const mesaj = saniye === 0 ? 'Yavaş mod kapatıldı.' : `Kanal **${saniye} saniye** yavaşlatıldı.`;
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('Blue').setDescription(mesaj)] });
    }

    if (cmd === 'kilitle') {
      await interaction.channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: false });
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription('🔒 Kanal kilitlendi')] });
    }

    if (cmd === 'kilit-ac') {
      await interaction.channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: null });
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('Green').setDescription('🔓 Kanal kilidi açıldı')] });
    }

    if (cmd === 'rol-ver') {
      const member = interaction.options.getMember('kullanici');
      const role = interaction.options.getRole('rol');
      await member.roles.add(role.id);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`✅ Rol verildi`)] });
    }

    if (cmd === 'rol-al') {
      const member = interaction.options.getMember('kullanici');
      const role = interaction.options.getRole('rol');
      await member.roles.remove(role.id);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('Orange').setDescription(`✅ Rol alındı`)] });
    }

    // ==================== UYARI ====================
    if (cmd === 'uyari-ver') {
      const user = interaction.options.getUser('kullanici');
      const sebep = interaction.options.getString('sebep');

      if (!data.uyari[user.id]) data.uyari[user.id] = [];
      data.uyari[user.id].push({ sebep, tarih: new Date().toISOString(), veren: interaction.user.id });
      saveData();

      const count = data.uyari[user.id].length;
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('Orange').setDescription(`✅ ${user.tag} uyarıldı (**${count}/3**)`)] });
    }

    if (cmd === 'uyari-sil') {
      const user = interaction.options.getUser('kullanici');
      const no = interaction.options.getInteger('no');
      if (data.uyari[user.id]) data.uyari[user.id].splice(no - 1, 1);
      saveData();
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('Green').setDescription('✅ Uyarı silindi')] });
    }

    if (cmd === 'uyari-liste') {
      const all = Object.keys(data.uyari);
      if (all.length === 0) return interaction.reply({ embeds: [new EmbedBuilder().setColor('Green').setDescription('✅ Uyarı yok')] });

      let desc = '';
      for (const id of all) desc += `<@${id}> → **${data.uyari[id].length}** uyarı\n`;
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('Orange').setTitle('Tüm Uyarılar').setDescription(desc)] });
    }

    if (cmd === 'sicil') {
      const user = interaction.options.getUser('kullanici') || interaction.user;
      const list = data.uyari[user.id] || [];
      const embed = new EmbedBuilder()
        .setColor('Blue')
        .setTitle(`${user.tag} - Uyarı Sicili`)
        .setDescription(list.length ? list.map((x, i) => `**${i + 1}.** ${x.sebep}`).join('\n') : '✅ Temiz');
      return interaction.reply({ embeds: [embed] });
    }

    // ==================== IZIN ====================
    if (cmd === 'izin-al') {
      const sebep = interaction.options.getString('sebep');
      const bitis = interaction.options.getString('bitis');

      data.izin[interaction.user.id] = { sebep, bitis: bitis || 'Belirtilmedi', baslangic: new Date().toISOString() };
      saveData();

      if (config.IZIN_ROL) await interaction.member.roles.add(config.IZIN_ROL).catch(() => {});
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('Green').setDescription('✅ İzin aldın!')] });
    }

    if (cmd === 'izin-bitir') {
      if (!data.izin[interaction.user.id]) return interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription('Zaten izinli değilsin.')] });
      delete data.izin[interaction.user.id];
      saveData();
      if (config.IZIN_ROL) await interaction.member.roles.remove(config.IZIN_ROL).catch(() => {});
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('Green').setDescription('✅ İznin bitirildi.')] });
    }

    if (cmd === 'izin-listesi') {
      const list = Object.keys(data.izin);
      if (list.length === 0) return interaction.reply({ embeds: [new EmbedBuilder().setColor('Blue').setDescription('Kimse izinli değil.')] });
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('Purple').setTitle('İzinli Kullanıcılar').setDescription(list.map(id => `<@${id}>`).join('\n'))] });
    }

    // ==================== SES ====================
    if (cmd === 'ses-gir') {
      const channel = interaction.member.voice.channel;
      if (!channel) return interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription('Ses kanalına katıl!')] });
      joinVoiceChannel({ channelId: channel.id, guildId: interaction.guild.id, adapterCreator: interaction.guild.voiceAdapterCreator });
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('Green').setDescription('✅ Ses kanalına girdim.')] });
    }

    if (cmd === 'ses-cik') {
      getVoiceConnection(interaction.guild.id)?.destroy();
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('Orange').setDescription('✅ Ses kanalından çıktım.')] });
    }

    // ==================== HABER-YAP ====================
    if (cmd === 'haber-yap') {
      if (!interaction.member.roles.cache.has(config.HABER_ROL)) {
        return interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription('Sadece HABER_ROL_ID kullanabilir!')] });
      }
      const baslik = interaction.options.getString('baslik');
      const icerik = interaction.options.getString('icerik');
      const resim = interaction.options.getString('resim');

      const embed = new EmbedBuilder().setColor('Blue').setTitle(baslik).setDescription(icerik).setFooter({ text: `Haberi Yapan: ${interaction.user.tag}` });
      if (resim) embed.setImage(resim);

      const kanal = interaction.guild.channels.cache.get(config.HABER_KANAL);
      if (kanal) await kanal.send({ content: '@everyone', embeds: [embed] });
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('Green').setDescription('✅ Haber yayınlandı.')] });
    }

    // ==================== EĞİTİM DUYURUSU ====================
    if (cmd === 'egitim-duyuru') {
      if (!isEgitimHost) return interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription('Sadece Eğitim Host kullanabilir!')] });

      const host = interaction.options.getUser('host');
      const cohost = interaction.options.getUser('cohost');
      const tur = interaction.options.getString('tur');
      const zaman = interaction.options.getString('zaman');

      const embed = new EmbedBuilder()
        .setColor('Purple')
        .setTitle('📚 Eğitim Duyurusu')
        .addFields(
          { name: '🎓 Host', value: `${host}`, inline: true },
          { name: '🎓 Co-Host', value: `${cohost}`, inline: true },
          { name: '📖 Tür', value: tur, inline: true },
          { name: '🕒 Zaman', value: zaman, inline: true }
        );

      const kanal = interaction.guild.channels.cache.get(EGITIM_KANAL_ID);
      if (kanal) await kanal.send({ content: '@everyone', embeds: [embed] });
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('Green').setDescription('✅ Duyuru yapıldı.')] });
    }

    if (cmd === 'oyun') {
      const embed = new EmbedBuilder().setColor('Green').setTitle('🎮 TSA | Resmi Oyun').setDescription('# TSA | Resmi Grubumuz :\n@everyone\nhttps://www.roblox.com/tr/communities/972348115/TSA-Turkish-Armed-Forces-Yeniden');
      return interaction.reply({ content: '@everyone', embeds: [embed] });
    }

    if (cmd === 'grup') {
      const embed = new EmbedBuilder().setColor('Blue').setTitle('👥 TSA Resmi Grup').setDescription('https://www.roblox.com/tr/communities/972348115/TSA-Turkish-Armed-Forces-Yeniden');
      return interaction.reply({ embeds: [embed] });
    }

    // ==================== DM-MESAJ ====================
    if (cmd === 'dm-mesaj') {
      if (!isYonetici) return interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription('Sadece Yönetici kullanabilir!')] });
      const target = interaction.options.getUser('kullanici');
      const mesaj = interaction.options.getString('mesaj');
      try {
        await target.send(mesaj);
        return interaction.reply({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`✅ ${target.tag} kişisine DM gönderildi.`)] });
      } catch {
        return interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription('DM gönderilemedi.')] });
      }
    }

    // ==================== MUZIK ====================
    if (cmd === 'muzik-cal') {
      const vc = interaction.member.voice.channel;
      if (!vc) return interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription('Ses kanalına katıl!')] });
      await interaction.deferReply();
      const s = interaction.options.getString('sarki');
      const stream = await play.stream(s);
      queue.push(stream);
      if (player.state.status !== AudioPlayerStatus.Playing) {
        const conn = joinVoiceChannel({ channelId: vc.id, guildId: interaction.guild.id, adapterCreator: interaction.guild.voiceAdapterCreator });
        const res = createAudioResource(stream.stream, { inputType: stream.type });
        player.play(res);
        conn.subscribe(player);
      }
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`✅ ${s} kuyruğa eklendi`)] });
    }

    if (cmd === 'muzik-durdur') {
      getVoiceConnection(interaction.guild.id)?.destroy();
      queue = [];
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('Orange').setDescription('⏹️ Durduruldu')] });
    }

    if (cmd === 'muzik-gec') {
      player.stop();
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('Blue').setDescription('⏭️ Geçildi')] });
    }

    if (cmd === 'muzik-kuyruk') {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('Purple').setDescription(queue.length ? `Kuyrukta ${queue.length} şarkı var` : 'Kuyruk boş')] });
    }

    // ==================== RÜTBELER (STATİK TABLO) ====================
    if (cmd === 'rutbeler') {
      const rutbeTablosu = `255. TSA — 1 üye
254. Grup Sahibi — 3 üye
253. 2. Grup Sahibi — 3 üye
252. Geliştirme Ofisi Başkanı — 1 üye
251. Geliştirme Ofisi — 0 üye
250. Stajyer Geliştirme Ofisi — 0 üye
40. Rütbelendirme Botu — 3 üye
36. Yardımcı Grup Sahibi — 2 üye
35. OF-10 Mareşal — 6 üye
34. Yönetim Kurulu Başkanı — 5 üye
33. Yönetim Kurulu Başkan Y. — 5 üye
32. Yönetim Kurulu — 12 üye
31. Yüksek Askeri Şura — 5 üye
30. Genel Kurmay Başkanı — 3 üye
29. Genel Kurmay — 4 üye
27. Lider — 11 üye
26. Disiplin Kurulu — 3 üye
25. Ordu Komutanı — 0 üye
23. Paşa — 5 üye
20. [OF-9] Orgeneral — 3 üye
19. [OF-8] Korgeneral — 2 üye
18. [OF-7] Tümgeneral — 0 üye
17. [OF-6] Tuğgeneral — 1 üye
16. [OF-5] Albay — 1 üye
15. [OF-4] Yarbay — 0 üye
14. [OF-3] Binbaşı — 4 üye
13. [OF-2] YüzBaşı — 0 üye
12. [OF-1/C] Üsteğmen — 1 üye
11. [OF-1/B] Teğmen — 0 üye
10. [OF-1/A] Asteğmen — 4 üye
9. [OR-9] Astsubay Kıdemli Başçavuş — 0 üye
8. [OR-8] Astsubay Başçavuş — 0 üye
7. [OR-7] Astsubay Üstçavuş — 0 üye
6. [OR-6] Astsubay Çavuş — 0 üye
5. [OR-5] Uzman Çavuş — 0 üye
4. [OR-4] Çavuş — 0 üye
3. [OR-3] Uzman Onbaşı — 0 üye
2. [OR-2] Onbaşı — 5 üye
1. [OR-1] Acemi Er — 233 üye`;

      const embed = new EmbedBuilder()
        .setColor('Purple')
        .setTitle('👑 TSA Rütbe Tablosu')
        .setDescription(rutbeTablosu)
        .setFooter({ text: 'TSA Discord Bot' });

      return interaction.reply({ embeds: [embed] });
    }

    // ==================== LİDERLİK ====================
    if (cmd === 'liderlik') {
      const embed = new EmbedBuilder()
        .setColor('Gold')
        .setTitle('👑 En Aktif Üyeler')
        .setDescription('Bu komut yakında Discord aktivite takibi ile güncellenecek.')
        .setFooter({ text: 'TSA Discord Bot' });
      return interaction.reply({ embeds: [embed] });
    }

  } catch (e) {
    console.error(e);
    return interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription('❌ Hata oluştu.')] });
  }
});

client.login(config.TOKEN);
