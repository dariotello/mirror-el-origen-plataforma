/* TEST v40-nube (23/11/2026) — LA APP OPERA EN LA NUBE, en Node puro. Darío (22/11): «…QUE LA APP OPEREN EN LA NUBE ARMANDO Y
   DESARMANDO LO QUE EL USUARIO NECESITA Y SE LO TRAE, CUANDO EL USUARIO NO LO NECESITA MÁS SE DESENSAMBLA…».
   Mira: el index arranca SIN las piezas (solo el cargador); el catálogo de atomos/ es coherente (cada archivo con su huella);
   las dos recetas comparten átomos; el armador valida y RECHAZA recetas con átomos inventados, eventos o métodos que no existen;
   el átomo «calcular» hace bien las cuentas y no adivina. Sobre la 2026-11-18.1 da ROJO (no hay cargador ni nube). */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const BASE = path.join(__dirname, '..');
const H = fs.readFileSync(path.join(BASE, 'PLATAFORMA', 'index.html'), 'utf8');
let ok = 0, bad = 0;
function t(l, c, e){ if (c) ok++; else { bad++; console.log('  ❌ ' + l + (e !== undefined ? '  → ' + String(typeof e === 'string' ? e : JSON.stringify(e)).slice(0, 240) : '')); } }
const fin = () => { console.log('\n' + (bad === 0 ? '✅ TODO VERDE — ' + ok + ' pruebas pasan (la nube: cargar, armar, desarmar)' : '❌ ' + bad + ' fallos de ' + (ok + bad))); process.exit(bad ? 1 : 0); };
console.log('\n━━━ A · el index arranca SIN piezas: solo el cargador ━━━');
t('el index trae el cargador de la nube (v40-nube)', /EL CARGADOR DE LA NUBE/.test(H) && /function nubeTraer\(/.test(H) && /function nubePrepararManos\(/.test(H));
t('  y NO trae el átomo de agenda', H.indexOf('function datoAgendaEntender(') < 0);
t('  ni las plantillas de trámites (dejaron su «hueco» en la fila)', H.indexOf('const TRAMITE_PLANTILLAS') < 0 && /hueco: 'plantillas_tramite'/.test(H));
t('  ni el armador ni los átomos de pantalla', H.indexOf('function validar(r, cat)') < 0 && H.indexOf('ÁTOMO DE PANTALLA') < 0);
const REPO = [process.env.REPO_RAIZ, path.join(BASE, '..'), path.join(BASE, 'PLATAFORMA', 'PARA_DEPLOYAR_PLATAFORMA', 'PARA_EL_REPO')].filter(Boolean).find(r => fs.existsSync(path.join(r, 'atomos', 'catalogo.json')));
t('la nube (atomos/catalogo.json) existe', !!REPO);
if (!REPO) fin();
const N = path.join(REPO, 'atomos');
const cat = JSON.parse(fs.readFileSync(path.join(N, 'catalogo.json'), 'utf8'));
console.log('\n━━━ B · el catálogo de la nube ━━━');
t('tiene átomos y recetas', cat.atomos.length >= 9 && cat.recetas.length >= 2, cat.atomos.length + ' / ' + cat.recetas.length);
for (const a of cat.atomos){
  const f = path.join(N, a.archivo), ex = fs.existsSync(f);
  t('«' + a.id + '»: su archivo existe y la huella coincide', ex && crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex') === a.huella);
  t('«' + a.id + '»: clase y ficha', /^(pantalla|lógica)$/.test(a.clase) && a.nombre && a.description && Array.isArray(a.eventos) && Array.isArray(a.metodos));
}
for (const r of cat.recetas) t('receta «' + r.id + '»: su archivo existe y la huella coincide', fs.existsSync(path.join(N, r.archivo)) && crypto.createHash('md5').update(fs.readFileSync(path.join(N, r.archivo))).digest('hex') === r.huella);
const RC = cat.recetas.find(r => r.id === 'calculadora'), RL = cat.recetas.find(r => r.id === 'lista');
t('hay 🧮 calculadora y 📝 lista', !!RC && !!RL);
const comp = RC && RL ? RC.atomos.filter(a => RL.atomos.indexOf(a) >= 0) : [];
t('las dos recetas COMPARTEN átomos (superficie, campo, botón)', ['superficie', 'campo', 'boton'].every(a => comp.indexOf(a) >= 0), comp);
const fab = id => require(path.join(N, id + '.js'));
console.log('\n━━━ C · el armador valida: sin átomos inventados ━━━');
const armador = fab('armador')();
const recetaC = JSON.parse(fs.readFileSync(path.join(N, 'recetas', 'calculadora.json'), 'utf8'));
const recetaL = JSON.parse(fs.readFileSync(path.join(N, 'recetas', 'lista.json'), 'utf8'));
t('la receta 🧮 pasa la validación', armador.validar(recetaC, cat).length === 0, armador.validar(recetaC, cat));
t('la receta 📝 pasa la validación', armador.validar(recetaL, cat).length === 0, armador.validar(recetaL, cat));
const cl = o => JSON.parse(JSON.stringify(o));
let r = cl(recetaC); r.atomos.push('quitar_fondo'); let m = armador.validar(r, cat);
t('control: un átomo que no está en el catálogo («quitar_fondo») → rechazada y lo nombra', m.some(x => /quitar_fondo/.test(x)), m);
r = cl(recetaC); r.enlaces[0].cuando = 'igual.vuela'; m = armador.validar(r, cat);
t('control: un evento que el átomo no declara → rechazada', m.length > 0, m);
r = cl(recetaC); r.enlaces[0].metodo = 'borrarTodo'; m = armador.validar(r, cat);
t('control: un método que el átomo no declara → rechazada', m.length > 0, m);
r = cl(recetaC); r.enlaces[0].pasar_por = 'boton'; m = armador.validar(r, cat);
t('control: pasar por un átomo de pantalla como si fuera lógica → rechazada', m.length > 0, m);
r = cl(recetaL); r.atomos = r.atomos.filter(a => a !== 'superficie'); m = armador.validar(r, cat);
t('control: sin superficie → rechazada', m.length > 0, m);
t('control: algo que no es receta → rechazada', armador.validar({ hola: 1 }, cat).length > 0);
console.log('\n━━━ D · el átomo «calcular»: las cuentas las hace el código ━━━');
const calc = fab('calcular')();
[['(3+4)*2', '= 14'], ['2^10', '= 1024'], ['10/4', '= 2,5'], ['3,5+1,5', '= 5'], ['50%*200', '= 100'], ['-3*-3', '= 9'], ['0,1+0,2', '= 0,3'], ['7 × 6', '= 42'], ['9 ÷ 3', '= 3']]
  .forEach(([q, e]) => { const v = calc.ejecutar(q); t('«' + q + '» ' + e, v === e, v); });
['1/0', '2+', '((2)', 'alert(1)', 'process.exit()', ''].forEach(q => { const v = calc.ejecutar(q); t('control: «' + q + '» → no adivina', /^No entiendo esa cuenta/.test(v), v); });
console.log('\n━━━ E · los átomos de las manos que viven en la nube ━━━');
const ag = cat.atomos.find(a => a.id === 'dato_agenda'), pl = cat.atomos.find(a => a.id === 'plantillas_tramite');
t('Dato de agenda: en la nube, se ensambla en manos, dormible, con pista y aviso', ag && ag.se_ensambla_en === 'manos' && ag.dormible === true && ag.pista && ag.aviso_si);
const pista = new RegExp(ag.pista, 'i');
t('  su pista toma «¿Me pasás la dirección de mail de Laura?» y «LA TENÉS EN CONTACTOS»', pista.test('¿Me pasás la dirección de mail de Laura?') && pista.test('LA TENÉS EN CONTACTOS'));
t('  control: «explicame la tabla periódica» y «contame un chiste» NO la traen', !pista.test('explicame la tabla periódica') && !pista.test('contame un chiste'));
t('Plantillas de trámites: en la nube, se ensamblan en manos', pl && pl.se_ensambla_en === 'manos' && pl.pista);
fin();
