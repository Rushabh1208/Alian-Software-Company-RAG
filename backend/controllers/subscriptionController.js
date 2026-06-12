const { getUserSubscription, listPlans } = require("../services/subscriptionService");

async function listPlansController(_req, res) {
  try {
    return res.json({ plans: listPlans() });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function getMySubscriptionController(req, res) {
  try {
    return res.json({ subscription: getUserSubscription(req.auth.sub) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

module.exports = { getMySubscriptionController, listPlansController };
