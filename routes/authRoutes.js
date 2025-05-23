const express = require('express');
const path = require('path');
const { loginHandler, logoutHandler, panelHandler } = require('../controllers/authController');

const router = express.Router();

router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public/login.html'));
});

router.post('/api/login', loginHandler);
router.get('/panel', panelHandler);
router.get('/logout', logoutHandler);

module.exports = router;
