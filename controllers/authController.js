const fs = require('fs');
const path = require('path');
const axios = require('axios').default;
const cheerio = require('cheerio');
const bcrypt = require('bcryptjs');

const loginHandler = async (req, res) => {
  const { usuario, clave } = req.body;

  const usuarios = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'usuarios.json'), 'utf8'));
  const user = usuarios.find(u => u.usuario === usuario);

  // Validación segura con bcrypt
  if (!user || !bcrypt.compareSync(clave, user.clave)) {
    return res.redirect('/?error=credenciales');
  }

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

  const url1 = encodeURIComponent('https://webmutuales.ips.gba.gob.ar/entidades/jsp-elements/veintePorciento/altaAutorizacionManual.jsp');
  const url2 = encodeURIComponent('https://webmutuales.ips.gba.gob.ar/entidades/jsp-elements/veintePorciento/altaCuotaSocio.jsp');

  res.send(`
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Panel IPS</title>
        <link rel="stylesheet" href="/inicio.css">
      </head>
      <body class="panel">
        <div class="panel-box">
          <img src="/logo.png" alt="Logo IPS" class="logo">
          <h2>Bienvenido, ${nombre}</h2>
          <ul>
            <li><a href="/proxy?url=${url1}" target="_blank">Autorizar</a></li>
            <li><a href="/proxy?url=${url2}" target="_blank">Cuota Social</a></li>
          </ul>
          <br>
          <a href="/logout">Cerrar sesión</a>
        </div>
      </body>
    </html>
  `);
};

const logoutHandler = (req, res) => {
  req.session.destroy(() => res.redirect('/'));
};

module.exports = {
  loginHandler,
  logoutHandler,
  panelHandler
};
