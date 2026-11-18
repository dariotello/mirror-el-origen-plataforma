const { abrir } = require('./harness');
let ok=0,bad=0; const t=(m,c,x)=>{ if(c){ok++;console.log('  ✅ '+m);} else {bad++;console.log('  ❌ '+m+(x!==undefined?' → '+JSON.stringify(x).slice(0,300):''));} };
(async()=>{ const h=await abrir({fb:true}); const p=h.page;
 await p.evaluate(()=>{ recuerdosChunks.push(recuerdoArmar('QUE TIENE DE BUENA LA VERSION 40 DE MIRROR?','En la v40 se añadió la barra de acciones rápidas y cifrado actualizado.'));
   recuerdosChunks.push(recuerdoArmar('mi perra se llama Pochola y es muy buena','¡Qué lindo nombre, Pochola!'));
   history.push({role:'user',content:'QUE TIENE DE BUENA LA VERSION 40?'},{role:'assistant',content:'En la v40 se añadió la barra de acciones rápidas (historial restaurado).'},{role:'user',content:'hola'},{role:'assistant',content:'¡Hola! Todo tranqui por acá.'}); });
 const env=async q=>{ const n0=h.srv._reqs.length; await p.fill('#inp',q); await p.keyboard.press('Enter'); await p.waitForTimeout(2300); return h.srv._reqs.slice(n0).map(r=>r.body).join('\n'); };
 // v40-cupo2 (3/10): «¿qué tiene de bueno la v40?» ya lo contesta la APP con la lista real (dato fijo): ni recuerdo ni historial envenenado pueden colarse
 let b=await env('¿qué tiene de bueno la v40?');
 const ult=await p.evaluate(()=>{ const m=document.querySelectorAll('#chat .msg'); return m[m.length-1].innerText; });
 t('pregunta por la versión: contesta la app con la lista real, sin pasar por el modelo', b==='' && /Mi versión: soy la v40/.test(ult) && !/barra de acciones/.test(ult), ult.slice(0,200));
 b=await env('¿cómo se llama mi perra?');  // sigue sticky 2 turnos: la fuente de verdad acompaña y la memoria normal igual entra
 t('en la repregunta, el recuerdo envenenado NO entra', !/barra de acciones/.test(b)); t('el historial RESTAURADO con la respuesta inventada tampoco viaja', !/historial restaurado/.test(b)); t('el resto del historial sí viaja', /Todo tranqui por acá/.test(b)); // v40-1029 (auditores 23/10 + en vivo): en una pregunta que NO es sobre la versión, la lista larga de novedades ya no viaja
 // (los filtros de arriba —recuerdo e historial envenenados— siguen activos en los turnos pegajosos)
 t('v40-1029: «¿cómo se llama mi perra?» NO carga el bloque de versión', !/ESTO LE GANA A TODO/.test(b));
 t('memoria normal (Pochola) sigue entrando durante el turno pegajoso', /Pochola/.test(b) && !/barra de acciones/.test(b));
 b=await env('¿y cuáles son esas novedades?');  // v40-1029: la repregunta SÍ lleva la fuente de verdad
 t('marca lo viejo como NO novedad (en la repregunta sobre la versión)', /NO es novedad de esta versión/.test(b));
 t('...y sí entra la fuente de verdad con la orden de corregirse', /ESTO LE GANA A TODO/.test(b) && /me corrijo/.test(b));
 await env('ok'); await env('dale');
 b=await env('contame qué hablamos de la barra de acciones');
 t('fuera de preguntas de versión la memoria vuelve a ser completa (no se borra nada)', /barra de acciones/.test(b));
 t('sin errores JS', !(p._pe||[]).length && !(await p.evaluate(()=>window.__errores.length)));
 console.log(bad?`❌ ${bad} fallas`:`✅ ${ok} OK`); await h.close(); })();
