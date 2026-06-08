// backend/routes/guardrailsRoutes.js
const express = require('express');
const router = express.Router();
const { checkGuardrails } = require('../controllers/guardrailsController');

router.post('/check', checkGuardrails);

module.exports = router;