// server.js
require('dotenv').config();               // carga vars de entorno
const express = require('express');
const axios = require('axios').default;
const cheerio = require('cheerio');
const session = require('express-session');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// — Middlewares —
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({ secret: 'secreto123', resave: false, saveUninitialized: true }));
// Sirve tu carpeta public: login.html, inicio.css, logo.png, etc.
app.use(express.static(path.join(__dirname, 'public')));

// — LOGIN FORM estático —
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/login.html'));
});

// — POST /api/login — autentica contra tu usuarios.json y luego contra IPS
app.post('/api/login', async (req, res) => {
    const { usuario, clave } = req.body;
    // 1) leo usuarios “ligeros”
    const usuarios = JSON.parse(
        fs.readFileSync(path.join(__dirname, 'usuarios.json'), 'utf8')
    );
    const user = usuarios.find(u => u.usuario === usuario && u.clave === clave);
    if (!user) return res.redirect('/?error=credenciales');

    // 2) extraigo credenciales reales de ENV
    const envKey = user.envKey;
    const realUser = process.env[`${envKey}_USER`];
    const realPass = process.env[`${envKey}_PASS`];
    if (!realUser || !realPass) {
        console.error(`Faltan vars ${envKey}_USER / ${envKey}_PASS`);
        return res.redirect('/?error=servidor');
    }

    try {
        // 3) GET index.jsp para JSESSIONID
        const init = await axios.get('https://webmutuales.ips.gba.gob.ar/entidades/index.jsp', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        let cookies = (init.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');

        // 4) POST login.do con credenciales reales
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

        // 5) chequeo si volvió al login o error
        const $ = cheerio.load(login.data);
        if ($('form input[name="cdUsuario"]').length || $('img[src*="error.gif"]').length) {
            return res.redirect('/?error=loginips');
        }

        // 6) guardo cookies en sesión
        const more = (login.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
        req.session.cookieHeader = cookies + '; ' + more;
        req.session.usuarioVisible = usuario;

        res.redirect('/panel');
    } catch (err) {
        console.error('Error en login:', err.message);
        res.redirect('/?error=1');
    }
});

// — PANEL con tu HTML + CSS previo (inicio.css, logo.png…) —
app.get('/panel', (req, res) => {
    if (!req.session.cookieHeader) return res.redirect('/');
    const nombre = req.session.usuarioVisible || 'Usuario';
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
            <li><a href="/proxy?url=${encodeURIComponent('https://webmutuales.ips.gba.gob.ar/entidades/jsp-elements/veintePorciento/altaAutorizacionManual.jsp')}" target="_blank">Autorizar</a></li>
            <li><a href="/proxy?url=${encodeURIComponent('https://webmutuales.ips.gba.gob.ar/entidades/jsp-elements/veintePorciento/altaCuotaSocio.jsp')}" target="_blank">Cuota Social</a></li>
          </ul>
          <br>
          <a href="/logout">Cerrar sesión</a>
        </div>
      </body>
    </html>
  `);
});

// — CAPTCHA y demás imágenes cimg —
app.get('/images/cimg/:file', async (req, res) => {
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
});

// — PROXY GET —
app.get('/proxy', async (req, res) => {
    if (!req.session.cookieHeader) return res.sendStatus(401);
    await proxyRequest('get', req.query.url, req, res);
});

// — PROXY POST (formularios) —
app.post('/proxy', async (req, res) => {
    if (!req.session.cookieHeader) return res.sendStatus(401);
    const postData = new URLSearchParams(req.body).toString();
    await proxyRequest('post', req.query.url, req, res, postData);
});

async function proxyRequest(method, target, req, res, postData = '') {
    try {
        const baseConfig = {
            headers: {
                Cookie: req.session.cookieHeader,
                'User-Agent': 'Mozilla/5.0'
            },
            responseType: 'arraybuffer',
            maxRedirects: 0,
            validateStatus: s => s >= 200 && s < 400
        };
        let response;
        if (method === 'post') {
            response = await axios.post(target, postData, {
                ...baseConfig,
                headers: {
                    ...baseConfig.headers,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
        } else {
            response = await axios.get(target, baseConfig);
        }

        const ct = response.headers['content-type'] || '';
        if (!ct.includes('text/html')) {
            res.set('Content-Type', ct);
            return res.send(response.data);
        }

        // reescribir HTML
        let html = Buffer.from(response.data, 'binary').toString('latin1');
        const $ = cheerio.load(html, { decodeEntities: false });

        // centrado visual
        $('body').wrapInner('<div class="contenido-centrado"></div>');
        $('head').append(`
      <style>
        .contenido-centrado {
          display:flex; justify-content:center; align-items:center;
          min-height:100vh; padding:40px; box-sizing:border-box;
        }
        table{ margin:0 auto!important; }
      </style>
    `);

        // 1) imágenes cimg
        $('img[src*="/images/cimg/"],img[src*="images/cimg/"]').each((i, el) => {
            const f = $(el).attr('src').split('/').pop();
            $(el).attr('src', `/images/cimg/${f}`);
        });
        // 2) formularios: acción a nuestro /proxy
        $('form').each((i, form) => {
            const act = $(form).attr('action') || '';
            const abs = new URL(act, target).toString();
            $(form).attr('action', `/proxy?url=${encodeURIComponent(abs)}`);
        });
        // 3) resto de src/href/background
        $('[src],[href],[background]').each((i, el) => {
            ['src', 'href', 'background'].forEach(a => {
                const v = $(el).attr(a) || '';
                if (!v || v.startsWith('#') || v.startsWith('mailto:') || v.startsWith('/images/cimg/')) return;
                try {
                    const abs = new URL(v, target).toString();
                    $(el).attr(a, `/proxy?url=${encodeURIComponent(abs)}`);
                } catch { }
            });
        });
        // 3) Ocultar contenedor de Baja autorización (por contenido textual)
        $('body').find('*').each((_, el) => {
            const t = $(el).text().replace(/\s+/g, ' ').trim().toLowerCase();
            if (t === 'baja autorización' || t === 'baja autorizacion') {
                $(el).parent().remove();
            }
        });

        res.set('Content-Type', 'text/html; charset=ISO-8859-1');
        res.send($.html());
    } catch (err) {
        console.error('Error proxy:', err.message);
        res.sendStatus(500);
    }
}

// — LOGOUT —
app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

// — ARRANCA SERVIDOR —
app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
