/* ════════════════════════════════════════════════════════════════════════
   CONFIGURACIÓN DE TU MIRROR
   No hace falta editar nada acá: la primera vez que abras tu MIRROR,
   un asistente visual te va a guiar para armarlo (nombres, motor de IA,
   tus direcciones y tu perfil). Esto solo define los valores por defecto.
   ════════════════════════════════════════════════════════════════════════ */

// ── CATÁLOGO DE MOTORES DE IA ─────────────────────────────────────────────
// Todos hablan el formato OpenAI (chat completions), así que el motor interno
// es uno solo. El proxy rutea a cada proveedor con la clave que el usuario guardó.
const PLATFORM_VERSION = 'v40';  // ← ÚNICA fuente de verdad: actualizar SOLO acá en cada deploy (regla de Darío) · salto v38→v40 el 25/09/2026 por orden de Darío, tras auditar en vivo los tres pilares (ACTÚA: agente de varios pasos · COMPRENDE: memoria por significado en el dispositivo · ACOMPAÑA: charla por voz, modo fácil, foto y resuelvo) + la solapa ACTUALIZAR — salto generacional, por eso se saltea v39 · salto v35→v36 el 15/07/2026 (TFI calificado 10) · salto v36→v37 el 30/07/2026 tras auditoría en vivo · salto v37→v38 el 9/08/2026 por orden de Darío tras 2 vueltas de auditoría en vivo (motor qwen, «+» de la barra, organizador del pie, panel de contactos, voz con desbloqueo temprano, cartel de CEREBRAS suavizado)
window.addEventListener('load', function(){ try{ document.querySelectorAll('[data-ver]').forEach(function(e){ e.textContent = PLATFORM_VERSION; }); }catch(_){} });
const MOTORES = {
  groq: {
    nombre: 'Groq', tipo: 'gratuito', ruta: 'groq',
    desc: 'Rápido y gratuito. El motor recomendado para empezar.',
    comoClave: 'Entrá a groq.com → creá cuenta → API Keys → Create API Key (empieza con gsk_...).',
    /* v38-motor (5/08/2026) — POR QUÉ CAMBIÓ ESTA LISTA.
       Hasta hoy decía ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'], y Groq apaga
       LOS DOS el 16/08/2026 (anuncio del 17/06/2026, aplica al tramo gratis y developer).
       O sea: el blindaje «modelos que no caducan» existía pero NO TENÍA A DÓNDE CAER —
       habría bajado del primero al segundo y el segundo también estaba muerto. Un catálogo
       de alternativas que caducan junto con el principal no es un blindaje, es un adorno.
       Verificado en console.groq.com/docs/deprecations el 5/08/2026.
       ORDEN = PRIORIDAD. qwen3.6 va primero porque ya lo usamos para visión (mismo proxy,
       misma clave, probado) y porque NO es de razonamiento: gpt-oss necesita la curita de
       reasoning_effort o devuelve vacío (ver llamarMotor). */
    /* v39-motor2 (18/09/2026): openai/gpt-oss-120b pasa a ENCABEZAR. Hallazgo en vivo de Darío:
       su motor devolvió «qwen/qwen3.6-27b ya no está disponible» y el fallback cayó bien a
       gpt-oss-120b. Groq NO lo deprecó (sigue como reemplazo recomendado y ES el de visión),
       pero para el ARRANQUE conviene liderar con el modelo de PRODUCCIÓN estable (131k ctx,
       ideal análisis/documentos largos). qwen3.6 queda de respaldo y sigue en modeloVision.
       La curita de reasoning_effort es POR MODELO (/gpt-oss/i, ver llamarMotor), así que
       gpt-oss lidera sin devolver vacío. Doc: console.groq.com/docs/models (18/09/2026). */
    /* v39-qwen38 (24/09/2026) — CORRECCIÓN DE LO DE ARRIBA: Groq SÍ dio de baja qwen3.6.
       Lo retiró el 14/09/2026 (tramo gratis y developer) y puso de sucesor directo a
       qwen/qwen3.8-27b: misma ventana de 131k, lee imágenes (hasta 3 por pedido) y acepta
       los mismos reasoning_effort:'none' + reasoning_format:'hidden' que ya mandamos (el
       regex /qwen\/qwen3/ de llamarMotor lo agarra sin tocarlo). El aviso que vio Darío el
       18/09 ERA la baja; el comentario de motor2 la leyó mal. Lo que rompía: la VISIÓN — su
       único modelo era qwen3.6 y no había lista de a dónde caer. Ahora hay (modelosVision).
       OJO: qwen3.8 figura como «preview» en Groq (puede irse con poco aviso) y es el ÚNICO
       con visión. Si cae, el blindaje avisa en criollo en vez de romperse.
       Fuente: console.groq.com/docs/deprecations y /docs/reasoning, leídas el 24/09/2026. */
    modelos: ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b'],
    modeloVision: 'qwen/qwen3.8-27b',
    modelosVision: ['qwen/qwen3.8-27b']
  },
  cerebras: {
    // v41-cerebras: dejó de ser 'gratuito' el 17/08/2026. El sello verde «Gratis» sobre un
    // motor que pide tarjeta es la clase de promesa por cuenta ajena que este proyecto no hace.
    nombre: 'Cerebras', tipo: 'tarjeta', ruta: 'cerebras',
    desc: 'Ideal como respaldo del principal. Gratis hasta el 17/08/2026. Desde esa fecha Cerebras exige agregar una tarjeta para regalarte US$5 de crédito inicial; agotados, es pago por uso.',
    comoClave: 'Entrá a cloud.cerebras.ai → creá cuenta → API Keys.',
    modelos: ['gpt-oss-120b', 'llama-3.3-70b']
  },
  openai: {
    nombre: 'OpenAI (GPT)', tipo: 'premium', ruta: 'openai',
    desc: 'Premium con créditos. Modelos GPT.',
    comoClave: 'Entrá a platform.openai.com → API keys. Requiere saldo/créditos.',
    modelos: ['gpt-4o-mini', 'gpt-4o']
  },
  openrouter: {
    nombre: 'OpenRouter (acceso a cientos de modelos)', tipo: 'premium', ruta: 'openrouter',
    desc: 'Premium con créditos. Con una sola clave accedés a muchos modelos, incluido Claude.',
    comoClave: 'Entrá a openrouter.ai → Keys. Cargás crédito y elegís entre cientos de modelos.',
    modelos: ['anthropic/claude-3.5-sonnet', 'openai/gpt-4o-mini', 'meta-llama/llama-3.3-70b-instruct', 'deepseek/deepseek-chat']
  },
  deepseek: {
    nombre: 'DeepSeek', tipo: 'premium', ruta: 'deepseek',
    desc: 'Premium con créditos, económico.',
    comoClave: 'Entrá a platform.deepseek.com → API keys.',
    modelos: ['deepseek-chat']
  },
  together: {
    nombre: 'Together AI', tipo: 'premium', ruta: 'together',
    desc: 'Premium con créditos. Muchos modelos abiertos.',
    comoClave: 'Entrá a together.ai → API keys.',
    modelos: ['meta-llama/Llama-3.3-70B-Instruct-Turbo']
  },
  mistral: {
    nombre: 'Mistral', tipo: 'premium', ruta: 'mistral',
    desc: 'Premium con créditos. Modelos europeos.',
    comoClave: 'Entrá a console.mistral.ai → API Keys.',
    modelos: ['mistral-large-latest', 'mistral-small-latest']
  }
};

