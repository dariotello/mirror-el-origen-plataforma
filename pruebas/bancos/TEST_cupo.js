/* TEST v39-cupo — ajustarAlCupo portado del MIRROR a la plataforma (las DOS muletas).
   POR QUÉ: la plataforma manejaba el cupo solo reactivamente; ahora mide y recorta ANTES de
   mandar, lo que habilita subir los topes de RAG. Amarra: por debajo del cupo no toca nada;
   por encima suelta primero la charla vieja; si sigue pasando, recorta MATERIAL pero NUNCA la
   pregunta (que va al final) y avisa recorteMaterial; los topes de RAG quedaron en 4200/15000. */
const fs=require('fs'), path=require('path'), vm=require('vm');
const BASE=path.join(__dirname,'..');
const FILES={MIRROR:path.join(BASE,'MIRROR','index.html'), PLATAFORMA:path.join(BASE,'PLATAFORMA','index.html')};
// [repo] en el repo de la plataforma no está MIRROR/index.html: se prueba solo lo que existe
for (const _k of Object.keys(FILES)) if (!fs.existsSync(FILES[_k])) delete FILES[_k];
let ok=0,bad=0;
function t(l,c,e){ if(c)ok++; else {bad++; console.log('  ❌ '+l+(e?'  → '+e:''));} }
function grabFunc(H,name){ const i=H.indexOf('function '+name+'('); if(i<0)return''; for(let p=H.indexOf('{',i),d=0;p<H.length;p++){const c=H[p]; if(c==='{')d++; else if(c==='}'){d--; if(d===0)return H.slice(i,p+1);}} return ''; }
function grabConst(H,name){ const m=H.match(new RegExp('const\\s+'+name+'\\s*=\\s*([0-9]+)')); return m?('const '+name+' = '+m[1]+';'):''; }

for(const [nombre,file] of Object.entries(FILES)){
  console.log('\n━━━ '+nombre+' ━━━');
  const H=fs.readFileSync(file,'utf8');

  // presencia del port y topes subidos
  t('CUPO: ajustarAlCupo presente', /function ajustarAlCupo\(/.test(H));
  t('CUPO: estimarTokens presente', /function estimarTokens\(/.test(H));
  t('CUPO: cortarLimpio presente', /function cortarLimpio\(/.test(H));
  t('CUPO: enganchado en el envío (mide antes de mandar)', /ajustarAlCupo\(contextoActual, systemPrompt, previos, (?:_?maxSalida|salidaEfectiva\(MODELO_GROQ, _?maxSalida\))(?:, [^)]*)?\)/.test(H) /* v40-cupo / v40-cupo2: también la forma con la salida real y el «guardar últimos» */);
  t('CUPO: topes RAG a 4200', /RAG_CAP_BIBLIO\s*=\s*4200/.test(H) && /RAG_CAP_SESION\s*=\s*4200/.test(H));
  t('CUPO: tope doc-completo a 15000', /RAG_CAP_DOCCOMPLETO\s*=\s*15000/.test(H));

  // correr el motor real
  const bloque=[grabConst(H,'CUPO_TPM_GRATIS'),grabConst(H,'CUPO_MARGEN'),grabFunc(H,'estimarTokens'),grabFunc(H,'cortarLimpio'),grabFunc(H,'ajustarAlCupo')].join('\n');
  const sb={String,Math,Number,Array,JSON}; vm.createContext(sb);
  vm.runInContext(bloque
    + '\n;globalThis.__tokAprox = estimarTokens("x".repeat(340));'                       // ≈100
    // 1) por debajo del cupo: no toca nada
    + 'globalThis.__chico = ajustarAlCupo("PREGUNTA: hola", "sys corto", [{role:"user",content:"hola"},{role:"assistant",content:"buenas"}], 700);'
    // 2) charla vieja gigante → se suelta el historial (recortado true, sin recorte de material)
    + 'var _prev=[]; for(var i=0;i<12;i++) _prev.push({role:"user",content:"y".repeat(6000)});'
    + 'globalThis.__hist = ajustarAlCupo("PREGUNTA: cuanto es dos mas dos", "sys", _prev, 700);'
    // 3) material enorme con marcador PREGUNTA → recorta material pero deja la pregunta al final
    + 'var _mat = "MATERIAL: "+"m".repeat(60000)+"\\n---\\nPREGUNTA: LACLAVE_DEL_FINAL";'
    + 'globalThis.__mat = ajustarAlCupo(_mat, "sys", [], 700);'
    , sb);

  const chico=sb.__chico, hist=sb.__hist, mat=sb.__mat;
  t('CUPO·estimarTokens: ~100 para 340 chars', sb.__tokAprox===100, sb.__tokAprox);
  t('CUPO·chico: no recorta nada', chico.recortado===false && chico.recorteMaterial===false, JSON.stringify({r:chico.recortado,m:chico.recorteMaterial}));
  t('CUPO·chico: conserva pregunta y previos', chico.mensajes.length===3 && /PREGUNTA: hola/.test(chico.mensajes[chico.mensajes.length-1].content));
  t('CUPO·historial: suelta la charla vieja', hist.recortado===true, JSON.stringify({r:hist.recortado}));
  t('CUPO·historial: NO marca recorte de material (solo charla)', hist.recorteMaterial===false);
  t('CUPO·historial: la pregunta sobrevive al final', /PREGUNTA: cuanto es dos mas dos/.test(hist.mensajes[hist.mensajes.length-1].content));
  t('CUPO·material: recorta material (recorteMaterial=true)', mat.recorteMaterial===true);
  t('CUPO·material: la PREGUNTA queda intacta al final', /PREGUNTA: LACLAVE_DEL_FINAL/.test(mat.mensajes[mat.mensajes.length-1].content));
  t('CUPO·material: deja el aviso honesto de recorte', /recort/i.test(mat.mensajes[mat.mensajes.length-1].content));
  t('CUPO·material: efectivamente achicó el pedido', mat.mensajes[mat.mensajes.length-1].content.length < 60000, mat.mensajes[mat.mensajes.length-1].content.length);
}
console.log('\n'+(bad===0?'✅ TODO VERDE — '+ok+' pruebas pasan (las dos muletas)':'❌ '+bad+' fallos de '+(ok+bad)));
process.exit(bad===0?0:1);
