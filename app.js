/* Catálogo de temporada · Restaurantes y Bares Sheraton Quito
 * Revista con páginas que se pasan (StPageFlip), nieve en Navidad, fuegos artificiales en Año Nuevo
 * y botones que abren el Microsoft Forms (con el menú ya marcado cuando hay vínculo prellenado). */
(function () {
  'use strict';
  var C = window.CATALOGO;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ════════════ Efectos: nieve y fuegos artificiales ════════════ */
  var lienzo = $('#efectos'), ctx = lienzo.getContext('2d');
  var W = 0, H = 0, DPR = 1, modo = 'navidad';
  var copos = [];

  function medir() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    lienzo.width = W * DPR; lienzo.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  function nuevoCopo(arriba) {
    var capa = Math.random();
    return {
      x: Math.random() * W, y: arriba ? -10 - Math.random() * H * 0.3 : Math.random() * H,
      r: 1 + capa * 3.2, vy: 0.4 + capa * 1.4, fase: Math.random() * 6.28, amp: 0.3 + Math.random() * 0.8,
      giro: Math.random() * 6.28, cristal: capa > 0.82, a: 0.45 + capa * 0.5,
    };
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
    var objetivo = modo === 'navidad' ? Math.min(220, Math.round(W * H / 7000)) : 0;
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
  /* Año Nuevo: un brindis — burbujas de champaña que suben y confeti dorado que cae. */
  var burbujas = [], confeti = [];
  var DORADOS = ['#e3cc9c', '#c9a96e', '#f6e7c1', '#b8924f', '#ffffff'];
  function nuevaBurbuja(abajo) {
    var r = 1.5 + Math.random() * 4.5;
    return { x: Math.random() * W, y: abajo ? H + 10 + Math.random() * 40 : Math.random() * H, r: r, vy: 0.5 + r * 0.22 + Math.random() * 0.6, fase: Math.random() * 6.28, amp: 0.2 + Math.random() * 0.5 };
  }
  function nuevoConfeti(arriba) {
    return { x: Math.random() * W, y: arriba ? -20 - Math.random() * H * 0.4 : Math.random() * H, w: 4 + Math.random() * 5, h: 7 + Math.random() * 7, vy: 0.9 + Math.random() * 1.3, giro: Math.random() * 6.28, vg: (Math.random() - 0.5) * 0.12, vuelta: Math.random() * 6.28, color: DORADOS[(Math.random() * DORADOS.length) | 0] };
  }
  function brindis(t) {
    var activo = modo === 'anonuevo';
    var nB = activo ? Math.min(90, Math.round(W * H / 14000)) : 0, nC = activo ? Math.min(70, Math.round(W * H / 18000)) : 0;
    while (burbujas.length < nB) burbujas.push(nuevaBurbuja(burbujas.length > nB * 0.5));
    while (confeti.length < nC) confeti.push(nuevoConfeti(confeti.length > nC * 0.5));
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
    for (var j = confeti.length - 1; j >= 0; j--) {
      var c = confeti[j];
      c.y += c.vy; c.giro += c.vg; c.vuelta += 0.06; c.x += Math.sin(c.vuelta) * 0.6;
      if (c.y > H + 20) { if (confeti.length > nC) { confeti.splice(j, 1); continue; } confeti[j] = nuevoConfeti(true); continue; }
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.giro); ctx.scale(Math.cos(c.vuelta), 1);
      ctx.fillStyle = c.color; ctx.globalAlpha = 0.9; ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  function animar(t) {
    ctx.clearRect(0, 0, W, H);
    nieve(t); brindis(t);
    requestAnimationFrame(animar);
  }
  function ponerModo(m) { modo = m; document.body.dataset.tema = m; }
  medir(); window.addEventListener('resize', medir);
  if (!reducido) requestAnimationFrame(animar);

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
  var paginas = $$('#libro .page');
  var horizontal = false;

  function cargarCerca(i) {
    for (var k = Math.max(0, i - 2); k <= Math.min(paginas.length - 1, i + 4); k++) {
      var img = $('img[data-src]', paginas[k]);
      if (img && !img.src) {
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
    // Tema: si alguna página visible es de Año Nuevo, fuegos; si es de Navidad, nieve.
    var temas = vis.map(function (n) { return paginas[n].getAttribute('data-tema'); });
    ponerModo(temas.indexOf('anonuevo') >= 0 ? 'anonuevo' : temas.indexOf('navidad') >= 0 ? 'navidad' : 'ninguno');
    // Pie: botones de reservar / ver en grande de las páginas visibles.
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
      if (p.hasAttribute('data-reserva')) {
        var r = document.createElement('button');
        r.className = 'boton boton-dorado boton-flotante dinamico';
        r.textContent = p.getAttribute('data-boton') || (vis.length > 1 ? '📅 Reservar ' + (n === vis[0] ? '◂' : '▸') : '📅 Reservar este');
        r.addEventListener('click', function () { abrirReserva(p.getAttribute('data-reserva'), p.getAttribute('data-titulo')); });
        pie.appendChild(r);
      }
    });
    $('#contador').textContent = (vis[0] + 1) + (vis.length > 1 ? '–' + (vis[1] + 1) : '') + ' / ' + paginas.length;
    $$('.barra-nav [data-ir]').forEach(function (b) { b.classList.remove('activo'); });
    var sec = seccionActual(vis[vis.length - 1]);
    var activo = $('.barra-nav [data-ir="' + sec + '"]'); if (activo) activo.classList.add('activo');
    try { history.replaceState(null, '', '#p' + (i + 1)); } catch (e) { /* nada */ }
  }
  function seccionActual(i) {
    for (var k = i; k >= 0; k--) {
      var s = paginas[k].getAttribute('data-seccion');
      if (s === 'navidad' || s === 'anonuevo' || s === 'menus' || s === 'indice') return s;
    }
    return '';
  }

  function crearLibro() {
    var marco = $('.escenario').getBoundingClientRect();
    var aw = marco.width, ah = marco.height - 12;
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
    if (r) { e.preventDefault(); e.stopPropagation(); abrirReserva(r.getAttribute('data-abrir-reserva'), r.getAttribute('data-titulo')); }
  }, true);
  $('#anterior').addEventListener('click', function () { libro && libro.flipPrev(); });
  $('#siguiente').addEventListener('click', function () { libro && libro.flipNext(); });
  document.addEventListener('keydown', function (e) {
    if (!$('#modal-reserva').hidden || !$('#modal-zoom').hidden || !$('#modal-qr').hidden) { if (e.key === 'Escape') cerrarModales(); return; }
    if (e.key === 'ArrowRight') libro && libro.flipNext();
    if (e.key === 'ArrowLeft') libro && libro.flipPrev();
  });

  /* ════════════ Formulario de reserva ════════════ */
  function urlForms(clave) {
    var u = (clave && C.RESERVAS[clave]) || C.FORMS_URL;
    return u;
  }
  function abrirReserva(clave, titulo) {
    var u = urlForms(clave);
    $('#reserva-titulo').textContent = titulo || 'Reservar';
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

  /* ════════════ Contacto ════════════ */
  $('#contactos').innerHTML = C.TELEFONOS.map(function (t) {
    return '<li><a href="https://wa.me/' + t.whatsapp + '" target="_blank" rel="noopener"><span><b>' + t.lugar + '</b><br>' + t.numero + '</span><small>WhatsApp ↗</small></a></li>';
  }).join('');

  if (document.readyState === 'complete') crearLibro(); else window.addEventListener('load', crearLibro);
})();
