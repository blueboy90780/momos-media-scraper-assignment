const express = require('express');
const router = express.Router();
const { scrapeUrls, getMedia, clearMedia } = require('../controllers/mediaController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);
router.post('/scrape', scrapeUrls);
router.get('/', getMedia);
router.delete('/clear', clearMedia);

module.exports = router;