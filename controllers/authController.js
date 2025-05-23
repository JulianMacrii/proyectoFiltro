const fs = require('fs');
const path = require('path');
const axios = require('axios').default;
const cheerio = require('cheerio');

const loginHandler = async (req, res) => {
  const { usuario, clave } = req.body;
  const usuarios = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'usuarios.json'), 'utf8'));
  const user = usuarios.find(u => u.usuario === usuario && u.clave === clave);
  if (!user) return res.redirect('/?error=credenciales');

  const envKey = user.envKey;
  const realUser = process.env[`${envKey}_USER`];
  const realPass = process.env[`${envKey}_PASS`];

  if (!realUser || !realPass) return res.redirect('/?error=servidor');

  try {
    const init = await axios.get('https://webmutuales.ips.gba.gob.ar/entidades/index.jsp');
    const cookies = (init.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');

    const login = await axios.post(
      'https://webmutuales.ips.gba.gob.ar/entidades/login.do',
      new URLSearchParams({ cdUsuario: realUser, dsClave: realPass }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': 'https://webmutuales.ips.gba.gob.ar/entidades/index.jsp',
          'User-Agent': 'Mozilla/5.0',
          Cookie: cookies
        },
        maxRedirects: 0,
        validateStatus: s => s >= 200 && s < 400
      }
    );

    const $ = cheerio.load(login.data);
    if ($('form input[name="cdUsuario"]').length || $('img[src*="error.gif"]').length) {
      return res.redirect('/?error=loginips');
    }

    const more = (login.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
    req.session.cookieHeader = cookies + '; ' + more;
    req.session.usuarioVisible = usuario;

    res.redirect('/panel');
  } catch (err) {
    console.error('Error en login:', err.message);
    res.redirect('/?error=1');
  }
};

const panelHandler = (req, res) => {
  if (!req.session.cookieHeader) return res.redirect('/');
  const nombre = req.session.usuarioVisible || 'Usuario';
  res.sendFile(path.join(__dirname, '..', 'public/panel.html')); // O usa res.send() si el HTML es dinámico
};

const logoutHandler = (req, res) => {
  req.session.destroy(() => res.redirect('/'));
};

module.exports = {
  loginHandler,
  logoutHandler,
  panelHandler
};
