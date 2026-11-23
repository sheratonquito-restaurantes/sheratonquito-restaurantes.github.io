/* Panel del catálogo · Restaurantes y Bares Sheraton Quito
 *
 * Edita data/catalogo.json y sube imágenes al repositorio de GitHub SIN usar Git:
 * el panel usa la API de GitHub con un token de acceso que se guarda CIFRADO en data/acceso.json.
 *
 * Seguridad:
 *  - Una llave maestra aleatoria (AES-256) cifra el token. Cada usuario guarda esa llave cifrada con
 *    una clave derivada de SU contraseña (PBKDF2-SHA256, 600 000 iteraciones). Sin una contraseña
 *    válida el token no se puede leer, aunque el archivo sea público.
 *  - El token solo vive en memoria mientras la pestaña está abierta.
 *  - Modo de prueba local: http://localhost:5501/admin/?demo=1 (no toca GitHub).
 */
(function () {
  'use strict';

  var REPO = { dueno: 'sheratonquito-restaurantes', nombre: 'sheratonquito-restaurantes.github.io', rama: 'main' };
  var RUTA_DATOS = 'data/catalogo.json';
  var RUTA_ACCESO = 'data/acceso.json';
  var ITERACIONES = 600000;
  var DEMO = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).get('demo') === '1';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var clonar = function (o) { return JSON.parse(JSON.stringify(o)); };

  /* ═══════════════ Utilidades de texto y base64 ═══════════════ */
  var te = new TextEncoder(), td = new TextDecoder();
  function aB64(bytes) { var s = ''; bytes = new Uint8Array(bytes); for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
  function deB64(b64) { var s = atob(b64.replace(/\s/g, '')); var b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; }
  function textoAB64(t) { return aB64(te.encode(t)); }
  function b64ATexto(b) { return td.decode(deB64(b)); }

  /* ═══════════════ Cifrado ═══════════════ */
  function claveDeContrasena(contrasena, sal, iter) {
    return crypto.subtle.importKey('raw', te.encode(contrasena), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: sal, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }
  function importarMaestra(bytes) { return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']); }
  function cifrar(clave, bytes) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, clave, bytes).then(function (c) { return { iv: aB64(iv), datos: aB64(c) }; });
  }
  function descifrar(clave, obj) {
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(obj.iv) }, clave, deB64(obj.datos)).then(function (b) { return new Uint8Array(b); });
  }
  function envolverMaestra(usuario, contrasena, maestra, iter) {
    var sal = crypto.getRandomValues(new Uint8Array(16));
    return claveDeContrasena(contrasena, sal, iter).then(function (k) { return cifrar(k, maestra); }).then(function (c) {
      return { usuario: usuario, sal: aB64(sal), iv: c.iv, llave: c.datos, creado: new Date().toISOString() };
    });
  }

  /* ═══════════════ Estado ═══════════════ */
  var S = {
    token: null, maestra: null, usuario: null, acceso: null,
    datos: null, original: '', temporada: null,
    pendientes: {}, // ruta -> { dataUrl, base64 }
    pestana: 'temporadas',
  };

  /* ═══════════════ GitHub (o modo de prueba) ═══════════════ */
  function gh(metodo, ruta, cuerpo) {
    if (DEMO) return demoGh(metodo, ruta, cuerpo);
    return fetch('https://api.github.com' + ruta, {
      method: metodo,
      headers: { 'Authorization': 'Bearer ' + S.token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      cache: 'no-store',
    }).then(function (r) {
      if (r.status === 404) { var e = new Error('No encontrado'); e.status = 404; throw e; }
      return r.json().then(function (j) {
        if (!r.ok) { var e2 = new Error((j && j.message) || ('Error ' + r.status)); e2.status = r.status; throw e2; }
        return j;
      });
    });
  }
  var base = '/repos/' + REPO.dueno + '/' + REPO.nombre;

  // Lectura pública del archivo de acceso (sin token).
  function leerAccesoPublico() {
    if (DEMO) { var a = localStorage.getItem('demo-acceso'); return Promise.resolve(a ? JSON.parse(a) : null); }
    return fetch('https://raw.githubusercontent.com/' + REPO.dueno + '/' + REPO.nombre + '/' + REPO.rama + '/' + RUTA_ACCESO + '?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (r.status === 404) return null; if (!r.ok) throw new Error('No se pudo leer el acceso (' + r.status + ')'); return r.json(); });
  }
  function leerArchivo(ruta) {
    return gh('GET', base + '/contents/' + ruta + '?ref=' + REPO.rama).then(function (j) { return b64ATexto(j.content); });
  }
  function existe(ruta) { return gh('GET', base + '/contents/' + ruta + '?ref=' + REPO.rama).then(function () { return true; }, function (e) { if (e.status === 404) return false; throw e; }); }

  // Publica varios archivos en UN solo cambio (commit). archivos: [{ruta, base64}] · borrar: [ruta]
  function publicarArchivos(archivos, borrar, mensaje) {
    if (DEMO) return demoPublicar(archivos, borrar);
    var refSha, arbolBase;
    return gh('GET', base + '/git/ref/heads/' + REPO.rama).then(function (ref) {
      refSha = ref.object.sha;
      return gh('GET', base + '/git/commits/' + refSha);
    }).then(function (c) {
      arbolBase = c.tree.sha;
      return Promise.all(archivos.map(function (a) {
        return gh('POST', base + '/git/blobs', { content: a.base64, encoding: 'base64' }).then(function (b) { return { path: a.ruta, mode: '100644', type: 'blob', sha: b.sha }; });
      }));
    }).then(function (entradas) {
      return Promise.all((borrar || []).map(existe)).then(function (hay) {
        (borrar || []).forEach(function (ruta, i) { if (hay[i]) entradas.push({ path: ruta, mode: '100644', type: 'blob', sha: null }); });
        return gh('POST', base + '/git/trees', { base_tree: arbolBase, tree: entradas });
      });
    }).then(function (arbol) {
      return gh('POST', base + '/git/commits', { message: mensaje, tree: arbol.sha, parents: [refSha] });
    }).then(function (nuevo) {
      return gh('PATCH', base + '/git/refs/heads/' + REPO.rama, { sha: nuevo.sha });
    });
  }

  /* ── Modo de prueba local: simula GitHub en el navegador ── */
  function demoGh(metodo, ruta) {
    if (/\/contents\/data\/catalogo\.json/.test(ruta)) {
      var guardado = localStorage.getItem('demo-catalogo');
      if (guardado) return Promise.resolve({ content: textoAB64(guardado) });
      return fetch('../' + RUTA_DATOS, { cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (t) { return { content: textoAB64(t) }; });
    }
    if (/\/contents\//.test(ruta)) { var e = new Error('No encontrado'); e.status = 404; return Promise.reject(e); }
    if (metodo === 'GET' && ruta === base) return Promise.resolve({ permissions: { push: true }, full_name: 'demo' });
    return Promise.resolve({});
  }
  function demoPublicar(archivos) {
    archivos.forEach(function (a) {
      if (a.ruta === RUTA_DATOS) localStorage.setItem('demo-catalogo', b64ATexto(a.base64));
      if (a.ruta === RUTA_ACCESO) localStorage.setItem('demo-acceso', b64ATexto(a.base64));
    });
    return new Promise(function (r) { setTimeout(r, 400); });
  }

  /* ═══════════════ Avisos y diálogos ═══════════════ */
  var tAviso;
  function aviso(texto, tipo) {
    var a = $('#aviso'); a.textContent = texto; a.className = 'aviso ' + (tipo || ''); a.hidden = false;
    clearTimeout(tAviso); tAviso = setTimeout(function () { a.hidden = true; }, tipo === 'error' ? 7000 : 3500);
  }
  // Diálogo simple: campos [{id, etiqueta, tipo, valor, ayuda, opciones}] → Promise(valores | null)
  function dialogo(titulo, texto, campos, botonOk, peligro) {
    return new Promise(function (resolver) {
      var f = $('#dialogo-form');
      f.innerHTML = '<h3>' + esc(titulo) + '</h3>' + (texto ? '<p class="ayuda" style="margin:0">' + texto + '</p>' : '') +
        (campos || []).map(function (c) {
          var control = c.tipo === 'select'
            ? '<select name="' + c.id + '">' + c.opciones.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === c.valor ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'
            : '<input name="' + c.id + '" type="' + (c.tipo || 'text') + '" value="' + esc(c.valor || '') + '" autocomplete="' + (c.tipo === 'password' ? 'new-password' : 'off') + '">';
          return '<label class="campo">' + esc(c.etiqueta) + (c.ayuda ? ' <small>' + esc(c.ayuda) + '</small>' : '') + control + '</label>';
        }).join('') +
        '<div class="fila fila-fin"><button value="no" class="btn btn-borde">Cancelar</button><button value="si" class="btn ' + (peligro ? 'btn-peligro' : 'btn-negro') + '">' + esc(botonOk || 'Aceptar') + '</button></div>';
      var d = $('#dialogo');
      d.onclose = function () {
        if (d.returnValue !== 'si') return resolver(null);
        var v = {}; (campos || []).forEach(function (c) { v[c.id] = f.elements[c.id].value.trim(); });
        resolver(v);
      };
      d.returnValue = ''; d.showModal();
      var primero = f.querySelector('input,select'); if (primero) primero.focus();
    });
  }

  /* ═══════════════ Acceso ═══════════════ */
  function pantallaAcceso(html) { $('#acceso-contenido').innerHTML = html; }

  function iniciar() {
    if (!window.crypto || !crypto.subtle) { pantallaAcceso('<p class="mensaje error">Este navegador no permite el cifrado necesario. Use Edge o Chrome actualizados.</p>'); return; }
    leerAccesoPublico().then(function (acc) {
      S.acceso = acc;
      if (!acc) mostrarConfiguracion(); else mostrarLogin();
    }).catch(function (e) { pantallaAcceso('<p class="mensaje error">' + esc(e.message) + '</p>'); });
  }

  function mostrarLogin(msg) {
    pantallaAcceso(
      (DEMO ? '<p class="mensaje info">Modo de prueba local: los cambios no se publican en internet.</p>' : '') +
      '<form id="form-login" autocomplete="on">' +
      '<label class="campo">Usuario<input type="text" name="usuario" autocomplete="username" required></label>' +
      '<label class="campo">Contraseña<input type="password" name="contrasena" autocomplete="current-password" required></label>' +
      (msg ? '<p class="mensaje error">' + esc(msg) + '</p>' : '') +
      '<button class="btn btn-negro" type="submit">Entrar</button></form>');
    var f = $('#form-login');
    f.usuario.focus();
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var boton = f.querySelector('button'); boton.disabled = true; boton.textContent = 'Verificando…';
      entrar(f.usuario.value.trim(), f.contrasena.value).catch(function (err) {
        // Pausa breve tras un intento fallido para desalentar pruebas repetidas.
        setTimeout(function () { mostrarLogin(err.message || 'Usuario o contraseña incorrectos.'); }, 1200);
      });
    });
  }

  function entrar(usuario, contrasena) {
    var u = (S.acceso.usuarios || []).filter(function (x) { return x.usuario.toLowerCase() === usuario.toLowerCase(); })[0];
    if (!u) return Promise.reject(new Error('Usuario o contraseña incorrectos.'));
    var iter = S.acceso.iteraciones || ITERACIONES;
    return claveDeContrasena(contrasena, deB64(u.sal), iter)
      .then(function (k) { return descifrar(k, { iv: u.iv, datos: u.llave }); })
      .catch(function () { throw new Error('Usuario o contraseña incorrectos.'); })
      .then(function (maestraBytes) {
        S.maestraBytes = maestraBytes;
        return importarMaestra(maestraBytes);
      }).then(function (m) {
        S.maestra = m;
        return descifrar(m, S.acceso.token);
      }).then(function (tok) {
        S.token = td.decode(tok); S.usuario = u.usuario;
        return gh('GET', base).catch(function (e) {
          if (e.status === 401) throw new Error('El token de GitHub venció o fue revocado. Pida a Sistemas que lo renueve.');
          throw e;
        });
      }).then(function (repo) {
        if (!repo.permissions || !repo.permissions.push) throw new Error('El token no tiene permiso de escritura en el repositorio.');
        return cargarCatalogo();
      });
  }

  function mostrarConfiguracion(msg) {
    pantallaAcceso(
      '<p class="mensaje info">Configuración inicial: solo se hace una vez.</p>' +
      '<ol class="pasos-config">' +
      '<li>En GitHub, cree un <b>token de acceso fino</b> (Settings → Developer settings → Fine-grained tokens) con dueño <b>' + esc(REPO.dueno) + '</b>, solo el repositorio <b>' + esc(REPO.nombre) + '</b> y permiso <b>Contents: Read and write</b>.</li>' +
      '<li>Péguelo abajo y cree el primer usuario del panel.</li></ol>' +
      '<form id="form-config" autocomplete="off">' +
      '<label class="campo">Token de GitHub<input type="password" name="token" autocomplete="off" required></label>' +
      '<label class="campo">Usuario administrador<input type="text" name="usuario" required></label>' +
      '<label class="campo">Contraseña <small>mínimo 12 caracteres, con letras y números</small><input type="password" name="contrasena" autocomplete="new-password" required></label>' +
      '<label class="campo">Repita la contraseña<input type="password" name="confirmar" autocomplete="new-password" required></label>' +
      (msg ? '<p class="mensaje error">' + esc(msg) + '</p>' : '') +
      '<button class="btn btn-negro" type="submit">Guardar y entrar</button></form>');
    var f = $('#form-config');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = { token: f.token.value.trim(), usuario: f.usuario.value.trim(), contrasena: f.contrasena.value, confirmar: f.confirmar.value };
      var error = validarContrasena(v.contrasena, v.confirmar) || (!/^[\w.\-]{3,40}$/.test(v.usuario) ? 'El usuario debe tener 3 a 40 letras, números, punto o guion.' : '');
      if (error) return mostrarConfiguracion(error);
      var boton = f.querySelector('button'); boton.disabled = true; boton.textContent = 'Configurando…';
      S.token = v.token;
      gh('GET', base).then(function (repo) {
        if (!repo.permissions || !repo.permissions.push) throw new Error('El token no tiene permiso de escritura en ' + REPO.nombre + '.');
        S.maestraBytes = crypto.getRandomValues(new Uint8Array(32));
        return importarMaestra(S.maestraBytes);
      }).then(function (m) {
        S.maestra = m;
        return Promise.all([cifrar(m, te.encode(v.token)), envolverMaestra(v.usuario, v.contrasena, S.maestraBytes, ITERACIONES)]);
      }).then(function (r) {
        S.acceso = { version: 1, iteraciones: ITERACIONES, token: r[0], usuarios: [r[1]], actualizado: new Date().toISOString() };
        S.usuario = v.usuario;
        // También retira el config.js antiguo (el catálogo ya usa data/catalogo.json).
        return publicarArchivos([{ ruta: RUTA_ACCESO, base64: textoAB64(JSON.stringify(S.acceso, null, 2)) }], ['config.js'], 'Panel: configuración inicial de acceso');
      }).then(cargarCatalogo).catch(function (err) {
        S.token = null;
        mostrarConfiguracion(err.status === 401 ? 'El token no es válido.' : (err.message || 'No se pudo configurar.'));
      });
    });
  }

  function validarContrasena(c, confirmar) {
    if (c.length < 12) return 'La contraseña debe tener al menos 12 caracteres.';
    if (!/[a-zA-Z]/.test(c) || !/\d/.test(c)) return 'La contraseña debe combinar letras y números.';
    if (confirmar != null && c !== confirmar) return 'Las contraseñas no coinciden.';
    return '';
  }

  function guardarAcceso(mensaje) {
    S.acceso.actualizado = new Date().toISOString();
    return publicarArchivos([{ ruta: RUTA_ACCESO, base64: textoAB64(JSON.stringify(S.acceso, null, 2)) }], [], mensaje);
  }

  /* ═══════════════ Catálogo ═══════════════ */
  function cargarCatalogo() {
    return leerArchivo(RUTA_DATOS).then(function (texto) {
      S.datos = JSON.parse(texto);
      S.original = JSON.stringify(S.datos);
      S.temporada = S.datos.activa;
      S.pendientes = {};
      var b = leerBorradorLocal();
      $('#pantalla-acceso').hidden = true; $('#app').hidden = false;
      $('#usuario-actual').textContent = 'Usuario: ' + S.usuario + (DEMO ? ' · modo de prueba' : '');
      pintarTodo();
      if (b && b.usuario === S.usuario && b.datos && JSON.stringify(b.datos) !== S.original) {
        dialogo('Hay cambios sin publicar', 'Se encontró un borrador guardado en este equipo el ' + esc(new Date(b.fecha).toLocaleString('es-EC')) + '. ¿Desea recuperarlo?', [], 'Recuperar').then(function (v) {
          if (v) { S.datos = b.datos; S.pendientes = b.pendientes || {}; S.temporada = b.temporada || S.datos.activa; pintarTodo(); aviso('Borrador recuperado.'); }
          else borrarBorradorLocal();
        });
      }
    });
  }

  function T() { return (S.datos.temporadas || []).filter(function (t) { return t.id === S.temporada; })[0] || S.datos.temporadas[0]; }
  function hayCambios() { return JSON.stringify(S.datos) !== S.original || Object.keys(S.pendientes).length > 0; }

  function guardarBorradorLocal() {
    try {
      localStorage.setItem('catalogo-admin-borrador', JSON.stringify({ usuario: S.usuario, fecha: Date.now(), datos: S.datos, temporada: S.temporada, pendientes: S.pendientes }));
    } catch (e) {
      try { localStorage.setItem('catalogo-admin-borrador', JSON.stringify({ usuario: S.usuario, fecha: Date.now(), datos: S.datos, temporada: S.temporada, pendientes: {} })); } catch (e2) { /* sin espacio */ }
    }
  }
  function leerBorradorLocal() { try { return JSON.parse(localStorage.getItem('catalogo-admin-borrador') || 'null'); } catch (e) { return null; } }
  function borrarBorradorLocal() { try { localStorage.removeItem('catalogo-admin-borrador'); } catch (e) { /* nada */ } }

  var tGuardar;
  function cambio(repintar) {
    clearTimeout(tGuardar); tGuardar = setTimeout(guardarBorradorLocal, 400);
    actualizarCabecera();
    if (repintar) pintarContenido();
  }

  function rutaImagen(ruta) { return S.pendientes[ruta] ? S.pendientes[ruta].dataUrl : '../' + ruta; }

  /* ═══════════════ Imágenes ═══════════════ */
  var ANCHO = 880, ALTO = 1100;
  function leerComoDataUrl(archivo) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(archivo); });
  }
  function prepararImagen(archivo) {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(archivo.type)) return Promise.reject(new Error(archivo.name + ': formato no permitido (use JPG, PNG, WEBP o GIF).'));
    if (archivo.size > 15 * 1024 * 1024) return Promise.reject(new Error(archivo.name + ': supera 15 MB.'));
    // Los GIF se suben tal cual para conservar la animación.
    if (archivo.type === 'image/gif') {
      if (archivo.size > 5 * 1024 * 1024) return Promise.reject(new Error(archivo.name + ': el GIF supera 5 MB; redúzcalo antes de subirlo.'));
      return leerComoDataUrl(archivo).then(function (u) { return { dataUrl: u, ext: 'gif' }; });
    }
    return leerComoDataUrl(archivo).then(function (u) {
      return new Promise(function (res, rej) {
        var img = new Image();
        img.onload = function () {
          var c = document.createElement('canvas'); c.width = ANCHO; c.height = ALTO;
          var g = c.getContext('2d'); g.fillStyle = '#0c0b0a'; g.fillRect(0, 0, ANCHO, ALTO);
          var e = Math.min(ANCHO / img.width, ALTO / img.height);
          var w = img.width * e, h = img.height * e;
          g.imageSmoothingQuality = 'high';
          g.drawImage(img, (ANCHO - w) / 2, (ALTO - h) / 2, w, h);
          res({ dataUrl: c.toDataURL('image/jpeg', 0.86), ext: 'jpg' });
        };
        img.onerror = function () { rej(new Error(archivo.name + ': no se pudo leer la imagen.')); };
        img.src = u;
      });
    });
  }
  function registrarImagen(prep) {
    var ruta = 'assets/temporadas/' + S.temporada + '/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + '.' + prep.ext;
    S.pendientes[ruta] = { dataUrl: prep.dataUrl, base64: prep.dataUrl.split(',')[1] };
    return ruta;
  }
  function slug(t) { return String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'temporada'; }

  /* ═══════════════ Pintado ═══════════════ */
  function pintarTodo() { actualizarCabecera(); pintarContenido(); }

  function actualizarCabecera() {
    var sel = $('#temporada-editando');
    sel.innerHTML = S.datos.temporadas.map(function (t) { return '<option value="' + esc(t.id) + '"' + (t.id === S.temporada ? ' selected' : '') + '>' + esc(t.nombre) + '</option>'; }).join('');
    var activa = S.temporada === S.datos.activa;
    var chip = $('#estado-temporada');
    chip.textContent = activa ? '● Visible al público' : 'No visible (borrador)';
    chip.className = 'chip' + (activa ? ' activa' : '');
    var n = Object.keys(S.pendientes).length;
    var b = $('#boton-publicar');
    b.innerHTML = '🚀 Publicar' + (hayCambios() ? ' <span class="contador-cambios">' + (n ? n + ' img' : '•') + '</span>' : '');
    $$('#pestanas button').forEach(function (x) { x.classList.toggle('activa', x.getAttribute('data-pestana') === S.pestana); });
  }

  function pintarContenido() {
    var f = { temporadas: vistaTemporadas, paginas: vistaPaginas, textos: vistaTextos, general: vistaGeneral, usuarios: vistaUsuarios }[S.pestana];
    $('#contenido').innerHTML = f();
  }

  var EFECTOS = [['nieve', '❄️ Nieve (Navidad)'], ['brindis', '🥂 Brindis: burbujas y confeti dorado (Año Nuevo)'], ['confeti', '🎉 Confeti de colores (Carnaval, fiestas)'], ['corazones', '💕 Corazones (San Valentín, Día de la Madre)'], ['ninguno', 'Sin efecto']];
  function opciones(lista, valor) { return lista.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === valor ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join(''); }
  function campo(etiqueta, ruta, valor, opt) {
    opt = opt || {};
    var control = opt.area
      ? '<textarea data-campo="' + ruta + '" rows="' + (opt.filas || 3) + '">' + esc(valor) + '</textarea>'
      : '<input type="' + (opt.tipo || 'text') + '" data-campo="' + ruta + '" value="' + esc(valor) + '"' + (opt.ph ? ' placeholder="' + esc(opt.ph) + '"' : '') + '>';
    return '<label class="campo">' + esc(etiqueta) + (opt.ayuda ? ' <small>' + esc(opt.ayuda) + '</small>' : '') + control + '</label>';
  }

  function vistaTemporadas() {
    return '<h2>Temporadas</h2><p class="ayuda">Cada temporada es un catálogo completo (Navidad, Carnaval, Día de la Madre…). Solo <b>una</b> es visible al público. Para empezar una nueva, lo más rápido es <b>duplicar</b> la actual y cambiar sus páginas.</p>' +
      S.datos.temporadas.map(function (t) {
        var activa = t.id === S.datos.activa, edit = t.id === S.temporada;
        var paginas = (t.secciones || []).reduce(function (s, x) { return s + (x.paginas || []).length; }, 0);
        var primera = ((t.secciones || [])[0] || { paginas: [] }).paginas[0];
        return '<div class="tarjeta temporada">' +
          (primera ? '<img class="miniatura" src="' + esc(rutaImagen(primera.imagen)) + '" alt="">' : '<div class="miniatura"></div>') +
          '<div class="info"><b>' + esc(t.nombre) + '</b> ' + (activa ? '<span class="chip activa">● Visible al público</span>' : '') + (edit ? ' <span class="chip">Editando</span>' : '') +
          '<p>' + (t.secciones || []).length + ' secciones · ' + paginas + ' páginas</p></div>' +
          '<div class="fila">' +
          (edit ? '' : '<button class="btn btn-borde btn-chico" data-accion="editar-temporada" data-id="' + esc(t.id) + '">✏️ Editar</button>') +
          '<button class="btn btn-borde btn-chico" data-accion="duplicar-temporada" data-id="' + esc(t.id) + '">⧉ Duplicar</button>' +
          (activa ? '' : '<button class="btn btn-dorado btn-chico" data-accion="activar-temporada" data-id="' + esc(t.id) + '">Hacer visible</button>') +
          (activa ? '' : '<button class="btn btn-peligro btn-chico" data-accion="eliminar-temporada" data-id="' + esc(t.id) + '">Eliminar</button>') +
          '</div></div>';
      }).join('') +
      '<div class="fila"><button class="btn btn-negro" data-accion="nueva-temporada">＋ Nueva temporada</button></div>';
  }

  function vistaPaginas() {
    var t = T();
    return '<h2>Secciones y páginas · ' + esc(t.nombre) + '</h2>' +
      '<p class="ayuda">Cada sección aparece en el menú superior del catálogo con su ícono y tiene su propio efecto. Suba las páginas como imágenes verticales (ideal 1080×1350 o 1400×1750; se ajustan solas). Los <b>GIF</b> se suben con su animación. Marque <b>Botón Reservar</b> en las páginas que ofrecen algo reservable y pegue el <b>vínculo prellenado</b> del Forms si lo tiene.</p>' +
      (t.secciones || []).map(function (s, si) {
        return '<div class="tarjeta" data-sec="' + si + '">' +
          '<div class="seccion-cab">' +
          '<label class="campo">Ícono<input type="text" data-campo="sec.icono" value="' + esc(s.icono) + '" maxlength="4"></label>' +
          '<label class="campo">Nombre de la sección<input type="text" data-campo="sec.nombre" value="' + esc(s.nombre) + '"></label>' +
          '<label class="campo">Descripción (índice)<input type="text" data-campo="sec.descripcion" value="' + esc(s.descripcion) + '"></label>' +
          '<label class="campo">Efecto<select data-campo="sec.efecto">' + opciones(EFECTOS, s.efecto || 'ninguno') + '</select></label>' +
          '<div class="fila"><button class="btn-icono" title="Subir sección" data-accion="sec-subir">▲</button><button class="btn-icono" title="Bajar sección" data-accion="sec-bajar">▼</button><button class="btn-icono" title="Eliminar sección" data-accion="sec-eliminar">🗑</button></div>' +
          '</div>' +
          '<div class="paginas">' +
          (s.paginas || []).map(function (p, pi) {
            var nueva = !!S.pendientes[p.imagen];
            return '<div class="pagina" data-pag="' + pi + '">' +
              '<div class="foto"><img src="' + esc(rutaImagen(p.imagen)) + '" alt="" loading="lazy"><span class="num">' + (pi + 1) + '</span>' + (nueva ? '<span class="nueva">nueva</span>' : '') + '</div>' +
              '<div class="fila"><button class="btn-icono" title="Mover antes" data-accion="pag-izq">◀</button><button class="btn-icono" title="Mover después" data-accion="pag-der">▶</button>' +
              '<label class="btn-icono" title="Cambiar imagen">🔄<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-accion="pag-reemplazar" hidden></label>' +
              '<button class="btn-icono" title="Quitar página" data-accion="pag-eliminar">🗑</button></div>' +
              '<label class="campo">Descripción <small>(precio, nombre)</small><textarea data-campo="pag.descripcion" rows="2">' + esc(p.descripcion) + '</textarea></label>' +
              '<label class="check"><input type="checkbox" data-campo="pag.reservar"' + (p.reservar ? ' checked' : '') + '> Botón Reservar</label>' +
              (p.reservar ? (
                '<label class="campo">Título en el formulario<input type="text" data-campo="pag.titulo" value="' + esc(p.titulo) + '"></label>' +
                '<label class="campo">Vínculo prellenado del Forms <small>(opcional)</small><input type="url" data-campo="pag.vinculo" value="' + esc(p.vinculo) + '" placeholder="https://forms.cloud.microsoft/…"></label>' +
                '<label class="campo">Texto del botón <small>(opcional)</small><input type="text" data-campo="pag.boton" value="' + esc(p.boton) + '" placeholder="📅 Reservar este"></label>') : '') +
              '</div>';
          }).join('') +
          '<label class="agregar-paginas" data-soltar><input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" data-accion="pag-agregar" hidden><span><b>＋ Agregar páginas</b>Haga clic o arrastre aquí imágenes o GIF</span></label>' +
          '</div></div>';
      }).join('') +
      '<div class="fila"><button class="btn btn-negro" data-accion="sec-nueva">＋ Nueva sección</button></div>';
  }

  function vistaTextos() {
    var t = T(), bv = t.bienvenida || {}, pt = t.portada || {}, ca = t.carta || {}, cp = t.contraportada || {};
    return '<h2>Textos de la temporada · ' + esc(t.nombre) + '</h2><p class="ayuda">Estos textos cambian con cada temporada.</p>' +
      '<div class="tarjeta"><h3>Datos de la temporada</h3><div class="rejilla">' +
      campo('Nombre interno de la temporada', 'T.nombre', t.nombre) +
      '<label class="campo">Efecto en portada y contraportada<select data-campo="T.efectoPortada">' + opciones(EFECTOS, t.efectoPortada || 'ninguno') + '</select></label></div></div>' +
      '<div class="tarjeta"><h3>Pantalla de bienvenida</h3><div class="rejilla">' +
      campo('Sobretítulo', 'T.bienvenida.sobretitulo', bv.sobretitulo) + campo('Título', 'T.bienvenida.titulo', bv.titulo) + campo('Fecha o lema', 'T.bienvenida.fecha', bv.fecha) + '</div></div>' +
      '<div class="tarjeta"><h3>Portada de la revista</h3><div class="rejilla">' +
      campo('Sobretítulo', 'T.portada.sobretitulo', pt.sobretitulo) + campo('Título', 'T.portada.titulo', pt.titulo) + campo('Subtítulo (cursiva)', 'T.portada.subtitulo', pt.subtitulo) + campo('Fecha', 'T.portada.fecha', pt.fecha) + '</div></div>' +
      '<div class="tarjeta"><h3>Carta de bienvenida (primera hoja)</h3><div class="rejilla">' +
      campo('Sobretítulo', 'T.carta.sobretitulo', ca.sobretitulo) + campo('Título', 'T.carta.titulo', ca.titulo) + campo('Subtítulo (cursiva)', 'T.carta.subtitulo', ca.subtitulo) + '</div>' +
      campo('Texto', 'T.carta.parrafos', (ca.parrafos || []).join('\n\n'), { area: true, filas: 6, ayuda: 'deje una línea en blanco entre párrafos' }) + '</div>' +
      '<div class="tarjeta"><h3>Contraportada</h3><div class="rejilla">' +
      campo('Sobretítulo', 'T.contraportada.sobretitulo', cp.sobretitulo) + campo('Título (cursiva)', 'T.contraportada.titulo', cp.titulo) + campo('Segunda línea', 'T.contraportada.subtitulo', cp.subtitulo) + '</div></div>';
  }

  function vistaGeneral() {
    var D = S.datos, M = D.menus || {}, av = D.aviso || {};
    return '<h2>Menús, contacto y datos</h2><p class="ayuda">Esto es común a todas las temporadas.</p>' +
      '<div class="tarjeta"><h3>Formulario de reservas</h3>' + campo('Enlace del Microsoft Forms', 'D.formsUrl', D.formsUrl, { tipo: 'url', ayuda: 'se usa cuando una página no tiene vínculo prellenado' }) + '</div>' +
      '<div class="tarjeta lista-editable"><h3>Menús de todo el año</h3><div class="rejilla">' +
      campo('Sobretítulo', 'D.menus.sobretitulo', M.sobretitulo) + campo('Título', 'D.menus.titulo', M.titulo) + '</div>' +
      (M.items || []).map(function (m, i) {
        return '<div class="item" data-menu="' + i + '">' +
          '<label class="campo">Nombre<input type="text" data-campo="menu.nombre" value="' + esc(m.nombre) + '"></label>' +
          '<label class="campo">Detalle<input type="text" data-campo="menu.detalle" value="' + esc(m.detalle) + '"></label>' +
          '<label class="campo">Precio<input type="text" data-campo="menu.precio" value="' + esc(m.precio) + '"></label>' +
          '<label class="campo">Vínculo prellenado <small>(opcional)</small><input type="url" data-campo="menu.vinculo" value="' + esc(m.vinculo) + '"></label>' +
          '<button class="btn-icono" title="Quitar" data-accion="menu-eliminar">🗑</button></div>';
      }).join('') +
      '<div class="fila" style="margin-top:10px"><button class="btn btn-borde btn-chico" data-accion="menu-agregar">＋ Agregar menú</button></div>' +
      campo('Nota bajo los menús', 'D.menus.nota', M.nota, { area: true }) + '</div>' +
      '<div class="tarjeta lista-editable"><h3>WhatsApp de contacto</h3>' +
      (D.telefonos || []).map(function (t, i) {
        return '<div class="item tel" data-tel="' + i + '">' +
          '<label class="campo">Nombre o restaurante<input type="text" data-campo="tel.lugar" value="' + esc(t.lugar) + '"></label>' +
          '<label class="campo">Número<input type="text" data-campo="tel.numero" value="' + esc(t.numero) + '" placeholder="099 123 4567"></label>' +
          '<button class="btn-icono" title="Quitar" data-accion="tel-eliminar">🗑</button></div>';
      }).join('') +
      '<div class="fila" style="margin-top:10px"><button class="btn btn-borde btn-chico" data-accion="tel-agregar">＋ Agregar número</button></div></div>' +
      '<div class="tarjeta"><h3>Aviso de protección de datos (GHL)</h3><p class="mensaje info">Texto legal: cámbielo solo con aprobación del área legal.</p>' +
      campo('Título', 'D.aviso.titulo', av.titulo) + campo('Autorización', 'D.aviso.texto', av.texto, { area: true }) +
      campo('Derechos y política', 'D.aviso.derechos', av.derechos, { area: true, ayuda: 'los correos y enlaces se convierten solos en vínculos' }) +
      campo('Texto de la casilla', 'D.aviso.casilla', av.casilla) + '</div>';
  }

  function vistaUsuarios() {
    return '<h2>Usuarios y acceso</h2><p class="ayuda">Cada persona debe tener su propio usuario. Las contraseñas no se guardan en ningún lado: solo sirven para abrir la llave cifrada. Si alguien olvida la suya, otro usuario lo elimina y lo vuelve a crear.</p>' +
      '<div class="tarjeta usuarios"><h3>Usuarios del panel</h3>' +
      S.acceso.usuarios.map(function (u) {
        return '<div class="item"><span><b>' + esc(u.usuario) + '</b>' + (u.usuario === S.usuario ? ' (usted)' : '') + ' <small style="color:#6e6a63">· creado ' + esc(new Date(u.creado || Date.now()).toLocaleDateString('es-EC')) + '</small></span>' +
          (u.usuario === S.usuario ? '' : '<button class="btn btn-peligro btn-chico" data-accion="usuario-eliminar" data-usuario="' + esc(u.usuario) + '">Eliminar</button>') + '</div>';
      }).join('') +
      '<div class="fila" style="margin-top:12px"><button class="btn btn-negro btn-chico" data-accion="usuario-agregar">＋ Agregar usuario</button>' +
      '<button class="btn btn-borde btn-chico" data-accion="usuario-contrasena">Cambiar mi contraseña</button></div></div>' +
      '<div class="tarjeta"><h3>Token de GitHub</h3><p class="ayuda" style="margin-bottom:10px">Cuando el token venza, cree uno nuevo con los mismos permisos y reemplácelo aquí. Los usuarios y contraseñas se mantienen.</p>' +
      '<button class="btn btn-borde btn-chico" data-accion="token-reemplazar">Reemplazar token</button></div>';
  }

  /* ═══════════════ Edición de campos ═══════════════ */
  function asignar(obj, ruta, valor) {
    var partes = ruta.split('.'), o = obj;
    for (var i = 0; i < partes.length - 1; i++) { if (o[partes[i]] == null || typeof o[partes[i]] !== 'object') o[partes[i]] = {}; o = o[partes[i]]; }
    o[partes[partes.length - 1]] = valor;
  }
  function alEditar(e) {
    var el = e.target, ruta = el.getAttribute('data-campo');
    if (!ruta) return;
    var valor = el.type === 'checkbox' ? el.checked : el.value;
    var t = T(), repintar = false;
    var p = ruta.indexOf('.'), ambito = ruta.slice(0, p), clave = ruta.slice(p + 1);
    if (el.type === 'url' && valor && !/^https:\/\//.test(valor)) el.classList.add('invalido'); else el.classList.remove('invalido');
    if (el.getAttribute('data-campo') === 'pag.vinculo' && valor && !/^https:\/\/forms\.(cloud\.microsoft|office\.com)\//.test(valor)) el.classList.add('invalido');
    if (ambito === 'T') {
      if (clave === 'carta.parrafos') valor = valor.split(/\n\s*\n/).map(function (x) { return x.trim(); }).filter(Boolean);
      asignar(t, clave, valor);
      if (clave === 'nombre') actualizarCabecera();
    } else if (ambito === 'D') {
      asignar(S.datos, clave, valor);
    } else if (ambito === 'sec') {
      var si = +el.closest('[data-sec]').getAttribute('data-sec');
      t.secciones[si][clave] = valor;
    } else if (ambito === 'pag') {
      var s = t.secciones[+el.closest('[data-sec]').getAttribute('data-sec')];
      var pg = s.paginas[+el.closest('[data-pag]').getAttribute('data-pag')];
      pg[clave] = valor;
      if (clave === 'reservar') { if (valor && !pg.titulo) pg.titulo = s.nombre; repintar = true; }
    } else if (ambito === 'menu') {
      S.datos.menus.items[+el.closest('[data-menu]').getAttribute('data-menu')][clave] = valor;
    } else if (ambito === 'tel') {
      S.datos.telefonos[+el.closest('[data-tel]').getAttribute('data-tel')][clave] = valor;
    }
    cambio(repintar);
  }

  function mover(lista, i, d) { var j = i + d; if (j < 0 || j >= lista.length) return false; var x = lista[i]; lista[i] = lista[j]; lista[j] = x; return true; }

  function agregarArchivos(archivos, si, reemplazarIndice) {
    var t = T(), s = t.secciones[si];
    var lista = Array.prototype.slice.call(archivos || []);
    if (!lista.length) return;
    aviso('Procesando ' + lista.length + ' imagen(es)…');
    var errores = [];
    lista.reduce(function (p, archivo, k) {
      return p.then(function () {
        return prepararImagen(archivo).then(function (prep) {
          var ruta = registrarImagen(prep);
          if (reemplazarIndice != null && k === 0) {
            var viejo = s.paginas[reemplazarIndice].imagen;
            if (S.pendientes[viejo]) delete S.pendientes[viejo];
            s.paginas[reemplazarIndice].imagen = ruta;
          } else {
            s.paginas.push({ imagen: ruta, descripcion: archivo.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '), reservar: true, titulo: s.nombre, vinculo: '' });
          }
        }).catch(function (e) { errores.push(e.message); });
      });
    }, Promise.resolve()).then(function () {
      cambio(true);
      if (errores.length) aviso(errores.join(' · '), 'error'); else aviso('Imágenes listas. Recuerde publicar.', 'ok');
    });
  }

  function alAccion(e) {
    var el = e.target.closest('[data-accion]');
    if (!el || el.tagName === 'INPUT') return;
    var acc = el.getAttribute('data-accion'), t = S.datos && T();
    var secEl = el.closest('[data-sec]'), si = secEl ? +secEl.getAttribute('data-sec') : -1;
    var pagEl = el.closest('[data-pag]'), pi = pagEl ? +pagEl.getAttribute('data-pag') : -1;
    switch (acc) {
      case 'vista-previa': return vistaPrevia();
      case 'publicar': return publicar();
      case 'salir': return salir();
      case 'editar-temporada': S.temporada = el.getAttribute('data-id'); S.pestana = 'paginas'; return cambio(true) || pintarTodo();
      case 'duplicar-temporada': return duplicarTemporada(el.getAttribute('data-id'));
      case 'nueva-temporada': return nuevaTemporada();
      case 'activar-temporada': return activarTemporada(el.getAttribute('data-id'));
      case 'eliminar-temporada': return eliminarTemporada(el.getAttribute('data-id'));
      case 'sec-subir': if (mover(t.secciones, si, -1)) cambio(true); return;
      case 'sec-bajar': if (mover(t.secciones, si, 1)) cambio(true); return;
      case 'sec-eliminar':
        return dialogo('Eliminar sección', '¿Eliminar «' + esc(t.secciones[si].nombre) + '» y sus ' + t.secciones[si].paginas.length + ' páginas de esta temporada?', [], 'Eliminar', true).then(function (v) {
          if (!v) return; t.secciones[si].paginas.forEach(function (p) { delete S.pendientes[p.imagen]; }); t.secciones.splice(si, 1); cambio(true);
        });
      case 'sec-nueva':
        return dialogo('Nueva sección', '', [
          { id: 'nombre', etiqueta: 'Nombre (aparece en el menú superior)', valor: '' },
          { id: 'icono', etiqueta: 'Ícono (un emoji)', valor: '⭐' },
          { id: 'efecto', etiqueta: 'Efecto', tipo: 'select', opciones: EFECTOS, valor: 'ninguno' },
        ], 'Crear').then(function (v) {
          if (!v || !v.nombre) return;
          var id = slug(v.nombre), n = 2; while (t.secciones.some(function (s) { return s.id === id; })) id = slug(v.nombre) + '-' + n++;
          t.secciones.push({ id: id, nombre: v.nombre, icono: v.icono || '⭐', descripcion: '', efecto: v.efecto, paginas: [] }); cambio(true);
        });
      case 'pag-izq': if (mover(t.secciones[si].paginas, pi, -1)) cambio(true); return;
      case 'pag-der': if (mover(t.secciones[si].paginas, pi, 1)) cambio(true); return;
      case 'pag-eliminar': var quitada = t.secciones[si].paginas.splice(pi, 1)[0]; delete S.pendientes[quitada.imagen]; cambio(true); aviso('Página quitada.'); return;
      case 'menu-agregar': S.datos.menus.items.push({ nombre: '', detalle: '', precio: '', vinculo: '' }); return cambio(true);
      case 'menu-eliminar': S.datos.menus.items.splice(+el.closest('[data-menu]').getAttribute('data-menu'), 1); return cambio(true);
      case 'tel-agregar': S.datos.telefonos.push({ lugar: '', numero: '' }); return cambio(true);
      case 'tel-eliminar': S.datos.telefonos.splice(+el.closest('[data-tel]').getAttribute('data-tel'), 1); return cambio(true);
      case 'usuario-agregar': return agregarUsuario();
      case 'usuario-eliminar': return eliminarUsuario(el.getAttribute('data-usuario'));
      case 'usuario-contrasena': return cambiarContrasena();
      case 'token-reemplazar': return reemplazarToken();
    }
  }

  /* ═══════════════ Temporadas ═══════════════ */
  function idUnico(nombre) { var id = slug(nombre), n = 2; while (S.datos.temporadas.some(function (t) { return t.id === id; })) id = slug(nombre) + '-' + n++; return id; }
  function duplicarTemporada(id) {
    var orig = S.datos.temporadas.filter(function (t) { return t.id === id; })[0];
    return dialogo('Duplicar temporada', 'Se copia todo (textos, secciones y páginas). Después cambie lo que necesite.', [{ id: 'nombre', etiqueta: 'Nombre de la nueva temporada', valor: 'Copia de ' + orig.nombre }], 'Duplicar').then(function (v) {
      if (!v || !v.nombre) return;
      var copia = clonar(orig); copia.id = idUnico(v.nombre); copia.nombre = v.nombre;
      S.datos.temporadas.push(copia); S.temporada = copia.id; S.pestana = 'paginas'; cambio(true); pintarTodo();
      aviso('Temporada creada. Todavía no es visible al público.', 'ok');
    });
  }
  function nuevaTemporada() {
    return dialogo('Nueva temporada', 'Empieza vacía, con una sección. Si prefiere partir de la actual, use «Duplicar».', [
      { id: 'nombre', etiqueta: 'Nombre (por ejemplo «Carnaval 2027»)', valor: '' },
      { id: 'efecto', etiqueta: 'Efecto principal', tipo: 'select', opciones: EFECTOS, valor: 'confeti' },
    ], 'Crear').then(function (v) {
      if (!v || !v.nombre) return;
      var actual = T();
      S.datos.temporadas.push({
        id: idUnico(v.nombre), nombre: v.nombre, efectoPortada: v.efecto,
        bienvenida: { sobretitulo: 'Restaurantes y Bares', titulo: 'Catálogo de temporada', fecha: v.nombre },
        portada: { sobretitulo: 'Restaurantes y Bares', titulo: 'Catálogo', subtitulo: 'de temporada', fecha: v.nombre },
        carta: clonar(actual.carta || {}), contraportada: { sobretitulo: 'Gracias por preferirnos', titulo: '', subtitulo: '' },
        secciones: [{ id: slug(v.nombre), nombre: v.nombre, icono: '⭐', descripcion: '', efecto: v.efecto, paginas: [] }],
      });
      S.temporada = S.datos.temporadas[S.datos.temporadas.length - 1].id; S.pestana = 'paginas'; cambio(true); pintarTodo();
      aviso('Temporada creada. Agregue sus páginas y textos.', 'ok');
    });
  }
  function activarTemporada(id) {
    var t = S.datos.temporadas.filter(function (x) { return x.id === id; })[0];
    var paginas = (t.secciones || []).reduce(function (s, x) { return s + (x.paginas || []).length; }, 0);
    if (!paginas) return aviso('Esa temporada no tiene páginas todavía.', 'error');
    return dialogo('Hacer visible', 'Al <b>publicar</b>, el catálogo público mostrará «' + esc(t.nombre) + '» en lugar de la temporada actual. La anterior queda guardada.', [], 'Hacer visible').then(function (v) {
      if (!v) return; S.datos.activa = id; cambio(true); pintarTodo(); aviso('Listo. Pulse «Publicar» para aplicarlo.', 'ok');
    });
  }
  function eliminarTemporada(id) {
    var t = S.datos.temporadas.filter(function (x) { return x.id === id; })[0];
    return dialogo('Eliminar temporada', '¿Eliminar «' + esc(t.nombre) + '»? Las imágenes ya publicadas se conservan en el repositorio.', [], 'Eliminar', true).then(function (v) {
      if (!v) return;
      S.datos.temporadas = S.datos.temporadas.filter(function (x) { return x.id !== id; });
      if (S.temporada === id) S.temporada = S.datos.activa;
      cambio(true); pintarTodo();
    });
  }

  /* ═══════════════ Vista previa y publicación ═══════════════ */
  function validar() {
    var errores = [];
    var activa = S.datos.temporadas.filter(function (t) { return t.id === S.datos.activa; })[0];
    if (!activa) errores.push('No hay temporada visible.');
    S.datos.temporadas.forEach(function (t) {
      (t.secciones || []).forEach(function (s) {
        if (!s.nombre) errores.push('Hay una sección sin nombre en «' + t.nombre + '».');
        (s.paginas || []).forEach(function (p, i) {
          if (p.vinculo && !/^https:\/\/forms\.(cloud\.microsoft|office\.com)\//.test(p.vinculo)) errores.push('«' + s.nombre + '», página ' + (i + 1) + ': el vínculo debe ser de Microsoft Forms.');
        });
      });
    });
    if (S.datos.formsUrl && !/^https:\/\/forms\.(cloud\.microsoft|office\.com)\//.test(S.datos.formsUrl)) errores.push('El enlace del formulario debe ser de Microsoft Forms.');
    return errores;
  }
  function vistaPrevia() {
    var imagenes = {}; Object.keys(S.pendientes).forEach(function (r) { imagenes[r] = S.pendientes[r].dataUrl; });
    try {
      localStorage.setItem('catalogo-borrador', JSON.stringify({ datos: S.datos, temporada: S.temporada, imagenes: imagenes }));
    } catch (e) {
      return aviso('Hay demasiadas imágenes nuevas para la vista previa. Publique primero o quite algunas.', 'error');
    }
    window.open('../?borrador=1', '_blank', 'noopener');
  }
  function publicar() {
    if (!hayCambios()) return aviso('No hay cambios por publicar.');
    var errores = validar();
    if (errores.length) return aviso(errores[0], 'error');
    // Solo se suben las imágenes nuevas que siguen en uso.
    var usadas = {};
    S.datos.temporadas.forEach(function (t) { (t.secciones || []).forEach(function (s) { (s.paginas || []).forEach(function (p) { usadas[p.imagen] = 1; }); }); });
    var imagenes = Object.keys(S.pendientes).filter(function (r) { return usadas[r]; });
    var activa = S.datos.temporadas.filter(function (t) { return t.id === S.datos.activa; })[0];
    return dialogo('Publicar cambios', 'Se publicarán ' + imagenes.length + ' imagen(es) nuevas y los textos. El público verá «' + esc(activa.nombre) + '» en 1 a 2 minutos.', [], 'Publicar').then(function (v) {
      if (!v) return;
      var b = $('#boton-publicar'); b.disabled = true; b.textContent = 'Publicando…';
      S.datos.actualizado = new Date().toISOString(); S.datos.actualizadoPor = S.usuario;
      var archivos = imagenes.map(function (r) { return { ruta: r, base64: S.pendientes[r].base64 }; });
      archivos.push({ ruta: RUTA_DATOS, base64: textoAB64(JSON.stringify(S.datos, null, 2)) });
      return publicarArchivos(archivos, [], 'Panel: actualización del catálogo por ' + S.usuario).then(function () {
        S.pendientes = {}; S.original = JSON.stringify(S.datos); borrarBorradorLocal();
        aviso('¡Publicado! El catálogo se actualiza en 1 a 2 minutos.', 'ok');
      }).catch(function (e) {
        aviso('No se pudo publicar: ' + (e.status === 401 ? 'el token venció.' : e.message), 'error');
      }).then(function () { b.disabled = false; pintarTodo(); });
    });
  }
  function salir() {
    var seguir = hayCambios() ? dialogo('Salir', 'Tiene cambios sin publicar. Quedan guardados en este equipo como borrador.', [], 'Salir') : Promise.resolve({});
    seguir.then(function (v) {
      if (!v) return;
      S.token = null; S.maestra = null; S.maestraBytes = null; S.datos = null;
      $('#app').hidden = true; $('#pantalla-acceso').hidden = false; mostrarLogin();
    });
  }

  /* ═══════════════ Usuarios ═══════════════ */
  function agregarUsuario() {
    return dialogo('Agregar usuario', 'Entregue la contraseña a la persona por un medio seguro.', [
      { id: 'usuario', etiqueta: 'Usuario', valor: '' },
      { id: 'contrasena', etiqueta: 'Contraseña (mín. 12, letras y números)', tipo: 'password' },
      { id: 'confirmar', etiqueta: 'Repita la contraseña', tipo: 'password' },
    ], 'Agregar').then(function (v) {
      if (!v) return;
      if (!/^[\w.\-]{3,40}$/.test(v.usuario)) return aviso('Usuario no válido (3 a 40 letras, números, punto o guion).', 'error');
      if (S.acceso.usuarios.some(function (u) { return u.usuario.toLowerCase() === v.usuario.toLowerCase(); })) return aviso('Ese usuario ya existe.', 'error');
      var err = validarContrasena(v.contrasena, v.confirmar); if (err) return aviso(err, 'error');
      aviso('Guardando usuario…');
      return envolverMaestra(v.usuario, v.contrasena, S.maestraBytes, S.acceso.iteraciones || ITERACIONES).then(function (u) {
        S.acceso.usuarios.push(u); return guardarAcceso('Panel: nuevo usuario ' + v.usuario);
      }).then(function () { aviso('Usuario agregado.', 'ok'); pintarContenido(); }, function (e) { aviso('Error: ' + e.message, 'error'); });
    });
  }
  function eliminarUsuario(usuario) {
    return dialogo('Eliminar usuario', '¿Quitar el acceso de «' + esc(usuario) + '»?', [], 'Eliminar', true).then(function (v) {
      if (!v) return;
      S.acceso.usuarios = S.acceso.usuarios.filter(function (u) { return u.usuario !== usuario; });
      return guardarAcceso('Panel: usuario eliminado ' + usuario).then(function () { aviso('Usuario eliminado.', 'ok'); pintarContenido(); }, function (e) { aviso('Error: ' + e.message, 'error'); });
    });
  }
  function cambiarContrasena() {
    return dialogo('Cambiar mi contraseña', '', [
      { id: 'contrasena', etiqueta: 'Nueva contraseña (mín. 12, letras y números)', tipo: 'password' },
      { id: 'confirmar', etiqueta: 'Repita la contraseña', tipo: 'password' },
    ], 'Cambiar').then(function (v) {
      if (!v) return;
      var err = validarContrasena(v.contrasena, v.confirmar); if (err) return aviso(err, 'error');
      return envolverMaestra(S.usuario, v.contrasena, S.maestraBytes, S.acceso.iteraciones || ITERACIONES).then(function (nuevo) {
        S.acceso.usuarios = S.acceso.usuarios.map(function (u) { return u.usuario === S.usuario ? Object.assign(nuevo, { creado: u.creado }) : u; });
        return guardarAcceso('Panel: cambio de contraseña de ' + S.usuario);
      }).then(function () { aviso('Contraseña cambiada.', 'ok'); }, function (e) { aviso('Error: ' + e.message, 'error'); });
    });
  }
  function reemplazarToken() {
    return dialogo('Reemplazar token', 'Pegue el token nuevo (mismo repositorio y permiso Contents: Read and write).', [{ id: 'token', etiqueta: 'Token nuevo', tipo: 'password' }], 'Reemplazar').then(function (v) {
      if (!v || !v.token) return;
      var anterior = S.token; S.token = v.token;
      return gh('GET', base).then(function (repo) {
        if (!repo.permissions || !repo.permissions.push) throw new Error('El token no tiene permiso de escritura.');
        return cifrar(S.maestra, te.encode(v.token));
      }).then(function (c) { S.acceso.token = c; return guardarAcceso('Panel: token renovado'); })
        .then(function () { aviso('Token reemplazado.', 'ok'); }, function (e) { S.token = anterior; aviso('Error: ' + (e.status === 401 ? 'token no válido.' : e.message), 'error'); });
    });
  }

  /* ═══════════════ Eventos ═══════════════ */
  document.addEventListener('click', alAccion);
  document.addEventListener('input', function (e) { if (e.target.closest('#contenido')) alEditar(e); });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.matches('input[type=checkbox], select') && el.closest('#contenido')) alEditar(e);
    if (el.getAttribute('data-accion') === 'pag-agregar') { agregarArchivos(el.files, +el.closest('[data-sec]').getAttribute('data-sec')); el.value = ''; }
    if (el.getAttribute('data-accion') === 'pag-reemplazar') { agregarArchivos(el.files, +el.closest('[data-sec]').getAttribute('data-sec'), +el.closest('[data-pag]').getAttribute('data-pag')); el.value = ''; }
  });
  // Arrastrar y soltar imágenes sobre «Agregar páginas».
  document.addEventListener('dragover', function (e) { var z = e.target.closest && e.target.closest('[data-soltar]'); if (z) { e.preventDefault(); z.classList.add('encima'); } });
  document.addEventListener('dragleave', function (e) { var z = e.target.closest && e.target.closest('[data-soltar]'); if (z) z.classList.remove('encima'); });
  document.addEventListener('drop', function (e) {
    var z = e.target.closest && e.target.closest('[data-soltar]');
    if (!z) return; e.preventDefault(); z.classList.remove('encima');
    agregarArchivos(e.dataTransfer.files, +z.closest('[data-sec]').getAttribute('data-sec'));
  });
  $('#pestanas').addEventListener('click', function (e) { var b = e.target.closest('[data-pestana]'); if (b) { S.pestana = b.getAttribute('data-pestana'); pintarTodo(); } });
  $('#temporada-editando').addEventListener('change', function (e) { S.temporada = e.target.value; pintarTodo(); });
  window.addEventListener('beforeunload', function (e) { if (S.datos && hayCambios()) { guardarBorradorLocal(); e.preventDefault(); e.returnValue = ''; } });

  iniciar();
})();
