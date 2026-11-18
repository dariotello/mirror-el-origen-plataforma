# Red de pruebas de la plataforma

En cada pull request, GitHub Actions corre esto **solo**, gratis. Si algo falla, el PR queda en **rojo** antes del Merge.

0. **Armado (Etapa 1, 29/10):** `node armar.js --verificar`. El `index.html` tiene que ser exactamente el armado de las piezas de `nucleo/`, `organos/` y `adn/`, y cada órgano tiene que tener su ficha completa (ver `ESTRUCTURA.md`).
1. **Sintaxis:** `node --check` de cada `<script>` del `index.html` de la raíz.
2. **Bancos** (`bancos/TEST_*.js`): los mismos de la carpeta de Darío, en Node puro.
   Los que también miran MIRROR saltean esa parte, porque acá no está (`[repo]` en el código).
3. **Navegador real** (`navegador/t_*.js`): Chromium con Playwright, con el proxy, la voz y Firebase simulados, y la config de prueba ATIS.

Cómo correrlo en una compu:

```
cd pruebas
npm install --no-save playwright@1.63.0
npx playwright install chromium
cd ..
node pruebas/correr.js
```

Para probar otro archivo: `node pruebas/correr.js --archivo otro.html`.

Para correr solo la sintaxis y los bancos: `node pruebas/correr.js --sin-navegador`.

**Lo que esto NO prueba:** la voz real, el micrófono, Groq, Tavily y Cloudflare de verdad, ni un celular real. Eso sigue siendo la prueba en vivo.
