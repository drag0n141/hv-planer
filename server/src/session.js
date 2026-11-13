import crypto from "node:crypto";

/**
 * Zustandslose, HMAC-signierte Cookies. Jeder Cookie trägt einen Typ ("t"),
 * damit ein Login-Cookie nie als Session-Cookie durchgeht (und umgekehrt).
 */

const mac = (body, secret) => crypto.createHmac("sha256", secret).update(body).digest();

export function sign(obj, secret) {
  const body = Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${body}.${mac(body, secret).toString("base64url")}`;
}

export function verify(token, secret, expectedType) {
  if (typeof token !== "string" || !secret) return null;
  const i = token.lastIndexOf(".");
  if (i < 1) return null;
  const body = token.slice(0, i);
  const given = Buffer.from(token.slice(i + 1), "base64url");
  const want = mac(body, secret);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) return null;
  let obj;
  try {
    obj = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  if (expectedType && obj.t !== expectedType) return null;
  if (typeof obj.exp !== "number" || obj.exp < Date.now() / 1000) return null;
  return obj;
}

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(";")) {
    const idx = part.indexOf("=");
    if (idx < 1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

export function setCookie(res, name, value, { maxAge, path = "/", secure = false } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, "HttpOnly", "SameSite=Lax"];
  if (maxAge != null) parts.push(`Max-Age=${Math.max(0, Math.floor(maxAge))}`);
  if (secure) parts.push("Secure");
  res.append("Set-Cookie", parts.join("; "));
}

export function clearCookie(res, name, { path = "/", secure = false } = {}) {
  setCookie(res, name, "", { maxAge: 0, path, secure });
}
