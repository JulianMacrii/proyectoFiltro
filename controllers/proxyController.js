const axios = require('axios');
const { proxyRequest } = require('../utils/proxyRequest');

const imageHandler = async (req, res) => {
  if (!req.session.cookieHeader) return res.sendStatus(401);
  const remote = `https://webmutuales.ips.gba.gob.ar/entidades/images/cimg/${req.params.file}`;
  try {
    const r = await axios.get(remote, {
      headers: { Cookie: req.session.cookieHeader, 'User-Agent': 'Mozilla/5.0' },
      responseType: 'arraybuffer'
    });
    res.set('Content-Type', r.headers['content-type']);
    res.send(r.data);
  } catch (e) {
    console.error('Error captcha:', e.message);
    res.sendStatus(500);
  }
};

const proxyGetHandler = async (req, res) => {
  if (!req.session.cookieHeader) return res.sendStatus(401);
  await proxyRequest('get', req.query.url, req, res);
};

const proxyPostHandler = async (req, res) => {
  if (!req.session.cookieHeader) return res.sendStatus(401);
  const postData = new URLSearchParams(req.body).toString();
  await proxyRequest('post', req.query.url, req, res, postData);
};

module.exports = {
  imageHandler,
  proxyGetHandler,
  proxyPostHandler
};
