/* TEST_agente.js — amarra v40-agente (ACTÚA 2.0, 24/09/2026) en la PLATAFORMA.
   Corre el agente REAL (extraído del HTML) contra un motor FALSO que contesta con tool_calls
   guionadas, y contra las piezas reales de la agenda/tareas/URLs. Busca el fallo:
   ¿envía algo solo? ¿usa un número que no es de la agenda ni dictado? ¿agenda sin que se lo pidan?
   ¿se cuelga si el modelo no para? ¿deja a pie al usuario si el motor no soporta herramientas? */
const fs=require('fs'), path=require('path'), vm=require('vm');
const H=fs.readFileSync(path.join(__dirname,'..','PLATAFORMA','index.html'),'utf8');
let ok=0,bad=0; function t(m,c,x){ if(c){ok++;} else {bad++; console.log('  ❌ '+m+(x!==undefined?'  → '+String(x).slice(0,300):''));} }
function grabFunc(n){ const i=H.indexOf('function '+n+'('); if(i<0){ console.log('  (falta '+n+')'); return ''; } let d=0,k=H.indexOf('{',i); for(let p=k;p<H.length;p++){const c=H[p]; if(c==='{')d++; else if(c==='}'){d--; if(!d) return H.slice(i,p+1);}} return ''; }
const L=n=>{ const i=H.indexOf(n); return i<0?'':H.slice(i,H.indexOf('\n',i)); };
const ini=H.indexOf('const AGENTE_MAX_RONDAS'), fin=H.indexOf('/* ══════════ FIN v40-agente');
t('extraje el bloque del agente', ini>0 && fin>ini);
if(!(ini>0&&fin>ini)){ console.log('\n❌ sin bloque v40-agente'); process.exit(1); }
const AG=H.slice(ini,fin).replace(/\bconst (AGENTE_\w+)/g,'var $1');
const deps=['_normNombre','actuaAgenda','actuaCandidatos','actuaContacto','soloDigitos','numeroRastreable','actuaNumOk','actuaTelURL','actuaPaisCod','actuaWaNum','actuaWaURL','actuaMailDirOk','actuaMailURL','actuaCalURL','_tareaISO','_tareaFecha','tituloSinFecha','cortarLimpio' /* v40-10292 */,'_tareaNorm','tareasCargar','tareasGuardarTodas','tareaGuardar','tareasActivas','tareasTexto','_tareaFechaLinda','actuaEsc','actuaURLValida'].map(grabFunc).join('\n');
const consts=[L('const _TF_MES'),L('const _TF_DIA'),L('const _TF_PRE'),L('const REDACTOR_URL_MAX'),L('const ACTUA_URL_OK'),L('const ACTUA_PAIS_MOVIL9')].map(s=>s.replace(/^const /,'var ')).join('\n');

function mk({agenda={}, respuestas=[], cap={actua:true,redactor:true}, modelo='openai/gpt-oss-120b', url='https://proxy.x/groq', historia=[], modo='mirror'}={}){
  const st={ mirror_agenda: JSON.stringify(agenda) };
  const ctx={ console, JSON, Math, Date, String, Array, Object, Promise, encodeURIComponent, RegExp, isNaN, Number, setTimeout,
    localStorage:{getItem:k=>k in st?st[k]:null,setItem:(k,v)=>{st[k]=String(v)}}, _st:st,
    CONFIG:{ cap, appName:'ATIS', perfil:{nombre:'Darío', rol:'Docente', estilo:'Directo'}, paisCod:'54' },
    mode:modo, MODELO_GROQ:modelo, GROQ_URL:url, GROQ_KEY:'', history:historia.slice(), ultimoPedidoUsuario:'',
    _chat:[], _cards:[], _bodies:[], _typing:[], _busy:[], _mem:0, _rec:0, _habla:[], _err:[],
    document:{ getElementById:()=>({ appendChild(d){ ctx._chat.push({rastro:d.innerHTML}); }, scrollHeight:0 }), createElement:()=>({ className:'', innerHTML:'' }) },
  };
  ctx.window=ctx;
  ctx.addMsg=(r,txt)=>ctx._chat.push({r,txt});
  ctx.actuaTarjeta=function(){ const a=[...arguments]; if(!ctx.actuaURLValida(a[3])) { ctx._cards.push({rechazada:a}); return false; } ctx._cards.push({tipo:'actua',a}); return true; };
  ctx.redactorTarjeta=function(){ ctx._cards.push({tipo:'redactor',a:[...arguments]}); return true; };
  ctx.showTyping=()=>ctx._typing.push('on'); ctx.removeTyping=()=>ctx._typing.push('off'); ctx.setTypingNote=n=>ctx._typing.push(n);
  ctx.setButtonsBusy=b=>ctx._busy.push(b); ctx.memorySet=async()=>{ctx._mem++;}; ctx.recuerdoGuardar=async()=>{ctx._rec++;};
  ctx.hablar=x=>ctx._habla.push(x); ctx.regError=(k,e)=>ctx._err.push(k+':'+(e&&e.message)); ctx.renderTareas=()=>{};
  ctx.getRecuerdosContext=q=>'=== MEMORIA ===\n• a Juan le gusta el asado';
  let i=0;
  ctx.fetch=async(u,opt)=>{ ctx._bodies.push(JSON.parse(opt.body)); const r=respuestas[Math.min(i,respuestas.length-1)]; i++;
    if (typeof r==='function') return r();
    return { status: r.status||200, text: async()=> JSON.stringify(r.body) }; };
  vm.createContext(ctx);
  vm.runInContext(consts+'\n'+deps+'\n'+AG, ctx);
  return ctx;
}
const tc=(id,name,args)=>({id, type:'function', function:{name, arguments: typeof args==='string'?args:JSON.stringify(args)}});
const R=(msg)=>({ body:{ choices:[{ message: msg }], usage:{ total_tokens: 900 } } });
const correr=async(ctx,texto)=>{ ctx.ultimoPedidoUsuario=texto; return await vm.runInContext('agenteResolver('+JSON.stringify(texto)+')', ctx); };

(async()=>{
  const AG_JUAN={ 'juan perez':{ tel:'2994123456', email:'juan@mail.com', nombre:'Juan Pérez' }, 'laura gomez':{ tel:'2994000001', nombre:'Laura Gómez' }, 'laura diaz':{ tel:'2994000002', nombre:'Laura Díaz' } };
  // ── 0) la puerta ──
  { const c=mk(); const g=s=>vm.runInContext('agenteDebeActuar('+JSON.stringify(s)+')',c);
    t('puerta: «avisale a Juan que el jueves no llego y anotame reprogramar la reunión» → agente', g('avisale a Juan que el jueves no llego y anotame reprogramar la reunión'));
    t('puerta: «mandale un mail a Laura con el informe» → agente', g('mandale un mail a Laura con el informe'));
    t('puerta: «agendame el turno médico el viernes» → agente', g('agendame el turno médico el viernes'));
    t('puerta: con tilde al final («anotá reprogramar la reunión») → agente', g('anotá reprogramar la reunión para el lunes'));
    t('puerta: charla («hola, cómo andás») → NO', !g('hola, cómo andás'));
    t('puerta: «recordame qué te conté del viaje» (pregunta a la memoria) → NO', !g('recordame qué te conté del viaje'));
    t('puerta: «recordame mañana llamar al dentista» → agente', g('recordame mañana llamar al dentista'));
    t('autoconocimiento: la arquitectura cuenta el agente', /AGENTE \(ACTÚA 2\.0, v40\)/.test(H));
    t('puerta: pregunta en pasado («¿le mandaste el mail?») → NO', !g('¿le mandaste el mail a Juan?'));
    t('puerta: tema («qué es un agente de IA») → NO', !g('qué es un agente de IA'));
    t('puerta: «mandá música de los Redondos» (sin destinatario/agenda) → NO (sigue su tarjeta de YouTube)', !g('mandá música de los Redondos'));
    const c2=mk({modo:'tars'}); t('puerta: en TARS → NO (las manos son de MIRROR)', !vm.runInContext('agenteDebeActuar("avisale a Juan que llego tarde")',c2));
    const c3=mk({cap:{actua:false}}); t('puerta: con «actúa» apagado → NO', !vm.runInContext('agenteDebeActuar("avisale a Juan que llego tarde")',c3));
  }
  // ── 1) el caso completo de tres pasos ──
  { const TX='avisale a Juan que el jueves no llego y anotame reprogramar la reunión';
    const c=mk({ agenda:AG_JUAN, respuestas:[
      R({ content:null, tool_calls:[ tc('a1','buscar_contacto',{nombre:'Juan'}) ] }),
      R({ content:'', tool_calls:[ tc('a2','preparar_whatsapp',{para:'Juan', mensaje:'Juan, el jueves no llego. Te aviso para reprogramar.'}), tc('a3','agendar',{titulo:'Reprogramar la reunión', cuando:'jueves'}) ] }),
      R({ content:'Listo: te dejé el WhatsApp para Juan y anoté reprogramar la reunión para el jueves. Tocá la tarjeta para mandarlo.' }) ] });
    const r=await correr(c,TX);
    t('3 pasos: resuelve el turno', r===true, r);
    t('3 pasos: 3 idas al motor', c._bodies.length===3, c._bodies.length);
    t('3 pasos: la 1ª ida lleva las herramientas y tool_choice auto', Array.isArray(c._bodies[0].tools) && c._bodies[0].tools.length===7 && c._bodies[0].tool_choice==='auto');
    t('3 pasos: gpt-oss lleva su curita (effort low, sin razonamiento en la salida)', c._bodies[0].reasoning_effort==='low' && c._bodies[0].include_reasoning===false && c._bodies[0].max_completion_tokens>=800 && c._bodies[0].max_completion_tokens<=1000);
    t('3 pasos: el resultado de buscar_contacto NO le pasa el número al modelo', !/2994123456/.test(JSON.stringify(c._bodies[1].messages)), JSON.stringify(c._bodies[1].messages.slice(-1)));
    const wa=c._cards.find(x=>x.tipo==='actua'&&/wa\.me/.test(x.a[3]));
    t('3 pasos: tarjeta de WhatsApp con el número DE LA AGENDA', !!wa && /wa\.me\/\d*2994123456\?text=/.test(wa.a[3]), wa&&wa.a[3]);
    const cal=c._cards.find(x=>x.tipo==='actua'&&/calendar/.test(x.a[3]));
    t('3 pasos: tarjeta de calendario', !!cal, JSON.stringify(c._cards.map(x=>x.a&&x.a[1])));
    const tareas=JSON.parse(c._st.mirror_tareas||'[]');
    t('3 pasos: la tarea quedó anotada con fecha (jueves)', tareas.length===1 && /Reprogramar/.test(tareas[0].titulo) && /^\d{4}-\d{2}-\d{2}$/.test(tareas[0].fecha), JSON.stringify(tareas));
    const ordenOK = c._chat[0].r==='user' && c._chat[1].r==='mirror';
    t('3 pasos: orden en pantalla = pedido → respuesta → tarjetas → rastro', ordenOK && !!c._chat.find(x=>x.rastro && /lo que hice/.test(x.rastro)), JSON.stringify(c._chat).slice(0,300));
    const rastro=(c._chat.find(x=>x.rastro)||{}).rastro||'';
    t('3 pasos: el rastro cuenta los 3 pasos', /busqué/.test(rastro) && /preparé el WhatsApp/.test(rastro) && /anoté/.test(rastro), rastro);
    t('3 pasos: queda en el historial (pedido + respuesta con acciones)', c.history.length===2 && /acciones preparadas/.test(c.history[1].content));
    t('3 pasos: memoria y voz como un turno normal', c._mem===1 && c._rec===1 && c._habla.length===1);
    t('3 pasos: libera los botones', c._busy[c._busy.length-1]===false);
  }
  // ── 2) contacto que no está ──
  { const c=mk({ agenda:AG_JUAN, respuestas:[
      R({ tool_calls:[ tc('b1','preparar_whatsapp',{para:'Pedro', mensaje:'hola'}) ] }),
      R({ content:'No tengo a Pedro en tus contactos. ¿Me pasás su número?' }) ] });
    await correr(c,'avisale a Pedro que llego tarde');
    t('sin contacto: NO hay tarjeta de WhatsApp', !c._cards.length, JSON.stringify(c._cards));
    t('sin contacto: el modelo recibe el motivo (no inventar)', /No tengo el número/.test(JSON.stringify(c._bodies[1].messages)));
  }
  // ── 3) número inventado por el modelo ──
  { const c=mk({ agenda:{}, respuestas:[
      R({ tool_calls:[ tc('c1','preparar_whatsapp',{para:'Pedro', mensaje:'hola', numero:'1155556666'}) ] }),
      R({ content:'No tengo su número.' }) ] });
    await correr(c,'avisale a Pedro que llego tarde');
    t('número NO dictado (lo trajo el modelo) → rechazado, sin tarjeta', !c._cards.length, JSON.stringify(c._cards));
  }
  // ── 4) número dictado por el usuario ──
  { const c=mk({ agenda:{}, respuestas:[
      R({ tool_calls:[ tc('d1','preparar_whatsapp',{para:'Pedro', mensaje:'Llego tarde', numero:'2995551234'}) ] }),
      R({ content:'Te dejé el WhatsApp para Pedro.' }) ] });
    await correr(c,'avisale a Pedro al 2995551234 que llego tarde');
    t('número dictado en el pedido → tarjeta con ESE número', c._cards.length===1 && /2995551234/.test(c._cards[0].a[3]), JSON.stringify(c._cards));
  }
  // ── 5) dos «Laura» ──
  { const c=mk({ agenda:AG_JUAN, respuestas:[
      R({ tool_calls:[ tc('e1','preparar_whatsapp',{para:'Laura', mensaje:'hola'}) ] }),
      R({ content:'Tenés dos Laura: ¿Gómez o Díaz?' }) ] });
    await correr(c,'avisale a Laura que llego tarde');
    t('ambigua (dos Laura) → sin tarjeta, pide precisar', !c._cards.length && /varios/.test(JSON.stringify(c._bodies[1].messages)));
  }
  // ── 6) agendar sin que lo pidan ──
  { const c=mk({ agenda:AG_JUAN, respuestas:[
      R({ tool_calls:[ tc('f1','agendar',{titulo:'Llegar tarde', cuando:'hoy'}) ] }),
      R({ content:'Listo.' }) ] });
    await correr(c,'avisale a Juan que llego tarde');
    t('agendar SIN pedido de agenda → rechazado, sin tarea ni tarjeta', !c._cards.length && !JSON.parse(c._st.mirror_tareas||'[]').length);
  }
  // ── 7) el modelo no para nunca ──
  { const c=mk({ agenda:AG_JUAN, respuestas:[ R({ tool_calls:[ tc('g','ver_tareas',{}) ] }) ] });
    const r=await correr(c,'anotame algo y avisale a Juan');
    t('bucle: corta a las 4 rondas', c._bodies.length===4, c._bodies.length);
    t('bucle: igual contesta algo honesto y libera', r===true && c._chat.some(x=>x.r==='mirror') && c._busy[c._busy.length-1]===false);
  }
  // ── 8) el motor no soporta herramientas (400) en la 1ª ida ──
  { const c=mk({ respuestas:[ { status:400, body:{ error:{ message:'tools is not supported for this model' } } } ] });
    const r=await correr(c,'avisale a Juan que llego tarde');
    t('sin herramientas en el motor → cede el turno («mostrado»), sin tarjetas', r==='mostrado' && !c._cards.length, r);
    t('… y no ensucia el historial (el camino de siempre lo agrega)', c.history.length===0);
    t('… y saca el «escribiendo»', c._typing.includes('off'));
  }
  // ── 9) se corta DESPUÉS de preparar algo ──
  { const c=mk({ agenda:AG_JUAN, respuestas:[
      R({ tool_calls:[ tc('h1','preparar_whatsapp',{para:'Juan', mensaje:'llego tarde'}) ] }),
      { status:429, body:{ error:{ message:'Rate limit reached' } } } ] });
    const r=await correr(c,'avisale a Juan que llego tarde y anotame llamarlo');
    t('corte a mitad: pinta lo preparado y lo dice', r===true && c._cards.length===1 && c._chat.some(x=>x.r==='mirror'&&/se cortó/.test(x.txt)));
  }
  // ── 10) argumentos rotos / herramienta inventada ──
  { const c=mk({ agenda:AG_JUAN, respuestas:[
      R({ tool_calls:[ tc('i1','preparar_whatsapp','{para:"Juan", roto'), tc('i2','enviar_ya',{para:'Juan'}) ] }),
      R({ content:'No pude.' }) ] });
    const r=await correr(c,'avisale a Juan que llego tarde');
    const tools=c._bodies[1].messages.filter(m=>m.role==='tool').map(m=>m.content).join(' | ');
    t('JSON roto → error prolijo, no explota', r===true && /ilegibles/.test(tools), tools);
    t('herramienta inventada («enviar_ya») → desconocida, no hace nada', /desconocida/.test(tools) && !c._cards.length);
    t('NO existe ninguna herramienta que envíe/llame/publique', !vm.runInContext('AGENTE_HERRAMIENTAS',c).some(h=>/^(enviar|send|llamar|publicar|postear)/i.test(h.function.name)));
  }
  // ── 11) el modelo dice «ya le mandé» ──
  { const c=mk({ agenda:AG_JUAN, respuestas:[
      R({ tool_calls:[ tc('j1','preparar_whatsapp',{para:'Juan', mensaje:'llego tarde'}) ] }),
      R({ content:'Listo, ya le mandé el mensaje a Juan.' }) ] });
    await correr(c,'avisale a Juan que llego tarde');
    const fin=c._chat.find(x=>x.r==='mirror').txt;
    t('«ya le mandé» con la tarjeta sin tocar → la app aclara que no salió nada', /todavía no salió nada/.test(fin), fin);
  }
  // ── 12) mail: dirección de la agenda, nunca inventada ──
  { const c=mk({ agenda:AG_JUAN, respuestas:[
      R({ tool_calls:[ tc('k1','preparar_mail',{para:'Juan', asunto:'Reunión', cuerpo:'Juan, el jueves no llego.'}), tc('k2','preparar_mail',{para:'Laura Gómez', cuerpo:'Hola Laura.'}) ] }),
      R({ content:'Te dejé los dos mails.' }) ] });
    await correr(c,'mandale un mail a Juan y otro a Laura Gómez');
    const m=c._cards.filter(x=>x.tipo==='redactor');
    t('mail: el de Juan sale con SU dirección de la agenda', m[0] && /mailto:juan@mail\.com\?/.test(m[0].a[3]), m[0]&&m[0].a[3]);
    t('mail: Laura sin mail en la agenda → «falta su dirección» (no inventa)', m[1] && /falta su dirección/.test(m[1].a[1]) && /^mailto:\?/.test(m[1].a[3]), m[1]&&m[1].a[1]);
  }
  // ── 13) qwen y cupo ──
  { const c=mk({ modelo:'qwen/qwen3.8-27b', agenda:AG_JUAN, respuestas:[ R({ content:'Hola.' }) ] });
    await correr(c,'avisale a Juan que llego tarde');
    t('qwen3.8: su curita (effort none + hidden)', c._bodies[0].reasoning_effort==='none' && c._bodies[0].reasoning_format==='hidden');
    const sys=c._bodies[0].messages[0].content;
    t('prompt del agente austero (< 1800 caracteres)', sys.length<1800, sys.length);
    t('prompt: nada se envía solo + no inventar números', /NADA se envía solo/.test(sys) && /Jamás inventes números/.test(sys));
    const c2=mk({ agenda:AG_JUAN, historia:[{role:'user',content:'x'.repeat(5000)},{role:'assistant',content:'y'.repeat(5000)}], respuestas:[ R({ content:'ok' }) ] });
    await correr(c2,'avisale a Juan que llego tarde');
    t('historial recortado (último ida-y-vuelta, cada turno ≤ 400 caracteres)', c2._bodies[0].messages.length===4 && c2._bodies[0].messages.slice(1,-1).every(m=>m.content.length<=400));
  }
  // ── 15) cupo: espera corta UNA vez y sigue ──
  { const c=mk({ agenda:AG_JUAN, respuestas:[
      R({ tool_calls:[ tc('l1','preparar_whatsapp',{para:'Juan', mensaje:'llego tarde'}) ] }),
      { status:429, body:{ error:{ message:'Rate limit reached for model on tokens per minute (TPM): Limit 8000. Please try again in 1.2s.' } } },
      R({ content:'Te dejé el WhatsApp.' }) ] });
    const t0=Date.now(); const r=await correr(c,'avisale a Juan que llego tarde');
    t('cupo: espera lo que pide Groq (corto) y repite la ronda', r===true && c._bodies.length===3 && Date.now()-t0>=1500 && c._typing.some(x=>/cupo gratis pide esperar/.test(String(x))), c._bodies.length);
    t('cupo: termina bien, sin cartel de corte', c._chat.find(x=>x.r==='mirror').txt==='Te dejé el WhatsApp.');
  }
  { const c=mk({ agenda:AG_JUAN, respuestas:[
      R({ tool_calls:[ tc('m1','preparar_whatsapp',{para:'Juan', mensaje:'llego tarde'}) ] }),
      { status:429, body:{ error:{ message:'Rate limit reached. Please try again in 58.3s.' } } } ] });
    const t0=Date.now(); await correr(c,'avisale a Juan que llego tarde');
    t('cupo: si pide esperar MUCHO, no deja al usuario mirando: corta y pinta lo hecho', Date.now()-t0<3000 && c._cards.length===1 && /se cortó/.test(c._chat.find(x=>x.r==='mirror').txt));
  }
  { const c=mk(); const sys=vm.runInContext('agenteSistema()',c); t('prompt: pide herramientas juntas (ahorra cupo)', /JUNTAS/.test(sys)); }
  // ── 16) v40-audit4: foto de una factura VIEJA → se anota, pero se avisa que ya pasó ──
  { const c=mk({ agenda:AG_JUAN, respuestas:[
      R({ tool_calls:[ tc('p1','agendar',{titulo:'Vencimiento factura de luz', cuando:'08/07/2021'}) ] }),
      R({ content:'Listo, anotado.' }) ] });
    await correr(c,'agenda la fecha de vencimiento de la imagen');
    const card=c._cards.find(x=>x.tipo==='actua');
    t('fecha pasada: la tarjeta avisa «YA PASÓ» y muestra el año', card && /YA PASÓ \(08\/07\/2021\)/.test(card.a[2]), card&&card.a[2]);
    t('fecha pasada: el rastro lo dice', (c._chat.find(x=>x.rastro)||{}).rastro && /ya pasó/.test(c._chat.find(x=>x.rastro).rastro));
    t('fecha pasada: el modelo recibe el aviso para decírselo al usuario', /YA PASÓ/.test(JSON.stringify(c._bodies[1].messages)));
    t('fecha pasada: igual la anota (la pidió el usuario)', JSON.parse(c._st.mirror_tareas||'[]').some(x=>x.fecha==='2021-07-08'));
  }
  { const c=mk({ agenda:AG_JUAN, respuestas:[ R({ tool_calls:[ tc('p2','agendar',{titulo:'Turno', cuando:'mañana'}) ] }), R({ content:'ok' }) ] });
    await correr(c,'agendame el turno para mañana');
    const card=c._cards.find(x=>x.tipo==='actua');
    t('fecha futura: sin aviso y como siempre («Para el dd/mm — …»)', card && /^Para el \d\d\/\d\d — /.test(card.a[2]) && !/PASÓ/.test(card.a[2]), card&&card.a[2]);
  }
  // ── 14) cableado en send() ──
  { const i=H.indexOf('async function send() {'); const j=H.indexOf('\n}\n',i); const S=H.slice(i,j);
    // v40-hechos (2/10): el agente recibe el texto SIN las preguntas que ya contestó la app (_textoModelo)
    const iAg = Math.max(S.indexOf('agenteDebeActuar(text)'), S.indexOf('agenteDebeActuar(_textoModelo)'));
    const iMf = Math.max(S.indexOf('esPreguntaModeloSola(text)'), S.indexOf('esPreguntaModeloSola(_textoModelo)'));
    t('send(): el agente va DESPUÉS de ACTÚA determinístico y del modelfijo', iAg > 0 && S.indexOf('actuaInterceptar(text)') < iAg && iMf > 0 && iMf < iAg);
    t('send(): con los botones ya ocupados', S.indexOf('setButtonsBusy(true);') < iAg);
    t('send(): si el agente cedió el turno, no repite el mensaje del usuario', /if \(!_agenteMostro\) addMsg\('user', text, false\);/.test(S));
  }
  console.log('\n'+(bad===0?'✅ TODO VERDE — '+ok+' pruebas pasan (plataforma · agente)':'❌ '+bad+' fallos de '+(ok+bad)));
  process.exit(bad?1:0);
})().catch(e=>{ console.log('💥', e); process.exit(1); });
