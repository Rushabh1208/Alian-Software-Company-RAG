const express = require("express");
const {
  deleteWebsiteController,
  indexWebsiteController,
  listWebsitesController,
} = require("../controllers/websiteController");

const router = express.Router();

router.post("/index-website", indexWebsiteController);
router.get("/websites", listWebsitesController);
router.delete("/websites/:id", deleteWebsiteController);

module.exports = router;
