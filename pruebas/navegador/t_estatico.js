const { abrir } = require('./harness'); const fs=require('fs');
const html = fs.readFileSync(process.env.FILE,'utf8');
(async()=>{
 const h = await abrir({ fb:true, wait:2500 });
 const p = h.page;
 // 1) funciones llamadas desde handlers inline (en el HTML y en strings de JS)
 const nombres = new Set();
 const re = /on(?:click|change|input|keydown|submit|mouseenter|mouseleave|load|error)\s*=\s*\\?["']\s*(?:if\s*\([^)]*\)\s*)?(?:return\s+)?([A-Za-z_$][\w$]*)\s*\(/g;
 let m; while ((m = re.exec(html))) nombres.add(m[1]);
 const faltan = await p.evaluate(ns => ns.filter(n => !['if','return','event','this','document','window','alert','confirm','addMsg','setTimeout','enviar' /* enviar(): vive en la página de encuesta exportada (encArmarHtml), no en la app */].includes(n) && typeof window[n] !== 'function'), [...nombres]);
 console.log('handlers inline:', nombres.size, 'funciones que NO existen:', JSON.stringify(faltan));
 // 2) IDs duplicados en el DOM vivo
 const dups = await p.evaluate(() => { const c={}; document.querySelectorAll('[id]').forEach(e=>c[e.id]=(c[e.id]||0)+1); return Object.entries(c).filter(([k,v])=>v>1); });
 console.log('IDs duplicados:', JSON.stringify(dups));
 // 3) getElementById de ids que no existen en ningún lado
 const ids = new Set(); const re2 = /getElementById\(\s*'([\w-]+)'\s*\)/g; while ((m = re2.exec(html))) ids.add(m[1]);
 const idsHtml = new Set(); const re3 = /id\s*=\s*\\?["']([\w-]+)\\?["']/g; while ((m = re3.exec(html))) idsHtml.add(m[1]);
 const re4 = /\.id\s*=\s*'([\w-]+)'/g; while ((m = re4.exec(html))) idsHtml.add(m[1]);
 console.log('getElementById sin id definido en el archivo:', JSON.stringify([...ids].filter(i=>!idsHtml.has(i))));
 // 4) desborde horizontal
 const ov = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
 console.log('scroll horizontal 1366:', JSON.stringify(ov));
 console.log('errores:', JSON.stringify(await p.evaluate(()=>window.__errores)), JSON.stringify(p._pe||[]), 'console.error:', JSON.stringify((p._ce||[]).filter(x=>!/ERR_TUNNEL|404|ERR_FAILED|net::/.test(x))));
 await h.close();
 const h2 = await abrir({ fb:true, wait:2500, viewport:{width:360,height:740} });
 const ov2 = await h2.page.evaluate(() => { const r=[]; document.querySelectorAll('body *').forEach(e=>{ const b=e.getBoundingClientRect(); if (b.right > innerWidth+2 && getComputedStyle(e).display!=='none' && b.width>0 && !e.closest('[style*="display:none"]')) r.push((e.id||e.className||e.tagName).toString().slice(0,30)+':'+Math.round(b.right)); }); return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, ejemplos: r.slice(0,10) }; });
 console.log('360px:', JSON.stringify(ov2));
 await h2.close();
})();
