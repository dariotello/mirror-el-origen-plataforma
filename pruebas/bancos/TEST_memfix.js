/* TEST_memfix.js — amarra el fix de HONESTIDAD DE MEMORIA (11/09) en las DOS muletas.
   Hallazgo en vivo de Darío: ante "¿me repetís?" la entidad decía "no tengo memoria, empiezo
   de cero" (FALSO). Ahora, si preguntás por su memoria, se inyecta una nota que le prohíbe negarla.
   Buscar el fallo: que dispare en las meta-preguntas de memoria y NO en charla normal. */
const fs=require('fs'), path=require('path');
const BASE=path.join(__dirname,'..');
const FILES={MIRROR:path.join(BASE,'MIRROR','index.html'), PLATAFORMA:path.join(BASE,'PLATAFORMA','index.html')};
// [repo] en el repo de la plataforma no está MIRROR/index.html: se prueba solo lo que existe
for (const _k of Object.keys(FILES)) if (!fs.existsSync(FILES[_k])) delete FILES[_k];
function reMem(H){
  const m=H.match(/const preguntaPorMemoria = \(mode === 'mirror'\) && \/(.*?)\/i\.test\(text\)/);
  if(!m) throw new Error('no encontré preguntaPorMemoria');
  return new RegExp(m[1],'i');
}
const CASOS=[
  ["como, me repetís?", true, "caso EXACTO de Darío"],
  ["tenés memoria de lo que hablamos?", true, "pregunta por memoria"],
  ["empezás de cero cada vez que abro?", true, "empezás de cero"],
  ["te acordás de lo que te conté ayer?", true, "te acordás"],
  ["me acordé de comprar pan", false, "NO over-fire: 1a persona pasado, charla normal"],
  ["che, como andás?", false, "charla normal"],
  ["contame un chiste de villa regina", false, "charla normal"],
];
let ok=0,bad=0;
for(const [nombre,file] of Object.entries(FILES)){
  console.log('\n━━━ '+nombre+' ━━━');
  const H=fs.readFileSync(file,'utf8');
  const re=reMem(H);
  for(const [txt,esp,motivo] of CASOS){
    const got=re.test(txt);
    if(got===esp){ok++; console.log('  ✅ '+(esp?'inyecta nota':'no dispara')+': "'+txt+'"');}
    else{bad++; console.log('  ❌ '+txt+' → esperaba '+esp+' y dio '+got+'  ['+motivo+']');}
  }
  // la nota honesta y el guardrail de texto
  const tieneNota=/SÍ tenés memoria persistente/.test(H) && /NUNCA digas/.test(H) && /cada charla empieza de cero/.test(H);
  if(tieneNota){ok++; console.log('  ✅ la nota honesta está presente (afirma memoria + prohíbe negarla)');}
  else{bad++; console.log('  ❌ falta la nota honesta de memoria');}
}
console.log('\n'+(bad===0?'✅ TODO VERDE — '+ok+' pruebas pasan (las dos muletas)':'❌ '+bad+' fallos de '+(ok+bad)));
process.exit(bad?1:0);
