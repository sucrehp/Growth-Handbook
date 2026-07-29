const {
  send,
  handleError,
  requireMethod,
  requireUser,
  db,
  uploadPhoto,
  normalizeCategory
} = require("./_lib");

module.exports = async function handler(req, res) {
  try {
    requireMethod(req, "POST");
    const user = await requireUser(req);
    const body = req.body || {};
    if (!body.childId || !body.fileData) {
      const error = new Error("缺少学员或照片");
      error.statusCode = 400;
      throw error;
    }
    const children = await db(
      `children?select=id,name,class_name&id=eq.${encodeURIComponent(body.childId)}&limit=1`
    );
    if (!children.length) {
      const error = new Error("学员不存在");
      error.statusCode = 400;
      throw error;
    }
    const photoUrl = await uploadPhoto(body);
    const rows = await db("photo_records", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        child_id: body.childId,
        photo_url: photoUrl,
        caption: String(body.description || "").trim(),
        category: normalizeCategory(body.category),
        taken_date: new Date().toISOString().slice(0, 10),
        uploaded_by: body.uploadedBy || user.email || "老师",
        source: "teacher_agent",
        ai_instruction: String(body.instruction || "").trim()
      })
    });
    send(res, 201, {
      record: rows[0],
      message: `已将照片存入 ${children[0].name} 的成长手册`
    });
  } catch (error) {
    handleError(res, error);
  }
};
