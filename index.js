const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, REST, Routes, ActivityType, PermissionsBitField, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection, AudioPlayerStatus, NoSubscriberBehavior } = require("@discordjs/voice");
const play = require("play-dl");
const fs = require("fs");
const express = require("express");
require("dotenv").config();

// ==================== UI / MARKA RENKLERİ ====================
// Botun tüm embed'lerinde tutarlı bir görsel kimlik için ortak renk paleti.
const RENK = {
  ana: 0x1B98F5,     // TSA marka mavisi (genel bilgi embed'leri)
  basari: 0x2ECC71,  // Yeşil (başarılı işlemler)
  hata: 0xE74C3C,    // Kırmızı (hatalar, ban/kick)
  uyari: 0xF5A623,   // Turuncu (uyarılar, dikkat gerektiren işlemler)
  ozel: 0x9B59B6,    // Mor (duyurular, listeler)
  altin: 0xF1C40F,   // Altın (liderlik, rütbeler)
  notr: 0x95A5A6     // Gri (nötr / varsayılan)
};

const ROBLOX_GRUP_LINK = "https://www.roblox.com/tr/communities/972348115/TSA-Turkish-Armed-Forces-Yeniden#!/about";

// Tüm embed'lerde tekrar eden footer + timestamp ayarını tek yerden yönetmek için yardımcı fonksiyon.
function tsaEmbed(color, guild = null) {
  const embed = new EmbedBuilder().setColor(color).setTimestamp();
  if (guild?.iconURL()) {
    embed.setFooter({ text: "TSA Discord Bot", iconURL: guild.iconURL({ dynamic: true }) });
  } else {
    embed.setFooter({ text: "TSA Discord Bot" });
  }
  return embed;
}

// ==================== EXPRESS ====================
const app = express();
app.get("/", (_, res) => res.send("OK"));
app.listen(process.env.PORT || 3000, "0.0.0.0");

// ==================== CONFIG ====================
const config = {
  TOKEN: process.env.DISCORD_TOKEN,
  BOT_SAHIBI: process.env.BOT_SAHIBI_ID,
  YETKILI_ROL: process.env.YETKILI_ROL_ID, // Yeni yetkili rol ID'si
  IZIN_ROL: process.env.IZIN_ROL_ID,
  UYARI_1_ROL: process.env.UYARI_1_ROL_ID,
  UYARI_2_ROL: process.env.UYARI_2_ROL_ID,
  UYARI_3_ROL: process.env.UYARI_3_ROL_ID,
  HABER_ROL: process.env.HABER_ROL_ID,
  HABER_KANAL: process.env.HABER_KANAL_ID,
  LOG_KANAL: process.env.LOG_CHANNEL_ID,
  ASKERI_PERSONEL_ROL: process.env.ASKERI_PERSONEL_ROL_ID, // Yeni: Askeri personel rolü ID'si
  GROUP_ID: process.env.GROUP_ID, // Roblox grup ID'si (/grup komutu için)
  OYUN_PLACE_ID: process.env.OYUN_PLACE_ID, // Roblox oyun Place ID'si (/oyun komutu için)
  DATA_FILE: "./data.json"
};

const EGITIM_ROL_ID = "1518397406578741348"; // Bu ID'ler sabit kalacak mı? Kullanıcıdan teyit almak gerekebilir.
const EGITIM_KANAL_ID = "1518357904779116554"; // Bu ID'ler sabit kalacak mı? Kullanıcıdan teyit almak gerekebilir.

// ==================== DATA ====================
let data = { uyari: {}, izin: {} };

if (fs.existsSync(config.DATA_FILE)) {
  try {
    data = JSON.parse(fs.readFileSync(config.DATA_FILE, "utf8"));
  } catch (e) {
    console.error("Error reading data.json:", e);
  }
}

const saveData = () => fs.writeFileSync(config.DATA_FILE, JSON.stringify(data, null, 2));

// ==================== MUSIC ====================
const player = createAudioPlayer({
  behaviors: { noSubscriber: NoSubscriberBehavior.Pause }
});
let queue = [];
let currentSong = null;

player.on(AudioPlayerStatus.Idle, () => {
  if (queue.length > 0) {
    const next = queue.shift();
    currentSong = next;
    const resource = createAudioResource(next.stream, { inputType: next.type });
    player.play(resource);
  } else {
    currentSong = null;
  }
});

player.on("error", error => {
  console.error(`Error: ${error.message} with resource ${error.resource.metadata.title}`);
});

// ==================== ROBLOX API HELPERS ====================
// Not: Bu fonksiyonlar Roblox'un herkese açık (public) API uç noktalarını kullanır,
// ROBLOX_COOKIE gerektirmez. Node.js 18+ sürümünde yerleşik fetch kullanılır.
async function getRobloxUserByUsername(username) {
  const res = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
  });
  if (!res.ok) throw new Error(`Roblox kullanıcı araması başarısız: ${res.status}`);
  const json = await res.json();
  if (!json.data || json.data.length === 0) return null;
  return json.data[0]; // { id, name, displayName, hasVerifiedBadge }
}

async function getRobloxUserDetail(userId) {
  const res = await fetch(`https://users.roblox.com/v1/users/${userId}`);
  if (!res.ok) throw new Error(`Roblox kullanıcı detayı alınamadı: ${res.status}`);
  return res.json(); // { description, created, isBanned, name, displayName, id, ... }
}

async function getRobloxAvatarUrl(userId) {
  const res = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`);
  if (!res.ok) return null;
  const json = await res.json();
  return json.data?.[0]?.imageUrl || null;
}

async function getRobloxGroups(userId) {
  const res = await fetch(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
  if (!res.ok) throw new Error(`Roblox grupları alınamadı: ${res.status}`);
  const json = await res.json();
  return json.data || []; // [{ group: { id, name }, role: { name, rank } }, ...]
}

// ==================== CLIENT ====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent // Mesaj içeriği intenti eklendi
  ]
});

// ==================== SLASH COMMANDS ====================
const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Botun gecikme süresini gösterir."),
  new SlashCommandBuilder().setName("yardim").setDescription("Mevcut tüm komutları listeler."),

  new SlashCommandBuilder()
    .setName("profil")
    .setDescription("Belirtilen kullanıcının veya kendi profilinizi, ya da bir Roblox profilini gösterir.")
    .addUserOption(o => o.setName("kullanici").setDescription("Discord kullanıcısı"))
    .addStringOption(o => o.setName("roblox").setDescription("Roblox kullanıcı adı (girilirse Roblox profili gösterilir)")),

  // ==================== YÖNETİCİ KOMUTLARI ====================
  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Belirtilen kullanıcıyı sunucudan atar.")
    .addUserOption(o => o.setName("kullanici").setDescription("Atılacak kullanıcı").setRequired(true))
    .addStringOption(o => o.setName("sebep").setDescription("Atma sebebi")),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Belirtilen kullanıcıyı sunucudan yasaklar.")
    .addUserOption(o => o.setName("kullanici").setDescription("Yasaklanacak kullanıcı").setRequired(true))
    .addStringOption(o => o.setName("sebep").setDescription("Yasaklama sebebi")),

  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Belirtilen kullanıcının sunucu yasağını kaldırır.")
    .addStringOption(o => o.setName("kullaniciid").setDescription("Yasağı kaldırılacak kullanıcının IDsi").setRequired(true)),

  new SlashCommandBuilder()
    .setName("temizle")
    .setDescription("Belirtilen sayıda mesajı kanaldan siler.")
    .addIntegerOption(o => o.setName("adet").setDescription("Silinecek mesaj adedi (1-100)").setRequired(true)),

  new SlashCommandBuilder()
    .setName("yavas-mod")
    .setDescription("Kanalın yavaş mod süresini ayarlar.")
    .addIntegerOption(o => o.setName("saniye").setDescription("Yavaş mod süresi (0-21600 saniye)").setRequired(true)),

  new SlashCommandBuilder().setName("kilitle").setDescription("Kanalı mesaj gönderimine kapatır."),
  new SlashCommandBuilder().setName("kilit-ac").setDescription("Kanalı mesaj gönderimine açar."),

  new SlashCommandBuilder()
    .setName("rol-ver")
    .setDescription("Belirtilen kullanıcıya rol verir.")
    .addUserOption(o => o.setName("kullanici").setDescription("Rol verilecek kullanıcı").setRequired(true))
    .addRoleOption(o => o.setName("rol").setDescription("Verilecek rol").setRequired(true)),

  new SlashCommandBuilder()
    .setName("rol-al")
    .setDescription("Belirtilen kullanıcıdan rol alır.")
    .addUserOption(o => o.setName("kullanici").setDescription("Rol alınacak kullanıcı").setRequired(true))
    .addRoleOption(o => o.setName("rol").setDescription("Alınacak rol").setRequired(true)),

  // ==================== UYARI SİSTEMİ ====================
  new SlashCommandBuilder()
    .setName("uyari-ver")
    .setDescription("Belirtilen kullanıcıya uyarı verir ve rol atar.")
    .addUserOption(o => o.setName("kullanici").setDescription("Uyarılacak kullanıcı").setRequired(true))
    .addStringOption(o => o.setName("sebep").setDescription("Uyarı sebebi").setRequired(true))
    .addIntegerOption(o => o.setName("seviye").setDescription("Uyarı seviyesi (1, 2 veya 3)").setRequired(true).setMinValue(1).setMaxValue(3)),

  new SlashCommandBuilder()
    .setName("uyari-sil")
    .setDescription("Belirtilen kullanıcının bir uyarısını siler.")
    .addUserOption(o => o.setName("kullanici").setDescription("Uyarısı silinecek kullanıcı").setRequired(true))
    .addIntegerOption(o => o.setName("no").setDescription("Silinecek uyarı numarası").setRequired(true)),

  new SlashCommandBuilder().setName("uyari-liste").setDescription("Tüm uyarıları listeler."),

  new SlashCommandBuilder()
    .setName("sicil")
    .setDescription("Belirtilen kullanıcının veya kendi uyarı sicilinizi gösterir.")
    .addUserOption(o => o.setName("kullanici").setDescription("Discord kullanıcısı")),

  new SlashCommandBuilder()
    .setName("sicil-temizle")
    .setDescription("Belirtilen kullanıcının tüm uyarı sicilini temizler.")
    .addUserOption(o => o.setName("kullanici").setDescription("Sicili temizlenecek kullanıcı").setRequired(true)),

  // ==================== İZİN SİSTEMİ ====================
  new SlashCommandBuilder()
    .setName("izin-al")
    .setDescription("İzin alır ve izinli rolünü üstlenirsiniz.")
    .addStringOption(o => o.setName("sebep").setDescription("İzin sebebi").setRequired(true))
    .addStringOption(o => o.setName("bitis").setDescription("İzin bitiş tarihi (örn: 01.01.2025)")),

  new SlashCommandBuilder().setName("izin-bitir").setDescription("Kendi izninizi bitirirsiniz."),
  new SlashCommandBuilder().setName("izin-listesi").setDescription("İzinli kullanıcıları listeler."),

  // ==================== SES KOMUTLARI ====================
  new SlashCommandBuilder().setName("ses-gir").setDescription("Botu bulunduğunuz ses kanalına çeker."),
  new SlashCommandBuilder().setName("ses-cik").setDescription("Botu ses kanalından çıkarır."),
  new SlashCommandBuilder().setName("yoklama").setDescription("Bulunduğunuz ses kanalındaki üyeleri listeler."),

  // ==================== DUYURU KOMUTLARI ====================
  new SlashCommandBuilder()
    .setName("haber-yap")
    .setDescription("Sunucuda bir haber duyurusu yapar.")
    .addStringOption(o => o.setName("baslik").setDescription("Haber başlığı").setRequired(true))
    .addStringOption(o => o.setName("icerik").setDescription("Haber içeriği").setRequired(true))
    .addStringOption(o => o.setName("resim").setDescription("Haber görseli URLsi")),

  new SlashCommandBuilder()
    .setName("egitim-duyuru")
    .setDescription("Eğitim duyurusu yapar.")
    .addUserOption(o => o.setName("host").setDescription("Eğitim hostu").setRequired(true))
    .addUserOption(o => o.setName("cohost").setDescription("Eğitim co-hostu").setRequired(true))
    .addStringOption(o => o.setName("tur").setDescription("Eğitim türü").setRequired(true))
    .addStringOption(o => o.setName("zaman").setDescription("Eğitim zamanı").setRequired(true)),

  new SlashCommandBuilder().setName("oyun").setDescription("TSA resmi oyun linkini gösterir."),
  new SlashCommandBuilder().setName("grup").setDescription("TSA resmi grup linkini gösterir."),

  new SlashCommandBuilder()
    .setName("dm-mesaj")
    .setDescription("Belirtilen kullanıcıya özel mesaj gönderir.")
    .addUserOption(o => o.setName("kullanici").setDescription("Mesaj gönderilecek kullanıcı").setRequired(true))
    .addStringOption(o => o.setName("mesaj").setDescription("Gönderilecek mesaj").setRequired(true)),

  new SlashCommandBuilder()
    .setName("duyuru")
    .setDescription("Sunucuda genel bir duyuru yapar.")
    .addStringOption(o => o.setName("mesaj").setDescription("Duyuru mesajı").setRequired(true))
    .addStringOption(o =>
      o.setName("etiket")
        .setDescription("Kimleri etiketleyeceğinizi seçin.")
        .setRequired(true)
        .addChoices(
          { name: "Herkes (everyone)", value: "everyone" },
          { name: "Buradakiler (here)", value: "here" },
          { name: "Askeri Personel (rol)", value: "military_role" },
          { name: "Etiketleme", value: "none" }
        )
    ),

  // ==================== MÜZİK KOMUTLARI ====================
  new SlashCommandBuilder()
    .setName("muzik-cal")
    .setDescription("Belirtilen şarkıyı çalar veya kuyruğa ekler.")
    .addStringOption(o => o.setName("sarki").setDescription("Çalınacak şarkının adı veya URLsi").setRequired(true)),

  new SlashCommandBuilder().setName("muzik-durdur").setDescription("Müziği durdurur ve kuyruğu temizler."),
  new SlashCommandBuilder().setName("muzik-gec").setDescription("Sıradaki şarkıya geçer."),
  new SlashCommandBuilder().setName("muzik-kuyruk").setDescription("Müzik kuyruğunu gösterir."),
  new SlashCommandBuilder().setName("muzik-simdiki").setDescription("Şu an çalan şarkıyı gösterir."),

  // ==================== DİĞER KOMUTLAR ====================
  new SlashCommandBuilder().setName("rutbeler").setDescription("TSA rütbe tablosunu gösterir."),
  new SlashCommandBuilder().setName("liderlik").setDescription("En aktif üyeleri gösterir."),
  new SlashCommandBuilder().setName("sunucu-bilgi").setDescription("Sunucu hakkında detaylı bilgi gösterir."),
  new SlashCommandBuilder()
    .setName("kullanici-bilgi")
    .setDescription("Belirtilen kullanıcı hakkında detaylı bilgi gösterir.")
    .addUserOption(o => o.setName("kullanici").setDescription("Bilgisi gösterilecek kullanıcı").setRequired(true)),
  new SlashCommandBuilder()
    .setName("rutbe-bilgi")
    .setDescription("Belirtilen bir rütbe hakkında bilgi gösterir.")
    .addRoleOption(o => o.setName("rol").setDescription("Bilgisi gösterilecek rütbe").setRequired(true)),
  new SlashCommandBuilder()
    .setName("aktiflik-denetleme")
    .setDescription("Belirtilen roldeki üyelerin aktiflik durumunu denetler (basit).")
    .addRoleOption(o => o.setName("rol").setDescription("Denetlenecek rol").setRequired(true))
].map(c => c.toJSON());

// ==================== READY ====================
client.once("ready", async () => {
  console.log(`✅ ${client.user.tag} hazır`);

  client.user.setPresence({
    activities: [{ name: "TSA - Turkish Special Army", type: ActivityType.Playing }],
    status: "online"
  });

  const rest = new REST({ version: "10" }).setToken(config.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log("✅ Slash komutları başarıyla yüklendi.");
  } catch (error) {
    console.error("❌ Slash komutları yüklenirken hata oluştu:", error);
  }
});

// ==================== HOŞ GELDİN SİSTEMİ ====================
client.on("guildMemberAdd", async member => {
  try {
    const grupButonu = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("🎮 Roblox Grubumuza Katıl")
        .setStyle(ButtonStyle.Link)
        .setURL(ROBLOX_GRUP_LINK)
    );

    const embed = new EmbedBuilder()
      .setColor(RENK.ana)
      .setTitle(`🎖️ TSA Ailesine Hoş Geldin, ${member.user.username}!`)
      .setDescription(
        `Merhaba **${member.user.username}**! 👋\n\n` +
        `**${member.guild.name}** sunucusuna katıldığın için çok mutluyuz. Aramıza katılman bizim için büyük bir onur.\n\n` +
        `📌 Sunucumuzda vakit geçirirken kurallara uymayı unutma ve herhangi bir sorunda yetkililerimizle iletişime geçmekten çekinme.\n\n` +
        `Aşağıdaki butona tıklayarak resmi Roblox grubumuza da katılabilirsin, orada da seni görmek isteriz! 🇹🇷`
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setImage(member.guild.bannerURL({ size: 1024 }) || null)
      .addFields(
        { name: "👥 Sunucu", value: member.guild.name, inline: true },
        { name: "🔢 Katılan Üye Sayısı", value: `${member.guild.memberCount}. üye`, inline: true }
      )
      .setFooter({ text: "TSA - Turkish Special Army", iconURL: member.guild.iconURL({ dynamic: true }) || undefined })
      .setTimestamp();

    await member.send({ embeds: [embed], components: [grupButonu] });
  } catch (e) {
    // Kullanıcının DM'leri kapalıysa buraya düşer; loga bilgi bırakıyoruz.
    console.log(`ℹ️ ${member.user.tag} kullanıcısına hoş geldin DM'i gönderilemedi (DM kapalı olabilir).`);
    await sendLogMessage(
      member.guild,
      "Hoş Geldin DM'i Gönderilemedi",
      `<@${member.id}> katıldı fakat DM'leri kapalı olduğu için hoş geldin mesajı gönderilemedi.`,
      RENK.uyari
    ).catch(() => {});
  }
});

// ==================== HELPER FUNCTIONS ====================
async function sendLogMessage(guild, title, description, color, fields = []) {
  if (!config.LOG_KANAL) return;
  const logChannel = guild.channels.cache.get(config.LOG_KANAL);
  if (!logChannel) return console.error("Log kanalı bulunamadı!");

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp()
    .setFooter({ text: "TSA Discord Bot Log" });

  if (fields.length > 0) {
    embed.addFields(fields);
  }

  await logChannel.send({ embeds: [embed] }).catch(console.error);
}

// ==================== INTERACTION ====================
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const cmd = interaction.commandName;
  const isYetkili = interaction.member.roles.cache.has(config.YETKILI_ROL) || interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
  const isEgitimHost = interaction.member.roles.cache.has(EGITIM_ROL_ID);

  // Yetkili komutları kontrolü
  const yetkiliKomutlar = ["kick", "ban", "unban", "temizle", "yavas-mod", "kilitle", "kilit-ac", "rol-ver", "rol-al", "uyari-ver", "uyari-sil", "uyari-liste", "sicil-temizle", "dm-mesaj", "haber-yap", "egitim-duyuru", "duyuru", "aktiflik-denetleme"];
  if (yetkiliKomutlar.includes(cmd) && !isYetkili) {
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Bu komutu kullanmak için yeterli yetkiniz yok!")], ephemeral: true });
  }

  try {
    // ==================== HERKES ====================
    if (cmd === "ping") {
      const uptime = process.uptime();
      const saat = Math.floor(uptime / 3600);
      const dakika = Math.floor((uptime % 3600) / 60);
      const embed = new EmbedBuilder()
        .setColor(RENK.ana)
        .setTitle("🏓 Pong!")
        .addFields(
          { name: "📡 API Gecikmesi", value: `${client.ws.ping}ms`, inline: true },
          { name: "⏱️ Çalışma Süresi", value: `${saat}sa ${dakika}dk`, inline: true }
        )
        .setFooter({ text: "TSA Discord Bot" })
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (cmd === "yardim") {
      // Yetkiye göre filtreleme: yetkisiz kullanıcılar admin komutlarını görmez.
      const yetkiliKomutlarListe = ["kick", "ban", "unban", "temizle", "yavas-mod", "kilitle", "kilit-ac", "rol-ver", "rol-al", "uyari-ver", "uyari-sil", "uyari-liste", "sicil-temizle", "dm-mesaj", "haber-yap", "egitim-duyuru", "duyuru", "aktiflik-denetleme"];

      // Discord embed field değeri 1024 karakteri geçemez, bu yüzden listeyi parçalara bölüyoruz.
      const chunkList = (items) => {
        const chunks = [];
        let current = "";
        for (const line of items) {
          if ((current + line + "\n").length > 1000) {
            chunks.push(current);
            current = "";
          }
          current += line + "\n";
        }
        if (current) chunks.push(current);
        return chunks;
      };

      const herkesLines = commands.filter(c => !yetkiliKomutlarListe.includes(c.name)).map(c => `**/${c.name}** - ${c.description}`);
      const yetkiliLines = commands.filter(c => yetkiliKomutlarListe.includes(c.name)).map(c => `**/${c.name}** - ${c.description}`);

      const embed = new EmbedBuilder()
        .setColor(RENK.ozel)
        .setTitle("📋 TSA Komut Listesi")
        .setFooter({ text: "TSA Discord Bot" });

      chunkList(herkesLines).forEach((chunk, i) => {
        embed.addFields({ name: i === 0 ? "🔓 Genel Komutlar" : "🔓 Genel Komutlar (devam)", value: chunk });
      });

      if (isYetkili) {
        chunkList(yetkiliLines).forEach((chunk, i) => {
          embed.addFields({ name: i === 0 ? "🔒 Yetkili Komutları" : "🔒 Yetkili Komutları (devam)", value: chunk });
        });
      }

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (cmd === "profil") {
      await interaction.deferReply();

      const robloxUsername = interaction.options.getString("roblox");

      // ---- ROBLOX PROFİLİ (yeni özellik) ----
      if (robloxUsername) {
        try {
          const robloxUser = await getRobloxUserByUsername(robloxUsername);
          if (!robloxUser) {
            return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(`❌ **${robloxUsername}** adında bir Roblox kullanıcısı bulunamadı.`)] });
          }

          const [detail, avatarUrl, groups] = await Promise.all([
            getRobloxUserDetail(robloxUser.id),
            getRobloxAvatarUrl(robloxUser.id),
            getRobloxGroups(robloxUser.id).catch(() => [])
          ]);

          let groupText = "Hiçbir gruba üye değil.";
          if (groups.length > 0) {
            groupText = groups.slice(0, 15).map(g => `**${g.group.name}** — ${g.role.name}`).join("\n");
            if (groups.length > 15) groupText += `\n...ve **${groups.length - 15}** grup daha.`;
          }

          const baslik = detail.displayName && detail.displayName !== detail.name
            ? `${detail.displayName} (@${detail.name})`
            : detail.name;

          const embed = new EmbedBuilder()
            .setColor(RENK.ana)
            .setTitle(`🎮 ${baslik} - Roblox Profili`)
            .setURL(`https://www.roblox.com/users/${robloxUser.id}/profile`)
            .setThumbnail(avatarUrl)
            .addFields(
              { name: "🆔 Roblox ID", value: robloxUser.id.toString(), inline: true },
              { name: "🗓️ Hesap Oluşturma Tarihi", value: `<t:${parseInt(new Date(detail.created).getTime() / 1000)}:D>`, inline: true },
              { name: "🚫 Banlı mı", value: detail.isBanned ? "✅ Evet" : "❌ Hayır", inline: true },
              { name: "📝 Açıklama", value: detail.description ? detail.description.slice(0, 500) : "Açıklama yok.", inline: false },
              { name: `👥 Gruplar (${groups.length})`, value: groupText, inline: false }
            )
            .setFooter({ text: "TSA Discord Bot - Roblox Profili" });

          return interaction.editReply({ embeds: [embed] });
        } catch (e) {
          console.error("Roblox profil hatası:", e);
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Roblox profili alınırken bir hata oluştu. Kullanıcı adını kontrol edip tekrar deneyin.")] });
        }
      }

      // ---- DISCORD PROFİLİ (eski davranış) ----
      const user = interaction.options.getUser("kullanici") || interaction.user;
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!member) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Kullanıcı bulunamadı.")] });

      const uyariSayisi = data.uyari[user.id]?.length || 0;
      const izinDurumu = data.izin[user.id] ? "✅ İzinli" : "❌ İzinli Değil";

      const embed = new EmbedBuilder()
        .setColor(RENK.basari)
        .setTitle(`${user.tag} Profili`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: "⚠️ Uyarı Sayısı", value: `${uyariSayisi}`, inline: true },
          { name: "📋 İzin Durumu", value: izinDurumu, inline: true },
          { name: "🗓️ Katılma Tarihi", value: `<t:${parseInt(member.joinedTimestamp / 1000)}:D>`, inline: true }
        )
        .setFooter({ text: "TSA Discord Bot" });
      return interaction.editReply({ embeds: [embed] });
    }

    // ==================== KICK / BAN / UNBAN ====================
    if (cmd === "kick") {
      await interaction.deferReply({ ephemeral: true });
      const user = interaction.options.getUser("kullanici");
      const sebep = interaction.options.getString("sebep") || "Belirtilmedi";
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (!member) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Kullanıcı bulunamadı.")] });
      if (!member.kickable) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Bu kullanıcıyı atamıyorum.")] });

      await member.kick(sebep);
      await sendLogMessage(interaction.guild, "Kullanıcı Atıldı", `${user.tag} sunucudan atıldı.`, RENK.uyari, [
        { name: "Kullanıcı", value: `<@${user.id}>`, inline: true },
        { name: "Sebep", value: sebep, inline: true },
        { name: "Yetkili", value: `<@${interaction.user.id}>`, inline: true }
      ]);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.uyari).setDescription(`👢 **${user.tag}** sunucudan atıldı. Sebep: ${sebep}`)] });
    }

    if (cmd === "ban") {
      await interaction.deferReply({ ephemeral: true });
      const user = interaction.options.getUser("kullanici");
      const sebep = interaction.options.getString("sebep") || "Belirtilmedi";
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (member && !member.bannable) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Bu kullanıcıyı yasaklayamıyorum.")] });

      await interaction.guild.members.ban(user.id, { reason: sebep });
      await sendLogMessage(interaction.guild, "Kullanıcı Yasaklandı", `${user.tag} sunucudan yasaklandı.`, RENK.hata, [
        { name: "Kullanıcı", value: `<@${user.id}>`, inline: true },
        { name: "Sebep", value: sebep, inline: true },
        { name: "Yetkili", value: `<@${interaction.user.id}>`, inline: true }
      ]);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(`🔨 **${user.tag}** sunucudan yasaklandı. Sebep: ${sebep}`)] });
    }

    if (cmd === "unban") {
      await interaction.deferReply({ ephemeral: true });
      const userId = interaction.options.getString("kullaniciid");
      try {
        const bannedUser = await interaction.guild.bans.fetch(userId);
        await interaction.guild.members.unban(userId);
        await sendLogMessage(interaction.guild, "Kullanıcı Yasağı Kaldırıldı", `<@${userId}> kullanıcısının yasağı kaldırıldı.`, RENK.basari, [
          { name: "Kullanıcı ID", value: userId, inline: true },
          { name: "Yetkili", value: `<@${interaction.user.id}>`, inline: true }
        ]);
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription(`✅ <@${userId}> kullanıcısının yasağı başarıyla kaldırıldı.`)] });
      } catch (e) {
        console.error(e);
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Yasak kaldırılamadı veya kullanıcı yasaklı değil.")] });
      }
    }

    // ==================== TEMİZLE / YAVAŞ-MOD ====================
    if (cmd === "temizle") {
      await interaction.deferReply({ ephemeral: true });
      const amount = interaction.options.getInteger("adet");
      if (amount < 1 || amount > 100) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Silinecek mesaj adedi 1 ile 100 arasında olmalı.")] });
      }
      const fetched = await interaction.channel.messages.fetch({ limit: amount });
      await interaction.channel.bulkDelete(fetched, true);
      await sendLogMessage(interaction.guild, "Mesajlar Temizlendi", `${amount} adet mesaj ${interaction.channel.name} kanalından silindi.`, RENK.ana, [
        { name: "Kanal", value: `<#${interaction.channel.id}>`, inline: true },
        { name: "Adet", value: amount.toString(), inline: true },
        { name: "Yetkili", value: `<@${interaction.user.id}>`, inline: true }
      ]);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.ana).setDescription(`✅ **${amount}** adet mesaj başarıyla silindi.`)] });
    }

    if (cmd === "yavas-mod") {
      await interaction.deferReply({ ephemeral: true });
      const saniye = interaction.options.getInteger("saniye");
      if (saniye < 0 || saniye > 21600) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Yavaş mod süresi 0 ile 21600 saniye arasında olmalı.")] });
      }
      await interaction.channel.setRateLimitPerUser(saniye);
      const mesaj = saniye === 0 ? "Yavaş mod kapatıldı." : `Kanal **${saniye} saniye** yavaşlatıldı.`;
      await sendLogMessage(interaction.guild, "Yavaş Mod Ayarlandı", `${interaction.channel.name} kanalında yavaş mod ayarlandı.`, RENK.ana, [
        { name: "Kanal", value: `<#${interaction.channel.id}>`, inline: true },
        { name: "Süre", value: `${saniye} saniye`, inline: true },
        { name: "Yetkili", value: `<@${interaction.user.id}>`, inline: true }
      ]);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.ana).setDescription(`✅ ${mesaj}`)] });
    }

    if (cmd === "kilitle") {
      await interaction.deferReply({ ephemeral: true });
      await interaction.channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: false });
      await sendLogMessage(interaction.guild, "Kanal Kilitlendi", `${interaction.channel.name} kanalı kilitlendi.`, RENK.hata, [
        { name: "Kanal", value: `<#${interaction.channel.id}>`, inline: true },
        { name: "Yetkili", value: `<@${interaction.user.id}>`, inline: true }
      ]);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("🔒 Kanal başarıyla kilitlendi. Artık kimse mesaj gönderemez.")] });
    }

    if (cmd === "kilit-ac") {
      await interaction.deferReply({ ephemeral: true });
      await interaction.channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: null });
      await sendLogMessage(interaction.guild, "Kanal Kilidi Açıldı", `${interaction.channel.name} kanalının kilidi açıldı.`, RENK.basari, [
        { name: "Kanal", value: `<#${interaction.channel.id}>`, inline: true },
        { name: "Yetkili", value: `<@${interaction.user.id}>`, inline: true }
      ]);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription("🔓 Kanal kilidi başarıyla açıldı. Artık mesaj gönderilebilir.")] });
    }

    if (cmd === "rol-ver") {
      await interaction.deferReply({ ephemeral: true });
      const member = interaction.options.getMember("kullanici");
      const role = interaction.options.getRole("rol");

      if (!member) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Kullanıcı bulunamadı.")] });
      if (!role) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Rol bulunamadı.")] });
      if (member.roles.cache.has(role.id)) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Kullanıcı zaten bu role sahip.")] });

      // Hiyerarşi kontrolü: kişi sadece kendi en yüksek rolünden daha düşük bir rolü verebilir.
      const isAdminRolVer = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
      if (!isAdminRolVer && role.position >= interaction.member.roles.highest.position) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Kendi rütbenizden yüksek veya eşit bir rolü veremezsiniz.")] });
      }

      await member.roles.add(role.id);
      await sendLogMessage(interaction.guild, "Rol Verildi", `${member.user.tag} kullanıcısına rol verildi.`, RENK.basari, [
        { name: "Kullanıcı", value: `<@${member.id}>`, inline: true },
        { name: "Rol", value: `<@&${role.id}>`, inline: true },
        { name: "Yetkili", value: `<@${interaction.user.id}>`, inline: true }
      ]);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription(`✅ **${member.user.tag}** kullanıcısına **${role.name}** rolü başarıyla verildi.`)] });
    }

    if (cmd === "rol-al") {
      await interaction.deferReply({ ephemeral: true });
      const member = interaction.options.getMember("kullanici");
      const role = interaction.options.getRole("rol");

      if (!member) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Kullanıcı bulunamadı.")] });
      if (!role) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Rol bulunamadı.")] });
      if (!member.roles.cache.has(role.id)) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Kullanıcı bu role sahip değil.")] });

      // Hiyerarşi kontrolü: kişi sadece kendi en yüksek rolünden daha düşük bir rolü alabilir.
      const isAdminRolAl = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
      if (!isAdminRolAl && role.position >= interaction.member.roles.highest.position) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Kendi rütbenizden yüksek veya eşit bir rolü alamazsınız.")] });
      }

      await member.roles.remove(role.id);
      await sendLogMessage(interaction.guild, "Rol Alındı", `${member.user.tag} kullanıcısından rol alındı.`, RENK.uyari, [
        { name: "Kullanıcı", value: `<@${member.id}>`, inline: true },
        { name: "Rol", value: `<@&${role.id}>`, inline: true },
        { name: "Yetkili", value: `<@${interaction.user.id}>`, inline: true }
      ]);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.uyari).setDescription(`✅ **${member.user.tag}** kullanıcısından **${role.name}** rolü başarıyla alındı.`)] });
    }

    // ==================== UYARI SİSTEMİ ====================
    if (cmd === "uyari-ver") {
      await interaction.deferReply({ ephemeral: true });
      const user = interaction.options.getUser("kullanici");
      const sebep = interaction.options.getString("sebep");
      const seviye = interaction.options.getInteger("seviye");
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (!member) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Kullanıcı bulunamadı.")] });

      if (!data.uyari[user.id]) data.uyari[user.id] = [];
      data.uyari[user.id].push({ sebep, tarih: new Date().toISOString(), veren: interaction.user.id, seviye });
      saveData();

      // Önceki uyarı rollerini kaldır
      const uyariRolleri = [config.UYARI_1_ROL, config.UYARI_2_ROL, config.UYARI_3_ROL];
      for (const rolId of uyariRolleri) {
        if (rolId && member.roles.cache.has(rolId)) {
          await member.roles.remove(rolId).catch(console.error);
        }
      }

      // Yeni uyarı rolünü ver
      let verilecekRolId = null;
      if (seviye === 1 && config.UYARI_1_ROL) verilecekRolId = config.UYARI_1_ROL;
      else if (seviye === 2 && config.UYARI_2_ROL) verilecekRolId = config.UYARI_2_ROL;
      else if (seviye === 3 && config.UYARI_3_ROL) verilecekRolId = config.UYARI_3_ROL;

      if (verilecekRolId) {
        await member.roles.add(verilecekRolId).catch(console.error);
      }

      const count = data.uyari[user.id].length;
      await sendLogMessage(interaction.guild, "Kullanıcı Uyarıldı", `${user.tag} kullanıcısı uyarıldı.`, RENK.uyari, [
        { name: "Kullanıcı", value: `<@${user.id}>`, inline: true },
        { name: "Sebep", value: sebep, inline: true },
        { name: "Seviye", value: seviye.toString(), inline: true },
        { name: "Toplam Uyarı", value: count.toString(), inline: true },
        { name: "Yetkili", value: `<@${interaction.user.id}>`, inline: true }
      ]);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.uyari).setDescription(`✅ **${user.tag}** kullanıcısı **${seviye}. seviye** uyarı aldı. Sebep: ${sebep} (Toplam: **${count}**)`)] });
    }

    if (cmd === "uyari-sil") {
      await interaction.deferReply({ ephemeral: true });
      const user = interaction.options.getUser("kullanici");
      const no = interaction.options.getInteger("no");

      if (!data.uyari[user.id] || data.uyari[user.id].length < no) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Belirtilen uyarı bulunamadı.")] });
      }

      const deletedWarning = data.uyari[user.id].splice(no - 1, 1)[0];
      saveData();

      // Uyarı rolleri kontrolü ve güncellemesi
      const currentWarningCount = data.uyari[user.id].length;
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (member) {
        const uyariRolleri = [config.UYARI_1_ROL, config.UYARI_2_ROL, config.UYARI_3_ROL];
        for (const rolId of uyariRolleri) {
          if (rolId && member.roles.cache.has(rolId)) {
            await member.roles.remove(rolId).catch(console.error);
          }
        }
        // Son uyarı seviyesine göre rol atama (eğer varsa)
        if (currentWarningCount > 0) {
          const lastWarningSeviye = data.uyari[user.id][currentWarningCount - 1].seviye;
          let verilecekRolId = null;
          if (lastWarningSeviye === 1 && config.UYARI_1_ROL) verilecekRolId = config.UYARI_1_ROL;
          else if (lastWarningSeviye === 2 && config.UYARI_2_ROL) verilecekRolId = config.UYARI_2_ROL;
          else if (lastWarningSeviye === 3 && config.UYARI_3_ROL) verilecekRolId = config.UYARI_3_ROL;
          if (verilecekRolId) {
            await member.roles.add(verilecekRolId).catch(console.error);
          }
        }
      }

      await sendLogMessage(interaction.guild, "Uyarı Silindi", `${user.tag} kullanıcısının bir uyarısı silindi.`, RENK.basari, [
        { name: "Kullanıcı", value: `<@${user.id}>`, inline: true },
        { name: "Silinen Uyarı", value: `No: ${no}, Sebep: ${deletedWarning.sebep}`, inline: false },
        { name: "Yetkili", value: `<@${interaction.user.id}>`, inline: true }
      ]);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription(`✅ **${user.tag}** kullanıcısının **${no}.** uyarısı başarıyla silindi.`)] });
    }

    if (cmd === "uyari-liste") {
      await interaction.deferReply({ ephemeral: true });
      const all = Object.keys(data.uyari).filter(id => data.uyari[id].length > 0);
      if (all.length === 0) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription("Sunucuda hiç uyarı bulunmamaktadır.")] });

      let desc = "";
      for (const id of all) {
        desc += `<@${id}> → **${data.uyari[id].length}** uyarı (Son seviye: ${data.uyari[id][data.uyari[id].length - 1].seviye})\n`;
      }
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.uyari).setTitle("⚠️ Tüm Uyarılar Listesi").setDescription(desc)] });
    }

    if (cmd === "sicil") {
      await interaction.deferReply({ ephemeral: true });
      const user = interaction.options.getUser("kullanici") || interaction.user;
      const list = data.uyari[user.id] || [];

      const embed = new EmbedBuilder()
        .setColor(RENK.ana)
        .setTitle(`${user.tag} - Uyarı Sicili`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: "TSA Discord Bot" });

      if (list.length) {
        const sicilText = list.map((x, i) => `**${i + 1}.** Sebep: ${x.sebep} | Seviye: ${x.seviye} | Veren: <@${x.veren}> | Tarih: <t:${parseInt(new Date(x.tarih).getTime() / 1000)}:D>`).join("\n");
        embed.setDescription(sicilText);
      } else {
        embed.setDescription("✅ Bu kullanıcının temiz bir sicili var.");
      }
      return interaction.editReply({ embeds: [embed] });
    }

    if (cmd === "sicil-temizle") {
      await interaction.deferReply({ ephemeral: true });
      const user = interaction.options.getUser("kullanici");
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (!member) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Kullanıcı bulunamadı.")] });

      if (!data.uyari[user.id] || data.uyari[user.id].length === 0) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.ana).setDescription(`**${user.tag}** kullanıcısının zaten temiz bir sicili var.`)] });
      }

      delete data.uyari[user.id];
      saveData();

      // Tüm uyarı rollerini kaldır
      const uyariRolleri = [config.UYARI_1_ROL, config.UYARI_2_ROL, config.UYARI_3_ROL];
      for (const rolId of uyariRolleri) {
        if (rolId && member.roles.cache.has(rolId)) {
          await member.roles.remove(rolId).catch(console.error);
        }
      }

      await sendLogMessage(interaction.guild, "Sicil Temizlendi", `${user.tag} kullanıcısının sicili temizlendi.`, RENK.basari, [
        { name: "Kullanıcı", value: `<@${user.id}>`, inline: true },
        { name: "Yetkili", value: `<@${interaction.user.id}>`, inline: true }
      ]);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription(`✅ **${user.tag}** kullanıcısının tüm uyarı sicili başarıyla temizlendi.`)] });
    }

    // ==================== İZİN SİSTEMİ ====================
    if (cmd === "izin-al") {
      await interaction.deferReply({ ephemeral: true });
      const sebep = interaction.options.getString("sebep");
      const bitis = interaction.options.getString("bitis");

      if (data.izin[interaction.user.id]) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Zaten izinlisiniz.")] });

      data.izin[interaction.user.id] = { sebep, bitis: bitis || "Belirtilmedi", baslangic: new Date().toISOString() };
      saveData();

      if (config.IZIN_ROL) await interaction.member.roles.add(config.IZIN_ROL).catch(console.error);
      await sendLogMessage(interaction.guild, "İzin Alındı", `${interaction.user.tag} izin aldı.`, RENK.basari, [
        { name: "Kullanıcı", value: `<@${interaction.user.id}>`, inline: true },
        { name: "Sebep", value: sebep, inline: true },
        { name: "Bitiş Tarihi", value: bitis || "Belirtilmedi", inline: true }
      ]);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription(`✅ Başarıyla izin aldınız! Sebep: **${sebep}**`)] });
    }

    if (cmd === "izin-bitir") {
      await interaction.deferReply({ ephemeral: true });
      if (!data.izin[interaction.user.id]) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Zaten izinli değilsiniz.")] });

      const izinBilgisi = data.izin[interaction.user.id];
      delete data.izin[interaction.user.id];
      saveData();

      if (config.IZIN_ROL) await interaction.member.roles.remove(config.IZIN_ROL).catch(console.error);
      await sendLogMessage(interaction.guild, "İzin Bitirildi", `${interaction.user.tag} iznini bitirdi.`, RENK.ana, [
        { name: "Kullanıcı", value: `<@${interaction.user.id}>`, inline: true },
        { name: "Sebep", value: izinBilgisi.sebep, inline: true },
        { name: "Başlangıç", value: `<t:${parseInt(new Date(izinBilgisi.baslangic).getTime() / 1000)}:D>`, inline: true }
      ]);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription("✅ İzniniz başarıyla bitirildi.")] });
    }

    if (cmd === "izin-listesi") {
      await interaction.deferReply({ ephemeral: true });
      const list = Object.keys(data.izin);
      if (list.length === 0) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.ana).setDescription("Şu anda izinli kimse bulunmamaktadır.")] });

      let desc = "";
      for (const id of list) {
        const izin = data.izin[id];
        desc += `<@${id}> | Sebep: **${izin.sebep}** | Bitiş: **${izin.bitis}**\n`;
      }
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.ozel).setTitle("📋 İzinli Kullanıcılar Listesi").setDescription(desc)] });
    }

    // ==================== SES KOMUTLARI ====================
    if (cmd === "ses-gir") {
      await interaction.deferReply({ ephemeral: true });
      const channel = interaction.member.voice.channel;
      if (!channel) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Ses kanalına katılmak için önce bir ses kanalında olmalısınız.")] });

      joinVoiceChannel({ channelId: channel.id, guildId: interaction.guild.id, adapterCreator: interaction.guild.voiceAdapterCreator });
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription(`✅ Başarıyla **${channel.name}** ses kanalına katıldım.`)] });
    }

    if (cmd === "ses-cik") {
      await interaction.deferReply({ ephemeral: true });
      const connection = getVoiceConnection(interaction.guild.id);
      if (connection) {
        connection.destroy();
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.uyari).setDescription("✅ Ses kanalından başarıyla ayrıldım.")] });
      } else {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Zaten bir ses kanalında değilim.")] });
      }
    }

    if (cmd === "yoklama") {
      await interaction.deferReply({ ephemeral: true });
      const voiceChannel = interaction.member.voice.channel;

      if (!voiceChannel) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Yoklama almak için bir ses kanalında olmalısınız.")] });
      }

      const members = voiceChannel.members.map(member => `<@${member.id}>`).join("\n") || "Ses kanalında kimse yok.";

      const embed = new EmbedBuilder()
        .setColor(RENK.ana)
        .setTitle(`🎤 ${voiceChannel.name} Kanalı Yoklaması`)
        .setDescription(members)
        .setFooter({ text: `Toplam Üye: ${voiceChannel.members.size}` });

      return interaction.editReply({ embeds: [embed] });
    }

    // ==================== DUYURU KOMUTLARI ====================
    if (cmd === "haber-yap") {
      await interaction.deferReply({ ephemeral: true });
      const baslik = interaction.options.getString("baslik");
      const icerik = interaction.options.getString("icerik");
      const resim = interaction.options.getString("resim");

      const embed = new EmbedBuilder()
        .setColor(RENK.ana)
        .setTitle(`📰 ${baslik}`)
        .setDescription(icerik)
        .setTimestamp()
        .setFooter({ text: `Haberi Yapan: ${interaction.user.tag}` });
      if (resim) embed.setImage(resim);

      const kanal = interaction.guild.channels.cache.get(config.HABER_KANAL);
      if (kanal) {
        await kanal.send({ content: "@everyone", embeds: [embed] });
        await sendLogMessage(interaction.guild, "Haber Yayınlandı", `Yeni bir haber yayınlandı: **${baslik}**`, RENK.ana, [
          { name: "Başlık", value: baslik, inline: false },
          { name: "Yayınlayan", value: `<@${interaction.user.id}>`, inline: true }
        ]);
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription("✅ Haber başarıyla yayınlandı.")] });
      } else {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Haber kanalı bulunamadı veya ayarlanmadı.")] });
      }
    }

    if (cmd === "egitim-duyuru") {
      await interaction.deferReply({ ephemeral: true });
      const host = interaction.options.getUser("host");
      const cohost = interaction.options.getUser("cohost");
      const tur = interaction.options.getString("tur");
      const zaman = interaction.options.getString("zaman");

      const embed = new EmbedBuilder()
        .setColor(RENK.ozel)
        .setTitle("📚 Eğitim Duyurusu")
        .addFields(
          { name: "🎓 Host", value: `${host}`, inline: true },
          { name: "🎓 Co-Host", value: `${cohost}`, inline: true },
          { name: "📖 Tür", value: tur, inline: true },
          { name: "🕒 Zaman", value: zaman, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: "TSA Discord Bot" });

      const kanal = interaction.guild.channels.cache.get(EGITIM_KANAL_ID);
      if (kanal) {
        await kanal.send({ content: "@everyone", embeds: [embed] });
        await sendLogMessage(interaction.guild, "Eğitim Duyurusu Yapıldı", `Yeni bir eğitim duyurusu yapıldı: **${tur}**`, RENK.ozel, [
          { name: "Host", value: `<@${host.id}>`, inline: true },
          { name: "Tür", value: tur, inline: true },
          { name: "Zaman", value: zaman, inline: true },
          { name: "Yayınlayan", value: `<@${interaction.user.id}>`, inline: true }
        ]);
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription("✅ Eğitim duyurusu başarıyla yapıldı.")] });
      } else {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Eğitim kanalı bulunamadı veya ayarlanmadı.")] });
      }
    }

    if (cmd === "oyun") {
      const placeId = config.OYUN_PLACE_ID;
      const oyunLink = placeId ? `https://www.roblox.com/games/${placeId}` : "https://www.roblox.com/tr/games/138257110169831/T-rk-Asker-Oyunu";
      const embed = new EmbedBuilder()
        .setColor(RENK.basari)
        .setTitle("🎮 TSA | Resmi Oyun")
        .setDescription("Resmi Roblox oyunumuza katılmak için aşağıdaki butona tıklayabilirsin!")
        .setThumbnail(interaction.guild.iconURL({ dynamic: true }) || null)
        .setFooter({ text: "TSA - Turkish Special Army" })
        .setTimestamp();
      const buton = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel("▶️ Oyuna Git").setStyle(ButtonStyle.Link).setURL(oyunLink)
      );
      return interaction.reply({ content: "@everyone", embeds: [embed], components: [buton] });
    }

    if (cmd === "grup") {
      const groupId = config.GROUP_ID;
      const grupLink = groupId ? `https://www.roblox.com/communities/${groupId}` : ROBLOX_GRUP_LINK;
      const embed = new EmbedBuilder()
        .setColor(RENK.ana)
        .setTitle("👥 TSA | Resmi Grup")
        .setDescription("Resmi Roblox grubumuza katılmak için aşağıdaki butona tıklayabilirsin!")
        .setThumbnail(interaction.guild.iconURL({ dynamic: true }) || null)
        .setFooter({ text: "TSA - Turkish Special Army" })
        .setTimestamp();
      const buton = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel("👥 Gruba Katıl").setStyle(ButtonStyle.Link).setURL(grupLink)
      );
      return interaction.reply({ content: "@everyone", embeds: [embed], components: [buton] });
    }

    if (cmd === "dm-mesaj") {
      await interaction.deferReply({ ephemeral: true });
      const target = interaction.options.getUser("kullanici");
      const mesaj = interaction.options.getString("mesaj");
      try {
        await target.send(mesaj);
        await sendLogMessage(interaction.guild, "DM Gönderildi", `${interaction.user.tag} tarafından ${target.tag} kullanıcısına DM gönderildi.`, RENK.ana, [
          { name: "Gönderen", value: `<@${interaction.user.id}>`, inline: true },
          { name: "Alıcı", value: `<@${target.id}>`, inline: true },
          { name: "Mesaj", value: mesaj, inline: false }
        ]);
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription(`✅ **${target.tag}** kişisine özel mesaj başarıyla gönderildi.`)] });
      } catch (e) {
        console.error(e);
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("DM gönderilemedi. Kullanıcının DMleri kapalı olabilir.")] });
      }
    }

    if (cmd === "duyuru") {
      await interaction.deferReply({ ephemeral: true });
      const mesaj = interaction.options.getString("mesaj");
      const etiket = interaction.options.getString("etiket");

      let content = "";
      if (etiket === "everyone") {
        content = "@everyone";
      } else if (etiket === "here") {
        content = "@here";
      } else if (etiket === "military_role") {
        if (config.ASKERI_PERSONEL_ROL) {
          content = `<@&${config.ASKERI_PERSONEL_ROL}>`;
        } else {
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Askeri Personel rolü ayarlanmamış. Lütfen .env dosyasını kontrol edin.")] });
        }
      }

      const embed = new EmbedBuilder()
        .setColor(RENK.uyari)
        .setTitle("📢 Genel Duyuru")
        .setDescription(mesaj)
        .setTimestamp()
        .setFooter({ text: `Duyuru Yapan: ${interaction.user.tag}` });

      await interaction.channel.send({ content: content, embeds: [embed] });
      await sendLogMessage(interaction.guild, "Genel Duyuru Yapıldı", `Yeni bir genel duyuru yapıldı.`, RENK.uyari, [
        { name: "Duyuru", value: mesaj, inline: false },
        { name: "Etiket", value: etiket, inline: true },
        { name: "Yayınlayan", value: `<@${interaction.user.id}>`, inline: true }
      ]);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription("✅ Duyuru başarıyla yapıldı.")] });
    }

    // ==================== MÜZİK KOMUTLARI ====================
    if (cmd === "muzik-cal") {
      await interaction.deferReply();
      const vc = interaction.member.voice.channel;
      if (!vc) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Müzik çalmak için önce bir ses kanalında olmalısınız.")] });

      const query = interaction.options.getString("sarki");
      let streamInfo;
      try {
        const searchResult = await play.search(query, { limit: 1 });
        if (searchResult.length === 0) {
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Şarkı bulunamadı.")] });
        }
        streamInfo = await play.stream(searchResult[0].url);
        streamInfo.title = searchResult[0].title;
        streamInfo.url = searchResult[0].url;
      } catch (e) {
        console.error("Müzik akışı alınırken hata:", e);
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Müzik çalınırken bir hata oluştu.")] });
      }

      queue.push(streamInfo);

      if (player.state.status !== AudioPlayerStatus.Playing) {
        const conn = joinVoiceChannel({ channelId: vc.id, guildId: interaction.guild.id, adapterCreator: interaction.guild.voiceAdapterCreator });
        currentSong = queue.shift();
        const resource = createAudioResource(currentSong.stream, { inputType: currentSong.type });
        player.play(resource);
        conn.subscribe(player);
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription(`▶️ Şimdi çalıyor: **[${currentSong.title}](${currentSong.url})**`)] });
      } else {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription(`✅ **[${streamInfo.title}](${streamInfo.url})** kuyruğa eklendi. (Sıra: ${queue.length})`)] });
      }
    }

    if (cmd === "muzik-durdur") {
      await interaction.deferReply({ ephemeral: true });
      const connection = getVoiceConnection(interaction.guild.id);
      if (connection) {
        connection.destroy();
        queue = [];
        currentSong = null;
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.uyari).setDescription("⏹️ Müzik durduruldu ve kuyruk temizlendi.")] });
      } else {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Zaten müzik çalmıyor veya bir ses kanalında değilim.")] });
      }
    }

    if (cmd === "muzik-gec") {
      await interaction.deferReply({ ephemeral: true });
      if (queue.length > 0) {
        player.stop(); // Bu, player.on(AudioPlayerStatus.Idle) tetikleyecek ve sıradaki şarkıyı çalacak.
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.ana).setDescription("⏭️ Sıradaki şarkıya geçiliyor.")] });
      } else {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Kuyrukta başka şarkı bulunmuyor.")] });
      }
    }

    if (cmd === "muzik-kuyruk") {
      await interaction.deferReply({ ephemeral: true });
      if (queue.length === 0 && !currentSong) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.ana).setDescription("Müzik kuyruğu boş.")] });
      }

      let description = currentSong ? `**Şu An Çalan:** [${currentSong.title}](${currentSong.url})\n\n` : "";
      if (queue.length > 0) {
        description += "**Sıradaki Şarkılar:**\n" + queue.map((song, index) => `**${index + 1}.** [${song.title}](${song.url})`).join("\n");
      } else if (!currentSong) {
        description = "Müzik kuyruğu boş.";
      }

      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.ozel).setTitle("🎶 Müzik Kuyruğu").setDescription(description)] });
    }

    if (cmd === "muzik-simdiki") {
      await interaction.deferReply({ ephemeral: true });
      if (currentSong) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription(`▶️ Şu an çalıyor: **[${currentSong.title}](${currentSong.url})**`)] });
      } else {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Şu an hiçbir şarkı çalmıyor.")] });
      }
    }

    // ==================== DİĞER KOMUTLAR ====================
    if (cmd === "rutbeler") {
      const rutbeTablosu = `
**TSA Rütbe Tablosu**

255. TSA
254. Grup Sahibi
253. 2. Grup Sahibi
252. Geliştirme Ofisi Başkanı
251. Geliştirme Ofisi
250. Stajyer Geliştirme Ofisi
40. Rütbelendirme Botu
36. Yardımcı Grup Sahibi
35. OF-10 Mareşal
34. Yönetim Kurulu Başkanı
33. Yönetim Kurulu Başkan Y.
32. Yönetim Kurulu
31. Yüksek Askeri Şura
30. Genel Kurmay Başkanı
29. Genel Kurmay
27. Lider
26. Disiplin Kurulu
25. Ordu Komutanı
23. Paşa
20. [OF-9] Orgeneral
19. [OF-8] Korgeneral
18. [OF-7] Tümgeneral
17. [OF-6] Tuğgeneral
16. [OF-5] Albay
15. [OF-4] Yarbay
14. [OF-3] Binbaşı
13. [OF-2] YüzBaşı
12. [OF-1/C] Üsteğmen
11. [OF-1/B] Teğmen
10. [OF-1/A] Asteğmen
9. [OR-9] Astsubay Kıdemli Başçavuş
8. [OR-8] Astsubay Başçavuş
7. [OR-7] Astsubay Üstçavuş
6. [OR-6] Astsubay Çavuş
5. [OR-5] Uzman Çavuş
4. [OR-4] Çavuş
3. [OR-3] Uzman Onbaşı
2. [OR-2] Onbaşı
1. [OR-1] Acemi Er
`;

      const embed = new EmbedBuilder()
        .setColor(RENK.ozel)
        .setTitle("👑 TSA Rütbe Tablosu")
        .setDescription(rutbeTablosu)
        .setFooter({ text: "TSA Discord Bot" });

      return interaction.reply({ embeds: [embed] });
    }

    if (cmd === "liderlik") {
      // Bu komut için aktivite takibi gereklidir. Şimdilik placeholder.
      const embed = new EmbedBuilder()
        .setColor(RENK.altin)
        .setTitle("👑 En Aktif Üyeler")
        .setDescription("Bu komut yakında Discord aktivite takibi ile güncellenecek.")
        .setFooter({ text: "TSA Discord Bot" });
      return interaction.reply({ embeds: [embed] });
    }

    if (cmd === "sunucu-bilgi") {
      await interaction.deferReply({ ephemeral: true });
      const guild = interaction.guild;
      const owner = await guild.fetchOwner();

      const embed = new EmbedBuilder()
        .setColor(RENK.ana)
        .setTitle(`${guild.name} Sunucu Bilgileri`)
        .setThumbnail(guild.iconURL({ dynamic: true }))
        .addFields(
          { name: "🆔 Sunucu ID", value: guild.id, inline: true },
          { name: "👑 Sunucu Sahibi", value: `<@${owner.id}>`, inline: true },
          { name: "👥 Üye Sayısı", value: guild.memberCount.toString(), inline: true },
          { name: "💬 Kanal Sayısı", value: guild.channels.cache.size.toString(), inline: true },
          { name: "✨ Boost Seviyesi", value: `Seviye ${guild.premiumTier} (${guild.premiumSubscriptionCount} Boost)`, inline: true },
          { name: "🗓️ Kuruluş Tarihi", value: `<t:${parseInt(guild.createdTimestamp / 1000)}:D>`, inline: true }
        )
        .setFooter({ text: "TSA Discord Bot" });

      return interaction.editReply({ embeds: [embed] });
    }

    if (cmd === "kullanici-bilgi") {
      await interaction.deferReply({ ephemeral: true });
      const user = interaction.options.getUser("kullanici");
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (!member) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Kullanıcı bulunamadı.")] });

      const roles = member.roles.cache
        .filter(role => role.id !== interaction.guild.id)
        .map(role => `<@&${role.id}>`)
        .join(", ") || "Rol bulunmuyor.";

      const embed = new EmbedBuilder()
        .setColor(RENK.basari)
        .setTitle(`${user.tag} Kullanıcı Bilgileri`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: "🆔 Kullanıcı ID", value: user.id, inline: true },
          { name: "🗓️ Katılma Tarihi", value: `<t:${parseInt(member.joinedTimestamp / 1000)}:D>`, inline: true },
          { name: "📅 Hesap Oluşturma Tarihi", value: `<t:${parseInt(user.createdTimestamp / 1000)}:D>`, inline: true },
          { name: "🏷️ Roller", value: roles, inline: false }
        )
        .setFooter({ text: "TSA Discord Bot" });

      return interaction.editReply({ embeds: [embed] });
    }

    if (cmd === "rutbe-bilgi") {
      await interaction.deferReply({ ephemeral: true });
      const role = interaction.options.getRole("rol");

      if (!role) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Rütbe bulunamadı.")] });

      const embed = new EmbedBuilder()
        .setColor(role.color || RENK.notr)
        .setTitle(`${role.name} Rütbe Bilgileri`)
        .addFields(
          { name: "🆔 Rol ID", value: role.id, inline: true },
          { name: "👥 Üye Sayısı", value: role.members.size.toString(), inline: true },
          { name: "🎨 Renk", value: role.hexColor, inline: true },
          { name: "Mention Edilebilir", value: role.mentionable ? "✅ Evet" : "❌ Hayır", inline: true },
          { name: "Ayrı Gösterilir", value: role.hoist ? "✅ Evet" : "❌ Hayır", inline: true },
          { name: "Oluşturulma Tarihi", value: `<t:${parseInt(role.createdTimestamp / 1000)}:D>`, inline: true }
        )
        .setFooter({ text: "TSA Discord Bot" });

      return interaction.editReply({ embeds: [embed] });
    }

    if (cmd === "aktiflik-denetleme") {
      await interaction.deferReply({ ephemeral: true });
      const role = interaction.options.getRole("rol");

      if (!role) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Rol bulunamadı.")] });

      const membersWithRole = role.members;

      if (membersWithRole.size === 0) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.ana).setDescription(`**${role.name}** rolüne sahip kimse bulunmuyor.`)] });
      }

      let activeMembers = [];
      let inactiveMembers = [];

      // Basit bir aktiflik denetimi: Sadece online/offline durumuna bakıyoruz.
      // Daha gelişmiş bir aktiflik denetimi için mesaj geçmişi veya özel bir sistem gereklidir.
      membersWithRole.forEach(member => {
        if (member.presence?.status === 'online' || member.presence?.status === 'dnd' || member.presence?.status === 'idle') {
          activeMembers.push(`<@${member.id}>`);
        } else {
          inactiveMembers.push(`<@${member.id}>`);
        }
      });

      let description = `**${role.name}** rolündeki üyelerin aktiflik durumu:\n\n`;
      if (activeMembers.length > 0) {
        description += `🟢 **Aktif Üyeler (${activeMembers.length}):**\n${activeMembers.join(", ")}\n\n`;
      }
      if (inactiveMembers.length > 0) {
        description += `🔴 **Pasif Üyeler (${inactiveMembers.length}):**\n${inactiveMembers.join(", ")}\n\n`;
      }
      if (activeMembers.length === 0 && inactiveMembers.length === 0) {
        description = `**${role.name}** rolüne sahip aktif veya pasif üye bulunamadı.`;
      }

      const embed = new EmbedBuilder()
        .setColor(RENK.uyari)
        .setTitle(`📊 ${role.name} Aktiflik Denetimi`)
        .setDescription(description)
        .setFooter({ text: "TSA Discord Bot" });

      return interaction.editReply({ embeds: [embed] });
    }

  } catch (e) {
    console.error(e);
    // Hata durumunda kullanıcıya ephemeral bir mesaj gönder
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Komut yürütülürken bir hata oluştu.")] });
    } else {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Komut yürütülürken bir hata oluştu.")], ephemeral: true });
    }
  }
});

client.login(config.TOKEN);
