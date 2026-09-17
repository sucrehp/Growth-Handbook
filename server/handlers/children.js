const { send, handleError, requireMethod, requireStaff, db } = require("../../api/_lib");

module.exports = async function handler(req, res) {
  try {
    requireMethod(req, "GET");
    await requireStaff(req);
    const rows = await db("children?select=id,name,class_name,status&order=name");
    send(res, 200, rows);
  } catch (error) {
    handleError(res, error);
  }
};
