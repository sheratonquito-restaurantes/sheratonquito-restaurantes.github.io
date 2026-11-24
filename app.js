/* Catálogos · Sheraton Quito
 * Todo el contenido viene de data/catalogo.json (se edita desde /admin). Puede haber varios
 * catálogos (A&B, Recepción, Eventos, Grupos…), cada uno con sus temporadas, tema de color,
 * logos, formularios de Microsoft Forms y teléfonos. Se elige con ?c=<id> o con la carpeta /<id>/.
 * Revista con StPageFlip y efectos por sección. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var enlazar = function (t) {
    return esc(t)
      .replace(/https?:\/\/[^\s<]+[^\s<.,;)]/g, function (u) { return '<a href="' + u + '" target="_blank" rel="noopener">' + u.replace(/^https?:\/\//, '') + '</a>'; })
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+[\w]/g, function (m) { return '<a href="mailto:' + m + '">' + m + '</a>'; });
  };
  var rnd = Math.random;
  var FORMS_OK = /^https:\/\/forms\.(cloud\.microsoft|office\.com)\//;

  /* ════════════ Efectos de partículas ════════════ */
  var lienzo = $('#efectos'), ctx = lienzo.getContext('2d');
  var W = 0, H = 0, DPR = 1, modo = 'ninguno';
  function medir() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    lienzo.width = W * DPR; lienzo.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  var elegir = function (l) { return l[(rnd() * l.length) | 0]; };
  var DORADOS = ['#e3cc9c', '#c9a96e', '#f6e7c1', '#b8924f', '#ffffff'];
  var CARNAVAL = ['#e63946', '#f4a261', '#ffd166', '#06d6a0', '#118ab2', '#9b5de5', '#ff70a6'];
  var OTONO = ['#c8553d', '#e07a3f', '#d9a441', '#8c3b1f', '#b5651d'];
  var PETALOS = ['#f8c8d4', '#f4a6ba', '#fbe0e6', '#ffffff', '#f2b5c4'];
  var GLOBOS = ['#e63946', '#ffd166', '#06d6a0', '#118ab2', '#9b5de5', '#ff70a6', '#f4a261'];
  function cont(den, max) { return Math.min(max, Math.round(W * H / den)); }

  // Cada efecto: cuántas partículas, cómo nace (arriba = entra por el borde), cómo se mueve y se dibuja.
  var FX = {
    nieve: { n: function () { return cont(7000, 220); },
      nuevo: function (a) { var c = rnd(); return { x: rnd() * W, y: a ? -10 - rnd() * H * 0.3 : rnd() * H, r: 1 + c * 3.2, vy: 0.4 + c * 1.4, f: rnd() * 6.28, amp: 0.3 + rnd() * 0.8, g: rnd() * 6.28, cr: c > 0.82, a: 0.45 + c * 0.5 }; },
      mover: function (p, t) { p.y += p.vy; p.x += Math.sin(t / 1400 + p.f) * p.amp; p.g += 0.004; return p.y < H + 12; },
      dibujar: function (p) {
        if (p.cr) {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.g); ctx.strokeStyle = 'rgba(255,255,255,' + p.a + ')'; ctx.lineWidth = 1.1;
          var L = p.r * 2.6;
          for (var i = 0; i < 6; i++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, L); ctx.moveTo(0, L * .55); ctx.lineTo(L * .25, L * .75); ctx.moveTo(0, L * .55); ctx.lineTo(-L * .25, L * .75); ctx.stroke(); }
          ctx.restore(); return;
        }
        var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, 'rgba(255,255,255,' + p.a + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28); ctx.fill();
      } },
    burbujaDorada: { n: function () { return modo === 'brindis' ? cont(14000, 90) : 0; }, propio: true,
      nuevo: function (a) { var r = 1.5 + rnd() * 4.5; return { x: rnd() * W, y: a ? H + 10 + rnd() * 40 : rnd() * H, r: r, vy: 0.5 + r * 0.22 + rnd() * 0.6, f: rnd() * 6.28, amp: 0.2 + rnd() * 0.5 }; },
      mover: function (p, t) { p.y -= p.vy; p.x += Math.sin(t / 600 + p.f) * p.amp; return p.y > -12; },
      dibujar: function (p) {
        ctx.strokeStyle = 'rgba(246,231,193,.75)'; ctx.lineWidth = 1; ctx.fillStyle = 'rgba(227,204,156,.14)';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(p.x - p.r * .35, p.y - p.r * .35, Math.max(.6, p.r * .25), 0, 6.28); ctx.fill();
      } },
    confetiDorado: { n: function () { return modo === 'brindis' ? cont(18000, 70) : 0; }, propio: true,
      nuevo: function (a) { return confeti(a, DORADOS); }, mover: moverConfeti, dibujar: dibujarConfeti },
    confeti: { n: function () { return cont(9000, 140); },
      nuevo: function (a) { return confeti(a, CARNAVAL); }, mover: moverConfeti, dibujar: dibujarConfeti },
    corazones: { n: function () { return cont(20000, 60); },
      nuevo: function (a) { return { x: rnd() * W, y: a ? -20 - rnd() * H * 0.4 : rnd() * H, s: 5 + rnd() * 9, vy: 0.5 + rnd() * 1.1, f: rnd() * 6.28, a: 0.45 + rnd() * 0.45, c: rnd() < 0.5 ? '#e63962' : '#ff8fab' }; },
      mover: function (p, t) { p.y += p.vy; p.x += Math.sin(t / 900 + p.f) * 0.5; return p.y < H + 20; },
      dibujar: function (p) { ctx.save(); ctx.translate(p.x, p.y); ctx.globalAlpha = p.a; ctx.fillStyle = p.c; corazon(p.s); ctx.restore(); } },
    petalos: { n: function () { return cont(16000, 70); },
      nuevo: function (a) { return { x: rnd() * W, y: a ? -20 - rnd() * H * 0.4 : rnd() * H, w: 5 + rnd() * 6, h: 3 + rnd() * 4, vy: 0.5 + rnd() * 0.9, g: rnd() * 6.28, vg: (rnd() - 0.5) * 0.05, f: rnd() * 6.28, c: elegir(PETALOS) }; },
      mover: function (p, t) { p.y += p.vy; p.x += Math.sin(t / 1100 + p.f) * 0.9 + 0.25; p.g += p.vg; return p.y < H + 20 && p.x < W + 20; },
      dibujar: function (p) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.g); ctx.globalAlpha = 0.85; ctx.fillStyle = p.c; ctx.beginPath(); ctx.ellipse(0, 0, p.w, p.h, 0, 0, 6.28); ctx.fill(); ctx.restore(); } },
    hojas: { n: function () { return cont(22000, 45); },
      nuevo: function (a) { return { x: rnd() * W, y: a ? -30 - rnd() * H * 0.4 : rnd() * H, s: 7 + rnd() * 8, vy: 0.6 + rnd() * 0.9, g: rnd() * 6.28, vg: (rnd() - 0.5) * 0.04, f: rnd() * 6.28, c: elegir(OTONO) }; },
      mover: function (p, t) { p.y += p.vy; p.x += Math.sin(t / 1300 + p.f) * 1.4; p.g += p.vg + Math.sin(t / 700 + p.f) * 0.01; return p.y < H + 30; },
      dibujar: function (p) {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.g); ctx.globalAlpha = 0.9; ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.moveTo(0, -p.s); ctx.quadraticCurveTo(p.s * 0.8, 0, 0, p.s); ctx.quadraticCurveTo(-p.s * 0.8, 0, 0, -p.s); ctx.fill();
        ctx.strokeStyle = 'rgba(80,30,10,.5)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0, -p.s); ctx.lineTo(0, p.s * 1.2); ctx.stroke(); ctx.restore();
      } },
    globos: { n: function () { return cont(45000, 22); },
      nuevo: function (a) { var r = 12 + rnd() * 12; return { x: rnd() * W, y: a ? H + r * 3 + rnd() * 80 : rnd() * H, r: r, vy: 0.6 + rnd() * 0.8, f: rnd() * 6.28, c: elegir(GLOBOS) }; },
      mover: function (p, t) { p.y -= p.vy; p.x += Math.sin(t / 1500 + p.f) * 0.6; return p.y > -p.r * 4; },
      dibujar: function (p) {
        ctx.save(); ctx.globalAlpha = 0.85;
        ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y + p.r * 1.2); ctx.quadraticCurveTo(p.x + 6, p.y + p.r * 2, p.x, p.y + p.r * 3); ctx.stroke();
        ctx.fillStyle = p.c; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 1.2, 0, 0, 6.28); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(p.x - p.r * .35, p.y - p.r * .45, p.r * .22, p.r * .35, -0.5, 0, 6.28); ctx.fill();
        ctx.restore();
      } },
    destellos: { n: function () { return cont(9000, 110); },
      nuevo: function () { return { x: rnd() * W, y: rnd() * H, s: 1.5 + rnd() * 3.5, f: rnd() * 6.28, v: 0.6 + rnd() * 1.4, vy: 0.05 + rnd() * 0.2 }; },
      mover: function (p) { p.y += p.vy; return p.y < H + 10; },
      dibujar: function (p, t) {
        var a = Math.max(0, Math.sin(t / 600 * p.v + p.f)); if (a < 0.05) return;
        ctx.save(); ctx.translate(p.x, p.y); ctx.globalAlpha = a; ctx.fillStyle = '#f6e7c1';
        ctx.beginPath(); ctx.moveTo(0, -p.s * 2.4); ctx.lineTo(p.s * .45, -p.s * .45); ctx.lineTo(p.s * 2.4, 0); ctx.lineTo(p.s * .45, p.s * .45);
        ctx.lineTo(0, p.s * 2.4); ctx.lineTo(-p.s * .45, p.s * .45); ctx.lineTo(-p.s * 2.4, 0); ctx.lineTo(-p.s * .45, -p.s * .45); ctx.closePath(); ctx.fill(); ctx.restore();
      } },
    estrellas: { n: function () { return cont(9000, 120); },
      nuevo: function () { return { x: rnd() * W, y: rnd() * H, r: 0.4 + rnd() * 1.3, f: rnd() * 6.28, v: 0.4 + rnd() }; },
      mover: function () { return true; },
      dibujar: function (p, t) { ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t / 900 * p.v + p.f)); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28); ctx.fill(); ctx.globalAlpha = 1; } },
    fugaz: { n: function () { return modo === 'estrellas' ? 3 : 0; }, propio: true,
      nuevo: function () { return { x: rnd() * W * 1.2, y: -20 - rnd() * H * 0.6, v: 7 + rnd() * 6, l: 60 + rnd() * 90, d: rnd() * 260 }; },
      mover: function (p) { if (p.d-- > 0) return true; p.x -= p.v; p.y += p.v * 0.55; return p.y < H + 40 && p.x > -p.l; },
      dibujar: function (p) {
        if (p.d > 0) return;
        var g = ctx.createLinearGradient(p.x, p.y, p.x + p.l, p.y - p.l * 0.55); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.l, p.y - p.l * 0.55); ctx.stroke();
      } },
    burbujas: { n: function () { return cont(26000, 45); },
      nuevo: function (a) { var r = 6 + rnd() * 18; return { x: rnd() * W, y: a ? H + r + rnd() * 60 : rnd() * H, r: r, vy: 0.3 + rnd() * 0.7, f: rnd() * 6.28, h: rnd() * 360 }; },
      mover: function (p, t) { p.y -= p.vy; p.x += Math.sin(t / 1200 + p.f) * 0.6; p.h += 0.4; return p.y > -p.r * 2; },
      dibujar: function (p) {
        var g = ctx.createRadialGradient(p.x - p.r * .3, p.y - p.r * .3, p.r * .1, p.x, p.y, p.r);
        g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(0.75, 'hsla(' + p.h + ',80%,75%,.12)'); g.addColorStop(1, 'hsla(' + (p.h + 60) + ',80%,70%,.45)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28); ctx.fill();
      } },
    cohete: { n: function () { return modo === 'fuegos' ? 2 : 0; }, propio: true,
      nuevo: function () { return { x: W * (0.15 + rnd() * 0.7), y: H + 10 + rnd() * 300, vy: -(7 + rnd() * 3.5), meta: H * (0.12 + rnd() * 0.33), c: elegir(DORADOS.concat(['#d4504a', '#9fd3ff'])) }; },
      mover: function (p) {
        p.y += p.vy; p.vy *= 0.985;
        if (p.y <= p.meta || p.vy > -1.5) {
          var n = 60 + (rnd() * 40 | 0), fz = 2.5 + rnd() * 2.5;
          for (var j = 0; j < n; j++) { var an = j / n * 6.28, v = fz * (0.55 + rnd() * 0.45); chispas.push({ x: p.x, y: p.y, vx: Math.cos(an) * v, vy: Math.sin(an) * v, vida: 1, c: rnd() < 0.2 ? '#ffffff' : p.c }); }
          return false;
        }
        return true;
      },
      dibujar: function (p) { ctx.fillStyle = 'rgba(255,240,210,.9)'; ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, 6.28); ctx.fill(); } },
  };
  var chispas = [];
  function confeti(a, colores) { return { x: rnd() * W, y: a ? -20 - rnd() * H * 0.4 : rnd() * H, w: 4 + rnd() * 5, h: 7 + rnd() * 7, vy: 0.9 + rnd() * 1.3, g: rnd() * 6.28, vg: (rnd() - 0.5) * 0.12, vu: rnd() * 6.28, c: elegir(colores) }; }
  function moverConfeti(p) { p.y += p.vy; p.g += p.vg; p.vu += 0.06; p.x += Math.sin(p.vu) * 0.6; return p.y < H + 20; }
  function dibujarConfeti(p) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.g); ctx.scale(Math.cos(p.vu), 1); ctx.fillStyle = p.c; ctx.globalAlpha = 0.9; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore(); }
  function corazon(s) {
    ctx.beginPath(); ctx.moveTo(0, s * 0.3);
    ctx.bezierCurveTo(0, 0, -s, 0, -s, s * 0.35); ctx.bezierCurveTo(-s, s * 0.8, 0, s * 1.1, 0, s * 1.4);
    ctx.bezierCurveTo(0, s * 1.1, s, s * 0.8, s, s * 0.35); ctx.bezierCurveTo(s, 0, 0, 0, 0, s * 0.3); ctx.fill();
  }
  var particulas = {};
  Object.keys(FX).forEach(function (k) { particulas[k] = []; });
  function animar(t) {
    ctx.clearRect(0, 0, W, H);
    Object.keys(FX).forEach(function (k) {
      var fx = FX[k], lista = particulas[k];
      var objetivo = fx.propio ? fx.n() : (modo === k ? fx.n() : 0);
      while (lista.length < objetivo) lista.push(fx.nuevo(lista.length > objetivo * 0.5));
      for (var i = lista.length - 1; i >= 0; i--) {
        var p = lista[i];
        if (!fx.mover(p, t)) { if (lista.length > objetivo) lista.splice(i, 1); else lista[i] = fx.nuevo(true); continue; }
        fx.dibujar(p, t);
      }
      ctx.globalAlpha = 1;
    });
    for (var m = chispas.length - 1; m >= 0; m--) {
      var s = chispas[m];
      s.x += s.vx; s.y += s.vy; s.vy += 0.045; s.vx *= 0.985; s.vy *= 0.985; s.vida -= 0.012;
      if (s.vida <= 0) { chispas.splice(m, 1); continue; }
      ctx.globalAlpha = s.vida; ctx.fillStyle = s.c; ctx.beginPath(); ctx.arc(s.x, s.y, 1.6, 0, 6.28); ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(animar);
  }
  var ALIAS = { navidad: 'nieve', anonuevo: 'brindis', carnaval: 'confeti' };
  function normalizar(m) { return ALIAS[m] || m || 'ninguno'; }
  function ponerModo(m) { modo = normalizar(m); document.body.dataset.tema = modo; }
  medir(); window.addEventListener('resize', medir);
  if (!reducido) requestAnimationFrame(animar);

  /* ════════════ Datos ════════════ */
  var params = new URLSearchParams(location.search);
  var esBorrador = params.get('borrador') === '1';
  var imagenesBorrador = {};
  var D = null, C = null, T = null; // datos, catálogo y temporada mostrados

  // Convierte el formato antiguo (un solo catálogo) al formato con varios catálogos.
  function migrar(d) {
    if (d && d.version >= 2 && d.catalogos) return d;
    return {
      version: 2, principal: 'ayb', aviso: d.aviso,
      catalogos: [{
        id: 'ayb', nombre: 'Alimentos y Bebidas', activa: d.activa, tema: 'noche-dorada',
        logos: { claro: '', oscuro: '', secundario: 'assets/logos/bakery-blanco.png', secundarioOscuro: 'assets/logos/bakery-gris.png' },
        formularios: [{ id: 'reservas', nombre: 'Reservas Restaurantes y Bares', url: d.formsUrl || '' }], formulario: 'reservas',
        telefonos: d.telefonos || [], menus: Object.assign({ mostrar: true }, d.menus || {}), temporadas: d.temporadas || [],
      }],
    };
  }
  function src(ruta) { return imagenesBorrador[ruta] || ruta; }
  function whatsapp(numero) { var d = String(numero || '').replace(/\D/g, ''); return d.indexOf('593') === 0 ? d : '593' + d.replace(/^0/, ''); }
  function idDesdeRuta() {
    if (params.get('c')) return params.get('c');
    var m = location.pathname.match(/\/([a-z0-9-]+)\/?(index\.html)?$/);
    return m && m[1] !== 'sheratonquito-restaurantes.github.io' ? m[1] : '';
  }

  function cargarDatos() {
    if (esBorrador) {
      try {
        var b = JSON.parse(localStorage.getItem('catalogo-borrador') || 'null');
        if (b && b.datos) {
          imagenesBorrador = b.imagenes || {};
          $('#borrador-aviso').hidden = false;
          return Promise.resolve({ datos: migrar(b.datos), catalogo: b.catalogo, temporada: b.temporada });
        }
      } catch (e) { /* sin borrador */ }
    }
    return fetch('data/catalogo.json', { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('No se pudo leer el catálogo (' + r.status + ')');
      return r.json();
    }).then(function (d) { return { datos: migrar(d), catalogo: idDesdeRuta() }; });
  }

  /* ════════════ Tema y logos ════════════ */
  var FAVICON = 'assets/logos/favicon-sheraton.png';
  var LOGO_CLARO = 'assets/logos/sheraton-blanco.png', LOGO_OSCURO = 'assets/logos/sheraton-negro.png';
  var logoTema = LOGO_CLARO;
  $$('[data-anio]').forEach(function (e) { e.textContent = new Date().getFullYear(); });

  function aplicarTema() {
    var tema = (window.TEMAS || {})[C.tema] || (window.TEMAS || {})['noche-dorada'];
    var r = document.documentElement.style;
    if (tema) {
      var v = tema.v;
      r.setProperty('--fondo', v.fondo); r.setProperty('--barra', v.barra); r.setProperty('--texto-barra', v.textoBarra);
      r.setProperty('--acento', v.acento); r.setProperty('--acento-claro', v.acentoClaro); r.setProperty('--acento-texto', v.acentoTexto);
      r.setProperty('--tapa', v.tapa); r.setProperty('--tapa-texto', v.tapaTexto); r.setProperty('--oscura', v.oscura);
      r.setProperty('--foto', v.foto); r.setProperty('--tinta', v.tinta); r.setProperty('--papel-tema', v.papel);
      var meta = $('meta[name=theme-color]'); if (meta) meta.setAttribute('content', 'rgb(' + v.barra + ')');
    }
    var L = C.logos || {};
    var claro = src(L.claro || LOGO_CLARO), oscuro = src(L.oscuro || LOGO_OSCURO);
    logoTema = tema && tema.logo === 'oscuro' ? oscuro : claro;
    $$('[data-logo="tema"]').forEach(function (i) { i.src = logoTema; });
    $$('[data-logo="oscuro"]').forEach(function (i) { i.src = oscuro; });
    C._secundario = tema && tema.logo === 'oscuro' ? (L.secundarioOscuro || L.secundario) : L.secundario;
    C._secundarioPapel = L.secundarioOscuro || '';
    // Favicon: el del catálogo si lo cambiaron; si no, el general del sitio; si no, el del hotel.
    var fav = $('#favicon'); if (fav) fav.href = src(C.favicon || (D && D.favicon) || FAVICON);
  }

  /* ════════════ Formularios ════════════ */
  function urlFormulario(id) {
    var f = (C.formularios || []).filter(function (x) { return x.id === id; })[0];
    return f && FORMS_OK.test(f.url) ? f.url : '';
  }
  function resolverVinculo(p, s) {
    if (p && p.vinculo && FORMS_OK.test(p.vinculo)) return p.vinculo;
    return (p && urlFormulario(p.formulario)) || (s && urlFormulario(s.formulario)) || urlFormulario(C.formulario) ||
      ((C.formularios || []).map(function (f) { return f.url; }).filter(function (u) { return FORMS_OK.test(u); })[0] || '');
  }

  /* ════════════ Construcción de la página ════════════ */
  function pintarBienvenida() {
    var bv = T.bienvenida || {};
    $('#bv-sobretitulo').textContent = bv.sobretitulo || '';
    $('#bv-titulo').textContent = bv.titulo || C.nombre || 'Catálogo';
    $('#bv-fecha').textContent = bv.fecha || '';
    var av = D.aviso || {};
    $('#av-titulo').textContent = av.titulo || 'Protección de datos personales';
    $('#av-texto').innerHTML = enlazar(av.texto || '');
    $('#av-derechos').innerHTML = enlazar(av.derechos || '');
    if (av.casilla) $('#av-casilla').textContent = av.casilla;
    document.title = (bv.titulo || C.nombre || 'Catálogo') + ' · Sheraton Quito';
  }

  function paginaFoto(p, sec, primera) {
    var a = ['class="page page-foto"', 'data-tema="' + esc(normalizar(sec.efecto)) + '"'];
    if (primera) a.push('data-seccion="' + esc(sec.id) + '"');
    if (p.reservar) {
      a.push('data-reservar="1"', 'data-vinculo="' + esc(resolverVinculo(p, sec)) + '"');
      if (p.boton) a.push('data-boton="' + esc(p.boton) + '"');
    }
    return '<div ' + a.join(' ') + '><img data-src="' + esc(src(p.imagen)) + '" alt="' + esc(p.descripcion || '') + '"></div>';
  }

  function construirLibro() {
    var h = [], pt = T.portada || {}, ca = T.carta || {}, cp = T.contraportada || {}, M = C.menus || {};
    var conMenus = M.mostrar !== false && (M.items || []).length > 0;
    var conContacto = (C.telefonos || []).length > 0;
    var secciones = (T.secciones || []).filter(function (s) { return (s.paginas || []).length; });
    var efectoTapa = esc(normalizar(T.efectoPortada));

    h.push('<div class="page page-tapa" data-density="hard" data-tema="' + efectoTapa + '" data-seccion="portada"><div class="tapa">' +
      '<img src="' + esc(logoTema) + '" alt="Sheraton Quito Hotel" class="tapa-logo"><div class="tapa-linea"></div>' +
      '<p class="sobretitulo">' + esc(pt.sobretitulo) + '</p><h2>' + esc(pt.titulo) + (pt.subtitulo ? '<br><i>' + esc(pt.subtitulo) + '</i>' : '') + '</h2>' +
      '<p class="tapa-fecha">' + esc(pt.fecha) + '</p>' + (C._secundario ? '<img src="' + esc(src(C._secundario)) + '" alt="" class="tapa-bakery">' : '') +
      '<p class="tapa-pista">Deslice o toque la esquina para abrir →</p></div></div>');

    h.push('<div class="page page-papel" data-tema="ninguno" data-seccion="bienvenida"><div class="hoja hoja-carta">' +
      '<p class="sobretitulo oscuro">' + esc(ca.sobretitulo) + '</p><h3>' + esc(ca.titulo) + (ca.subtitulo ? '<br><i>' + esc(ca.subtitulo) + '</i>' : '') + '</h3>' +
      (ca.parrafos || []).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') +
      '<div class="firma"><img src="' + esc(src((C.logos || {}).oscuro || LOGO_OSCURO)) + '" alt="Sheraton Quito Hotel"></div></div></div>');

    var indice = secciones.map(function (s) {
      return '<li><button data-ir="' + esc(s.id) + '"><span>' + esc(s.icono || '📖') + '</span><b>' + esc(s.nombre) + '</b><em>' + esc(s.descripcion || '') + '</em></button></li>';
    }).join('') +
      (conMenus ? '<li><button data-ir="menus"><span>🍽️</span><b>' + esc(M.titulo || 'Menús') + '</b><em>' + esc(M.sobretitulo || '') + '</em></button></li>' : '') +
      '<li><button data-ir="reservar"><span>📅</span><b>Solicitar</b><em>En menos de 3 minutos</em></button></li>' +
      (conContacto ? '<li><button data-ir="contacto"><span>📞</span><b>Contacto</b><em>WhatsApp</em></button></li>' : '');
    h.push('<div class="page page-papel" data-tema="ninguno" data-seccion="indice"><div class="hoja"><p class="sobretitulo oscuro">Contenido</p>' +
      '<h3>' + esc(T.indiceTitulo || '¿Qué le gustaría') + '<br><i>' + esc(T.indiceSubtitulo || 'conocer?') + '</i></h3><ul class="indice">' + indice + '</ul></div></div>');

    secciones.forEach(function (s) { s.paginas.forEach(function (p, i) { h.push(paginaFoto(p, s, i === 0)); }); });

    if (conMenus) {
      h.push('<div class="page page-papel" data-tema="ninguno" data-seccion="menus"><div class="hoja"><p class="sobretitulo oscuro">' + esc(M.sobretitulo || '') + '</p>' +
        '<h3>' + esc(M.titulo || 'Nuestros menús') + '</h3>' +
        (M.items || []).map(function (m) {
          return '<div class="menu-item"><div><b>' + esc(m.nombre) + '</b><em>' + esc(m.detalle) + '</em></div><span class="precio">' + esc(m.precio) + '</span>' +
            '<button class="mini-reservar" data-abrir-reserva data-vinculo="' + esc(resolverVinculo(m, null)) + '">Reservar</button></div>';
        }).join('') +
        '<p class="nota">' + esc(M.nota) + '</p></div></div>');
    }

    h.push('<div class="page page-oscura" data-tema="ninguno" data-seccion="reservar"><div class="hoja hoja-oscura"><p class="sobretitulo">Solicitudes en línea</p>' +
      '<h3>Solicite en<br><i>3 pasos</i></h3><ol class="pasos"><li><b>1</b>Elija lo que le interesa del catálogo.</li>' +
      '<li><b>2</b>Pulse «Reservar» o abra el formulario.</li><li><b>3</b>Déjenos su nombre, correo y WhatsApp.</li></ol>' +
      '<button class="boton boton-dorado" data-abrir-reserva data-vinculo="' + esc(resolverVinculo(null, null)) + '">📅 Abrir el formulario</button>' +
      '<p class="nota claro">Su solicitud queda confirmada cuando nuestro equipo se la confirme por WhatsApp o correo.</p></div></div>');

    if (conContacto) {
      h.push('<div class="page page-papel" data-tema="ninguno" data-seccion="contacto"><div class="hoja"><p class="sobretitulo oscuro">Estamos para servirle</p>' +
        '<h3><i>Contacto</i></h3><ul class="contactos">' +
        (C.telefonos || []).map(function (t) {
          return '<li><a href="https://wa.me/' + whatsapp(t.numero) + '" target="_blank" rel="noopener"><span><b>' + esc(t.lugar) + '</b><br>' + esc(t.numero) + '</span><small>WhatsApp ↗</small></a></li>';
        }).join('') + '</ul>' +
        (C._secundarioPapel ? '<img src="' + esc(src(C._secundarioPapel)) + '" alt="" class="contacto-bakery">' : '') + '</div></div>');
    }

    // La revista necesita un número par de páginas (portada y contraportada rígidas).
    if ((h.length + 1) % 2 === 1) {
      h.push('<div class="page page-papel" data-tema="ninguno"><div class="hoja hoja-relleno">' +
        '<img src="' + esc(src((C.logos || {}).oscuro || LOGO_OSCURO)) + '" alt="Sheraton Quito Hotel"><p class="sobretitulo oscuro">' + esc(C.nombre || '') + '</p><p>Gracias por visitarnos</p></div></div>');
    }

    h.push('<div class="page page-tapa" data-density="hard" data-tema="' + efectoTapa + '" data-seccion="fin"><div class="tapa">' +
      '<p class="sobretitulo">' + esc(cp.sobretitulo) + '</p><h2>' + (cp.titulo ? '<i>' + esc(cp.titulo) + '</i>' : '') + (cp.subtitulo ? '<br>' + esc(cp.subtitulo) : '') + '</h2>' +
      '<div class="tapa-linea"></div><img src="' + esc(logoTema) + '" alt="Sheraton Quito Hotel" class="tapa-logo pequeno"></div></div>');

    $('#libro').innerHTML = h.join('');

    $('#barra-nav').innerHTML =
      '<button data-inicio class="nav-inicio" aria-label="Inicio">🏠<span class="txt"> Inicio</span></button>' +
      '<button data-ir="indice" class="nav-indice">Índice</button>' +
      secciones.map(function (s) { return '<button data-ir="' + esc(s.id) + '" aria-label="' + esc(s.nombre) + '">' + esc(s.icono || '') + '<span class="txt"> ' + esc(s.nombre) + '</span></button>'; }).join('') +
      (conMenus ? '<button data-ir="menus" aria-label="Menús">🍽️<span class="txt"> Menús</span></button>' : '') +
      '<button class="nav-reservar" data-abrir-reserva data-vinculo="' + esc(resolverVinculo(null, null)) + '" aria-label="Reservar">📅<span class="txt"> Reservar</span></button>';
  }

  /* ════════════ Bienvenida con aviso de datos ════════════ */
  var libro = null;
  var claveAcepto = 'catalogo-acepto';
  $('#acepto-datos').addEventListener('change', function () {
    $('#aceptar').disabled = !this.checked;
    $('#bienvenida').classList.toggle('lista', this.checked);
  });
  $('#aceptar').addEventListener('click', function () {
    if (!$('#acepto-datos').checked) return;
    try { sessionStorage.setItem(claveAcepto, '1'); } catch (e) { /* sin almacenamiento */ }
    $('#bienvenida').classList.add('oculta');
  });
  try { if (sessionStorage.getItem(claveAcepto) === '1') $('#bienvenida').classList.add('oculta'); } catch (e) { /* nada */ }

  /* ════════════ La revista ════════════ */
  var paginas = [];
  var horizontal = false;
  function cargarCerca(i) {
    for (var k = Math.max(0, i - 2); k <= Math.min(paginas.length - 1, i + 4); k++) {
      var img = $('img[data-src]', paginas[k]);
      if (img && !img.getAttribute('src')) {
        img.addEventListener('load', function () { this.classList.add('cargada'); });
        img.src = img.getAttribute('data-src');
      }
    }
  }
  function visibles(i) {
    if (!horizontal || i === 0) return [i];
    var izq = i % 2 === 1 ? i : i - 1;
    return [izq, izq + 1].filter(function (n) { return n < paginas.length; });
  }
  function indiceDe(seccion) {
    for (var i = 0; i < paginas.length; i++) if (paginas[i].getAttribute('data-seccion') === seccion) return i;
    return 0;
  }
  function alCambiar(i) {
    cargarCerca(i);
    var vis = visibles(i);
    var temas = vis.map(function (n) { return paginas[n].getAttribute('data-tema'); }).filter(function (t) { return t && t !== 'ninguno'; });
    ponerModo(temas[temas.length - 1] || 'ninguno');
    var pie = $('.pie');
    $$('.dinamico', pie).forEach(function (b) { b.remove(); });
    vis.forEach(function (n) {
      var p = paginas[n], img = $('img[data-src]', p);
      if (img) {
        var z = document.createElement('button');
        z.className = 'boton boton-claro dinamico'; z.textContent = '🔍';
        z.title = 'Ver en grande'; z.setAttribute('aria-label', 'Ver la página en grande');
        z.addEventListener('click', function () { abrirZoom(img); });
        pie.appendChild(z);
      }
      if (p.getAttribute('data-reservar') === '1') {
        var r = document.createElement('button');
        r.className = 'boton boton-dorado boton-flotante dinamico';
        r.textContent = p.getAttribute('data-boton') || (vis.length > 1 ? '📅 Reservar ' + (n === vis[0] ? '◂' : '▸') : '📅 Reservar este');
        r.addEventListener('click', function () { abrirReserva(p.getAttribute('data-vinculo')); });
        pie.appendChild(r);
      }
    });
    pie.classList.toggle('con-reserva', !!$('.boton-flotante', pie));
    pie.classList.toggle('con-botones', !!$('.dinamico', pie));
    $('#contador').textContent = (vis[0] + 1) + (vis.length > 1 ? '–' + (vis[1] + 1) : '') + ' / ' + paginas.length;
    $$('.barra-nav [data-ir]').forEach(function (b) { b.classList.remove('activo'); });
    var sec = seccionActual(vis[vis.length - 1]);
    var activo = $('.barra-nav [data-ir="' + sec + '"]'); if (activo) activo.classList.add('activo');
    try { history.replaceState(null, '', location.search + '#p' + (i + 1)); } catch (e) { /* nada */ }
  }
  function seccionActual(i) {
    for (var k = i; k >= 0; k--) {
      var s = paginas[k].getAttribute('data-seccion');
      if (s && $('.barra-nav [data-ir="' + s + '"]')) return s;
    }
    return '';
  }
  function crearLibro() {
    paginas = $$('#libro .page');
    var marco = $('.escenario').getBoundingClientRect();
    var aw = marco.width, ah = marco.height - 12;
    if (aw < 50 || ah < 50) { setTimeout(crearLibro, 300); return; }
    horizontal = window.innerWidth >= 900 && aw / ah > 1.15;
    var ph = ah, pw = ph * 0.8;
    if (horizontal && pw * 2 > aw - 130) { pw = (aw - 130) / 2; ph = pw * 1.25; }
    if (!horizontal && pw > aw - 16) { pw = aw - 16; ph = pw * 1.25; }
    pw = Math.floor(pw); ph = Math.floor(ph);
    $('#libro-marco').style.width = (horizontal ? pw * 2 : pw) + 'px';
    $('#libro-marco').style.height = ph + 'px';
    var inicio = parseInt((location.hash.match(/^#p(\d+)$/) || [])[1] || '1', 10) - 1;
    libro = new St.PageFlip($('#libro'), {
      width: pw, height: ph, size: 'fixed', showCover: true, usePortrait: !horizontal,
      maxShadowOpacity: 0.45, mobileScrollSupport: false, flippingTime: 850, drawShadow: true,
      startPage: Math.max(0, Math.min(paginas.length - 1, inicio)), autoSize: false, swipeDistance: 25,
    });
    libro.loadFromHTML(paginas);
    libro.on('flip', function (e) { alCambiar(e.data); });
    libro.on('changeOrientation', function () { alCambiar(libro.getCurrentPageIndex()); });
    alCambiar(libro.getCurrentPageIndex());
  }
  var tamano = window.innerWidth + 'x' + window.innerHeight, espera;
  window.addEventListener('resize', function () {
    clearTimeout(espera);
    espera = setTimeout(function () {
      var a = tamano.split('x'), b = [window.innerWidth, window.innerHeight];
      if (Math.abs(a[0] - b[0]) > 80 || Math.abs(a[1] - b[1]) > 160) location.reload();
    }, 350);
  });

  function ir(seccion) { if (libro) libro.flip(indiceDe(seccion)); }
  ['mousedown', 'touchstart', 'pointerdown'].forEach(function (tipo) {
    document.addEventListener(tipo, function (e) {
      if (e.target.closest && e.target.closest('#libro button, #libro a')) e.stopPropagation();
    }, true);
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ir]');
    if (b) { e.preventDefault(); e.stopPropagation(); ir(b.getAttribute('data-ir')); return; }
    var r = e.target.closest('[data-abrir-reserva]');
    if (r) { e.preventDefault(); e.stopPropagation(); abrirReserva(r.getAttribute('data-vinculo')); }
  }, true);
  $('#anterior').addEventListener('click', function () { libro && libro.flipPrev(); });
  $('#siguiente').addEventListener('click', function () { libro && libro.flipNext(); });
  document.addEventListener('keydown', function (e) {
    if (!$('#modal-reserva').hidden || !$('#modal-zoom').hidden || !$('#modal-qr').hidden) { if (e.key === 'Escape') cerrarModales(); return; }
    if (e.key === 'ArrowRight') libro && libro.flipNext();
    if (e.key === 'ArrowLeft') libro && libro.flipPrev();
  });

  /* ════════════ Formulario, zoom, inicio y QR ════════════ */
  function abrirReserva(vinculo) {
    var u = vinculo && FORMS_OK.test(vinculo) ? vinculo : resolverVinculo(null, null);
    if (!u) return;
    $('#reserva-forms').src = u + (u.indexOf('?') >= 0 ? '&' : '?') + 'embed=true';
    $('#reserva-externa').href = u;
    $('#modal-reserva').hidden = false;
  }
  function abrirZoom(img) {
    $('#zoom-img').src = img.getAttribute('data-src'); $('#zoom-img').alt = img.alt;
    $('.zoom-scroll').classList.remove('ampliada');
    $('#modal-zoom').hidden = false;
  }
  $('#zoom-img').addEventListener('click', function () { $('.zoom-scroll').classList.toggle('ampliada'); });
  function volverAlInicio() {
    cerrarModales();
    if (libro) { libro.turnToPage(0); alCambiar(0); }
    $('#bienvenida').classList.remove('oculta');
  }
  function abrirQR() {
    var raiz = location.origin + location.pathname.replace(/[^/]*$/, '');
    var url = (C && C.enlaceCorto) || raiz + (C && D && C.id !== D.principal ? C.id + '/' : '');
    var qr = qrcode(0, 'M'); qr.addData(url); qr.make();
    var datos = qr.createDataURL(10, 4);
    $('#qr-img').src = datos; $('#qr-descargar').href = datos; $('#qr-url').textContent = url;
    $('#modal-qr').hidden = false;
  }
  $('#boton-qr').addEventListener('click', abrirQR);
  document.addEventListener('click', function (e) { if (e.target.closest('[data-inicio]')) { e.preventDefault(); volverAlInicio(); } });
  function cerrarModales() {
    $('#modal-reserva').hidden = true; $('#modal-zoom').hidden = true; $('#modal-qr').hidden = true;
    $('#reserva-forms').src = 'about:blank';
  }
  $$('[data-cerrar]').forEach(function (b) { b.addEventListener('click', cerrarModales); });
  $$('.modal').forEach(function (m) { m.addEventListener('click', function (e) { if (e.target === m) cerrarModales(); }); });

  /* ════════════ Arranque ════════════ */
  var listo = new Promise(function (res) { if (document.readyState === 'complete') res(); else window.addEventListener('load', res); });
  cargarDatos().then(function (r) {
    D = r.datos;
    var cats = D.catalogos || [];
    C = cats.filter(function (c) { return c.id === r.catalogo; })[0] || cats.filter(function (c) { return c.id === D.principal; })[0] || cats[0];
    if (!C) throw new Error('No hay catálogos.');
    var temporadas = C.temporadas || [];
    T = temporadas.filter(function (t) { return t.id === (r.temporada || C.activa); })[0] || temporadas.filter(function (t) { return t.id === C.activa; })[0] || temporadas[0];
    if (!T) throw new Error('El catálogo no tiene temporadas.');
    claveAcepto = 'catalogo-acepto';
    aplicarTema();
    pintarBienvenida();
    construirLibro();
    ponerModo(T.efectoPortada);
    return listo;
  }).then(crearLibro).catch(function (e) {
    console.error(e);
    $('.escenario').innerHTML = '<p class="error-carga">No pudimos cargar el catálogo en este momento. Intente de nuevo en unos minutos.</p>';
  });
})();
