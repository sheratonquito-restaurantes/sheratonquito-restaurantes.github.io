/*
 * CONFIGURACIÓN DEL CATÁLOGO — lo único que normalmente hay que editar.
 *
 * FORMS_URL: enlace normal del formulario (se usa cuando un botón no tiene vínculo propio).
 * RESERVAS:  vínculo "previamente rellenado" de cada botón. Se obtiene en Forms:
 *            ⋯ → Obtener vínculo previamente rellenado → marcar restaurante y menú → Obtener vínculo.
 *            Mientras esté vacío (''), el botón abre el formulario general.
 */
window.CATALOGO = {
  FORMS_URL: 'https://forms.cloud.microsoft/r/SjMkYFTQfn',

  RESERVAS: {
    'fragatas-buffet': '',
    'cooks-navidad': '',
    'cooks-menus': '',
    'bakery-te': '',
    'bakery-takeaway': '',
    'bakery-combos': '',
    'chefs-table': '',
    'chefs-amanecer': '',
    'chefs-alegria': '',
    'chefs-bosque': '',
    'chefs-nochebuena': '',
    'magic-christmas': '',
    'cooks-nochebuena': '',
    'fragatas-christmas-brunch': '',
    'certificados': '',
    'chefs-finano': '',
    'cooks-anonuevo': '',
    'new-year-celebration': '',
    'fragatas-newyear-brunch': '',
    'menu-ejecutivo': '',
    'sugerencia-chef': '',
    'brunch-ecuatoriano': '',
  },

  TELEFONOS: [
    { lugar: "Cook's y Bakery & Deli - Las Fragatas - The Chef's Table", numero: '099 791 8319', whatsapp: '593997918319' },
    { lugar: 'Coordinador de Reservar 1', numero: '099 204 7975', whatsapp: '593992047975' },
    { lugar: "Coordinador de Reservar 2", numero: '099 485 9771', whatsapp: '593994859771' },
  ],
};
