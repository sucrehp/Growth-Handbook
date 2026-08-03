const { send, handleError, requireUser, db } = require("./_lib");

const resources = {
  leads: {
    table: "leads",
    select: "*,campuses(name)",
    order: "created_at.desc",
    writable: [
      "campus_id","parent_name","phone","child_name","child_age","source",
      "interested_course","intention_level","stage","next_followup_at",
      "lost_reason","notes"
    ]
  },
  contracts: {
    table: "edu_contracts",
    select: "*,children(name),campuses(name)",
    order: "created_at.desc",
    writable: [
      "contract_no","campus_id","child_id","lead_id","guardian_name",
      "guardian_phone","course_category","contract_type","total_lessons",
      "gift_lessons","contract_amount","paid_amount","valid_from","valid_until",
      "sign_status","signed_at","signed_file_url"
    ]
  },
  accounts: {
    table: "lesson_accounts",
    select: "*,children(name),edu_contracts(contract_no,guardian_name)",
    order: "created_at.desc",
    writable: [
      "contract_id","child_id","course_category","purchased_lessons",
      "gift_lessons","consumed_lessons","frozen_lessons","valid_from",
      "valid_until","status"
    ]
  },
  tasks: {
    table: "edu_tasks",
    select: "*,campuses(name)",
    order: "created_at.desc",
    writable: [
      "campus_id","task_type","title","description","priority","status",
      "related_type","related_id","due_at","completed_at"
    ]
  },
  campuses: {
    table: "campuses",
    select: "*",
    order: "created_at.asc",
    writable: ["name","code","address","phone","manager_name","status"]
  }
};

module.exports = async function handler(req, res) {
  try {
    const user = await requireUser(req);
    const resource = resources[String(req.query?.resource || req.body?.resource || "")];
    if (!resource) {
      const error = new Error("不支持的数据模块");
      error.statusCode = 400;
      throw error;
    }

    if (req.method === "GET") {
      const rows = await db(
        `${resource.table}?select=${encodeURIComponent(resource.select)}&order=${resource.order}&limit=200`
      );
      return send(res, 200, rows);
    }

    const body = req.body || {};
    const payload = pick(body.data || {}, resource.writable);
    if (req.method === "POST") {
      if (resource.table === "leads" || resource.table === "edu_contracts" || resource.table === "edu_tasks") {
        payload.created_by = user.id;
      }
      const rows = await db(resource.table, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload)
      });
      await audit(user.id, "create", resource.table, rows[0]?.id, null, rows[0]);
      return send(res, 201, rows[0]);
    }

    if (req.method === "PATCH") {
      if (!body.id) {
        const error = new Error("缺少记录编号");
        error.statusCode = 400;
        throw error;
      }
      const endpoint = `${resource.table}?id=eq.${encodeURIComponent(body.id)}`;
      const before = await db(`${endpoint}&select=*`);
      const rows = await db(endpoint, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload)
      });
      await audit(user.id, "update", resource.table, body.id, before[0], rows[0]);
      return send(res, 200, rows[0]);
    }

    const error = new Error("请求方式不支持");
    error.statusCode = 405;
    throw error;
  } catch (error) {
    handleError(res, error);
  }
};

function pick(value, allowed) {
  return Object.fromEntries(
    allowed.filter((key) => value[key] !== undefined).map((key) => [key, value[key] === "" ? null : value[key]])
  );
}

async function audit(actorId, action, resourceType, resourceId, beforeData, afterData) {
  try {
    await db("edu_audit_logs", {
      method: "POST",
      body: JSON.stringify({
        actor_id: actorId,
        action,
        resource_type: resourceType,
        resource_id: String(resourceId || ""),
        before_data: beforeData,
        after_data: afterData
      })
    });
  } catch (error) {
    console.error("audit log failed", error);
  }
}
