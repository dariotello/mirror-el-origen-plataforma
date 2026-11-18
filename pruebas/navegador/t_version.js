const { abrir } = require('./harness');
let ok=0,bad=0; const t=(m,c,x)=>{ if(c){ok++;console.log('  ✅ '+m);} else {bad++;console.log('  ❌ '+m+(x!==undefined?' → '+JSON.stringify(x).slice(0,300):''));} };
(async()=>{ const h=await abrir({fb:true}); const p=h.page;
 const casos=[['COMO ESTAS MANIFIESTOS! QUE TIENE DE BUENA LA VERSION 40 DE MIRROR?',true],['ALGUNA NOVEDAD?',true],['POR QUE V40 ES MEJOR QUE LA v38?',true],['CUALES SON ESAS VENTAJAS ADICIONALES?',true],['SE ACTUALIZA SOLA?',true],
  ['contame un chiste',false],['y otro más',true], /* v40-1029 (auditores 23/10): «contame un chiste» ya no carga la lista de novedades; la repregunta con «y…» sí */['qué lindo día hace',false]];
 const BLD=/const APP_BUILD = '([^']+)'/.exec(require('fs').readFileSync(process.env.FILE,'utf8'))[1];
 for (const [q,esp] of casos){ const n0=h.srv._reqs.length; await p.fill('#inp',q); await p.keyboard.press('Enter'); await p.waitForTimeout(2300);
   // v40-cupo2 (3/10): la versión propia ahora la contesta la APP con la lista real (dato fijo) — eso también es «llevar la fuente de verdad»
   const ultimo=await p.evaluate(()=>{ const m=document.querySelectorAll('#chat .msg'); return m.length? m[m.length-1].innerText : ''; });
   const fija=/Mi versión: soy la v40 · build/.test(ultimo);
   const bodies=h.srv._reqs.slice(n0).map(r=>r.body).join('\n'); const tiene=fija || /VERSIÓN Y NOVEDADES DE ESTA APP/.test(bodies);
   t('«'+q+'» '+(esp?'lleva':'NO lleva')+' la fuente de verdad de la versión'+(fija?' (contestó la app, fija)':''), tiene===esp, {tiene, n:h.srv._reqs.length-n0});
   if (fija && q.startsWith('SE ACTUALIZA')) { t('  ...dato fijo: busca sola y avisa + la lista real + la build', /busco sola al abrir y cada 6 horas/i.test(ultimo) && /Generación v40/.test(ultimo) && ultimo.indexOf('build '+BLD)>=0, ultimo.slice(0,300)); }
   else if (tiene && q.startsWith('SE ACTUALIZA')) { t('  ...y dice que SÍ busca sola y avisa + la lista real', /SÍ BUSCA SOLA Y AVISA/.test(bodies) && /Generación v40/.test(bodies) && bodies.indexOf('build ' + /const APP_BUILD = '([^']+)'/.exec(require('fs').readFileSync(process.env.FILE,'utf8'))[1]) >= 0 /* v40-octubre: la build que diga el archivo, no una fija */); }
 }
 t('sin errores JS', !(p._pe||[]).length && !(await p.evaluate(()=>window.__errores.length)));
 console.log(bad?`❌ ${bad} fallas`:`✅ ${ok} OK`); await h.close(); })();
