const { send, handleError, requireUser, db } = require("./_lib");

const roleModules = {
  owner: ["overview","leads","contracts","accounts","tasks","growth","teacher","marketing","finance","settings"],
  campus_manager: ["overview","leads","contracts","accounts","tasks","growth","teacher","marketing"],
  finance: ["overview","contracts","accounts","finance","tasks"],
  consultant: ["overview","leads","contracts","tasks","growth"],
  teacher: ["overview","tasks","growth","teacher","marketing"],
  frontdesk: ["overview","leads","contracts","accounts","tasks","growth"]
};

module.exports = async function handler(req, res) {
  try {
    const user = await requireUser(req);
    let rows = await db(`staff_profiles?select=id,campus_id,display_name,role,status,module_permissions&id=eq.${encodeURIComponent(user.id)}&limit=1`);

    if (!rows.length) {
      const existing = await db("staff_profiles?select=id&limit=1");
      if (!existing.length) {
        rows = await db("staff_profiles", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            id: user.id,
            display_name: user.user_metadata?.display_name || user.email?.split("@")[0] || "负责人",
            role: "owner",
            status: "active"
          })
        });
      }
    }

    if (!rows.length || rows[0].status !== "active") {
      const parents = await db(`parent_accounts?select=child_id,relation,is_primary,can_edit_basic,can_reply_comments,can_upload_growth&user_id=eq.${encodeURIComponent(user.id)}&status=eq.active`);
      if (!parents.length) {
        const error = new Error("该账号尚未分配 EDU 使用权限");
        error.statusCode = 403;
        throw error;
      }
      return send(res, 200, {
        id: user.id,
        email: user.email,
        displayName: user.user_metadata?.display_name || "家长",
        accountType: "parent",
        role: "parent",
        modules: ["parent_home","growth","messages","uploads"],
        children: parents
      });
    }

    const profile = rows[0];
    const defaults = roleModules[profile.role] || ["overview","tasks"];
    const overrides = profile.module_permissions || {};
    const modules = defaults.filter((name) => overrides[name] !== false);
    Object.entries(overrides).forEach(([name, enabled]) => {
      if (enabled === true && !modules.includes(name)) modules.push(name);
    });
    const childAccess = profile.role === "owner" || profile.role === "campus_manager"
      ? []
      : await db(`staff_child_access?select=child_id,access_level&staff_id=eq.${encodeURIComponent(user.id)}`);

    send(res, 200, {
      id: user.id,
      email: user.email,
      displayName: profile.display_name || user.email,
      accountType: "staff",
      role: profile.role,
      campusId: profile.campus_id,
      modules,
      childAccess
    });
  } catch (error) {
    handleError(res, error);
  }
};
