const crypto = require("crypto");

const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "";
const PHOTO_BUCKET = process.env.SUPABASE_PHOTOS_BUCKET || "photos";

function assertConfigured() {
  if (!SUPABASE_URL || !SECRET_KEY) {
    const error = new Error("服务端尚未完成 Supabase 配置");
    error.statusCode = 503;
    throw error;
  }
}

function send(res, status, data) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function handleError(res, error) {
  console.error(error);
  send(res, error.statusCode || 500, { error: error.message || "服务器错误" });
}

function requireMethod(req, method) {
  if (req.method !== method) {
    const error = new Error("请求方式不支持");
    error.statusCode = 405;
    throw error;
  }
}

async function requireUser(req) {
  assertConfigured();
  const authorization = req.headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) {
    const error = new Error("请先使用管理员账号登录");
    error.statusCode = 401;
    throw error;
  }
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SECRET_KEY, Authorization: authorization }
  });
  if (!response.ok) {
    const error = new Error("登录已过期，请重新登录");
    error.statusCode = 401;
    throw error;
  }
  return response.json();
}

async function db(endpoint, options = {}) {
  assertConfigured();
  const headers = {
    apikey: SECRET_KEY,
    "Content-Type": "application/json",
    ...(isLegacyJwt(SECRET_KEY) ? { Authorization: `Bearer ${SECRET_KEY}` } : {}),
    ...(options.headers || {})
  };
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, { ...options, headers });
  if (!response.ok) throw new Error(`数据库请求失败：${await response.text()}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function uploadPhoto({ childId, fileData, fileName, fileType }) {
  const binary = dataUrlToBuffer(fileData);
  if (binary.length > 10 * 1024 * 1024) {
    const error = new Error("照片不能超过 10MB");
    error.statusCode = 413;
    throw error;
  }
  const extension = safeExtension(fileName, fileType);
  const objectPath = `${childId}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(PHOTO_BUCKET)}/${objectPath}`,
    {
      method: "POST",
      headers: {
        apikey: SECRET_KEY,
        ...(isLegacyJwt(SECRET_KEY) ? { Authorization: `Bearer ${SECRET_KEY}` } : {}),
        "Content-Type": fileType || "image/jpeg",
        "x-upsert": "false"
      },
      body: binary
    }
  );
  if (!response.ok) throw new Error(`照片上传失败：${await response.text()}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/${objectPath}`;
}

function dataUrlToBuffer(dataUrl) {
  const match = String(dataUrl || "").match(/^data:[^;]+;base64,(.+)$/);
  if (!match) {
    const error = new Error("照片格式错误");
    error.statusCode = 400;
    throw error;
  }
  return Buffer.from(match[1], "base64");
}

function safeExtension(fileName = "", fileType = "") {
  const match = String(fileName).toLowerCase().match(/\.([a-z0-9]+)$/);
  if (match && ["jpg", "jpeg", "png", "webp", "gif"].includes(match[1])) return match[1];
  return String(fileType).includes("png") ? "png" : String(fileType).includes("webp") ? "webp" : "jpg";
}

function normalizeCategory(value) {
  return ["课堂风采", "作品展示", "活动记录", "日常瞬间", "其他"].includes(value)
    ? value
    : "课堂风采";
}

function isLegacyJwt(value) {
  return String(value || "").startsWith("eyJ");
}

module.exports = {
  SUPABASE_URL,
  PUBLISHABLE_KEY,
  send,
  handleError,
  requireMethod,
  requireUser,
  db,
  uploadPhoto,
  normalizeCategory
};
