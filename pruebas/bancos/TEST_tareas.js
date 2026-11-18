/* TEST v58/v39-tareas — agenda/tareas persistente en las DOS muletas.
   Amarra: parseo de fechas, guardar+dedup, activas ordenadas, marcar hecha, recall por chat. */
const fs=require('fs'), path=require('path'), vm=require('vm');
const BASE=path.join(__dirname,'..');
const FILES={MIRROR:path.join(BASE,'MIRROR','index.html'), PLATAFORMA:path.join(BASE,'PLATAFORMA','index.html')};
// [repo] en el repo de la plataforma no está MIRROR/index.html: se prueba solo lo que existe
for (const _k of Object.keys(FILES)) if (!fs.existsSync(FILES[_k])) delete FILES[_k];
let ok=0,bad=0;
function t(l,c,e){ if(c)ok++; else {bad++; console.log('  ❌ '+l+(e?'  → '+e:''));} }
function grabFunc(H,name){ const i=H.indexOf('function '+name+'('); if(i<0)return''; let d=0,k=H.indexOf('{',i); for(let p=k;p<H.length;p++){const c=H[p]; if(c==='{')d++; else if(c==='}'){d--; if(d===0)return H.slice(i,p+1);}} return ''; }
function iso(d){ const z=new Date(d.getTime()-d.getTimezoneOffset()*60000); return z.toISOString().slice(0,10); }
const HOY=iso(new Date()); const MAN=(()=>{const d=new Date();d.setDate(d.getDate()+1);return iso(d);})();

for(const [nombre,file] of Object.entries(FILES)){
  console.log('\n━━━ '+nombre+' ━━━');
  const H=fs.readFileSync(file,'utf8');
  t('TAREAS: funciones presentes', /function tareaGuardar/.test(H)&&/function getTareasContext/.test(H)&&/function renderTareas/.test(H));
  // v40-agendar (2/10, plataforma): la tarea se guarda con el título SIN la fecha (_t / t) y la fecha ya calculada (_f)
  t('TAREAS: se captura al armar la tarjeta cal', (/tareaGuardar\(String\(a\.titulo\)/.test(H) && /tareaGuardar\(t, _tareaFecha/.test(H)) || (/tareaGuardar\(_t, _f\)/.test(H) && /tareaGuardar\(t, _f\)/.test(H)));
  t('TAREAS: recall inyectado en el envío', /tareasRelevante/.test(H));
  t('TAREAS: aviso suave al abrir', /tareasAvisoInicial/.test(H));
  const nombresFn=['tareasCargar','tareasGuardarTodas','_tareaISO','_tareaFecha','_tareaNorm','tareaGuardar','tareasActivas','tareaHecha','tareaBorrar','_tareaFechaLinda','_tareaVence','tareasTexto','getTareasContext'];
  const bloque=nombresFn.map(n=>grabFunc(H,n)).join('\n');
  const store={}; const sb={String,RegExp,Object,Array,Math,Date,JSON,console,
    localStorage:{ getItem:k=>(k in store?store[k]:null), setItem:(k,v)=>{store[k]=String(v);} }, HOY, MAN };
  vm.createContext(sb);
  vm.runInContext(bloque
    +'\n;globalThis.__f1=_tareaFecha("recordame algo hoy");'
    +'globalThis.__f2=_tareaFecha("agenda la reunion para mañana");'
    +'globalThis.__f3=_tareaFecha("comprar pan");'
    +'globalThis.__g1=tareaGuardar("Revisar TP de 5to", MAN);'
    +'globalThis.__g2=tareaGuardar("Revisar TP de 5to", MAN);'   // duplicado exacto → false
    +'globalThis.__g3=tareaGuardar("Llamar al pediatra", HOY);'
    +'globalThis.__act=tareasActivas();'
    +'globalThis.__ctx0=getTareasContext("hola que tal");'
    +'globalThis.__ctx1=getTareasContext("¿qué tengo pendiente?");'
    , sb);
  t('TAREAS·fecha: "hoy" → ISO de hoy', sb.__f1===HOY, sb.__f1);
  t('TAREAS·fecha: "mañana" → ISO de mañana', sb.__f2===MAN, sb.__f2);
  t('TAREAS·fecha: sin fecha → vacío', sb.__f3==='', JSON.stringify(sb.__f3));
  t('TAREAS·guardar: primero entra', sb.__g1===true);
  t('TAREAS·guardar: duplicado exacto NO entra', sb.__g2===false);
  t('TAREAS·activas: hay 2 y ordenadas por fecha (hoy antes que mañana)', sb.__act.length===2 && sb.__act[0].fecha===HOY, JSON.stringify(sb.__act.map(x=>x.fecha)));
  t('TAREAS·recall: NO inyecta en pregunta cualquiera', sb.__ctx0==='');
  t('TAREAS·recall: SÍ inyecta con "pendiente" y lista las tareas', sb.__ctx1.indexOf('Revisar TP')>0 && sb.__ctx1.indexOf('Llamar al pediatra')>0, sb.__ctx1.slice(0,60));
}
console.log('\n'+(bad===0?'✅ TODO VERDE — '+ok+' pruebas pasan (las dos muletas)':'❌ '+bad+' fallos de '+(ok+bad)));
process.exit(bad===0?0:1);
