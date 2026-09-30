// Revisa la sintaxis de cada <script> en línea de los HTML que se le pasen.
// Por qué así: node --check solo lee archivos .js, y el código de la
// plataforma vive adentro del index.html. Sacamos cada bloque a un archivo
// temporal y lo chequeamos por separado, para que el error diga en qué
// bloque y en qué línea del index.html está, no en una línea del temporal.
// Solo mira sintaxis: NO ejecuta nada ni prueba el navegador.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const archivos = process.argv.slice(2);
if (!archivos.length) archivos.push('index.html');

let fallas = 0, total = 0;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'check-scripts-'));

for (const archivo of archivos) {
  const html = fs.readFileSync(archivo, 'utf8');
  // Mismo corte que hace el navegador: el bloque termina en el primer </script>.
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m, n = 0;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    n++;
    // Scripts externos (src=) o que no son JS (JSON, plantillas) no se chequean.
    if (/\bsrc\s*=/i.test(attrs)) continue;
    const tipo = (attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i) || [])[1];
    if (tipo && !/^(text\/javascript|application\/javascript|module)$/i.test(tipo)) continue;

    total++;
    const lineaInicio = html.slice(0, m.index + m[0].indexOf('>') + 1).split('\n').length;
    const ext = tipo === 'module' ? '.mjs' : '.js';
    const f = path.join(tmp, `${path.basename(archivo)}.bloque${n}${ext}`);
    // Relleno con líneas vacías: así la línea del error coincide con la del HTML.
    fs.writeFileSync(f, '\n'.repeat(lineaInicio - 1) + m[2]);
    const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
    if (r.status === 0) {
      console.log(`OK    ${archivo} · bloque ${n} (desde línea ${lineaInicio})`);
    } else {
      fallas++;
      console.log(`FALLA ${archivo} · bloque ${n} (desde línea ${lineaInicio})`);
      console.log((r.stderr || '').replaceAll(f, archivo));
      // Anotación para que GitHub marque la línea en el pull request.
      const lin = ((r.stderr || '').match(/:(\d+)\n/) || [])[1] || lineaInicio;
      console.log(`::error file=${archivo},line=${lin}::Error de sintaxis en el bloque <script> ${n}`);
    }
  }
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${total} bloques revisados · ${fallas} con error`);
if (total === 0) { console.log('::error::No se encontró ningún <script> para revisar'); process.exit(1); }
process.exit(fallas ? 1 : 0);
