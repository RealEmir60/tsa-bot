// ==================== ROBLOX.JS ====================
// Tek ve basit cookie-login sistemi. Proxy modu KALDIRILDI — kafa karışıklığı
// ve çifte hata kaynağı yaratıyordu. Artık sadece bu dosya, doğrudan
// .ROBLOSECURITY cookie'si ile Roblox'a bağlanıyor.

const ROBLOX_WARNING_PREFIX =
  "_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-into-your-account-and-steal-your-ROBUX-and-items.|_";

// ---- İç durum ----
let currentCookie = null;
let csrfToken = null;
let botUserId = null;
let botUserName = null;

// Artık proxy modu yok, index.js bu bayrağı okuyup dallanıyor — hep false.
const isProxyMode = false;

// ---- Cookie temizleme ----
// Kullanıcı .env'e sadece asıl değeri yapıştırmışsa (WARNING prefix'siz),
// bunu otomatik ekliyoruz. Baştaki/sondaki tırnak ve boşlukları da temizliyoruz.
function cookieTemizle(cookie) {
  if (!cookie) return cookie;
  let c = String(cookie).trim().replace(/^["']|["']$/g, "").trim();
  if (!c.startsWith("_|WARNING:")) {
    c = ROBLOX_WARNING_PREFIX + c;
  }
  return c;
}

// ---- CSRF-aware fetch ----
// Roblox, POST/PATCH/DELETE isteklerinde X-CSRF-TOKEN header'ı ister.
// Token yoksa/geçersizse Roblox 403 döner ve doğru token'ı response
// header'ında verir — biz de o token ile isteği otomatik tekrar ediyoruz.
async function robloxFetch(url, options = {}) {
  if (!currentCookie) {
    throw new Error("Bot Roblox'a giriş yapmamış (cookie ayarlanmamış). Önce directLogin çağrılmalı.");
  }

  options.headers = { ...(options.headers || {}) };
  options.headers["Cookie"] = `.ROBLOSECURITY=${currentCookie}`;

  const method = (options.method || "GET").toUpperCase();
  if (["POST", "PATCH", "DELETE", "PUT"].includes(method) && csrfToken) {
    options.headers["X-CSRF-TOKEN"] = csrfToken;
  }

  let res = await fetch(url, options);

  if (res.status === 403) {
    const yeniToken = res.headers.get("x-csrf-token");
    if (yeniToken && yeniToken !== csrfToken) {
      csrfToken = yeniToken;
      options.headers["X-CSRF-TOKEN"] = csrfToken;
      res = await fetch(url, options);
    }
  }

  return res;
}

// ---- Giriş ----
// Cookie'yi doğrular (Roblox'un authenticated-user endpoint'ine istek atar).
// Başarılıysa botUserId / botUserName set edilir. Başarısızsa AÇIKLAYICI
// bir hata fırlatır (401 mi, cookie formatı mı, ağ hatası mı vs. ayırt eder).
async function directLogin(cookie) {
  const temizCookie = cookieTemizle(cookie);

  let res;
  try {
    res = await fetch("https://users.roblox.com/v1/users/authenticated", {
      headers: { Cookie: `.ROBLOSECURITY=${temizCookie}` }
    });
  } catch (e) {
    throw new Error(`Roblox'a bağlanılamadı (ağ hatası): ${e.message}`);
  }

  if (res.status === 401) {
    throw new Error(
      "Cookie geçersiz veya süresi dolmuş (401 Unauthorized). " +
      "Tarayıcında Roblox'a giriş yap, F12 → Application → Cookies → " +
      ".ROBLOSECURITY değerinin TAMAMINI kopyala ve .env'e yapıştır."
    );
  }

  if (!res.ok) {
    const govde = await res.text().catch(() => "");
    throw new Error(`Roblox giriş kontrolü başarısız: ${res.status} ${govde}`);
  }

  const json = await res.json();
  if (!json || !json.id) {
    throw new Error("Roblox'tan beklenmeyen bir yanıt geldi (kullanıcı bilgisi bulunamadı).");
  }

  // Doğrulama başarılı — durumu güncelle.
  currentCookie = temizCookie;
  csrfToken = null; // yeni oturum, eski token'ı sıfırla (ilk POST'ta otomatik alınacak)
  botUserId = json.id;
  botUserName = json.name;

  return { id: botUserId, name: botUserName, UserID: botUserId, UserName: botUserName };
}

// ---- Kullanıcı adından ID bulma ----
async function getIdFromUsername(username) {
  const res = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
  });
  if (!res.ok) throw new Error(`Kullanıcı adı araması başarısız: ${res.status}`);
  const json = await res.json();
  return json.data?.[0]?.id || null;
}

// ---- Gruptaki rütbe (rank numarası) ----
async function getRankInGroup(groupId, userId) {
  const res = await fetch(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
  if (!res.ok) throw new Error(`Rütbe bilgisi alınamadı: ${res.status}`);
  const json = await res.json();
  const grup = (json.data || []).find(g => g.group.id.toString() === groupId.toString());
  return grup ? grup.role.rank : 0;
}

// ---- Gruptaki rütbe adı ----
async function getRankNameInGroup(groupId, userId) {
  const res = await fetch(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
  if (!res.ok) throw new Error(`Rütbe bilgisi alınamadı: ${res.status}`);
  const json = await res.json();
  const grup = (json.data || []).find(g => g.group.id.toString() === groupId.toString());
  return grup ? grup.role.name : null;
}

// ---- Bot kendi rütbesi (rank + roleId önbelleksiz canlı) ----
// index.js bunu "roblox.getBotRank" olarak DEĞİL, doğrudan getRankInGroup
// üzerinden çağırıyor (proxy modu kapalı olduğu için). Yine de dursun,
// ileride proxy'e dönmek istenirse hazır olur.
async function getBotRank(groupId) {
  if (!botUserId) return null;
  const rank = await getRankInGroup(groupId, botUserId);
  return { rank };
}

// ---- Rütbe ayarlama ----
async function setRank(groupId, userId, rank) {
  const rolesRes = await fetch(`https://groups.roblox.com/v1/groups/${groupId}/roles`);
  if (!rolesRes.ok) throw new Error(`Grup rütbeleri alınamadı: ${rolesRes.status}`);
  const rolesJson = await rolesRes.json();
  const hedefRol = (rolesJson.roles || []).find(r => r.rank === rank);
  if (!hedefRol) throw new Error(`Grup içinde rank ${rank} eşleşen bir rütbe bulunamadı.`);

  const res = await robloxFetch(`https://groups.roblox.com/v1/groups/${groupId}/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roleId: hedefRol.id })
  });

  if (!res.ok) {
    const govde = await res.text().catch(() => "");
    throw new Error(`Rütbe ayarlanamadı: ${res.status} ${govde}`);
  }
  return true;
}

// ---- Gruptan atma ----
async function exile(groupId, userId) {
  const res = await robloxFetch(`https://groups.roblox.com/v1/groups/${groupId}/users/${userId}`, {
    method: "DELETE"
  });

  if (!res.ok) {
    const govde = await res.text().catch(() => "");
    throw new Error(`Kullanıcı gruptan atılamadı: ${res.status} ${govde}`);
  }
  return true;
}

module.exports = {
  directLogin,
  getIdFromUsername,
  getRankInGroup,
  getRankNameInGroup,
  getBotRank,
  setRank,
  exile,
  isProxyMode,
  get botUserId() {
    return botUserId;
  },
  get botUserName() {
    return botUserName;
  }
};
