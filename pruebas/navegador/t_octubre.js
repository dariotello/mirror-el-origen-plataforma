// t_octubre.js — la tanda del 2/10/2026 en navegador real (Chromium completo, /?app).
// Uso: FILE=ruta/a/PLATAFORMA/index.html node t_octubre.js
const { abrir } = require('./harness');
let ok=0,bad=0; const t=(m,c,x)=>{ if(c){ok++;console.log('  ✅ '+m);} else {bad++;console.log('  ❌ '+m+(x!==undefined?' → '+JSON.stringify(x).slice(0,400):''));} };
async function mandar(h, q, ms){ const n0=h.srv._reqs.length; await h.page.fill('#inp',q); await h.page.keyboard.press('Enter'); await h.page.waitForTimeout(ms||2300); return h.srv._reqs.slice(n0); }
(async()=>{
  // 1) autoconocimiento sin nombrar la app
  { const h=await abrir({fb:true});
    // v40-hechos: «¿dónde guardás lo mío?» y «cual es ese motor de respaldo?» SOLAS ya no van al modelo: las contesta la app (ver bloque 5)
    // v40-hechos2 (3/10): «como estas…que versión sos…donde guardo lo mío» ahora son TODOS datos fijos (bloque 5 y t_auditoria1003)
    for (const q of ['¿tenés límites?','¿qué sabés hacer?','¿tenés límites y qué guardás de mí?']){
      const rq=await mandar(h,q); const b=rq.map(r=>r.body).join('\n');
      t('«'+q+'» lleva la arquitectura real', /TODO LO QUE LA APP TIENE \(índice/.test(b), rq.map(r=>r.url));
      if (/guard|límites/.test(q)) t('  …con el detalle «DÓNDE GUARDO LO TUYO»', /DETALLE DE LO RELEVANTE[\s\S]*DÓNDE GUARDO LO TUYO/.test(b));
      if (/respaldo/.test(q)) t('  …con el detalle «MOTOR DE RESPALDO» (Cloudflare Workers AI)', /DETALLE DE LO RELEVANTE[\s\S]*MOTOR DE RESPALDO[^\n]*Cloudflare Workers AI/.test(b));
    }
    { await mandar(h,'todo bien manifiestos? por que la v5.0 es mejor que la v4.5?'); const uv=await h.page.evaluate(()=>{ const m=document.querySelectorAll('#chat .msg'); return m[m.length-1].innerText; });
      t('«v5.0 vs v4.5»: la app dice de frente que de esas no tiene información (dato fijo, v40-hechos)', /De «v5\.0» y de «v4\.5» no tengo información/.test(uv), uv.slice(0,200)); }
    const rq=await mandar(h,'qué lindo día hace hoy'); t('charla común NO lleva la arquitectura', !/TODO LO QUE LA APP TIENE \(índice/.test(rq.map(r=>r.body).join('\n')));
    t('sin errores JS (1)', !(h.page._pe||[]).length && !(await h.page.evaluate(()=>window.__errores.length)), h.page._pe);
    await h.close(); }
  // 2) el principal se llena (pide 45 s) → contesta el respaldo, más frío, con orden de no rellenar, y se ve el chip
  { const h=await abrir({fb:false});
    await h.page.route(/\/proxy\/groq/, r => r.fulfill({ status:429, contentType:'application/json', headers:{'access-control-allow-origin':'*'}, body: JSON.stringify({ error:{ message:'Rate limit reached for model openai/gpt-oss-120b on tokens per minute (TPM). Please try again in 45s.', type:'tokens', code:'rate_limit_exceeded' } }) }));
    const rq=await mandar(h,'contame algo lindo', 3500);
    const cf=rq.filter(r=>/\/cloudflare/.test(r.url));
    t('cae al respaldo de Cloudflare', cf.length>=1, rq.map(r=>r.url));
    if (cf.length){ const b=JSON.parse(cf[0].body); const sys=(b.messages&&b.messages[0]&&b.messages[0].content)||'';
      t('  el respaldo recibe la orden «MODO RESPALDO»', /MODO RESPALDO/.test(sys));
      t('  y temperatura ≤ 0,35', b.temperature<=0.35, b.temperature); }
    const chip=await h.page.evaluate(()=>Array.from(document.querySelectorAll('.proc-chip')).map(e=>e.textContent));
    t('se ve el chip «↺ respaldo (Cloudflare)»', chip.some(c=>/↺ respaldo \(Cloudflare\)/.test(c)), chip);
    // sin base de memoria: la nota lo dice de frente
    const rq2=await mandar(h,'¿tenés memoria de lo que hablamos?', 3500);
    t('sin Firebase, la nota de memoria dice que NO queda guardada', /NO está configurada/.test(rq2.map(r=>r.body).join('\n')));
    t('sin errores JS (2)', !(h.page._pe||[]).length && !(await h.page.evaluate(()=>window.__errores.length)), h.page._pe);
    await h.close(); }
  // 3) agendar: la fecha al calendario, no al título
  { const h=await abrir({fb:true});
    await mandar(h,'Agendame pagar la luz el 15 de diciembr', 1500);   // v40-audit9: el caso EXACTO de la auditoría (le faltó la e)
    const card=await h.page.evaluate(()=>document.body.innerText);
    t('la tarjeta dice «Agendar: pagar la luz» (sin la fecha en el título)', /Agendar: pagar la luz(?! el)/.test(card), (card.match(/Agendar:[^\n]*/)||[])[0]);
    t('  y «Para el 15/12»', /Para el 15\/12/.test(card));
    const href=await h.page.evaluate(()=>{ const a=Array.from(document.querySelectorAll('a')).find(x=>/calendar\.google\.com/.test(x.href)); return a?a.href:''; });
    t('  el calendario abre con título limpio y en el 15/12', /text=pagar%20la%20luz&dates=\d{4}1215\//.test(href), href);
    const tareas=await h.page.evaluate(()=>JSON.parse(localStorage.getItem('mirror_tareas')||'[]'));
    t('  la tarea quedó «pagar la luz» con fecha', tareas.some(x=>x.titulo==='pagar la luz' && /-12-15$/.test(x.fecha)), tareas);
    t('sin errores JS (3)', !(h.page._pe||[]).length && !(await h.page.evaluate(()=>window.__errores.length)), h.page._pe);
    await h.close(); }
  // 4) «¿qué tiene de bueno la v40?» con el modelo vendiendo encuestas como nuevas
  { const h=await abrir({fb:true, reply:'La v40 trae varias cosas:\n• Actúa en varios pasos: busca, prepara y te deja las tarjetas.\n• Memoria que entiende por significado, en tu dispositivo.\n• Crear encuestas nuevas desde el chat.\n• Charla por voz y modo fácil.'});
    // v40-hechos2 (3/10): «¿qué tiene de bueno la v40?» ya lo contesta la APP con la lista real: ni encuestas ni nada que el modelo invente
    const rqv=await mandar(h,'¿qué tiene de bueno la v40?', 2500);
    const txt=await h.page.evaluate(()=>{ const m=document.querySelectorAll('#chat .msg'); return m.length? m[m.length-1].innerText : ''; });
    t('la respuesta ya no vende las encuestas como nuevas', !/encuestas/i.test(txt), txt);
    t('  la contesta la app, sin pasar por el modelo', rqv.length===0);
    t('  lo real sigue ahí', /actúa en varios pasos/i.test(txt) && /Mi versión: soy la v40/.test(txt));
    // y el corrector de novedades sigue de red, para una repregunta que sí va al modelo
    await mandar(h,'¿y cuáles son esas ventajas?', 2500);
    const txt2=await h.page.evaluate(()=>{ const m=document.querySelectorAll('#chat .msg'); return m.length? m[m.length-1].innerText : ''; });
    t('  repregunta al modelo: si cuela «encuestas» como nuevas, se saca y se avisa al pie', !/Crear encuestas nuevas/.test(txt2) && /Nota de la app: saqué las encuestas de lo nuevo/.test(txt2), txt2.slice(0,300));
    t('sin errores JS (4)', !(h.page._pe||[]).length && !(await h.page.evaluate(()=>window.__errores.length)), h.page._pe);
    await h.close(); }
  // 5) v40-hechos (en vivo .2, 11:04): las 3 preguntas juntas → contesta la APP, sin pasar por el modelo; con «y agendame» → datos + tarjeta
  { const h=await abrir({fb:true, reply:'Guardás tus datos en el almacenamiento local cifrado. El motor de respaldo guarda copias de seguridad en la nube. La v5.0 incorpora mejoras.'});
    const Q3='¿Dónde guardo lo mío?, ¿Cuál es tu motor de respaldo?, ¿Por qué la v5.0 es mejor que la v4.5?';
    const rq=await mandar(h,Q3,1500);
    const txt=await h.page.evaluate(()=>{ const m=document.querySelectorAll('#chat .msg'); return m.length? m[m.length-1].innerText : ''; });
    t('3 preguntas juntas: NO se llama al modelo (contesta la app)', rq.length===0, rq.map(r=>r.url));
    t('  dice Firebase en la nube, Cloudflare Workers AI y «de v5.0 y de v4.5 no tengo información»', /TU Firebase \(en la nube de Google/.test(txt) && /Cloudflare Workers AI/.test(txt) && /no tengo información/.test(txt), txt.slice(0,300));
    t('  nada de «cifrado» ni «copias de seguridad en la nube» ni «la v5.0 incorpora»', !/cifrad|copias de seguridad en la nube|incorpora/.test(txt));
    await mandar(h,Q3+' y Agendame pagar la luz el 15 de diciembre',2500);
    const todo=await h.page.evaluate(()=>document.getElementById('chat').innerText);
    // el motor simulado no llama herramientas: se verifica que los datos salen y que el agente recibe SOLO el pedido
    const bAg=h.srv._reqs.slice(-3).map(r=>r.body).join('\n');
    t('con «y agendame…»: salen los datos de la app y al motor le llega solo «Agendame pagar la luz…»', (todo.match(/Dónde está lo tuyo/g)||[]).length>=2 && /Agendame pagar la luz el 15 de diciembre/.test(bAg) && !/Dónde guardo lo mío/.test(bAg.split('"role":"user"').pop()), bAg.slice(-300));
    t('  y nadie pide «dónde querés guardar tus archivos»', !/d[oó]nde quer[eé]s guardar/i.test(todo));
    await mandar(h,'como estas manifiestos? por que la v5.0 es mejor que la v4.5? tenés motor de respaldo?',2500);
    const ult=await h.page.evaluate(()=>{ const m=document.querySelectorAll('#chat .msg'); return m.length? m[m.length-1].innerText : ''; });
    t('charla + datos: arriba los datos de la app; de lo que inventó el modelo sobre esos temas no queda nada', /El motor de respaldo:/.test(ult) && !/copias de seguridad en la nube|incorpora mejoras/.test(ult), ult.slice(0,400));
    t('sin errores JS (5)', !(h.page._pe||[]).length && !(await h.page.evaluate(()=>window.__errores.length)), h.page._pe);
    await h.close(); }
  // 6) v40-letra: el texto en vivo y la respuesta final tienen la MISMA letra (no salta)
  { const h=await abrir({fb:true});
    const r=await h.page.evaluate(()=>{ showTyping('mirror'); pintarStreamParcial('hola, esto llega en vivo'); const s=getComputedStyle(document.getElementById('typing-stream')); const a={f:s.fontSize,fam:s.fontFamily,w:s.fontWeight}; removeTyping(); addMsg('mirror','hola, esto llega en vivo'); const m=document.querySelectorAll('#chat .msg .bubble'); const b=getComputedStyle(m[m.length-1]); return {vivo:a, final:{f:b.fontSize,fam:b.fontFamily,w:b.fontWeight}}; });
    t('letra en vivo = letra final (tamaño, familia y peso)', r.vivo.f===r.final.f && r.vivo.fam===r.final.fam && r.vivo.w===r.final.w, r);
    await h.page.evaluate(()=>document.body.classList.add('modo-facil'));
    const r2=await h.page.evaluate(()=>{ showTyping('mirror'); pintarStreamParcial('x'); const a=getComputedStyle(document.getElementById('typing-stream')).fontSize; removeTyping(); addMsg('mirror','x'); const m=document.querySelectorAll('#chat .msg .bubble'); return {vivo:a, final:getComputedStyle(m[m.length-1]).fontSize}; });
    t('  también en modo fácil', r2.vivo===r2.final, r2);
    await h.close(); }
  console.log(bad?`❌ ${bad} fallas (${ok} OK)`:`✅ TODO VERDE — ${ok} pruebas (navegador real · tanda 2/10)`);
  process.exit(bad?1:0);
})();
