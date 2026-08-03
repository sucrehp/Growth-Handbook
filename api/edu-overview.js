const { send, handleError, requireUser, db } = require("./_lib");

module.exports = async function handler(req, res) {
  try {
    await requireUser(req);
    if (req.method !== "GET") {
      const error = new Error("请求方式不支持");
      error.statusCode = 405;
      throw error;
    }
    const [leads, contracts, accounts, tasks, children] = await Promise.all([
      db("leads?select=id,stage,next_followup_at"),
      db("edu_contracts?select=id,sign_status,contract_amount,paid_amount,valid_until"),
      db("lesson_accounts?select=id,purchased_lessons,gift_lessons,consumed_lessons,frozen_lessons,status,valid_until"),
      db("edu_tasks?select=id,status,priority,due_at"),
      db("children?select=id,status")
    ]);
    const activeAccounts = accounts.filter((item) => item.status === "active");
    const remainingLessons = activeAccounts.reduce(
      (sum, item) => sum + number(item.purchased_lessons) + number(item.gift_lessons) - number(item.consumed_lessons) - number(item.frozen_lessons),
      0
    );
    send(res, 200, {
      students: children.length,
      leads: leads.filter((item) => !["won","lost"].includes(item.stage)).length,
      signedContracts: contracts.filter((item) => item.sign_status === "signed").length,
      contractAmount: contracts.reduce((sum, item) => sum + number(item.contract_amount), 0),
      collectedAmount: contracts.reduce((sum, item) => sum + number(item.paid_amount), 0),
      remainingLessons,
      todoTasks: tasks.filter((item) => !["done","cancelled"].includes(item.status)).length,
      urgentTasks: tasks.filter((item) => item.priority === "urgent" && item.status !== "done").length
    });
  } catch (error) {
    handleError(res, error);
  }
};

function number(value) {
  return Number(value || 0);
}
