/* TEST_modelo.js — amarra el fix v39-motor2 (18/09) en la PLATAFORMA (MIRROR queda con qwen3.6
   a propósito hasta la puesta-a-punto de análisis). Verifica: (1) gpt-oss-120b lidera y coincide
   con el default; (2) la visión sigue en qwen3.6; (3) el ACOPLAMIENTO gmail↔constructor (el literal
   del snippet de Gmail == el literal que busca el replace del constructor) — el footgun del v38-motor;
   (4) la curita de razonamiento es POR MODELO (así gpt-oss puede liderar sin devolver vacío). */
const fs=require('fs'), path=require('path');
const H=fs.readFileSync(path.join(__dirname,'..','PLATAFORMA','index.html'),'utf8');
let ok=0,bad=0;
function t(msg,cond,extra){ if(cond){ok++; console.log('  ✅ '+msg);} else {bad++; console.log('  ❌ '+msg+(extra?'  → '+extra:''));} }
console.log('\n━━━ PLATAFORMA · v39-motor2 ━━━');
// (1) cadena y default
const chain=(H.match(/modelos:\s*\[([^\]]+)\]/)||[])[1]||'';
const modeloPrincipal=(H.match(/modeloPrincipal:\s*'([^']+)'/)||[])[1];
t('gpt-oss-120b ENCABEZA la cadena de Groq', /^\s*'openai\/gpt-oss-120b'/.test(chain), chain.slice(0,60));
t('default modeloPrincipal = openai/gpt-oss-120b', modeloPrincipal==='openai/gpt-oss-120b', modeloPrincipal);
t('coherencia: chain[0] == modeloPrincipal', chain.trim().startsWith("'"+modeloPrincipal+"'"));
// v39-qwen38 (24/09): Groq retiró qwen3.6 el 14/09 → el respaldo de la cadena es su sucesor qwen3.8.
t('qwen3.8 (sucesor de qwen3.6) está EN la cadena (respaldo)', /qwen\/qwen3\.8-27b/.test(chain));
t('qwen3.6 (retirado 14/09) YA NO está en la cadena', !/qwen\/qwen3\.6-27b/.test(chain));
// (2) visión intacta
t('modeloVision = qwen/qwen3.8-27b (el único vigente que lee imágenes)', /modeloVision:\s*'qwen\/qwen3\.8-27b'/.test(H));
t('la visión tiene lista de a dónde caer (modelosVision)', /modelosVision:\s*\['qwen\/qwen3\.8-27b'\]/.test(H));
// (3) ACOPLAMIENTO gmail snippet ↔ constructor
const gmailModelo=(H.match(/MODELO:\s*&#x27;([^&]+)&#x27;/)||[])[1];
const repSearch=(H.match(/code\.replace\("'([^']+)'",\s*"'"\+CONFIG\.modeloPrincipal/)||[])[1];
t('snippet Gmail MODELO = openai/gpt-oss-120b', gmailModelo==='openai/gpt-oss-120b', gmailModelo);
t('constructor replace busca el MISMO literal (acoplamiento OK)', gmailModelo===repSearch, 'gmail='+gmailModelo+' rep='+repSearch);
// (4) curita por-modelo
t('la curita reasoning_effort es POR MODELO (/gpt-oss/i.test)', /\/gpt-oss\/i\.test\(\s*modelo/.test(H));
console.log('\n'+(bad===0?'✅ TODO VERDE — '+ok+' pruebas pasan (plataforma)':'❌ '+bad+' fallos de '+(ok+bad)));
process.exit(bad?1:0);
