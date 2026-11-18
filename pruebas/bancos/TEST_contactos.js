/* TEST v58/v39-contactos — el parser de importación (vCard + CSV) en las DOS muletas.
   Amarra: extrae bien nombre/tel/email, normaliza teléfonos, descarta lo que no sirve. */
const fs=require('fs'), path=require('path'), vm=require('vm');
const BASE=path.join(__dirname,'..');
const FILES={MIRROR:path.join(BASE,'MIRROR','index.html'), PLATAFORMA:path.join(BASE,'PLATAFORMA','index.html')};
// [repo] en el repo de la plataforma no está MIRROR/index.html: se prueba solo lo que existe
for (const _k of Object.keys(FILES)) if (!fs.existsSync(FILES[_k])) delete FILES[_k];
let ok=0,bad=0;
function t(l,c,e){ if(c)ok++; else {bad++; console.log('  ❌ '+l+(e?'  → '+e:''));} }
function grabFunc(H,name){ const i=H.indexOf('function '+name+'('); if(i<0)return''; let d=0,k=H.indexOf('{',i); for(let p=k;p<H.length;p++){const c=H[p]; if(c==='{')d++; else if(c==='}'){d--; if(d===0)return H.slice(i,p+1);}} return ''; }

const VCARD=[
'BEGIN:VCARD','VERSION:3.0','FN:Laura Peña','TEL;TYPE=CELL:+54 9 299 422-3453','EMAIL;TYPE=HOME:laura@mail.com','END:VCARD',
'BEGIN:VCARD','VERSION:3.0','N:Gómez;Juan;;;','TEL:2995551234','END:VCARD',
'BEGIN:VCARD','VERSION:3.0','FN:Sin Datos','END:VCARD'   // sin tel ni mail → se descarta
].join('\n');

const CSV='Name,Phone 1 - Value,E-mail 1 - Value\nAna Ruiz,+5492990001122,ana@x.com\nPedro,2994567890,\n"Sosa, Marta",,marta@y.com\n';

for(const [nombre,file] of Object.entries(FILES)){
  console.log('\n━━━ '+nombre+' ━━━');
  const H=fs.readFileSync(file,'utf8');
  t('CONTACTOS: parser presente', /function contactosParse/.test(H) && /function contactosImportarArchivo/.test(H));
  t('CONTACTOS: botón importar en el panel', /ag-import/.test(H) && /contactosImportarArchivo\(event\)/.test(H));
  t('CONTACTOS: es local (FileReader, sin fetch en el importador)', /readAsText/.test(H));
  t('CONTACTOS·ayuda: hay guía de export en la app (contacts.google.com + .vcf)', /class="ag-ayuda"/.test(H) && /contacts.google.com/.test(H) && /\.vcf/i.test(H));
  const bloque=[grabFunc(H,'_contNormTel'),grabFunc(H,'_contCsvFilas'),grabFunc(H,'contactosParse')].join('\n');
  const sb={String,RegExp,Object,Array,Math,VCARD,CSV,console}; vm.createContext(sb);
  vm.runInContext(bloque+'\n;globalThis.__V=contactosParse(VCARD); globalThis.__C=contactosParse(CSV);',sb);
  const V=sb.__V, C=sb.__C;
  // vCard
  t('vCard: extrae 2 contactos (descarta el sin datos)', V.length===2, 'len='+V.length+' '+JSON.stringify(V));
  t('vCard: FN como nombre', V[0].nombre==='Laura Peña', V[0].nombre);
  t('vCard: teléfono normalizado con +', V[0].tel==='+5492994223453', V[0].tel);
  t('vCard: email tomado', V[0].email==='laura@mail.com', V[0].email);
  t('vCard: N (apellido;nombre) → "Juan Gómez"', V[1].nombre==='Juan Gómez', V[1].nombre);
  t('vCard: teléfono sin + queda solo dígitos', V[1].tel==='2995551234', V[1].tel);
  // CSV
  t('CSV: extrae 3 contactos', C.length===3, 'len='+C.length+' '+JSON.stringify(C));
  t('CSV: nombre + tel', C[0].nombre==='Ana Ruiz' && C[0].tel==='+5492990001122', JSON.stringify(C[0]));
  t('CSV: fila con coma entre comillas se respeta', C.some(x=>x.nombre==='Sosa, Marta' && x.email==='marta@y.com'), JSON.stringify(C));
}
console.log('\n'+(bad===0?'✅ TODO VERDE — '+ok+' pruebas pasan (las dos muletas)':'❌ '+bad+' fallos de '+(ok+bad)));
process.exit(bad===0?0:1);
