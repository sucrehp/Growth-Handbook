const { send, handleError, requireUser, db } = require("./_lib");

module.exports = async function handler(req, res) {
  try {
    const user = await requireUser(req);
    if (req.method !== "POST") {
      const error = new Error("请求方式不支持");
      error.statusCode = 405;
      throw error;
    }
    const body = req.body || {};
    const status = ["approved", "rejected", "pending"].includes(body.status)
      ? body.status
      : "pending";
    const rows = await db(`content_drafts?id=eq.${encodeURIComponent(body.draftId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        review_status: status,
        reviewed_by: status === "pending" ? null : user.id,
        reviewed_at: status === "pending" ? null : new Date().toISOString(),
        review_note: String(body.reviewNote || "").trim()
      })
    });
    if (!rows.length) {
      const error = new Error("发布稿不存在");
      error.statusCode = 404;
      throw error;
    }
    send(res, 200, rows[0]);
  } catch (error) {
    handleError(res, error);
  }
};
