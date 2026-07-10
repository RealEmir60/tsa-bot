const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, REST, Routes, ActivityType, PermissionsBitField, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection, AudioPlayerStatus, NoSubscriberBehavior, StreamType } = require("@discordjs/voice");
const youtubedl = require("yt-dlp-exec");
const roblox = require("./roblox.js");
const prism = require("prism-media");
const fs = require("fs");
const express = require("express");
require("dotenv").config();

process.env.FFMPEG_PATH = require("ffmpeg-static");

const RENK = {
  ana: 0x1B98F5,
  basari: 0x2ECC71,
  hata: 0xE74C3C,
  uyari: 0xF5A623,
  ozel: 0x9B59B6,
  altin: 0xF1C40F,
  notr: 0x95A5A6
};

const ROBLOX_GRUP_LINK = "https://www.roblox.com/tr/communities/972348115/TSA-Turkish-Armed-Forces-Yeniden#!/about";

const GRUPLAR = {
  "Milli İstihbarat Teşkilatı": { id: "460437686", branşRolu: null },
  "Askeri İnzibat": { id: "751296173", branşRolu: null },
  "Deniz Kuvvetleri Komutanlığı": { id: "594898013", branşRolu: null },
  "Hava Kuvvetleri Komutanlığı": { id: "850943288", branşRolu: null },
  "Jandarma Genel Komutanlığı": { id: "523316183", branşRolu: null },
  "Kara Kuvvetleri Komutanlığı": { id: "683890016", branşRolu: null },
  "Özel Kuvvetler Komutanlığı": { id: "901158188", branşRolu: null },
  "Sürücü Okulu": { id: "315627660", branşRolu: null },
  "Sınır Müfettişleri": { id: "954961869", branşRolu: null }
};

const robloxProfilCache = new Map();
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

const OTO_CEVAPLAR = [
  { tetikleyiciler: ["sa", "selamun aleykum", "selamünaleyküm", "selamun aleyküm", "selamünaleykum"], cevap: "Aleyküm Selam. 🎖️" },
  { tetikleyiciler: ["merhaba"], cevap: "Merhaba! 👋" },
  { tetikleyiciler: ["selam"], cevap: "Selam! 👋" },
  { tetikleyiciler: ["günaydın", "gunaydin"], cevap: "Günaydın! ☀️" },
  { tetikleyiciler: ["iyi geceler"], cevap: "Sana da iyi geceler! 🌙" },
  { tetikleyiciler: ["naber", "nasılsın", "nasilsin"], cevap: "İyidir, sorduğun için sağ ol! Sen nasılsın? 🙂" },
  { tetikleyiciler: ["teşekkürler", "tesekkurler", "sağol", "sagol", "sağ ol"], cevap: "Rica ederim! 🙌" }
];

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

const SPAM_MESAJ_LIMITI = 5;
const SPAM_SURE_MS = 6000;
const SPAM_TIMEOUT_MS = 60_000;
const spamTakip = new Map();

function spamKontrolEt(kullaniciId) {
  const simdi = Date.now();
  const kayitlar = (spamTakip.get(kullaniciId) || []).filter(t => simdi - t < SPAM_SURE_MS);
  kayitlar.push(simdi);
  spamTakip.set(kullaniciId, kayitlar);
  return kayitlar.length > SPAM_MESAJ_LIMITI;
}

function tsaEmbed(color, guild = null) {
  const embed = new EmbedBuilder().setColor(color).setTimestamp();
  if (guild?.iconURL()) {
    embed.setFooter({ text: "TSA Discord Bot", iconURL: guild.iconURL({ dynamic: true }) });
  } else {
    embed.setFooter({ text: "TSA Discord Bot" });
  }
  return embed;
}

const app = express();
app.get("/", (_, res) => res.send("OK"));
app.listen(process.env.PORT || 3000, "0.0.0.0");

const config = {
  TOKEN: process.env.DISCORD_TOKEN,
  BOT_SAHIBI: process.env.BOT_SAHIBI_ID,
  YETKILI_ROL: process.env.YETKILI_ROL_ID,
  IZIN_ROL: process.env.IZIN_ROL_ID,
  UYARI_1_ROL: process.env.UYARI_1_ROL_ID,
  UYARI_2_ROL: process.env.UYARI_2_ROL_ID,
  UYARI_3_ROL: process.env.UYARI_3_ROL_ID,
  HABER_ROL: process.env.HABER_ROL_ID,
  HABER_KANAL: process.env.HABER_KANAL_ID,
  LOG_KANAL: process.env.LOG_CHANNEL_ID,
  ASKERI_PERSONEL_ROL: process.env.ASKERI_PERSONEL_ROL_ID,
  BRANS_YETKILI_ROL: process.env.BRANS_YETKILI_ROL_ID,
  ROWIFI_ROL: process.env.ROWIFI_ROL_ID,
  GROUP_ID: process.env.GROUP_ID,
  OYUN_PLACE_ID: process.env.OYUN_PLACE_ID,
  ROBLOX_COOKIE: process.env.ROBLOX_COOKIE,
  DATA_FILE: "./data.json"
};

let robloxGirisYapildi = false;
let robloxBotUserId = null;
let robloxBotAdi = null;
let robloxCookieSonGecerlilik = null;

async function robloxGirisYap(cookie) {
  if (!cookie) {
    console.log("ℹ️ ROBLOX_COOKIE ayarlanmamış. Rütbe komutları çalışmayacak.");
    robloxGirisYapildi = false;
    return null;
  }
  try {
    const currentUser = await roblox.directLogin(cookie);
    robloxGirisYapildi = true;
    robloxBotUserId = roblox.botUserId;
    robloxBotAdi = roblox.botUserName;
    robloxCookieSonGecerlilik = Date.now();
    console.log(`✅ Roblox'a "${robloxBotAdi}" (${robloxBotUserId}) hesabıyla giriş yapıldı. Rütbe komutları aktif.`);
    return currentUser;
  } catch (e) {
    console.error("❌ ROBLOX_COOKIE ile giriş yapılamadı:", e.message);
    robloxGirisYapildi = false;
    robloxBotUserId = null;
    robloxBotAdi = null;
    robloxCookieSonGecerlilik = null;
    return null;
  }
}

async function robloxBotRankiGetir(groupId) {
  if (!robloxGirisYapildi) return null;
  try {
    return await roblox.getRankInGroup(groupId, robloxBotUserId);
  } catch (e) {
    console.error("Bot rütbesi alınırken hata:", e);
    return null;
  }
}

if (config.ROBLOX_COOKIE) {
  robloxGirisYap(config.ROBLOX_COOKIE);
} else {
  console.log("ℹ️ ROBLOX_COOKIE ayarlanmamış. Rütbe komutları çalışmayacak.");
}

setInterval(async () => {
  if (!config.ROBLOX_COOKIE) return;
  try {
    await roblox.directLogin(config.ROBLOX_COOKIE);
    if (!robloxGirisYapildi) {
      robloxGirisYapildi = true;
      robloxBotUserId = roblox.botUserId;
      robloxBotAdi = roblox.botUserName;
      robloxCookieSonGecerlilik = Date.now();
      console.log(`✅ Roblox oturumu yeniden doğrulandı: "${robloxBotAdi}"`);
    } else {
      robloxCookieSonGecerlilik = Date.now();
    }
  } catch (e) {
    if (robloxGirisYapildi) {
      console.error("⚠️ Roblox oturumu artık geçersiz:", e.message);
    }
    robloxGirisYapildi = false;
  }
}, 30 * 60_000);

const EGITIM_ROL_ID = "1518397406578741348";
const EGITIM_KANAL_ID = "1518357904779116554";

let data = { uyari: {}, izin: {}, aktiflik: {}, robloxBaglantilari: {}, dogrulamaKodlari: {} };

if (fs.existsSync(config.DATA_FILE)) {
  try {
    data = JSON.parse(fs.readFileSync(config.DATA_FILE, "utf8"));
  } catch (e) {
    console.error("data.json okunurken hata:", e);
  }
}
if (!data.aktiflik) data.aktiflik = {};
if (!data.robloxBaglantilari) data.robloxBaglantilari = {};
if (!data.dogrulamaKodlari) data.dogrulamaKodlari = {};

const saveData = () => fs.writeFileSync(config.DATA_FILE, JSON.stringify(data, null, 2));

function dogrulamaKoduOlustur() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const DOGRULAMA_KOD_GECERLILIK_MS = 10 * 60 * 1000;

function aktifDogrulamaKoduUret() {
  return `TSA-${dogrulamaKoduOlustur()}`;
}

function dogrulamaKaydiniTemizle(discordId) {
  if (data.dogrulamaKodlari[discordId]) {
    delete data.dogrulamaKodlari[discordId];
    saveData();
  }
}

async function withTimeout(promise, ms, timeoutMessage) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutMessage)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function ytdlpArama(query) {
  const searchUrl = `ytsearch1:${query}`;
  const options = {
    dumpSingleJson: true,
    noWarnings: true,
    noCheckCertificates: true,
    preferFreeFormats: true,
    skipDownload: true,
    maxRetries: 3
  };

  const sonuc = await youtubedl(searchUrl, options, { cwd: process.cwd(), env: process.env });

  const video = sonuc?.entries?.[0] || (sonuc?.id ? sonuc : null);
  if (!video) return null;

  return {
    title: video.title || "Bilinmeyen Şarkı",
    url: video.webpage_url || `https://www.youtube.com/watch?v=${video.id}`
  };
}

function ytdlpAkisOlustur(url) {
  const ytProcess = youtubedl.exec(url, {
    output: "-",
    format: "bestaudio/best",
    noCheckCertificates: true,
    noWarnings: true,
    preferFreeFormats: true,
    quiet: true,
    maxRetries: 3
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
    if (ytProcess && !ytProcess.killed) {
      ytProcess.kill();
    }
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
    client.guilds.cache.forEach(g => {
      const conn = getVoiceConnection(g.id);
      if (conn) conn.destroy();
    });
  }
});

player.on("error", error => {
  console.error(`Müzik çalarken hata: ${error.message} (Kaynak: ${error.resource?.metadata?.title})`);
  if (currentSong) {
    currentSong.stream.destroy();
    currentSong = null;
  }
  client.guilds.cache.forEach(g => {
    const conn = getVoiceConnection(g.id);
    if (conn) conn.destroy();
  });
  queue = [];
});

async function getRobloxUserByUsername(username) {
  const res = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
  });
  if (!res.ok) throw new Error(`Roblox kullanıcı araması başarısız: ${res.status} ${await res.text()}`);
  const json = await res.json();
  if (!json.data || json.data.length === 0) return null;
  return json.data[0];
}

async function getRobloxUserDetail(userId) {
  const res = await fetch(`https://users.roblox.com/v1/users/${userId}`);
  if (!res.ok) throw new Error(`Roblox kullanıcı detayı alınamadı: ${res.status} ${await res.text()}`);
  return res.json();
}

async function getRobloxAvatarUrl(userId) {
  const res = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`);
  if (!res.ok) return null;
  const json = await res.json();
  return json.data?.[0]?.imageUrl || null;
}

async function getRobloxGroups(userId) {
  const res = await fetch(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
  if (!res.ok) throw new Error(`Roblox grupları alınamadı: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.data || [];
}

async function getRobloxGroupRoles(groupId) {
  const res = await fetch(`https://groups.roblox.com/v1/groups/${groupId}/roles`);
  if (!res.ok) throw new Error(`Roblox grup rütbeleri alınamadı: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.roles || [];
}

async function getRobloxGroupInfo(groupId) {
  const res = await fetch(`https://groups.roblox.com/v1/groups/${groupId}`);
  if (!res.ok) throw new Error(`Roblox grup bilgisi alınamadı: ${res.status} ${await res.text()}`);
  return res.json();
}

async function getRobloxGroupIcon(groupId) {
  const res = await fetch(`https://groups.roblox.com/v1/groups/${groupId}/icon`);
  if (!res.ok) return null;
  const json = await res.json();
  return json.imageUrl || null;
}

async function getRobloxUniverseIdFromPlace(placeId) {
  const res = await fetch(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`);
  if (!res.ok) throw new Error(`Evren ID'si alınamadı: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.universeId || null;
}

async function getRobloxGameInfo(universeId) {
  const res = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
  if (!res.ok) throw new Error(`Oyun bilgisi alınamadı: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.data?.[0] || {};
}

async function getRobloxGameIcon(universeId) {
  const res = await fetch(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&size=512x512&format=Png`);
  if (!res.ok) return null;
  const json = await res.json();
  return json.data?.[0]?.imageUrl || null;
}

async function kullaniciGruplardaVarMi(robloxUserId, grupIdleri) {
  try {
    const groups = await getRobloxGroups(robloxUserId);
    const userGroupIds = groups.map(g => g.group.id.toString());
    return grupIdleri.some(gid => userGroupIds.includes(gid.toString()));
  } catch (e) {
    console.error("Grup kontrolü hatası:", e);
    return false;
  }
}

async function kullaniciGrupRutbesi(robloxUserId, grupId) {
  try {
    const groups = await getRobloxGroups(robloxUserId);
    const group = groups.find(g => g.group.id.toString() === grupId.toString());
    return group ? group.role : null;
  } catch (e) {
    console.error("Grup rütbesi kontrolü hatası:", e);
    return null;
  }
}

async function kullaniciGruptaYetkiliMi(robloxUserId, grupId) {
  try {
    const groupRole = await kullaniciGrupRutbesi(robloxUserId, grupId);
    if (!groupRole) return false;
    return groupRole.rank > 1;
  } catch (e) {
    console.error("Grup yetki kontrolü hatası:", e);
    return false;
  }
}

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
  partials: ['CHANNEL'],
});

const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Botun gecikmesini ve çalışma süresini gösterir."),
  new SlashCommandBuilder().setName("yardim").setDescription("Botun tüm komutlarını listeler."),

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
    .setDescription("Bir kullanıcının ana Roblox grubundaki rütbesini belirli bir rütbeye ayarlar.")
    .addStringOption(o => o.setName("roblox_isim").setDescription("Roblox kullanıcı adı").setRequired(true))
    .addStringOption(o => o.setName("rutbe").setDescription("Yeni rütbe (yazmaya başlayınca öneriler çıkar)").setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName("sebep").setDescription("Değişikliğin sebebi").setRequired(true)),
  new SlashCommandBuilder()
    .setName("terfi")
    .setDescription("Bir kullanıcıyı ana Roblox grubunda bir üst rütbeye terfi ettirir.")
    .addStringOption(o => o.setName("roblox_isim").setDescription("Roblox kullanıcı adı").setRequired(true))
    .addStringOption(o => o.setName("sebep").setDescription("Terfi sebebi").setRequired(true)),
  new SlashCommandBuilder()
    .setName("tenzil")
    .setDescription("Bir kullanıcıyı ana Roblox grubunda bir alt rütbeye tenzil eder (indirir).")
    .addStringOption(o => o.setName("roblox_isim").setDescription("Roblox kullanıcı adı").setRequired(true))
    .addStringOption(o => o.setName("sebep").setDescription("Tenzil sebebi").setRequired(true)),
  new SlashCommandBuilder()
    .setName("yenile")
    .setDescription("Discord hesabınızı Roblox hesabınıza RoWiFi üzerinden bağlar veya günceller."),
  new SlashCommandBuilder()
    .setName("dogrula")
    .setDescription("Roblox hesabınızı doğrulamak için kod girin.")
    .addStringOption(o => o.setName("kod").setDescription("Roblox profilinizdeki doğrulama kodu").setRequired(true)),
  new SlashCommandBuilder()
    .setName("dm-duyuru")
    .setDescription("Belirtilen roldeki kullanıcılara özel mesaj duyurusu gönderir.")
    .addRoleOption(o => o.setName("hedef_rol").setDescription("Duyurunun gönderileceği rol").setRequired(true))
    .addStringOption(o => o.setName("mesaj_icerigi").setDescription("Gönderilecek duyuru mesajı").setRequired(true)),
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

  new SlashCommandBuilder()
    .setName("muzik-cal")
    .setDescription("Belirtilen şarkıyı çalar veya kuyruğa ekler.")
    .addStringOption(o => o.setName("sarki").setDescription("Çalınacak şarkının adı veya URLsi").setRequired(true)),
  new SlashCommandBuilder().setName("muzik-durdur").setDescription("Müziği durdurur ve kuyruğu temizler."),
  new SlashCommandBuilder().setName("muzik-gec").setDescription("Sıradaki şarkıya geçer."),
  new SlashCommandBuilder().setName("muzik-kuyruk").setDescription("Müzik kuyruğunu gösterir."),
  new SlashCommandBuilder().setName("muzik-simdiki").setDescription("Şu an çalan şarkıyı gösterir."),

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
    .setName("rutbe-sorgu")
    .setDescription("Belirtilen Roblox kullanıcısının profilini ve grubundaki rütbesini gösterir.")
    .addStringOption(o => o.setName("roblox_isim").setDescription("Sorgulanacak Roblox kullanıcı adı").setRequired(true)),

  new SlashCommandBuilder()
    .setName("cookie-durum")
    .setDescription("Roblox cookie'sinin geçerlilik durumunu ve ne zaman giriş yapıldığını gösterir."),
  new SlashCommandBuilder()
    .setName("cookie-yenile")
    .setDescription("Yeni bir Roblox cookie'si ile botun bağlantısını günceller.")
    .addStringOption(o => o.setName("yeni_cookie").setDescription("Yeni ROBLOSECURITY cookie değeriniz").setRequired(true)),

  new SlashCommandBuilder().setName("ses-gir").setDescription("Botu bulunduğunuz ses kanalına sokar."),
  new SlashCommandBuilder().setName("ses-cik").setDescription("Botu ses kanalından çıkarır."),
  new SlashCommandBuilder().setName("yoklama").setDescription("Bulunduğunuz ses kanalındaki kişileri listeler."),

  new SlashCommandBuilder().setName("grup").setDescription("Resmi Roblox grubumuza yönlendirir."),
  new SlashCommandBuilder().setName("oyun").setDescription("Resmi TSA Roblox oyunumuza yönlendirir."),
  new SlashCommandBuilder().setName("grup-bilgi").setDescription("Roblox grubumuz hakkında detaylı bilgi gösterir."),
  new SlashCommandBuilder().setName("aktiflik-sorgu").setDescription("Oyunumuzun anlık oyuncu ve ziyaretçi bilgilerini gösterir."),

  new SlashCommandBuilder()
    .setName("izin-al")
    .setDescription("Belirtilen sebep ve bitiş tarihiyle izin almanızı sağlar.")
    .addStringOption(o => o.setName("sebep").setDescription("İzin sebebi").setRequired(true))
    .addStringOption(o => o.setName("bitis").setDescription("İzin bitiş tarihi (isteğe bağlı)").setRequired(false)),
  new SlashCommandBuilder().setName("izin-bitir").setDescription("Aldığınız izni sonlandırır."),
  new SlashCommandBuilder().setName("izin-listesi").setDescription("Şu anda izinli olan kullanıcıları listeler."),

  new SlashCommandBuilder()
    .setName("profil")
    .setDescription("Belirtilen Roblox kullanıcısının detaylı profilini gösterir.")
    .addStringOption(o => o.setName("roblox_isim").setDescription("Roblox kullanıcı adı").setRequired(true)),

  new SlashCommandBuilder()
    .setName("branş-istek-kabul-et")
    .setDescription("Branş isteğini kabul eder: Discord rolü verir ve seçilen Roblox grubuna en alt rütbeden alır.")
    .addUserOption(o => o.setName("kullanici").setDescription("Branşa kabul edilecek Discord kullanıcısı").setRequired(true))
    .addStringOption(o => o.setName("roblox_isim").setDescription("Kabul edilecek kişinin Roblox kullanıcı adı").setRequired(true))
    .addStringOption(o => o.setName("grup").setDescription("Grup seçin").setRequired(true).setAutocomplete(true))
    .addRoleOption(o => o.setName("brans_rolu").setDescription("Verilecek branş Discord rolü").setRequired(true))
    .addStringOption(o => o.setName("sebep").setDescription("Kabul notu (isteğe bağlı)").setRequired(false)),
  new SlashCommandBuilder()
    .setName("branştan-at")
    .setDescription("Kullanıcıyı branştan çıkarır: Discord rolünü alır ve seçilen Roblox grubundan atar.")
    .addUserOption(o => o.setName("kullanici").setDescription("Branştan çıkarılacak Discord kullanıcısı").setRequired(true))
    .addStringOption(o => o.setName("roblox_isim").setDescription("Çıkarılacak kişinin Roblox kullanıcı adı").setRequired(true))
    .addStringOption(o => o.setName("grup").setDescription("Grup seçin").setRequired(true).setAutocomplete(true))
    .addRoleOption(o => o.setName("brans_rolu").setDescription("Alınacak branş Discord rolü").setRequired(true))
    .addStringOption(o => o.setName("sebep").setDescription("Çıkarılma sebebi (isteğe bağlı)").setRequired(false)),
  new SlashCommandBuilder()
    .setName("branş-rutbe-degistir")
    .setDescription("Bir kullanıcının seçilen Roblox grubundaki rütbesini belirli bir rütbeye ayarlar.")
    .addStringOption(o => o.setName("roblox_isim").setDescription("Roblox kullanıcı adı").setRequired(true))
    .addStringOption(o => o.setName("grup").setDescription("Grup seçin").setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName("rutbe").setDescription("Yeni rütbe (yazmaya başlayınca öneriler çıkar)").setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName("sebep").setDescription("Değişikliğin sebebi").setRequired(true))
].map(c => c.toJSON());

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

  if (!config.ROBLOX_COOKIE) {
      console.log("ℹ️ ROBLOX_COOKIE ayarlanmamış. Rütbe komutları çalışmayacaktır.");
  } else if (!robloxGirisYapildi) {
      console.log("⚠️ ROBLOX_COOKIE ile otomatik giriş yapılamadı. Lütfen console loglarını kontrol edin veya /cookie-yenile komutunu kullanın.");
  }
});

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
    console.log(`ℹ️ ${member.user.tag} kullanıcısına hoş geldin DM'i gönderilemedi (DM kapalı olabilir).`);
    await sendLogMessage(
      member.guild,
      "Hoş Geldin DM'i Gönderilemedi",
      `<@${member.id}> katıldı fakat DM'leri kapalı olduğu için hoş geldin mesajı gönderilemedi.`,
      RENK.uyari
    ).catch(() => {});
  }
});

client.on("messageCreate", async message => {
  if (message.author.bot || !message.guild) return;

  data.aktiflik[message.author.id] = (data.aktiflik[message.author.id] || 0) + 1;
  saveData();

  const uyeYetkiliMi = message.member?.roles.cache.has(config.YETKILI_ROL) || message.member?.permissions.has(PermissionsBitField.Flags.Administrator);

  if (!uyeYetkiliMi && spamKontrolEt(message.author.id)) {
    spamTakip.delete(message.author.id);
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
    return;
  }

  const cevap = otoCevapBul(message.content);
  if (cevap) {
    await message.reply(cevap).catch(() => {});
  }
});

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

client.on("interactionCreate", async interaction => {
  if (interaction.isAutocomplete()) {
    const branşGrupKomutlari = ["branş-istek-kabul-et", "branştan-at", "branş-rutbe-degistir"];
    const rutbeSecmeliKomutlar = ["rutbe-degistir", "branş-rutbe-degistir"];

    if (branşGrupKomutlari.includes(interaction.commandName) && interaction.options.getFocused(true).name === "grup") {
      const yazilan = (interaction.options.getString("grup") || "").toLocaleLowerCase("tr-TR").trim();
      const eslesenler = Object.entries(GRUPLAR)
        .filter(([isim]) => isim.toLocaleLowerCase("tr-TR").includes(yazilan))
        .slice(0, 25);
      return interaction.respond(eslesenler.map(([isim]) => ({ name: isim, value: isim })));
    }

    if (rutbeSecmeliKomutlar.includes(interaction.commandName) && interaction.options.getFocused(true).name === "rutbe") {
      try {
        const groupId = interaction.commandName === "rutbe-degistir"
          ? config.GROUP_ID
          : GRUPLAR[interaction.options.getString("grup")]?.id;

        if (!groupId) return interaction.respond([]);

        const yazilan = interaction.options.getFocused().toLocaleLowerCase("tr-TR").trim();
        const roller = await getRobloxGroupRoles(groupId);
        const siraliRoller = roller.slice().sort((a, b) => b.rank - a.rank);

        const eslesenler = (yazilan
          ? siraliRoller.filter(r => r.name.toLocaleLowerCase("tr-TR").includes(yazilan))
          : siraliRoller
        ).slice(0, 25);

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

  if (interaction.isButton()) {
    if (interaction.customId === "robloxprofil_prev" || interaction.customId === "robloxprofil_next") {
      const cache = robloxProfilCache.get(interaction.message.id);
      if (!cache) {
        return interaction.reply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("⏱️ Bu profil görüntüleyicisinin süresi doldu, komutu tekrar çalıştır.")], ephemeral: true });
      }
      const yeniSayfa = cache.sayfa + (interaction.customId === "robloxprofil_next" ? 1 : -1);
      const { embed, butonlar, sayfa } = robloxProfilSayfasiOlustur(cache.veri, yeniSayfa);
      cache.sayfa = sayfa;
      robloxProfilCache.set(interaction.message.id, cache);
      return interaction.update({ embeds: [embed], components: [butonlar] });
    }
    return;
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === "roblox_username_modal") {
      const robloxUsername = interaction.fields.getTextInputValue("roblox_username").trim();

      try {
        const robloxUser = await getRobloxUserByUsername(robloxUsername);
        if (!robloxUser) {
          return interaction.reply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(`❌ **${robloxUsername}** adında bir Roblox kullanıcısı bulunamadı.`)], ephemeral: true });
        }

        const baskasiKullaniyor = Object.entries(data.robloxBaglantilari).find(([discordId, robloxId]) => discordId !== interaction.user.id && robloxId === robloxUser.id);
        if (baskasiKullaniyor) {
          return interaction.reply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(
            `❌ Bu Roblox hesabı (**${robloxUser.name}**) başka bir Discord kullanıcısı tarafından zaten bağlanmış.`
          )], ephemeral: true });
        }

        const kod = aktifDogrulamaKoduUret();
        const gecerlilikTarihi = Date.now() + DOGRULAMA_KOD_GECERLILIK_MS;

        data.dogrulamaKodlari[interaction.user.id] = {
          kod,
          robloxUserId: robloxUser.id,
          robloxUsername: robloxUser.name,
          olusturulma: Date.now(),
          bitis: gecerlilikTarihi
        };
        saveData();

        const embed = new EmbedBuilder()
          .setColor(RENK.uyari)
          .setTitle("🔐 Roblox Doğrulama Başlatıldı")
          .setDescription(
            `Roblox hesabınız olarak **${robloxUser.name}** seçildi.\n\n` +
            `Aşağıdaki kodu Roblox profil açıklamanıza ekleyin, ardından \`/dogrula\` komutunda aynı kodu girin.`
          )
          .addFields(
            { name: "👤 Roblox Kullanıcı", value: robloxUser.name, inline: true },
            { name: "🆔 Roblox ID", value: robloxUser.id.toString(), inline: true },
            { name: "🔑 Doğrulama Kodu", value: `\`${kod}\``, inline: false },
            { name: "📝 Yapmanız Gereken", value: `Roblox profil açıklamanıza tam olarak \`${kod}\` yazın ve sonra \`/dogrula kod:${kod}\` çalıştırın.`, inline: false },
            { name: "⏳ Geçerlilik", value: `<t:${Math.floor(gecerlilikTarihi / 1000)}:R>`, inline: true }
          )
          .setFooter({ text: "TSA Discord Bot - Profil Açıklaması Doğrulaması" })
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (e) {
        console.error("Roblox doğrulama modal hatası:", e);
        return interaction.reply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Roblox doğrulama başlatılırken bir hata oluştu. Lütfen tekrar deneyin.")], ephemeral: true });
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const cmd = interaction.commandName;
  const isYetkili = interaction.member?.roles.cache.has(config.YETKILI_ROL) || interaction.member?.permissions.has(PermissionsBitField.Flags.Administrator);
  const isBranşYetkili = interaction.member?.roles.cache.has(config.BRANS_YETKILI_ROL) || isYetkili;
  const isEgitimHost = interaction.member?.roles.cache.has(EGITIM_ROL_ID);

  const yetkiliKomutlar = ["kick", "ban", "unban", "temizle", "yavas-mod", "kilitle", "kilit-ac", "rol-ver", "rol-al", "uyari-ver", "uyari-sil", "uyari-liste", "sicil-temizle", "dm-mesaj", "haber-yap", "egitim-duyuru", "duyuru", "aktiflik-denetleme", "rutbe-degistir", "terfi", "tenzil", "dm-duyuru", "cookie-yenile"];
  const branşKomutlar = ["branş-istek-kabul-et", "branştan-at", "branş-rutbe-degistir"];

  if (yetkiliKomutlar.includes(cmd) && !isYetkili) {
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Bu komutu kullanmak için yeterli yetkiniz yok!")], ephemeral: true });
  }

  if (branşKomutlar.includes(cmd) && !isBranşYetkili) {
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Bu komutu kullanmak için branş yetkisine ihtiyacınız var!")], ephemeral: true });
  }

  try {
    if (cmd === "ping") {
      await interaction.deferReply();
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
      return interaction.editReply({ embeds: [embed] });
    }

    if (cmd === "yardim") {
      await interaction.deferReply({ ephemeral: true });
      const yetkiliKomutlarListe = ["kick", "ban", "unban", "temizle", "yavas-mod", "kilitle", "kilit-ac", "rol-ver", "rol-al", "uyari-ver", "uyari-sil", "uyari-liste", "sicil-temizle", "dm-mesaj", "haber-yap", "egitim-duyuru", "duyuru", "aktiflik-denetleme", "rutbe-degistir", "terfi", "tenzil", "dm-duyuru", "cookie-yenile"];

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
        .setDescription("İşte kullanabileceğin komutlar:");

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

      return interaction.editReply({ embeds: [embed] });
    }

    if (cmd === "yenile") {
      try {
        const modal = new ModalBuilder()
          .setCustomId("roblox_username_modal")
          .setTitle("Roblox Kullanıcı Adı");

        const usernameInput = new TextInputBuilder()
          .setCustomId("roblox_username")
          .setLabel("Roblox Kullanıcı Adınız")
          .setPlaceholder("Örn: Player123")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMinLength(3)
          .setMaxLength(20);

        const actionRow = new ActionRowBuilder().addComponents(usernameInput);
        modal.addComponents(actionRow);

        return interaction.showModal(modal);
      } catch (e) {
        console.error("Yenile doğrulama hatası:", e);
        return interaction.reply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Roblox doğrulama penceresi açılırken bir hata oluştu. Lütfen tekrar deneyin.")], ephemeral: true });
      }
    }

    if (cmd === "dogrula") {
      await interaction.deferReply({ ephemeral: true });

      const girilenKod = interaction.options.getString("kod")?.trim();
      const kayit = data.dogrulamaKodlari[interaction.user.id];

      if (!kayit) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(
          "❌ Aktif bir doğrulama kaydınız yok. Önce `/yenile` komutunu kullanın."
        )] });
      }

      if (!girilenKod || girilenKod !== kayit.kod) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(
          "❌ Girdiğiniz doğrulama kodu yanlış. `/yenile` ile verilen kodu aynen girin."
        )] });
      }

      if (Date.now() > kayit.bitis) {
        dogrulamaKaydiniTemizle(interaction.user.id);
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(
          "❌ Doğrulama kodunuzun süresi dolmuş. Lütfen tekrar `/yenile` kullanın."
        )] });
      }

      try {
        const robloxDetail = await getRobloxUserDetail(kayit.robloxUserId);
        const profilAciklamasi = robloxDetail.description || "";

        if (!profilAciklamasi.includes(kayit.kod)) {
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(
            `❌ Roblox profil açıklamasında \`${kayit.kod}\` kodu bulunamadı.\n\n` +
            `Kodu profil açıklamanıza ekleyin, kaydedin ve birkaç saniye sonra tekrar deneyin.`
          )] });
        }

        const baskasiKullaniyor = Object.entries(data.robloxBaglantilari).find(([discordId, robloxId]) => discordId !== interaction.user.id && robloxId === kayit.robloxUserId);
        if (baskasiKullaniyor) {
          dogrulamaKaydiniTemizle(interaction.user.id);
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(
            `❌ Bu Roblox hesabı (**${kayit.robloxUsername}**) başka bir Discord kullanıcısı tarafından zaten bağlanmış.`
          )] });
        }

        const mevcutBaglanti = data.robloxBaglantilari[interaction.user.id];
        data.robloxBaglantilari[interaction.user.id] = kayit.robloxUserId;
        delete data.dogrulamaKodlari[interaction.user.id];
        saveData();

        const embed = new EmbedBuilder()
          .setColor(RENK.basari)
          .setTitle("✅ Roblox Hesabı Başarıyla Bağlandı")
          .setDescription(
            `Discord hesabınız Roblox hesabı **${kayit.robloxUsername}** (${kayit.robloxUserId}) ile başarıyla doğrulandı ve bağlandı.\n\n` +
            `Artık rütbe ve branş komutlarını kullanabilirsiniz.`
          )
          .addFields(
            { name: "👤 Roblox Kullanıcı", value: kayit.robloxUsername, inline: true },
            { name: "🆔 Roblox ID", value: kayit.robloxUserId.toString(), inline: true }
          )
          .setFooter({ text: "TSA Discord Bot - Profil Doğrulaması" })
          .setTimestamp();

        if (mevcutBaglanti && mevcutBaglanti !== kayit.robloxUserId) {
          embed.addFields({ name: "📝 Not", value: `Eski bağlantınız (ID: ${mevcutBaglanti}) güncellendi.`, inline: false });
        }

        return interaction.editReply({ embeds: [embed] });
      } catch (e) {
        console.error("Doğrulama kontrol hatası:", e);
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(
          "❌ Roblox profil doğrulaması yapılırken bir hata oluştu. Birkaç saniye sonra tekrar deneyin."
        )] });
      }
    }

    if (cmd === "rutbe-degistir" || cmd === "terfi" || cmd === "tenzil") {
      await interaction.deferReply();

      if (!config.ROBLOX_COOKIE) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ `ROBLOX_COOKIE` ayarlanmamış. Bu komut kullanılamaz.")] });
      }
      if (!robloxGirisYapildi) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Bot şu anda Roblox'a giriş yapamamış durumda (cookie geçersiz veya süresi dolmuş olabilir). Konsol loglarını kontrol et veya /cookie-yenile ile güncelle.")] });
      }

      const groupId = config.GROUP_ID;
      const grupAdi = "Ana Grup";
      const robloxIsim = interaction.options.getString("roblox_isim");
      const sebep = interaction.options.getString("sebep");

      if (!groupId) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ `.env` dosyasında `GROUP_ID` ayarlanmamış. Ana grup komutları kullanılamaz.")] });
      }

      const interactionUserRobloxId = data.robloxBaglantilari[interaction.user.id];
      if (!interactionUserRobloxId) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(
          "❌ Önce `/yenile` komutu ile **Discord hesabınızı Roblox hesabınıza bağlamanız** gerekiyor.\n\n" +
          "Rütbe değiştirme yetkinizi doğrulayabilmem için bu zorunludur."
        )] });
      }

      const yetkiliGrupRutbesi = await kullaniciGrupRutbesi(interactionUserRobloxId, groupId);
      if (!yetkiliGrupRutbesi || yetkiliGrupRutbesi.rank <= 1) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(
          `❌ Ana grupta yetkili değilsiniz veya grupta üye değilsiniz.\n\n` +
          `Bu komutlar sadece ana gruba bağlı çalışır ve yalnızca kendi rütbenizin altındaki kullanıcılarda işlem yapabilir.`
        )] });
      }

      try {
        const userId = await roblox.getIdFromUsername(robloxIsim);
        if (!userId) {
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(`❌ **${robloxIsim}** adında bir Roblox kullanıcısı bulunamadı.`)] });
        }

        const hedefGrupRutbesi = await kullaniciGrupRutbesi(userId, groupId);
        if (!hedefGrupRutbesi) {
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(
            `❌ **${robloxIsim}** kullanıcısı **${grupAdi}** grubunda üye değil.`
          )] });
        }

        if (userId === interactionUserRobloxId) {
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(
            "❌ Kendinize rütbe değişikliği yapamazsınız."
          )] });
        }

        if (hedefGrupRutbesi.rank >= yetkiliGrupRutbesi.rank) {
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(
            `❌ **${robloxIsim}** kullanıcısının mevcut rütbesi (**${hedefGrupRutbesi.name}** - Rank ${hedefGrupRutbesi.rank}), sizin rütbenizden (**${yetkiliGrupRutbesi.name}** - Rank ${yetkiliGrupRutbesi.rank}) yüksek veya eşit.\n\n` +
            `Sadece kendi rütbenizin altındaki kullanıcılara işlem yapabilirsiniz.`
          )] });
        }

        const roller = (await getRobloxGroupRoles(groupId)).slice().sort((a, b) => a.rank - b.rank);

        let hedefRol, baslik, renk;

        if (cmd === "terfi" || cmd === "tenzil") {
          const suankiIndex = roller.findIndex(r => r.rank === hedefGrupRutbesi.rank);
          const hedefIndex = suankiIndex + (cmd === "terfi" ? 1 : -1);

          if (suankiIndex === -1 || hedefIndex < 0 || hedefIndex >= roller.length) {
            const sinirMesaji = cmd === "terfi" ? "zaten en üst rütbede, daha fazla terfi ettirilemez." : "zaten en alt rütbede, daha fazla tenzil edilemez.";
            return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(`❌ **${robloxIsim}** ${sinirMesaji}`)] });
          }
          hedefRol = roller[hedefIndex];
          baslik = cmd === "terfi" ? "⬆️ Terfi Verildi" : "⬇️ Tenzil Yapıldı";
          renk = cmd === "terfi" ? RENK.basari : RENK.hata;
        } else {
          const rutbeAdi = interaction.options.getString("rutbe");
          hedefRol = roller.find(r => r.name.toLocaleLowerCase("tr-TR") === rutbeAdi.toLocaleLowerCase("tr-TR"));
          if (!hedefRol) {
            return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(`❌ **${rutbeAdi}** adında bir rütbe bulunamadı. Lütfen listeden bir seçenek seç.`)] });
          }
          baslik = "🔄 Rütbe Değiştirildi";
          renk = RENK.ozel;
        }

        if (hedefRol.rank >= yetkiliGrupRutbesi.rank) {
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(
            `❌ **${hedefRol.name}** rütbesi, sizin kendi rütbenizden (**${yetkiliGrupRutbesi.name}** - Rank ${yetkiliGrupRutbesi.rank}) yüksek veya eşit olduğu için atanamaz.\n\n` +
            `Kendi rütbenizin altındaki rütbeleri atayabilirsiniz.`
          )] });
        }

        const botRank = await robloxBotRankiGetir(groupId);
        if (botRank !== null && hedefRol.rank >= botRank) {
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(
            `❌ **${hedefRol.name}** rütbesi, botun kendi rütbesinden yüksek olduğu için atanamaz.\n` +
            `Bu, botun/sahibin üstüne çıkarılmasını önlemek için bilerek engellendi.`
          )] });
        }

        if (hedefGrupRutbesi.rank === hedefRol.rank) {
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.uyari).setDescription(`❌ **${robloxIsim}** zaten **${hedefRol.name}** rütbesinde. Değişiklik yapılmadı.`)] });
        }

        await roblox.setRank(groupId, userId, hedefRol.rank);
        const yeniRutbeAdi = hedefRol.name;

        const embed = new EmbedBuilder()
          .setColor(renk)
          .setTitle(baslik)
          .addFields(
            { name: "👤 Roblox Kullanıcı", value: robloxIsim, inline: true },
            { name: "🏛️ Grup", value: grupAdi, inline: true },
            { name: "📤 Eski Rütbe", value: hedefGrupRutbesi.name, inline: true },
            { name: "📥 Yeni Rütbe", value: yeniRutbeAdi, inline: true },
            { name: "📝 Sebep", value: sebep, inline: false },
            { name: "👮 İşlemi Yapan", value: `<@${interaction.user.id}>`, inline: false }
          )
          .setFooter({ text: "TSA - Turkish Special Army" })
          .setTimestamp();

        await sendLogMessage(interaction.guild, baslik, `${robloxIsim} kullanıcısının ${grupAdi} grubundaki rütbesi değiştirildi: ${hedefGrupRutbesi.name} → ${yeniRutbeAdi}`, renk, [
          { name: "Roblox Kullanıcı", value: robloxIsim, inline: true },
          { name: "Grup", value: grupAdi, inline: true },
          { name: "Sebep", value: sebep, inline: true },
          { name: "İşlemi Yapan", value: `<@${interaction.user.id}>`, inline: true }
        ]);

        return interaction.editReply({ embeds: [embed] });
      } catch (e) {
        console.error("Rütbe değiştirme hatası:", e);
        const mesaj = e.message?.includes("permission") || e.message?.includes("Forbidden") || e.message?.includes("user is not in the group")
          ? "❌ Botun bu işlemi yapacak yetkisi yok. Roblox grubunda botun hesabının, hedef kullanıcıdan daha yüksek bir rütbede olduğundan ve gerekli izinlere sahip olduğundan emin ol. Kullanıcı grupta olmayabilir."
          : "❌ Rütbe değiştirilirken bir hata oluştu. Kullanıcı adını, rütbeyi ve diğer detayları kontrol edip tekrar dene.";
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(mesaj)] });
      }
    }

    if (cmd === "branş-istek-kabul-et") {
      await interaction.deferReply();

      if (!robloxGirisYapildi) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Bot şu anda Roblox'a giriş yapamamış durumda.")] });
      }

      const hedefUser = interaction.options.getUser("kullanici");
      const robloxIsim = interaction.options.getString("roblox_isim");
      const grupAdi = interaction.options.getString("grup");
      const bransRol = interaction.options.getRole("brans_rolu");
      const sebep = interaction.options.getString("sebep") || "Belirtilmedi";

      if (!grupAdi || !GRUPLAR[grupAdi]) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Geçersiz grup seçimi.")] });
      }

      const groupId = GRUPLAR[grupAdi].id;

      const interactionUserRobloxId = data.robloxBaglantilari[interaction.user.id];
      if (!interactionUserRobloxId) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(
          "❌ Önce `/yenile` komutu ile **Discord hesabınızı Roblox hesabınıza bağlamanız** gerekiyor."
        )] });
      }

      const yetkiliGrupRutbesi = await kullaniciGrupRutbesi(interactionUserRobloxId, groupId);
      if (!yetkiliGrupRutbesi || yetkiliGrupRutbesi.rank <= 1) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(
          `❌ **${grupAdi}** grubunda yetkili değilsiniz veya grupta üye değilsiniz.`
        )] });
      }

      let hedefUye = interaction.options.getMember("kullanici");
      if (!hedefUye) {
        try { hedefUye = await interaction.guild.members.fetch(hedefUser.id); } catch { hedefUye = null; }
      }
      if (!hedefUye) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Kullanıcı sunucuda bulunamadı.")] });
      }

      const robloxUserId = await roblox.getIdFromUsername(robloxIsim);
      if (!robloxUserId) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(`❌ **${robloxIsim}** adında bir Roblox kullanıcısı bulunamadı.`)] });
      }

      const hedefGrupRutbesi = await kullaniciGrupRutbesi(robloxUserId, groupId);

      if (hedefGrupRutbesi && hedefGrupRutbesi.rank >= yetkiliGrupRutbesi.rank) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(
          `❌ **${robloxIsim}** kullanıcısının mevcut rütbesi (**${hedefGrupRutbesi.name}** - Rank ${hedefGrupRutbesi.rank}), sizin rütbenizden (**${yetkiliGrupRutbesi.name}** - Rank ${yetkiliGrupRutbesi.rank}) yüksek veya eşit.\n\n` +
          `Sadece kendi rütbenizin altındaki kullanıcıları kabul edebilirsiniz.`
        )] });
      }

      const grupRolleri = (await getRobloxGroupRoles(groupId)).filter(r => r.rank > 0 && r.rank < 255).sort((a, b) => a.rank - b.rank);
      const enAltRol = grupRolleri[0];
      if (!enAltRol) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Grupta geçerli bir başlangıç rütbesi bulunamadı.")] });
      }

      const hatalar = [];
      if (!hedefUye.roles.cache.has(bransRol.id)) {
        try { await hedefUye.roles.add(bransRol, `Branş kabulü — ${interaction.user.tag}: ${sebep}`); } catch (e) { hatalar.push(`Discord rol hatası: ${e.message}`); }
      }

      if (!hedefGrupRutbesi) {
        try { await roblox.setRank(groupId, robloxUserId, enAltRol.rank); } catch (e) { hatalar.push(`Roblox gruba alma hatası: ${e.message}`); }
      }

      const embed = new EmbedBuilder()
        .setColor(hatalar.length ? RENK.uyari : RENK.basari)
        .setTitle(hatalar.length ? "⚠️ Branş Kabulü (Kısmi)" : "✅ Branş İsteği Kabul Edildi")
        .setThumbnail(hedefUser.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: "👤 Kabul Edilen", value: `<@${hedefUser.id}>`, inline: true },
          { name: "🎮 Roblox", value: robloxIsim, inline: true },
          { name: "🏛️ Grup", value: grupAdi, inline: true },
          { name: "🏅 Branş", value: `<@&${bransRol.id}>`, inline: true },
          { name: "📊 Başlangıç Rütbesi", value: enAltRol.name, inline: true },
          { name: "👮 Yetkili", value: `<@${interaction.user.id}>`, inline: true },
          { name: "📝 Not", value: sebep, inline: false }
        )
        .setFooter({ text: "TSA Discord Bot - Branş Sistemi" })
        .setTimestamp();

      if (hatalar.length) embed.addFields({ name: "⚠️ Hatalar", value: hatalar.join("\n"), inline: false });

      await sendLogMessage(interaction.guild, "Branş İsteği Kabul Edildi", `${hedefUser.tag} → ${robloxIsim} kullanıcısı ${bransRol.name} branşına (${grupAdi}) kabul edildi.`, RENK.basari, [
        { name: "Discord", value: `<@${hedefUser.id}>`, inline: true },
        { name: "Roblox", value: robloxIsim, inline: true },
        { name: "Grup", value: grupAdi, inline: true },
        { name: "Branş", value: bransRol.name, inline: true },
        { name: "Yetkili", value: `<@${interaction.user.id}>`, inline: true },
        { name: "Not", value: sebep, inline: false }
      ]);

      return interaction.editReply({ embeds: [embed] });
    }

    if (cmd === "branştan-at") {
      await interaction.deferReply();

      if (!robloxGirisYapildi) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Bot şu anda Roblox'a giriş yapamamış durumda.")] });
      }

      const hedefUser = interaction.options.getUser("kullanici");
      const robloxIsim = interaction.options.getString("roblox_isim");
      const grupAdi = interaction.options.getString("grup");
      const bransRol = interaction.options.getRole("brans_rolu");
      const sebep = interaction.options.getString("sebep") || "Belirtilmedi";

      if (!grupAdi || !GRUPLAR[grupAdi]) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Geçersiz grup seçimi.")] });
      }

      const groupId = GRUPLAR[grupAdi].id;

      const interactionUserRobloxId = data.robloxBaglantilari[interaction.user.id];
      if (!interactionUserRobloxId) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(
          "❌ Önce `/yenile` komutu ile **Discord hesabınızı Roblox hesabınıza bağlamanız** gerekiyor."
        )] });
      }

      const yetkiliGrupRutbesi = await kullaniciGrupRutbesi(interactionUserRobloxId, groupId);
      if (!yetkiliGrupRutbesi || yetkiliGrupRutbesi.rank <= 1) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(
          `❌ **${grupAdi}** grubunda yetkili değilsiniz veya grupta üye değilsiniz.`
        )] });
      }

      let hedefUye = interaction.options.getMember("kullanici");
      if (!hedefUye) {
        try { hedefUye = await interaction.guild.members.fetch(hedefUser.id); } catch { hedefUye = null; }
      }
      if (!hedefUye) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Kullanıcı sunucuda bulunamadı.")] });
      }

      const robloxUserId = await roblox.getIdFromUsername(robloxIsim);
      if (!robloxUserId) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(`❌ **${robloxIsim}** adında bir Roblox kullanıcısı bulunamadı.`)] });
      }

      const hedefGrupRutbesi = await kullaniciGrupRutbesi(robloxUserId, groupId);

      if (hedefGrupRutbesi && hedefGrupRutbesi.rank >= yetkiliGrupRutbesi.rank) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(
          `❌ **${robloxIsim}** kullanıcısının mevcut rütbesi (**${hedefGrupRutbesi.name}** - Rank ${hedefGrupRutbesi.rank}), sizin rütbenizden (**${yetkiliGrupRutbesi.name}** - Rank ${yetkiliGrupRutbesi.rank}) yüksek veya eşit.\n\n` +
          `Sadece kendi rütbenizin altındaki kullanıcıları atabilirsiniz.`
        )] });
      }

      const hatalar = [];
      if (hedefUye.roles.cache.has(bransRol.id)) {
        try { await hedefUye.roles.remove(bransRol, `Branştan çıkarma — ${interaction.user.tag}: ${sebep}`); } catch (e) { hatalar.push(`Discord rol hatası: ${e.message}`); }
      }
      if (hedefGrupRutbesi) {
        try { await roblox.exile(groupId, robloxUserId); } catch (e) { hatalar.push(`Roblox gruptan atma hatası: ${e.message}`); }
      }

      const embed = new EmbedBuilder()
        .setColor(hatalar.length ? RENK.uyari : RENK.hata)
        .setTitle(hatalar.length ? "⚠️ Branştan Çıkarma (Kısmi)" : "🚫 Branştan Çıkarıldı")
        .setThumbnail(hedefUser.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: "👤 Çıkarılan", value: `<@${hedefUser.id}>`, inline: true },
          { name: "🎮 Roblox", value: robloxIsim, inline: true },
          { name: "🏛️ Grup", value: grupAdi, inline: true },
          { name: "🏅 Branş", value: `<@&${bransRol.id}>`, inline: true },
          { name: "👮 Yetkili", value: `<@${interaction.user.id}>`, inline: true },
          { name: "📝 Sebep", value: sebep, inline: false }
        )
        .setFooter({ text: "TSA Discord Bot - Branş Sistemi" })
        .setTimestamp();

      if (hatalar.length) embed.addFields({ name: "⚠️ Hatalar", value: hatalar.join("\n"), inline: false });

      await sendLogMessage(interaction.guild, "Branştan Çıkarıldı", `${hedefUser.tag} → ${robloxIsim} kullanıcısı ${bransRol.name} branşından (${grupAdi}) çıkarıldı.`, RENK.hata, [
        { name: "Discord", value: `<@${hedefUser.id}>`, inline: true },
        { name: "Roblox", value: robloxIsim, inline: true },
        { name: "Grup", value: grupAdi, inline: true },
        { name: "Branş", value: bransRol.name, inline: true },
        { name: "Yetkili", value: `<@${interaction.user.id}>`, inline: true },
        { name: "Sebep", value: sebep, inline: false }
      ]);

      return interaction.editReply({ embeds: [embed] });
    }

    if (cmd === "branş-rutbe-degistir") {
      await interaction.deferReply();

      if (!robloxGirisYapildi) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Bot şu anda Roblox'a giriş yapamamış durumda.")] });
      }

      const robloxIsim = interaction.options.getString("roblox_isim");
      const grupAdi = interaction.options.getString("grup");
      const rutbeAdi = interaction.options.getString("rutbe");
      const sebep = interaction.options.getString("sebep");

      if (!grupAdi || !GRUPLAR[grupAdi]) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Geçersiz grup seçimi.")] });
      }

      const groupId = GRUPLAR[grupAdi].id;

      const interactionUserRobloxId = data.robloxBaglantilari[interaction.user.id];
      if (!interactionUserRobloxId) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(
          "❌ Önce `/yenile` komutu ile **Discord hesabınızı Roblox hesabınıza bağlamanız** gerekiyor."
        )] });
      }

      const yetkiliGrupRutbesi = await kullaniciGrupRutbesi(interactionUserRobloxId, groupId);
      if (!yetkiliGrupRutbesi || yetkiliGrupRutbesi.rank <= 1) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(
          `❌ **${grupAdi}** grubunda yetkili değilsiniz veya grupta üye değilsiniz.`
        )] });
      }

      try {
        const userId = await roblox.getIdFromUsername(robloxIsim);
        if (!userId) {
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(`❌ **${robloxIsim}** adında bir Roblox kullanıcısı bulunamadı.`)] });
        }

        const hedefGrupRutbesi = await kullaniciGrupRutbesi(userId, groupId);
        if (!hedefGrupRutbesi) {
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(
            `❌ **${robloxIsim}** kullanıcısı **${grupAdi}** grubunda üye değil.`
          )] });
        }

        if (userId === interactionUserRobloxId) {
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(
            "❌ Kendinize rütbe değişikliği yapamazsınız."
          )] });
        }

        if (hedefGrupRutbesi.rank >= yetkiliGrupRutbesi.rank) {
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(
            `❌ **${robloxIsim}** kullanıcısının mevcut rütbesi (**${hedefGrupRutbesi.name}** - Rank ${hedefGrupRutbesi.rank}), sizin rütbenizden (**${yetkiliGrupRutbesi.name}** - Rank ${yetkiliGrupRutbesi.rank}) yüksek veya eşit.\n\n` +
            `Sadece kendi rütbenizin altındaki kullanıcılara işlem yapabilirsiniz.`
          )] });
        }

        const roller = (await getRobloxGroupRoles(groupId)).slice().sort((a, b) => a.rank - b.rank);
        const hedefRol = roller.find(r => r.name.toLocaleLowerCase("tr-TR") === rutbeAdi.toLocaleLowerCase("tr-TR"));

        if (!hedefRol) {
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(`❌ **${rutbeAdi}** adında bir rütbe bulunamadı.`)] });
        }

        if (hedefRol.rank >= yetkiliGrupRutbesi.rank) {
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(
            `❌ **${hedefRol.name}** rütbesi, sizin kendi rütbenizden (**${yetkiliGrupRutbesi.name}** - Rank ${yetkiliGrupRutbesi.rank}) yüksek veya eşit olduğu için atanamaz.\n\n` +
            `Kendi rütbenizin altındaki rütbeleri atayabilirsiniz.`
          )] });
        }

        if (hedefGrupRutbesi.rank === hedefRol.rank) {
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.uyari).setDescription(`❌ **${robloxIsim}** zaten **${hedefRol.name}** rütbesinde. Değişiklik yapılmadı.`)] });
        }

        await roblox.setRank(groupId, userId, hedefRol.rank);

        const embed = new EmbedBuilder()
          .setColor(RENK.ozel)
          .setTitle("🔄 Branş Rütbesi Değiştirildi")
          .addFields(
            { name: "👤 Roblox Kullanıcı", value: robloxIsim, inline: true },
            { name: "🏛️ Grup", value: grupAdi, inline: true },
            { name: "📤 Eski Rütbe", value: hedefGrupRutbesi.name, inline: true },
            { name: "📥 Yeni Rütbe", value: hedefRol.name, inline: true },
            { name: "📝 Sebep", value: sebep, inline: false },
            { name: "👮 İşlemi Yapan", value: `<@${interaction.user.id}>`, inline: false }
          )
          .setFooter({ text: "TSA - Turkish Special Army" })
          .setTimestamp();

        await sendLogMessage(interaction.guild, "Branş Rütbesi Değiştirildi", `${robloxIsim} kullanıcısının ${grupAdi} grubundaki rütbesi değiştirildi: ${hedefGrupRutbesi.name} → ${hedefRol.name}`, RENK.ozel, [
          { name: "Roblox Kullanıcı", value: robloxIsim, inline: true },
          { name: "Grup", value: grupAdi, inline: true },
          { name: "Sebep", value: sebep, inline: true },
          { name: "İşlemi Yapan", value: `<@${interaction.user.id}>`, inline: true }
        ]);

        return interaction.editReply({ embeds: [embed] });
      } catch (e) {
        console.error("Branş rütbe değiştirme hatası:", e);
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Rütbe değiştirilirken bir hata oluştu.")] });
      }
    }

    if (cmd === "kick") {
      await interaction.deferReply();
      const user = interaction.options.getUser("kullanici");
      const sebep = interaction.options.getString("sebep") || "Belirtilmedi";
      const member = interaction.guild.members.cache.get(user.id);

      if (!member) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Kullanıcı bulunamadı.")] });
      if (!member.kickable) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Bu kullanıcıyı atamıyorum. Rol hiyerarşisini kontrol et.")] });

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
      if (!member.bannable) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Bu kullanıcıyı yasaklayamıyorum. Rol hiyerarşisini kontrol et.")] });

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
      if (role.position >= interaction.member.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription('❌ Kendi rolünüzden veya daha yüksek bir rolü veremezsiniz.')] });
      }

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
       if (role.position >= interaction.member.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription('❌ Kendi rolünüzden veya daha yüksek bir rolü alamazsınız.')] });
      }

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
      const uyariId = data.uyari[user.id].length + 1;
      data.uyari[user.id].push({ id: uyariId, sebep, tarih: Date.now(), yetkili: interaction.user.id });
      saveData();

      const uyariSayisi = data.uyari[user.id].length;
      let rolVerildi = false;
      if (uyariSayisi === 1 && config.UYARI_1_ROL) {
        try { await member.roles.add(config.UYARI_1_ROL, "1. uyarı"); rolVerildi = true; } catch (e) {}
      } else if (uyariSayisi === 2 && config.UYARI_2_ROL) {
        try { await member.roles.add(config.UYARI_2_ROL, "2. uyarı"); rolVerildi = true; } catch (e) {}
      } else if (uyariSayisi >= 3 && config.UYARI_3_ROL) {
        try { await member.roles.add(config.UYARI_3_ROL, "3. uyarı"); rolVerildi = true; } catch (e) {}
      }

      await sendLogMessage(interaction.guild, "Uyarı Verildi", `${user.tag} kullanıcısına uyarı verildi.`, RENK.uyari, [
        { name: "Kullanıcı", value: `<@${user.id}>`, inline: true },
        { name: "Sebep", value: sebep, inline: true },
        { name: "Toplam Uyarı", value: uyariSayisi.toString(), inline: true },
        { name: "Yetkili", value: `<@${interaction.user.id}>`, inline: true }
      ]);

      const mesaj = `✅ **${user.tag}** kullanıcısına uyarı verildi. (Toplam: ${uyariSayisi})${rolVerildi ? " - Otomatik rol verildi." : ""}`;
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription(mesaj)] });
    }

    if (cmd === "uyari-sil") {
      await interaction.deferReply();
      const user = interaction.options.getUser("kullanici");
      const uyariId = interaction.options.getInteger("uyari_id");
      const member = interaction.guild.members.cache.get(user.id);

      if (!member) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Kullanıcı bulunamadı.")] });
      if (!data.uyari[user.id] || !data.uyari[user.id][uyariId - 1]) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Belirtilen uyarı bulunamadı.")] });
      }

      data.uyari[user.id].splice(uyariId - 1, 1);
      data.uyari[user.id] = data.uyari[user.id].map((u, i) => ({ ...u, id: i + 1 }));
      saveData();

      await sendLogMessage(interaction.guild, "Uyarı Silindi", `${user.tag} kullanıcısının bir uyarısı silindi.`, RENK.basari, [
        { name: "Kullanıcı", value: `<@${user.id}>`, inline: true },
        { name: "Yetkili", value: `<@${interaction.user.id}>`, inline: true }
      ]);

      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription(`✅ **${user.tag}** kullanıcısının uyarısı başarıyla silindi.`)] });
    }

    if (cmd === "uyari-liste") {
      await interaction.deferReply();
      const user = interaction.options.getUser("kullanici");

      if (!data.uyari[user.id] || data.uyari[user.id].length === 0) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.ana).setDescription(`**${user.tag}** kullanıcısının uyarı geçmişi temiz.`)] });
      }

      const uyariListe = data.uyari[user.id].map(u =>
        `**#${u.id}** - ${u.sebep} (<t:${Math.floor(u.tarih / 1000)}:D>) - Yetkili: <@${u.yetkili}>`
      ).join("\n");

      const embed = new EmbedBuilder()
        .setColor(RENK.ana)
        .setTitle(`${user.tag} Uyarı Geçmişi`)
        .setDescription(uyariListe.length > 2000 ? uyariListe.slice(0, 2000) + "..." : uyariListe)
        .setFooter({ text: `Toplam: ${data.uyari[user.id].length} uyarı` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (cmd === "sicil-temizle") {
      await interaction.deferReply();
      const user = interaction.options.getUser("kullanici");
      const member = interaction.guild.members.cache.get(user.id);

      if (!member) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Kullanıcı bulunamadı.")] });

      if (config.UYARI_1_ROL && member.roles.cache.has(config.UYARI_1_ROL)) {
        try { await member.roles.remove(config.UYARI_1_ROL); } catch (e) {}
      }
      if (config.UYARI_2_ROL && member.roles.cache.has(config.UYARI_2_ROL)) {
        try { await member.roles.remove(config.UYARI_2_ROL); } catch (e) {}
      }
      if (config.UYARI_3_ROL && member.roles.cache.has(config.UYARI_3_ROL)) {
        try { await member.roles.remove(config.UYARI_3_ROL); } catch (e) {}
      }

      data.uyari[user.id] = [];
      saveData();

      await sendLogMessage(interaction.guild, "Sicil Temizlendi", `${user.tag} kullanıcısının sicili temizlendi.`, RENK.basari, [
        { name: "Kullanıcı", value: `<@${user.id}>`, inline: true },
        { name: "Yetkili", value: `<@${interaction.user.id}>`, inline: true }
      ]);

      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription(`✅ **${user.tag}** kullanıcısının sicili başarıyla temizlendi.`)] });
    }

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
        .setFooter({ text: "TSA - Turkish Special Army" });

      if (resim) embed.setImage(resim);

      const haberKanal = interaction.guild.channels.cache.get(config.HABER_KANAL);
      if (!haberKanal) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Haber kanalı bulunamadı.")] });

      await haberKanal.send({ content: `<@&${config.HABER_ROL}>`, embeds: [embed] });
      await sendLogMessage(interaction.guild, "Haber Yapıldı", `${interaction.user.tag} tarafından haber yapıldı: ${baslik}`, RENK.basari, [
        { name: "Başlık", value: baslik, inline: true },
        { name: "Yetkili", value: `<@${interaction.user.id}>`, inline: true }
      ]);

      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription("✅ Haber başarıyla yayınlandı.")] });
    }

    if (cmd === "duyuru") {
      await interaction.deferReply();
      const mesaj = interaction.options.getString("mesaj");
      const etiket = interaction.options.getString("etiket");

      let etiketStr = "";
      if (etiket === "everyone") etiketStr = "@everyone";
      else if (etiket === "here") etiketStr = "@here";
      else if (etiket === "military_role") etiketStr = `<@&${config.ASKERI_PERSONEL_ROL}>`;

      const embed = new EmbedBuilder()
        .setColor(RENK.ana)
        .setTitle("📢 Duyuru")
        .setDescription(mesaj)
        .setTimestamp()
        .setFooter({ text: `Duyuru Yapan: ${interaction.user.tag}` });

      await interaction.channel.send({ content: etiketStr, embeds: [embed] });
      await sendLogMessage(interaction.guild, "Duyuru Yapıldı", `${interaction.user.tag} tarafından duyuru yapıldı.`, RENK.basari, [
        { name: "Etiket", value: etiket, inline: true },
        { name: "Yetkili", value: `<@${interaction.user.id}>`, inline: true }
      ]);

      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription("✅ Duyuru başarıyla yapıldı.")] });
    }

    if (cmd === "dm-mesaj") {
      await interaction.deferReply();
      const target = interaction.options.getUser("kullanici");
      const mesaj = interaction.options.getString("mesaj");

      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(RENK.ozel)
          .setTitle("📩 Mesaj")
          .setDescription(mesaj)
          .setTimestamp()
          .setFooter({ text: `Gönderen: ${interaction.user.tag}` });

        await target.send({ embeds: [dmEmbed] });
        await sendLogMessage(interaction.guild, "DM Gönderildi", `${interaction.user.tag} tarafından ${target.tag} kişisine DM gönderildi.`, RENK.ozel, [
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

      const YETKILI_DM_DUYURU_ROL_ID = "1518357617280417993";

      if (!interaction.member.roles.cache.has(YETKILI_DM_DUYURU_ROL_ID) && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Bu komutu kullanmak için yeterli yetkiniz yok!")] });
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

      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription(`✅ **${hedefRol.name}** rolündeki **${sentCount}** kullanıcıya DM duyurusu başarıyla gönderildi. **${failedCount}** kullanıcıya gönderilemedi.`)] });
    }

    if (cmd === "ses-gir") {
      await interaction.deferReply();
      const vc = interaction.member.voice.channel;
      if (!vc) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Ses kanalına katılmak için önce bir ses kanalında olmalısınız.")] });

      try {
          joinVoiceChannel({channelId: vc.id, guildId: interaction.guild.id, adapterCreator: interaction.guild.voiceAdapterCreator});
          await sendLogMessage(interaction.guild, "Ses Kanalına Girildi", `${interaction.user.tag} botu ${vc.name} kanalına soktu.`, RENK.ana, [{ name: "Kanal", value: `<#${vc.id}>`, inline: true }]);
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription(`✅ Başarıyla **${vc.name}** ses kanalına katıldım.`)] });
      } catch(e) {
          console.error(`Ses kanalına girerken hata: ${e}`);
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Ses kanalına girerken bir hata oluştu.")] });
      }
    }

    if (cmd === "ses-cik") {
      await interaction.deferReply();
      const connection = getVoiceConnection(interaction.guild.id);
      if (connection) {
        connection.destroy();
        await sendLogMessage(interaction.guild, "Ses Kanalından Çıkıldı", `${interaction.user.tag} botu ses kanalından çıkardı.`, RENK.ana);
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

      const members = voiceChannel.members.filter(m => !m.user.bot).map(member => `<@${member.id}>`).join("\n") || "Ses kanalında kimse yok.";

      const embed = new EmbedBuilder()
        .setColor(RENK.ana)
        .setTitle(`🎤 ${voiceChannel.name} Kanalı Yoklaması`)
        .setDescription(members)
        .setFooter({ text: `Toplam Üye: ${voiceChannel.members.size}` });

      await sendLogMessage(interaction.guild, "Yoklama Alındı", `${interaction.user.tag} tarafından ${voiceChannel.name} kanalında yoklama alındı.`, RENK.ana, [{ name: "Katılanlar", value: members.length > 500 ? members.slice(0, 500) + "..." : members, inline: false }]);
      return interaction.editReply({ embeds: [embed] });
    }

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
        streamInfo = { stream: akis, type: StreamType.Raw, title: bulunan.title, url: bulunan.url, guildId: interaction.guild.id };
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
        await sendLogMessage(interaction.guild, "Müzik Çalıyor", `Yeni müzik çalmaya başladı: ${currentSong.title}`, RENK.ana, [{ name: "URL", value: currentSong.url, inline: false }]);
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
        await sendLogMessage(interaction.guild, "Müzik Durduruldu", `Müzik durduruldu ve kuyruk temizlendi.`, RENK.uyari, [{ name: "İsteyen", value: `<@${interaction.user.id}>`, inline: true }]);
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.uyari).setDescription("⏹️ Müzik durduruldu ve kuyruk temizlendi.")] });
      } else {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Zaten müzik çalmıyor veya bir ses kanalında değilim.")] });
      }
    }

    if (cmd === "muzik-gec") {
      await interaction.deferReply();
      if (queue.length > 0) {
        player.stop();
        await sendLogMessage(interaction.guild, "Şarkı Geçildi", `Sıradaki şarkıya geçildi.`, RENK.ana, [{ name: "İsteyen", value: `<@${interaction.user.id}>`, inline: true }]);
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

      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.ozel).setTitle("🎶 Müzik Kuyruğu").setDescription(description.length > 1950 ? description.slice(0, 1947) + "..." : description)] });
    }

    if (cmd === "muzik-simdiki") {
      await interaction.deferReply();
      if (currentSong) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription(`▶️ Şu an çalıyor: **[${currentSong.title}](${currentSong.url})**`)] });
      } else {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Şu an hiçbir şarkı çalmıyor.")] });
      }
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
            { name: "👑 Sahibi", value: grup.owner?.username ? `@${grup.owner.username}` : "Bilinmiyor", inline: true },
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
        if (!universeId) {
            return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Bu oyun yeri için evren ID'si bulunamadı.")] });
        }
        const [oyun, icon] = await Promise.all([
          getRobloxGameInfo(universeId),
          getRobloxGameIcon(universeId)
        ]);

        if (!oyun || !oyun.name) {
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

        const profilVeri = {
          baslik: robloxUser.displayName,
          url: `https://www.roblox.com/users/${robloxUser.id}/profile`,
          avatarUrl,
          detail: userDetail,
          groups
        };
        const { embed, butonlar } = robloxProfilSayfasiOlustur(profilVeri, 0);
        const mesaj = await interaction.editReply({ embeds: [embed], components: [butonlar] });
        robloxProfilCache.set(mesaj.id, { veri: profilVeri, sayfa: 0 });
        return;
      } catch (e) {
        console.error("Roblox profil sorgulama hatası:", e);
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Roblox profil bilgisi alınırken bir hata oluştu.")] });
      }
    }

    if (cmd === "profil") {
      await interaction.deferReply();
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
        const profilVeri = {
          baslik: robloxUser.displayName || robloxUser.name,
          url: `https://www.roblox.com/users/${robloxUser.id}/profile`,
          avatarUrl,
          detail: userDetail,
          groups
        };
        const { embed, butonlar } = robloxProfilSayfasiOlustur(profilVeri, 0);
        const mesaj = await interaction.editReply({ embeds: [embed], components: [butonlar] });
        robloxProfilCache.set(mesaj.id, { veri: profilVeri, sayfa: 0 });
        return;
      } catch (e) {
        console.error("Profil komutu hatası:", e);
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Roblox profil bilgisi alınırken bir hata oluştu.")] });
      }
    }

    if (cmd === "cookie-durum") {
      await interaction.deferReply({ ephemeral: true });
      let durumMesaji;
      if (!robloxGirisYapildi) {
        durumMesaji = "❌ Roblox cookie'si geçerli değil veya süresi dolmuş. Lütfen `/cookie-yenile` komutu ile güncelleyin.";
      } else {
        const gecenSureMs = Date.now() - robloxCookieSonGecerlilik;
        const gecenSaniye = Math.floor(gecenSureMs / 1000);
        const gecenDakika = Math.floor(gecenSaniye / 60);
        const gecenSaat = Math.floor(gecenDakika / 60);
        const zamanGostergesi = gecenSaat > 0 ? `${gecenSaat} saat ` : (gecenDakika > 0 ? `${gecenDakika} dakika ` : `${gecenSaniye} saniye `);
        durumMesaji = `✅ Roblox bağlantısı aktif. Son başarılı doğrulama: Yaklaşık ${zamanGostergesi}önce.\n` +
                     `Bot, **${robloxBotAdi || 'Bilinmiyor'}** (${robloxBotUserId || 'Bilinmiyor'}) kullanıcı adıyla bağlı.`;
      }
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(robloxGirisYapildi ? RENK.basari : RENK.hata).setDescription(durumMesaji)] });
    }

    if (cmd === "cookie-yenile") {
      await interaction.deferReply({ ephemeral: true });
      const yeniCookie = interaction.options.getString("yeni_cookie");
      console.log("Yeni cookie ile giriş deneniyor...");

      const girisSonucu = await robloxGirisYap(yeniCookie);

      if (girisSonucu) {
        const kullaniciAdi = girisSonucu.UserName || girisSonucu.name || robloxBotAdi;
        const kullaniciId = girisSonucu.UserID || girisSonucu.id || robloxBotUserId;
        await interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription(
          `✅ Yeni Roblox cookie'si ile giriş yapıldı.\n` +
          `Bot, **${kullaniciAdi}** (${kullaniciId}) olarak bağlandı.\n\n` +
          `⚠️ **ÖNEMLİ:** Render'daki \`ROBLOX_COOKIE\` ortam değişkenini de güncelle, aksi hâlde yeniden başlatmada eski cookie geçerli olur.`
        )] });
      } else {
        await interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription(
          "❌ Yeni Roblox cookie'si ile giriş yapılamadı. Cookie'nin geçerli olduğundan emin ol ve konsol loglarını kontrol et."
        )] });
      }
      return;
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

      if (!member) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Kullanıcı bulunamadı veya sunucuda değil.")] });

      const roles = member.roles.cache
        .filter(role => role.id !== interaction.guild.id)
        .sort((a, b) => b.position - a.position)
        .map(role => `<@&${role.id}>`)
        .join(", ") || "Rol bulunmuyor.";

      const embed = new EmbedBuilder()
        .setColor(member.displayColor || RENK.ana)
        .setTitle(`${user.tag} Kullanıcı Bilgileri`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
          { name: "🆔 Kullanıcı ID", value: user.id, inline: true },
          { name: "🗓️ Sunucuya Katılma Tarihi", value: `<t:${parseInt(member.joinedTimestamp / 1000)}:D>`, inline: true },
          { name: "🗓️ Hesap Oluşturma Tarihi", value: `<t:${parseInt(user.createdTimestamp / 1000)}:D>`, inline: true },
          { name: `💎 Roller (${member.roles.cache.filter(role => role.id !== interaction.guild.id).size})`, value: roles.length > 1000 ? roles.slice(0, 1000) + "..." : roles, inline: false }
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
          { name: "🎨 Renk Kodu", value: role.hexColor, inline: true },
          { name: "🗓️ Oluşturulma Tarihi", value: `<t:${parseInt(role.createdTimestamp / 1000)}:D>`, inline: true },
          { name: "⬆️ Ayrı Gösteriliyor mu?", value: role.hoist ? "✅ Evet" : "❌ Hayır", inline: true },
          { name: "📣 Bahsedilebilir mi?", value: role.mentionable ? "✅ Evet" : "❌ Hayır", inline: true }
        )
        .setFooter({ text: "TSA Discord Bot" })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
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

    if (cmd === "rutbeler") {
      await interaction.deferReply();

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

    if (cmd === "aktiflik-denetleme") {
      await interaction.deferReply();
      const rol = interaction.options.getRole("rol");
      const uyeler = rol.members;
      if (uyeler.size === 0) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.uyari).setDescription(`**${rol.name}** rolünde hiç üye bulunmuyor.`)] });
      }

      let aktif = 0, inaktif = 0;
      const liste = [];
      for (const [id, member] of uyeler) {
        const mesajSayisi = data.aktiflik[id] || 0;
        if (mesajSayisi > 0) aktif++; else inaktif++;
        liste.push(`<@${id}>: **${mesajSayisi}** mesaj`);
      }

      const embed = new EmbedBuilder()
        .setColor(RENK.ana)
        .setTitle(`📊 Aktiflik Denetleme: ${rol.name}`)
        .setDescription(`**Aktif:** ${aktif} | **İnaktif:** ${inaktif}`)
        .addFields({ name: "Üyeler", value: liste.join("\n").slice(0, 1000) || "Liste boş.", inline: false })
        .setFooter({ text: "TSA Discord Bot" })
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    if (cmd === "izin-al") {
      await interaction.deferReply();
      const sebep = interaction.options.getString("sebep");
      const bitis = interaction.options.getString("bitis");

      if (!data.izin[interaction.user.id]) data.izin[interaction.user.id] = [];
      data.izin[interaction.user.id].push({ sebep, bitis: bitis || null, baslangic: Date.now() });
      saveData();

      const embed = new EmbedBuilder()
        .setColor(RENK.basari)
        .setTitle("✅ İzin Alındı")
        .setDescription(`${sebep} sebebiyle izin alındı.${bitis ? ` Bitiş tarihi: ${bitis}` : ""}`)
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (cmd === "izin-bitir") {
      await interaction.deferReply();
      if (!data.izin[interaction.user.id] || data.izin[interaction.user.id].length === 0) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("Aktif izniniz bulunmuyor.")] });
      }

      data.izin[interaction.user.id] = data.izin[interaction.user.id].filter(i => i.bitis && new Date(i.bitis) > new Date());
      saveData();

      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.basari).setDescription("✅ İzniniz sonlandırıldı.")] });
    }

    if (cmd === "izin-listesi") {
      await interaction.deferReply();
      const izinler = Object.entries(data.izin).filter(([_, izinListesi]) => izinListesi.some(i => !i.bitis || new Date(i.bitis) > new Date()));

      if (izinler.length === 0) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(RENK.ana).setDescription("Şu anda izinli kullanıcı bulunmuyor.")] });
      }

      const liste = izinler.map(([userId, izinListesi]) => {
        const aktifIzin = izinListesi.find(i => !i.bitis || new Date(i.bitis) > new Date());
        return `<@${userId}>: ${aktifIzin.sebep}${aktifIzin.bitis ? ` (${aktifIzin.bitis})` : ""}`;
      }).join("\n");

      const embed = new EmbedBuilder()
        .setColor(RENK.ana)
        .setTitle("📋 İzinli Kullanıcılar")
        .setDescription(liste.length > 2000 ? liste.slice(0, 2000) + "..." : liste)
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    return interaction.reply({ embeds: [new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Bu komutun işleyicisi bulunamadı.")], ephemeral: true });

  } catch (error) {
    console.error("interactionCreate hatası:", error);
    const hataEmbed = new EmbedBuilder().setColor(RENK.hata).setDescription("❌ Komut çalıştırılırken beklenmedik bir hata oluştu.");
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ embeds: [hataEmbed] }).catch(() => {});
    } else {
      await interaction.reply({ embeds: [hataEmbed], ephemeral: true }).catch(() => {});
    }
  }
});

client.on("error", (error) => {
  console.error("Discord client hatası (yakalandı, bot çalışmaya devam ediyor):", error.message);
});

process.on("unhandledRejection", (reason) => {
  if (reason?.code === 10062 || reason?.message?.includes("Unknown interaction")) return;
  console.error("Yakalanmamış Promise reddi:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Yakalanmamış hata:", error.message);
  process.exit(1);
});

client.login(config.TOKEN);
