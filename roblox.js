/**
 * Roblox soyutlama katmanı.
 * ROBLOX_PROXY_URL varsa → Replit API proxy üzerinden çalışır (Render için).
 * Yoksa → noblox.js doğrudan kullanılır (Replit'te lokal).
 */

const PROXY_URL = process.env.ROBLOX_PROXY_URL;   // örn: https://xxx.replit.dev/api/roblox
const PROXY_SECRET = process.env.ROBLOX_PROXY_SECRET;

let _noblox = null;
if (!PROXY_URL) {
  _noblox = require("noblox.js");
}

const WARNING_PREFIX =
  "_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-into-your-account-and-steal-your-ROBUX-and-items.|_";

let _isLoggedIn = false;
let _botUserId = null;
let _botUserName = null;

// ---- Proxy yardımcıları ----

async function proxyGet(path) {
  const res = await fetch(`${PROXY_URL}${path}`, {
    headers: { "x-proxy-secret": PROXY_SECRET },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Proxy HTTP ${res.status}`);
  return data;
}

async function proxyPost(path, body) {
  const res = await fetch(`${PROXY_URL}${path}`, {
    method: "POST",
    headers: {
      "x-proxy-secret": PROXY_SECRET,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Proxy HTTP ${res.status}`);
  return data;
}

// ---- Public API ----

/**
 * Proxy modunda: /status endpoint'ini sorgular (bot açılışında).
 * Direkt modda: kullanılmaz.
 */
async function checkStatus() {
  const data = await proxyGet("/status");
  _isLoggedIn = data.isLoggedIn;
  _botUserId = data.botUserId;
  _botUserName = data.botUserName;
  return data;
}

/**
 * Proxy modunda: proxy'e yeni cookie gönderir (/cookie-yenile komutu için).
 * Direkt modda: kullanılmaz — directLogin kullan.
 */
async function updateCookieOnProxy(cookie) {
  const data = await proxyPost("/login", { cookie });
  _isLoggedIn = !!data.success;
  _botUserId = data.botUserId ?? null;
  _botUserName = data.botUserName ?? null;
  if (!data.success) throw new Error("Proxy login başarısız");
  return {
    UserID: _botUserId,
    UserName: _botUserName,
    id: _botUserId,
    name: _botUserName,
  };
}

/**
 * Direkt mod (Replit'te lokal): noblox.js ile doğrudan giriş.
 */
async function directLogin(cookie) {
  let c = cookie.trim().replace(/^["']|["']$/g, "");
  if (!c.startsWith("_|WARNING:")) {
    console.log("ℹ️ Cookie'ye WARNING prefix otomatik ekleniyor...");
    c = WARNING_PREFIX + c;
  }
  const user = await _noblox.setCookie(c);
  _isLoggedIn = true;
  _botUserId = user.UserID ?? user.id ?? null;
  _botUserName = user.UserName ?? user.name ?? null;
  return user;
}

async function getRankInGroup(groupId, userId) {
  if (PROXY_URL) {
    const data = await proxyGet(`/rank?groupId=${groupId}&userId=${userId}`);
    return data.rank;
  }
  return _noblox.getRankInGroup(groupId, userId);
}

async function getRankNameInGroup(groupId, userId) {
  if (PROXY_URL) {
    const data = await proxyGet(`/rankname?groupId=${groupId}&userId=${userId}`);
    return data.rankName;
  }
  return _noblox.getRankNameInGroup(groupId, userId);
}

async function setRank(groupId, userId, rank) {
  if (PROXY_URL) {
    return proxyPost("/setrank", { groupId, userId, rank });
  }
  return _noblox.setRank(groupId, userId, rank);
}

async function getIdFromUsername(username) {
  if (PROXY_URL) {
    const data = await proxyGet(`/userid?username=${encodeURIComponent(username)}`);
    return data.userId;
  }
  return _noblox.getIdFromUsername(username);
}

/** Bot'un kendi grubundaki rütbesini döner: { rank, rankName } */
async function getBotRank(groupId) {
  if (PROXY_URL) {
    return proxyGet(`/botrank?groupId=${groupId}`);
  }
  if (!_botUserId) return null;
  const rank = await _noblox.getRankInGroup(groupId, _botUserId);
  return { rank };
}

module.exports = {
  get isLoggedIn() { return _isLoggedIn; },
  get botUserId() { return _botUserId; },
  get botUserName() { return _botUserName; },
  get isProxyMode() { return !!PROXY_URL; },
  checkStatus,
  updateCookieOnProxy,
  directLogin,
  getRankInGroup,
  getRankNameInGroup,
  setRank,
  getIdFromUsername,
  getBotRank,
};
