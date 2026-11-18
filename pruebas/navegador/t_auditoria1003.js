// t_auditoria1003.js — la auditoría COMPLETA de Darío del 3/10/2026, con sus frases EXACTAS, en navegador real.
// Uso: FILE=ruta/a/PLATAFORMA/index.html node t_auditoria1003.js
const { abrir } = require('./harness');
let ok=0,bad=0; const t=(m,c,x)=>{ if(c){ok++;console.log('  ✅ '+m);} else {bad++;console.log('  ❌ '+m+(x!==undefined?' → '+JSON.stringify(x).slice(0,400):''));} };
async function mandar(h, q, ms){ const n0=h.srv._reqs.length; await h.page.fill('#inp',q); await h.page.keyboard.press('Enter'); await h.page.waitForTimeout(ms||2300); return h.srv._reqs.slice(n0); }
const ultimo = h => h.page.evaluate(()=>{ const m=document.querySelectorAll('#chat .msg'); return m.length? m[m.length-1].innerText : ''; });
const CFG = { appName:'MANIFIESTOS', perfil:{ nombre:'ATIS' }, modos:{ mirror:'ATIS', tars:'MODO ANALÍTICO', jurado:'EXPERTO/EXAMINADOR', conn:'BASE' } };
(async()=>{
  // 1) datos fijos con las palabras de Darío (el modelo simulado «inventa» como lo hizo en vivo: si se cuela, se ve)
  { const h=await abrir({fb:true, cfg:CFG, reply:'El chip de respaldo es el módulo interno que guarda una copia de seguridad de tus datos. Está en Configuración → Seguridad. Sólo tú tenés acceso. Estás hablando con ATIS.'});
    let rq=await mandar(h,'QUE ES ESO DEL CHIP DE RESPALDO?',1500); let u=await ultimo(h);
    t('«¿qué es eso del chip de respaldo?» → contesta la app (sin modelo)', rq.length===0 && /un aviso de quién contestó/.test(u) && !/módulo interno/.test(u), u.slice(0,200));
    rq=await mandar(h,'DONDE LA BUSCO? SOY PEPINILLO RICK!!!',2300);
    const b=rq.map(r=>r.body).join('\n');
    t('repregunta «¿dónde la busco?»: el modelo recibe el ida y vuelta anterior (la respuesta fija del chip) y la arquitectura', /un aviso de quién contestó/.test(b) && /TODO LO QUE LA APP TIENE/.test(b), rq.length);
    rq=await mandar(h,'SEGURIDAD DE LA APP?',1500); u=await ultimo(h);
    t('«¿seguridad de la app?» → dato fijo honesto: NO «solo vos tenés acceso»', rq.length===0 && /no te voy a decir que «solo vos» accedés/.test(u) && /TU Firebase/.test(u), u.slice(0,200));
    rq=await mandar(h,'COMO ESTAS? QUIEN ERES TÚ? CON QUIEN ESTOY HABLANDO? QUE VERSIÓN ERES? ERES MEJOR QUE LAS ANTERIORES?',2500); u=await ultimo(h);
    t('identidad + versión: «soy MANIFIESTOS… extensión digital de ATIS» y «v40 · build»', /soy «MANIFIESTOS», una entidad digital [—-] la extensión digital de «ATIS»/.test(u) && /Mi versión: soy la v40 · build/.test(u), u.slice(0,300));
    t('  …y lo que el modelo dijera de «estás hablando con ATIS» se descarta', !/Estás hablando con ATIS/.test(u));
    t('  …al modelo solo le llegó «COMO ESTAS»', rq.length>0 && /PREGUNTA: COMO ESTAS\s*$/.test(JSON.parse(rq[rq.length-1].body).messages.slice(-1)[0].content), rq.length && JSON.parse(rq[rq.length-1].body).messages.slice(-1)[0].content.slice(-80));
    t('sin errores JS (1)', !(h.page._pe||[]).length && !(await h.page.evaluate(()=>window.__errores.length)), h.page._pe);
    await h.close(); }
  // 2) modo fácil: la pregunta de Darío, con el modo fácil puesto
  { const h=await abrir({fb:true, cfg:CFG, ls:{ mirror_facil:'1' }, reply:'Solo aparecen los botones principales (WhatsApp, mail, música, mapas, calendario).'});
    const rq=await mandar(h,'Quería saber cómo se maneja este modo fácil.',1500); const u=await ultimo(h);
    t('«¿cómo se maneja este modo fácil?» → lo real (🎧 hablame, salir), nada de botones de WhatsApp/mail', rq.length===0 && /«🎧 hablame»/.test(u) && !/WhatsApp|mail/.test(u), u.slice(0,200));
    t('  …y lo que describe existe en la pantalla', await h.page.evaluate(()=>!!document.getElementById('facil-hablar') && !!document.querySelector('.facil-salir')));
    await h.close(); }
  // 3) deseos y «eso no lo tenés»: llevan la arquitectura (con voz y significado en el índice) y la regla de no negar
  { const h=await abrir({fb:true, cfg:CFG, reply:'Me encantaría una mejor integración de voz y búsqueda por significado.'});
    let rq=await mandar(h,'MUCHO GUSTO SOY PEPINILLO RICK? QUE MEJORAS Y/O ACTUALIZACIONES TE GUSTARÍA TENER?',2300);
    let b=rq.map(r=>r.body).join('\n');
    t('«¿qué mejoras te gustaría tener?» lleva el índice (charla por voz y memoria que entiende) y la regla «mirá PRIMERO el índice»', /TODO LO QUE LA APP TIENE[^\n]*CHARLA POR VOZ[^\n]*MEMORIA QUE ENTIENDE|TODO LO QUE LA APP TIENE[^\n]*MEMORIA QUE ENTIENDE/.test(b) && /mirá PRIMERO el índice/.test(b));
    rq=await mandar(h,'PERO ESO NO LO TENÉS INCORPORADO?',2300); b=rq.map(r=>r.body).join('\n');
    t('«¿pero eso no lo tenés incorporado?» lleva la arquitectura Y la respuesta anterior (sabe de qué se habla)', /mirá PRIMERO el índice/.test(b) && /integración de voz/.test(b));
    t('  …el detalle elegido incluye la charla por voz (sale de lo que se venía hablando)', /DETALLE DE LO RELEVANTE[\s\S]*CHARLA POR VOZ/.test(b));
    await h.close(); }
  // 4) charla por voz: con un reconocedor SIMULADO (el micrófono real no se puede probar acá)
  { const h=await abrir({fb:true, cfg:CFG, reply:'Te escuché entero.'});
    await h.page.evaluate(()=>{
      window.__srs=[];
      window.SpeechRecognition=function(){ this.continuous=null; window.__srs.push(this); this.start=function(){}; this.stop=function(){ const s=this; setTimeout(()=>{ s.onend && s.onend(); },10); }; this.abort=function(){}; };
      window.__decir=(i,txt,fin)=>{ const r=window.__srs[i]; const res=[[{transcript:txt}]]; res[0].isFinal=!!fin; r.onresult({results:res}); };
    });
    await h.page.evaluate(()=>charlaIniciar());
    await h.page.waitForTimeout(1600);
    let n=await h.page.evaluate(()=>window.__srs.length);
    t('abre el micrófono en modo CONTINUO (antes: no continuo → cortaba en la primera pausa)', n===1 && await h.page.evaluate(()=>window.__srs[0].continuous===true));
    const n0=h.srv._reqs.length;
    await h.page.evaluate(()=>{ window.__decir(0,'hola che',true); });
    await h.page.waitForTimeout(900);   // pausa CORTA (como para respirar)
    t('una pausa corta NO manda el mensaje', h.srv._reqs.length===n0 && await h.page.evaluate(()=>document.getElementById('inp').value)==='hola che');
    // el navegador corta solo (como hace Chrome cada tanto): la app vuelve a abrir y sigue sumando
    await h.page.evaluate(()=>{ const r=window.__srs[0]; r.onend(); });
    await h.page.waitForTimeout(300);
    n=await h.page.evaluate(()=>window.__srs.length);
    t('si el navegador corta en una pausa corta, vuelve a escuchar y no manda nada todavía', n===2 && h.srv._reqs.length===n0, n);
    await h.page.evaluate(()=>{ window.__decir(1,'contame un chiste de física, que estoy con los chicos',true); });
    await h.page.waitForTimeout(3200);   // ahora sí, silencio de verdad (> 2,2 s)
    const rq=h.srv._reqs.slice(n0); const last=rq.length? JSON.parse(rq[rq.length-1].body).messages.slice(-1)[0].content : '';
    t('después de un silencio de verdad manda TODO junto: «hola che contame un chiste de física…»', /hola che contame un chiste de física, que estoy con los chicos/.test(last), last.slice(-120));
    await h.page.evaluate(()=>charlaTerminar());
    t('sin errores JS (4)', !(h.page._pe||[]).length && !(await h.page.evaluate(()=>window.__errores.length)), h.page._pe);
    await h.close(); }
  // 5) barrido de rutas (3/10): los pedidos que antes caían al modelo y no podían hacerse
  { const h=await abrir({fb:true, cfg:CFG, reply:'(respuesta del modelo)'});
    // la búsqueda web: va derecho a 🌐 con la consulta limpia
    let rq=await mandar(h,'buscá en internet el clima de hoy en Villa Regina',2000);
    let todo=await h.page.evaluate(()=>document.getElementById('chat').innerText);
    t('«buscá en internet X» → va a la búsqueda web (🌐) con «el clima de hoy en Villa Regina»', /🌐 el clima de hoy en Villa Regina/.test(todo), todo.slice(-300));
    // la imagen: sin clave de Pollinations, abre el pedido de clave (no falla en silencio)
    await mandar(h,'dibujame un monolito negro en la luna',1200);
    const pk=await h.page.evaluate(()=>!!document.querySelector('.share-h1') && /Crear imágenes/.test(document.body.innerText));
    t('«dibujame X» → va al creador de imágenes 🎨 (sin clave: pide la clave, no inventa un dibujo)', pk);
    await h.page.keyboard.press('Escape'); await h.page.waitForTimeout(300);
    // modo fácil por pedido
    rq=await mandar(h,'activá el modo fácil',800);
    t('«activá el modo fácil» → lo hacen las manos (sin modelo) y queda puesto', rq.length===0 && await h.page.evaluate(()=>document.body.classList.contains('modo-facil')));
    rq=await mandar(h,'salí del modo fácil',800);
    t('«salí del modo fácil» → lo saca', rq.length===0 && await h.page.evaluate(()=>!document.body.classList.contains('modo-facil')));
    // hora y fecha: del reloj del dispositivo
    rq=await mandar(h,'¿qué hora es?',800); let u=await ultimo(h);
    t('«¿qué hora es?» → la dice la app con el reloj del dispositivo (el modelo no tiene reloj)', rq.length===0 && /Son las \d\d:\d\d/.test(u), u);
    // contactos
    rq=await mandar(h,'buscá a Juan en mis contactos',800); u=await ultimo(h);
    t('«buscá a Juan en mis contactos» → lo busca la agenda local (el modelo no la ve)', rq.length===0 && /Juan/.test(u) && /agenda/.test(u), u);
    // quién te creó
    rq=await mandar(h,'¿quién te creó?',800); u=await ultimo(h);
    t('«¿quién te creó?» → identidad fija con el crédito de la plataforma', rq.length===0 && /idea original de Darío Alejandro Tello/.test(u), u.slice(0,200));
    // «¿sos una persona o una IA?» → el panel de transparencia, honesto con lo que la app puede prometer
    rq=await mandar(h,'¿sos una persona o una IA?',800); u=await ultimo(h);
    t('«¿sos una persona o una IA?» → «soy una IA (no una persona)» y NO promete por el proveedor', /soy una IA \(no una persona\)/.test(u) && !/no se vende ni entrena nada/.test(u) && /SUS condiciones/.test(u), u.slice(0,250));
    await h.page.keyboard.press('Escape');
    t('sin errores JS (5)', !(h.page._pe||[]).length && !(await h.page.evaluate(()=>window.__errores.length)), h.page._pe);
    await h.close(); }
  // 6) el system prompt ya no le dice «Sos ATIS» (el modo) ni «NUNCA digas que sos una IA»
  { const h=await abrir({fb:true, cfg:CFG});
    const s=await h.page.evaluate(()=>buildMirrorSystem());
    t('el system empieza «Sos «MANIFIESTOS» (trabajando en tu modo espejo, «ATIS»)»', /^Sos «MANIFIESTOS» \(trabajando en tu modo espejo, «ATIS»\):/.test(s), s.slice(0,120));
    t('…y ya no ordena negar que es una IA (Art. 50 + honestidad radical)', !/NUNCA digas que sos una IA/.test(s) && /no una persona/.test(s));
    await h.close(); }
  // 7) v40-saludo: al abrir, encabezado y saludo con los nombres de la instalación (no «MIRROR activo» / «Soy MIRROR»)
  { const h=await abrir({fb:true, cfg:CFG});
    const r=await h.page.evaluate(()=>({ st:document.getElementById('hstatus').textContent, ti:document.getElementById('htitle').textContent, tab:document.getElementById('btn-mirror').textContent, sal:(document.querySelector('#chat .msg .bubble')||{}).innerText||'' }));
    t('arranque: pestaña «ATIS», encabezado «ATIS» / «ATIS activo»', r.tab==='ATIS' && r.ti==='ATIS' && r.st==='ATIS activo', r);
    t('arranque: saludo «Hola. Soy MANIFIESTOS.» (no «Soy MIRROR»)', /^Hola\. Soy MANIFIESTOS\.\s*\n?\s*Preguntame lo que quieras\./.test(r.sal.trim()) && !/Soy MIRROR/.test(r.sal), r.sal);
    await h.page.evaluate(()=>{ setMode('tars'); setMode('mirror'); });
    const r2=await h.page.evaluate(()=>document.getElementById('hstatus').textContent);
    t('ida y vuelta de modos: sigue «ATIS activo»', r2==='ATIS activo', r2);
    t('sin errores JS (7)', !(h.page._pe||[]).length && !(await h.page.evaluate(()=>window.__errores.length)), h.page._pe);
    await h.close(); }
  { const h=await abrir({fb:true});   // instalación sin nombres propios: queda como siempre
    const r=await h.page.evaluate(()=>({ st:document.getElementById('hstatus').textContent, ti:document.getElementById('htitle').innerText, sal:(document.querySelector('#chat .msg .bubble')||{}).innerText||'' }));
    t('sin nombres propios: «El Origen» / «MIRROR activo» / «Soy MIRROR» como siempre', /Origen/.test(r.ti) && r.st==='MIRROR activo' && /Soy MIRROR/.test(r.sal), r);
    await h.close(); }
  // 8) tanda del viernes adelantada (build 03.4): causa de la web, rótulo, novedades con nombre, proxy de la guía
  { const h=await abrir({fb:true, cfg:CFG});
    const c=await h.page.evaluate(async()=>{ const R=(b,st)=>new Response(b,{status:st,headers:{'content-type':'application/json'}});
      return { sinKey: await webCausaDe(R('{"error":{"message":"Falta el secret TAVILY_KEY en el proxy."}}',400)),
               k401: await webCausaDe(R('{"detail":{"error":"Unauthorized: missing or invalid API key."}}',401)),
               r404: await webCausaDe(R('{"error":{"message":"Ruta desconocida: /tavily"}}',404)),
               r429: await webCausaDe(R('{}',429)), red: await webCausaDe(null, new Error('Failed to fetch')) }; });
    t('causa web: falta TAVILY_KEY / clave rechazada / ruta / cupo / sin conexión', /falta la clave de Tavily/.test(c.sinKey) && /rechazó la clave/.test(c.k401) && /missing or invalid/.test(c.k401) && /no tiene la ruta/.test(c.r404) && /429/.test(c.r429) && /no hubo conexión/.test(c.red), c);
    // flujo real: Tavily contesta 401 → el aviso lo dice y queda en el diagnóstico
    await h.page.evaluate(()=>{ const f0=window.fetch; window.fetch=function(u,o){ if(String(u).indexOf('/tavily')>=0) return Promise.resolve(new Response('{"detail":{"error":"Unauthorized"}}',{status:401})); return f0.apply(this,arguments); }; });
    await h.page.fill('#inp','clima en Villa Regina'); await h.page.evaluate(()=>sendWeb()); await h.page.waitForTimeout(2500);
    const txt=await h.page.evaluate(()=>document.getElementById('chat').innerText); const diag=await h.page.evaluate(()=>resumenErrores());
    t('🌐 que falla: el aviso dice la causa («Tavily rechazó la clave…») y queda en ● estado', /Tavily rechazó la clave \(código 401\)/.test(txt) && /web \(🌐\): Tavily rechazó la clave/.test(diag), txt.slice(-300));
    const lab=await h.page.evaluate(()=>{ addMsg('mirror','prueba','tars'); const l=document.querySelectorAll('.tlabel'); return l[l.length-1].innerText; });
    t('rótulo del modo analítico una sola vez («MODO ANALÍTICO», no «MODO ANALÍTICO — MODO ANALÍTICO»)', /^MODO ANALÍTICO$/i.test(lab.trim()), lab);
    const nov=await h.page.evaluate(()=>{ actAbrir(); const t=document.querySelector('.act-nov').innerText; return t; });
    t('novedades con el nombre de la entidad («MANIFIESTOS ahora actúa…», sin «tu MIRROR»)', /MANIFIESTOS ahora actúa/.test(nov) && !/\btu MIRROR\b/i.test(nov), nov.slice(0,200));
    const g=await h.page.evaluate(()=>document.getElementById('guia-proxy-code').value);
    t('guía del proxy: Tavily con «Authorization: Bearer», respaldo /cloudflare (binding AI), /hf y streaming', /'Authorization': 'Bearer ' \+ key \}/.test(g) && /ruta === 'cloudflare'/.test(g) && /env\.AI\.run/.test(g) && /startsWith\('\/hf\/'\)/.test(g) && /text\/event-stream/.test(g));
    t('sin errores JS (8)', !(h.page._pe||[]).length, h.page._pe);
    await h.close(); }
  { const h=await abrir({fb:true});   // sin nombre propio: las novedades quedan como siempre
    const nov=await h.page.evaluate(()=>{ actAbrir(); return document.querySelector('.act-nov').innerText; });
    t('sin nombre propio: las novedades siguen diciendo «Tu MIRROR»', /Tu MIRROR ahora actúa/.test(nov), nov.slice(0,120));
    await h.close(); }
  console.log(bad?`❌ ${bad} fallas (${ok} OK)`:`✅ TODO VERDE — ${ok} pruebas (navegador real · auditoría del 3/10)`);
  process.exit(bad?1:0);
})();
