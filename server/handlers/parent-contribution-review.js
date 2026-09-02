const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET = "parent-uploads";

function send(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function serviceHeaders(extra = {}) {
  return {
    apikey: SECRET_KEY,
    ...(SECRET_KEY.startsWith("eyJ") ? { Authorization: `Bearer ${SECRET_KEY}` } : {}),
    ...extra
  };
}

async function serviceRest(endpoint, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    ...options,
    headers: serviceHeaders({ "Content-Type": "application/json", ...(options.headers || {}) })
  });
  if (!response.ok) throw fail("审核数据读取失败", 503);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function requireOperator(req) {
  if (!SUPABASE_URL || !SECRET_KEY) throw fail("审核服务尚未配置", 503);
  const authorization = String(req.headers.authorization || "");
  if (!authorization.startsWith("Bearer ")) throw fail("请先登录管理后台", 401);
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: serviceHeaders({ Authorization: authorization })
  });
  if (!response.ok) throw fail("管理员登录已过期", 401);
  return authorization;
}

async function invokeReview(authorization, body) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/review_parent_contribution`, {
    method: "POST",
    headers: { apikey: SECRET_KEY, Authorization: authorization, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    console.error("Parent contribution review RPC failed", response.status);
    throw fail("审核未完成，请刷新后重试", 400);
  }
  return response.json();
}

async function removeRejectedEvidence(contributionId, evidence) {
  let complete = true;
  for (const item of evidence) {
    const path = String(item?.path || "");
    if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/i.test(path)) continue;
    const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
      method: "DELETE",
      headers: serviceHeaders()
    }).catch(() => null);
    if (!response?.ok) complete = false;
  }
  if (complete) {
    await Promise.all([
      serviceRest(`parent_contribution_metadata?parent_upload_id=eq.${encodeURIComponent(contributionId)}`, {
        method: "PATCH", body: JSON.stringify({ evidence:[] })
      }),
      serviceRest(`parent_uploads?id=eq.${encodeURIComponent(contributionId)}`, {
        method: "PATCH", body: JSON.stringify({ photo_urls:[] })
      })
    ]).catch(() => { complete = false; });
  }
  return complete;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") throw fail("请求方式不支持", 405);
    const authorization = await requireOperator(req);
    const contributionId = String(req.body?.contributionId || "").trim();
    const decision = String(req.body?.decision || "").toUpperCase();
    const remark = String(req.body?.remark || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(contributionId)) throw fail("投稿编号无效");
    if (!['APPROVE','REJECT'].includes(decision)) throw fail("审核决定无效");
    if (remark.length > 500) throw fail("审核备注不能超过 500 个字");

    const metadataRows = await serviceRest(`parent_contribution_metadata?select=evidence&parent_upload_id=eq.${encodeURIComponent(contributionId)}&limit=1`);
    if (!metadataRows.length) throw fail("待审核投稿不存在", 404);
    const result = await invokeReview(authorization, {
      p_contribution_id: contributionId,
      p_decision: decision,
      p_remark: remark || null
    });

    let rejectedMediaCleanup = "NOT_APPLICABLE";
    if (decision === "REJECT") {
      const evidence = Array.isArray(metadataRows[0].evidence) ? metadataRows[0].evidence : [];
      rejectedMediaCleanup = await removeRejectedEvidence(contributionId, evidence) ? "COMPLETED" : "PENDING";
    }
    send(res, 200, { result, rejectedMediaCleanup });
  } catch (error) {
    console.error(error);
    send(res, error.statusCode || 500, { error: error.message || "审核失败" });
  }
};

