/* TEST v40-datoagenda (06/11/2026) — el ÁTOMO «dato de agenda», en Node puro, con las frases EXACTAS de Darío.
   Hallazgo en vivo del 29/10: Laura en 📇 con su mail; «¿Me pasás la dirección de mail de Laura?» → «LA TENÉS EN
   CONTACTOS» → «No tengo la dirección de mail de Laura». Sobre la 29.2 este banco da ROJO (el átomo no existe).
   Lleva CONTROLES: lo que NO tiene que agarrar (preguntas generales, pedidos de mandar, física). */
const fs=require('fs'), path=require('path'), vm=require('vm');
const BASE=path.join(__dirname,'..');
const FILE=path.join(BASE,'PLATAFORMA','index.html');
let ok=0,bad=0;
function t(l,c,e){ if(c){ok++;} else {bad++; console.log('  ❌ '+l+(e!==undefined?'  → '+String(e).slice(0,240):''));} }
function grabFunc(H,name){ const i=H.indexOf('function '+name+'('); if(i<0)return''; let d=0,k=H.indexOf('{',i); for(let p=k;p<H.length;p++){const c=H[p]; if(c==='{')d++; else if(c==='}'){d--; if(d===0)return H.slice(i,p+1);}} return ''; }
const H=fs.readFileSync(FILE,'utf8');
// v40-nube (23/11): desde la 2026-11-23.1 el átomo NO vive en el index: vive en la nube (nube/atomos/dato_agenda/codigo.js, el
// cuerpo de su fábrica). Si el index todavía lo trae (builds viejas), se prueba de ahí, como antes.
const i0=H.indexOf('/* ══════════ v40-datoagenda'), i1=H.indexOf('/* ══════════ FIN v40-datoagenda');
const repo=[process.env.REPO_RAIZ, path.join(BASE,'..'), path.join(BASE,'PLATAFORMA','PARA_DEPLOYAR_PLATAFORMA','PARA_EL_REPO')].filter(Boolean).find(r=>fs.existsSync(path.join(r,'nube','atomos','dato_agenda','codigo.js')));
const enIndex = i0>0 && i1>i0;
const COD = enIndex ? H.slice(i0,i1) : (repo ? fs.readFileSync(path.join(repo,'nube','atomos','dato_agenda','codigo.js'),'utf8') : '');
t('el átomo existe (en el index de una build vieja, o en la nube)', !!COD);
if (!COD){ console.log('\n❌ '+bad+' fallos de '+(ok+bad)); process.exit(1); }
if (!enIndex) t('en la nube: el index ya NO trae el átomo (la app arranca sin la pieza)', H.indexOf('function datoAgendaEntender(')<0);
const ENSAMBLAR = enIndex ? COD : 'var __inst=(function(){\n'+COD+'\n})(); ACTUA_CMDS.unshift(__inst.regla);';
const fichaCand=[repo&&path.join(repo,'nube','atomos','dato_agenda','ficha.json'), path.join(BASE,'..','organos','dato_agenda','ficha.json')].filter(f=>f&&fs.existsSync(f));
if (fichaCand.length){ const fi=JSON.parse(fs.readFileSync(fichaCand[0],'utf8')); const m=/const DATO_AGENDA_ESTADO = '([a-z]+)'/.exec(COD); t('el estado del código es el de la ficha', m && m[1]===fi.estado, (m&&m[1])+' vs '+fi.estado); }
const funcs=['_normNombre','actuaCandidatos','actuaContacto','actuaPedirPrecisar','actuaMailDirOk','actuaTelURL','actuaMailURL','actuaMapsURL'].map(n=>grabFunc(H,n)).join('\n');
function caja(agenda){
  const sb={String,RegExp,Object,Array,Math,JSON,console,
    localStorage:{getItem:k=>k==='mirror_agenda'?JSON.stringify(agenda):null},
    __tarjetas:[], __pend:[]};
  vm.createContext(sb);
  vm.runInContext('var history=[]; var ACTUA_CMDS=[]; function actuaAgenda(){ try{ return JSON.parse(localStorage.getItem("mirror_agenda")||"{}") }catch(e){ return {} } }\n'
    +'function actuaTarjeta(){ __tarjetas.push(Array.from(arguments)); return true; } function actuaPendPedir(a,m){ __pend.push(a); } function actuaWaURL(n,m){ return "https://wa.me/"+String(n).replace(/\\D/g,""); } function regError(){}\n'
    +funcs+'\n'+ENSAMBLAR,sb);
  sb.decir=function(txt){ const c=sb.ACTUA_CMDS[0]; const m=c.re.exec(txt); if(!m) return null; const r=c.run(m); sb.history.push({role:'user',content:txt},{role:'assistant',content:r}); return r; };
  sb.modelo=function(txt,resp){ sb.history.push({role:'user',content:txt},{role:'assistant',content:resp}); };
  return sb;
}
const AG={ 'laura pena':{nombre:'Laura Peña',email:'laura.pena00@gmail.com',tel:'+5492984112233',dir:'Mitre 120, Villa Regina'}, 'juan perez':{nombre:'Juan Pérez',tel:'2984556677',email:'',dir:''} };
console.log('\n━━━ A · las frases EXACTAS de Darío (29/10) ━━━');
{ const s=caja(AG);
  t('se enchufa a las manos: queda PRIMERO en ACTUA_CMDS', s.ACTUA_CMDS.length===1 && s.ACTUA_CMDS[0].atomo==='dato_agenda');
  const r=s.decir('¿Me pasás la dirección de mail de Laura?');
  t('«¿Me pasás la dirección de mail de Laura?» → la app da el mail', r && /laura\.pena00@gmail\.com/.test(r), r);
  t('  es MAIL, no domicilio («dirección de mail»)', r && !/Mitre/.test(r), r);
  t('  con la tarjeta ✉ y la dirección puesta', s.__tarjetas.length===1 && /^mailto:laura\.pena00@gmail\.com/.test(s.__tarjetas[0][3]), JSON.stringify(s.__tarjetas));
}
{ const s=caja(AG); s.modelo('¿Me pasás la dirección de mail de Laura?','No tengo la dirección de mail de Laura. ¿Me la pasás?');
  const r=s.decir('LA TENÉS EN CONTACTOS');
  t('«LA TENÉS EN CONTACTOS» (tras la negación del modelo) → toma el último intercambio y da el mail', r && /laura\.pena00@gmail\.com/.test(r), r); }
{ const s=caja(AG); s.modelo('dame el número de juan','No tengo ese dato.');
  const r=s.decir('pero lo tenés en la agenda');
  t('«pero lo tenés en la agenda» → número de Juan con tarjeta 📞', r && /2984556677/.test(r) && s.__tarjetas.length && /^tel:/.test(s.__tarjetas[0][3]), r); }
{ const s=caja(AG); const r=s.decir('LA TENÉS EN CONTACTOS');
  t('«LA TENÉS EN CONTACTOS» sin pedido previo → pregunta de quién (no inventa)', r && /de qui[eé]n/i.test(r), r); }
console.log('\n━━━ B · los demás datos ━━━');
{ const s=caja(AG);
  const r1=s.decir('cuál es el whatsapp de Laura?'); t('WhatsApp → número + tarjeta wa.me', /\+5492984112233/.test(r1||'') && /wa\.me/.test((s.__tarjetas.pop()||[])[3]), r1);
  const r2=s.decir('me das la dirección de Laura Peña'); t('dirección (domicilio) → Mitre 120 + mapa', /Mitre 120/.test(r2||'') && /maps/.test((s.__tarjetas.pop()||[])[3]), r2);
  const r3=s.decir('pasame el mail de juan'); t('contacto sin mail → lo dice, no inventa', /sin mail cargado/.test(r3||'') && !/@/.test(r3||''), r3);
}
console.log('\n━━━ C · dos contactos, o ninguno ━━━');
{ const s=caja(Object.assign({'laura gomez':{nombre:'Laura Gómez',email:'lg@x.com'}},AG));
  const r=s.decir('¿Me pasás la dirección de mail de Laura?');
  t('dos «Laura» → pregunta cuál, sin dar ningún mail', /2 contactos/.test(r||'') && !/@/.test(r||'') && s.__pend[0]==='datos', r); }
{ const s=caja(AG);
  const r=s.decir('pasame el mail de Rodolfo que está en mis contactos');
  t('no está y el pedido habla de contactos → «no lo tengo» de frente', r && /No tengo a «Rodolfo/.test(r), r); }
console.log('\n━━━ D · CONTROLES: lo que NO tiene que agarrar ━━━');
{ const s=caja(AG);
  for (const q of ['¿me pasás el número de la policía?','dame la dirección de la Casa Rosada','cuál es el mail de soporte de Google','decime el número de Avogadro','¿me pasás el teléfono de Pedro Picapiedra?','mandale un mail a Laura que llego tarde','llamá a Juan','quiero mandarle un mail a Laura','necesito escribirle un mail a Laura','podés llamar a Juan','guardá el mail de Laura laura@x.com','explicame la entropía de un gas','qué es la dirección de un vector?','la tenés clara con la física'])
    t('control: «'+q+'» no lo agarra', s.ACTUA_CMDS[0].re.exec(q)===null, q);
}
console.log('\n━━━ E · v40-codigos: «TARS-2» no se renombra ━━━');
{ const f=grabFunc(H,'personalizarNombres'); const sb={String,RegExp,Object,Array,CONFIG:{modos:{tars:'MODO ANALÍTICO',conn:'BASE',jurado:'EXPERTO/EXAMINADOR'}},NMODOS:()=>({tars:'MODO ANALÍTICO',conn:'BASE',jurado:'EXPERTO/EXAMINADOR',mirror:'ATIS'})}; vm.createContext(sb); vm.runInContext(f,sb);
  const P=(x)=>sb.personalizarNombres(x,'',false);
  t('«el robot TARS-2» queda igual', P('el robot TARS-2 es otro')==='el robot TARS-2 es otro', P('el robot TARS-2 es otro'));
  t('«TARS2» y «X-TARS» quedan igual', P('TARS2 y X-TARS')==='TARS2 y X-TARS', P('TARS2 y X-TARS'));
  t('control: «TARS» suelto SÍ se renombra', P('pasá a TARS.')==='pasá a MODO ANALÍTICO.', P('pasá a TARS.'));
  t('control: al principio y entre comas también', P('TARS, CONEX y EXAMINADOR')==='MODO ANALÍTICO, BASE y EXPERTO/EXAMINADOR', P('TARS, CONEX y EXAMINADOR'));
  t('sin lookbehind (iOS viejo)', !/\(\?<[=!]/.test(f));
}
console.log('\n'+(bad===0?'✅ TODO VERDE — '+ok+' pruebas pasan (átomo dato de agenda + v40-codigos)':'❌ '+bad+' fallos de '+(ok+bad)));
process.exit(bad===0?0:1);
