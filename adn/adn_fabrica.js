// ── CONFIG POR DEFECTO (lo que ve un MIRROR recién nacido) ────────────────
const CONFIG_DEFAULT = {
  configurado: false,
  appName: 'MIRROR',
  modos: { mirror: 'MIRROR', tars: 'ANALISTA', jurado: 'EXAMINADOR', conn: 'CONEX' },
  motorPrincipal: 'groq',
  modeloPrincipal: 'openai/gpt-oss-120b',   // v38-motor: Llama 3.3 se apaga el 16/08/2026 (ver MOTORES.groq)
  motorRespaldo: 'cerebras',
  modeloRespaldo: 'gpt-oss-120b',
  proxyUrl: '',
  fbUrl: '',
  paisCod: '',         // v37-tel (A1): código de país para WhatsApp. WHITE-LABEL: no se asume Argentina.
  pinMem: '',          // v37-sec (V36-1c): LEGADO. PIN en claro. Se migra a pinMemH y queda vacío.
  pinMemH: '',         // v37-sec (V36-1c): huella SHA-256 del PIN. Es lo único que se guarda.
  fbExterna: '',
  pinExterna: '',      // v37-sec (V36-1c): LEGADO, ídem.
  pinExternaH: '',     // v37-sec (V36-1c)
  // Capacidades (toggles) — solo cosas que MIRROR REALMENTE tiene hoy.
  cap: { sonido: true, microfono: true, voz: true, fachada: true, web: true, audio: true, devolver: true, actua: true, analista: true, encuesta: true, redactor: true }, // v35-vida (Etapa 5) · v36-actua: 'actua' = manos propias (Etapa 3 C2) · v36-redactor (Etapa 13 C2)
  caracter: { franqueza: 60, humor: 40, desafio: 50 }, // v35-car (Etapa 5B): perillas estilo TARS de Interstellar
  colorTema: 'violeta',  // violeta | cian | ambar | esmeralda | carmin
  cebolla: { on: false, vars: ['energia','sintonia','claridad','carga'] },  // v52-cebolla: apagada por defecto; el dueño la enciende y elige sus dimensiones
  perfil: { nombre: '', ubicacion: '', rol: '', filosofia: '', caracter: '', paz: '', proyectos: '', estilo: '' }
};

