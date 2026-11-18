/* TEST v59-caldate — el link de «abrir calendario» ahora lleva la fecha computada.
   POR QUÉ: en la auditoría en vivo (10/09) Google abría en HOY aunque MIRROR ya sabía
   el día (la tarea persistente lo calcula). Amarra: la fecha va como evento de día
   completo (fin exclusivo), sin fecha se comporta igual que antes, el borde de fin de
   año no rompe, y el link sigue pasando la lista blanca. Las DOS muletas. */
const fs=require('fs'), path=require('path'), vm=require('vm');
const BASE=path.join(__dirname,'..');
const FILES={MIRROR:path.join(BASE,'MIRROR','index.html'), PLATAFORMA:path.join(BASE,'PLATAFORMA','index.html')};
// [repo] en el repo de la plataforma no está MIRROR/index.html: se prueba solo lo que existe
for (const _k of Object.keys(FILES)) if (!fs.existsSync(FILES[_k])) delete FILES[_k];
let ok=0,bad=0;
function t(l,c,e){ if(c)ok++; else {bad++; console.log('  ❌ '+l+(e?'  → '+e:''));} }
function grabFunc(H,name){ const i=H.indexOf('function '+name+'('); if(i<0)return''; let d=0; for(let p=H.indexOf('{',i);p<H.length;p++){const c=H[p]; if(c==='{')d++; else if(c==='}'){d--; if(d===0)return H.slice(i,p+1);}} return ''; }
function grabLinea(H,marca){ const i=H.indexOf(marca); if(i<0)return''; return H.slice(i, H.indexOf('\n',i)); }

for(const [nombre,file] of Object.entries(FILES)){
  console.log('\n━━━ '+nombre+' ━━━');
  const H=fs.readFileSync(file,'utf8');
  // firma nueva (2 args) y el uso en los dos sitios
  t('CALDATE: actuaCalURL toma la fecha', /function actuaCalURL\(t, ?fechaISO\)/.test(H));
  // v40-agendar (2/10, plataforma): la fecha se calcula una vez (_f) y el título va sin la fecha — se acepta esa forma también
  t('CALDATE: sitio local ★N2 pasa la fecha', /actuaCalURL\(t,_tareaFecha\(m\.input\|\|t\)\)/.test(H) || (/const _f=_tareaFecha\(m\.input\|\|m\[1\]\)/.test(H) && /actuaCalURL\(t,_f\)/.test(H)));
  t('CALDATE: sitio del modelo pasa la fecha', /actuaCalURL\(String\(a\.titulo\)\.slice\(0,80\),_tareaFecha\(/.test(H) || (/const _f=_tareaFecha\(_ped\)/.test(H) && /actuaCalURL\(_t,_f\)/.test(H)));

  const bloque=[ '_tareaISO','_tareaFecha','actuaCalURL','actuaURLValida' ].map(n=>grabFunc(H,n)).join('\n')
    + '\n' + grabLinea(H,'const ACTUA_URL_OK=');
  const sb={String,RegExp,Object,Array,Math,Date,JSON,isNaN,encodeURIComponent,console};
  vm.createContext(sb);
  vm.runInContext(bloque
    + '\n;globalThis.__con = actuaCalURL("Reunión de padres","2026-09-17");'
    + 'globalThis.__sin = actuaCalURL("Algo suelto","");'
    + 'globalThis.__nye = actuaCalURL("Fin de año","2026-12-31");'
    + 'globalThis.__fJue = _tareaFecha("agenda reunion para el 17/09/2026");'
    + 'globalThis.__intg = actuaCalURL("Reunión", _tareaFecha("agenda algo el 17/09/2026"));'
    + 'globalThis.__okCon = actuaURLValida(globalThis.__con);'
    + 'globalThis.__okSin = actuaURLValida(globalThis.__sin);'
  , sb);

  t('CALDATE: con fecha → &dates de día completo (fin exclusivo)', /&dates=20260917\/20260918/.test(sb.__con), sb.__con);
  t('CALDATE: con fecha → el título sigue puesto', /text=Reuni/.test(sb.__con), sb.__con);
  t('CALDATE: SIN fecha → no agrega &dates (igual que antes)', sb.__sin.indexOf('&dates=')<0, sb.__sin);
  t('CALDATE: borde fin de año → fin rota a 20270101', /&dates=20261231\/20270101/.test(sb.__nye), sb.__nye);
  t('CALDATE·integración: _tareaFecha del 17/09 → ISO correcto', sb.__fJue==='2026-09-17', sb.__fJue);
  t('CALDATE·integración: la fecha computada llega al link', /&dates=20260917\/20260918/.test(sb.__intg), sb.__intg);
  t('CALDATE: link CON fecha pasa la lista blanca', sb.__okCon===true, sb.__con);
  t('CALDATE: link SIN fecha pasa la lista blanca', sb.__okSin===true, sb.__sin);
}
console.log('\n'+(bad===0?'✅ TODO VERDE — '+ok+' pruebas pasan (las dos muletas)':'❌ '+bad+' fallos de '+(ok+bad)));
process.exit(bad===0?0:1);
