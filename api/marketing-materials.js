const crypto = require("crypto");
const {
  SUPABASE_URL,
  send,
  handleError,
  requireUser,
  db
} = require("./_lib");

const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET = process.env.SUPABASE_MARKETING_BUCKET || "marketing-materials";

module.exports = async function handler(req, res) {
  try {
    const user = await requireUser(req);
    if (req.method === "GET") {
      const rows = await db(
        "marketing_materials?select=*&order=created_at.desc&limit=100"
      );
      return send(res, 200, rows);
    }
    if (req.method !== "POST") {
      const error = new Error("请求方式不支持");
      error.statusCode = 405;
      throw error;
    }

    const body = req.body || {};
    const materialType = ["photo", "video", "text"].includes(body.materialType)
      ? body.materialType
      : "text";
    let fileUrl = null;
    if (body.fileData) {
      fileUrl = await uploadMaterial({
        fileData: body.fileData,
        fileName: body.fileName,
        fileType: body.fileType,
        userId: user.id
      });
    }
    if (!fileUrl && !String(body.originalText || "").trim()) {
      const error = new Error("请上传照片、视频，或填写素材文字");
      error.statusCode = 400;
      throw error;
    }

    const consentStatus = body.consentConfirmed ? "granted" : "unverified";
    const privacyStatus = body.consentConfirmed ? "passed" : "pending";
    const rows = await db("marketing_materials", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        child_id: body.childId || null,
        material_type: materialType,
        file_url: fileUrl,
        original_text: String(body.originalText || "").trim(),
        activity_name: String(body.activityName || "").trim(),
        course_category: String(body.courseCategory || "").trim(),
        campus: String(body.campus || "").trim(),
        captured_at: body.capturedAt || new Date().toISOString(),
        uploaded_by: user.id,
        consent_status: consentStatus,
        privacy_status: privacyStatus,
        ai_tags: buildTags(body)
      })
    });
    send(res, 201, rows[0]);
  } catch (error) {
    handleError(res, error);
  }
};

function buildTags(body) {
  return [body.activityName, body.courseCategory, body.campus]
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

async function uploadMaterial({ fileData, fileName, fileType, userId }) {
  const match = String(fileData).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    const error = new Error("素材文件格式错误");
    error.statusCode = 400;
    throw error;
  }
  const binary = Buffer.from(match[2], "base64");
  if (binary.length > 12 * 1024 * 1024) {
    const error = new Error("当前网页单个素材不能超过 12MB");
    error.statusCode = 413;
    throw error;
  }
  const extension = safeExtension(fileName, fileType);
  const objectPath = `${userId}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(BUCKET)}/${objectPath}`,
    {
      method: "POST",
      headers: {
        apikey: SECRET_KEY,
        ...(String(SECRET_KEY).startsWith("eyJ")
          ? { Authorization: `Bearer ${SECRET_KEY}` }
          : {}),
        "Content-Type": fileType || match[1],
        "x-upsert": "false"
      },
      body: binary
    }
  );
  if (!response.ok) throw new Error(`素材上传失败：${await response.text()}`);
  return `${SUPABASE_URL}/storage/v1/object/authenticated/${BUCKET}/${objectPath}`;
}

function safeExtension(fileName = "", fileType = "") {
  const match = String(fileName).toLowerCase().match(/\.([a-z0-9]+)$/);
  if (match && ["jpg", "jpeg", "png", "webp", "gif", "mp4", "mov", "webm"].includes(match[1])) {
    return match[1];
  }
  if (String(fileType).includes("video")) return "mp4";
  if (String(fileType).includes("png")) return "png";
  return "jpg";
}
