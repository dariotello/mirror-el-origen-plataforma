# Estructura del repo (Etapa 1 · Arquitectura de la Entidad Componible)

**El deploy no cambia:** se sigue subiendo `index.html` a la raíz. Lo nuevo es que ese `index.html` ahora **se arma** desde sus partes.

```
index.html          ← lo que se deploya (lo arma armar.js; NO se edita a mano)
armar.js            ← el armado: pega las piezas en orden y valida todo
armar.json          ← la receta: qué piezas, en qué orden, y dónde empieza cada una
adn/
  adn_fabrica.js    ← el ADN de fábrica (CONFIG_DEFAULT): nombre, modos, motor, perfil vacío
  adn.json          ← su SELLO: versión + huella. Si el ADN cambia sin sellarse, el armado da rojo
nucleo/             ← lo que nunca se desarma: página, estilos y el motor (charla, memoria, voz, modos…)
organos/            ← los órganos con su FICHA (contrato) y su código
  investigador/     ← 🔎 investigación a fondo + 📄 documento completo (embrión del Analista, Etapa 2)
  manos/            ← tarjetas de un toque (WhatsApp, mail, calendario, compartir) + tareas
  agente/           ← el agente de varios pasos
  dato_agenda/      ← ÁTOMO (06/11): un mini MIRROR chico que se enchufa solo a las manos y contesta un dato de un contacto desde el código
pruebas/            ← la red de pruebas (corre sola en cada pull request)
```

## Cómo se trabaja

- **Arreglo en un órgano:** se edita `organos/<órgano>/codigo.js` → `node armar.js` → `node pruebas/correr.js`.
- **Arreglo hecho directo en el index** (como hasta ahora): `node armar.js --desarmar` pasa el cambio a las piezas.
- **Cambio de identidad (ADN):** `node armar.js --sellar-adn adn-1.1 "por qué cambió"`. A propósito y anotado.

## Lo que el armado hace cumplir (reglas del documento)

1. **Ningún órgano se ensambla sin ficha completa y con su banco de pruebas existente** (Regla 3). Campos: nombre, versión, propósito, disparadores, entradas, salidas, herramientas, permisos, límites, banco, estado (despierto / dormido / retirado), código.
2. **El ADN no es un campo de ninguna ficha:** lo heredan todos del núcleo, y está sellado.
3. **Cada pieza de JavaScript pasa `node --check` sola:** si algo se rompe, dice qué órgano.
4. **Ningún órgano se cuela:** una carpeta en `organos/` que no está en la receta da rojo.
5. **El index del repo tiene que ser exactamente el que arman las piezas** (`node armar.js --verificar`, que la red de pruebas corre primero).

## Lo que esta etapa NO hace todavía (de frente)

- Los órganos siguen compartiendo el mismo `<script>` y se llaman entre sí como antes: separarlos **de verdad** (que uno pueda dormirse sin romper al resto) es trabajo de la Etapa 2, de a uno, empezando por el Analista con Pyodide.
- El estado «dormido» todavía no apaga nada en la app: hoy los tres órganos están despiertos.
- El deploy sigue siendo a mano (sube Darío). Reconectarlo desde GitHub es un paso aparte.

## Átomos (06/11/2026)

Un **átomo** es un órgano mínimo: una sola habilidad, con su ficha y su banco, que **se ensambla solo** en otro órgano (`"se_ensambla_en"` en la ficha). Combinados, forman herramientas. El primero es `dato_agenda/`: se mete adelante en las reglas de las manos y, si se lo duerme (`"estado": "dormido"` en la ficha y en `DATO_AGENDA_ESTADO`), no matchea nada y la app sigue como antes.
