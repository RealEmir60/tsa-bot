const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, REST, Routes, ActivityType, PermissionsBitField, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection, AudioPlayerStatus, NoSubscriberBehavior, StreamType } = require("@discordjs/voice");
const youtubedl = require("yt-dlp-exec");
const noblox = require("noblox.js");
const prism = require("prism-media");
const fs = require("fs");
const express = require("express");
require("dotenv").config();

// prism-media, ffmpeg'i sistemde aramak yerine ffmpeg-static'in verdiği yolu kullansın.
process.env.FFMPEG_PATH = require("ffmpeg-static");

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

// ==================== ROBLOX PROFİL SAYFALAMA ====================
// /profil roblox: komutunda çok sayıda grup olduğunda hepsini tek embed'e sığdıramayız,
// bu yüzden buton ile sayfalar arasında gezinebilen bir sistem kuruyoruz.
const robloxProfilCache = new Map(); // mesajId -> { veri, sayfa }
const ROBLOX_PROFIL_SAYFA_BOYUTU = 8;

function robloxProfilSayfasiOlustur(veri, sayfa) {
  const toplamSayfa = Math.max(1, Math.ceil(veri.groups.length / ROBLOX_PROFIL_SAYFA_BOYUTU));
  sayfa = Math.min(Math.max(sayfa, 0), toplamSayfa - 1);
  const baslangic = sayfa * ROBLOX_PROFIL_SAYFA_BOYUTU;
  const sayfaGruplari = veri.groups.slice(baslangic, baslangic + ROBLOX_PROFIL_SAYFA_BOYUTU);

  const groupText = sayfaGruplari.length > 0
    ? sayfaGruplari.map(g => `**${g.group.name}** — ${g.role.name}`).join("\n")
    : "Hiçbir gruba üye değil.";

  const embed = new EmbedBuilder()
    .setColor(RENK.ana)
    .setTitle(`🎮 ${veri.baslik} - Roblox Profili`)
    .setURL(veri.url)
    .setThumbnail(veri.avatarUrl)
    .addFields(
      { name: "🆔 Roblox ID", value: veri.detail.id.toString(), inline: true },
      { name: "🗓️ Hesap Oluşturma Tarihi", value: `<t:${parseInt(new Date(veri.detail.created).getTime() / 1000)}:D>`, inline: true },
      { name: "🚫 Banlı mı", value: veri.detail.isBanned ? "✅ Evet" : "❌ Hayır", inline: true },
      { name: "📝 Açıklama", value: veri.detail.description ? veri.detail.description.slice(0, 500) : "Açıklama yok.", inline: false },
      { name: `👥 Gruplar (${veri.groups.length}) — Sayfa ${sayfa + 1}/${toplamSayfa}`, value: groupText, inline: false }
    )
    .setFooter({ text: "TSA Discord Bot - Roblox Profili" })
    .setTimestamp();

  const butonlar = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("robloxprofil_prev").setLabel("◀ Önceki").setStyle(ButtonStyle.Secondary).setDisabled(sayfa === 0),
    new ButtonBuilder().setCustomId("robloxprofil_next").setLabel("Sonraki ▶").setStyle(ButtonStyle.Secondary).setDisabled(sayfa >= toplamSayfa - 1)
  );

  return { embed, butonlar, toplamSayfa, sayfa };
}

// ==================== OTO CEVAPLAR ====================
// Buraya istediğin kadar tetikleyici/cevap ekleyebilirsin.
// Tek kelimelik tetikleyiciler (örn. "sa") mesajın içinde ayrı bir KELİME olarak geçmeli;
// birden fazla kelimeli tetikleyiciler (örn. "iyi geceler") mesajın herhangi bir yerinde geçebilir.
const OTO_CEVAPLAR = [
  { tetikleyiciler: ["sa", "selamun aleykum", "selamünaleyküm", "selamun aleyküm", "selamünaleykum"], cevap: "Aleyküm Selam. 🎖️" },
  { tetikleyiciler: ["merhaba"], cevap: "Merhaba! 👋" },
  { tetikleyiciler: ["selam"], cevap: "Selam! 👋" },
  { tetikleyiciler: ["günaydın", "gunaydin"], cevap: "Günaydın! ☀️" },
  { tetikleyiciler: ["iyi geceler"], cevap: "Sana da iyi geceler! 🌙" },
  { tetikleyiciler: ["naber", "nasılsın", "nasilsin"], cevap: "İyidir, sorduğun için sağ ol! Sen nasılsın? 🙂" },
  { tetikleyiciler: ["teşekkürler", "tesekkurler", "sağol", "sagol", "sağ ol"], cevap: "Rica ederim! 🙌" }
];

// Mesaj içeriğine bakıp uygun bir oto cevap varsa döner, yoksa null döner.
function otoCevapBul(mesajIcerigi) {
  const metin = mesajIcerigi.toLocaleLowerCase("tr-TR").trim();
  if (!metin) return null;
  const kelimeler = metin.split(/[^a-zçöşüğı0-9]+/).filter(Boolean);

  for (const grup of OTO_CEVAPLAR) {
    for (const tetik of grup.tetikleyiciler) {
      if (tetik.includes(" ")) {
        if (metin.includes(tetik)) return grup.cevap;
      } else if (kelimeler.includes(tetik)) {
        return grup.cevap;
      }
    }
  }
  return null;
}

// ==================== SPAM KORUMASI ====================
const SPAM_MESAJ_LIMITI = 5;      // Bu süre içinde en fazla kaç mesaj atılabilir
const SPAM_SURE_MS = 6000;        // 6 saniye
const SPAM_TIMEOUT_MS = 60_000;   // Spam yapan kişi 60 saniye susturulur
const spamTakip = new Map();      // kullaniciId -> [zaman damgaları]

// true dönerse kullanıcı spam limitini aşmış demektir.
function spamKontrolEt(kullaniciId) {
  const simdi = Date.now();
  const kayitlar = (spamTakip.get(kullaniciId) || []).filter(t => simdi - t < SPAM_SURE_MS);
  kayitlar.push(simdi);
  spamTakip.set(kullaniciId, kayitlar);
  return kayitlar.length > SPAM_MESAJ_LIMITI;
}

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
  ROBLOX_COOKIE: process.env.ROBLOX_COOKIE, // Rütbe değiştirme (terfi/tenzil/rütbe-değiştir) için gerekli
  DATA_FILE: "./data.json"
};

// Roblox'a cookie ile giriş yapıyoruz (varsa). Bu olmadan terfi/tenzil/rütbe-değiştir komutları çalışmaz.
let robloxGirisYapildi = false;
let robloxBotUserId = null;
let robloxBotAdi = null;

async function robloxGirisYap(cookie) {
  const currentUser = await noblox.setCookie(cookie);
  robloxGirisYapildi = true;
  robloxBotUserId = currentUser.id;
  robloxBotAdi = currentUser.name;
  return currentUser;
}

// Botun grup içindeki kendi rütbesini (rank numarasını) döner.
// Kimse, botun rütbesinden yüksek veya eşit bir rütbeye atanamaz — bu, hem Roblox'un
// kendi kısıtlaması hem de yanlışlıkla botun/sahibin üstüne çıkarma riskini engeller.
async function robloxBotRankiGetir(groupId) {
  if (!robloxBotUserId) return null;
  try {
    return await noblox.getRankInGroup(groupId, robloxBotUserId);
  } catch (e) {
    console.error("Bot rütbesi alınırken hata:", e);
    return null;
  }
}

if (config.ROBLOX_COOKIE) {
  robloxGirisYap(config.ROBLOX_COOKIE)
    .then(currentUser => {
      console.log(`✅ Roblox'a "${currentUser.name}" hesabıyla giriş yapıldı. Rütbe komutları aktif.`);
    })
    .catch(e => {
      console.error("❌ ROBLOX_COOKIE ile giriş yapılamadı. Rütbe komutları çalışmayacak:", e.message);
    });
} else {
  console.log("ℹ️ ROBLOX_COOKIE ayarlanmamış. /terfi, /tenzil ve /rutbe-degistir komutları çalışmayacak.");
}

const EGITIM_ROL_ID = "1518397406578741348"; // Bu ID'ler sabit kalacak mı? Kullanıcıdan teyit almak gerekebilir.
const EGITIM_KANAL_ID = "1518357904779116554"; // Bu ID'ler sabit kalacak mı? Kullanıcıdan teyit almak gerekebilir.

// ==================== DATA ====================
let data = { uyari: {}, izin: {}, aktiflik: {} };

if (fs.existsSync(config.DATA_FILE)) {
  try {
    data = JSON.parse(fs.readFileSync(config.DATA_FILE, "utf8"));
  } catch (e) {
    console.error("Error reading data.json:", e);
  }
}
// Eski data.json dosyalarında "aktiflik" alanı olmayabilir, yoksa oluşturuyoruz.
if (!data.aktiflik) data.aktiflik = {};
if (!data.robloxBaglantilari) data.robloxBaglantilari = {};

const saveData = () => fs.writeFileSync(config.DATA_FILE, JSON.stringify(data, null, 2));

// ==================== MUSIC ====================
// play-dl yerine yt-dlp kullanıyoruz: yt-dlp çok daha aktif güncellenen ve
// YouTube'un bot korumasına play-dl'den çok daha az takılan bir araç.
// Cookie GEREKMİYOR — çoğu video için doğrudan çalışır.

// Bir promise'i verilen süre içinde bitmezse reddeden (reject eden) yardımcı fonksiyon.
function withTimeout(promise, ms, timeoutMessage) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutMessage)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// YouTube'da arama yapar, ilk sonucun başlığını ve linkini döner.
async function ytdlpArama(query) {
  const sonuc = await youtubedl(`ytsearch1:${query}`, {
    dumpSingleJson: true,
    noWarnings: true,
    noCheckCertificates: true,
    preferFreeFormats: true,
    skipDownload: true
  });

  const video = sonuc?.entries?.[0] || (sonuc?.id ? sonuc : null);
  if (!video) return null;

  return {
    title: video.title || "Bilinmeyen Şarkı",
    url: video.webpage_url || `https://www.youtube.com/watch?v=${video.id}`
  };
}

// Verilen YouTube linkinden Discord'un çalabileceği ham ses (PCM) akışı oluşturur.
function ytdlpAkisOlustur(url) {
  const ytProcess = youtubedl.exec(url, {
    output: "-",
    format: "bestaudio/best",
    noCheckCertificates: true,
    noWarnings: true,
    preferFreeFormats: true,
    quiet: true
  }, { stdio: ["ignore", "pipe", "ignore"] });

  const ffmpegDonusturucu = new prism.FFmpeg({
    args: [
      "-analyzeduration", "0",
      "-loglevel", "0",
      "-f", "s16le",
      "-ar", "48000",
      "-ac", "2"
    ]
  });

  const akis = ytProcess.stdout.pipe(ffmpegDonusturucu);

  const temizle = () => {
    if (ytProcess && !ytProcess.killed) ytProcess.kill();
  };
  akis.on("close", temizle);
  akis.on("error", temizle);

  return akis;
}

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

async function getRobloxGroupRoles(groupId) {
  const res = await fetch(`https://groups.roblox.com/v1/groups/${groupId}/roles`);
  if (!res.ok) throw new Error(`Roblox grup rütbeleri alınamadı: ${res.status}`);
  const json = await res.json();
  return json.roles || []; // [{ id, name, rank, memberCount }, ...] rank: 0-255
}

// ==================== CLIENT ====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageTyping,
    GatewayIntentBits.DirectMessageReactions
  ],
  partials: ['CHANNEL'], // DM'leri dinlemek için gerekli
});

// ==================== COMMANDS ====================
const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Botun gecikmesini ve çalışma süresini gösterir."),

  new SlashCommandBuilder()
    .setName("yardim")
    .setDescription("Botun tüm komutlarını listeler."),

  // ==================== YETKİLİ KOMUTLARI ====================
  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Belirtilen kişiyi sunucudan atar.")
    .addUserOption(o => o.setName("kullanici").setDescription("Atılacak kullanıcı").setRequired(true))
    .addStringOption(o => o.setName("sebep").setDescription("Atılma sebebi").setRequired(false)),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Belirtilen kişiyi sunucudan yasaklar.")
    .addUserOption(o => o.setName("kullanici").setDescription("Yasaklanacak kullanıcı").setRequired(true))
    .addStringOption(o => o.setName("sebep").setDescription("Yasaklanma sebebi").setRequired(false)),

  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Belirtilen kişinin yasağını kaldırır.")
    .addStringOption(o => o.setName("kullanici_id").setDescription("Yasağı kaldırılacak kullanıcının ID'si").setRequired(true)),

  new SlashCommandBuilder()
    .setName("temizle")
    .setDescription("Belirtilen sayıda mesajı siler.")
    .addIntegerOption(o => o.setName("sayi").setDescription("Silinecek mesaj sayısı (1-100)").setRequired(true)),

  new SlashCommandBuilder()
    .setName("yavas-mod")
    .setDescription("Kanalda yavaş modu ayarlar veya kapatır.")
    .addIntegerOption(o => o.setName("saniye").setDescription("Yavaş mod süresi (saniye cinsinden, 0 kapatır)").setRequired(true)),

  new SlashCommandBuilder()
    .setName("kilitle")
    .setDescription("Belirtilen kanalı kilitler.")
    .addChannelOption(o => o.setName("kanal").setDescription("Kilitlenecek kanal").setRequired(false)),

  new SlashCommandBuilder()
    .setName("kilit-ac")
    .setDescription("Belirtilen kanalın kilidini açar.")
    .addChannelOption(o => o.setName("kanal").setDescription("Kilidi açılacak kanal").setRequired(false)),

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

  new SlashCommandBuilder()
    .setName("uyari-ver")
    .setDescription("Bir kullanıcıya uyarı verir.")
    .addUserOption(o => o.setName("kullanici").setDescription("Uyarılacak kullanıcı").setRequired(true))
    .addStringOption(o => o.setName("sebep").setDescription("Uyarı sebebi").setRequired(true)),

  new SlashCommandBuilder()
    .setName("uyari-sil")
    .setDescription("Bir kullanıcının belirli bir uyarısını siler.")
    .addUserOption(o => o.setName("kullanici").setDescription("Uyarısı silinecek kullanıcı").setRequired(true))
    .addIntegerOption(o => o.setName("uyari_id").setDescription("Silinecek uyarının ID'si").setRequired(true)),

  new SlashCommandBuilder()
    .setName("uyari-liste")
    .setDescription("Bir kullanıcının uyarı geçmişini gösterir.")
    .addUserOption(o => o.setName("kullanici").setDescription("Uyarıları listelenecek kullanıcı").setRequired(true)),

  new SlashCommandBuilder()
    .setName("sicil-temizle")
    .setDescription("Bir kullanıcının tüm uyarı geçmişini siler.")
    .addUserOption(o => o.setName("kullanici").setDescription("Sicili temizlenecek kullanıcı").setRequired(true)),

  new SlashCommandBuilder()
    .setName("haber-yap")
    .setDescription("Sunucuda bir haber duyurusu yapar.")
    .addStringOption(o => o.setName("baslik").setDescription("Haber başlığı").setRequired(true))
    .addStringOption(o => o.setName("icerik").setDescription("Haber içeriği").setRequired(true))
    .addStringOption(o => o.setName("resim").setDescription("Haber resmi URL'si").setRequired(false)),

  new SlashCommandBuilder()
    .setName("egitim-duyuru")
    .setDescription("Eğitim duyurusu yapar.")
    .addUserOption(o => o.setName("host").setDescription("Eğitim hostu").setRequired(true))
    .addUserOption(o => o.setName("cohost").setDescription("Eğitim co-hostu").setRequired(true))
    .addStringOption(o => o.setName("tur").setDescription("Eğitim türü").setRequired(true))
    .addStringOption(o => o.setName("zaman").setDescription("Eğitim zamanı").setRequired(true)),

  new SlashCommandBuilder()
    .setName("aktiflik-denetleme")
    .setDescription("Belirtilen roldeki üyelerin aktiflik durumunu denetler (basit).")
    .addRoleOption(o => o.setName("rol").setDescription("Denetlenecek rol").setRequired(true)),

  new SlashCommandBuilder()
    .setName("rutbe-degistir")
    .setDescription("Bir kullanıcının Roblox grubundaki rütbesini belirli bir rütbeye ayarlar.")
    .addStringOption(o => o.setName("roblox_isim").setDescription("Roblox kullanıcı adı").setRequired(true))
    .addStringOption(o => o.setName("rutbe").setDescription("Yeni rütbe (yazmaya başlayınca öneriler çıkar)").setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName("sebep").setDescription("Değişikliğin sebebi").setRequired(true)),

  new SlashCommandBuilder()
    .setName("terfi")
    .setDescription("Bir kullanıcıyı Roblox grubunda bir üst rütbeye terfi ettirir.")
    .addStringOption(o => o.setName("roblox_isim").setDescription("Roblox kullanıcı adı").setRequired(true))
    .addStringOption(o => o.setName("sebep").setDescription("Terfi sebebi").setRequired(true)),

  new SlashCommandBuilder()
    .setName("tenzil")
    .setDescription("Bir kullanıcıyı Roblox grubunda bir alt rütbeye tenzil eder (indirir).")
    .addStringOption(o => o.setName("roblox_isim").setDescription("Roblox kullanıcı adı").setRequired(true))
    .addStringOption(o => o.setName("sebep").setDescription("Tenzil sebebi").setRequired(true)),

  new SlashCommandBuilder()
    .setName("yenile")
    .setDescription("Discord hesabınızı Roblox hesabınıza bağlar veya günceller.")
    .addStringOption(o => o.setName("roblox_isim").setDescription("Bağlanacak Roblox kullanıcı adınız").setRequired(true)),

  new SlashCommandBuilder()
    .setName("dm-duyuru")
    .setDescription("Belirtilen roldeki kullanıcılara özel mesaj duyurusu gönderir.")
    .addRoleOption(o => o.setName("hedef_rol").setDescription("Duyurunun gönderileceği rol").setRequired(true))
    .addStringOption(o => o.setName("mesaj_icerigi").setDescription("Gönderilecek duyuru mesajı").setRequired(true)),

  new SlashCommandBuilder()
    .setName("cookie-yenile")
    .setDescription("Botun Roblox ana rütbe yetkisini (cookie) yeniler."),

  new SlashCommandBuilder()
    .setName("cookie-durum")
    .setDescription("Botun Roblox ana rütbe yetkisinin (cookie) durumunu gösterir."),

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
  new SlashCommandBuilder().setName("rutbeler").setDescription("Roblox grubundaki güncel rütbeleri canlı olarak gösterir."),
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

// ==================== MESAJ SİSTEMİ (aktiflik + spam koruması + oto cevaplar) ====================
client.on("messageCreate", async message => {
  // Botları ve DM'leri yok sayıyoruz, sadece sunucudaki gerçek kullanıcı mesajlarıyla ilgileniyoruz.
  if (message.author.bot || !message.guild) return;

  // ---- 1) Aktiflik takibi (/liderlik için) ----
  data.aktiflik[message.author.id] = (data.aktiflik[message.author.id] || 0) + 1;
  saveData();

  // ---- 2) Spam koruması ----
  const uyeYetkiliMi = message.member?.roles.cache.has(config.YETKILI_ROL) || message.member?.permissions.has(PermissionsBitField.Flags.Administrator);

  if (!uyeYetkiliMi && spamKontrolEt(message.author.id)) {
    spamTakip.delete(message.author.id); // Sayaç sıfırlansın, art arda tekrar tekrar cezalandırmasın.
    try {
      if (message.member?.moderatable) {
        await message.member.timeout(SPAM_TIMEOUT_MS, "Spam mesaj gönderme");
        const uyariMesaji = await message.channel.send({
          embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(`🚫 <@${message.author.id}> spam yaptığı için **60 saniye** susturuldu.`)]
        });
        setTimeout(() => uyariMesaji.delete().catch(() => {}), 8000);
        await sendLogMessage(message.guild, "Spam Tespit Edildi", `<@${message.author.id}> kısa sürede çok fazla mesaj attığı için otomatik olarak susturuldu.`, RENK.uyari);
      }
    } catch (e) {
      console.error("Spam cezası uygulanırken hata:", e);
    }
    return; // Spam yapan kişiye ayrıca oto cevap vermiyoruz.
  }

  // ---- 3) Oto cevaplar ----
  const cevap = otoCevapBul(message.content);
  if (cevap) {
    await message.reply(cevap).catch(() => {});
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
  // ---- Autocomplete (rütbe önerileri) ----
  if (interaction.isAutocomplete()) {
    if (interaction.commandName === "rutbe-degistir") {
      try {
        const groupId = config.GROUP_ID;
        if (!groupId) return interaction.respond([]);

        const yazilan = interaction.options.getFocused().toLocaleLowerCase("tr-TR").trim();
        const roller = await getRobloxGroupRoles(groupId);
        const siraliRoller = roller.slice().sort((a, b) => b.rank - a.rank);

        const eslesenler = (yazilan
          ? siraliRoller.filter(r => r.name.toLocaleLowerCase("tr-TR").includes(yazilan))
          : siraliRoller
        ).slice(0, 25); // Discord autocomplete en fazla 25 öneri kabul eder.

        return interaction.respond(
          eslesenler.map(r => ({ name: `${r.name} (Rank ${r.rank})`, value: r.name }))
        );
      } catch (e) {
        console.error("Rütbe autocomplete hatası:", e);
        return interaction.respond([]);
      }
    }
    return;
  }

  // ---- Modal Gönderimi (Roblox ana cookie yenileme) ----
  if (interaction.isModalSubmit()) {
    if (interaction.customId === "cookie_yenile_modal") {
      const yetkiliMi = interaction.member.roles.cache.has(config.YETKILI_ROL) || interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
      if (!yetkiliMi) {
        return interaction.reply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Bu işlemi yapmak için yeterli yetkiniz yok!")], ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });
      const yeniCookie = interaction.fields.getTextInputValue("yeni_cookie").trim();

      try {
        const kullanici = await robloxGirisYap(yeniCookie);
        console.log(`✅ Botun ana Roblox cookie'si güncellendi. Yeni hesap: ${kullanici.name}`);
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription(
            `✅ Botun ana rütbe yetkisi başarıyla yenilendi: **${kullanici.name}** olarak giriş yapıldı.\n\n` +
            `⚠️ Bu değişiklik bot yeniden başlayana kadar geçerlidir. Kalıcı olması için panelden de güncellemeyi unutmayın.`
          )]
        });
      } catch (e) {
        console.error("Cookie yenileme hatası:", e);
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Cookie geçersiz veya süresi dolmuş. Lütfen doğru cookie'yi yapıştırdığınızdan emin olun.")] });
      }
    }
    return;
  }

  // ---- Butonlar (Roblox profil sayfalama) ----
  if (interaction.isButton()) {
    if (interaction.customId === "robloxprofil_prev" || interaction.customId === "robloxprofil_next") {
      const cache = robloxProfilCache.get(interaction.message.id);
      if (!cache) {
        return interaction.reply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("⏱️ Bu profil görüntüleyicisinin süresi doldu, komutu tekrar çalıştır.")] });
      }
      const yeniSayfa = cache.sayfa + (interaction.customId === "robloxprofil_next" ? 1 : -1);
      const { embed, butonlar, sayfa } = robloxProfilSayfasiOlustur(cache.veri, yeniSayfa);
      cache.sayfa = sayfa;
      robloxProfilCache.set(interaction.message.id, cache);
      return interaction.update({ embeds: [embed], components: [butonlar] });
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const cmd = interaction.commandName;
  const isYetkili = interaction.member.roles.cache.has(config.YETKILI_ROL) || interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
  const isEgitimHost = interaction.member.roles.cache.has(EGITIM_ROL_ID);

  // Yetkili komutları kontrolü
  const yetkiliKomutlar = ["kick", "ban", "unban", "temizle", "yavas-mod", "kilitle", "kilit-ac", "rol-ver", "rol-al", "uyari-ver", "uyari-sil", "uyari-liste", "sicil-temizle", "dm-mesaj", "haber-yap", "egitim-duyuru", "duyuru", "aktiflik-denetleme", "rutbe-degistir", "terfi", "tenzil", "yenile", "dm-duyuru", "cookie-yenile", "cookie-durum"];
  if (yetkiliKomutlar.includes(cmd) && !isYetkili) {
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Bu komutu kullanmak için yeterli yetkiniz yok!")] });
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
          { name: "⏳ Çalışma Süresi", value: `${saat}s ${dakika}d`, inline: true }
        )
        .setFooter({ text: "TSA Discord Bot" })
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }

    if (cmd === "yardim") {
      // Yetkiye göre filtreleme: yetkisiz kullanıcılar admin komutlarını görmez.
      const yetkiliKomutlarListe = ["kick", "ban", "unban", "temizle", "yavas-mod", "kilitle", "kilit-ac", "rol-ver", "rol-al", "uyari-ver", "uyari-sil", "uyari-liste", "sicil-temizle", "dm-mesaj", "haber-yap", "egitim-duyuru", "duyuru", "aktiflik-denetleme", "rutbe-degistir", "terfi", "tenzil", "yenile"];

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
        .setColor(RENK.ana)
        .setTitle("📚 Komut Listesi")
        .setDescription("İşte kullanabileceğin komutlar:")
        .setFooter({ text: "TSA Discord Bot" })
        .setTimestamp();

      if (herkesLines.length > 0) {
        chunkList(herkesLines).forEach((chunk, i) => {
          embed.addFields({ name: i === 0 ? "🌐 Herkesin Kullanabileceği Komutlar" : "🌐 Komutlar (devam)", value: chunk });
        });
      }

      if (isYetkili && yetkiliLines.length > 0) {
        chunkList(yetkiliLines).forEach((chunk, i) => {
          embed.addFields({ name: i === 0 ? "🔒 Yetkili Komutları" : "🔒 Yetkili Komutları (devam)", value: chunk });
        });
      }

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ==================== YETKİLİ KOMUTLARI ====================
    if (cmd === "kick") {
      await interaction.deferReply();
      const user = interaction.options.getUser("kullanici");
      const sebep = interaction.options.getString("sebep") || "Belirtilmedi";
      const member = interaction.guild.members.cache.get(user.id);

      if (!member) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Kullanıcı bulunamadı.")] });
      if (!member.kickable) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Bu kullanıcıyı atamıyorum.")] });

      await member.kick(sebep);
      await sendLogMessage(interaction.guild, "Kullanıcı Atıldı", `${user.tag} sunucudan atıldı.`, RENK.hata, [
        { name: "Kullanıcı", value: `<@${user.id}>`, inline: true },
        { name: "Sebep", value: sebep, inline: true },
        { name: "Yetkili", value: `<@${interaction.user.id}>`, inline: true }
      ]);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription(`✅ **${user.tag}** başarıyla sunucudan atıldı.`)] });
    }

    if (cmd === "ban") {
      await interaction.deferReply();
      const user = interaction.options.getUser("kullanici");
      const sebep = interaction.options.getString("sebep") || "Belirtilmedi";
      const member = interaction.guild.members.cache.get(user.id);

      if (!member) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Kullanıcı bulunamadı.")] });
      if (!member.bannable) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Bu kullanıcıyı yasaklayamıyorum.")] });

      await member.ban({ reason: sebep });
      await sendLogMessage(interaction.guild, "Kullanıcı Yasaklandı", `${user.tag} sunucudan yasaklandı.`, RENK.hata, [
        { name: "Kullanıcı", value: `<@${user.id}>`, inline: true },
        { name: "Sebep", value: sebep, inline: true },
        { name: "Yetkili", value: `<@${interaction.user.id}>`, inline: true }
      ]);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription(`✅ **${user.tag}** başarıyla sunucudan yasaklandı.`)] });
    }

    if (cmd === "unban") {
      await interaction.deferReply();
      const userId = interaction.options.getString("kullanici_id");

      try {
        await interaction.guild.bans.remove(userId);
        const user = await client.users.fetch(userId);
        await sendLogMessage(interaction.guild, "Yasak Kaldırıldı", `${user.tag} kullanıcısının yasağı kaldırıldı.`, RENK.basari, [
          { name: "Kullanıcı", value: `<@${user.id}>`, inline: true },
          { name: "Yetkili", value: `<@${interaction.user.id}>`, inline: true }
        ]);
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription(`✅ **${user.tag}** kullanıcısının yasağı başarıyla kaldırıldı.`)] });
      } catch (e) {
        console.error("Unban hatası:", e);
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Yasak kaldırılamadı. Kullanıcı yasaklı olmayabilir veya ID yanlış.")] });
      }
    }

    if (cmd === "temizle") {
      await interaction.deferReply({ ephemeral: true });
      const sayi = interaction.options.getInteger("sayi");

      if (sayi < 1 || sayi > 100) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Lütfen 1 ile 100 arasında bir sayı girin.")] });
      }

      const fetched = await interaction.channel.messages.fetch({ limit: sayi });
      await interaction.channel.bulkDelete(fetched, true);

      await sendLogMessage(interaction.guild, "Mesajlar Temizlendi", `${interaction.user.tag} tarafından ${sayi} adet mesaj temizlendi.`, RENK.uyari, [
        { name: "Kanal", value: `<#${interaction.channel.id}>`, inline: true },
        { name: "Silinen Mesaj Sayısı", value: sayi.toString(), inline: true },
        { name: "Yetkili", value: `<@${interaction.user.id}>`, inline: true }
      ]);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription(`✅ Başarıyla **${sayi}** adet mesaj silindi.`)] });
    }

    if (cmd === "yavas-mod") {
      await interaction.deferReply();
      const saniye = interaction.options.getInteger("saniye");

      if (saniye < 0 || saniye > 21600) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Yavaş mod süresi 0 ile 21600 saniye arasında olmalıdır.")] });
      }

      await interaction.channel.setRateLimitPerUser(saniye, `Yavaş mod ${saniye} saniyeye ayarlandı.`);
      await sendLogMessage(interaction.guild, "Yavaş Mod Ayarlandı", `${interaction.user.tag} tarafından yavaş mod ${saniye} saniyeye ayarlandı.`, RENK.uyari, [
        { name: "Kanal", value: `<#${interaction.channel.id}>`, inline: true },
        { name: "Süre", value: `${saniye} saniye`, inline: true },
        { name: "Yetkili", value: `<@${interaction.user.id}>`, inline: true }
      ]);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription(`✅ Yavaş mod başarıyla **${saniye}** saniyeye ayarlandı.`)] });
    }

    if (cmd === "kilitle") {
      await interaction.deferReply();
      const channel = interaction.options.getChannel("kanal") || interaction.channel;

      await channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: false });
      await sendLogMessage(interaction.guild, "Kanal Kilitlendi", `${interaction.user.tag} tarafından ${channel.name} kanalı kilitlendi.`, RENK.hata, [
        { name: "Kanal", value: `<#${channel.id}>`, inline: true },
        { name: "Yetkili", value: `<@${interaction.user.id}>`, inline: true }
      ]);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription(`✅ **${channel.name}** kanalı başarıyla kilitlendi.`)] });
    }

    if (cmd === "kilit-ac") {
      await interaction.deferReply();
      const channel = interaction.options.getChannel("kanal") || interaction.channel;

      await channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: true });
      await sendLogMessage(interaction.guild, "Kanal Kilidi Açıldı", `${interaction.user.tag} tarafından ${channel.name} kanalının kilidi açıldı.`, RENK.basari, [
        { name: "Kanal", value: `<#${channel.id}>`, inline: true },
        { name: "Yetkili", value: `<@${interaction.user.id}>`, inline: true }
      ]);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription(`✅ **${channel.name}** kanalının kilidi başarıyla açıldı.`)] });
    }

    if (cmd === "rol-ver") {
      await interaction.deferReply();
      const user = interaction.options.getUser("kullanici");
      const role = interaction.options.getRole("rol");
      const member = interaction.guild.members.cache.get(user.id);

      if (!member) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Kullanıcı bulunamadı.")] });
      if (member.roles.cache.has(role.id)) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.uyari).setDescription(`**${user.tag}** kullanıcısında zaten **${role.name}** rolü bulunuyor.`)] });

      await member.roles.add(role);
      await sendLogMessage(interaction.guild, "Rol Verildi", `${user.tag} kullanıcısına ${role.name} rolü verildi.`, RENK.basari, [
        { name: "Kullanıcı", value: `<@${user.id}>`, inline: true },
        { name: "Rol", value: `<@&${role.id}>`, inline: true },
        { name: "Yetkili", value: `<@${interaction.user.id}>`, inline: true }
      ]);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription(`✅ **${user.tag}** kullanıcısına **${role.name}** rolü başarıyla verildi.`)] });
    }

    if (cmd === "rol-al") {
      await interaction.deferReply();
      const user = interaction.options.getUser("kullanici");
      const role = interaction.options.getRole("rol");
      const member = interaction.guild.members.cache.get(user.id);

      if (!member) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Kullanıcı bulunamadı.")] });
      if (!member.roles.cache.has(role.id)) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.uyari).setDescription(`**${user.tag}** kullanıcısında **${role.name}** rolü bulunmuyor.`)] });

      await member.roles.remove(role);
      await sendLogMessage(interaction.guild, "Rol Alındı", `${user.tag} kullanıcısından ${role.name} rolü alındı.`, RENK.hata, [
        { name: "Kullanıcı", value: `<@${user.id}>`, inline: true },
        { name: "Rol", value: `<@&${role.id}>`, inline: true },
        { name: "Yetkili", value: `<@${interaction.user.id}>`, inline: true }
      ]);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription(`✅ **${user.tag}** kullanıcısından **${role.name}** rolü başarıyla alındı.`)] });
    }

    if (cmd === "uyari-ver") {
      await interaction.deferReply();
      const user = interaction.options.getUser("kullanici");
      const sebep = interaction.options.getString("sebep");
      const member = interaction.guild.members.cache.get(user.id);

      if (!member) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Kullanıcı bulunamadı.")] });

      if (!data.uyari[user.id]) data.uyari[user.id] = [];
      data.uyari[user.id].push({ sebep, zaman: new Date().toISOString(), yetkili: interaction.user.id });
      saveData();

      const uyariSayisi = data.uyari[user.id].length;
      let verilecekRol = null;
      if (uyariSayisi === 1) verilecekRol = config.UYARI_1_ROL;
      else if (uyariSayisi === 2) verilecekRol = config.UYARI_2_ROL;
      else if (uyariSayisi >= 3) verilecekRol = config.UYARI_3_ROL;

      if (verilecekRol && !member.roles.cache.has(verilecekRol)) {
        await member.roles.add(verilecekRol).catch(console.error);
      }

      await sendLogMessage(interaction.guild, "Uyarı Verildi", `${user.tag} kullanıcısına uyarı verildi.`, RENK.uyari, [
        { name: "Kullanıcı", value: `<@${user.id}>`, inline: true },
        { name: "Sebep", value: sebep, inline: true },
        { name: "Uyarı Sayısı", value: uyariSayisi.toString(), inline: true },
        { name: "Yetkili", value: `<@${interaction.user.id}>`, inline: true }
      ]);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription(`✅ **${user.tag}** kullanıcısına başarıyla uyarı verildi. Toplam uyarı: **${uyariSayisi}**`)] });
    }

    if (cmd === "uyari-sil") {
      await interaction.deferReply();
      const user = interaction.options.getUser("kullanici");
      const uyariId = interaction.options.getInteger("uyari_id");
      const member = interaction.guild.members.cache.get(user.id);

      if (!member) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Kullanıcı bulunamadı.")] });

      if (!data.uyari[user.id] || data.uyari[user.id].length === 0) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.ana).setDescription(`**${user.tag}** kullanıcısının hiç uyarısı bulunmuyor.`)] });
      }

      if (uyariId < 1 || uyariId > data.uyari[user.id].length) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(`❌ Geçersiz uyarı ID'si. Lütfen 1 ile ${data.uyari[user.id].length} arasında bir sayı girin.`)] });
      }

      const silinenUyari = data.uyari[user.id].splice(uyariId - 1, 1)[0];
      saveData();

      // Uyarı rollerini güncelle
      const uyariSayisi = data.uyari[user.id].length;
      const uyariRolleri = [config.UYARI_1_ROL, config.UYARI_2_ROL, config.UYARI_3_ROL];

      for (const rolId of uyariRolleri) {
        if (rolId && member.roles.cache.has(rolId)) {
          await member.roles.remove(rolId).catch(console.error);
        }
      }

      if (uyariSayisi === 1 && config.UYARI_1_ROL) await member.roles.add(config.UYARI_1_ROL).catch(console.error);
      else if (uyariSayisi === 2 && config.UYARI_2_ROL) await member.roles.add(config.UYARI_2_ROL).catch(console.error);

      await sendLogMessage(interaction.guild, "Uyarı Silindi", `${user.tag} kullanıcısının uyarısı silindi.`, RENK.basari, [
        { name: "Kullanıcı", value: `<@${user.id}>`, inline: true },
        { name: "Silinen Sebep", value: silinenUyari.sebep, inline: true },
        { name: "Kalan Uyarı", value: uyariSayisi.toString(), inline: true },
        { name: "Yetkili", value: `<@${interaction.user.id}>`, inline: true }
      ]);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription(`✅ **${user.tag}** kullanıcısının **${uyariId}.** uyarısı başarıyla silindi. Kalan uyarı: **${uyariSayisi}**`)] });
    }

    if (cmd === "uyari-liste") {
      await interaction.deferReply();
      const user = interaction.options.getUser("kullanici");

      if (!data.uyari[user.id] || data.uyari[user.id].length === 0) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.ana).setDescription(`**${user.tag}** kullanıcısının hiç uyarısı bulunmuyor.`)] });
      }

      let description = `**${user.tag}** kullanıcısının uyarı geçmişi:\n\n`;
      data.uyari[user.id].forEach((uyari, index) => {
        description += `**${index + 1}.** Sebep: **${uyari.sebep}** | Zaman: <t:${parseInt(new Date(uyari.zaman).getTime() / 1000)}:D> | Yetkili: <@${uyari.yetkili}>\n`;
      });

      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.ozel).setTitle("📋 Uyarı Geçmişi").setDescription(description)] });
    }

    if (cmd === "sicil-temizle") {
      await interaction.deferReply();
      const user = interaction.options.getUser("kullanici");
      const member = interaction.guild.members.cache.get(user.id);

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
      await interaction.deferReply();
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
      await interaction.deferReply();
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
      await interaction.deferReply();
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
      await interaction.deferReply();
      const channel = interaction.member.voice.channel;
      if (!channel) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Ses kanalına katılmak için önce bir ses kanalında olmalısınız.")] });

      joinVoiceChannel({ channelId: channel.id, guildId: interaction.guild.id, adapterCreator: interaction.guild.voiceAdapterCreator });
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription(`✅ Başarıyla **${channel.name}** ses kanalına katıldım.`)] });
    }

    if (cmd === "ses-cik") {
      await interaction.deferReply();
      const connection = getVoiceConnection(interaction.guild.id);
      if (connection) {
        connection.destroy();
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.uyari).setDescription("✅ Ses kanalından başarıyla ayrıldım.")] });
      } else {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Zaten bir ses kanalında değilim.")] });
      }
    }

    if (cmd === "yoklama") {
      await interaction.deferReply();
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
      await interaction.deferReply();
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
      await interaction.deferReply();
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

    if (cmd === "grup-bilgi") {
      await interaction.deferReply();
      const groupId = config.GROUP_ID;
      if (!groupId) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ `.env` dosyasında `GROUP_ID` ayarlanmamış.")] });
      }
      try {
        const [grup, icon] = await Promise.all([
          getRobloxGroupInfo(groupId),
          getRobloxGroupIcon(groupId)
        ]);

        const embed = new EmbedBuilder()
          .setColor(RENK.ana)
          .setTitle(`👥 ${grup.name}`)
          .setURL(`https://www.roblox.com/communities/${groupId}`)
          .setThumbnail(icon)
          .addFields(
            { name: "🆔 Grup ID", value: groupId.toString(), inline: true },
            { name: "👤 Sahibi", value: grup.owner?.username ? `@${grup.owner.username}` : "Bilinmiyor", inline: true },
            { name: "👥 Üye Sayısı", value: grup.memberCount?.toLocaleString("tr-TR") || "Bilinmiyor", inline: true }
          )
          .setDescription(grup.description ? grup.description.slice(0, 500) : "Açıklama yok.")
          .setFooter({ text: "TSA - Turkish Special Army" })
          .setTimestamp();

        if (grup.shout?.body) {
          embed.addFields({ name: "📢 Son Duyuru (Shout)", value: grup.shout.body.slice(0, 300) });
        }

        return interaction.editReply({ embeds: [embed] });
      } catch (e) {
        console.error("Grup bilgisi hatası:", e);
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Grup bilgisi alınırken bir hata oluştu.")] });
      }
    }

    if (cmd === "aktiflik-sorgu") {
      await interaction.deferReply();
      const placeId = config.OYUN_PLACE_ID;
      if (!placeId) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ `.env` dosyasında `OYUN_PLACE_ID` ayarlanmamış.")] });
      }
      try {
        const universeId = await getRobloxUniverseIdFromPlace(placeId);
        const [oyun, icon] = await Promise.all([
          getRobloxGameInfo(universeId),
          getRobloxGameIcon(universeId)
        ]);

        if (!oyun) {
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Oyun bilgisi bulunamadı.")] });
        }

        const embed = new EmbedBuilder()
          .setColor(RENK.basari)
          .setTitle(`🎮 ${oyun.name}`)
          .setURL(`https://www.roblox.com/games/${placeId}`)
          .setThumbnail(icon)
          .addFields(
            { name: "🟢 Anlık Oyuncu", value: oyun.playing?.toLocaleString("tr-TR") || "0", inline: true },
            { name: "👁️ Toplam Ziyaret", value: oyun.visits?.toLocaleString("tr-TR") || "0", inline: true },
            { name: "⭐ Favori Sayısı", value: oyun.favoritedCount?.toLocaleString("tr-TR") || "0", inline: true }
          )
          .setFooter({ text: "TSA - Turkish Special Army" })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (e) {
        console.error("Oyun bilgisi hatası:", e);
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Oyun bilgisi alınırken bir hata oluştu.")] });
      }
    }

    // ==================== ROBLOX RÜTBE SİSTEMİ ====================
    if (cmd === "rutbe-sorgu") {
      await interaction.deferReply();
      const groupId = config.GROUP_ID;
      if (!groupId) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ `.env` dosyasında `GROUP_ID` ayarlanmamış.")] });
      }
      const robloxIsim = interaction.options.getString("roblox_isim");
      try {
        const robloxUser = await getRobloxUserByUsername(robloxIsim);
        if (!robloxUser) {
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(`❌ **${robloxIsim}** adında bir Roblox kullanıcısı bulunamadı.`)] });
        }

        const [userDetail, avatarUrl, groups] = await Promise.all([
          getRobloxUserDetail(robloxUser.id),
          getRobloxAvatarUrl(robloxUser.id),
          getRobloxGroups(robloxUser.id)
        ]);

        const embed = robloxProfilSayfasiOlustur({ baslik: robloxUser.displayName, url: `https://www.roblox.com/users/${robloxUser.id}/profile`, avatarUrl, detail: userDetail, groups }, 0).embed;

        return interaction.editReply({ embeds: [embed] });
      } catch (e) {
        console.error("Roblox profil sorgulama hatası:", e);
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Roblox profil bilgisi alınırken bir hata oluştu.")] });
      }
    }

    if (cmd === "rutbe-degistir" || cmd === "terfi" || cmd === "tenzil") {
      await interaction.deferReply();

      if (!config.ROBLOX_COOKIE) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ `.env` dosyasında `ROBLOX_COOKIE` ayarlanmamış, bu komut kullanılamaz.")] });
      }
      if (!robloxGirisYapildi) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Bot şu anda Roblox'a giriş yapamamış durumda (cookie geçersiz veya süresi dolmuş olabilir). Konsol loglarını kontrol et.")] });
      }
      const groupId = config.GROUP_ID;
      if (!groupId) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ `.env` dosyasında `GROUP_ID` ayarlanmamış.")] });
      }

      const robloxIsim = interaction.options.getString("roblox_isim");
      const sebep = interaction.options.getString("sebep");

      try {
        const userId = await noblox.getIdFromUsername(robloxIsim);
        if (!userId) {
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(`❌ **${robloxIsim}** adında bir Roblox kullanıcısı bulunamadı.`)] });
        }

        const eskiRutbeAdi = await noblox.getRankNameInGroup(groupId, userId);
        const eskiRankNum = await noblox.getRankInGroup(groupId, userId);
        const avatarUrl = await getRobloxAvatarUrl(userId);

        // Grubun tüm rütbelerini rank numarasına göre küçükten büyüğe sıralıyoruz,
        // terfi/tenzil için "bir üst/bir alt" rütbeyi bulmak amacıyla.
        const roller = (await getRobloxGroupRoles(groupId)).slice().sort((a, b) => a.rank - b.rank);

        let hedefRol, baslik, renk;

        if (cmd === "terfi" || cmd === "tenzil") {
          const suankiIndex = roller.findIndex(r => r.rank === eskiRankNum);
          const hedefIndex = suankiIndex + (cmd === "terfi" ? 1 : -1);

          if (suankiIndex === -1 || hedefIndex < 0 || hedefIndex >= roller.length) {
            const sinirMesaji = cmd === "terfi" ? "zaten en üst rütbede, daha fazla terfi ettirilemez." : "zaten en alt rütbede, daha fazla tenzil edilemez.";
            return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(`❌ **${robloxIsim}** ${sinirMesaji}`)] });
          }
          hedefRol = roller[hedefIndex];
          baslik = cmd === "terfi" ? "⬆️ Terfi Verildi" : "⬇️ Tenzil Yapıldı";
          renk = cmd === "terfi" ? RENK.basari : RENK.hata;
        } else {
          // rutbe-degistir: autocomplete'ten seçilen isimle eşleşen rütbeyi bul.
          const rutbeAdi = interaction.options.getString("rutbe");
          hedefRol = roller.find(r => r.name.toLocaleLowerCase("tr-TR") === rutbeAdi.toLocaleLowerCase("tr-TR"));
          if (!hedefRol) {
            return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(`❌ **${rutbeAdi}** adında bir rütbe bulunamadı. Lütfen listeden bir seçenek seç.`)] });
          }
          baslik = "🔄 Rütbe Değiştirildi";
          renk = RENK.ozel;
        }

        // ---- GÜVENLİK KONTROLÜ 1: Botun kendi rütbesinden yüksek veya eşit rütbe atanamaz. ----
        const botRank = await robloxBotRankiGetir(groupId);
        if (botRank !== null && hedefRol.rank >= botRank) {
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(
            `❌ **${hedefRol.name}** rütbesi, botun kendi rütbesinden (**${botRank}**) yüksek veya eşit olduğu için atanamaz.\n` +
            `Bu, botun/sahibin üstüne çıkarılmasını önlemek için bilerek engellendi.`
          )] });
        }

        // ---- GÜVENLİK KONTROLÜ 2: Kullanıcı kendi rütbesinden yüksek bir rütbe atayamaz. ----
        const interactionUserRobloxId = data.robloxBaglantilari[interaction.user.id];
        if (!interactionUserRobloxId) {
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Roblox hesabınız Discord hesabınıza bağlı değil. Lütfen `/yenile` komutunu kullanarak bağlayın.")] });
        }
        const interactionUserCurrentRank = await noblox.getRankInGroup(groupId, interactionUserRobloxId);
        if (hedefRol.rank > interactionUserCurrentRank) {
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(
            `❌ Kendi rütbenizden (${await noblox.getRankNameInGroup(groupId, interactionUserRobloxId)}) daha yüksek bir rütbe (${hedefRol.name}) atayamazsınız.`
          )] });
        }

        await noblox.setRank(groupId, userId, hedefRol.rank);
        const yeniRutbeAdi = hedefRol.name;

        const embed = new EmbedBuilder()
          .setColor(renk)
          .setTitle(baslik)
          .setThumbnail(avatarUrl)
          .addFields(
            { name: "👤 Roblox Kullanıcı", value: robloxIsim, inline: true },
            { name: "📤 Eski Rütbe", value: eskiRutbeAdi || "Bilinmiyor", inline: true },
            { name: "📥 Yeni Rütbe", value: yeniRutbeAdi || "Bilinmiyor", inline: true },
            { name: "📝 Sebep", value: sebep, inline: false },
            { name: "👮 İşlemi Yapan", value: `<@${interaction.user.id}>`, inline: false }
          )
          .setFooter({ text: "TSA - Turkish Special Army" })
          .setTimestamp();

        await sendLogMessage(interaction.guild, baslik, `${robloxIsim} kullanıcısının rütbesi değiştirildi: ${eskiRutbeAdi} → ${yeniRutbeAdi}`, renk, [
          { name: "Roblox Kullanıcı", value: robloxIsim, inline: true },
          { name: "Sebep", value: sebep, inline: true },
          { name: "İşlemi Yapan", value: `<@${interaction.user.id}>`, inline: true }
        ]);

        // Herkesin görebilmesi için normal (herkese açık) mesaj olarak gönderiliyor.
        return interaction.editReply({ embeds: [embed] });
      } catch (e) {
        console.error("Rütbe değiştirme hatası:", e);
        const mesaj = e.message?.includes("permission") || e.message?.includes("Forbidden")
          ? "❌ Botun bu işlemi yapacak yetkisi yok. Roblox grubunda botun hesabının, hedef kullanıcıdan daha yüksek bir rütbede olduğundan emin ol."
          : "❌ Rütbe değiştirilirken bir hata oluştu. Kullanıcı adını ve rütbeyi kontrol edip tekrar dene.";
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(mesaj)] });
      }
    }

    if (cmd === "dm-mesaj") {
      await interaction.deferReply();
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

    if (cmd === "dm-duyuru") {
      await interaction.deferReply({ ephemeral: true });
      const hedefRol = interaction.options.getRole("hedef_rol");
      const mesajIcerigi = interaction.options.getString("mesaj_icerigi");

      const YETKILI_DM_DUYURU_ROL_ID = "1518357617280417993"; // Kullanıcının belirttiği rol ID

      if (!interaction.member.roles.cache.has(YETKILI_DM_DUYURU_ROL_ID) && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Bu komutu kullanmak için yeterli yetkiniz yok! Sadece belirli bir role sahip olanlar bu komutu kullanabilir.")] });
      }

      const membersWithRole = hedefRol.members;
      let sentCount = 0;
      let failedCount = 0;

      for (const [memberId, member] of membersWithRole) {
        try {
          const dmEmbed = new EmbedBuilder()
            .setColor(RENK.ozel)
            .setTitle("📢 Özel Duyuru")
            .setDescription(mesajIcerigi)
            .setTimestamp()
            .setFooter({ text: `Duyuru Yapan: ${interaction.user.tag}` });

          await member.send({ embeds: [dmEmbed] });
          sentCount++;
        } catch (e) {
          console.error(`DM duyurusu gönderilemedi ${member.user.tag}:`, e.message);
          failedCount++;
        }
      }

      await sendLogMessage(interaction.guild, "DM Duyurusu Yapıldı", `${interaction.user.tag} tarafından ${hedefRol.name} rolündeki kullanıcılara DM duyurusu yapıldı.`, RENK.ozel, [
        { name: "Hedef Rol", value: hedefRol.name, inline: true },
        { name: "Gönderilen", value: sentCount.toString(), inline: true },
        { name: "Başarısız", value: failedCount.toString(), inline: true },
        { name: "Mesaj", value: mesajIcerigi.slice(0, 500), inline: false }
      ]);

      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription(`✅ **${hedefRol.name}** rolündeki **${sentCount}** kullanıcıya DM duyurusu başarıyla gönderildi. **${failedCount}** kullanıcıya gönderilemedi (DM'leri kapalı olabilir).`)] });
    }

    if (cmd === "cookie-yenile") {
      const modal = new ModalBuilder()
        .setCustomId("cookie_yenile_modal")
        .setTitle("Bot Ana Rütbe Yetkisi Yenile");

      const cookieAlani = new TextInputBuilder()
        .setCustomId("yeni_cookie")
        .setLabel("Yeni ROBLOX_COOKIE değeri")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("_|WARNING:-DO-NOT-SHARE-THIS... ile başlayan cookie'yi buraya yapıştır")
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(cookieAlani));
      return interaction.showModal(modal);
    }

    if (cmd === "cookie-durum") {
      await interaction.deferReply({ ephemeral: true });
      if (robloxGirisYapildi && robloxBotAdi) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription(
            `✅ Bot şu anda Roblox'a giriş yapmış durumda.\n` +
            `👤 **Giriş Yapılan Hesap:** ${robloxBotAdi}\n` +
            `🆔 **Hesap ID:** ${robloxBotUserId}`
          )]
        });
      } else {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(
            `❌ Bot şu anda Roblox'a giriş yapamamış durumda.\n` +
            `Lütfen \`/cookie-yenile\` komutu ile yeni bir cookie girin.`
          )]
        });
      }
    }

    if (cmd === "yenile") {
      await interaction.deferReply({ ephemeral: true });
      const robloxUsername = interaction.options.getString("roblox_isim");

      try {
        const robloxUser = await getRobloxUserByUsername(robloxUsername);
        if (!robloxUser) {
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(`❌ **${robloxUsername}** adında bir Roblox kullanıcısı bulunamadı.`)] });
        }

        data.robloxBaglantilari[interaction.user.id] = robloxUser.id;
        saveData();

        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription(
            `✅ Discord hesabınız başarıyla Roblox hesabınız **${robloxUser.name}** (${robloxUser.id}) ile bağlandı.`
          )]
        });
      } catch (e) {
        console.error("Roblox hesabı bağlama hatası:", e);
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Roblox hesabınızı bağlarken bir hata oluştu. Lütfen tekrar deneyin.")] });
      }
    }

    if (cmd === "duyuru") {
      await interaction.deferReply();
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
        const bulunan = await withTimeout(
          ytdlpArama(query),
          15000,
          "Arama zaman aşımına uğradı (YouTube yanıt vermedi)."
        );
        if (!bulunan) {
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Şarkı bulunamadı.")] });
        }

        const akis = ytdlpAkisOlustur(bulunan.url);
        streamInfo = { stream: akis, type: StreamType.Raw, title: bulunan.title, url: bulunan.url };
      } catch (e) {
        console.error("Müzik akışı alınırken hata:", e);
        const zamanAsimiMi = e.message?.includes("zaman aşımına uğradı");
        const aciklama = zamanAsimiMi
          ? `⏱️ ${e.message}`
          : "Müzik çalınırken bir hata oluştu. Farklı bir şarkı adı veya link ile tekrar dene.";
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(aciklama)] });
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
      await interaction.deferReply();
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
      await interaction.deferReply();
      if (queue.length > 0) {
        player.stop(); // Bu, player.on(AudioPlayerStatus.Idle) tetikleyecek ve sıradaki şarkıyı çalacak.
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.ana).setDescription("⏭️ Sıradaki şarkıya geçiliyor.")] });
      } else {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Kuyrukta başka şarkı bulunmuyor.")] });
      }
    }

    if (cmd === "muzik-kuyruk") {
      await interaction.deferReply();
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
      await interaction.deferReply();
      if (currentSong) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription(`▶️ Şu an çalıyor: **[${currentSong.title}](${currentSong.url})**`)] });
      } else {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Şu an hiçbir şarkı çalmıyor.")] });
      }
    }

    // ==================== DİĞER KOMUTLAR ====================
    if (cmd === "rutbeler") {
      await interaction.deferReply();

      // Sabit tablo: GROUP_ID ayarlanmamışsa veya Roblox'a erişilemezse yedek olarak kullanılır.
      const yedekRutbeTablosu = `
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

      // Embed field 1024 karakter sınırına takılmamak için listeyi parçalara bölen yardımcı fonksiyon.
      const chunkText = (lines) => {
        const chunks = [];
        let current = "";
        for (const line of lines) {
          if ((current + line + "\n").length > 1000) {
            chunks.push(current);
            current = "";
          }
          current += line + "\n";
        }
        if (current) chunks.push(current);
        return chunks;
      };

      const embed = new EmbedBuilder()
        .setColor(RENK.ozel)
        .setTitle("👑 TSA Rütbe Tablosu")
        .setFooter({ text: "TSA Discord Bot" })
        .setTimestamp();

      const groupId = config.GROUP_ID;
      if (!groupId) {
        embed.setDescription("⚠️ `GROUP_ID` ayarlanmadığı için canlı veri çekilemedi, yedek tablo gösteriliyor.\n" + yedekRutbeTablosu);
        return interaction.editReply({ embeds: [embed] });
      }

      try {
        const roller = await getRobloxGroupRoles(groupId);
        // Rütbe (rank) numarasına göre büyükten küçüğe sıralıyoruz, en yüksek rütbe en üstte.
        const siraliRoller = roller.slice().sort((a, b) => b.rank - a.rank);
        const satirlar = siraliRoller.map(r => `**${r.rank}.** ${r.name} — 👥 ${r.memberCount ?? 0}`);

        embed.setDescription("Roblox grubundan canlı olarak çekilen güncel rütbe listesi:");
        chunkText(satirlar).forEach((chunk, i) => {
          embed.addFields({ name: i === 0 ? "📋 Rütbeler" : "📋 Rütbeler (devam)", value: chunk });
        });

        return interaction.editReply({ embeds: [embed] });
      } catch (e) {
        console.error("Rütbe listesi hatası:", e);
        embed.setDescription("⚠️ Roblox'tan canlı veri çekilirken hata oluştu, yedek tablo gösteriliyor.\n" + yedekRutbeTablosu);
        return interaction.editReply({ embeds: [embed] });
      }
    }

    if (cmd === "liderlik") {
      const siralama = Object.entries(data.aktiflik || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      if (siralama.length === 0) {
        return interaction.reply({ embeds: [new EmbedBuilder().setColor(RENK.altin).setTitle("👑 En Aktif Üyeler").setDescription("Henüz hiç aktiflik verisi toplanmadı.")] });
      }

      const madalyalar = ["🥇", "🥈", "🥉"];
      const satirlar = siralama.map(([userId, sayi], i) => {
        const sira = madalyalar[i] || `**${i + 1}.**`;
        return `${sira} <@${userId}> — **${sayi}** mesaj`;
      });

      const embed = new EmbedBuilder()
        .setColor(RENK.altin)
        .setTitle("👑 En Aktif Üyeler")
        .setDescription(satirlar.join("\n"))
        .setFooter({ text: "TSA Discord Bot — Sunucudaki toplam mesaj sayısına göre sıralanmıştır" })
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }

    if (cmd === "sunucu-bilgi") {
      await interaction.deferReply();
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
      await interaction.deferReply();
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
        .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
          { name: "🆔 Kullanıcı ID", value: user.id, inline: true },
          { name: "🗓️ Katılma Tarihi", value: `<t:${parseInt(member.joinedTimestamp / 1000)}:D>`, inline: true },
          { name: "🗓️ Hesap Oluşturma", value: `<t:${parseInt(user.createdTimestamp / 1000)}:D>`, inline: true },
          { name: "💎 Roller", value: roles, inline: false }
        )
        .setFooter({ text: "TSA Discord Bot" });

      return interaction.editReply({ embeds: [embed] });
    }

    if (cmd === "rutbe-bilgi") {
      await interaction.deferReply();
      const role = interaction.options.getRole("rol");

      const embed = new EmbedBuilder()
        .setColor(role.color || RENK.ana)
        .setTitle(`👑 ${role.name} Rol Bilgileri`)
        .addFields(
          { name: "🆔 Rol ID", value: role.id, inline: true },
          { name: "👥 Üye Sayısı", value: role.members.size.toString(), inline: true },
          { name: "Renk Kodu", value: role.hexColor, inline: true },
          { name: "Oluşturulma Tarihi", value: `<t:${parseInt(role.createdTimestamp / 1000)}:D>`, inline: true },
          { name: "Ayrı Gösteriliyor mu?", value: role.hoist ? "Evet" : "Hayır", inline: true },
          { name: "Bahsedilebilir mi?", value: role.mentionable ? "Evet" : "Hayır", inline: true }
        )
        .setFooter({ text: "TSA Discord Bot" })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }
  } catch (error) {
    console.error(error);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Komut çalıştırılırken bir hata oluştu.")] });
    } else {
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Komut çalıştırılırken bir hata oluştu.")], ephemeral: true });
    }
  }
});

client.login(config.TOKEN);
