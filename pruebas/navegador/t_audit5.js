const { abrir } = require('./harness');
let ok=0, bad=0; const t=(m,c,x)=>{ if(c){ok++; console.log('  ✅ '+m);} else {bad++; console.log('  ❌ '+m+(x!==undefined?' → '+JSON.stringify(x):''));} };
(async()=>{
 // A) el selector de voz entra en pantalla y se cierra de 3 formas
 for (const vp of [{width:1366,height:640},{width:1366,height:520},{width:375,height:667},{width:360,height:560}]) {
  const h = await abrir({ viewport: vp }); const p=h.page;
  const r = await p.evaluate(async()=>{ abrirSelectorVoz(); await new Promise(s=>setTimeout(s,400));
    const m=document.querySelector('#voz-modal .modal').getBoundingClientRect(); const x=document.querySelector('#voz-modal .modal-x').getBoundingClientRect();
    return { top:m.top, bottom:m.bottom, vh:innerHeight, xVis: x.top>=0 && x.bottom<=innerHeight && x.right<=innerWidth }; });
  t(`[${vp.width}x${vp.height}] el selector de voz entra entero en la pantalla`, r.top>=0 && r.bottom<=r.vh, r);
  t(`[${vp.width}x${vp.height}] la ✕ se ve al abrir`, r.xVis, r);
  // «cerrar» de abajo alcanzable scrolleando la caja
  const alc = await p.evaluate(async()=>{ const m=document.querySelector('#voz-modal .modal'); m.scrollTop=1e6; await new Promise(s=>setTimeout(s,100)); const b=[...m.querySelectorAll('button')].find(x=>x.textContent.trim()==='cerrar').getBoundingClientRect(); return b.top>=0 && b.bottom<=innerHeight; });
  t(`[${vp.width}x${vp.height}] el «cerrar» de abajo se alcanza scrolleando`, alc);
  await p.click('#voz-modal .modal-x'); await p.waitForTimeout(200);
  t(`[${vp.width}x${vp.height}] la ✕ cierra`, !(await p.evaluate(()=>document.getElementById('voz-modal').classList.contains('visible'))));
  await p.evaluate(()=>abrirSelectorVoz()); await p.mouse.click(3, 3); await p.waitForTimeout(200);
  t(`[${vp.width}x${vp.height}] tocar el fondo cierra`, !(await p.evaluate(()=>document.getElementById('voz-modal').classList.contains('visible'))));
  await p.evaluate(()=>abrirSelectorVoz()); await p.click('#voz-modal h3'); await p.waitForTimeout(150);
  t(`[${vp.width}x${vp.height}] tocar ADENTRO no cierra`, await p.evaluate(()=>document.getElementById('voz-modal').classList.contains('visible')));
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  t(`[${vp.width}x${vp.height}] Esc cierra`, !(await p.evaluate(()=>document.getElementById('voz-modal').classList.contains('visible'))));
  await h.close();
 }
 // B) Esc cierra TODAS las capas
 { const h = await abrir({ fb:true }); const p=h.page; p.on('dialog', d=>d.dismiss().catch(()=>{}));
   const cap = { abrirMemoria:'mem-modal', anaAbrir:'ana-modal', abrirSelectorVoz:'voz-modal', abrirAgenda:'agenda-modal', abrirCompartir:'share-ov', encAbrir:'enc-modal', cebAbrir:'ceb-modal', cumpliAbrir:'cumpli-modal', abrirLegal:'legal-ov', semAbrir:'sem-modal', actAbrir:'act-modal', pieOrdenarAbrir:'pieord-modal' };
   await p.evaluate(()=>{ window.__borro=0; Object.keys(window).filter(k=>/^(clearMem|borrarTodo\w*|memBorrar\w*|borrarMemoria\w*|borrarRecuerdo\w*)$/i.test(k) && typeof window[k]==='function').forEach(k=>{ const f=window[k]; window[k]=function(){ window.__borro++; return f.apply(this,arguments); }; }); });
   for (const [fn,id] of Object.entries(cap)) {
     await p.evaluate(fn=>{ try{ window[fn](); }catch(e){} }, fn); await p.waitForTimeout(350);
     const abierto = async()=>p.evaluate(id=>{ const e=document.getElementById(id); if(!e) return false; const cs=getComputedStyle(e); return cs.display!=='none' && (e.classList.contains('modal-overlay') ? e.classList.contains('visible') : true); }, id);
     const a1 = await abierto(); await p.keyboard.press('Escape'); await p.waitForTimeout(300); const a2 = await abierto();
     t(`Esc cierra ${id} (${fn})`, a1 && !a2, {a1,a2});
   }
   // memoria: Esc NO borra (el botón cancel es «borrar todo»)
   const borro = await p.evaluate(()=>window.__borro); t('Esc en memoria no dispara borrado', borro===0);
   t('sin errores JS en el recorrido', !(p._pe||[]).length && !(await p.evaluate(()=>window.__errores.length)), [p._pe, await p.evaluate(()=>window.__errores)]);
   await h.close(); }
 // C) voz elegida «Online» con la red bloqueada → sigue con una local y avisa UNA vez
 for (const modo of ['error','mudo']) {
  const h = await abrir({ ls:{ mirror_voz_mirror:'Microsoft Elena Online (Natural) - Spanish (Argentina)', mirror_facil:'1', __redBloqueada:'1', __modoFalla: modo } }); const p=h.page;
  await p.click('#inp'); await p.keyboard.type('hola, como andas?'); await p.keyboard.press('Enter');
  await p.waitForTimeout(modo==='mudo' ? 9000 : 2500);
  const r1 = await p.evaluate(()=>({ voces: window.__hablaVoz, habla: window.__habla, msgs: [...document.querySelectorAll('.msg')].map(m=>m.innerText).filter(x=>/🔈/.test(x)), diag: (document.getElementById('voz-diag')||{}).textContent }));
  const ultVoz = r1.voces[r1.voces.length-1];
  t(`[${modo}] la respuesta se relee con una voz LOCAL (la misma que usará después)`, /Pablo/.test(ultVoz) && r1.habla[r1.habla.length-1].includes('Hola, todo bien'), r1.voces);
  t(`[${modo}] avisa en criollo qué voz falló y con cuál sigue`, r1.msgs.length===1 && /Elena Online/.test(r1.msgs[0]) && /Sigo leyendo con/.test(r1.msgs[0]), r1.msgs);
  t(`[${modo}] el diagnóstico del ▾ queda anotado`, /✗ «Microsoft Elena Online/.test(r1.diag||''), r1.diag);
  await p.fill('#inp','otra pregunta'); await p.keyboard.press('Enter'); await p.waitForTimeout(2500);
  const r2 = await p.evaluate(()=>({ voces: window.__hablaVoz, avisos: [...document.querySelectorAll('.msg')].map(m=>m.innerText).filter(x=>/🔈/.test(x)).length }));
  const nuevas = r2.voces.slice(r1.voces.length);
  t(`[${modo}] la 2ª respuesta ya sale directo con la local (no reintenta la rota)`, nuevas.length && nuevas.every(v=>!/Online/.test(v)), nuevas);
  t(`[${modo}] no repite el aviso`, r2.avisos===1, r2.avisos);
  t(`[${modo}] la elección guardada NO se borra (mañana con otra red puede andar)`, await p.evaluate(()=>localStorage.getItem('mirror_voz_mirror'))==='Microsoft Elena Online (Natural) - Spanish (Argentina)');
  await h.close();
 }
 // D) con la voz sana, nada cambia (no hay aviso, suena la elegida)
 { const h = await abrir({ ls:{ mirror_voz_mirror:'Microsoft Elena Online (Natural) - Spanish (Argentina)' } }); const p=h.page;
   await p.click('#inp'); await p.keyboard.type('hola'); await p.keyboard.press('Enter'); await p.waitForTimeout(2500);
   const r = await p.evaluate(()=>({ voces: window.__hablaVoz, avisos: [...document.querySelectorAll('.msg')].map(m=>m.innerText).filter(x=>/🔈/.test(x)).length }));
   t('voz de red SANA: suena la elegida y no hay aviso', r.voces.slice(1).every(v=>/Elena Online/.test(v)) && r.avisos===0, r);
   // ▶ probar informa
   await p.evaluate(()=>{ abrirSelectorVoz(); probarVoz('Microsoft Pablo - Spanish (Spain)','mirror'); }); await p.waitForTimeout(300);
   t('▶ probar dice «suena bien»', /✓ «Microsoft Pablo.*suena bien/.test(await p.evaluate(()=>document.getElementById('voz-diag').textContent)));
   await h.close(); }
 // E) badge / build
 { const h = await abrir({}); const p=h.page;
   const r = await p.evaluate(()=>({ v: PLATFORM_VERSION, b: APP_BUILD, pie: (document.querySelector('[data-ver]')||{}).textContent, n0: APP_NOVEDADES[0] }));
   t('badge v40 en el pie', r.v==='v40' && r.pie==='v40', r); t('build = la del archivo y ≥ 2026-09-25.7 (v40-octubre: sube en cada entrega)', r.b===/const APP_BUILD = '([^']+)'/.exec(require('fs').readFileSync(process.env.FILE,'utf8'))[1] && r.b>='2026-09-25.7', r.b); t('1ª novedad = Generación v40', /^✦ Generación v40/.test(r.n0));
   await h.close(); }
 console.log(bad ? `\n❌ ${bad} FALLAS · ${ok} OK` : `\n✅ TODO VERDE — ${ok} pruebas (navegador real)`);
 process.exit(bad?1:0);
})();
