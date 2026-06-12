const { ensureSeeded, readTable } = require("../utils/dbStore");

function listPlans() {
  ensureSeeded();
  return readTable("plans");
}

function getUserSubscription(userId) {
  ensureSeeded();
  const subscription = readTable("subscriptions").find((item) => item.user_id === userId) || null;
  if (!subscription) return null;
  const plan = readTable("plans").find((item) => item.id === subscription.plan_id) || null;
  return { ...subscription, plan };
}

module.exports = { getUserSubscription, listPlans };
