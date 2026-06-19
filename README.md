<div align="center">

# MIR[Я]OR — El Origen
### La plataforma

*Armá tu propia entidad digital de IA. Gratis. Tuya. Sobre tu propia infraestructura.*

</div>

---

## Qué es esto

**MIRROR — El Origen** es el molde para que **cualquier persona** cree su propia
entidad digital de IA: un compañero que conversa, recuerda lo que le subís
(documentos, audios) y vive en internet sobre **tu** infraestructura, no la de
nadie más.

No es una app que te presta una empresa. Es un **constructor**: abrís la
plataforma, conectás tu propia clave de IA y tu propia base de datos, y sale
tu MIRROR. Tus datos viven en **tu** Firebase. No hay servidor central que los
junte.

> Cada persona tiene su propio MIRROR, lo entrena, y domina su propia vida
> digital sin depender de nadie.

---

## Principios (no se rompen)

- **GRATUITA.** Lo gratis tiene que servir solo. El plan pago compra *más*
  (más memoria, mejores modelos), nunca "que funcione".
- **SIN MENTIR.** Lo que MIRROR todavía no hace va marcado como *"próximamente"*,
  honesto — nunca un botón que promete algo que no cumple.
- **TUS DATOS, TUYOS.** Usás tu propio proxy y tu propia base. Nadie centraliza
  tu información.

---

## Cómo se usa (resumen)

La plataforma trae una **guía paso a paso embebida** (botón "📖 guía paso a paso"
en el constructor). En corto, son tres piezas, todas con plan gratuito:

1. **Tu clave de IA** — gratis en [Groq](https://console.groq.com). Es secreta:
   **no** se pega en MIRROR, va dentro de tu proxy.
2. **Tu proxy** — un Cloudflare Worker que guarda la clave cifrada y habla con la
   IA por vos. El código está en [`mirror-proxy.js`](./mirror-proxy.js) y también
   embebido en la guía, listo para copiar.
3. **Tu memoria** — una base en Firebase Realtime Database, con las reglas
   permanentes que da la guía.

Después: abrís la plataforma → constructor → pegás tus direcciones → entrás.
Tu MIRROR queda vivo en tu propio Cloudflare Pages.

---

## Qué hace HOY (honesto)

- 💬 **Conversa** con modos personalizables (nombre, personalidad, temática).
- 🧠 **Memoria de documentos**: subís un PDF y queda como recuerdo permanente,
  temporal o de sesión.
- 🎙️ **Memoria de audio**: subís un audio o video y MIRROR **transcribe lo que se
  dice** (Whisper de Groq, gratis) y lo guarda como recuerdo.
- 🎨 **Estética propia**: cinco temas de color, motor de música ambiental, y la
  fachada con el monolito (homenaje a *2001: Una Odisea del Espacio*).
- 🔌 **Siete motores de IA**: Groq y Cerebras (gratis); OpenAI, OpenRouter,
  DeepSeek, Together y Mistral (de pago, vos ponés tu clave).

## Qué viene (*próximamente*, marcado honesto)

- 👁️ **Ver** video e imágenes (entender lo que se *ve*, no solo lo que se *dice*).
- 📬 **Gmail + WhatsApp**: que tu MIRROR lea y borradore respuestas a tus mensajes.
- 💎 **Insumos premium honestos**: más memoria y mejores modelos, diciendo claro
  qué cuesta cada cosa.

---

## Arquitectura

```
  Vos (navegador)
       │
       ▼
  index.html  ──────────►  Tu proxy (Cloudflare Worker)  ──────►  IA (Groq, etc.)
  (la plataforma)          mirror-proxy.js                        Whisper (audio)
       │                   · guarda las claves como secrets
       │                   · rutas: /groq /cerebras /tavily /transcribe
       ▼
  Tu Firebase (Realtime DB)
  · tu memoria, tus datos, tuyos
```

**Seguridad:** las claves de IA **nunca** están en el navegador ni en este repo.
Viven como *secrets* cifrados de tu Worker. El `index.html` solo conoce el
*nombre* de cada secret, jamás su valor.

---

## Estructura del repo

```
├── index.html        La plataforma (constructor + entidad MIRROR)
├── mirror-proxy.js   El proxy universal de Cloudflare (con ruta /transcribe)
├── README.md         Esto
├── LICENSE           Apache 2.0
├── NOTICE            Marca y autoría
├── .gitignore        Para que nunca se cuele una clave
└── docs/
    └── HANDOFF_Plataforma_MIRROR_dia3.md   Bitácora de construcción
```

---

## Licencia y autoría

Código bajo **Apache License 2.0** — podés usarlo, modificarlo y redistribuirlo.

La idea, la marca y el nombre **"MIRROR — El Origen"** son autoría de
**Darío Alejandro Tello** (Villa Regina, Río Negro, Argentina). La licencia no
concede permiso sobre la marca (ver [`NOTICE`](./NOTICE)). El MIRROR que vos
construyas es **tuyo**: ponele el nombre que quieras.

---

<div align="center">
<i>Que sea espléndida. Sobrenatural.</i><br>
2001 · Vangelis · Enya
</div>
