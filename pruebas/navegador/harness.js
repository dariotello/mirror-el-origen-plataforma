// Harness: carga la plataforma en Chromium con proxy/voz simulados.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = process.env.FILE;
const NUBE_DIR = process.env.NUBE_DIR || path.join(__dirname, '..', '..', 'atomos'); // v40-nube
async function abrir(opts){
  opts = opts || {};
  const html = fs.readFileSync(FILE, 'utf8');
  const srv = http.createServer((q, s) => {
    if (q.url.startsWith('/proxy')) {
      let b=''; q.on('data',d=>b+=d); q.on('end',()=>{ srv._reqs.push({url:q.url, body:b});
        s.writeHead(200, {'content-type':'application/json','access-control-allow-origin':'*'});
        const content = (opts.reply || 'Hola, todo bien por acá. ¿Y vos cómo andás?');
        s.end(JSON.stringify({choices:[{message:{role:'assistant',content}}], usage:{total_tokens:50}})); });
      return;
    }
    if (q.url.startsWith('/fb')) { s.writeHead(200,{'content-type':'application/json','access-control-allow-origin':'*'}); s.end('null'); return; }
    /* v40-nube (23/11): la nube de la app (atomos/) se sirve al lado del index, como en el Worker. opts.nube === false → sin nube
       (404); opts.nubeFalla(ruta) → true = esa pieza no llega. srv._nube registra lo que se pidió. */
    if (q.url.startsWith('/atomos/')) {
      const ruta = decodeURIComponent(q.url.split('?')[0].slice('/atomos/'.length));
      srv._nube.push(ruta);
      const f = path.join(NUBE_DIR, ruta);
      if (opts.nube === false || (opts.nubeFalla && opts.nubeFalla(ruta)) || ruta.indexOf('..') >= 0 || !fs.existsSync(f) || !fs.statSync(f).isFile()) { s.writeHead(404); s.end(); return; }
      s.writeHead(200, { 'content-type': /\.json$/.test(f) ? 'application/json' : 'text/javascript; charset=utf-8' }); s.end(fs.readFileSync(f)); return;
    }
    if (q.url !== '/' && !q.url.startsWith('/?')) { s.writeHead(404); s.end(); return; }
    s.writeHead(200, {'content-type':'text/html; charset=utf-8'}); s.end(html);
  });
  srv._reqs = []; srv._nube = [];
  await new Promise(r => srv.listen(0, r));
  const port = srv.address().port, base = 'http://localhost:' + port;
  const browser = await chromium.launch({ channel:'chromium', args:['--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ serviceWorkers:'block', viewport: opts.viewport || { width: 1366, height: 640 } });
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  const cfg = Object.assign({ configurado:true, proxyUrl: base + '/proxy', fbUrl: opts.fb ? base + '/fb' : '', perfil:{nombre:'Prueba'}, cap:{ sonido:false, microfono:true, voz:true, fachada:false, web:true, audio:true, devolver:true, actua:true, analista:true, encuesta:true, redactor:true } }, opts.cfg || {});
  const ls = Object.assign({ mirror_config: JSON.stringify(cfg), mirror_tts:'on', mirror_intro_vista:'1' }, opts.ls || {});
  await ctx.addInitScript(({ ls, fakeVoz }) => {
    try { if (!sessionStorage.getItem('_seeded')) { for (const k in ls) localStorage.setItem(k, ls[k]); sessionStorage.setItem('_seeded','1'); } } catch(e){}
    window.__habla = []; window.__errores = []; if (ls.__redBloqueada) window.__redBloqueada = true; if (ls.__modoFalla) window.__modoFalla = ls.__modoFalla;
    window.addEventListener('error', e => window.__errores.push(String(e.message)));
    window.addEventListener('unhandledrejection', e => window.__errores.push('rej:' + String(e.reason && e.reason.message || e.reason)));
    if (fakeVoz) {
      const voces = [{ name:'Microsoft Helena - Spanish (Spain)', lang:'es-ES', localService:true, default:true, voiceURI:'helena' },
                     { name:'Microsoft Laura - Spanish (Spain)', lang:'es-ES', localService:true, default:false, voiceURI:'laura' },
                     { name:'Microsoft Pablo - Spanish (Spain)', lang:'es-ES', localService:true, default:false, voiceURI:'pablo' },
                     { name:'Microsoft Elena Online (Natural) - Spanish (Argentina)', lang:'es-AR', localService:false, default:false, voiceURI:'elena' }];
      if (window.__muchasVoces !== false) ['Tomas','Sofia','Marcelo','Catalina','Lorenzo','Gonzalo','Salome','Dalia','Jorge','Alvaro','Elvira','Ximena','Andrea','Karla','Yolanda','Emilio','Marta','Paloma','Federico','Valentina'].forEach((n,i)=>voces.push({ name:'Microsoft '+n+' Online (Natural) - Spanish (X'+i+')', lang:'es-'+['AR','CL','CO','MX','US','ES','UY','PE'][i%8], localService:false, default:false, voiceURI:n }));
      const ss = { speaking:false, pending:false, paused:false, onvoiceschanged:null,
        getVoices(){ return voces; },
        speak(u){ const vz = u.voice ? u.voice.name : '(sin voz)'; window.__habla.push(u.text); window.__hablaVoz = (window.__hablaVoz||[]).concat(vz);
          const falla = u.voice && u.voice.localService === false && window.__redBloqueada;
          if (falla) { if (window.__modoFalla === 'mudo') return; setTimeout(()=>{ try{ u.onerror && u.onerror({error:'synthesis-failed'}); }catch(e){} }, 30); return; }
          this.speaking = true; setTimeout(()=>{ try{ u.onstart && u.onstart({}); }catch(e){} }, 5); setTimeout(()=>{ this.speaking=false; try{ u.onend && u.onend({}); }catch(e){} }, 20); },
        cancel(){ this.speaking=false; }, pause(){}, resume(){} };
      Object.defineProperty(window, 'speechSynthesis', { value: ss, configurable:true });
      window.SpeechSynthesisUtterance = function(t){ this.text = t; };
    }
  }, { ls, fakeVoz: opts.fakeVoz !== false });
  const page = await ctx.newPage();
  page.on('pageerror', e => page._pe = (page._pe||[]).concat(String(e.message)));
  page.on('console', m => { if (m.type()==='error') page._ce = (page._ce||[]).concat(m.text()); });
  await page.goto(base + (opts.path || '/?app'), { waitUntil: 'load' });
  await page.waitForTimeout(opts.wait || 1500);
  return { page, browser, srv, base, close: async()=>{ await browser.close(); srv.close(); } };
}
module.exports = { abrir };
