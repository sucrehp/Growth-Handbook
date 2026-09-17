const {
  send,
  handleError,
  requireStaff,
  authAdmin,
  inviteAuthUser,
  db
} = require("../../api/_lib");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function booleanValue(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function parentRedirectUrl() {
  const configured = String(process.env.PARENT_APP_URL || "").trim().replace(/\/$/, "");
  if (configured) return configured;
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelHost) return `https://${String(vercelHost).replace(/^https?:\/\//, "").replace(/\/$/, "")}/parent`;
  throw fail("尚未配置家长邀请回调地址 PARENT_APP_URL", 503);
}

async function authUsersById() {
  const payload = await authAdmin("users?page=1&per_page=1000");
  const users = Array.isArray(payload?.users) ? payload.users : Array.isArray(payload) ? payload : [];
  return new Map(users.map((item) => [item.id, item]));
}

async function findAuthUser(email) {
  const users = await authUsersById();
  return [...users.values()].find((item) => normalizeEmail(item.email) === email) || null;
}

async function assertChild(childId) {
  if (!UUID_PATTERN.test(childId)) throw fail("孩子编号无效");
  const rows = await db(`children?select=id,name&id=eq.${encodeURIComponent(childId)}&limit=1`);
  if (!rows.length) throw fail("孩子记录不存在", 404);
  return rows[0];
}

async function assertNotStaff(userId) {
  const rows = await db(`staff_profiles?select=id,status&id=eq.${encodeURIComponent(userId)}&status=eq.active&limit=1`);
  if (rows.length) throw fail("机构员工账号不能同时绑定为家长账号", 409);
}

async function listBindings(childId) {
  const rows = await db(
    `parent_accounts?select=id,user_id,child_id,relation,is_primary,can_edit_basic,can_reply_comments,can_upload_growth,status,created_at&child_id=eq.${encodeURIComponent(childId)}&order=created_at.asc`
  );
  const users = await authUsersById();
  return rows.map((row) => ({
    ...row,
    email: normalizeEmail(users.get(row.user_id)?.email) || "账号邮箱不可用"
  }));
}

async function createBinding(req, res, staff) {
  const body = req.body || {};
  const childId = String(body.childId || "").trim();
  const email = normalizeEmail(body.email);
  const relation = String(body.relation || "家长").trim().slice(0, 24) || "家长";
  await assertChild(childId);
  if (!EMAIL_PATTERN.test(email)) throw fail("请输入有效的家长邮箱");

  let authUser = await findAuthUser(email);
  let invitationSent = false;
  if (!authUser) {
    authUser = await inviteAuthUser(email, parentRedirectUrl());
    authUser = authUser?.user || authUser;
    invitationSent = true;
  }
  if (!UUID_PATTERN.test(String(authUser?.id || ""))) throw fail("家长账号创建失败", 503);
  await assertNotStaff(authUser.id);

  const payload = {
    user_id: authUser.id,
    child_id: childId,
    relation,
    is_primary: booleanValue(body.isPrimary),
    can_edit_basic: false,
    can_reply_comments: booleanValue(body.canReplyComments, true),
    can_upload_growth: booleanValue(body.canUploadGrowth, true),
    status: "active",
    granted_by: staff.id
  };
  const rows = await db("parent_accounts?on_conflict=user_id,child_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(payload)
  });
  send(res, 200, { binding: rows[0], email, invitationSent });
}

async function updateBinding(req, res, staff) {
  const body = req.body || {};
  const bindingId = String(body.bindingId || "").trim();
  const childId = String(body.childId || "").trim();
  if (!UUID_PATTERN.test(bindingId)) throw fail("绑定编号无效");
  await assertChild(childId);
  const before = await db(
    `parent_accounts?select=id,user_id,child_id&id=eq.${encodeURIComponent(bindingId)}&child_id=eq.${encodeURIComponent(childId)}&limit=1`
  );
  if (!before.length) throw fail("家长绑定不存在", 404);
  await assertNotStaff(before[0].user_id);

  const status = body.status === "inactive" ? "inactive" : "active";
  const relation = String(body.relation || "家长").trim().slice(0, 24) || "家长";
  const rows = await db(`parent_accounts?id=eq.${encodeURIComponent(bindingId)}&child_id=eq.${encodeURIComponent(childId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      relation,
      is_primary: booleanValue(body.isPrimary),
      can_edit_basic: false,
      can_reply_comments: booleanValue(body.canReplyComments, true),
      can_upload_growth: booleanValue(body.canUploadGrowth, true),
      status,
      granted_by: staff.id,
      updated_at: new Date().toISOString()
    })
  });
  send(res, 200, { binding: rows[0] });
}

module.exports = async function handler(req, res) {
  try {
    const staff = await requireStaff(req);
    if (req.method === "GET") {
      const childId = String(req.query?.childId || "").trim();
      await assertChild(childId);
      return send(res, 200, { bindings: await listBindings(childId) });
    }
    if (req.method === "POST") return createBinding(req, res, staff);
    if (req.method === "PATCH") return updateBinding(req, res, staff);
    throw fail("请求方式不支持", 405);
  } catch (error) {
    handleError(res, error);
  }
};
