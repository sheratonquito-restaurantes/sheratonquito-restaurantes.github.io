/* Catálogo de temporada · Restaurantes y Bares Sheraton Quito
 * Todo el contenido viene de data/catalogo.json (se edita desde /admin).
 * Revista con StPageFlip, efectos por sección (nieve, brindis, confeti, corazones) y
 * botones que abren el Microsoft Forms (con el menú ya marcado si la página tiene vínculo prellenado). */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  // Convierte correos y direcciones web de un texto (ya escapado) en enlaces.
  var enlazar = function (t) {
    return esc(t)
      .replace(/https?:\/\/[^\s<]+[^\s<.,;)]/g, function (u) { return '<a href="' + u + '" target="_blank" rel="noopener">' + u.replace(/^https?:\/\//, '') + '</a>'; })
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+[\w]/g, function (m) { return '<a href="mailto:' + m + '">' + m + '</a>'; });
  };

  /* ════════════ Efectos: nieve, brindis, confeti y corazones ════════════ */
  var lienzo = $('#efectos'), ctx = lienzo.getContext('2d');
  var W = 0, H = 0, DPR = 1, modo = 'ninguno';
  var copos = [], burbujas = [], confeti = [], corazones = [];
  var DORADOS = ['#e3cc9c', '#c9a96e', '#f6e7c1', '#b8924f', '#ffffff'];
  var CARNAVAL = ['#e63946', '#f4a261', '#ffd166', '#06d6a0', '#118ab2', '#9b5de5', '#ff70a6'];

  function medir() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    lienzo.width = W * DPR; lienzo.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  function nuevoCopo(arriba) {
    var capa = Math.random();
    return { x: Math.random() * W, y: arriba ? -10 - Math.random() * H * 0.3 : Math.random() * H, r: 1 + capa * 3.2, vy: 0.4 + capa * 1.4, fase: Math.random() * 6.28, amp: 0.3 + Math.random() * 0.8, giro: Math.random() * 6.28, cristal: capa > 0.82, a: 0.45 + capa * 0.5 };
  }
  function dibujarCristal(c) {
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.giro);
    ctx.strokeStyle = 'rgba(255,255,255,' + c.a + ')'; ctx.lineWidth = 1.1;
    var L = c.r * 2.6;
    for (var i = 0; i < 6; i++) {
      ctx.rotate(Math.PI / 3);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, L);
      ctx.moveTo(0, L * 0.55); ctx.lineTo(L * 0.25, L * 0.75);
      ctx.moveTo(0, L * 0.55); ctx.lineTo(-L * 0.25, L * 0.75);
      ctx.stroke();
    }
    ctx.restore();
  }
  function nieve(t) {
    var objetivo = modo === 'nieve' ? Math.min(220, Math.round(W * H / 7000)) : 0;
    while (copos.length < objetivo) copos.push(nuevoCopo(copos.length > objetivo * 0.5));
    for (var i = copos.length - 1; i >= 0; i--) {
      var c = copos[i];
      c.y += c.vy; c.x += Math.sin(t / 1400 + c.fase) * c.amp; c.giro += 0.004;
      if (c.y > H + 12) { if (copos.length > objetivo) { copos.splice(i, 1); continue; } copos[i] = nuevoCopo(true); continue; }
      if (c.cristal) { dibujarCristal(c); continue; }
      var g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
      g.addColorStop(0, 'rgba(255,255,255,' + c.a + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, 6.28); ctx.fill();
    }
  }
  function nuevaBurbuja(abajo) {
    var r = 1.5 + Math.random() * 4.5;
    return { x: Math.random() * W, y: abajo ? H + 10 + Math.random() * 40 : Math.random() * H, r: r, vy: 0.5 + r * 0.22 + Math.random() * 0.6, fase: Math.random() * 6.28, amp: 0.2 + Math.random() * 0.5 };
  }
  function nuevoConfeti(arriba, colores) {
    return { x: Math.random() * W, y: arriba ? -20 - Math.random() * H * 0.4 : Math.random() * H, w: 4 + Math.random() * 5, h: 7 + Math.random() * 7, vy: 0.9 + Math.random() * 1.3, giro: Math.random() * 6.28, vg: (Math.random() - 0.5) * 0.12, vuelta: Math.random() * 6.28, color: colores[(Math.random() * colores.length) | 0] };
  }
  function moverConfeti(lista, n, colores) {
    while (lista.length < n) lista.push(nuevoConfeti(lista.length > n * 0.5, colores));
    for (var j = lista.length - 1; j >= 0; j--) {
      var c = lista[j];
      c.y += c.vy; c.giro += c.vg; c.vuelta += 0.06; c.x += Math.sin(c.vuelta) * 0.6;
      if (c.y > H + 20) { if (lista.length > n) { lista.splice(j, 1); continue; } lista[j] = nuevoConfeti(true, colores); continue; }
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.giro); ctx.scale(Math.cos(c.vuelta), 1);
      ctx.fillStyle = c.color; ctx.globalAlpha = 0.9; ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  var confetiCarnaval = [];
  function brindis(t) {
    var activo = modo === 'brindis';
    var nB = activo ? Math.min(90, Math.round(W * H / 14000)) : 0;
    while (burbujas.length < nB) burbujas.push(nuevaBurbuja(burbujas.length > nB * 0.5));
    for (var i = burbujas.length - 1; i >= 0; i--) {
      var b = burbujas[i];
      b.y -= b.vy; b.x += Math.sin(t / 600 + b.fase) * b.amp;
      if (b.y < -12) { if (burbujas.length > nB) { burbujas.splice(i, 1); continue; } burbujas[i] = nuevaBurbuja(true); continue; }
      ctx.strokeStyle = 'rgba(246,231,193,.75)'; ctx.lineWidth = 1;
      ctx.fillStyle = 'rgba(227,204,156,.14)';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.28); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.beginPath(); ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, Math.max(0.6, b.r * 0.25), 0, 6.28); ctx.fill();
    }
    moverConfeti(confeti, activo ? Math.min(70, Math.round(W * H / 18000)) : 0, DORADOS);
    moverConfeti(confetiCarnaval, modo === 'confeti' ? Math.min(140, Math.round(W * H / 9000)) : 0, CARNAVAL);
  }
  function nuevoCorazon(arriba) {
    return { x: Math.random() * W, y: arriba ? -20 - Math.random() * H * 0.4 : Math.random() * H, s: 5 + Math.random() * 9, vy: 0.5 + Math.random() * 1.1, fase: Math.random() * 6.28, a: 0.45 + Math.random() * 0.45, color: Math.random() < 0.5 ? '#e63962' : '#ff8fab' };
  }
  function amor(t) {
    var n = modo === 'corazones' ? Math.min(60, Math.round(W * H / 20000)) : 0;
    while (corazones.length < n) corazones.push(nuevoCorazon(corazones.length > n * 0.5));
    for (var i = corazones.length - 1; i >= 0; i--) {
      var c = corazones[i];
      c.y += c.vy; c.x += Math.sin(t / 900 + c.fase) * 0.5;
      if (c.y > H + 20) { if (corazones.length > n) { corazones.splice(i, 1); continue; } corazones[i] = nuevoCorazon(true); continue; }
      ctx.save(); ctx.translate(c.x, c.y); ctx.globalAlpha = c.a; ctx.fillStyle = c.color;
      ctx.beginPath(); ctx.moveTo(0, c.s * 0.3);
      ctx.bezierCurveTo(0, 0, -c.s, 0, -c.s, c.s * 0.35); ctx.bezierCurveTo(-c.s, c.s * 0.8, 0, c.s * 1.1, 0, c.s * 1.4);
      ctx.bezierCurveTo(0, c.s * 1.1, c.s, c.s * 0.8, c.s, c.s * 0.35); ctx.bezierCurveTo(c.s, 0, 0, 0, 0, c.s * 0.3);
      ctx.fill(); ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  function animar(t) {
    ctx.clearRect(0, 0, W, H);
    nieve(t); brindis(t); amor(t);
    requestAnimationFrame(animar);
  }
  // Compatibilidad con los nombres anteriores.
  var ALIAS = { navidad: 'nieve', anonuevo: 'brindis', carnaval: 'confeti' };
  function ponerModo(m) { modo = ALIAS[m] || m || 'ninguno'; document.body.dataset.tema = modo; }
  medir(); window.addEventListener('resize', medir);
  if (!reducido) requestAnimationFrame(animar);

  /* ════════════ Datos ════════════ */
  var params = new URLSearchParams(location.search);
  var esBorrador = params.get('borrador') === '1';
  var imagenesBorrador = {};
  var D = null, T = null; // datos completos y temporada mostrada

  function src(ruta) { return imagenesBorrador[ruta] || ruta; }
  function whatsapp(numero) {
    var d = String(numero || '').replace(/\D/g, '');
    if (d.indexOf('593') === 0) return d;
    return '593' + d.replace(/^0/, '');
  }

  function cargarDatos() {
    if (esBorrador) {
      try {
        var b = JSON.parse(localStorage.getItem('catalogo-borrador') || 'null');
        if (b && b.datos) {
          imagenesBorrador = b.imagenes || {};
          $('#borrador-aviso').hidden = false;
          return Promise.resolve({ datos: b.datos, temporada: b.temporada });
        }
      } catch (e) { /* sin borrador */ }
    }
    return fetch('data/catalogo.json', { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('No se pudo leer el catálogo (' + r.status + ')');
      return r.json();
    }).then(function (datos) { return { datos: datos, temporada: datos.activa }; });
  }

  /* ════════════ Construcción de la página ════════════ */
  function pintarBienvenida() {
    var bv = T.bienvenida || {};
    $('#bv-sobretitulo').textContent = bv.sobretitulo || 'Restaurantes y Bares';
    $('#bv-titulo').textContent = bv.titulo || 'Catálogo de temporada';
    $('#bv-fecha').textContent = bv.fecha || '';
    var av = D.aviso || {};
    $('#av-titulo').textContent = av.titulo || 'Protección de datos personales';
    $('#av-texto').innerHTML = enlazar(av.texto || '');
    $('#av-derechos').innerHTML = enlazar(av.derechos || '');
    if (av.casilla) $('#av-casilla').textContent = av.casilla;
    document.title = (bv.titulo || 'Catálogo') + ' · Restaurantes y Bares · Sheraton Quito';
  }

  function paginaFoto(p, sec, primera) {
    var a = ['class="page page-foto"', 'data-tema="' + esc(sec.efecto || 'ninguno') + '"'];
    if (primera) a.push('data-seccion="' + esc(sec.id) + '"');
    if (p.reservar) {
      a.push('data-reservar="1"', 'data-vinculo="' + esc(p.vinculo || '') + '"', 'data-titulo="' + esc(p.titulo || sec.nombre) + '"');
      if (p.boton) a.push('data-boton="' + esc(p.boton) + '"');
    }
    return '<div ' + a.join(' ') + '><img data-src="' + esc(src(p.imagen)) + '" alt="' + esc(p.descripcion || '') + '"></div>';
  }

  function construirLibro() {
    var h = [], pt = T.portada || {}, ca = T.carta || {}, cp = T.contraportada || {}, M = D.menus || {};
    var secciones = (T.secciones || []).filter(function (s) { return (s.paginas || []).length; });

    h.push('<div class="page page-tapa" data-density="hard" data-tema="' + esc(T.efectoPortada || 'ninguno') + '" data-seccion="portada"><div class="tapa">' +
      '<img src="assets/logos/sheraton-blanco.png" alt="Sheraton Quito Hotel" class="tapa-logo"><div class="tapa-linea"></div>' +
      '<p class="sobretitulo">' + esc(pt.sobretitulo) + '</p><h2>' + esc(pt.titulo) + (pt.subtitulo ? '<br><i>' + esc(pt.subtitulo) + '</i>' : '') + '</h2>' +
      '<p class="tapa-fecha">' + esc(pt.fecha) + '</p><img src="assets/logos/bakery-blanco.png" alt="Bakery & Deli by Cook\'s" class="tapa-bakery">' +
      '<p class="tapa-pista">Deslice o toque la esquina para abrir →</p></div></div>');

    h.push('<div class="page page-papel" data-tema="ninguno" data-seccion="bienvenida"><div class="hoja hoja-carta">' +
      '<p class="sobretitulo oscuro">' + esc(ca.sobretitulo) + '</p><h3>' + esc(ca.titulo) + (ca.subtitulo ? '<br><i>' + esc(ca.subtitulo) + '</i>' : '') + '</h3>' +
      (ca.parrafos || []).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') +
      '<div class="firma"><img src="assets/logos/sheraton-negro.png" alt="Sheraton Quito Hotel"></div></div></div>');

    var indice = secciones.map(function (s) {
      return '<li><button data-ir="' + esc(s.id) + '"><span>' + esc(s.icono || '📖') + '</span><b>' + esc(s.nombre) + '</b><em>' + esc(s.descripcion || '') + '</em></button></li>';
    }).join('') +
      '<li><button data-ir="menus"><span>🍽️</span><b>Menús de todo el año</b><em>Ejecutivo, del chef y brunch</em></button></li>' +
      '<li><button data-ir="reservar"><span>📅</span><b>Reservar</b><em>En menos de 3 minutos</em></button></li>' +
      '<li><button data-ir="contacto"><span>📞</span><b>Contacto</b><em>WhatsApp de reservas</em></button></li>';
    h.push('<div class="page page-papel" data-tema="ninguno" data-seccion="indice"><div class="hoja"><p class="sobretitulo oscuro">Contenido</p>' +
      '<h3>¿Qué le gustaría<br><i>celebrar?</i></h3><ul class="indice">' + indice + '</ul></div></div>');

    secciones.forEach(function (s) { s.paginas.forEach(function (p, i) { h.push(paginaFoto(p, s, i === 0)); }); });

    h.push('<div class="page page-papel" data-tema="ninguno" data-seccion="menus"><div class="hoja"><p class="sobretitulo oscuro">' + esc(M.sobretitulo || 'Todo el año') + '</p>' +
      '<h3>' + esc(M.titulo || 'Nuestros menús') + '</h3>' +
      (M.items || []).map(function (m) {
        return '<div class="menu-item"><div><b>' + esc(m.nombre) + '</b><em>' + esc(m.detalle) + '</em></div><span class="precio">' + esc(m.precio) + '</span>' +
          '<button class="mini-reservar" data-abrir-reserva data-vinculo="' + esc(m.vinculo || '') + '" data-titulo="' + esc(m.nombre) + '">Reservar</button></div>';
      }).join('') +
      '<p class="nota">' + esc(M.nota) + '</p></div></div>');

    h.push('<div class="page page-oscura" data-tema="ninguno" data-seccion="reservar"><div class="hoja hoja-oscura"><p class="sobretitulo">Reservas en línea</p>' +
      '<h3>Reserve en<br><i>3 pasos</i></h3><ol class="pasos"><li><b>1</b>Elija el restaurante, la fecha, la hora y las personas.</li>' +
      '<li><b>2</b>Seleccione el menú que le gustó.</li><li><b>3</b>Déjenos su nombre, correo y WhatsApp.</li></ol>' +
      '<button class="boton boton-dorado" data-abrir-reserva data-vinculo="" data-titulo="Solicitud de reserva">📅 Abrir el formulario</button>' +
      '<p class="nota claro">Su reserva queda confirmada cuando nuestro equipo se la confirme por WhatsApp o correo.</p></div></div>');

    h.push('<div class="page page-papel" data-tema="ninguno" data-seccion="contacto"><div class="hoja"><p class="sobretitulo oscuro">Estamos para servirle</p>' +
      '<h3><i>Contacto</i></h3><ul class="contactos">' +
      (D.telefonos || []).map(function (t) {
        return '<li><a href="https://wa.me/' + whatsapp(t.numero) + '" target="_blank" rel="noopener"><span><b>' + esc(t.lugar) + '</b><br>' + esc(t.numero) + '</span><small>WhatsApp ↗</small></a></li>';
      }).join('') +
      '</ul><img src="assets/logos/bakery-gris.png" alt="Bakery & Deli by Cook\'s" class="contacto-bakery"></div></div>');

    // La revista necesita un número par de páginas (portada y contraportada rígidas).
    if ((h.length + 1) % 2 === 1) {
      h.push('<div class="page page-papel" data-tema="ninguno"><div class="hoja hoja-relleno">' +
        '<img src="assets/logos/sheraton-negro.png" alt="Sheraton Quito Hotel"><p class="sobretitulo oscuro">Restaurantes y Bares</p><p>Gracias por visitarnos</p></div></div>');
    }

    h.push('<div class="page page-tapa" data-density="hard" data-tema="' + esc(T.efectoPortada || 'ninguno') + '" data-seccion="fin"><div class="tapa">' +
      '<p class="sobretitulo">' + esc(cp.sobretitulo) + '</p><h2>' + (cp.titulo ? '<i>' + esc(cp.titulo) + '</i>' : '') + (cp.subtitulo ? '<br>' + esc(cp.subtitulo) : '') + '</h2>' +
      '<div class="tapa-linea"></div><img src="assets/logos/sheraton-blanco.png" alt="Sheraton Quito Hotel" class="tapa-logo pequeno"></div></div>');

    $('#libro').innerHTML = h.join('');

    // Barra superior
    $('#barra-nav').innerHTML =
      '<button data-inicio class="nav-inicio" aria-label="Inicio">🏠<span class="txt"> Inicio</span></button>' +
      '<button data-ir="indice" class="nav-indice">Índice</button>' +
      secciones.map(function (s) { return '<button data-ir="' + esc(s.id) + '" aria-label="' + esc(s.nombre) + '">' + esc(s.icono || '') + '<span class="txt"> ' + esc(s.nombre) + '</span></button>'; }).join('') +
      '<button data-ir="menus" aria-label="Menús">🍽️<span class="txt"> Menús</span></button>' +
      '<button class="nav-reservar" data-abrir-reserva data-vinculo="" aria-label="Reservar">📅<span class="txt"> Reservar</span></button>';
  }

  /* ════════════ Bienvenida con aviso de datos ════════════ */
  var libro = null;
  $('#acepto-datos').addEventListener('change', function () {
    $('#aceptar').disabled = !this.checked;
    $('#bienvenida').classList.toggle('lista', this.checked);
  });
  $('#aceptar').addEventListener('click', function () {
    if (!$('#acepto-datos').checked) return;
    try { sessionStorage.setItem('catalogo-acepto', '1'); } catch (e) { /* sin almacenamiento */ }
    $('#bienvenida').classList.add('oculta');
  });
  try { if (sessionStorage.getItem('catalogo-acepto') === '1') $('#bienvenida').classList.add('oculta'); } catch (e) { /* nada */ }

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
  var PRIORIDAD = ['confeti', 'brindis', 'corazones', 'nieve'];
  function alCambiar(i) {
    cargarCerca(i);
    var vis = visibles(i);
    var temas = vis.map(function (n) { return ALIAS[paginas[n].getAttribute('data-tema')] || paginas[n].getAttribute('data-tema'); });
    var elegido = 'ninguno';
    for (var k = 0; k < PRIORIDAD.length; k++) if (temas.indexOf(PRIORIDAD[k]) >= 0) { elegido = PRIORIDAD[k]; break; }
    ponerModo(elegido);
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
        r.addEventListener('click', function () { abrirReserva(p.getAttribute('data-vinculo'), p.getAttribute('data-titulo')); });
        pie.appendChild(r);
      }
    });
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
    // Pestaña oculta o ventana sin tamaño todavía: reintentar cuando tenga medidas.
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

  // Si cambia mucho el tamaño (girar el celular), se rehace la revista en la misma página.
  var tamano = window.innerWidth + 'x' + window.innerHeight, espera;
  window.addEventListener('resize', function () {
    clearTimeout(espera);
    espera = setTimeout(function () {
      var nuevo = window.innerWidth + 'x' + window.innerHeight;
      var a = tamano.split('x'), b = nuevo.split('x');
      if (Math.abs(a[0] - b[0]) > 80 || Math.abs(a[1] - b[1]) > 160) location.reload();
    }, 350);
  });

  function ir(seccion) { if (libro) libro.flip(indiceDe(seccion)); }
  // Los botones dentro de las páginas no deben iniciar el "pasar hoja" de la revista.
  ['mousedown', 'touchstart', 'pointerdown'].forEach(function (tipo) {
    document.addEventListener(tipo, function (e) {
      if (e.target.closest && e.target.closest('#libro button, #libro a')) e.stopPropagation();
    }, true);
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ir]');
    if (b) { e.preventDefault(); e.stopPropagation(); ir(b.getAttribute('data-ir')); return; }
    var r = e.target.closest('[data-abrir-reserva]');
    if (r) { e.preventDefault(); e.stopPropagation(); abrirReserva(r.getAttribute('data-vinculo'), r.getAttribute('data-titulo')); }
  }, true);
  $('#anterior').addEventListener('click', function () { libro && libro.flipPrev(); });
  $('#siguiente').addEventListener('click', function () { libro && libro.flipNext(); });
  document.addEventListener('keydown', function (e) {
    if (!$('#modal-reserva').hidden || !$('#modal-zoom').hidden || !$('#modal-qr').hidden) { if (e.key === 'Escape') cerrarModales(); return; }
    if (e.key === 'ArrowRight') libro && libro.flipNext();
    if (e.key === 'ArrowLeft') libro && libro.flipPrev();
  });

  /* ════════════ Formulario de reserva ════════════ */
  function abrirReserva(vinculo, titulo) {
    var u = (vinculo && /^https:\/\/forms\.(cloud\.microsoft|office\.com)\//.test(vinculo)) ? vinculo : (D && D.formsUrl) || 'https://forms.cloud.microsoft/r/SjMkYFTQfn';
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

  /* ════════════ Volver al inicio y código QR ════════════ */
  function volverAlInicio() {
    cerrarModales();
    if (libro) { libro.turnToPage(0); alCambiar(0); }
    $('#bienvenida').classList.remove('oculta');
  }
  function abrirQR() {
    var url = location.origin + location.pathname;
    var qr = qrcode(0, 'M'); qr.addData(url); qr.make();
    var datos = qr.createDataURL(10, 4);
    $('#qr-img').src = datos; $('#qr-descargar').href = datos; $('#qr-url').textContent = url;
    $('#modal-qr').hidden = false;
  }
  $('#boton-qr').addEventListener('click', abrirQR);
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-inicio]')) { e.preventDefault(); volverAlInicio(); }
  });
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
    var temporadas = D.temporadas || [];
    T = temporadas.filter(function (t) { return t.id === r.temporada; })[0] || temporadas[0];
    if (!T) throw new Error('El catálogo no tiene temporadas.');
    pintarBienvenida();
    construirLibro();
    ponerModo(T.efectoPortada);
    return listo;
  }).then(crearLibro).catch(function (e) {
    console.error(e);
    $('#libro').innerHTML = '';
    $('.escenario').innerHTML = '<p class="error-carga">No pudimos cargar el catálogo en este momento. Intente de nuevo en unos minutos.</p>';
  });
})();
