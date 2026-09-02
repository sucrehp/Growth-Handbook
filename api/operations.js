const handlers = Object.freeze({
  children: require("../server/handlers/children"),
  photos: require("../server/handlers/photos"),
  "parent-contribution-media": require("../server/handlers/parent-contribution-media"),
  "parent-contribution-review": require("../server/handlers/parent-contribution-review")
});

module.exports = async function handler(req, res) {
  const operation = String(req.query?.__operation || "");
  const operationHandler = handlers[operation];
  if (!operationHandler) {
    res.status(404).setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "接口不存在" }));
    return;
  }
  return operationHandler(req, res);
};
