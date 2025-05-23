const express = require('express');
const { proxyGetHandler, proxyPostHandler, imageHandler } = require('../controllers/proxyController');

const router = express.Router();

router.get('/images/cimg/:file', imageHandler);
router.get('/proxy', proxyGetHandler);
router.post('/proxy', proxyPostHandler);

module.exports = router;
