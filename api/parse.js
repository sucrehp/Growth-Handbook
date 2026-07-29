const { send, handleError, requireMethod, requireUser, db, normalizeCategory } = require("./_lib");

module.exports = async function handler(req, res) {
  try {
    requireMethod(req, "POST");
    await requireUser(req);
    const text = String(req.body?.instruction || "").trim();
    if (!text) {
      const error = new Error("请输入归档指令");
      error.statusCode = 400;
      throw error;
    }
    const children = await db("children?select=id,name,class_name,status&order=name");
    const direct = children.filter((child) => text.includes(child.name));
    const nickname = text.match(/(?:存入|放到|归档到?|给)([^，。,\s]{1,8}?)(?:的)?(?:成长手册|相册)/);
    const key = direct[0]?.name || nickname?.[1] || "";
    const matches = direct.length
      ? direct
      : children.filter((child) => key && (child.name.includes(key) || key.includes(child.name))).slice(0, 5);
    const categories = ["课堂风采", "作品展示", "活动记录", "日常瞬间", "其他"];
    const category = categories.find((item) => text.includes(item)) || "课堂风采";
    send(res, 200, {
      action: "add_photo",
      child_name: matches[0]?.name || key,
      category: normalizeCategory(category),
      description: text,
      confidence: matches.length === 1 ? 0.95 : 0.55,
      matches,
      ambiguous: matches.length !== 1,
      clarification:
        matches.length === 0
          ? "未找到对应学员，请从名单中选择。"
          : matches.length > 1
            ? `找到 ${matches.length} 位可能的学员，请确认。`
            : null
    });
  } catch (error) {
    handleError(res, error);
  }
};
