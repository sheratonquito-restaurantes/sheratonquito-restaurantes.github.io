/* Temas de color y efectos disponibles. Lo usan el catálogo (app.js) y el panel (admin.js).
 * Cada tema define los colores de fondo, barra, acento y portada. "logo" indica qué versión del logo
 * va sobre el fondo: "claro" = logo blanco (fondos oscuros) · "oscuro" = logo negro (fondos claros). */
window.TEMAS = {
  'noche-dorada': {
    nombre: 'Noche dorada', descripcion: 'Elegante, negro y dorado. Ideal para cenas y fin de año.', logo: 'claro',
    v: { fondo: 'radial-gradient(ellipse at 50% 30%, #2a241c 0%, #141210 55%, #0b0a09 100%)', barra: '10, 9, 8', textoBarra: 'rgba(255,255,255,.85)',
      acento: '#c9a96e', acentoClaro: '#e3cc9c', acentoTexto: '#111111', tapa: 'radial-gradient(ellipse at 50% 35%, #3a2f22 0%, #1a1611 60%, #0d0b09 100%)',
      tapaTexto: '#ffffff', oscura: 'radial-gradient(ellipse at 50% 20%, #2d261d, #12100d 70%)', foto: '#0c0b0a', tinta: '#9a7b45', papel: '#f7f3ee' },
  },
  'champan': {
    nombre: 'Champán claro', descripcion: 'Beige luminoso y dorado. Desayunos, brunch, eventos de día.', logo: 'oscuro',
    v: { fondo: 'radial-gradient(ellipse at 50% 30%, #fbf6ee 0%, #efe6d8 60%, #e2d5c1 100%)', barra: '246, 240, 231', textoBarra: 'rgba(40,32,22,.85)',
      acento: '#b8924f', acentoClaro: '#d9bd86', acentoTexto: '#111111', tapa: 'radial-gradient(ellipse at 50% 35%, #fffaf2 0%, #f1e7d6 65%, #e4d4bb 100%)',
      tapaTexto: '#2a2218', oscura: 'radial-gradient(ellipse at 50% 20%, #5b4a33, #2b2219 75%)', foto: '#f1e9dc', tinta: '#9a7b45', papel: '#fffcf7' },
  },
  'navidad': {
    nombre: 'Navidad clásica', descripcion: 'Rojo vino, verde pino y dorado.', logo: 'claro',
    v: { fondo: 'radial-gradient(ellipse at 50% 30%, #4a1418 0%, #24090b 60%, #0f1a12 100%)', barra: '30, 8, 10', textoBarra: 'rgba(255,255,255,.88)',
      acento: '#d4af5f', acentoClaro: '#ecd193', acentoTexto: '#1a0d0d', tapa: 'radial-gradient(ellipse at 50% 35%, #6b1c22 0%, #340d10 60%, #12200f 100%)',
      tapaTexto: '#ffffff', oscura: 'radial-gradient(ellipse at 50% 20%, #1f3b26, #0c1a10 75%)', foto: '#140708', tinta: '#8c2a2f', papel: '#fbf6f0' },
  },
  'carnaval': {
    nombre: 'Carnaval', descripcion: 'Morado intenso con acentos fucsia y amarillo.', logo: 'claro',
    v: { fondo: 'radial-gradient(ellipse at 50% 30%, #4b1f74 0%, #2a0f45 60%, #150624 100%)', barra: '30, 10, 50', textoBarra: 'rgba(255,255,255,.9)',
      acento: '#ff4fa3', acentoClaro: '#ffd166', acentoTexto: '#1a0626', tapa: 'linear-gradient(135deg, #6a2c9e 0%, #c2185b 55%, #ff8f00 100%)',
      tapaTexto: '#ffffff', oscura: 'radial-gradient(ellipse at 50% 20%, #3d1563, #1a0730 75%)', foto: '#1a0a2b', tinta: '#a0247a', papel: '#fff8fc' },
  },
  'primavera': {
    nombre: 'Primavera', descripcion: 'Rosa suave y verde salvia. Día de la Madre, San Valentín.', logo: 'oscuro',
    v: { fondo: 'radial-gradient(ellipse at 50% 30%, #fff4f6 0%, #f7dfe4 60%, #e8c9d1 100%)', barra: '252, 238, 241', textoBarra: 'rgba(70,30,45,.85)',
      acento: '#d16d8a', acentoClaro: '#f0a9bd', acentoTexto: '#ffffff', tapa: 'linear-gradient(160deg, #fdeef2 0%, #f6d3dc 55%, #dfe9dc 100%)',
      tapaTexto: '#4a2433', oscura: 'radial-gradient(ellipse at 50% 20%, #7a3a50, #401c2a 75%)', foto: '#f7e8ec', tinta: '#b3506e', papel: '#fffafb' },
  },
  'oceano': {
    nombre: 'Azul océano', descripcion: 'Azul marino y plata. Corporativo, eventos y grupos.', logo: 'claro',
    v: { fondo: 'radial-gradient(ellipse at 50% 30%, #1d3557 0%, #0f1f36 60%, #07101d 100%)', barra: '8, 18, 32', textoBarra: 'rgba(255,255,255,.88)',
      acento: '#9fc3e7', acentoClaro: '#d6e8f8', acentoTexto: '#0b1a2e', tapa: 'radial-gradient(ellipse at 50% 35%, #2b4c7e 0%, #142a4a 60%, #08142a 100%)',
      tapaTexto: '#ffffff', oscura: 'radial-gradient(ellipse at 50% 20%, #23416b, #0c1b31 75%)', foto: '#0a1628', tinta: '#2b5a8c', papel: '#f6f9fc' },
  },
  'esmeralda': {
    nombre: 'Esmeralda', descripcion: 'Verde profundo y dorado. Naturaleza, gastronomía local.', logo: 'claro',
    v: { fondo: 'radial-gradient(ellipse at 50% 30%, #1f4d3a 0%, #0f2a20 60%, #071510 100%)', barra: '7, 22, 16', textoBarra: 'rgba(255,255,255,.88)',
      acento: '#d4b26a', acentoClaro: '#ead39d', acentoTexto: '#0c1d15', tapa: 'radial-gradient(ellipse at 50% 35%, #2e6b51 0%, #143528 60%, #08180f 100%)',
      tapaTexto: '#ffffff', oscura: 'radial-gradient(ellipse at 50% 20%, #1d4a37, #0b1f16 75%)', foto: '#0a1a12', tinta: '#2f6b4f', papel: '#f7faf6' },
  },
  'vino': {
    nombre: 'Vino tinto', descripcion: 'Borgoña y oro rosado. Maridajes, cenas románticas.', logo: 'claro',
    v: { fondo: 'radial-gradient(ellipse at 50% 30%, #5a1a2c 0%, #2e0b16 60%, #16050a 100%)', barra: '28, 6, 13', textoBarra: 'rgba(255,255,255,.88)',
      acento: '#e0a98a', acentoClaro: '#f3cdb8', acentoTexto: '#2a0a12', tapa: 'radial-gradient(ellipse at 50% 35%, #7a2440 0%, #3a0f1d 60%, #18060c 100%)',
      tapaTexto: '#ffffff', oscura: 'radial-gradient(ellipse at 50% 20%, #4f1527, #220810 75%)', foto: '#1a060c', tinta: '#8a2c47', papel: '#fdf7f6' },
  },
  'blanco': {
    nombre: 'Blanco elegante', descripcion: 'Blanco, gris y negro. Sobrio, recepción y corporativo.', logo: 'oscuro',
    v: { fondo: 'radial-gradient(ellipse at 50% 30%, #ffffff 0%, #f1f1f1 60%, #e1e1e1 100%)', barra: '250, 250, 250', textoBarra: 'rgba(20,20,20,.85)',
      acento: '#1b1b1b', acentoClaro: '#6e6e6e', acentoTexto: '#ffffff', tapa: 'linear-gradient(160deg, #ffffff 0%, #ececec 100%)',
      tapaTexto: '#111111', oscura: 'radial-gradient(ellipse at 50% 20%, #3a3a3a, #141414 75%)', foto: '#f4f4f4', tinta: '#444444', papel: '#ffffff' },
  },
  'atardecer': {
    nombre: 'Atardecer', descripcion: 'Terracota y naranja cálido. Verano, terraza, parrilladas.', logo: 'claro',
    v: { fondo: 'radial-gradient(ellipse at 50% 30%, #8a3b1e 0%, #4a1d0e 60%, #1f0b05 100%)', barra: '36, 14, 6', textoBarra: 'rgba(255,255,255,.88)',
      acento: '#f4a259', acentoClaro: '#fbd38d', acentoTexto: '#2a1206', tapa: 'linear-gradient(160deg, #e76f51 0%, #a1401f 55%, #3d1608 100%)',
      tapaTexto: '#ffffff', oscura: 'radial-gradient(ellipse at 50% 20%, #6b2c14, #2a0f06 75%)', foto: '#1f0b05', tinta: '#b4532a', papel: '#fffaf5' },
  },
};

window.EFECTOS = [
  ['ninguno', 'Sin efecto'],
  ['nieve', '❄️ Nieve · Navidad, invierno'],
  ['brindis', '🥂 Brindis: burbujas y confeti dorado · Año Nuevo'],
  ['fuegos', '🎆 Fuegos artificiales · celebraciones, aniversarios'],
  ['confeti', '🎉 Confeti de colores · Carnaval, fiestas'],
  ['globos', '🎈 Globos · cumpleaños, niños'],
  ['corazones', '💕 Corazones · San Valentín, Día de la Madre'],
  ['petalos', '🌸 Pétalos · primavera, bodas'],
  ['hojas', '🍂 Hojas de otoño · temporada de cosecha'],
  ['destellos', '✨ Destellos dorados · eventos de gala'],
  ['estrellas', '🌠 Estrellas fugaces · noches especiales'],
  ['burbujas', '🫧 Burbujas · spa, piscina, verano'],
];
