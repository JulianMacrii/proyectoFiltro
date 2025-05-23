const axios = require('axios');
const cheerio = require('cheerio');

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

    const status = response.status;
    const ct = response.headers['content-type'] || '';

    if (status === 302 && response.headers.location && response.headers.location.endsWith('.pdf')) {
      const pdfUrl = new URL(response.headers.location, target).toString();
      const pdfResponse = await axios.get(pdfUrl, {
        headers: {
          Cookie: req.session.cookieHeader,
          'User-Agent': 'Mozilla/5.0'
        },
        responseType: 'arraybuffer'
      });
      res.set('Content-Type', 'application/pdf');
      return res.send(pdfResponse.data);
    }

    if (ct.includes('application/pdf')) {
      res.set('Content-Type', 'application/pdf');
      return res.send(response.data);
    }

    if (!ct.includes('text/html')) {
      res.set('Content-Type', ct);
      return res.send(response.data);
    }

    let html = Buffer.from(response.data, 'binary').toString('latin1');
    const $ = cheerio.load(html, { decodeEntities: false });

    $('body').wrapInner('<div class="contenido-centrado"></div>');
    $('head').append(`
      <style>
        .contenido-centrado {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          padding: 40px;
          box-sizing: border-box;
        }
        table { margin: 0 auto !important; }
      </style>
    `);

    $('form').each((_, form) => {
      const act = $(form).attr('action') || '';
      const abs = new URL(act, target).toString();
      $(form).attr('action', `/proxy?url=${encodeURIComponent(abs)}`);
    });

    $('[src],[href],[background]').each((_, el) => {
      ['src', 'href', 'background'].forEach(attr => {
        const v = $(el).attr(attr);
        if (!v || v.startsWith('#') || v.startsWith('mailto:') || v.includes('/images/cimg/')) return;
        try {
          const abs = new URL(v, target).toString();
          $(el).attr(attr, `/proxy?url=${encodeURIComponent(abs)}`);
        } catch { }
      });
    });

    $('body').find('*').each((_, el) => {
      const t = $(el).text().replace(/\s+/g, ' ').trim().toLowerCase();
      if (t === 'baja autorización' || t === 'baja autorizacion'  || t === 'baja socio') {
        $(el).parent().remove();
      }
    });

    res.set('Content-Type', 'text/html; charset=ISO-8859-1');
    res.send($.html());

  } catch (err) {
    console.error('Proxy error:', err.message);
    res.sendStatus(500);
  }
}

module.exports = { proxyRequest };
