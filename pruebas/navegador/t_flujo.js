const { abrir } = require('./harness');
(async()=>{
 const h = await abrir({ fb:true, wait:2000 });
 const p = h.page; p.on('dialog', d=>d.dismiss().catch(()=>{}));
 const perf = await p.evaluate(()=>{ const n=performance.getEntriesByType('navigation')[0]; return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize/1e6) : null, nodos: document.querySelectorAll('*').length }; });
 console.log('perf', JSON.stringify(perf));
 async function enviar(t){ await p.fill('#inp', t); await p.keyboard.press('Enter'); await p.waitForTimeout(2200); }
 const pasos = [
  ['mirror','hola, ¿cómo andás?'], ['mirror','¿cuál es tu modelo?'], ['mirror','cómo estás? cual es tu modelo?'], ['mirror','mi perra se llama Pochola'],
  ['mirror','agendame pagar la luz el 30 de septiembre'], ['mirror','llamá a Juan'], ['tars','resumime los datos'], ['jurado','examiname sobre metodología'], ['conn','estado'] ];
 for (const [modo, t] of pasos) {
   await p.evaluate(m=>{ try{ setMode(m); }catch(e){ window.__errores.push('setMode:'+e.message); } }, modo);
   await p.waitForTimeout(300);
   await enviar(t);
   const ult = await p.evaluate(()=>{ const ms=[...document.querySelectorAll('.msg')]; return ms.slice(-1).map(m=>m.innerText.replace(/\s+/g,' ').slice(0,160))[0]; });
   console.log(modo.padEnd(7), '«'+t+'» →', ult);
 }
 // modo fácil + charla
 await p.evaluate(()=>facilToggle()); await p.waitForTimeout(400);
 const fac = await p.evaluate(()=>({ clase: document.body.classList.contains('modo-facil'), caja: !!document.getElementById('facil-caja'), hablame: !!document.getElementById('facil-hablar') }));
 console.log('facil', JSON.stringify(fac));
 await p.evaluate(()=>facilToggle());
 // actualizar
 await p.evaluate(()=>actAbrir()); await p.waitForTimeout(2500);
 console.log('act:', await p.evaluate(()=>{ const m=document.getElementById('act-modal'); return m ? m.innerText.replace(/\s+/g,' ').slice(0,300) : 'sin modal'; }));
 console.log('reqs al proxy:', h.srv._reqs.length, 'errores:', JSON.stringify(await p.evaluate(()=>window.__errores)), JSON.stringify(p._pe||[]), JSON.stringify((p._ce||[]).filter(x=>!/ERR_TUNNEL|404|net::/.test(x)).slice(0,10)));
 await h.close();
})();
