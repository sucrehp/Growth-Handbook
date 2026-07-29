const { send, handleError, requireMethod, requireUser, db } = require("./_lib");

module.exports = async function handler(req, res) {
  try {
    requireMethod(req, "GET");
    await requireUser(req);
    const rows = await db("children?select=id,name,class_name,status&order=name");
    send(res, 200, rows);
  } catch (error) {
    handleError(res, error);
  }
};
