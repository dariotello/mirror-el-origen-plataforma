/* TEST_router_docs.js — amarra el fix routerdoc (11/09) en las DOS muletas.
   Extrae las regex REALES del router (preguntaPorDatos / evalInstrumento) del HTML y simula
   la decisión de desvío a CONEX en el caso que reprodujo Darío: base SIN conectar, docs PERM
   (no de sesión). Desvía si: preguntaPorDatos && !evalInstrumento. Filosofía: buscar el fallo —
   que el arreglo NO rompa la protección de la base (pedir registros/encuestas SÍ debe desviar). */
const fs=require('fs'), path=require('path');
const BASE=path.join(__dirname,'..');
const FILES={MIRROR:path.join(BASE,'MIRROR','index.html'), PLATAFORMA:path.join(BASE,'PLATAFORMA','index.html')};
// [repo] en el repo de la plataforma no está MIRROR/index.html: se prueba solo lo que existe
for (const _k of Object.keys(FILES)) if (!fs.existsSync(FILES[_k])) delete FILES[_k];
function extraeRegex(H, nombre){
  const m=H.match(new RegExp('const '+nombre+'\\s*=\\s*/(.*?)/i\\.test\\(text\\)'));
  if(!m) throw new Error('no encontré '+nombre);
  return new RegExp(m[1],'i');
}
// desvía a "conectá CONEX" en el caso base-off + docs-PERM (haySesion=false)
function desvia(text, reDatos, reInstr){ return reDatos.test(text) && !reInstr.test(text); }
const CASOS=[
  // [texto, debeDesviar?, por qué]
  ["me podés hacer un análisis bajo contexto académico de los datos presente en mis documentos", false, "caso EXACTO de Darío: analizar SUS documentos, no la base"],
  ["analizá los datos de mis documentos", false, "plural documentos → análisis de doc propio"],
  ["resumime los archivos que cargué", false, "plural archivos"],
  ["evaluá este documento", false, "singular seguía andando (no-regresión v-ragwin)"],
  ["evaluá las consignas para recolectar datos", false, "consignas/instrumento (no-regresión v-ragwin)"],
  ["mostrame los porcentajes de las encuestas", true, "PROTECCIÓN base: pide registros de la base, sin conectar"],
  ["analizá los registros de la muestra", true, "PROTECCIÓN base: registros/muestra"],
  ["che, ¿cómo andás?", false, "charla normal, no pide datos"],
];
let ok=0, bad=0;
for(const [nombre,file] of Object.entries(FILES)){
  console.log('\n━━━ '+nombre+' ━━━');
  const H=fs.readFileSync(file,'utf8');
  const reDatos=extraeRegex(H,'preguntaPorDatos'), reInstr=extraeRegex(H,'evalInstrumento');
  for(const [txt, esperado, motivo] of CASOS){
    const got=desvia(txt,reDatos,reInstr);
    if(got===esperado){ok++; console.log('  ✅ '+(esperado?'DESVÍA':'analiza')+': "'+txt.slice(0,54)+'"');}
    else{bad++; console.log('  ❌ '+txt+' → esperaba '+(esperado?'DESVÍA':'analiza')+' y dio '+(got?'DESVÍA':'analiza')+'  ['+motivo+']');}
  }
}
console.log('\n'+(bad===0?'✅ TODO VERDE — '+ok+' pruebas pasan (las dos muletas)':'❌ '+bad+' fallos de '+(ok+bad)));
process.exit(bad?1:0);
