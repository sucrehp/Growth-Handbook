const crypto = require("crypto");

const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET = "parent-uploads";
const CHILD_QUOTA_BYTES = 20 * 1024 * 1024;
const MAX_FILES = 3;
const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
const MIME_LIMITS = {
  "image/jpeg": 1024 * 1024,
  "image/png": 1024 * 1024,
  "image/webp": 1024 * 1024
};

function send(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function configured() {
  if (!SUPABASE_URL || !SECRET_KEY) throw fail("服务端媒体存储尚未配置", 503);
}

function serviceHeaders(extra = {}) {
  return {
    apikey: SECRET_KEY,
    ...(SECRET_KEY.startsWith("eyJ") ? { Authorization: `Bearer ${SECRET_KEY}` } : {}),
    ...extra
  };
}

async function rest(endpoint, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    ...options,
    headers: serviceHeaders({ "Content-Type": "application/json", ...(options.headers || {}) })
  });
  if (!response.ok) throw fail("成长记录校验失败", 400);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function decodeImage(file) {
  const mimeType = String(file.mimeType || "").toLowerCase();
  if (!MIME_LIMITS[mimeType]) throw fail("仅支持 JPEG、PNG 或 WEBP 图片");
  const sourceSize = Number(file.sourceSize);
  if (!Number.isFinite(sourceSize) || sourceSize <= 0 || sourceSize > MAX_SOURCE_BYTES) {
    throw fail("原始图片不能超过 5MB");
  }
  const match = String(file.dataUrl || "").match(/^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=]+)$/i);
  if (!match || match[1].toLowerCase() !== mimeType) throw fail("图片编码或格式无效");
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > MIME_LIMITS[mimeType]) throw fail("压缩后的单张图片不能超过 1MB");
  if (!matchesSignature(bytes, mimeType)) throw fail("图片内容与格式不一致");
  return { bytes, mimeType, kind: file.kind === "certificate" ? "certificate" : "image", sourceSize };
}

function matchesSignature(bytes, mimeType) {
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  return bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
}

function extensionFor(mimeType) {
  return mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
}

async function getChildByToken(token) {
  const rows = await rest(`children?select=id&share_token=eq.${encodeURIComponent(token)}&limit=1`);
  if (!rows.length) throw fail("分享链接无效", 403);
  return rows[0];
}

async function getPendingContribution(childId, contributionId) {
  const encodedId = encodeURIComponent(contributionId);
  const encodedChild = encodeURIComponent(childId);
  const [metadata, uploads] = await Promise.all([
    rest(`parent_contribution_metadata?select=parent_upload_id,child_id,evidence&parent_upload_id=eq.${encodedId}&child_id=eq.${encodedChild}&limit=1`),
    rest(`parent_uploads?select=id,child_id,photo_urls,audit_status,visible_in_handbook&id=eq.${encodedId}&child_id=eq.${encodedChild}&limit=1`)
  ]);
  if (!metadata.length || !uploads.length || uploads[0].audit_status !== "pending" || uploads[0].visible_in_handbook) {
    throw fail("只能为当前孩子的待审核记录补充图片", 403);
  }
  return { metadata: metadata[0], upload: uploads[0] };
}

async function storageUsage(childId) {
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers: serviceHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ prefix: `${childId}/`, limit: 1000, offset: 0, sortBy: { column: "name", order: "asc" } })
  });
  if (!response.ok) throw fail("无法检查媒体存储配额", 503);
  const objects = await response.json();
  return objects.reduce((total, object) => total + Number(object.metadata?.size || 0), 0);
}

async function uploadObject(path, image) {
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: serviceHeaders({ "Content-Type": image.mimeType, "x-upsert": "false" }),
    body: image.bytes
  });
  if (!response.ok) throw fail("图片上传失败", 503);
}

async function removeObject(path) {
  await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "DELETE",
    headers: serviceHeaders()
  }).catch(() => null);
}

async function patchRows(table, id, payload) {
  return rest(`${table}?${table === "parent_contribution_metadata" ? "parent_upload_id" : "id"}=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload)
  });
}

module.exports = async function handler(req, res) {
  const uploadedPaths = [];
  let previousEvidence = [];
  let previousPhotoUrls = [];
  let contributionId = "";
  try {
    if (req.method !== "POST") throw fail("请求方式不支持", 405);
    configured();
    const body = req.body || {};
    const token = String(body.token || "").trim();
    contributionId = String(body.contributionId || "").trim();
    if (!token || !/^[0-9a-f-]{36}$/i.test(contributionId)) throw fail("缺少有效的分享令牌或记录编号");
    if (!Array.isArray(body.files) || !body.files.length || body.files.length > MAX_FILES) {
      throw fail("每条成长记录最多上传 3 张图片");
    }
    const images = body.files.map(decodeImage);
    const child = await getChildByToken(token);
    const contribution = await getPendingContribution(child.id, contributionId);
    previousEvidence = Array.isArray(contribution.metadata.evidence) ? contribution.metadata.evidence : [];
    previousPhotoUrls = Array.isArray(contribution.upload.photo_urls) ? contribution.upload.photo_urls : [];
    if (previousEvidence.length + images.length > MAX_FILES) throw fail("每条成长记录最多保留 3 张图片");

    const incomingBytes = images.reduce((sum, image) => sum + image.bytes.length, 0);
    const usedBytes = await storageUsage(child.id);
    if (usedBytes + incomingBytes > CHILD_QUOTA_BYTES) throw fail("该成长档案的家长图片空间已达到 20MB 上限", 413);

    const evidence = [...previousEvidence];
    for (const image of images) {
      const path = `${child.id}/${contributionId}/${crypto.randomUUID()}.${extensionFor(image.mimeType)}`;
      await uploadObject(path, image);
      uploadedPaths.push(path);
      evidence.push({ path, mime_type: image.mimeType, size: image.bytes.length, kind: image.kind });
    }

    await patchRows("parent_contribution_metadata", contributionId, { evidence });
    await patchRows("parent_uploads", contributionId, { photo_urls: evidence.map(item => item.path) });
    send(res, 201, { uploaded: uploadedPaths.length, status: "PENDING_REVIEW" });
  } catch (error) {
    if (uploadedPaths.length) {
      await Promise.all(uploadedPaths.map(removeObject));
      if (contributionId) {
        await patchRows("parent_contribution_metadata", contributionId, { evidence: previousEvidence }).catch(() => null);
        await patchRows("parent_uploads", contributionId, { photo_urls: previousPhotoUrls }).catch(() => null);
      }
    }
    console.error(error);
    send(res, error.statusCode || 500, { error: error.message || "媒体上传失败" });
  }
};

