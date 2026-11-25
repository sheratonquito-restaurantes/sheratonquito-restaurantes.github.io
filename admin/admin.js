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
  var RUTA_BORRADOR = 'data/borrador.json'; // cambios guardados sin publicar (no lo usa el catálogo público)
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
    datos: null, original: '', catalogo: null, temporada: null, eliminados: [],
    pendientes: {}, // ruta -> { dataUrl, base64 }
    pestana: 'catalogos',
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
    if (/\/contents\/data\/borrador\.json/.test(ruta)) {
      var bor = localStorage.getItem('demo-borrador');
      if (bor) return Promise.resolve({ content: textoAB64(bor) });
    }
    if (/\/contents\//.test(ruta)) { var e = new Error('No encontrado'); e.status = 404; return Promise.reject(e); }
    if (metodo === 'GET' && ruta === base) return Promise.resolve({ permissions: { push: true }, full_name: 'demo' });
    return Promise.resolve({});
  }
  function demoPublicar(archivos, borrar) {
    archivos.forEach(function (a) {
      if (a.ruta === RUTA_DATOS) localStorage.setItem('demo-catalogo', b64ATexto(a.base64));
      if (a.ruta === RUTA_ACCESO) localStorage.setItem('demo-acceso', b64ATexto(a.base64));
      if (a.ruta === RUTA_BORRADOR) localStorage.setItem('demo-borrador', b64ATexto(a.base64));
    });
    if ((borrar || []).indexOf(RUTA_BORRADOR) >= 0) localStorage.removeItem('demo-borrador');
    return new Promise(function (r) { setTimeout(r, 400); });
  }

  /* ═══════════════ Avisos y diálogos ═══════════════ */
  var tAviso;
  function aviso(texto, tipo) {
    var a = $('#aviso'); a.textContent = texto; a.className = 'aviso ' + (tipo || ''); a.hidden = false;
    clearTimeout(tAviso); tAviso = setTimeout(function () { a.hidden = true; }, tipo === 'error' ? 7000 : 3500);
  }
  // Diálogo simple: campos [{id, etiqueta, tipo, valor, ayuda, opciones}] → Promise(valores | null)
  function dialogo(titulo, texto, campos, botonOk, peligro, botonExtra) {
    return new Promise(function (resolver) {
      var f = $('#dialogo-form');
      f.innerHTML = '<h3>' + esc(titulo) + '</h3>' + (texto ? '<p class="ayuda" style="margin:0">' + texto + '</p>' : '') +
        (campos || []).map(function (c) {
          var control = c.tipo === 'select'
            ? '<select name="' + c.id + '">' + c.opciones.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === c.valor ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'
            : '<input name="' + c.id + '" type="' + (c.tipo || 'text') + '" value="' + esc(c.valor || '') + '" autocomplete="' + (c.tipo === 'password' ? 'new-password' : 'off') + '">';
          return '<label class="campo">' + esc(c.etiqueta) + (c.ayuda ? ' <small>' + esc(c.ayuda) + '</small>' : '') + control + '</label>';
        }).join('') +
        '<div class="fila fila-fin"><button value="no" class="btn btn-borde">Cancelar</button>' + (botonExtra ? '<button value="extra" class="btn btn-borde">' + esc(botonExtra) + '</button>' : '') + '<button value="si" class="btn ' + (peligro ? 'btn-peligro' : 'btn-negro') + '">' + esc(botonOk || 'Aceptar') + '</button></div>';
      var d = $('#dialogo');
      d.onclose = function () {
        if (d.returnValue === 'extra') return resolver({ __extra: true });
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
  var RESERVADOS = ['admin', 'assets', 'data', 'vendor', 'index', 'temas', 'app', 'estilos'];
  var FAVICON = 'assets/logos/favicon-sheraton.png';
  var LOGO_CLARO = 'assets/logos/sheraton-blanco.png', LOGO_OSCURO = 'assets/logos/sheraton-negro.png';
  var FORMS_OK = /^https:\/\/forms\.(cloud\.microsoft|office\.com)\//;
  var TEMAS = window.TEMAS || {}, EFECTOS = window.EFECTOS || [['ninguno', 'Sin efecto']];

  // Formato antiguo (un solo catálogo) → formato con varios catálogos.
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

  function cargarCatalogo() {
    return leerArchivo(RUTA_DATOS).then(function (texto) {
      var crudo = JSON.parse(texto);
      S.datos = migrar(crudo);
      S.original = JSON.stringify(crudo.version >= 2 ? S.datos : crudo); // si se migró, cuenta como cambio por publicar
      S.catalogo = S.datos.principal; S.temporada = Cat().activa;
      S.pendientes = {}; S.cache = {};
      return leerArchivo(RUTA_BORRADOR).then(function (t) { return JSON.parse(t); }, function () { return null; });
    }).then(function (nube) {
      if (nube && nube.datos) {
        S.datos = migrar(nube.datos);
        S.catalogo = nube.catalogo || S.datos.principal; S.temporada = nube.temporada || Cat().activa;
        S.borradorNube = nube;
      }
      S.guardado = JSON.stringify(S.datos);
      var b = leerBorradorLocal();
      if (b && nube && b.fecha <= nube.fecha) b = null; // lo local es más antiguo que lo guardado
      $('#pantalla-acceso').hidden = true; $('#app').hidden = false;
      $('#usuario-actual').textContent = 'Usuario: ' + S.usuario + (DEMO ? ' · modo de prueba' : '');
      pintarTodo();
      if (S.borradorNube) aviso('Se abrió el borrador guardado por ' + (S.borradorNube.usuario || '—') + ' el ' + new Date(S.borradorNube.fecha).toLocaleString('es-EC') + ' — siga editando y pulse «Publicar» cuando esté listo.', 'ok');
      if (b && b.usuario === S.usuario && b.datos && JSON.stringify(b.datos) !== JSON.stringify(S.datos)) {
        dialogo('Hay cambios sin guardar', 'Se encontraron cambios de este equipo del ' + esc(new Date(b.fecha).toLocaleString('es-EC')) + ' que no se alcanzaron a guardar. ¿Desea recuperarlos?', [], 'Recuperar').then(function (v) {
          if (v) { S.datos = migrar(b.datos); S.pendientes = b.pendientes || {}; S.catalogo = b.catalogo || S.datos.principal; S.temporada = b.temporada || Cat().activa; pintarTodo(); aviso('Borrador recuperado.'); }
          else borrarBorradorLocal();
        });
      }
    });
  }

  function Cat() { var l = S.datos.catalogos; return l.filter(function (c) { return c.id === S.catalogo; })[0] || l[0]; }
  function T() { var c = Cat(); return (c.temporadas || []).filter(function (t) { return t.id === S.temporada; })[0] || c.temporadas[0]; }
  function hayCambios() { return JSON.stringify(S.datos) !== S.original || Object.keys(S.pendientes).length > 0; }
  function sinGuardar() { return JSON.stringify(S.datos) !== S.guardado || Object.keys(S.pendientes).length > 0; }

  function guardarBorradorLocal() {
    var base = { usuario: S.usuario, fecha: Date.now(), datos: S.datos, catalogo: S.catalogo, temporada: S.temporada };
    try { localStorage.setItem('catalogo-admin-borrador', JSON.stringify(Object.assign({ pendientes: S.pendientes }, base))); }
    catch (e) { try { localStorage.setItem('catalogo-admin-borrador', JSON.stringify(Object.assign({ pendientes: {} }, base))); } catch (e2) { /* sin espacio */ } }
  }
  function leerBorradorLocal() { try { return JSON.parse(localStorage.getItem('catalogo-admin-borrador') || 'null'); } catch (e) { return null; } }
  function borrarBorradorLocal() { try { localStorage.removeItem('catalogo-admin-borrador'); } catch (e) { /* nada */ } }

  var tGuardar;
  function cambio(repintar) {
    clearTimeout(tGuardar); tGuardar = setTimeout(guardarBorradorLocal, 400);
    actualizarCabecera();
    if (repintar) pintarContenido();
  }
  function rutaImagen(ruta) { return S.pendientes[ruta] ? S.pendientes[ruta].dataUrl : (S.cache && S.cache[ruta]) || '../' + ruta; }
  function enlacePublico(c) {
    var raiz = DEMO ? location.origin + '/' : 'https://' + REPO.nombre + '/';
    return c.id === S.datos.principal ? raiz : raiz + c.id + '/';
  }

  /* ═══════════════ Imágenes ═══════════════ */
  var ANCHO = 880, ALTO = 1100;
  function leerComoDataUrl(archivo) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(archivo); });
  }
  function cargarImg(u) { return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = u; }); }
  function prepararImagen(archivo) {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(archivo.type)) return Promise.reject(new Error(archivo.name + ': formato no permitido (use JPG, PNG, WEBP o GIF).'));
    if (archivo.size > 15 * 1024 * 1024) return Promise.reject(new Error(archivo.name + ': supera 15 MB.'));
    if (archivo.type === 'image/gif') {
      if (archivo.size > 5 * 1024 * 1024) return Promise.reject(new Error(archivo.name + ': el GIF supera 5 MB; redúzcalo antes de subirlo.'));
      return leerComoDataUrl(archivo).then(function (u) { return { dataUrl: u, ext: 'gif' }; });
    }
    return leerComoDataUrl(archivo).then(cargarImg).then(function (img) {
      var c = document.createElement('canvas'); c.width = ANCHO; c.height = ALTO;
      var g = c.getContext('2d'); g.fillStyle = '#0c0b0a'; g.fillRect(0, 0, ANCHO, ALTO);
      var e = Math.min(ANCHO / img.width, ALTO / img.height), w = img.width * e, h = img.height * e;
      g.imageSmoothingQuality = 'high'; g.drawImage(img, (ANCHO - w) / 2, (ALTO - h) / 2, w, h);
      return { dataUrl: c.toDataURL('image/jpeg', 0.86), ext: 'jpg', aviso: Math.abs(img.width / img.height - 0.8) > 0.06 ? archivo.name + ' no es vertical 4:5; se agregaron bordes.' : '' };
    }, function () { throw new Error(archivo.name + ': no se pudo leer la imagen.'); });
  }
  // Logos: PNG o WEBP con fondo transparente; se reducen a 1000 px de ancho como máximo.
  function prepararLogo(archivo) {
    if (!/^image\/(png|webp)$/.test(archivo.type)) return Promise.reject(new Error('El logo debe ser PNG o WEBP con fondo transparente.'));
    if (archivo.size > 3 * 1024 * 1024) return Promise.reject(new Error('El logo supera 3 MB.'));
    return leerComoDataUrl(archivo).then(cargarImg).then(function (img) {
      var e = Math.min(1, 1000 / img.width), c = document.createElement('canvas');
      c.width = Math.round(img.width * e); c.height = Math.round(img.height * e);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return { dataUrl: c.toDataURL('image/png'), ext: 'png' };
    });
  }
  // Favicon: se recorta al centro en cuadrado y se reduce a 192 × 192 px.
  function prepararFavicon(archivo) {
    if (!/^image\/(png|jpeg|webp)$/.test(archivo.type)) return Promise.reject(new Error('El favicon debe ser PNG, JPG o WEBP.'));
    if (archivo.size > 3 * 1024 * 1024) return Promise.reject(new Error('La imagen supera 3 MB.'));
    return leerComoDataUrl(archivo).then(cargarImg).then(function (img) {
      var lado = Math.min(img.width, img.height), c = document.createElement('canvas'); c.width = c.height = 192;
      var g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
      g.drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, 192, 192);
      return { dataUrl: c.toDataURL('image/png'), ext: 'png', aviso: Math.abs(img.width - img.height) > 4 ? 'La imagen no era cuadrada; se recortó al centro.' : '' };
    });
  }
  function registrarImagen(prep, carpeta) {
    var ruta = 'assets/' + carpeta + '/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + '.' + prep.ext;
    S.pendientes[ruta] = { dataUrl: prep.dataUrl, base64: prep.dataUrl.split(',')[1] };
    return ruta;
  }
  function slug(t) { return String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'catalogo'; }

  /* ═══════════════ Pintado ═══════════════ */
  function pintarTodo() { actualizarCabecera(); pintarContenido(); }
  function opciones(lista, valor) { return lista.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === valor ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join(''); }

  function actualizarCabecera() {
    var c = Cat();
    $('#catalogo-editando').innerHTML = opciones(S.datos.catalogos.map(function (x) { return [x.id, x.nombre]; }), c.id);
    $('#temporada-editando').innerHTML = opciones(c.temporadas.map(function (t) { return [t.id, t.nombre]; }), S.temporada);
    var activa = S.temporada === c.activa;
    var chip = $('#estado-temporada');
    chip.textContent = activa ? '● Visible al público' : 'No visible (borrador)';
    chip.className = 'chip' + (activa ? ' activa' : '');
    var n = Object.keys(S.pendientes).length;
    $('#boton-publicar').innerHTML = '🚀 Publicar' + (hayCambios() ? ' <span class="contador-cambios">•</span>' : '');
    var g = $('#boton-guardar'), ng = sinGuardar();
    if (!g.disabled) g.innerHTML = '💾 Guardar' + (ng ? ' <span class="contador-cambios">' + (n ? n + ' img' : '•') + '</span>' : '');
    var est = $('#estado-guardado');
    est.textContent = ng ? '● Cambios sin guardar' : (S.horaGuardado ? '✓ Guardado ' + S.horaGuardado : (hayCambios() ? '✓ Guardado (sin publicar)' : '✓ Todo publicado'));
    est.className = 'chip ' + (ng ? 'pendiente' : 'activa');
    $$('#pestanas button').forEach(function (x) { x.classList.toggle('activa', x.getAttribute('data-pestana') === S.pestana); });
  }
  function pintarContenido() {
    var f = { catalogos: vistaCatalogos, temporadas: vistaTemporadas, paginas: vistaPaginas, textos: vistaTextos, diseno: vistaDiseno, usuarios: vistaUsuarios }[S.pestana];
    $('#contenido').innerHTML = f();
  }
  function campo(etiqueta, ruta, valor, opt) {
    opt = opt || {};
    var control = opt.area
      ? '<textarea data-campo="' + ruta + '" rows="' + (opt.filas || 3) + '">' + esc(valor) + '</textarea>'
      : '<input type="' + (opt.tipo || 'text') + '" data-campo="' + ruta + '" value="' + esc(valor) + '"' + (opt.ph ? ' placeholder="' + esc(opt.ph) + '"' : '') + '>';
    return '<label class="campo">' + esc(etiqueta) + (opt.ayuda ? ' <small>' + esc(opt.ayuda) + '</small>' : '') + control + '</label>';
  }
  function nombreFormulario(id) {
    var f = (Cat().formularios || []).filter(function (x) { return x.id === id; })[0] || (Cat().formularios || [])[0];
    return f ? (f.nombre || 'formulario sin nombre') : 'sin formulario';
  }
  function opcionesFormulario(valor, textoVacio) {
    return '<option value="">' + esc(textoVacio) + '</option>' + (Cat().formularios || []).map(function (f) {
      return '<option value="' + esc(f.id) + '"' + (f.id === valor ? ' selected' : '') + '>' + esc(f.nombre || f.url) + '</option>';
    }).join('');
  }
  var MEDIDAS = '<details class="tarjeta medidas"><summary>📐 Medidas recomendadas <small>(clic para ver)</small></summary><div class="rejilla">' +
    '<div><b>Páginas del catálogo</b><p>Vertical <b>4:5</b> · ideal <b>1080 × 1350 px</b> (o 1400 × 1750). JPG, PNG o WEBP hasta 15 MB. Se ajustan solas a 880 × 1100; si no son 4:5 se agregan bordes.</p></div>' +
    '<div><b>GIF animados</b><p>Vertical 4:5, <b>máximo 5 MB</b> (ideal menos de 2 MB para que cargue rápido en celular). Se suben sin cambios para conservar la animación.</p></div>' +
    '<div><b>Logos</b><p><b>PNG con fondo transparente</b>, de 800 a 1000 px de ancho. Suba una versión <b>blanca</b> (para fondos oscuros) y otra <b>negra o a color</b> (para fondos claros).</p></div>' +
    '<div><b>Textos dentro de las imágenes</b><p>Deje un margen de 60 px alrededor y use letra grande: en el celular la página se ve de unos 360 px de ancho.</p></div>' +
    '</div></details>';

  function vistaCatalogos() {
    return '<h2>Catálogos</h2><p class="ayuda">Cree un catálogo por área (A&B, Recepción, Eventos, Grupos, Mercadeo…). Cada uno tiene su propio <b>enlace</b>, <b>tema de color</b>, <b>logos</b>, <b>formularios</b> y <b>temporadas</b>. <b>Todos los catálogos funcionan al mismo tiempo</b>, cada uno en su enlace; el <b>principal</b> además se abre en la dirección raíz. Cuando un catálogo esté listo y publicado, cree su <b>enlace corto</b> para compartirlo por WhatsApp.</p>' +
      S.datos.catalogos.map(function (c) {
        var principal = c.id === S.datos.principal, edit = c.id === S.catalogo, tema = TEMAS[c.tema] || {};
        var activa = c.temporadas.filter(function (t) { return t.id === c.activa; })[0];
        return '<div class="tarjeta temporada"><div class="muestra-tema" style="background:' + esc((tema.v || {}).fondo || '#222') + '"><span style="background:' + esc((tema.v || {}).acento || '#c9a96e') + '"></span></div>' +
          '<div class="info"><b>' + esc(c.nombre) + '</b> ' + (principal ? '<span class="chip activa">★ Principal</span>' : '') + (edit ? ' <span class="chip">Editando</span>' : '') +
          '<p>' + esc(tema.nombre || c.tema) + ' · ' + c.temporadas.length + ' temporada(s) · visible: ' + esc(activa ? activa.nombre : '—') + '</p>' +
          '<p>🌐 <a href="' + esc(enlacePublico(c)) + '" target="_blank" rel="noopener">' + esc(enlacePublico(c)) + '</a></p>' +
          (c.enlaceCorto ? '<p>🔗 Enlace corto: <a href="' + esc(c.enlaceCorto) + '" target="_blank" rel="noopener"><b>' + esc(c.enlaceCorto) + '</b></a> <button class="btn-icono" title="Copiar" data-accion="copiar" data-texto="' + esc(c.enlaceCorto) + '">📋</button></p>' : '') + '</div>' +
          '<div class="fila">' + (edit ? '' : '<button class="btn btn-borde btn-chico" data-accion="editar-catalogo" data-id="' + esc(c.id) + '">✏️ Editar</button>') +
          '<button class="btn btn-dorado btn-chico" data-accion="enlace-corto" data-id="' + esc(c.id) + '">🔗 ' + (c.enlaceCorto ? 'Cambiar enlace corto' : 'Crear enlace corto') + '</button>' +
          '<button class="btn btn-borde btn-chico" data-accion="descargar-qr" data-id="' + esc(c.id) + '">📱 Descargar QR</button>' +
          '<button class="btn btn-borde btn-chico" data-accion="duplicar-catalogo" data-id="' + esc(c.id) + '">⧉ Duplicar</button>' +
          (principal ? '' : '<button class="btn btn-borde btn-chico" data-accion="principal-catalogo" data-id="' + esc(c.id) + '">★ Hacer principal</button>') +
          (principal ? '' : '<button class="btn btn-peligro btn-chico" data-accion="eliminar-catalogo" data-id="' + esc(c.id) + '">Eliminar</button>') +
          '</div></div>';
      }).join('') +
      '<div class="fila"><button class="btn btn-negro" data-accion="nuevo-catalogo">＋ Nuevo catálogo</button></div>';
  }

  function vistaTemporadas() {
    var c = Cat();
    return '<h2>Temporadas · ' + esc(c.nombre) + '</h2><p class="ayuda">Cada temporada es una versión completa de este catálogo (Navidad, Carnaval, Día de la Madre…). Solo <b>una</b> es visible al público. Para empezar una nueva, lo más rápido es <b>duplicar</b> la actual y cambiar sus páginas.</p>' +
      c.temporadas.map(function (t) {
        var activa = t.id === c.activa, edit = t.id === S.temporada;
        var paginas = (t.secciones || []).reduce(function (s, x) { return s + (x.paginas || []).length; }, 0);
        var primera = ((t.secciones || [])[0] || { paginas: [] }).paginas[0];
        return '<div class="tarjeta temporada">' +
          (primera ? '<img class="miniatura" src="' + esc(rutaImagen(primera.imagen)) + '" alt="">' : '<div class="miniatura"></div>') +
          '<div class="info"><b>' + esc(t.nombre) + '</b> ' + (activa ? '<span class="chip activa">● Visible al público</span>' : '') + (edit ? ' <span class="chip">Editando</span>' : '') +
          '<p>' + (t.secciones || []).length + ' secciones · ' + paginas + ' páginas</p></div><div class="fila">' +
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
    return '<h2>Secciones y páginas · ' + esc(Cat().nombre) + ' · ' + esc(t.nombre) + '</h2>' +
      '<p class="ayuda">Cada sección aparece en el menú superior del catálogo con su ícono y su propio efecto. Elija qué <b>formulario</b> abre el botón «Reservar»: puede definirlo para toda la sección o para cada página. El <b>vínculo prellenado</b> (opcional) abre el formulario con el producto ya marcado.</p>' +
      MEDIDAS +
      (t.secciones || []).map(function (s, si) {
        return '<div class="tarjeta" data-sec="' + si + '">' +
          '<div class="seccion-cab">' +
          '<label class="campo">Ícono<span class="icono-elegir"><input type="text" data-campo="sec.icono" value="' + esc(s.icono) + '" maxlength="8"><button type="button" class="btn btn-borde btn-chico" data-accion="icono-elegir">Elegir…</button></span></label>' +
          '<label class="campo">Nombre de la sección<input type="text" data-campo="sec.nombre" value="' + esc(s.nombre) + '"></label>' +
          '<label class="campo">Descripción (índice)<input type="text" data-campo="sec.descripcion" value="' + esc(s.descripcion) + '"></label>' +
          '<label class="campo">Efecto<select data-campo="sec.efecto">' + opciones(EFECTOS, s.efecto || 'ninguno') + '</select></label>' +
          '<label class="campo">Formulario de la sección<select data-campo="sec.formulario">' + opcionesFormulario(s.formulario, 'El del catálogo') + '</select></label>' +
          '<div class="fila"><button class="btn-icono" title="Subir sección" data-accion="sec-subir">▲</button><button class="btn-icono" title="Bajar sección" data-accion="sec-bajar">▼</button><button class="btn-icono" title="Eliminar sección" data-accion="sec-eliminar">🗑</button></div>' +
          '</div><div class="paginas">' +
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
                '<label class="check"><input type="checkbox" data-campo="pag.mismoForm"' + (!p.formulario && !p.vinculo ? ' checked' : '') + '> Usar el formulario de la sección <small>(' + esc(nombreFormulario(s.formulario || Cat().formulario)) + ')</small></label>' +
                (p.formulario || p.vinculo ? (
                  '<label class="campo">Otro formulario para esta página<select data-campo="pag.formulario">' + opcionesFormulario(p.formulario, 'El de la sección') + '</select></label>' +
                  '<label class="campo">Vínculo prellenado <small>(opcional, tiene prioridad)</small><input type="url" data-campo="pag.vinculo" value="' + esc(p.vinculo) + '" placeholder="https://forms.cloud.microsoft/…"></label>') : '') +
                '<label class="campo">Texto del botón <small>(opcional)</small><input type="text" data-campo="pag.boton" value="' + esc(p.boton) + '" placeholder="📅 Reservar este"></label>') : '') +
              '</div>';
          }).join('') +
          '<label class="agregar-paginas" data-soltar><input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" data-accion="pag-agregar" hidden><span><b>＋ Agregar páginas</b>Haga clic o arrastre aquí imágenes o GIF<br><small>1080 × 1350 px, vertical</small></span></label>' +
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
      '<div class="tarjeta"><h3>Índice</h3><div class="rejilla">' +
      campo('Título', 'T.indiceTitulo', t.indiceTitulo, { ph: '¿Qué le gustaría' }) + campo('Subtítulo (cursiva)', 'T.indiceSubtitulo', t.indiceSubtitulo, { ph: 'conocer?' }) + '</div></div>' +
      '<div class="tarjeta"><h3>Contraportada</h3><div class="rejilla">' +
      campo('Sobretítulo', 'T.contraportada.sobretitulo', cp.sobretitulo) + campo('Título (cursiva)', 'T.contraportada.titulo', cp.titulo) + campo('Segunda línea', 'T.contraportada.subtitulo', cp.subtitulo) + '</div></div>';
  }

  function vistaFavicon(c) {
    var general = S.datos.favicon || FAVICON, propio = c.favicon;
    var caja = function (ruta, titulo, ayuda, ambito, cambiado, textoQuitar) {
      return '<div class="logo-caja"><div class="favicon-vista"><img src="' + esc(rutaImagen(ruta)) + '" alt=""><span class="pestana-falsa"><img src="' + esc(rutaImagen(ruta)) + '" alt="">' + esc(c.nombre) + '</span></div>' +
        '<b>' + esc(titulo) + '</b><small>' + esc(ayuda) + '</small><div class="fila">' +
        '<label class="btn btn-borde btn-chico">Subir imagen<input type="file" accept="image/png,image/jpeg,image/webp" data-accion="favicon-subir" data-ambito="' + ambito + '" hidden></label>' +
        (cambiado ? '<button class="btn btn-peligro btn-chico" data-accion="favicon-quitar" data-ambito="' + ambito + '">' + textoQuitar + '</button>' : '') + '</div></div>';
    };
    return '<div class="tarjeta"><h3>Favicon (ícono de la pestaña del navegador)</h3><p class="ayuda" style="margin-bottom:12px">Por defecto todos los catálogos usan el <b>emblema del hotel</b>. Si cambia el logo, suba aquí el nuevo: imagen <b>cuadrada</b>, mínimo <b>192 × 192 px</b> (ideal 512 × 512), PNG con fondo de color o transparente.</p><div class="logos">' +
      caja(general, 'Favicon general', 'para todos los catálogos', 'general', !!S.datos.favicon, 'Volver al del hotel') +
      caja(propio || general, 'Favicon solo de «' + c.nombre + '»', propio ? 'este catálogo usa uno propio' : 'opcional: hoy usa el general', 'catalogo', !!propio, 'Usar el general') +
      '</div></div>';
  }

  function parLogo(kClaro, kOscuro, titulo, ayuda, defClaro, defOscuro) {
    var c = Cat(), L = c.logos || {}, tema = TEMAS[c.tema] || {};
    var temaClaro = tema.logo === 'oscuro';
    var vista = function (k, def, fondo, etiqueta, enUso) {
      var ruta = L[k] || def;
      return '<div class="logo-version"><div class="logo-vista" style="background:' + fondo + '">' + (ruta ? '<img src="' + esc(rutaImagen(ruta)) + '" alt="">' : '<span>Sin logo</span>') + '</div>' +
        '<small><b>' + etiqueta + '</b>' + (enUso ? ' · <span class="en-uso">en la barra con el tema actual</span>' : '') + '</small>' +
        '<label class="btn btn-borde btn-chico">Subir esta versión<input type="file" accept="image/png,image/webp" data-accion="logo-subir" data-logo="' + k + '" hidden></label></div>';
    };
    var puesto = L[kClaro] || L[kOscuro];
    return '<div class="par-logo"><div class="par-cab"><b>' + esc(titulo) + '</b><small>' + esc(ayuda) + '</small></div>' +
      '<div class="par-versiones">' + vista(kClaro, defClaro, '#1b1916', 'Versión clara · fondos oscuros', !temaClaro) + vista(kOscuro, defOscuro, '#f4efe8', 'Versión oscura · fondos claros', temaClaro) + '</div>' +
      '<div class="fila"><button class="btn btn-dorado btn-chico" data-accion="logo-biblioteca" data-logo="' + kClaro + '">📚 Elegir de la biblioteca</button>' +
      (puesto ? '<button class="btn btn-peligro btn-chico" data-accion="logo-quitar-par" data-claro="' + kClaro + '" data-oscuro="' + kOscuro + '">' + (defClaro ? 'Volver al de Sheraton' : 'Quitar') + '</button>' : '') + '</div></div>';
  }

  function vistaDiseno() {
    var c = Cat(), M = c.menus || {}, L = c.logos || {};
    var logo = function (clave, titulo, ayuda, defecto, fondo) {
      var ruta = L[clave] || defecto;
      return '<div class="logo-caja"><div class="logo-vista" style="background:' + fondo + '">' + (ruta ? '<img src="' + esc(rutaImagen(ruta)) + '" alt="">' : '<span>Sin logo</span>') + '</div>' +
        '<b>' + esc(titulo) + '</b><small>' + esc(ayuda) + '</small><div class="fila">' +
        '<button class="btn btn-dorado btn-chico" data-accion="logo-biblioteca" data-logo="' + clave + '">📚 Biblioteca</button>' +
        '<label class="btn btn-borde btn-chico">Subir PNG<input type="file" accept="image/png,image/webp" data-accion="logo-subir" data-logo="' + clave + '" hidden></label>' +
        (L[clave] ? '<button class="btn btn-peligro btn-chico" data-accion="logo-quitar" data-logo="' + clave + '">' + (defecto ? 'Usar el original' : 'Quitar') + '</button>' : '') + '</div></div>';
    };
    return '<h2>Diseño, formularios y contacto · ' + esc(c.nombre) + '</h2><p class="ayuda">Esto aplica a todas las temporadas de este catálogo.</p>' +
      '<div class="tarjeta"><h3>Datos del catálogo</h3><div class="rejilla">' + campo('Nombre del catálogo', 'C.nombre', c.nombre) +
      '<label class="campo">Enlace público<input type="text" value="' + esc(enlacePublico(c)) + '" readonly></label></div></div>' +
      '<div class="tarjeta"><h3>Tema de color</h3><div class="temas">' +
      Object.keys(TEMAS).map(function (k) {
        var tm = TEMAS[k];
        return '<button class="tema' + (c.tema === k ? ' elegido' : '') + '" data-accion="elegir-tema" data-tema="' + esc(k) + '">' +
          '<span class="tema-muestra" style="background:' + esc(tm.v.fondo) + '"><i style="background:' + esc(tm.v.tapa) + '"></i><em style="background:' + esc(tm.v.acento) + '"></em></span>' +
          '<b>' + esc(tm.nombre) + '</b><small>' + esc(tm.descripcion) + '</small></button>';
      }).join('') + '</div></div>' +
      '<div class="tarjeta"><h3>Logos</h3><p class="ayuda" style="margin-bottom:12px">Cada logo tiene <b>dos versiones y se usan las dos</b>: el catálogo pone sola la <b>clara</b> sobre fondos oscuros y la <b>oscura</b> sobre fondos claros (bienvenida, páginas de papel y temas claros). Al elegir de la <b>📚 Biblioteca</b> se colocan ambas. También puede subir cada versión por separado (PNG transparente, 800 a 1000 px de ancho).</p><div class="pares-logo">' +
      parLogo('claro', 'oscuro', 'Logo principal', 'Bienvenida, barra superior y portada. Si no elige, se usa Sheraton.', LOGO_CLARO, LOGO_OSCURO) +
      parLogo('secundario', 'secundarioOscuro', 'Logo secundario (opcional)', 'Junto al del hotel en la portada y en la página de contacto. Ej.: Bakery & Deli.', '', '') +
      '</div></div>' +
      vistaFavicon(c) +
      '<div class="tarjeta lista-editable"><h3>Formularios de Microsoft Forms</h3><p class="ayuda" style="margin-bottom:6px">Agregue todos los formularios que use este catálogo (reservas, eventos, grupos, cotizaciones…). Luego elija cuál abre cada sección o página.</p>' +
      (c.formularios || []).map(function (f, i) {
        return '<div class="item form" data-form="' + i + '">' +
          '<label class="campo">Nombre<input type="text" data-campo="form.nombre" value="' + esc(f.nombre) + '" placeholder="Reservas restaurante"></label>' +
          '<label class="campo">Enlace del formulario<input type="url" data-campo="form.url" value="' + esc(f.url) + '" placeholder="https://forms.cloud.microsoft/r/…"></label>' +
          '<label class="check"><input type="radio" name="form-defecto" data-campo="form.defecto"' + (c.formulario === f.id ? ' checked' : '') + '> Predeterminado</label>' +
          '<button class="btn-icono" title="Quitar" data-accion="form-eliminar">🗑</button></div>';
      }).join('') +
      '<div class="fila" style="margin-top:10px"><button class="btn btn-borde btn-chico" data-accion="form-agregar">＋ Agregar formulario</button></div></div>' +
      '<div class="tarjeta lista-editable"><h3>Página de menús</h3><label class="check" style="margin-bottom:10px"><input type="checkbox" data-campo="C.menus.mostrar"' + (M.mostrar !== false ? ' checked' : '') + '> Mostrar la página de menús en este catálogo</label>' +
      (M.mostrar !== false ? ('<div class="rejilla">' + campo('Sobretítulo', 'C.menus.sobretitulo', M.sobretitulo) + campo('Título', 'C.menus.titulo', M.titulo) + '</div>' +
        (M.items || []).map(function (m, i) {
          return '<div class="item" data-menu="' + i + '">' +
            '<label class="campo">Nombre<input type="text" data-campo="menu.nombre" value="' + esc(m.nombre) + '"></label>' +
            '<label class="campo">Detalle<input type="text" data-campo="menu.detalle" value="' + esc(m.detalle) + '"></label>' +
            '<label class="campo">Precio<input type="text" data-campo="menu.precio" value="' + esc(m.precio) + '"></label>' +
            '<label class="campo">Formulario<select data-campo="menu.formulario">' + opcionesFormulario(m.formulario, 'El del catálogo') + '</select></label>' +
            '<button class="btn-icono" title="Quitar" data-accion="menu-eliminar">🗑</button></div>';
        }).join('') +
        '<div class="fila" style="margin-top:10px"><button class="btn btn-borde btn-chico" data-accion="menu-agregar">＋ Agregar menú</button></div>' +
        campo('Nota bajo los menús', 'C.menus.nota', M.nota, { area: true })) : '') + '</div>' +
      '<div class="tarjeta lista-editable"><h3>WhatsApp de contacto</h3>' +
      (c.telefonos || []).map(function (t, i) {
        return '<div class="item tel" data-tel="' + i + '">' +
          '<label class="campo">Nombre o área<input type="text" data-campo="tel.lugar" value="' + esc(t.lugar) + '"></label>' +
          '<label class="campo">Número<input type="text" data-campo="tel.numero" value="' + esc(t.numero) + '" placeholder="099 123 4567"></label>' +
          '<button class="btn-icono" title="Quitar" data-accion="tel-eliminar">🗑</button></div>';
      }).join('') +
      '<div class="fila" style="margin-top:10px"><button class="btn btn-borde btn-chico" data-accion="tel-agregar">＋ Agregar número</button></div></div>';
  }

  function vistaUsuarios() {
    var av = S.datos.aviso || {};
    return '<h2>Usuarios, acceso y aviso legal</h2><p class="ayuda">Cada persona debe tener su propio usuario. Las contraseñas no se guardan en ningún lado: solo sirven para abrir la llave cifrada. Si alguien olvida la suya, otro usuario lo elimina y lo vuelve a crear.</p>' +
      '<div class="tarjeta usuarios"><h3>Usuarios del panel</h3>' +
      S.acceso.usuarios.map(function (u) {
        return '<div class="item"><span><b>' + esc(u.usuario) + '</b>' + (u.usuario === S.usuario ? ' (usted)' : '') + ' <small style="color:#6e6a63">· creado ' + esc(new Date(u.creado || Date.now()).toLocaleDateString('es-EC')) + '</small></span>' +
          (u.usuario === S.usuario ? '' : '<button class="btn btn-peligro btn-chico" data-accion="usuario-eliminar" data-usuario="' + esc(u.usuario) + '">Eliminar</button>') + '</div>';
      }).join('') +
      '<div class="fila" style="margin-top:12px"><button class="btn btn-negro btn-chico" data-accion="usuario-agregar">＋ Agregar usuario</button>' +
      '<button class="btn btn-borde btn-chico" data-accion="usuario-contrasena">Cambiar mi contraseña</button></div></div>' +
      '<div class="tarjeta"><h3>Token de GitHub</h3><p class="ayuda" style="margin-bottom:10px">Cuando el token venza, regenérelo en GitHub (mismos permisos) y reemplácelo aquí. Los usuarios y contraseñas se mantienen.</p>' +
      '<button class="btn btn-borde btn-chico" data-accion="token-reemplazar">Reemplazar token</button></div>' +
      '<div class="tarjeta"><h3>Aviso de protección de datos (todos los catálogos)</h3><p class="mensaje info">Texto legal: cámbielo solo con aprobación del área legal.</p>' +
      campo('Título', 'D.aviso.titulo', av.titulo) + campo('Autorización', 'D.aviso.texto', av.texto, { area: true }) +
      campo('Derechos y política', 'D.aviso.derechos', av.derechos, { area: true, ayuda: 'los correos y enlaces se convierten solos en vínculos' }) +
      campo('Texto de la casilla', 'D.aviso.casilla', av.casilla) + '</div>';
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
    var c = Cat(), t = T(), repintar = false;
    var p = ruta.indexOf('.'), ambito = ruta.slice(0, p), clave = ruta.slice(p + 1);
    if (el.type === 'url') el.classList.toggle('invalido', !!valor && !FORMS_OK.test(valor));
    if (ambito === 'T') {
      if (clave === 'carta.parrafos') valor = valor.split(/\n\s*\n/).map(function (x) { return x.trim(); }).filter(Boolean);
      asignar(t, clave, valor);
      if (clave === 'nombre') actualizarCabecera();
    } else if (ambito === 'C') {
      asignar(c, clave, valor);
      if (clave === 'nombre') actualizarCabecera();
      if (clave === 'menus.mostrar') repintar = true;
    } else if (ambito === 'D') {
      asignar(S.datos, clave, valor);
    } else if (ambito === 'sec') {
      t.secciones[+el.closest('[data-sec]').getAttribute('data-sec')][clave] = valor;
    } else if (ambito === 'pag') {
      var s = t.secciones[+el.closest('[data-sec]').getAttribute('data-sec')];
      var pg = s.paginas[+el.closest('[data-pag]').getAttribute('data-pag')];
      if (clave === 'mismoForm') {
        if (valor) { delete pg.formulario; pg.vinculo = ''; }
        else pg.formulario = (c.formularios || []).filter(function (f) { return f.id !== (s.formulario || c.formulario); }).concat(c.formularios || [])[0].id;
        repintar = true;
      } else pg[clave] = valor;
      if (clave === 'reservar') repintar = true;
    } else if (ambito === 'menu') {
      c.menus.items[+el.closest('[data-menu]').getAttribute('data-menu')][clave] = valor;
    } else if (ambito === 'tel') {
      c.telefonos[+el.closest('[data-tel]').getAttribute('data-tel')][clave] = valor;
    } else if (ambito === 'form') {
      var f = c.formularios[+el.closest('[data-form]').getAttribute('data-form')];
      if (clave === 'defecto') c.formulario = f.id; else f[clave] = valor;
    }
    cambio(repintar);
  }

  function mover(lista, i, d) { var j = i + d; if (j < 0 || j >= lista.length) return false; var x = lista[i]; lista[i] = lista[j]; lista[j] = x; return true; }

  function agregarArchivos(archivos, si, reemplazarIndice) {
    var t = T(), s = t.secciones[si];
    var lista = Array.prototype.slice.call(archivos || []);
    if (!lista.length) return;
    aviso('Procesando ' + lista.length + ' imagen(es)…');
    var errores = [], notas = [];
    lista.reduce(function (pr, archivo, k) {
      return pr.then(function () {
        return prepararImagen(archivo).then(function (prep) {
          if (prep.aviso) notas.push(prep.aviso);
          var ruta = registrarImagen(prep, 'temporadas/' + Cat().id + '-' + t.id);
          if (reemplazarIndice != null && k === 0) {
            var viejo = s.paginas[reemplazarIndice].imagen;
            if (S.pendientes[viejo]) delete S.pendientes[viejo];
            s.paginas[reemplazarIndice].imagen = ruta;
          } else {
            s.paginas.push({ imagen: ruta, descripcion: archivo.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '), reservar: true, vinculo: '' });
          }
        }).catch(function (e) { errores.push(e.message); });
      });
    }, Promise.resolve()).then(function () {
      cambio(true);
      if (errores.length) aviso(errores.join(' · '), 'error');
      else aviso(notas.length ? notas.join(' · ') : 'Imágenes listas. Recuerde publicar.', notas.length ? '' : 'ok');
    });
  }
  function subirFavicon(archivo, ambito) {
    if (!archivo) return;
    prepararFavicon(archivo).then(function (prep) {
      var c = Cat(), ruta = registrarImagen(prep, 'logos/favicon');
      if (ambito === 'general') { if (S.pendientes[S.datos.favicon]) delete S.pendientes[S.datos.favicon]; S.datos.favicon = ruta; }
      else { if (S.pendientes[c.favicon]) delete S.pendientes[c.favicon]; c.favicon = ruta; }
      cambio(true); aviso(prep.aviso || 'Favicon listo. Recuerde publicar.', prep.aviso ? '' : 'ok');
    }).catch(function (e) { aviso(e.message, 'error'); });
  }
  function subirLogo(archivo, clave) {
    if (!archivo) return;
    prepararLogo(archivo).then(function (prep) {
      var c = Cat(); c.logos = c.logos || {};
      if (S.pendientes[c.logos[clave]]) delete S.pendientes[c.logos[clave]];
      c.logos[clave] = registrarImagen(prep, 'logos/' + c.id);
      cambio(true); aviso('Logo listo. Recuerde publicar.', 'ok');
    }).catch(function (e) { aviso(e.message, 'error'); });
  }

  function alAccion(e) {
    var el = e.target.closest('[data-accion]');
    if (!el || el.tagName === 'INPUT') return;
    var acc = el.getAttribute('data-accion'), c = S.datos && Cat(), t = S.datos && T();
    var secEl = el.closest('[data-sec]'), si = secEl ? +secEl.getAttribute('data-sec') : -1;
    var pagEl = el.closest('[data-pag]'), pi = pagEl ? +pagEl.getAttribute('data-pag') : -1;
    switch (acc) {
      case 'vista-previa': return vistaPrevia();
      case 'publicar': return publicar();
      case 'guardar': return guardarBorrador();
      case 'salir': return salir();
      case 'editar-catalogo': S.catalogo = el.getAttribute('data-id'); S.temporada = Cat().activa; S.pestana = 'paginas'; return pintarTodo();
      case 'nuevo-catalogo': return nuevoCatalogo();
      case 'duplicar-catalogo': return duplicarCatalogo(el.getAttribute('data-id'));
      case 'icono-elegir': return elegirIcono().then(function (ic) { if (ic) { t.secciones[si].icono = ic; cambio(true); } });
      case 'descargar-qr': return opcionesQR(el.getAttribute('data-id'));
      case 'enlace-corto': return crearEnlaceCorto(el.getAttribute('data-id'));
      case 'copiar': return copiarTexto(el.getAttribute('data-texto'));
      case 'principal-catalogo': S.datos.principal = el.getAttribute('data-id'); cambio(true); return aviso('Será el catálogo de la dirección principal al publicar.', 'ok');
      case 'eliminar-catalogo': return eliminarCatalogo(el.getAttribute('data-id'));
      case 'elegir-tema': c.tema = el.getAttribute('data-tema'); return cambio(true);
      case 'favicon-quitar':
        if (el.getAttribute('data-ambito') === 'general') { delete S.pendientes[S.datos.favicon]; S.datos.favicon = ''; }
        else { delete S.pendientes[c.favicon]; c.favicon = ''; }
        return cambio(true);
      case 'logo-quitar-par':
        [el.getAttribute('data-claro'), el.getAttribute('data-oscuro')].forEach(function (k) { delete S.pendientes[c.logos[k]]; c.logos[k] = ''; });
        return cambio(true);
      case 'logo-biblioteca': return elegirLogo(el.getAttribute('data-logo'));
      case 'logo-quitar': delete S.pendientes[c.logos[el.getAttribute('data-logo')]]; c.logos[el.getAttribute('data-logo')] = ''; return cambio(true);
      case 'form-agregar': c.formularios = c.formularios || []; c.formularios.push({ id: 'f' + Date.now().toString(36), nombre: '', url: '' }); if (!c.formulario) c.formulario = c.formularios[0].id; return cambio(true);
      case 'form-eliminar':
        var fi = +el.closest('[data-form]').getAttribute('data-form'), quitado = c.formularios.splice(fi, 1)[0];
        if (c.formulario === quitado.id) c.formulario = (c.formularios[0] || {}).id || '';
        return cambio(true);
      case 'editar-temporada': S.temporada = el.getAttribute('data-id'); S.pestana = 'paginas'; return pintarTodo();
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
          t.secciones.push({ id: id, nombre: v.nombre, icono: v.icono || '⭐', descripcion: '', efecto: v.efecto, formulario: '', paginas: [] }); cambio(true);
        });
      case 'pag-izq': if (mover(t.secciones[si].paginas, pi, -1)) cambio(true); return;
      case 'pag-der': if (mover(t.secciones[si].paginas, pi, 1)) cambio(true); return;
      case 'pag-eliminar': var quitada = t.secciones[si].paginas.splice(pi, 1)[0]; delete S.pendientes[quitada.imagen]; cambio(true); aviso('Página quitada.'); return;
      case 'menu-agregar': c.menus.items = c.menus.items || []; c.menus.items.push({ nombre: '', detalle: '', precio: '', formulario: '' }); return cambio(true);
      case 'menu-eliminar': c.menus.items.splice(+el.closest('[data-menu]').getAttribute('data-menu'), 1); return cambio(true);
      case 'tel-agregar': c.telefonos = c.telefonos || []; c.telefonos.push({ lugar: '', numero: '' }); return cambio(true);
      case 'tel-eliminar': c.telefonos.splice(+el.closest('[data-tel]').getAttribute('data-tel'), 1); return cambio(true);
      case 'usuario-agregar': return agregarUsuario();
      case 'usuario-eliminar': return eliminarUsuario(el.getAttribute('data-usuario'));
      case 'usuario-contrasena': return cambiarContrasena();
      case 'token-reemplazar': return reemplazarToken();
    }
  }

  /* ═══════════════ Biblioteca de logos ═══════════════ */
  function bibliotecaLogos() {
    var lista = (window.LOGOS || []).slice(), conocidos = {};
    lista.forEach(function (l) { conocidos[l.claro] = conocidos[l.oscuro] = 1; });
    // Logos subidos en cualquier catálogo también quedan disponibles para los demás.
    S.datos.catalogos.forEach(function (c) {
      var L = c.logos || {};
      [['claro', 'oscuro'], ['secundario', 'secundarioOscuro']].forEach(function (par) {
        var a = L[par[0]], b = L[par[1]];
        if ((a && !conocidos[a]) || (b && !conocidos[b])) {
          lista.push({ nombre: 'Subido en «' + c.nombre + '»', claro: a || b, oscuro: b || a });
          if (a) conocidos[a] = 1; if (b) conocidos[b] = 1;
        }
      });
    });
    return lista;
  }
  function elegirLogo(clave) {
    var lista = bibliotecaLogos(), secundario = clave.indexOf('secundario') === 0;
    return new Promise(function (resolver) {
      var f = $('#dialogo-form'), d = $('#dialogo');
      f.innerHTML = '<h3>Biblioteca de logos</h3><p class="ayuda" style="margin:0">Toque un logo. Se guardan <b>sus dos versiones</b> y el catálogo usa cada una donde corresponde: la de arriba sobre fondos oscuros y la de abajo sobre fondos claros.</p>' +
        '<div class="biblioteca">' + lista.map(function (l, i) {
          return '<button type="submit" value="' + i + '" class="logo-opcion"><span style="background:#1b1916"><img src="' + esc(rutaImagen(l.claro)) + '" alt=""><i>fondos oscuros</i></span>' +
            '<span style="background:#f4efe8"><img src="' + esc(rutaImagen(l.oscuro)) + '" alt=""><i class="oscuro">fondos claros</i></span><b>' + esc(l.nombre) + '</b></button>';
        }).join('') + '</div><div class="fila fila-fin"><button value="no" class="btn btn-borde">Cancelar</button></div>';
      d.onclose = function () { resolver(d.returnValue && d.returnValue !== 'no' ? lista[+d.returnValue] : null); };
      d.returnValue = ''; d.showModal();
    }).then(function (l) {
      if (!l) return;
      var c = Cat(); c.logos = c.logos || {};
      if (secundario) { c.logos.secundario = l.claro; c.logos.secundarioOscuro = l.oscuro; }
      else { c.logos.claro = l.claro; c.logos.oscuro = l.oscuro; }
      cambio(true); aviso('Logo «' + l.nombre + '» colocado con sus dos versiones (clara y oscura).', 'ok');
    });
  }

  /* ═══════════════ Íconos ═══════════════ */
  var ICONOS = [
    ['Fiestas y temporadas', '🎄 🎅 🤶 ⛄ ❄️ 🎁 🔔 🕯️ ⭐ 🌟 ✨ 🎆 🎇 🥂 🍾 🎉 🎊 🎈 🎭 🪅 🎃 👻 🐣 🐰 💝 💐 💕 ❤️ 👩‍👧'],
    ['Comida', '🍽️ 🥘 🍲 🍝 🥩 🍗 🦃 🍖 🐟 🦐 🦞 🍣 🥗 🥪 🌮 🍕 🍔 🍟 🥐 🥖 🍞 🥯 🧀 🥚 🍳 🥞 🧇 🥓'],
    ['Postres y panadería', '🍰 🎂 🧁 🥧 🍮 🍩 🍪 🍫 🍬 🍭 🍦 🍨 🥮 🍯 🍓 🍒 🍎 🍊 🍇'],
    ['Bebidas', '☕ 🍵 🧋 🥤 🧃 🥛 🍷 🍸 🍹 🍺 🍻 🥃 🧉 🍶'],
    ['Eventos y grupos', '💍 💒 🎓 🏆 🎤 🎵 🎶 🎻 🎷 🎹 💃 🕺 📸 🎬 🎟️ 🎫 🗓️ 📅 👥 🤝 💼 🏢 📊 🖥️ 🎯'],
    ['Hotel y recepción', '🏨 🛎️ 🛏️ 🔑 🧳 🛁 🧖 💆 🏊 🏋️ 🚗 🚕 ✈️ 🗺️ 📍 🌎 ℹ️ 📞 💬 📧 🅿️ 🛍️ 🎀'],
    ['Naturaleza', '🌸 🌺 🌻 🌹 🌷 🌿 🍀 🍁 🍂 🌳 🌴 🌵 ☀️ 🌙 🌈 ⛰️ 🌋 🌊 🦋 🐦'],
    ['Otros', '💎 👑 🏷️ 💲 💳 🎖️ ✅ 🔥 💡 📌 📣 🆕 🔝 ♥️ 🌐'],
  ];
  function elegirIcono() {
    return new Promise(function (resolver) {
      var f = $('#dialogo-form'), d = $('#dialogo');
      f.innerHTML = '<h3>Elija un ícono</h3><p class="ayuda" style="margin:0">Toque un ícono. También puede escribir o pegar cualquier emoji directamente en la casilla «Ícono».</p>' +
        '<div class="iconos">' + ICONOS.map(function (g) {
          return '<p class="iconos-grupo">' + esc(g[0]) + '</p><div class="iconos-rejilla">' +
            g[1].split(' ').map(function (ic) { return '<button type="submit" value="' + esc(ic) + '" class="icono-opcion">' + esc(ic) + '</button>'; }).join('') + '</div>';
        }).join('') + '</div><div class="fila fila-fin"><button value="no" class="btn btn-borde">Cancelar</button></div>';
      d.onclose = function () { resolver(d.returnValue && d.returnValue !== 'no' ? d.returnValue : null); };
      d.returnValue = ''; d.showModal();
    });
  }

  /* ═══════════════ Código QR por catálogo ═══════════════ */
  // Antes de descargar: elegir textos y el logo que va debajo del título (se recuerda por catálogo).
  function opcionesQR(id) {
    var c = S.datos.catalogos.filter(function (x) { return x.id === id; })[0];
    var t = c.temporadas.filter(function (x) { return x.id === c.activa; })[0] || c.temporadas[0] || {};
    var bv = t.bienvenida || {}, Lc = c.logos || {};
    var defecto = c.qrLogo != null ? c.qrLogo : (Lc.oscuro && Lc.oscuro !== LOGO_OSCURO ? Lc.oscuro : '');
    var lista = [['', 'Ninguno (solo el logo del hotel arriba)']];
    bibliotecaLogos().forEach(function (l) { if (l.oscuro !== LOGO_OSCURO) lista.push([l.oscuro, l.nombre]); });
    if (defecto && !lista.some(function (o) { return o[0] === defecto; })) lista.push([defecto, 'Logo actual del catálogo']);
    return dialogo('Descargar tarjeta con QR', 'El logo del hotel va siempre arriba. Elija qué más mostrar en la tarjeta de «' + esc(c.nombre) + '».', [
      { id: 'sobretitulo', etiqueta: 'Sobretítulo', valor: bv.sobretitulo || c.nombre || '' },
      { id: 'titulo', etiqueta: 'Título', valor: bv.titulo || t.nombre || c.nombre || '' },
      { id: 'logo', etiqueta: 'Logo debajo del título', tipo: 'select', opciones: lista, valor: defecto },
    ], 'Descargar').then(function (v) {
      if (!v) return;
      if ((c.qrLogo || '') !== v.logo) { c.qrLogo = v.logo; cambio(false); }
      return descargarQR(id, v);
    });
  }

  // Tarjeta imprimible con el QR: logo del hotel, sobretítulo y título de la temporada visible, marco y QR.
  function descargarQR(id, op) {
    op = op || {};
    var c = S.datos.catalogos.filter(function (x) { return x.id === id; })[0];
    var t = c.temporadas.filter(function (x) { return x.id === c.activa; })[0] || c.temporadas[0] || {};
    var bv = t.bienvenida || {};
    var url = c.enlaceCorto || 'https://' + REPO.nombre + '/' + (c.id === S.datos.principal ? '' : c.id + '/');
    if (typeof qrcode !== 'function') return aviso('No se pudo cargar el generador de QR.', 'error');
    var tema = TEMAS[c.tema] || TEMAS['noche-dorada'] || { v: {} };
    var tinta = tema.v.tinta || '#9a7b45';
    var fondo = c.tema === 'noche-dorada' || !tema.v.papel ? '#efe9e1' : tema.v.papel;
    var extra = op.logo || '';
    aviso('Preparando el QR…');
    var fuentes = document.fonts ? Promise.all([
      document.fonts.load('400 64px "Cormorant Garamond"'), document.fonts.load('600 28px Montserrat'), document.fonts.load('400 30px Montserrat'),
    ]).catch(function () {}) : Promise.resolve();
    return Promise.all([fuentes, cargarImg(rutaImagen(LOGO_OSCURO)), extra ? cargarImg(rutaImagen(extra)).catch(function () { return null; }) : null]).then(function (r) {
      var logo = r[1], logoExtra = r[2];
      var W = 1200, H = logoExtra ? 1750 : 1590;
      var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      var g = cv.getContext('2d');
      g.fillStyle = fondo; g.fillRect(0, 0, W, H);
      // Marco doble fino
      g.strokeStyle = tinta; g.globalAlpha = .75; g.lineWidth = 2.5; g.strokeRect(30, 30, W - 60, H - 60);
      g.lineWidth = 1.2; g.strokeRect(44, 44, W - 88, H - 88); g.globalAlpha = 1;
      // Logo del hotel
      var lw = 300, lh = lw * logo.height / logo.width; g.drawImage(logo, (W - lw) / 2, 110, lw, lh);
      var y = 110 + lh + 90;
      // Sobretítulo
      g.textAlign = 'center'; g.fillStyle = tinta; g.font = '400 27px Montserrat, Arial, sans-serif';
      if ('letterSpacing' in g) g.letterSpacing = '7px';
      g.fillText(String(op.sobretitulo != null ? op.sobretitulo : (bv.sobretitulo || c.nombre || '')).toUpperCase(), W / 2, y);
      if ('letterSpacing' in g) g.letterSpacing = '0px';
      // Título de la temporada
      var titulo = op.titulo || bv.titulo || t.nombre || c.nombre, tam = 68;
      g.fillStyle = '#1b1916';
      do { g.font = '400 ' + tam + 'px "Cormorant Garamond", Georgia, serif'; tam -= 2; } while (g.measureText(titulo).width > W - 220 && tam > 36);
      y += 92; g.fillText(titulo, W / 2, y);
      // Logo del catálogo (si tiene uno propio)
      if (logoExtra) {
        var eh = 130, ew = eh * logoExtra.width / logoExtra.height; if (ew > 420) { ew = 420; eh = ew * logoExtra.height / logoExtra.width; }
        y += 40; g.drawImage(logoExtra, (W - ew) / 2, y, ew, eh); y += eh;
      }
      // QR sobre recuadro blanco
      var qr = qrcode(0, 'M'); qr.addData(url); qr.make();
      var n = qr.getModuleCount(), caja = 620, celda = Math.floor((caja - 60) / n), lado = celda * n;
      var bx = (W - caja) / 2, by = y + 55;
      g.fillStyle = '#ffffff'; g.fillRect(bx, by, caja, caja);
      g.fillStyle = '#111111';
      var ox = bx + (caja - lado) / 2, oy = by + (caja - lado) / 2;
      for (var fy = 0; fy < n; fy++) for (var fx = 0; fx < n; fx++) if (qr.isDark(fy, fx)) g.fillRect(ox + fx * celda, oy + fy * celda, celda, celda);
      // Indicación
      g.fillStyle = '#3a3631'; g.font = '400 30px Montserrat, Arial, sans-serif';
      g.fillText('Escanee con la cámara de su celular', W / 2, by + caja + 75);
      var a = document.createElement('a'); a.href = cv.toDataURL('image/png'); a.download = 'QR-' + c.id + '-' + (t.id || 'catalogo') + '.png';
      document.body.appendChild(a); a.click(); a.remove();
      aviso('QR descargado (' + (c.enlaceCorto ? 'con el enlace corto' : 'con el enlace del catálogo') + '): ' + url, 'ok');
      if (hayCambios()) setTimeout(function () { aviso('Recuerde: el QR funcionará cuando el catálogo esté publicado.'); }, 3500);
    }).catch(function () { aviso('No se pudo preparar el QR.', 'error'); });
  }

  /* ═══════════════ Enlace corto (is.gd) ═══════════════ */
  function copiarTexto(t) {
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { aviso('Copiado: ' + t, 'ok'); }, function () { aviso('No se pudo copiar; selecciónelo y copie con Ctrl+C.', 'error'); });
  }
  function crearEnlaceCorto(id) {
    var c = S.datos.catalogos.filter(function (x) { return x.id === id; })[0];
    var destino = 'https://' + REPO.nombre + '/' + (c.id === S.datos.principal ? '' : c.id + '/');
    var sugerido = 'SheratonQuito' + c.nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, ' ').trim().split(' ').map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join('');
    return dialogo('Crear enlace corto', (hayCambios() ? '<b>⚠ Primero pulse «Publicar»</b> para que el catálogo exista en internet.<br><br>' : '') +
      'Se abrirá una pestaña de <b>is.gd</b> que crea el enlace corto hacia:<br><b>' + esc(destino) + '</b>', [
      { id: 'nombre', etiqueta: 'Nombre del enlace (sin espacios ni tildes)', valor: (c.enlaceCorto || '').replace('https://is.gd/', '') || sugerido.slice(0, 30), ayuda: 'quedará is.gd/Nombre' },
    ], 'Abrir is.gd').then(function (v) {
      if (!v) return;
      var nombre = v.nombre.replace(/[^A-Za-z0-9_]/g, '');
      if (nombre.length < 5 || nombre.length > 30) return aviso('El nombre debe tener de 5 a 30 letras o números.', 'error');
      window.open('https://is.gd/create.php?format=simple&url=' + encodeURIComponent(destino) + '&shorturl=' + encodeURIComponent(nombre), '_blank', 'noopener');
      return dialogo('Guardar enlace corto', 'En la pestaña de is.gd debe aparecer <b>https://is.gd/' + esc(nombre) + '</b>. Si apareció, pulse «Guardar».<br>Si salió un mensaje de error (nombre ocupado), pulse «Cancelar» y pruebe con otro nombre.', [
        { id: 'enlace', etiqueta: 'Enlace corto', valor: 'https://is.gd/' + nombre },
      ], 'Guardar').then(function (r) {
        if (!r) return;
        if (!/^https:\/\/is\.gd\/[A-Za-z0-9_]{5,30}$/.test(r.enlace)) return aviso('El enlace debe ser https://is.gd/Nombre', 'error');
        c.enlaceCorto = r.enlace; cambio(true);
        aviso('Enlace corto guardado. Pulse «Publicar» para conservarlo.', 'ok');
      });
    });
  }

  /* ═══════════════ Catálogos ═══════════════ */
  function idCatalogoValido(id) {
    if (!/^[a-z0-9][a-z0-9-]{1,30}$/.test(id)) return 'El enlace debe tener 2 a 31 letras minúsculas, números o guiones.';
    if (RESERVADOS.indexOf(id) >= 0) return 'Ese enlace está reservado; elija otro.';
    if (S.datos.catalogos.some(function (c) { return c.id === id; })) return 'Ya existe un catálogo con ese enlace.';
    return '';
  }
  function temporadaVacia(nombre, efecto) {
    return {
      id: slug(nombre), nombre: nombre, efectoPortada: efecto,
      bienvenida: { sobretitulo: 'Sheraton Quito', titulo: nombre, fecha: '' },
      portada: { sobretitulo: 'Sheraton Quito', titulo: nombre, subtitulo: '', fecha: '' },
      carta: { sobretitulo: 'Bienvenidos', titulo: 'Bienvenidos', subtitulo: '', parrafos: ['Pase las páginas, elija lo que más le guste y envíenos su solicitud desde el mismo catálogo.'] },
      contraportada: { sobretitulo: 'Gracias por preferirnos', titulo: 'Sheraton', subtitulo: 'Quito' },
      secciones: [{ id: 'principal', nombre: nombre, icono: '⭐', descripcion: '', efecto: efecto, formulario: '', paginas: [] }],
    };
  }
  function nuevoCatalogo() {
    return dialogo('Nuevo catálogo', 'Por ejemplo «Recepción», «Eventos» o «Grupos». Cada catálogo tiene su enlace propio.', [
      { id: 'nombre', etiqueta: 'Nombre', valor: '' },
      { id: 'enlace', etiqueta: 'Enlace (se agrega a la dirección)', valor: '', ayuda: 'ej. eventos → …github.io/eventos/' },
      { id: 'tema', etiqueta: 'Tema de color', tipo: 'select', opciones: Object.keys(TEMAS).map(function (k) { return [k, TEMAS[k].nombre]; }), valor: 'oceano' },
      { id: 'formNombre', etiqueta: 'Nombre del formulario', valor: 'Solicitudes' },
      { id: 'formUrl', etiqueta: 'Enlace del Microsoft Forms', valor: '', tipo: 'url' },
    ], 'Crear').then(function (v) {
      if (!v || !v.nombre) return;
      var id = slug(v.enlace || v.nombre), err = idCatalogoValido(id);
      if (err) return aviso(err, 'error');
      if (v.formUrl && !FORMS_OK.test(v.formUrl)) return aviso('El enlace del formulario debe ser de Microsoft Forms.', 'error');
      var temp = temporadaVacia(v.nombre, 'ninguno');
      S.datos.catalogos.push({
        id: id, nombre: v.nombre, activa: temp.id, tema: v.tema, logos: { claro: '', oscuro: '', secundario: '', secundarioOscuro: '' },
        formularios: [{ id: 'f1', nombre: v.formNombre || 'Solicitudes', url: v.formUrl || '' }], formulario: 'f1',
        telefonos: [], menus: { mostrar: false, sobretitulo: '', titulo: 'Nuestros servicios', items: [], nota: '' }, temporadas: [temp],
      });
      S.catalogo = id; S.temporada = temp.id; S.pestana = 'paginas'; cambio(true); pintarTodo();
      aviso('Catálogo creado. Agregue sus páginas y publíquelo.', 'ok');
    });
  }
  function duplicarCatalogo(id) {
    var orig = S.datos.catalogos.filter(function (c) { return c.id === id; })[0];
    return dialogo('Duplicar catálogo', 'Se copia todo: tema, logos, formularios, temporadas y páginas.', [
      { id: 'nombre', etiqueta: 'Nombre del nuevo catálogo', valor: 'Copia de ' + orig.nombre },
      { id: 'enlace', etiqueta: 'Enlace', valor: '' },
    ], 'Duplicar').then(function (v) {
      if (!v || !v.nombre) return;
      var nid = slug(v.enlace || v.nombre), err = idCatalogoValido(nid);
      if (err) return aviso(err, 'error');
      var copia = clonar(orig); copia.id = nid; copia.nombre = v.nombre;
      S.datos.catalogos.push(copia); S.catalogo = nid; S.temporada = copia.activa; cambio(true); pintarTodo();
      aviso('Catálogo duplicado.', 'ok');
    });
  }
  function eliminarCatalogo(id) {
    var c = S.datos.catalogos.filter(function (x) { return x.id === id; })[0];
    return dialogo('Eliminar catálogo', '¿Eliminar «' + esc(c.nombre) + '» con todas sus temporadas? Su enlace dejará de funcionar al publicar.', [], 'Eliminar', true).then(function (v) {
      if (!v) return;
      S.datos.catalogos = S.datos.catalogos.filter(function (x) { return x.id !== id; });
      S.eliminados = (S.eliminados || []).concat([id]);
      if (S.catalogo === id) { S.catalogo = S.datos.principal; S.temporada = Cat().activa; }
      cambio(true); pintarTodo();
    });
  }

  /* ═══════════════ Temporadas ═══════════════ */
  function idUnico(nombre) { var c = Cat(), id = slug(nombre), n = 2; while (c.temporadas.some(function (t) { return t.id === id; })) id = slug(nombre) + '-' + n++; return id; }
  function duplicarTemporada(id) {
    var orig = Cat().temporadas.filter(function (t) { return t.id === id; })[0];
    return dialogo('Duplicar temporada', 'Se copia todo (textos, secciones y páginas). Después cambie lo que necesite.', [{ id: 'nombre', etiqueta: 'Nombre de la nueva temporada', valor: 'Copia de ' + orig.nombre }], 'Duplicar').then(function (v) {
      if (!v || !v.nombre) return;
      var copia = clonar(orig); copia.id = idUnico(v.nombre); copia.nombre = v.nombre;
      Cat().temporadas.push(copia); S.temporada = copia.id; S.pestana = 'paginas'; cambio(true); pintarTodo();
      aviso('Temporada creada. Todavía no es visible al público.', 'ok');
    });
  }
  function nuevaTemporada() {
    return dialogo('Nueva temporada', 'Empieza vacía, con una sección. Si prefiere partir de la actual, use «Duplicar».', [
      { id: 'nombre', etiqueta: 'Nombre (por ejemplo «Carnaval 2027»)', valor: '' },
      { id: 'efecto', etiqueta: 'Efecto principal', tipo: 'select', opciones: EFECTOS, valor: 'confeti' },
    ], 'Crear').then(function (v) {
      if (!v || !v.nombre) return;
      var nueva = temporadaVacia(v.nombre, v.efecto); nueva.id = idUnico(v.nombre);
      var actual = T(); if (actual && actual.carta) nueva.carta = clonar(actual.carta);
      Cat().temporadas.push(nueva); S.temporada = nueva.id; S.pestana = 'paginas'; cambio(true); pintarTodo();
      aviso('Temporada creada. Agregue sus páginas y textos.', 'ok');
    });
  }
  function activarTemporada(id) {
    var t = Cat().temporadas.filter(function (x) { return x.id === id; })[0];
    var paginas = (t.secciones || []).reduce(function (s, x) { return s + (x.paginas || []).length; }, 0);
    if (!paginas) return aviso('Esa temporada no tiene páginas todavía.', 'error');
    return dialogo('Hacer visible', 'Al <b>publicar</b>, el catálogo mostrará «' + esc(t.nombre) + '» en lugar de la temporada actual. La anterior queda guardada.', [], 'Hacer visible').then(function (v) {
      if (!v) return; Cat().activa = id; cambio(true); pintarTodo(); aviso('Listo. Pulse «Publicar» para aplicarlo.', 'ok');
    });
  }
  function eliminarTemporada(id) {
    var c = Cat(), t = c.temporadas.filter(function (x) { return x.id === id; })[0];
    return dialogo('Eliminar temporada', '¿Eliminar «' + esc(t.nombre) + '»? Las imágenes ya publicadas se conservan en el repositorio.', [], 'Eliminar', true).then(function (v) {
      if (!v) return;
      c.temporadas = c.temporadas.filter(function (x) { return x.id !== id; });
      if (S.temporada === id) S.temporada = c.activa;
      cambio(true); pintarTodo();
    });
  }

  /* ═══════════════ Vista previa y publicación ═══════════════ */
  function validar() {
    var errores = [];
    S.datos.catalogos.forEach(function (c) {
      if (!c.temporadas.some(function (t) { return t.id === c.activa; })) errores.push('«' + c.nombre + '» no tiene temporada visible.');
      if (!(c.formularios || []).some(function (f) { return FORMS_OK.test(f.url); })) errores.push('«' + c.nombre + '» necesita al menos un formulario de Microsoft Forms.');
      (c.formularios || []).forEach(function (f) { if (f.url && !FORMS_OK.test(f.url)) errores.push('«' + c.nombre + '»: el formulario «' + (f.nombre || f.url) + '» no es un enlace de Microsoft Forms.'); });
      c.temporadas.forEach(function (t) {
        (t.secciones || []).forEach(function (s) {
          if (!s.nombre) errores.push('Hay una sección sin nombre en «' + c.nombre + ' · ' + t.nombre + '».');
          (s.paginas || []).forEach(function (p, i) {
            if (p.vinculo && !FORMS_OK.test(p.vinculo)) errores.push('«' + s.nombre + '», página ' + (i + 1) + ': el vínculo debe ser de Microsoft Forms.');
          });
        });
      });
    });
    return errores;
  }
  function vistaPrevia() {
    var imagenes = {}; Object.keys(S.pendientes).forEach(function (r) { imagenes[r] = S.pendientes[r].dataUrl; });
    try { localStorage.setItem('catalogo-borrador', JSON.stringify({ datos: S.datos, catalogo: S.catalogo, temporada: S.temporada, imagenes: imagenes })); }
    catch (e) { return aviso('Hay demasiadas imágenes nuevas para la vista previa. Publique primero o quite algunas.', 'error'); }
    window.open('../?borrador=1', '_blank', 'noopener');
  }
  // Página corta /<catálogo>/ que redirige al catálogo (también sirve para la vista previa en WhatsApp).
  function paginaRedireccion(c) {
    var titulo = esc(c.nombre + ' · Sheraton Quito');
    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>' + titulo + '</title>' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<meta property="og:title" content="' + titulo + '"><meta property="og:description" content="Catálogo de ' + esc(c.nombre) + '. Solicite en línea.">' +
      '<meta property="og:url" content="https://' + REPO.nombre + '/' + c.id + '/">' +
      '<link rel="icon" type="image/png" href="../' + esc(c.favicon || S.datos.favicon || FAVICON) + '">' +
      '<meta http-equiv="refresh" content="0; url=../?c=' + c.id + '"><link rel="canonical" href="../?c=' + c.id + '"></head>' +
      '<body style="font-family:sans-serif;background:#111;color:#eee;text-align:center;padding:40px">' +
      '<p>Abriendo el catálogo… <a style="color:#e3cc9c" href="../?c=' + c.id + '">continuar</a></p></body></html>';
  }
  function imagenesUsadas() {
    var usadas = {};
    if (S.datos.favicon) usadas[S.datos.favicon] = 1;
    S.datos.catalogos.forEach(function (c) {
      if (c.favicon) usadas[c.favicon] = 1;
      Object.keys(c.logos || {}).forEach(function (k) { if (c.logos[k]) usadas[c.logos[k]] = 1; });
      c.temporadas.forEach(function (t) { (t.secciones || []).forEach(function (s) { (s.paginas || []).forEach(function (p) { usadas[p.imagen] = 1; }); }); });
    });
    return Object.keys(S.pendientes).filter(function (r) { return usadas[r]; });
  }
  // Guarda todo en GitHub sin cambiar lo que ve el público, para seguir editando después (en este u otro equipo).
  function guardarBorrador() {
    if (!sinGuardar()) { aviso('No hay cambios nuevos por guardar.'); return Promise.resolve(true); }
    var b = $('#boton-guardar'); b.disabled = true; b.textContent = 'Guardando…';
    var imagenes = imagenesUsadas();
    var archivos = imagenes.map(function (r) { return { ruta: r, base64: S.pendientes[r].base64 }; });
    var cuerpo = { usuario: S.usuario, fecha: Date.now(), catalogo: S.catalogo, temporada: S.temporada, datos: S.datos };
    archivos.push({ ruta: RUTA_BORRADOR, base64: textoAB64(JSON.stringify(cuerpo, null, 2)) });
    return publicarArchivos(archivos, [], 'Panel: borrador guardado por ' + S.usuario).then(function () {
      imagenes.forEach(function (r) { S.cache[r] = S.pendientes[r].dataUrl; });
      S.pendientes = {}; S.guardado = JSON.stringify(S.datos); borrarBorradorLocal();
      S.horaGuardado = new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
      aviso('Guardado. El público no ve estos cambios hasta que pulse «Publicar».', 'ok');
      return true;
    }).catch(function (e) {
      aviso('No se pudo guardar: ' + (e.status === 401 ? 'el token venció.' : e.message), 'error');
      return false;
    }).then(function (r) { b.disabled = false; actualizarCabecera(); return r; });
  }

  function publicar() {
    if (!hayCambios()) return aviso('No hay cambios por publicar.');
    if (!S.cache) S.cache = {};
    var errores = validar();
    if (errores.length) return aviso(errores[0], 'error');
    var imagenes = imagenesUsadas();
    return dialogo('Publicar cambios', 'Se publicarán ' + imagenes.length + ' imagen(es) nuevas y todos los textos de ' + S.datos.catalogos.length + ' catálogo(s). Se verá en 1 a 2 minutos.', [], 'Publicar').then(function (v) {
      if (!v) return;
      var b = $('#boton-publicar'); b.disabled = true; b.textContent = 'Publicando…';
      S.datos.actualizado = new Date().toISOString(); S.datos.actualizadoPor = S.usuario;
      var archivos = imagenes.map(function (r) { return { ruta: r, base64: S.pendientes[r].base64 }; });
      S.datos.catalogos.forEach(function (c) { archivos.push({ ruta: c.id + '/index.html', base64: textoAB64(paginaRedireccion(c)) }); });
      archivos.push({ ruta: RUTA_DATOS, base64: textoAB64(JSON.stringify(S.datos, null, 2)) });
      var borrar = (S.eliminados || []).map(function (id) { return id + '/index.html'; }).concat([RUTA_BORRADOR]);
      return publicarArchivos(archivos, borrar, 'Panel: actualización de catálogos por ' + S.usuario).then(function () {
        imagenes.forEach(function (r) { S.cache[r] = S.pendientes[r].dataUrl; });
        S.pendientes = {}; S.eliminados = []; S.original = JSON.stringify(S.datos); S.guardado = S.original; S.horaGuardado = null; borrarBorradorLocal();
        aviso('¡Publicado! Los catálogos se actualizan en 1 a 2 minutos.', 'ok');
      }).catch(function (e) {
        aviso('No se pudo publicar: ' + (e.status === 401 ? 'el token venció.' : e.message), 'error');
      }).then(function () { b.disabled = false; pintarTodo(); });
    });
  }
  function salir() {
    var seguir = !sinGuardar() ? Promise.resolve({}) :
      dialogo('Salir', 'Tiene cambios <b>sin guardar</b>. ¿Desea guardarlos para seguir editando después? (El público no los verá hasta que pulse «Publicar».)', [], 'Guardar y salir', false, 'Salir sin guardar')
        .then(function (v) { if (v && v.__extra) { borrarBorradorLocal(); return {}; } return v ? guardarBorrador().then(function (ok) { return ok ? {} : null; }) : null; });
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
    var el = e.target, acc = el.getAttribute('data-accion');
    if (el.matches('input[type=checkbox], input[type=radio], select') && el.closest('#contenido')) alEditar(e);
    if (acc === 'pag-agregar') { agregarArchivos(el.files, +el.closest('[data-sec]').getAttribute('data-sec')); el.value = ''; }
    if (acc === 'pag-reemplazar') { agregarArchivos(el.files, +el.closest('[data-sec]').getAttribute('data-sec'), +el.closest('[data-pag]').getAttribute('data-pag')); el.value = ''; }
    if (acc === 'favicon-subir') { subirFavicon(el.files[0], el.getAttribute('data-ambito')); el.value = ''; }
    if (acc === 'logo-subir') { subirLogo(el.files[0], el.getAttribute('data-logo')); el.value = ''; }
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
  $('#catalogo-editando').addEventListener('change', function (e) { S.catalogo = e.target.value; S.temporada = Cat().activa; pintarTodo(); });
  $('#temporada-editando').addEventListener('change', function (e) { S.temporada = e.target.value; pintarTodo(); });
  window.addEventListener('beforeunload', function (e) { if (S.datos && sinGuardar()) { guardarBorradorLocal(); e.preventDefault(); e.returnValue = ''; } });

  iniciar();
})();
