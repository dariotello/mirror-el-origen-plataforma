/* TEST_audit2.js — amarra la tanda v40-audit2 (25/09/2026, auditoría en vivo de Darío sobre la v40):
   1) «mi perra SE LLAMA Pochola» ya no es un pedido de llamar.  2) choque de nombres persona/modo.
   3) sin Firebase no se pega al propio sitio (404) y se avisa.  4) «tu modelo» + respuesta fija solo corta.
   5) favicon propio.  6) COMPRENDE: si huggingface.co no deja, baja por el proxy (/hf). */
const fs=require('fs'), path=require('path'), vm=require('vm');
const H=fs.readFileSync(path.join(__dirname,'..','PLATAFORMA','index.html'),'utf8');
let ok=0,bad=0; function t(m,c,x){ if(c){ok++;} else {bad++; console.log('  ❌ '+m+(x!==undefined?'  → '+String(x).slice(0,300):''));} }
function grabFunc(n,from){ const i=H.indexOf(from||('function '+n+'(')); if(i<0) return ''; let d=0,k=H.indexOf('{',i); for(let p=k;p<H.length;p++){const c=H[p]; if(c==='{')d++; else if(c==='}'){d--; if(!d) return H.slice(i,p+1);}} return ''; }
const L=n=>{ const i=H.indexOf(n); return i<0?'':H.slice(i,H.indexOf('\n',i)); };
(async()=>{
// 1) llamar
{ const i=H.indexOf('const ACTUA_CMDS'); let d=0,k=H.indexOf('[',i),e; for(let p=k;p<H.length;p++){const c=H[p]; if(c==='[')d++; else if(c===']'){d--; if(!d){e=p+1;break;}}}
  const ctx={}; vm.createContext(ctx); vm.runInContext('var ACTUA_CMDS='+H.slice(k,e)+';',ctx);
  const tel=ctx.ACTUA_CMDS.find(c=>/llam\[aá\]/.test(c.re.source));
  const primero=s=>{ const i=ctx.ACTUA_CMDS.findIndex(c=>c.re.test(s)); return i; };
  t('llamar: «MI PERRA SE LLAMA POCHOLA.» → NO es llamar (captura 10:28)', !tel.re.test('MI PERRA SE LLAMA POCHOLA.'));
  t('llamar: «mi perra se llama pochola» → ningún comando de la capa ACTÚA', primero('mi perra se llama pochola')<0, primero('mi perra se llama pochola'));
  t('llamar: «me llamo Darío» → NO', !tel.re.test('me llamo Darío'));
  t('llamar: «¿cómo se llama tu perro?» → NO', !tel.re.test('¿cómo se llama tu perro?'));
  t('llamar: «llamá a Juan» → SÍ', tel.re.test('llamá a Juan'));
  t('llamar: «llama a mi vieja» (sin tilde) → SÍ', tel.re.test('llama a mi vieja'));
  t('llamar: «che, llamá a Laura» → SÍ', tel.re.test('che, llamá a Laura'));
  t('llamar: «llamalo a Pedro» → SÍ', tel.re.test('llamalo a Pedro'));
  t('llamar: «marcale a Juan» → SÍ', tel.re.test('marcale a Juan'));
  const m=tel.re.exec('llamá a Juan Pérez'); t('llamar: el destino sigue saliendo bien', m && m[1].trim()==='Juan Pérez', m&&m[1]);
}
// 2) choque de nombres
t('identidad: detecta si la persona se llama igual que un modo o la entidad', /const _chocan = /.test(H) && /OJO, CHOQUE DE NOMBRES/.test(H) && /explicá LAS DOS cosas/.test(H));
// 3) sin Firebase
{ const code=[grabFunc('fbFetch'), grabFunc('','async function perfilLoad('), grabFunc('','async function chunksLoadAll('), grabFunc('','async function perfilSave(')].join('\n');
  let calls=0; const ctx={ FB_URL:'', Response, fetch:()=>{ calls++; return Promise.resolve(new Response('{"x":1}')); }, console }; vm.createContext(ctx); vm.runInContext(code.replace(/^/, 'var FB_URL = globalThis.FB_URL;\n'),ctx);
  const p=await vm.runInContext('perfilLoad()',ctx), c=await vm.runInContext('chunksLoadAll()',ctx); await vm.runInContext('perfilSave({a:1})',ctx);
  t('sin Firebase: NO sale a la red (antes: 404 a /perfil.json del propio sitio)', calls===0, calls);
  t('sin Firebase: se comporta como base vacía', p===null && Array.isArray(c) && c.length===0);
  vm.runInContext('FB_URL="https://x.firebaseio.com"',ctx); await vm.runInContext('perfilLoad()',ctx);
  t('con Firebase: sí va a la red, como siempre', calls===1, calls);
  t('sin Firebase: todas las llamadas pasan por fbFetch', !/[^b]fetch\(FB_URL\+/.test(H) && (H.match(/fbFetch\(FB_URL\+/g)||[]).length>=15);
  t('sin Firebase: aviso honesto una vez por sesión', /function avisoSinMemoria/.test(H) && /mirror_aviso_sinfb/.test(H) && /al cerrar se borra/.test(H));
}
// 4) modelo
{ const code=[L('const _OTRO_PEDIDO_RE').replace('const ','var '),grabFunc('esPreguntaModelo'),grabFunc('_restoSinPreguntaModelo'),grabFunc('esPreguntaModeloSola')].join('\n');
  const ctx={}; vm.createContext(ctx); vm.runInContext(code,ctx);
  const P=s=>vm.runInContext('esPreguntaModelo('+JSON.stringify(s)+')',ctx), S=s=>vm.runInContext('esPreguntaModeloSola('+JSON.stringify(s)+')',ctx);
  const cap='estoy cansado, vos como estas , que contas, como estu nueva versión, tu modelo?';
  t('modelo: «…tu modelo?» (captura 10:35) se detecta', P(cap));
  t('modelo: … pero con charla alrededor NO va la respuesta fija sola (contesta todo + identidad)', !S(cap));
  t('modelo: «¿qué modelo sos?» corto → respuesta fija', S('¿qué modelo sos?'));
  t('modelo: «¿cuál es tu modelo?» → sí', P('¿cuál es tu modelo?'));
  t('modelo: «armame un modelo de carta» → NO', !P('armame un modelo de carta de presentación'));
  t('modelo: «tu modelo de negocio» → NO', !P('¿cuál es tu modelo de negocio?'));
  // v40-audit3 (captura 10:58): 47 letras con charla → antes contestaba SOLO el texto fijo
  t('modelo: «Estoy cansado, ¿cómo estás? ¿cuál es tu modelo?» → NO sola (contesta todo + identidad)', !S('Estoy cansado, ¿cómo estás? ¿cuál es tu modelo?'));
  t('modelo: «Hola, ¿qué modelo usás?» → sola (el saludo no cuenta)', S('Hola, ¿qué modelo usás?'));
  t('modelo: «¿Qué modelo de IA sos?» → sola', S('¿Qué modelo de IA sos?'));
  t('modelo: «¿cuál es tu modelo?» → sola', S('¿cuál es tu modelo?'));
}
// 5) favicon
t('favicon propio en el <head> (no más /favicon.ico 404)', /<link rel="icon" href="data:image\/svg\+xml,/.test(H.slice(0,H.indexOf('</head>'))));
// 6) COMPRENDE por el proxy
{ const ini=H.indexOf('async function semCargar()'); const code=[grabFunc('','async function semCargar('), grabFunc('_semMensajeRed')].join('\n').replace('lib = await import(u)','lib = await __imp(u)');
  function correr({proxy, falla, pref}){
    const st={}; if(pref) st.mirror_sem_via=pref;
    const intentos=[];
    const lib={ env:{ remoteHost:'https://huggingface.co/' }, pipeline: async()=>{ intentos.push(lib.env.remoteHost); if (falla(lib.env.remoteHost)) throw new TypeError('Failed to fetch'); return function(){}; } };
    const ctx={ _sem:{ extractor:null, cargando:null, estado:'', err:'' }, SEM_LIB_URLS:['x'], SEM_MODELO:'Xenova/multilingual-e5-small', PROXY_URL:proxy, semPintar(){}, semProgreso(){}, _semCargarCache: async()=>{}, regError(){}, __imp: async()=>lib,
      localStorage:{ getItem:k=>k in st?st[k]:null, setItem:(k,v)=>{st[k]=String(v)} }, console };
    vm.createContext(ctx); vm.runInContext(code,ctx);
    return vm.runInContext('semCargar()',ctx).then(r=>({r, intentos, st, err:ctx._sem.err}));
  }
  let x=await correr({ proxy:'https://p.workers.dev', falla:h=>/huggingface\.co/.test(h) });
  t('COMPRENDE: HF bloqueado → baja por el proxy /hf y anda', x.r===true && x.intentos.length===2 && x.intentos[1]==='https://p.workers.dev/hf/', JSON.stringify(x));
  t('COMPRENDE: recuerda que el camino es el proxy', x.st.mirror_sem_via==='proxy');
  x=await correr({ proxy:'https://p.workers.dev', falla:()=>false });
  t('COMPRENDE: si HF anda, NO usa el proxy (no gasta tu Worker)', x.r===true && x.intentos.length===1 && x.intentos[0]==='https://huggingface.co/');
  x=await correr({ proxy:'https://p.workers.dev', falla:()=>true });
  t('COMPRENDE: si fallan los dos → mensaje claro (falta la ruta /hf), sin romper', x.r===false && /ruta \/hf/.test(x.err), x.err);
  // v40-audit3 (captura 11:02): el proxy existe pero la ruta /hf quedó mal puesta → 405
  { const code2=grabFunc('_semMensajeRed'); const c2={}; vm.createContext(c2); vm.runInContext(code2,c2);
    const msg=vm.runInContext('_semMensajeRed(new Error(\'Error (405) occurred while trying to load file: "https://p.workers.dev/hf/Xenova/multilingual-e5-small/resolve/main/config.json".\'), true)',c2);
    t('COMPRENDE: 405 del proxy → dice que la ruta /hf va ARRIBA de «Usá POST»', /405/.test(msg) && /Usá POST/.test(msg), msg); }
  x=await correr({ proxy:'', falla:()=>true });
  t('COMPRENDE: sin proxy → lo dice de frente', x.r===false && /sin proxy/.test(x.err), x.err);
  x=await correr({ proxy:'https://p.workers.dev/', falla:h=>/huggingface\.co/.test(h), pref:'proxy' });
  t('COMPRENDE: la 2ª vez va directo por el proxy (sin volver a chocar con HF)', x.r===true && x.intentos.length===1 && x.intentos[0]==='https://p.workers.dev/hf/', JSON.stringify(x.intentos));
}
console.log('\n'+(bad===0?'✅ TODO VERDE — '+ok+' pruebas pasan (plataforma · auditoría 25/09)':'❌ '+bad+' fallos de '+(ok+bad)));
process.exit(bad?1:0);
})().catch(e=>{ console.log('💥',e); process.exit(1); });
