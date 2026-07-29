const { send, handleError, requireUser, db } = require("./_lib");

module.exports = async function handler(req, res) {
  try {
    const user = await requireUser(req);
    if (req.method === "GET") {
      const rows = await db(
        "publish_schedules?select=*,content_drafts(*)&order=scheduled_at.asc&limit=100"
      );
      return send(res, 200, rows);
    }
    if (req.method !== "POST") {
      const error = new Error("请求方式不支持");
      error.statusCode = 405;
      throw error;
    }
    const body = req.body || {};
    if (!body.draftId || !body.scheduledAt || !body.assigneeName) {
      const error = new Error("请填写发布稿、发布时间和负责人");
      error.statusCode = 400;
      throw error;
    }
    const drafts = await db(
      `content_drafts?select=id,review_status&id=eq.${encodeURIComponent(body.draftId)}&limit=1`
    );
    if (!drafts.length || drafts[0].review_status !== "approved") {
      const error = new Error("只有审核通过的发布稿才能排期");
      error.statusCode = 409;
      throw error;
    }
    const scheduledAt = new Date(body.scheduledAt);
    const reminderMinutes = Math.max(5, Number(body.reminderMinutes || 30));
    const reminderAt = new Date(scheduledAt.getTime() - reminderMinutes * 60000);
    const rows = await db("publish_schedules", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        draft_id: body.draftId,
        scheduled_at: scheduledAt.toISOString(),
        reminder_at: reminderAt.toISOString(),
        assignee_name: String(body.assigneeName).trim(),
        assignee_phone: String(body.assigneePhone || "").trim() || null,
        reminder_channel: ["in_app", "wecom", "sms"].includes(body.reminderChannel)
          ? body.reminderChannel
          : "in_app",
        created_by: user.id
      })
    });
    send(res, 201, rows[0]);
  } catch (error) {
    handleError(res, error);
  }
};
