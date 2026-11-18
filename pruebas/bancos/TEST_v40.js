/* TEST_v40.js — amarra la tanda v40 (25/09/2026) de la PLATAFORMA:
   0) quién es quién + «¿qué modelo sos?» a secas · 1) 🧠 COMPRENDE (fusión palabras+significado)
   2) 🎧/Aa/📷 ACOMPAÑA · 3) 🔄 ACTUALIZAR. Corre las piezas REALES extraídas del HTML contra
   dobles (extractor de embeddings falso, fetch falso, DOM falso). Busca el fallo: ¿baja 118 MB
   sin permiso? ¿cambia la búsqueda cuando está apagada? ¿recarga sola? ¿usa un teléfono leído
   de una foto? ¿deja el micrófono abierto? */
const fs=require('fs'), path=require('path'), vm=require('vm');
const H=fs.readFileSync(path.join(__dirname,'..','PLATAFORMA','index.html'),'utf8');
let ok=0,bad=0; function t(m,c,x){ if(c){ok++;} else {bad++; console.log('  ❌ '+m+(x!==undefined?'  → '+String(x).slice(0,300):''));} }
function grabFunc(n){ const i=H.indexOf('function '+n+'('); if(i<0) return ''; let d=0,k=H.indexOf('{',i); for(let p=k;p<H.length;p++){const c=H[p]; if(c==='{')d++; else if(c==='}'){d--; if(!d) return H.slice(i,p+1);}} return ''; }
const ini=H.indexOf('   v40 · PILARES 2 y 3 + ACTUALIZADOR'), fin=H.indexOf('/* ══════════ FIN v40 (comprende');
t('extraje el bloque v40', ini>0 && fin>ini);
if(!(ini>0&&fin>ini)){ console.log('\n❌ sin bloque v40'); process.exit(1); }
const BLK=H.slice(H.lastIndexOf('/*',ini),fin).replace(/^(\s*)const (\w+)/gm,'$1var $2').replace(/^(\s*)let (\w+)/gm,'$1var $2');
const BM25=grabFunc('bm25Search'), TOK=grabFunc('tokenize'), NORM=grabFunc('normalizeText');
function mk(extra){
  const timers=[], st={};
  const el={}; const get=id=>el[id]||null;
  const ctx=Object.assign({ console, JSON, Math, Date, String, Array, Object, Promise, Map, Set, Float32Array, RegExp, Number, encodeURIComponent,
    localStorage:{getItem:k=>k in st?st[k]:null,setItem:(k,v)=>{st[k]=String(v)},removeItem:k=>{delete st[k]}}, _st:st,
    sessionStorage:{ _d:{}, getItem(k){return this._d[k]||null}, setItem(k,v){this._d[k]=String(v)} },
    setTimeout:(f,ms)=>{ timers.push({f,ms}); return timers.length; }, setInterval:(f,ms)=>{ timers.push({f,ms,iv:1}); return 99; }, clearInterval(){}, _timers:timers,
    document:{ getElementById:get, querySelector:()=>null, body:{ classList:{ _s:new Set(), toggle(c,on){ on?this._s.add(c):this._s.delete(c); }, contains(c){return this._s.has(c)} }, appendChild(){} }, createElement:()=>({ style:{}, appendChild(){}, classList:{toggle(){}} }) },
    location:{ protocol:'https:', href:'https://mirror.x/' , reload(){ ctx._recargo=(ctx._recargo||0)+1; } },
    navigator:{ onLine:true }, window:{}, regError(k,e){ ctx._err=(ctx._err||[]).concat(k); }, _msgs:[],
    addMsg(r,x){ ctx._msgs.push({r,x}); }, actuaEsc:s=>String(s), PLATFORM_VERSION:'v38', busy:false, ttsOn:false,
    recuerdosChunks:[], ragChunks:[], RECENCIA_VIDA_MEDIA_MS:14*864e5, STOPWORDS_ES:new Set(),
  }, extra||{});
  ctx.window=ctx; vm.createContext(ctx);
  vm.runInContext([NORM,TOK,BM25].join('\n'), ctx);
  vm.runInContext(BLK, ctx);
  return ctx;
}
// ── 0) quién es quién + modelo ──
{ t('quién: el bloque de identidad aclara que el modo espejo NO es el usuario', /es tu modo espejo —cuando hablás como tu usuario—, NO es tu usuario/.test(H));
  t('quién: nombra al usuario desde el perfil y la marca MIRROR aparte', /Tu usuario, la persona que te escribe, es ' \+ _usr/.test(H) && /MIRROR «El Origen» es la marca de la plataforma/.test(H));
  const i=H.indexOf('const bloqueIdentidad')>=0?H.indexOf('const bloqueIdentidad'):H.indexOf('let bloqueIdentidad'); const S=H.slice(i,H.indexOf('/* v38-honest',i));
  const ctx={CONFIG:{appName:'MANIFIESTOS',modos:{mirror:'ATIS',tars:'MODO ANALÍTICO',jurado:'EXPERTO/EXAMINADOR',conn:'BASE'},perfil:{nombre:'Darío Tello'}},PLATFORM_VERSION:'v38'}; vm.createContext(ctx);
  vm.runInContext(S.replace('let bloqueIdentidad','var bloqueIdentidad')+';globalThis.__b=bloqueIdentidad;',ctx);
  t('quién (vivo): «MANIFIESTOS» sos VOS, «ATIS» es tu modo espejo, tu usuario es Darío', /«MANIFIESTOS» sos VOS/.test(ctx.__b) && /«ATIS» es tu modo espejo/.test(ctx.__b) && /Tu usuario, la persona que te escribe, es Darío Tello/.test(ctx.__b), ctx.__b.slice(-400));
  const c2={}; vm.createContext(c2); vm.runInContext(grabFunc('esPreguntaModelo'),c2);
  const q=s=>vm.runInContext('esPreguntaModelo('+JSON.stringify(s)+')',c2);
  t('modelo: «QUE MODELO SOS?» (captura 24/09) → respuesta fija', q('QUE MODELO SOS?'));
  t('modelo: «¿cuál modelo sos?» → sí', q('¿cuál modelo sos?'));
  t('modelo: «¿qué modelo de auto tenés?» → NO', !q('¿qué modelo de auto tenés?'));
  t('modelo: «¿qué modelo de celular me recomendás?» → NO', !q('¿qué modelo de celular me recomendás?'));
}
// ── 1) COMPRENDE ──
{ const A={text:'USUARIO: mi perro se llama Tango y es un salchicha || ASISTENTE: qué lindo', tf:{perro:1,llama:1,tango:1,salchicha:1}, len:8};
  const B={text:'USUARIO: hoy fui al veterinario con el bicho || ASISTENTE: ojalá esté bien', tf:{veterinario:1,bicho:1}, len:6};
  const C={text:'USUARIO: mañana tengo reunión de departamento || ASISTENTE: suerte', tf:{reunion:1,departamento:1,manana:1}, len:6};
  const c=mk({ recuerdosChunks:[A,B,C] });
  // vectores «de juguete» (normalizados): la pregunta por la mascota se parece a A y a B, no a C
  const V={}; const norm=v=>{ const n=Math.hypot(...v); return Float32Array.from(v.map(x=>x/n)); };
  V[A.text]=norm([0.9,0.3,0.1]); V[B.text]=norm([0.8,0.45,0.1]); V[C.text]=norm([0.05,0.1,0.99]);
  vm.runInContext('_sem.on=true; _sem.extractor=function(){};',c);
  for(const k of [A,B,C]) vm.runInContext('_sem.vecs.set(_semHash('+JSON.stringify(k.text)+'), Float32Array.from('+JSON.stringify(Array.from(V[k.text]))+'))',c);
  const qv=Array.from(norm([0.85,0.4,0.1]));
  const lexSolo=vm.runInContext('bm25Search("¿cómo está tu mascota?", recuerdosChunks, 4)',c);
  t('comprende: SIN la pregunta del turno activa → búsqueda por palabras de siempre (nada)', lexSolo.length===0, lexSolo.length);
  vm.runInContext('_sem.q={vec:Float32Array.from('+JSON.stringify(qv)+'), ts:Date.now(), activo:true}',c);
  const r=vm.runInContext('bm25Search("¿cómo está tu mascota?", recuerdosChunks, 4).map(x=>x.text)',c);
  t('comprende: CON significado → encuentra al perro y al veterinario sin palabras en común', r.length===2 && r.some(x=>/Tango/.test(x)) && r.some(x=>/veterinario/.test(x)), JSON.stringify(r));
  t('comprende: NO cuela lo que no viene al caso (la reunión)', !r.some(x=>/reunión/.test(x)));
  const r2=vm.runInContext('bm25Search("reunión de departamento", recuerdosChunks, 4).map(x=>x.text)',c);
  t('comprende: lo que coincide por PALABRAS sigue apareciendo (fusión, no reemplazo)', r2.some(x=>/reunión/.test(x)), JSON.stringify(r2));
  vm.runInContext('semCerrarConsulta()',c);
  t('comprende: cerrada la consulta del turno → vuelve a ser solo por palabras', vm.runInContext('bm25Search("¿cómo está tu mascota?", recuerdosChunks, 4).length',c)===0);
  vm.runInContext('_sem.q={vec:Float32Array.from('+JSON.stringify(qv)+'), ts:Date.now()-61000, activo:true}',c);
  t('comprende: una consulta vieja (>60 s) no se usa', vm.runInContext('semListo()',c)===false);
  vm.runInContext('_sem.q={vec:Float32Array.from('+JSON.stringify(qv)+'), ts:Date.now(), activo:true}; _sem.on=false;',c);
  t('comprende: apagada → no se usa aunque haya vectores', vm.runInContext('semListo()',c)===false);
  // bm25Search suelto (como lo extraen los bancos, sin el bloque) = idéntico
  const c3={RECENCIA_VIDA_MEDIA_MS:1,STOPWORDS_ES:new Set()}; vm.createContext(c3); vm.runInContext([NORM,TOK,BM25].join('\n'),c3);
  t('comprende: bm25Search sin el bloque v40 corre igual que siempre', vm.runInContext('bm25Search("perro tango",[{text:"a",tf:{perro:1,tango:1},len:2},{text:"b",tf:{gato:1},len:1}],4).length',c3)===1);
  // no baja nada sin permiso
  const c4=mk(); 
  t('comprende: con la opción apagada NO se programa ninguna descarga al abrir', !c4._timers.some(x=>/semCargar/.test(String(x.f))));
  const c5=mk(); c5._st.mirror_sem_on='1'; vm.runInContext(BLK,c5);
  t('comprende: encendida de antes → se prepara sola al abrir, con demora (no frena el arranque)', c5._timers.some(x=>/semCargar/.test(String(x.f)) && x.ms>=3000));
  t('comprende: la librería se importa SOLO dentro de semCargar', (BLK.match(/import\(/g)||[]).length===1 && /async function semCargar\(\)\{[\s\S]*?import\(u\)/.test(BLK));
  t('comprende: modelo libre (e5 multilingüe) y peso dicho de frente', /Xenova\/multilingual-e5-small/.test(BLK) && /~' \+ SEM_MB \+ ' MB/.test(BLK));
  t('comprende: se usa con prefijos query:/passage: (como pide e5)', /'query: '/.test(BLK) && /'passage: '/.test(BLK));
  // consulta con tope de espera
  (async()=>{})();
}
// ── 1b) preparación de la consulta: rápida sí, lenta no espera ──
const asyncTests = (async()=>{
  const c=mk(); c.setTimeout=(f,ms)=>setTimeout(f,Math.min(ms,50)); // tiempos reales pero cortos
  vm.runInContext('_sem.on=true; _sem.extractor=async function(t){ return { tolist(){ return t.map(()=>[1,0,0]); } }; };',c);
  await vm.runInContext('semPrepararConsulta("hola")',c);
  t('comprende: extractor rápido → la pregunta queda con su vector ACTIVO', vm.runInContext('!!(_sem.q && _sem.q.activo)',c));
  const c2=mk(); c2.setTimeout=(f,ms)=>setTimeout(f,Math.min(ms,50));
  vm.runInContext('_sem.on=true; _sem.extractor=function(){ return new Promise(()=>{}); };',c2);
  const t0=Date.now(); await vm.runInContext('semPrepararConsulta("hola")',c2);
  t('comprende: extractor colgado → la pregunta NO espera (sigue por palabras)', vm.runInContext('_sem.q===null',c2) && Date.now()-t0<1000);
  const c3=mk(); vm.runInContext('_sem.on=false;',c3); await vm.runInContext('semPrepararConsulta("hola")',c3);
  t('comprende: apagada → ni intenta', vm.runInContext('_sem.q===null',c3));
  // indexa en lotes y guarda sin romper si no hay IndexedDB
  const c4=mk({ recuerdosChunks:[{text:'uno'},{text:'dos'},{text:'tres',arch:true}], ragChunks:[{text:'cuatro'}] }); c4.setTimeout=(f,ms)=>setTimeout(f,0);
  vm.runInContext('_sem.on=true; _sem.extractor=async function(t){ return { tolist(){ return t.map(()=>[0,1,0]); } }; };',c4);
  vm.runInContext("_sem.estado='listo'",c4);
  await vm.runInContext('semIndexar()',c4);
  t('comprende: aprende recuerdos y documentos (no los archivados), aun sin IndexedDB', vm.runInContext('_sem.vecs.size',c4)===3 && vm.runInContext('_sem.hechos',c4)===3);
  t('comprende: el panel lo cuenta en criollo', /Entiende 3 de 3 fragmentos/.test(vm.runInContext('semEstadoTexto()',c4)), vm.runInContext('semEstadoTexto()',c4));
  // ── 2) ACOMPAÑA ──
  const cc=mk(); const fr=s=>vm.runInContext('CHARLA_FIN_RE.test('+JSON.stringify(s)+')',cc);
  t('charla: «terminamos» / «chau» / «listo gracias» cortan', fr('terminamos') && fr('chau') && fr('listo gracias'));
  t('charla: «tengo que terminar el informe» NO corta', !fr('tengo que terminar el informe'));
  // tic: espera silencio real
  let escuchas=0; vm.runInContext('charlaEscuchar=function(){ globalThis.__esc=(globalThis.__esc||0)+1; }; charlaOn=true;',cc);
  cc.speechSynthesis={speaking:false,pending:false}; vm.runInContext('window.speechSynthesis=speechSynthesis',cc);
  vm.runInContext('charlaTic()',cc);
  t('charla: primer tic en silencio → todavía NO escucha (espera 0,8 s)', !cc.__esc);
  vm.runInContext('charlaQuietoDesde=Date.now()-900; charlaTic()',cc);
  t('charla: tras 0,8 s de silencio real → escucha', cc.__esc===1);
  cc.speechSynthesis.speaking=true; vm.runInContext('charlaQuietoDesde=Date.now()-900; charlaTic()',cc);
  t('charla: mientras la entidad HABLA → no abre el micrófono (no se escucha a sí misma)', cc.__esc===1 && vm.runInContext('charlaQuietoDesde',cc)===0);
  cc.speechSynthesis.speaking=false; vm.runInContext('busy=true; charlaQuietoDesde=Date.now()-900; charlaTic()',cc);
  t('charla: mientras PIENSA → tampoco', cc.__esc===1);
  t('charla: dos silencios seguidos → se apaga sola (no queda el micrófono abierto)', /charlaSilencios >= 2\) charlaTerminar/.test(BLK));
  t('charla: sin soporte del navegador → lo dice, no rompe', /Para charlar por voz necesito el dictado y la voz del navegador/.test(BLK));
  // modo fácil
  const cf=mk(); vm.runInContext('facilToggle()',cf);
  t('modo fácil: prende la clase, lo recuerda y avisa', cf.document.body.classList.contains('modo-facil') && cf._st.mirror_facil==='1' && cf._msgs.some(m=>/Modo fácil prendido/.test(m.x)));
  vm.runInContext('facilToggle()',cf);
  t('modo fácil: se apaga igual', !cf.document.body.classList.contains('modo-facil') && cf._st.mirror_facil==='0');
  t('modo fácil: CSS agranda chat y entrada y esconde lo accesorio', /body\.modo-facil \.bubble[^{]*\{font-size:19px/.test(H) && /body\.modo-facil \.fnote \[data-pie\]/.test(H));
  // foto y resuelvo
  const cp=mk(); cp.agenteDebeActuar=s=>/agend|avis/.test(s);
  t('foto: «agendame el vencimiento» con foto → va a foto y resuelvo', vm.runInContext('fotoPideAccion("agendame el vencimiento")',cp));
  t('foto: «¿qué dice esta foto?» → visión de siempre', !vm.runInContext('fotoPideAccion("¿qué dice esta foto?")',cp));
  let llamadoAgente=null;
  Object.assign(cp,{ modeloVisionActivo:()=>'qwen/qwen3.8-27b', imagenAdjunta:'data:image/jpeg;base64,xx', quitarImagenAdjunta(){ cp.imagenAdjunta=null; }, setButtonsBusy(){}, showTyping(){}, removeTyping(){}, setTypingNote(){},
    llamarMotorVigente:async()=>'Factura de luz · vence 15/10/2026 · $ 23.400 · Tel. 0800-333-1234', GROQ_URL:'x', GROQ_KEY:'', imagenReciente:null,
    agenteResolver:async(txt,o)=>{ llamadoAgente={txt,o}; return true; } });
  await vm.runInContext('fotoResolver("agendame el vencimiento")',cp);
  t('foto: lee la foto y se la pasa al agente como CONTEXTO (no repite el mensaje)', llamadoAgente && llamadoAgente.o.yaMostrado===true && /vence 15\/10\/2026/.test(llamadoAgente.o.contexto));
  t('foto: muestra lo que leyó antes de actuar (transparencia)', cp._msgs.some(m=>/Esto es lo que leí en la foto/.test(m.x)));
  t('foto: el agente recibe la regla «un teléfono leído de la foto NO se usa»', /Un teléfono leído de la foto NO se usa: pedile que lo dicte/.test(H));
  t('foto: el número de la foto NO pasa el candado (ultimoPedidoUsuario es solo el texto del usuario)', !/ultimoPedidoUsuario\s*=\s*[^;]*contexto/.test(H));
  // ── 3) ACTUALIZAR ──
  const ca=mk(); 
  t('actualizar: el build de ESTA página se puede leer', vm.runInContext('actLeerBuild('+JSON.stringify(H)+')',ca)===vm.runInContext('APP_BUILD',ca));
  t('actualizar: las novedades de ESTA página se pueden leer (JSON válido)', vm.runInContext('actLeerNovedades('+JSON.stringify(H)+').length',ca)>=3);
  t('actualizar: ordena bien los builds', vm.runInContext('_actCompara("2026-09-25.2","2026-09-25.1")>0 && _actCompara("2026-10-01.1","2026-09-25.9")>0 && _actCompara("2026-09-25.1","2026-09-25.1")===0',ca));
  const nuevo=H.replace(/const APP_BUILD = '[^']+'/,"const APP_BUILD = '2099-01-01.1'");
  let cartel=null;
  Object.assign(ca,{ fetch:async()=>({ ok:true, status:200, text:async()=>nuevo }) }); vm.runInContext('actCartel=function(b,n,m){ globalThis.__cartel={b:b,n:n,m:m}; }',ca);
  const r1=await vm.runInContext('actBuscar(false)',ca);
  t('actualizar: publicada más nueva → cartel con build y novedades', r1==='2099-01-01.1' && ca.__cartel && ca.__cartel.n.length>=3);
  t('actualizar: NUNCA recarga sola', !ca._recargo);
  let pidioOtra=false; const cthr=mk(); cthr._st.mirror_act_ultimo=String(Date.now()-3600*1000); cthr.fetch=async()=>{ pidioOtra=true; };
  await vm.runInContext('actBuscar(false)',cthr);
  t('actualizar: la automática no vuelve a bajar la página antes de 6 h (datos del celu)', !pidioOtra);
  await vm.runInContext('actBuscar(true)',cthr).catch(()=>{});
  t('actualizar: … pero a mano sí busca', pidioOtra);
  t('actualizar: anota cuándo buscó', /localStorage\.setItem\('mirror_act_ultimo'/.test(H));
  const cb=mk(); Object.assign(cb,{ fetch:async()=>({ ok:true, status:200, text:async()=>H }) }); vm.runInContext('actCartel=function(){ globalThis.__cartel=1; }',cb);
  const r2=await vm.runInContext('actBuscar(true)',cb);
  t('actualizar: misma versión → «estás al día», sin cartel', r2==='' && !cb.__cartel);
  const cfile=mk(); cfile.location.protocol='file:'; let pidio=false; cfile.fetch=async()=>{ pidio=true; };
  await vm.runInContext('actBuscar(true)',cfile);
  t('actualizar: abierta desde archivo local → lo dice y no intenta', !pidio);
  const coff=mk(); coff.navigator.onLine=false; let pid2=false; coff.fetch=async()=>{ pid2=true; };
  await vm.runInContext('actBuscar(false)',coff);
  t('actualizar: sin red → no intenta', !pid2);
  const cerr=mk(); cerr.fetch=async()=>{ throw new Error('boom'); };
  const r3=await vm.runInContext('actBuscar(true)',cerr);
  t('actualizar: si falla la red → null, sin romper', r3===null);
  const cpos=mk(); cpos._st.mirror_act_pospuesto=JSON.stringify({b:'2099-01-01.1',t:Date.now()}); let apareció=false; cpos.document.body.appendChild=()=>{ apareció=true; };
  vm.runInContext('actCartel("2099-01-01.1",[],false)',cpos);
  t('actualizar: «más tarde» se respeta 24 h (automático)', !apareció);
  vm.runInContext('actCartel("2099-01-01.1",[],true)',cpos);
  t('actualizar: … pero si lo buscás a mano, te lo muestra', apareció);
  const cbusy=mk(); cbusy.busy=true; await vm.runInContext('actAplicar()',cbusy);
  t('actualizar: no recarga a mitad de una respuesta', !cbusy._recargo && cbusy._msgs.some(m=>/Termino esta respuesta/.test(m.x)));
  const cok=mk(); await vm.runInContext('actAplicar()',cok);
  t('actualizar: «Actualizar ahora» recarga y vuelve directo a la app (no a la puerta)', cok._recargo===1 && cok.sessionStorage._d.mirror_sesion_entro==='1');
  const c0=mk();
  t('actualizar: busca sola al abrir (con demora) y cada 6 h', c0._timers.some(x=>/actBuscar\(false\)/.test(String(x.f)) && x.ms>=5000) && c0._timers.some(x=>x.iv && x.ms===6*3600*1000));
  // ── cableado e interfaz ──
  const i=H.indexOf('async function send() {'), S=H.slice(i,H.indexOf('\n}\n',i));
  t('send(): foto+acción ANTES de la visión de siempre', S.indexOf('fotoPideAccion(text)')>0 && S.indexOf('fotoPideAccion(text)') < S.indexOf('if (imagenAdjunta) { return enviarConImagen(text); }'));
  t('send(): vector de la pregunta antes del agente, cierre al armar el contexto', S.indexOf('semPrepararConsulta(text)') < Math.max(S.indexOf('agenteDebeActuar(text)'), S.indexOf('agenteDebeActuar(_textoModelo)')) /* v40-hechos */ && S.indexOf('semCerrarConsulta(); // v40-comprende') > S.indexOf('const mensajesGroq'));
  t('bm25Search delega SOLO si la consulta del turno está lista', /if \(typeof semFusionar === 'function' && typeof _sem !== 'undefined' && !_sem\.enFusion && semListo\(\)\)/.test(H));
  t('pie: 🧠 memoria que entiende · Aa modo fácil · 🔄 actualizar (y en el organizador)', /data-pie="comprende"/.test(H) && /data-pie="facil"/.test(H) && /data-pie="actualizar"/.test(H) && /'comprende','facil','actualizar'\]/.test(H));
  t('herramientas: 🎧 charla por voz', /id="charlabtn" onclick="charlaIniciar\(\);return false;"/.test(H));
  t('autoconocimiento: cuenta las 4 capacidades nuevas', /• 🧠 MEMORIA QUE ENTIENDE/.test(H) && /• 🎧 CHARLA POR VOZ/.test(H) && /• 📷 FOTO Y RESUELVO/.test(H) && /• 🔄 ACTUALIZAR/.test(H));
  t('_sem es var (sin zona muerta si bm25Search corre antes)', /var _sem = \{ on:false/.test(H));
})();
asyncTests.then(()=>{ console.log('\n'+(bad===0?'✅ TODO VERDE — '+ok+' pruebas pasan (plataforma · v40)':'❌ '+bad+' fallos de '+(ok+bad))); process.exit(bad?1:0); })
  .catch(e=>{ console.log('💥',e); process.exit(1); });
