/* ══════════ v40-datoagenda (06/11/2026) — ÁTOMO «DATO DE AGENDA» (mini MIRROR) ══════════
   ☁ 23/11/2026 (v40-nube): este átomo YA NO VIVE EN EL INDEX. Vive en la nube (atomos/dato_agenda.js, lo publica armar.js),
   el cargador lo trae cuando el pedido lo necesita, lo usa y lo SUELTA al terminar el turno. Este archivo es el CUERPO de su
   fábrica: todo queda adentro (nada global) y al final devuelve { regla, entender }.
   HALLAZGO EN VIVO DE DARÍO (29/10, 15:16–15:20): Laura está guardada en 📇 con su mail y, a
   «¿Me pasás la dirección de mail de Laura?» → «LA TENÉS EN CONTACTOS», la entidad contestó
   «No tengo la dirección de mail de Laura. ¿Me la pasás?».
   CAUSA (reproducida en Chromium sobre la 29.2): ninguna regla de las manos entendía «me pasás»
   (la F4 pide «pasame») ni «la tenés en contactos», así que las dos frases iban al modelo. Y el
   modelo NO ve la agenda (desde la 23.1, por privacidad, teléfonos y mails no viajan). Contestó
   lo único honesto que podía, pero la app SÍ tenía el dato.
   ARREGLO DE ARQUITECTURA (no de frase): un DATO de la agenda lo contesta la APP, desde el código.
   Es un ÁTOMO: una pieza chica, con ficha propia, que se ENCHUFA sola a las manos (se mete
   adelante en ACTUA_CMDS al ensamblarse) y se puede dormir sin romper nada (estado en la ficha:
   si `datoAgendaDespierto()` da false, no matchea y todo sigue como antes).
   REGLAS:
   · Si el nombre resuelve a UN contacto → da el dato pedido (mail, número, WhatsApp, dirección)
     con su tarjeta de un toque. El último toque sigue siendo del usuario.
   · Si hay dos (dos «Laura») → pregunta cuál (actuaPedirPrecisar, que recuerda el pedido).
   · Si no está en la agenda → lo dice de frente SOLO si el pedido habla de agenda/contactos.
     «¿me pasás el número de la policía?» o «dame la dirección de la Casa Rosada» son preguntas
     generales: van al modelo como siempre (el átomo devuelve null y no se mete).
   · «LA TENÉS EN CONTACTOS» toma el último intercambio (el último pedido del usuario o lo que
     contestó la entidad) para saber de quién y de qué dato se hablaba.
   · El dato no viaja al modelo: la respuesta la pinta la capa local, y al historial va tapado
     (agendaSinDatos, v40-agendapriv). */
function datoAgendaDespierto(){ if (typeof DATO_AGENDA_ESTADO !== 'undefined' && DATO_AGENDA_ESTADO !== 'despierto') return false; return (typeof piezaDespierta === 'function') ? piezaDespierta('dato_agenda') : true; } // v40-piezas: el usuario lo puede dormir
const DATO_AGENDA_ESTADO = 'despierto'; // lo dicta organos/dato_agenda/ficha.json («estado»)
const DATO_AGENDA_PIDE = /(?:me\s+pas[aá]s|pas[aá](?:me)?|me\s+das|dame|dec[ií]me|me\s+dec[ií]s|ten[eé]s|tienes|sab[eé]s|cu[aá]l\s+es|necesito|quiero|busc[aá](?:me)?|mostr[aá](?:me)?|fij[aá]te)\b/i;
const DATO_AGENDA_HABLA_AGENDA = /\b(?:agenda|contactos?)\b/i;
// qué dato se pide. El orden importa: «dirección de mail» es MAIL, no domicilio.
function datoAgendaTipo(t){
  t = String(t || '');
  if (/(?:e-?mail|mail|correo)/i.test(t)) return 'mail';
  if (/whats?app|wasap|wsp/i.test(t)) return 'wa';
  if (/n[uú]mero|tel[eé]fono|celu(?:lar)?|m[oó]vil/i.test(t)) return 'tel';
  if (/direcci[oó]n|domicilio|d[oó]nde\s+vive/i.test(t)) return 'dir';
  return '';
}
// el nombre: lo que sigue al último «de/a» del pedido, sin la cola «en contactos», «?», etc.
function datoAgendaNombre(t){
  let s = String(t || '').replace(/[?¿!¡.]+/g, ' ').trim()
    .replace(/\s*,?\s*(?:que\s+|y\s+|si\s+)?(?:(?:lo|la)\s+)?(?:est[aá]|ten[eé]s|tengo|guard[aá]\w*|anot[aá]\w*)?\s*(?:en|de)\s+(?:la\s+|mi\s+|mis\s+|tu\s+|tus\s+|los\s+)?(?:agenda|contactos?)\s*$/i, '').trim();
  // el ÚLTIMO «de/a»: en «la dirección de mail de Laura» el nombre es «Laura», no «mail de Laura»
  const m = /^(?:.*\s)?(?:de|a)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ' ]{1,29})$/i.exec(s); // v40-nube: /i — Darío escribe en mayúsculas («¿ME PASAS EL MAIL DE LAURA?»)
  if (!m) return '';
  const n = m[1].trim();
  if (/^(?:la|el|los|las|un|una|mi|tu|su|mail|correo|whatsapp|n[uú]mero|tel[eé]fono|celu(?:lar)?|direcci[oó]n|contacto|agenda)$/i.test(n)) return '';
  if (/^(?:la|el|los|las|un|una|mi|tu|su)\s/i.test(n)) return '';   // «de la policía», «de mi hermana»: no es un nombre de la agenda
  return n;
}
// «LA TENÉS EN CONTACTOS», «está en mis contactos», «fijate en la agenda», «buscala en contactos»…
const DATO_AGENDA_REMITE = /^\s*(?:pero\s+|si\s+|ya\s+|che,?\s+|dale,?\s+)*(?:(?:la|lo|las|los)\s+)?(?:ten[eé]s|tienes|est[aá]|lo\s+ten[eé]s|la\s+ten[eé]s|fij[aá]te|busc[aá](?:l[oa]|me)?|mir[aá])\s+(?:guardad[oa]\s+)?(?:en|entre)\s+(?:la\s+|mi\s+|mis\s+|tu\s+|tus\s+|los\s+)?(?:agenda|contactos)\b[\s?!.]*$/i;
function datoAgendaPedidoPrevio(){
  try {
    const h = (typeof history !== 'undefined' && Array.isArray(history)) ? history : [];
    for (let i = h.length - 1, n = 0; i >= 0 && n < 4; i--, n++){
      const c = String((h[i] && h[i].content) || '');
      const tipo = datoAgendaTipo(c), nom = datoAgendaNombre(c.split(/[.!?\n]/).filter(function(x){ return datoAgendaTipo(x); }).pop() || c);
      if (tipo && nom) return { tipo: tipo, nombre: nom };
    }
  } catch(e){}
  return null;
}
function datoAgendaEntender(text, aunqueDuerma){
  if (!aunqueDuerma && !datoAgendaDespierto()) return null;   // v40-nube: dormida, el cargador igual pregunta «¿esto era mío?» para avisar (hallazgo 3 del 18/11)
  const t = String(text || '').trim();
  if (!t || t.length > 90) return null;
  if (DATO_AGENDA_REMITE.test(t)){
    const p = datoAgendaPedidoPrevio();
    return p ? { tipo: p.tipo, nombre: p.nombre, remite: true, agenda: true } : { tipo: '', nombre: '', remite: true, agenda: true };
  }
  // un pedido de DATO: verbo de pedir + tipo de dato + «de <nombre>». Nada de mandar/llamar: eso es de las manos.
  if (/^\s*(?:mand|escrib|llam|marc|avis|agend|record|guard|anot|borr|elimin)/i.test(t)) return null;
  if (/(?:^|\s)(?:mand[aá]\w*|escrib\w*|reenvi\w*|contest[aá]\w*|respond\w*|llam[aá](?:le|la|lo|r)?|avis[aá]\w*)(?=\s|$)/i.test(t)) return null; // «quiero mandarle un mail a Laura» es de las manos (redactar), no un dato
  if (!DATO_AGENDA_PIDE.test(t)) return null;
  const tipo = datoAgendaTipo(t); if (!tipo) return null;
  const nombre = datoAgendaNombre(t); if (!nombre) return null;
  const agenda = DATO_AGENDA_HABLA_AGENDA.test(t);
  const hay = actuaCandidatos(nombre).length > 0;
  if (!hay && !agenda) return null;   // pregunta general («el número de Pedro Picapiedra»): es del modelo
  return { tipo: tipo, nombre: nombre, remite: false, agenda: agenda };
}
const DATO_AGENDA_PALABRA = { mail:'mail', wa:'WhatsApp', tel:'número', dir:'dirección' };
function datoAgendaResponder(d){
  if (!d.nombre) return 'Decime de quién y qué dato (mail, número o dirección) y lo busco en tu agenda local: «¿me pasás el mail de <nombre>?».';
  const c = actuaContacto(d.nombre);
  const pal = DATO_AGENDA_PALABRA[d.tipo] || 'dato';
  if (!c){
    const amb = actuaPedirPrecisar(d.nombre, 'te paso su ' + pal, 'datos', '');
    if (amb) return amb;
    return 'No tengo a «' + d.nombre + '» en tu agenda local, así que su ' + pal + ' no lo sé, y no lo voy a inventar. Si me lo dictás («guardá el mail de ' + d.nombre + ' <mail>»), queda en TU dispositivo.';
  }
  const nom = c.nombre || d.nombre;
  const priv = ' Sale de tu agenda local: en la charla guardada no queda, y al modelo no le llega.';
  if (d.tipo === 'mail'){
    if (!actuaMailDirOk(c.email)) return 'Tengo a «' + nom + '» en tu agenda, pero sin mail cargado.' + (c.tel ? ' Sí tengo su número.' : '') + ' Guardalo con «guardá el mail de ' + nom + ' <mail>».';
    actuaTarjeta('✉', 'Mail a ' + nom, 'Se abre tu correo con la dirección puesta. Lo escribís y lo mandás vos.', actuaMailURL(c.email, '', ''), '✉ escribirle');
    return 'El mail de ' + nom + ' es ' + c.email + ' ✅ — te dejo la tarjeta para escribirle.' + priv;
  }
  if (d.tipo === 'tel' || d.tipo === 'wa'){
    if (!c.tel) return 'Tengo a «' + nom + '» en tu agenda, pero sin número cargado.' + (c.email ? ' Sí tengo su mail.' : '') + ' Guardalo con «guardá el número de ' + nom + ' <número>».';
    if (d.tipo === 'wa') actuaTarjeta('💬', 'WhatsApp a ' + nom, 'Se abre WhatsApp con el chat de ' + nom + '. El mensaje lo escribís y lo mandás vos.', actuaWaURL(c.tel, ''), '💬 abrir WhatsApp');
    else actuaTarjeta('📞', 'Llamar a ' + nom, 'Un toque y se marca. La llamada la hacés vos.', actuaTelURL(c.tel), '📞 llamar');
    return (d.tipo === 'wa' ? 'El WhatsApp de ' : 'El número de ') + nom + ' es ' + c.tel + ' ✅ — te dejo la tarjeta' + (d.tipo === 'wa' ? ' para abrir el chat.' : ' para llamar.') + priv;
  }
  if (d.tipo === 'dir'){
    if (!c.dir) return 'Tengo a «' + nom + '» en tu agenda, pero sin dirección cargada. Guardala con «guardá la dirección de ' + nom + ' <dirección>».';
    actuaTarjeta('🗺', 'Cómo llegar: ' + nom, 'Se abre el mapa con la dirección de ' + nom + '.', actuaMapsURL(c.dir), '🗺 abrir el mapa');
    return 'La dirección de ' + nom + ' es ' + c.dir + ' ✅ — te dejo el mapa.' + priv;
  }
  return 'Tengo a «' + nom + '» en tu agenda. Decime qué dato querés: mail, número o dirección.';
}
// Se ENSAMBLA a las manos: el cargador pone esta regla en la fila (detrás de la de piezas) y la saca al terminar.
// La exclusión va en exec (devuelve null), así que no le roba nada a ninguna otra regla.
return {
  regla: {
    atomo: 'dato_agenda',
    re: { source: 'v40-datoagenda', exec: function(t){ const d = datoAgendaEntender(t); return d ? Object.assign([String(t)], { dato: d }) : null; }, test: function(t){ return !!datoAgendaEntender(t); } },
    run: function(m){ return datoAgendaResponder(m.dato); }
  },
  entender: function(t, aunqueDuerma){ try { return datoAgendaEntender(t, aunqueDuerma); } catch(e){ return null; } }
};
/* ══════════ FIN v40-datoagenda ══════════ */
