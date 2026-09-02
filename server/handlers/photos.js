const { send, handleError, requireMethod, requireUser, db } = require("../../api/_lib");

module.exports = async function handler(req, res) {
  try {
    requireMethod(req, "GET");
    await requireUser(req);
    const rows = await db(
      "photo_records?select=id,child_id,photo_url,category,caption,taken_date,created_at,children(name,class_name)&order=created_at.desc&limit=30"
    );
    send(res, 200, rows);
  } catch (error) {
    handleError(res, error);
  }
};
