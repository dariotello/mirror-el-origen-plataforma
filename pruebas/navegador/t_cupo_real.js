// t_cupo_real.js — sesión LARGA y realista (10 turnos previos largos + 30 recuerdos): ¿el pedido entra en el cupo de 8000,
// sobrevive el último ida y vuelta y llega lo importante? (v40-cupo2, 3/10). Uso: FILE=…/index.html node t_cupo_real.js
const { abrir } = require('./harness');
let ok=0,bad=0; const t=(m,c,x)=>{ if(c){ok++;console.log('  ✅ '+m);} else {bad++;console.log('  ❌ '+m+(x!==undefined?' → '+JSON.stringify(x).slice(0,300):''));} };
(async()=>{
  const h=await abrir({fb:true, cfg:{ appName:'MANIFIESTOS', perfil:{ nombre:'ATIS', rol:'Estudiante de 5º año', estilo:'directo y cálido' }, modos:{ mirror:'ATIS', tars:'MODO ANALÍTICO', jurado:'EXPERTO/EXAMINADOR', conn:'BASE' } },
    reply:'Me encantaría tener una mejor integración de voz y búsqueda por significado. Te cuento más si querés, con detalle y ejemplos de la escuela y de la vida diaria para que se entienda bien.'});
  await h.page.evaluate(()=>{
    for (let i=0;i<30;i++) recuerdosChunks.push(recuerdoArmar('el día '+i+' te conté que mi perra se llama Pochola y que fuimos a la plaza '+'a '.repeat(60), 'Qué lindo, Pochola es una genia. '+'b '.repeat(80)));
    for (let i=0;i<10;i++) history.push({role:'user',content:'turno viejo '+i+' '+'charla '.repeat(70)},{role:'assistant',content:'respuesta vieja '+i+' '+'respuesta '.repeat(90)});
  });
  const casos = [
    ['¿qué mejoras te gustaría tener?', b=>/mirá PRIMERO el índice/.test(b), 'lleva la regla de no negar + índice'],
    ['¿pero eso no lo tenés incorporado?', b=>/mirá PRIMERO el índice/.test(b) && /integración de voz/.test(b), 'lleva la arquitectura Y la respuesta anterior'],
    ['¿cómo se llama mi perra?', b=>/Pochola/.test(b), 'trae el recuerdo de Pochola'],
    ['¿tenés memoria de lo que hablamos?', b=>/NOTA DE HONESTIDAD/.test(b), 'lleva la nota de memoria'],
    ['contame un chiste de física', b=>true, 'charla común'],
    ['COMO ESTAS? QUE VERSIÓN ERES? ERES MEJOR QUE LAS ANTERIORES?', b=>/YA LO CONTESTÓ LA APP/.test(b), 'lleva la orden de datos fijos'],
    ['¿cuáles son esas ventajas?', b=>/VERSIÓN Y NOVEDADES/.test(b), 'repregunta de versión: lleva la fuente de verdad']
  ];
  for (const [q, chk, desc] of casos){
    const n0=h.srv._reqs.length; await h.page.fill('#inp',q); await h.page.keyboard.press('Enter'); await h.page.waitForTimeout(2300);
    const rq=h.srv._reqs.slice(n0); if (!rq.length){ t('«'+q+'» llegó al motor', false); continue; }
    const body=JSON.parse(rq[rq.length-1].body);
    const tot=await h.page.evaluate((b)=>{ const sal = salidaEfectiva(b.model, b.max_completion_tokens ? 700 : (b.max_tokens||700)); return b.messages.reduce((a,m)=>a+estimarTokens(m.content),0) + (b.max_completion_tokens||b.max_tokens||0); }, body);
    const ult=body.messages.slice(-1)[0].content, prev=body.messages.slice(-3,-1).map(m=>m.role+':'+m.content.slice(0,60));
    t('«'+q+'»: el pedido entra en 8000 (≈'+tot+')', tot<=8000, tot);
    t('   …'+desc, chk(rq.map(r=>r.body).join('\n')), ult.slice(0,200));
    t('   …y viaja el último ida y vuelta', body.messages.length>=4 && body.messages[body.messages.length-2].role==='assistant', prev);
  }
  t('sin errores JS', !(h.page._pe||[]).length && !(await h.page.evaluate(()=>window.__errores.length)), h.page._pe);
  console.log(bad?`❌ ${bad} fallas (${ok} OK)`:`✅ TODO VERDE — ${ok} pruebas (cupo en una sesión larga)`);
  await h.close(); process.exit(bad?1:0);
})();
