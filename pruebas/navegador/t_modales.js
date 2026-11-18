const { abrir } = require('./harness');
const ABRIDORES = ['abrirMemoria','anaAbrir','showDocs','abrirModalInforme','abrirSelectorVoz','abrirAgenda','abrirCompartir','encAbrir','cebAbrir','cumpliAbrir','abrirLegal','semAbrir','actAbrir','pieOrdenarAbrir','openPres'];
const VIEWS = JSON.parse(process.env.VIEWS || '[{"width":1366,"height":640},{"width":375,"height":667}]');
(async()=>{
 for (const vp of VIEWS) {
  const h = await abrir({ viewport: vp, fb: true });
  const p = h.page; p.on('dialog', d => d.dismiss().catch(()=>{}));
  console.log('\n=== viewport', vp.width+'x'+vp.height);
  for (const fn of ABRIDORES) {
    const res = await p.evaluate(async (fn) => {
      const antes = new Set();
      const capas = () => Array.from(document.querySelectorAll('body *')).filter(el => {
        const cs = getComputedStyle(el); if (cs.position !== 'fixed' || cs.display==='none' || cs.visibility==='hidden' || +cs.opacity===0) return false;
        const r = el.getBoundingClientRect(); return r.width > innerWidth*0.6 && r.height > innerHeight*0.6 && (parseInt(cs.zIndex)||0) >= 50;
      });
      capas().forEach(e=>antes.add(e));
      if (typeof window[fn] !== 'function') return { fn, err: 'no existe' };
      try { const r = window[fn](); if (r && r.then) await Promise.race([r, new Promise(s=>setTimeout(s,1500))]); } catch(e) { return { fn, err: 'throw: ' + e.message }; }
      await new Promise(s=>setTimeout(s,500));
      const nuevas = capas().filter(e=>!antes.has(e) && !['boot','app','bg'].includes(e.id));
      if (!nuevas.length) return { fn, capa: null };
      const c = nuevas[nuevas.length-1];
      const RE = /^(✕|×|x|cerrar|cerrar ✕|volver|listo|salir|ok|entendido|cancelar|✕ cerrar|◂ volver|← volver|close)(?![a-záéíóúñ])/i;
      const bots = Array.from(c.querySelectorAll('button, [onclick], a')).filter(b => { const t=(b.innerText||b.textContent||'').trim(); return RE.test(t) || /cerrar|close/i.test(b.getAttribute('aria-label')||'') || /cerrar|close/i.test(b.getAttribute('title')||''); });
      const vis = bots.filter(b => { const r=b.getBoundingClientRect(); return r.height>0 && r.top>=0 && r.bottom<=innerHeight && r.left>=0 && r.right<=innerWidth; });
      // ¿se puede llegar scrolleando? 
      let alcanzable = false;
      for (const b of bots) { let el=b.parentElement; while (el && el!==document.body) { const cs=getComputedStyle(el); if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight>el.clientHeight+2) { alcanzable=true; break; } el=el.parentElement; } }
      const inner = c.firstElementChild ? c.firstElementChild.getBoundingClientRect() : c.getBoundingClientRect();
      return { fn, capa: (c.id||c.className||c.tagName).toString().slice(0,40), cierres: bots.map(b=>(b.innerText||'').trim().slice(0,20)), visibles: vis.length, alcanzable, cajaTop: Math.round(inner.top), cajaBottom: Math.round(inner.bottom), vh: innerHeight };
    }, fn);
    // Esc
    let escCierra = null;
    if (res.capa) {
      await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      escCierra = await p.evaluate(() => !Array.from(document.querySelectorAll('body *')).some(el => { const cs=getComputedStyle(el); if (cs.position!=='fixed'||cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0) return false; const r=el.getBoundingClientRect(); return r.width>innerWidth*0.6&&r.height>innerHeight*0.6&&(parseInt(cs.zIndex)||0)>=50 && !['boot','app','bg'].includes(el.id); }));
      // limpiar a la fuerza para seguir
      await p.evaluate(() => { document.querySelectorAll('.modal-overlay.visible').forEach(m=>m.classList.remove('visible')); ['sem-modal','act-modal'].forEach(id=>{const m=document.getElementById(id); if(m) m.remove();}); document.querySelectorAll('.v40-modal').forEach(m=>m.remove()); try{ if (typeof closePres==='function') closePres(); }catch(e){} try{ if (typeof cerrarLegal==='function') cerrarLegal(); }catch(e){} });
      await p.evaluate(() => { Array.from(document.querySelectorAll('body *')).forEach(el => { const cs=getComputedStyle(el); if (cs.position==='fixed' && cs.display!=='none' && (parseInt(cs.zIndex)||0)>=50) { const r=el.getBoundingClientRect(); if (r.width>innerWidth*0.6&&r.height>innerHeight*0.6 && !['boot','app','bg'].includes(el.id)) { el.style.display='none'; el.dataset.forzado='1'; } } }); });
    }
    const ok = !res.capa ? '' : ((res.visibles>0 ? 'OK ' : (res.alcanzable ? 'scroll ' : '❌SIN-CIERRE-VISIBLE ')) + (escCierra ? 'Esc✓' : 'Esc✗'));
    console.log(ok.padEnd(28), JSON.stringify(res));
  }
  const errs = await p.evaluate(()=>window.__errores); console.log('errores JS:', JSON.stringify(errs), 'pageerror:', JSON.stringify(p._pe||[]));
  await h.close();
 }
})();
