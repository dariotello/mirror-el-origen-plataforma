// ══════════ v36-actua (Etapa 3 Ciclo 2 — porte del v4.x, blindado 24/24) — MIRROR ACTÚA · NIVEL 1: MANOS PROPIAS ══════════
// MIRROR opera SU PROPIA app: capa local (sin modelo, sin red, cero tokens) que corre ANTES
// del envío y despacha pedidos simples a funciones que YA existen. REGLA DE HONESTIDAD:
// la confirmación («listo ✅») la pinta ESTA capa y SOLO si la acción se ejecutó de verdad;
// el modelo jamás afirma haber operado la app (regla 6.bis). Solo modo espejo (MIRROR):
// TARS y el jurado no tienen manos y lo dicen con honestidad, como siempre.
// Fuera de alcance (a mano, como siempre): borrar memoria/recuerdos, PIN, exportar, configuración.
// 100% ADITIVO: si esta capa explota, send() sigue por el camino clásico (try/catch total).
const ACTUA_MAX = 64; // más largo que esto es charla, no comando (guardia anti-falso-positivo)
/* ══════════ v47-decile (22/08/2026) — EL CONECTOR NO VIAJA DENTRO DEL MENSAJE ══════════
   HALLAZGO DE LA AUDITORÍA EN VIVO DE DARÍO (22/08): «mandale un mail a Laura, DECILE QUE voy
   tarde» abría el correo con el cuerpo «DECILE QUE VOY TARDE» — el conector quedaba adentro
   del texto que sale a nombre de Darío.
   POR QUÉ pasaba: en las reglas de mail y de WhatsApp el separador entre el destinatario y el
   mensaje es una alternancia, y la rama de la COMA (`\s*[:,]\s*`) se prueba ANTES que la rama
   del conector («decile que», «avisale que»…). Con coma de por medio, el conector nunca se
   consumía y viajaba entero al cuerpo. Sin coma («…a Laura y decile que…») sí se consumía —
   por eso el WhatsApp de la prueba salió bien y el mail no: la diferencia era la coma.
   POR QUÉ SE ARREGLA ACÁ Y NO EN LA REGEX: la regex tiene sus propias pruebas amarradas (F1,
   F2, destinatario no-greedy). Tocarla para esto es arriesgar lo que ya anda. Se limpia
   DESPUÉS del match, que es donde el problema realmente vive.
   SOLO se saca si el conector ABRE el mensaje: «decile que gracias» → «gracias», pero
   «gracias, decile a Ana que sí» no se toca. Y si al limpiar no queda nada, se devuelve el
   texto original: mejor un mensaje con un «decile» de más que una tarjeta vacía. */
function actuaLimpiaConector(msg){
  const t = String(msg||'').trim();
  const limpio = t.replace(/^(?:y\s+)?(?:dici[eé]ndo(?:le)?|avis[aá]ndo(?:le)?|cont[aá]ndo(?:le)?|decile|dec[ií]|avisale|avis[aá]|contale|cont[aá]|dile|di)\b[\s:,]*(?:en\s+)?(?:que\b\s*)?/i,'').trim();
  return limpio || t;
}
const ACTUA_CMDS = [
  { /* v38-share (C1): «compartí esto: …» / «mandá esto por donde sea» → selector del sistema.
       Va PRIMERA porque trae el texto adentro. El lookahead descarta los pedidos que SÍ
       nombran app o destinatario: esos son mejores por la tarjeta wa.me/mailto pre-llena,
       y esta regla ni siquiera matchea para no robarles el turno. (Acá el loop NO admite
       return null como en el MIRROR personal: la exclusión va en el patrón, no en el run.) */
    re: /^(?:compart[ií]r?(?:me|lo)?|mand[aá]r?(?:lo|me)?|pas[aá]r?(?:lo|me|selo|s[eé]lo)?)(?!.*\b(?:whats?app|wasap|mail|correo|gmail|outlook|telegram|sms|mensaje\s+a)\b)\s+(?:(?:esto|este\s+texto|lo\s+siguiente|el\s+siguiente\s+texto)|(?:por|a)\s+(?:donde\s+sea|quien\s+sea|donde\s+quieras|quien\s+quieras|otra\s+app|cualquier\s+app|la\s+app\s+que\s+quieras))\b\s*(?:(?:por|a)\s+(?:donde\s+sea|quien\s+sea|donde\s+quieras|quien\s+quieras|otra\s+app|cualquier\s+app|la\s+app\s+que\s+quieras))?\s*[:,.\-]?\s*([\s\S]{0,3000})$/i,
    run(m){
      const resto=String(m[1]||'').trim();
      if (!resto) return 'Decime QUÉ mando y te abro el selector: «compartí esto: <el texto>». Si ya sabés a quién y por dónde («mandale un whatsapp a Laura que…»), mejor todavía: te dejo la tarjeta con el destinatario puesto.';
      const ok=compartirTarjeta('📤','Mandarlo a donde quieras','',resto);
      if(!ok) return 'No pude armar la tarjeta — quedó en mi diagnóstico.';
      return mirrorCompartirSoporte()
        ? 'Listo ✅ — tocá la tarjeta y elegís la app y a quién. El «enviar» final lo das vos: yo dejo todo servido, no mando nada solo.'
        : 'Este navegador no me da el selector de compartir (pasa en la mayoría de las compus) — así que te lo dejo listo para copiar y pegar. En el celular sí te abre la lista de apps.';
    }
  },
  { /* v40-audit11 (3/10): «activá el modo fácil» llegaba al modelo, que no puede tocar la app. Ahora lo hacen las manos. */
    re: /^\s*(?:(?:activ[aá]|pon[eé]|prend[eé]|pas[aá](?:me)?\s+al?|entr[aá]\s+al?)\s+(?:el\s+)?modo\s+f[aá]cil|(?:sal[ií]|sac[aá]|apag[aá]|desactiv[aá]|quit[aá])\s+(?:del?\s+)?(?:el\s+)?modo\s+f[aá]cil)\s*[.!]*\s*$/i,
    run(m){
      const quiere = !/^\s*(?:sal|sac|apag|desactiv|quit)/i.test(m[0]);
      const esta = (typeof facilActivo === 'function') ? facilActivo() : false;
      if (quiere === esta) return quiere ? 'Ya estás en el modo fácil ✅ — para salir, «Aa salir del modo fácil».' : 'El modo fácil ya está apagado ✅.';
      try { facilToggle(); } catch(e){ return 'Quise cambiar el modo fácil y falló — quedó en mi diagnóstico.'; }
      return quiere ? 'Listo, modo fácil puesto ✅: letra grande, «🎧 hablame» para charlar por voz y «Aa salir del modo fácil» cuando quieras.' : 'Listo, saqué el modo fácil ✅. Vuelven todos los botones del pie.';
    }
  },
  { /* v40-audit11: «prendé la memoria que entiende» → el panel (bajar el modelo, ~118 MB, lo decide la persona con un toque) */
    re: /^\s*(?:activ[aá]|prend[eé]|apag[aá]|desactiv[aá]|abr[ií](?:me)?)\s+(?:la\s+)?memoria\s+que\s+entiende\s*[.!]*\s*$/i,
    run(){ try { semAbrir(); } catch(e){ return 'Quise abrir el panel de la memoria que entiende y falló — quedó en mi diagnóstico.'; }
           return 'Te abrí el panel de la 🧠 memoria que entiende: desde ahí se prende o se apaga (la primera vez baja ~118 MB, una sola vez, y queda en tu dispositivo).'; }
  },
  { /* v38-voz (F2): estado y descarga del dictado ON-DEVICE, siempre a pedido del usuario.
       Nunca se baja el paquete solo: son megas del usuario y es su decisión. */
    re: /(?:voz|dictado|micr[oó]fono)\s+(?:local|on[- ]?device|en\s+(?:el|mi)\s+dispositivo)|(?:activ[aá]r?|baj[aá]r?|instal[aá]r?)\s+(?:la\s+|el\s+)?(?:voz|dictado)\s+local|d[oó]nde\s+se\s+procesa\s+mi\s+voz/i,
    run(){
      if(!vozLocalSoporte()) return 'Este navegador no tiene voz on-device: cuando dictás, el audio lo transcribe el navegador afuera. La tienen Chrome y Edge 139 o más nuevos. Te lo digo de frente porque es tu voz.';
      if(vozLocalEstado==='disponible') return 'Tu dictado ya se procesa DENTRO del dispositivo 🔒 — el audio no sale de acá. Lo que escribís y mandás sí viaja al modelo, eso no te lo tapo.';
      if(vozLocalEstado==='desconocido'){ vozLocalProbar().then(function(){ try{ addMsg('mirror', vozLocalEstado==='disponible'?'Ya está: el dictado corre local 🔒.':'El paquete de voz local no está bajado todavía. Decime «bajá la voz local» y lo pido.'); }catch(e){} }); return 'Dejame fijarme…'; }
      setTimeout(function(){ vozLocalInstalar().then(function(msg){ try{ addMsg('mirror',msg); }catch(e){} }); },50);
      return 'Voy a pedirle al navegador el paquete de voz (son unos megas tuyos, por eso no lo bajo solo). Te aviso acá cómo salió.';
    }
  },
  { // ★13C (v36-lee): cortar la lectura de documentos («pará de leer», «cortá la lectura»)
    re: /(?:par[aá]|cort[aá]|bast[aá])(?:\s+ya)?\s*(?:de\s+)?(?:leer|la\s+lectura)/i,
    run(){ const habia=(typeof lecturaDoc!=='undefined'&&lecturaDoc)||(window.speechSynthesis&&speechSynthesis.speaking);
           if(typeof lecturaDoc!=='undefined') lecturaDoc=null;
           if(window.speechSynthesis) speechSynthesis.cancel();
           try{updateRagUI()}catch(e){}
           return habia?'Listo ✅ — corté la lectura.':'No estaba leyendo nada — silencio honesto.'; }
  },
  { // ★13C (v36-lee): leer un documento en voz alta («leeme el archivo notas», «leé el documento tesis»)
    re: /le[eé](?:me|le)?\s+(?:el\s+|la\s+|mi\s+)?(?:archivo|documento|doc|pdf|planilla)\s+(.{2,60})/i,
    run(m){ const q=m[1].trim().replace(/[.?!"«»]+$/,'').toLowerCase();
            if (typeof ragDocs==='undefined'||!ragDocs.length) return 'No tenés documentos cargados todavía — subilos con el botón ⊕ y después te los leo.';
            let idx=ragDocs.findIndex(d=>d.name.toLowerCase()===q);
            if (idx<0) idx=ragDocs.findIndex(d=>d.name.toLowerCase().includes(q));
            if (idx<0) return 'No encontré «'+q+'» entre tus documentos. Tenés: '+ragDocs.map(d=>d.name).join(' · ')+'.';
            const d=ragDocs[idx];
            if (!leerDocTexto(d).trim()) return '«'+d.name+'» no tiene texto acá a mano (sus fragmentos viven en tu memoria remota). Consultalo por chat y te leo la respuesta.';
            setTimeout(function(){ try{ leerDocArrancar(idx,{colar:true,silencioso:true}); }catch(e){ try{regError('lee:cmd',e)}catch(e2){} } }, 250); // se ENCOLA detrás de esta confirmación hablada
            return 'Dale ✅ — te leo «'+d.name+'» apenas termine de decirte esto. Esc o «pará de leer» lo cortan.'; }
  },
  { // ★N2: música puntual (género/artista) → tarjeta YouTube (va ANTES que la ambiental)
    re: /(?:pon[eé]|busc[aá])(?:me|nos)?\s+m[uú]sica\s+(?:de\s+|del\s+)?(.{2,40})|(?:pon[eé]|busc[aá])(?:me|nos)?\s+la\s+m[uú]sica\s+de\s+(.{2,40})/i,
    run(m){ const q=(m[1]||m[2]).trim().replace(/[.?!]+$/,'');
            if (/^(m[aá]s\s+)?(fuerte|alt[oa]|baj[oa]|bajito|despacio|suave)$/i.test(q)){
              if (!soundOn) return 'La música está apagada — decime «poné la música» y arranca.';
              const bajar=/baj|desp|suav/i.test(q); const p=volPaso(!bajar); // v37-vol (B1): paso relativo y persistente
              return (bajar?'Listo, la bajé ✅':'Listo, la subí ✅')+' — volumen al '+Math.round(p*100)+'%.'; }
            const ok=actuaTarjeta('🎵','Música: '+q,'YouTube con la búsqueda lista — el toque final es tuyo.',actuaYtURL('música '+q),'▶ abrir en YouTube');
            return ok?'Te dejé la música lista ✅ — un toque y suena.':'No pude armar la tarjeta — quedó en mi diagnóstico.'; }
  },
  { // v37-fix (Bug A): pedir un INFORME por chat abre el generador de informe (modal),
    // en vez de que el modelo emita una acción de mail y aparezca una tarjeta de correo errónea.
    re: /(?:gener[aá]r?|arm[aá]r?|hac[eé]r?|prepar[aá]r?|quiero|neces[ií]to|dame|pas[aá]me|pod[eé]s\s+(?:hacer|armar|generar))(?:me)?\s+(?:un\s+|el\s+|una?\s+)?(?:breve\s+|nuevo\s+)?informe\b(?!\s+(?:t[eé]cnico\s+)?(?:de|sobre|acerca\s+de|del)\s+(?:la\s+app|esta\s+app|la\s+aplicaci[oó]n|la\s+plataforma|vos|ti\b|tu\s|c[oó]mo\s+funcion|mirror|funcionamiento|arquitectura|sistema))/i, // v40-audit: «informe DE LA APP» es autoconocimiento, no el generador académico (hallazgo de Darío 24/09)
    run(){ try{ if (typeof abrirModalInforme==='function'){ abrirModalInforme(); return 'Te abrí el generador de informe 📄 — desde ahí lo armo con tus datos y documentos cargados, y lo bajás en Word, PDF o JSON.'; } }catch(e){}
           return 'El informe se genera con el botón «📄 generar informe» (abajo).'; }
  },
  { // v37-i18n (V36-7): cambiar de idioma por voz, sin volver al constructor
    re: /(?:habl[aá](?:me)?|pas[aá](?:te)?|cambi[aá]|pon[eé](?:te|lo)?)\s+(?:(?:el\s+|al\s+)?idioma\s+)?(?:a|al|en)?\s*(?:(?:el\s+)?idioma\s+)?(espa[nñ]ol|castellano|ingl[eé]s|english|portugu[eé]s|português)\b|^\s*(?:switch\s+to\s+)?(english|espa[nñ]ol|portugu[eê]s)\s*[.!]*$/i,
    run(m){ const q=String(m[1]||m[2]||'').toLowerCase();
            const l = /ingl|engl/.test(q) ? 'en' : (/portug/.test(q) ? 'pt' : 'es');
            if (typeof i18nCambiar !== 'function') return 'No pude cambiar el idioma acá — quedá en el constructor.';
            const ok = i18nCambiar(l);
            try { const b=document.getElementById('idiBtn'); if(b) b.textContent='🌐 '+l.toUpperCase(); } catch(e){}
            if (!ok) return 'No pude cambiar el idioma — quedó en mi diagnóstico.';
            return ({es:'Listo, sigo en español ✅ — la interfaz y el dictado también.',
                     en:'Done — I switch to English ✅. The interface and dictation follow.',
                     pt:'Pronto, sigo em português ✅ — a interface e o ditado também.'})[l]; }
  },
  { // v37-agenda (A2): guardar MAIL — va ANTES del de número
    re: /(?:guard[aá]|anot[aá])(?:me)?\s+(?:el\s+)?(?:mail|e-?mail|correo)\s+de(?:l)?\s+([^:,@]{2,30}?)[:,]?\s+([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i, // de(?:l)?: «del club» — fix del test adversario
    run(m){ const nombre=m[1].trim(), dir=m[2].trim();
            if (!actuaMailDirOk(dir)) return 'Esa dirección no me cierra («'+dir+'») — revisala y me la volvés a dictar.';
            if (!actuaAgendaGuardar(nombre,{email:dir})) return 'No pude guardarlo (el almacenamiento del navegador me lo negó) — quedó en mi diagnóstico.';
            return 'Guardado ✅ — el mail de «'+nombre+'» quedó en tu agenda local (vive en TU dispositivo, no sale de acá). Ahora «respondé este mail a '+nombre+'» ya sale con el destinatario puesto.'; }
  },
  { // v37-agenda (A2): guardar DIRECCIÓN
    re: /(?:guard[aá]|anot[aá])(?:me)?\s+(?:la\s+|el\s+)?(?:direcci[oó]n|domicilio)\s+de(?:l)?\s+([^:,]{2,30}?)(?:\s*[:,]\s*|\s+en\s+)(.{4,80})/i, // fixes del test adversario: «EL domicilio» y «DEL club»
    run(m){ const nombre=m[1].trim(), dir=m[2].trim().replace(/[.?!]+$/,'');
            if (!actuaAgendaGuardar(nombre,{dir:dir})) return 'No pude guardarlo (el almacenamiento del navegador me lo negó) — quedó en mi diagnóstico.';
            return 'Guardado ✅ — la dirección de «'+nombre+'» quedó en tu agenda local. Ahora «llevame a lo de '+nombre+'» te abre Maps ahí.'; }
  },
  { // ★N2: guardar contacto en la agenda local (ANTES que llamar/agendar)
    re: /(?:guard[aá]|anot[aá]|agend[aá])(?:me)?\s+(?:el\s+)?(?:n[uú]mero|contacto|tel[eé]fono)\s+de\s+([^:,\d]{2,30}?)[:,]?\s+(\+?[\d][\d\s().-]{5,19})/i, // fix: nombre sin dígitos y no-greedy (test adversario)
    run(m){ const nombre=m[1].trim(), num=m[2].trim();
            if (!actuaNumOk(num)) return 'Ese número no me cierra («'+num+'») — revisalo y me lo volvés a dictar.';
            actuaAgendaGuardar(nombre,{tel:num}); // v37-agenda (A2): campo explícito
            const r=actuaWaNum(num); // v37-tel (A1): honestidad sobre el formato internacional
            return 'Guardado ✅ — «'+nombre+'» quedó en tu agenda local (vive en TU dispositivo, no sale de acá). Ahora podés decirme «llamá a '+nombre+'».'
                   +(r.seguro?'':' Ojo: '+r.nota+'.'); }
  },
  { /* ── v41-cuantos (23/08/2026) · CONTAR LO QUE HAY EN LA AGENDA ────────────────────────────
       HALLAZGO EN VIVO (Darío, 23/08): «¿cuántas Marías tenés en la agenda?» se iba al modelo,
       y el modelo —que NO ve la agenda— contestó «no veo tu agenda, yo no tengo acceso a tus
       contactos». La app SÍ los tiene: están en localStorage, a dos líneas de distancia.
       Es el mismo agujero que v40-pendiente cerró para los pedidos de precisión: una pregunta
       que la capa puede responder con datos ciertos no puede terminar en una negación del
       modelo. Contar es justamente lo que una máquina no tiene por qué errar.
       ORDEN: va ANTES de «tenés el número de X» porque aquella captura cualquier cosa después
       de «tenés», y una pregunta que arranca con «cuántas» es de conteo, no de búsqueda.
       ALCANCE ACOTADO A PROPÓSITO: exige la palabra agenda/contactos (rama de nombre) o que lo
       contado sea contactos/números/mails (rama de total). «¿cuántos alumnos tenés?» no entra:
       eso es conversación y le pertenece al modelo. */
    re: /cu[aá]nt[oa]s\s+(?:contactos?|n[uú]meros?|tel[eé]fonos?|mails?|e-?mails?|correos?)\s+(?:ten[eé]s|tengo|hay|guard[aá]\w*)\b|cu[aá]nt[oa]s\s+([^\d:,]{2,30}?)\s+(?:ten[eé]s|tengo|hay|guard[aá]\w*)\b[^]*?\b(?:agenda|contactos?)\b/i,
    run(m){ const a=actuaAgenda(); const total=Object.keys(a).length;
            const q=String(m[1]||'').trim().replace(/[?¿.!]+$/,'').trim();
            const nombreLindo=k=>{ const v=a[k]; return (v && typeof v==='object' && v.nombre) ? v.nombre : k; };
            if (!q){ // rama TOTAL
              if (!total) return 'Tu agenda local está vacía: no tengo ningún contacto guardado. Para sumar uno: «guardá el número de <nombre> <número>», o abrí 📇 contactos.';
              return 'Tengo '+total+' contacto'+(total>1?'s':'')+' en tu agenda local: '+Object.keys(a).sort().map(nombreLindo).join(' · ')+'. (Vive en TU dispositivo, no sale de acá.)'; }
            /* Plural en criollo: «cuántas marías» pregunta por «maria». Se prueba tal cual y,
               si no da nada, sin la «s»/«es» final. No se inventa una raíz: si ninguna de las
               dos formas encuentra algo, se dice que no hay y listo. */
            let cand=actuaCandidatos(q); let usado=q;
            if (!cand.length){ const sing=q.replace(/(es|s)$/i,''); if (sing.length>=2 && sing!==q){ const c2=actuaCandidatos(sing); if (c2.length){ cand=c2; usado=sing; } } }
            if (!cand.length) return 'No tengo ningún «'+q+'» en tu agenda local'+(total?' (tengo '+total+' contacto'+(total>1?'s':'')+', ninguno con ese nombre)':' — de hecho está vacía')+'. No lo voy a inventar.';
            if (cand.length===1) return 'Uno solo: '+nombreLindo(cand[0])+'. Decime «buscá el contacto de '+nombreLindo(cand[0])+'» y te muestro sus datos.';
            return 'Tengo '+cand.length+' que coinciden con «'+usado+'»: '+cand.map(nombreLindo).join(' y ')+'. Cuando me pidas algo para «'+usado+'» te voy a preguntar cuál — no adivino.'; }
  },
  { // v37-agenda (A8, hallazgo de la prueba local 26/07): CONSULTAR la agenda.
    // Antes se podía GUARDAR pero no PREGUNTAR: la consulta se iba al modelo y el
    // usuario no tenía forma de ver qué había guardado. Se responde desde localStorage.
    re: /(?:ten[eé]s|tienes|hay|guard[aá]ste|anot[aá]ste)\s+(?:(?:el|la|algun|algún|un)\s+)?(?:n[uú]mero|tel[eé]fono|celu(?:lar)?|mail|e-?mail|correo|direcci[oó]n|domicilio|contacto|agendad[oa])\s*(?:de\s+(?:celu(?:lar)?|tel[eé]fono|m[oó]vil)\s*)?(?:de\s+|a\s+)?(.{2,30})/i,
    run(m){ const nombre=m[1].trim().replace(/[?.!¿]+$/,'').replace(/^(?:a|de|al)\s+/i,'').trim();
            if (!nombre) return 'Decime de quién y te lo busco en tu agenda local.';
            const c=actuaContacto(nombre);
            if (!c){ const amb=actuaPedirPrecisar(nombre,'te muestro sus datos','datos',''); if (amb) return amb; // v39-agenda + v40-pendiente
              return 'No tengo nada de «'+nombre+'» en tu agenda local, y no lo voy a inventar. Para guardarlo: «guardá el número de '+nombre+' <número>» — o el mail, o la dirección.'; }
            const partes=[];
            if (c.tel)   partes.push('📞 '+c.tel);
            if (c.email) partes.push('✉ '+c.email);
            if (c.dir)   partes.push('🗺 '+c.dir);
            if (!partes.length) return 'Tengo a «'+nombre+'» en la agenda pero sin ningún dato cargado. Guardalo de nuevo y listo.';
            const faltan=[]; if(!c.tel)faltan.push('número'); if(!c.email)faltan.push('mail'); if(!c.dir)faltan.push('dirección');
            return 'De «'+nombre+'» tengo: '+partes.join(' · ')+'.'
                   +(faltan.length?' Me falta su '+faltan.join(' y su ')+'.':'')
                   +' (Todo vive en TU dispositivo, no sale de acá.)'; }
  },
  { /* ── v39-agenda (22/08/2026) · F4 — BUSCAR UN CONTACTO (porte del MIRROR personal) ──
       La regla de arriba solo entra con «tenés/hay/guardaste». Falta la forma en que la gente
       realmente pregunta: «buscá el contacto de Laura», «decime el mail de Ana», «dame el
       número de Juan». Va DESPUÉS de aquella (no le roba nada) y ANTES de que el pedido se
       vaya al modelo, que no tiene la agenda y podría inventar.
       DOS DETALLES QUE NO SON CAPRICHO:
       · el separador tras el verbo es \s+ y NO \b: «buscá» y «mostrá» terminan en acento, y
         \b es límite ASCII — la «á» no es carácter de palabra, así que \b ahí no existe y la
         regla no matchearía. (Bug cazado por el banco del MIRROR el 21/08.)
       · EXIGE una palabra de agenda (contacto/número/mail/dirección/datos), así que no le roba
         nada a la música: «buscá algo de Nirvana» no tiene ninguna de esas palabras.
       · el loop de esta muleta NO admite `return null` (responde apenas matchea), así que lo
         que en el MIRROR es un guard dentro de run() acá va DENTRO del patrón: el lookahead
         descarta «…de la agenda» / «…de mis contactos», que son la otra regla. */
    re: /(?:busc[aá]r?(?:me)?|mostr[aá](?:me)?|dec[ií]me|fij[aá]te|dame|pas[aá]me)\s+.*?\b(?:contacto|n[uú]mero|tel[eé]fono|celu(?:lar)?|mail|e-?mail|correo|direcci[oó]n|domicilio|datos?)\b.*\bde\s+(?!(?:la\s+)?agenda\b|(?:mis\s+)?contactos\b)([^\d:,]{2,30}?)\s*[?.!]*$/i,
    run(m){ const q=String(m[1]||'').trim().replace(/[?.!]+$/,'');
            const c = actuaContacto(q);
            if (!c){ const amb=actuaPedirPrecisar(q,'te muestro sus datos','datos',''); if (amb) return amb; // v40-pendiente
              return 'No tengo a «'+q+'» en tu agenda local. Guardalo con «guardá el número de '+q+' <número>» (o su mail/dirección) y queda en TU dispositivo.'; }
            const nom = c.nombre || q;
            const partes = [];
            if (c.tel)   partes.push('📞 '+c.tel);
            if (c.email) partes.push('✉ '+c.email);
            if (c.dir)   partes.push('🗺 '+c.dir);
            return partes.length
              ? 'Esto tengo de «'+nom+'» en tu agenda local: '+partes.join(' · ')+'. Sale de tu agenda local, y en la charla guardada no queda ni el número ni el mail. Decime «mandale un WhatsApp a '+nom+' que…» o «llamá a '+nom+'» y lo uso.'
              : 'Tengo a «'+nom+'» en la agenda pero sin datos cargados. Agregale con «guardá el número de '+nom+' <número>».'; }
  },
  { /* v40-audit11 (3/10): «buscá a Juan en mis contactos» no entraba en ninguna regla y llegaba al modelo, que NO ve la agenda. */
    re: /^\s*(?:che,?\s*)?(?:busc[aá](?:me)?|fij[aá]te\s+si\s+(?:tengo|est[aá]))\s+(?:a\s+)?([^\d:,?]{2,30}?)\s+en\s+(?:mis\s+contactos|la\s+agenda|mi\s+agenda|los\s+contactos|contactos)\s*[?.!]*$/i,
    run(m){ const f4 = ACTUA_CMDS.find(function(c){ return c.re && c.re.source.indexOf('contacto|n[uú]mero') >= 0; });
            return f4 ? f4.run([m[0], m[1]]) : 'Decime «buscá el contacto de ' + String(m[1]||'').trim() + '» y lo busco en tu agenda local.'; }
  },
  { /* v38-cumpli (H1) — el panel de transparencia también se abre hablando: mucha gente
       pregunta antes de tocar («¿qué hacés con lo que te digo?», «¿sos una persona?»), y esa
       pregunta merece el inventario delante, no un párrafo lindo. */
    re: /qu[eé]\s+(?:hac[eé]s|guard[aá]s|sab[eé]s)\s+(?:con\s+)?(?:lo\s+m[ií]o|mis\s+datos|con\s+lo\s+que\s+te\s+(?:digo|cuento))|d[oó]nde\s+(?:se\s+)?(?:guard|va)[a-z]*\s+(?:mis\s+datos|lo\s+m[ií]o)|(?:sos|eres)\s+(?:una?\s+)?(?:ia|inteligencia\s+artificial|robot|humano|persona)(?=\s*(?:o\s+(?:una?\s+)?(?:ia|inteligencia|persona|humano|robot|m[aá]quina)\b|de\s+verdad\b|real\b|[?¿!.,]|$))|(?!privacidad\s+(?:en|de)\s+(?:las?\s+|los?\s+)?(?:redes|internet|instagram|facebook|whatsapp|tiktok|google|celular))privacidad|qu[eé]\s+datos\s+(?:ten[eé]s|guard[aá]s)(?!.*\b(?:agenda|contactos?)\b)/i, /* v42-agenda4 (24/08/2026): «¿qué datos tenés EN LA AGENDA?» es agenda, no privacidad */
    run(){
      try{ cumpliAbrir(); }catch(e){ return 'Quise abrirte el panel y falló — quedó en mi diagnóstico.'; }
      return 'Te abrí el panel con todo: qué guardo, dónde vive, qué viaja cuando escribís y qué NO hago. '
           + 'El resumen en una línea: soy una IA (no una persona); lo tuyo vive en tu dispositivo' + ((typeof FB_URL!=='undefined' && FB_URL) ? ' y en la base Firebase que configuró quien armó esta app' : ' (todavía no hay una base Firebase conectada: la charla no queda guardada al cerrar)') + '; esta app no lo vende ni lo usa para otra cosa —lo que el proveedor de IA haga con cada consulta lo dicen SUS condiciones, no esta app—, y te lo podés llevar entero cuando quieras.'; /* v40-audit11: antes decía «no se vende ni entrena nada», que es una promesa por cuenta del proveedor */
    }
  },
  { /* v38-porta (H2) — PORTABILIDAD TOTAL: llevarse todo y reponerlo. Sin permisos, sin
       trámite: es del usuario. La verificación de integridad va incluida. */
    re: /(?:export[aá]r?|llevar?me|bajar?me|dame|guard[aá]r?me|descarg[aá]r?)\s+(?:todo|todos\s+mis\s+datos|mis\s+datos|lo\s+m[ií]o)\b|portabilidad|copia\s+de\s+seguridad|backup\s+(?:de\s+)?(?:todo|mis\s+datos)|(?:import[aá]r?|repon[eé]r?|restaur[aá]r?|carg[aá]r?)\s+(?:mi\s+)?(?:copia|backup|archivo|respaldo|mis\s+datos)/i,
    run(m){
      const txt=String(m.input||m[0]||'');
      if(/import|repon|restaur|carg/i.test(txt.slice(0,14))){
        if(!portaImportarArchivo()) return 'No pude abrir el selector de archivos — quedó en mi diagnóstico.';
        return 'Elegí el archivo que te bajaste y lo reviso. Primero verifico el sello de integridad: si no coincide, NO toco nada y te lo digo.';
      }
      return portaExportar();
    }
  },
  { /* v38-tramite (C4) — PLANTILLAS DE TRÁMITES. Sin modelo, sin red, sin tokens: el
       esqueleto se arma acá y lo que no dictó el usuario queda entre <corchetes>, a la vista.
       Ojo con el patrón: «modelo» a secas NO entra (era un falso positivo cantado —
       «¿qué modelo de IA usás?»). */
    re: /\b(?:plantilla|machote)s?\b|\btr[aá]mites?\b|\bmodelo\s+de\s+(?:nota|carta|escrito|solicitud)\b|(?:necesito|quiero|ten[gé]o\s+que|ayudame\s+a|arm[aá]me|hac[eé]me|redact[aá]me|escrib[ií]me)\s+.*(?:justificar|inasistencia|ausencia|turno|reclamo|queja|certificado|constancia|autorizaci[oó]n|autorizar)/i,
    run(m){
      const txt=String(m.input||m[0]||'');
      if(/(?:qu[eé]|cu[aá]les)\s+(?:plantillas|tr[aá]mites)|plantillas\s*(?:ten[eé]s|hay|tienes)?\s*[?¿]?\s*$|tr[aá]mites\s*(?:ten[eé]s|hay)?\s*[?¿]?\s*$/i.test(txt)){
        return 'Tengo estas plantillas listas: '+TRAMITE_PLANTILLAS.map(function(p){ return '• '+p.nom; }).join('\n')
             +'\n\nPedímelas con los datos adentro y te la dejo armada: «plantilla de inasistencia del 5 de agosto por gripe». Lo que no me digas queda entre <corchetes> — no invento nombres, fechas ni motivos.';
      }
      const p=tramiteBuscar(txt);
      if(!p) return 'Todavía no tengo esa plantilla. Las que sí: '+TRAMITE_PLANTILLAS.map(function(x){ return x.nom; }).join(' · ')+'. Si es otra cosa, decime qué necesitás y te lo redacto igual.';
      const d=tramiteDatos(txt);
      let texto;
      try{ texto=p.arma(d); }catch(e){ try{ regError('tramite:armar',e) }catch(_){} return 'Quise armarte la plantilla y algo falló acá adentro — quedó en mi diagnóstico.'; }
      const ok=compartirTarjeta('📝','Plantilla: '+p.nom,'Leéla, completá lo que está entre <corchetes> y sale.',texto);
      if(!ok) return 'Armé el texto pero no pude pintarte la tarjeta — quedó en mi diagnóstico.';
      const faltan=(texto.match(/<[^>]{2,40}>/g)||[]).length;
      return 'Te dejé la plantilla armada ✅ — '+(faltan?('faltan '+faltan+' dato'+(faltan>1?'s':'')+' entre <corchetes>: eso no lo invento, lo ponés vos.'):'con todo lo que me dijiste adentro.')
             +' Si querés que la mande por mail, decime «mandá un mail a <dirección> con esto».';
    }
  },
  { /* v38-contacto (C3) — CONTACT PICKER: el usuario elige un contacto REAL del teléfono y
       se guarda en su agenda local. Mata la fricción de «guardá el número primero».
       SOBERANÍA: el navegador NO entrega la lista — muestra SU selector, toca uno, y llega
       ese y nada más. Queda en localStorage, en su dispositivo. Hoy anda en Chrome de
       Android; donde no está, se dice y se ofrece dictarlo (nunca se promete el selector). */
    re: /(?:tra[eé]|traeme|eleg[ií]|busc[aá]|import[aá]|agreg[aá]|sum[aá])\s+(?:un\s+|el\s+|mi\s+)?contacto(?:s)?(?:\s+(?:de|desde)\s+(?:mi\s+)?(?:tel[eé]fono|celu(?:lar)?|agenda\s+del\s+tel[eé]fono|lista))?|abr[ií]\s+(?:mi\s+)?(?:lista\s+de\s+)?contactos/i,
    run(){
      if(!contactosSoporte()) return 'Este navegador no me deja abrir tu lista de contactos (hoy eso anda en Chrome de Android). Dictámelo y listo: «guardá el número de Laura 2994223453» — queda en TU dispositivo igual.';
      contactoElegir().then(function(msg){ try{ addMsg('mirror',msg); }catch(e){} });
      return 'Te abro TU lista de contactos: tocá uno y me llega solo ese. El resto de tu agenda no lo veo — el navegador no me lo pasa.';
    }
  },
  { // v37-agenda (A8): ver la agenda completa
    /* v42-agenda4 (24/08/2026) — «¿QUÉ DATOS TENÉS EN LA AGENDA?» ABRÍA EL PANEL DE PRIVACIDAD.
       Hallazgo en vivo de Darío. La regla de transparencia (v38-cumpli) termina con
       `qué datos tenés|guardás`, que es correcto para «¿qué datos tenés míos?» — pero se
       comía «¿qué datos tenés EN LA AGENDA?», que es una pregunta por los contactos y no
       por la privacidad. Se arregla de los dos lados, que es lo prolijo:
       · aquella regla ahora NO entra si el pedido menciona agenda o contactos (lookahead);
       · y esta suma una rama para «qué datos tenés … agenda/contactos» — que EXIGE la
         palabra de agenda, para no llevarse puesto el «¿qué datos tenés míos?» de aquella.
         (Lo cazó el banco: la primera versión era más ancha y solo funcionaba porque esta
         regla va después en el array. Depender del orden es exactamente lo que este
         comentario dice que no hay que hacer.)
       Misma familia que el guard F3 del MIRROR: cuando dos reglas se pisan, la que pierde
       tiene que decir por qué se corre, no dejarlo al orden del array. */
    re: /(?:mostr[aá](?:me)?|ver|list[aá](?:me)?|abr[ií])\s+(?:la\s+|mi\s+)?(?:agenda|mis\s+contactos)|qu[eé]\s+(?:n[uú]meros|contactos|tel[eé]fonos)\s+(?:ten[eé]s|tengo|hay)|qu[eé]\s+datos\s+(?:ten[eé]s|tengo|hay)\b[^]*?\b(?:agenda|contactos?)\b/i,
    run(){ const a=actuaAgenda(); const ks=Object.keys(a||{});
           if (!ks.length) return 'Tu agenda local está vacía. Guardá algo con «guardá el número de <nombre> <número>» y queda en TU dispositivo.';
           /* v41-lista (23/08/2026): esta lista escupía la CLAVE, o sea el nombre normalizado sin
              tildes y en minúscula («maria gomez»). El panel visual ya mostraba el nombre lindo
              desde el porte de la agenda; esta mitad —la que se pide hablando— se quedó atrás y
              es la que se ve en el chat. Mismo criterio en los dos lados: se muestra el nombre
              tal como lo escribió el usuario, y la clave queda para las búsquedas. */
           const lineas=ks.sort().map(function(k){ const v=a[k]; const c=actuaContacto(k)||{}; const d=[];
             if(c.tel)d.push('📞'); if(c.email)d.push('✉'); if(c.dir)d.push('🗺');
             const nom=(v && typeof v==='object' && v.nombre) ? v.nombre : k;
             return '• '+nom+' '+(d.join(' ')||'(sin datos)'); });
           return 'En tu agenda local hay '+ks.length+' contacto'+(ks.length>1?'s':'')+':\n'+lineas.join('\n')
                  +'\n\nPreguntame «¿tenés el número de <nombre>?» para ver los datos. Nada de esto sale de tu dispositivo.'; }
  },
  { // v37-mail (A9, hallazgo de la prueba local 26/07): abrir el correo en blanco
    re: /(?:abr[ií](?:me)?|and[aá]\s+al?|entr[aá]\s+al?|entr[aá]\s+en)\s*(?:el\s+|mi\s+|la\s+)?(?:correo(?:\s+electr[oó]nico)?|mail|e-?mail|gmail|casilla|bandeja)/i,
    run(){ const ok=actuaTarjeta('✉','Abrir el correo','Se abre tu programa de correo con un mensaje nuevo en blanco. Si querés que además lo redacte, pedime «escribile un mail a <alguien> sobre <tema>».',actuaMailURL('','',''),'✉ abrir el correo');
           return ok?'Listo ✅ — un toque y se abre tu correo.':'No pude armar la tarjeta — quedó en mi diagnóstico.'; }
  },
  { // ★N2: llamar → tarjeta tel: (número de la agenda o dictado; JAMÁS inventado)
    /* v40-audit2 (25/09/2026) — HALLAZGO EN VIVO: «MI PERRA SE LLAMA POCHOLA» → «No tengo el número
       de POCHOLA». La regla buscaba «llama <algo>» EN CUALQUIER LUGAR de la frase, así que «se llama»,
       «me llamo», «cómo se llama» eran pedidos de llamar. Ahora el verbo tiene que ABRIR el pedido
       (o venir después de una coma / «y» / «che» / «por favor» / «dale») y nunca después de
       se/me/te/nos/cómo/qué. Hablar del nombre de alguien no es pedir que lo llame. */
    re: /(?:^|[,.;:!?¿¡]\s*|\b(?:y|che|dale|porfa|por\s+favor|ahora)\s+)(?:llam[aá](?:le|lo|la|me)?|marc[aá](?:le|me)?)\s+(?:a\s+|al\s+)?(.{2,40})/i,
    run(m){ const dest=m[1].trim().replace(/[.?!]+$/,'');
            if (actuaNumOk(dest)){ const ok=actuaTarjeta('📞','Llamar','Número listo en el discador.',actuaTelURL(dest),'📞 llamar ahora');
              return ok?'Número listo ✅ — un toque y llama.':'No pude armar la tarjeta — quedó en mi diagnóstico.'; }
            const num=(actuaContacto(dest)||{}).tel; // v37-agenda (A2)
            if (!num){ const amb=actuaPedirPrecisar(dest,'lo llamo','tel',''); if (amb) return amb; // v39-agenda + v40-pendiente
              return 'No tengo el número de «'+dest+'» y no lo voy a inventar. Decime «guardá el número de '+dest+' <número>» y queda en tu agenda local.'; }
            const ok=actuaTarjeta('📞','Llamar a '+dest,'El discador se abre con el número puesto — el toque final es tuyo.',actuaTelURL(num),'📞 llamar a '+dest);
            return ok?'Listo ✅ — tocá la tarjeta y llama.':'No pude armar la tarjeta — quedó en mi diagnóstico.'; }
  },
  { /* ── v39-actua (19/08/2026) · B1 — MAIL A UN DESTINATARIO ────────────────────────────
       HALLAZGO DE DARÍO: «mandale un mail a Lucila que llego tarde» no lo entendía NADIE.
       Existía la regla de WhatsApp a un destinatario y la de «abrí el correo» en blanco,
       pero entre las dos había un agujero: el correo CON destinatario y mensaje.
       POR QUÉ ACÁ Y NO EN LA REGLA DE WHATSAPP: el patrón de WhatsApp exige la palabra
       whatsapp/wsp/wa/mensaje. Meterle «mail» adentro le daría a wa.me un pedido de correo.
       POR QUÉ VA ANTES DE LA DE WHATSAPP: para que «mandale un mail a X…» no se lo coma
       ninguna regla posterior; el patrón exige mail/correo, así que no le roba turnos.
       LA DIFERENCIA HONESTA CON WHATSAPP: wa.me NO se puede abrir sin número, así que ahí
       hay que negarse. `mailto:` SÍ se abre sin destinatario. Entonces, cuando el contacto
       no está en la agenda, no se planta: deja el mensaje escrito, avisa de frente que no
       tiene la dirección y que NO la va a inventar, y el usuario la tipea en su correo. */
    re: /(?:mand[aá](?:le)?|escrib[ií](?:le)?|manda|envi[aá](?:le)?)\s+(?:un\s+|el\s+)?(?:mail|e-?mail|correo(?:\s+electr[oó]nico)?)\s+a\s+([^:,]{2,30}?)(?:\s*[:,]\s*|\s+(?:y\s+)?(?:que|dici[eé]ndo(?:le)?|avis[aá]ndo(?:le)?|cont[aá]ndo(?:le)?|sobre|decile|avisale|contale|dile)\b[\s:,]*(?:en\s+)?(?:que\b\s*)?)(.+)/i,
    run(m){ const dest=m[1].trim().replace(/\s+$/,''), msg=actuaLimpiaConector(m[2]); // v47-decile
            /* v40-pendiente (H3): con DOS candidatos NO se arma tarjeta — el texto pedía
               precisar y la tarjeta invitaba a mandar al mismo tiempo. Va ANTES de armarla. */
            /* Si dictó la dirección entera («mandale un mail a ana@x.com que…»), esa manda:
               es un dato que dio el usuario, no algo que la app dedujo. */
            const dir = actuaMailDirOk(dest) ? dest : ((actuaContacto(dest)||{}).email || '');
            const conDir = !!dir;
            if (!conDir){ const amb=actuaPedirPrecisar(dest,'te lo mando','mail',msg); if (amb) return amb; } // v40-pendiente
            const ok=actuaTarjeta('✉','Mail'+(conDir?' a '+dest:' (falta el destinatario)'),
                  '«'+msg+'» — se abre tu correo con el texto puesto. El asunto y el «enviar» son tuyos.',
                  actuaMailURL(dir,'',msg), conDir?'✉ abrir el correo':'✉ abrir el correo (poné vos la dirección)');
            if (!ok) return 'No pude armar la tarjeta — quedó en mi diagnóstico.';
            return conDir
              ? 'Mail listo ✅ — revisalo en la tarjeta, ponele asunto y mandalo vos.'
              : ('No tengo el mail de «'+dest+'» y no lo voy a inventar. Te dejo el mensaje escrito y la dirección la ponés vos al abrir el correo. Si querés que la próxima salga sola: «guardá el mail de '+dest+': <dirección>».'); }
  },
  { // ★N2: WhatsApp → wa.me con el mensaje ya escrito (el usuario revisa y manda)
    // v37-wa (A7, prueba local 26/07): con «diciendo en que» el destinatario salía
    // «DARIO DICIENDO EN». Ahora acepta la forma en que se habla de verdad.
    re: /(?:mand[aá](?:le)?|escrib[ií](?:le)?)\s+(?:un\s+)?(?:whats?app?|wsp|wa|mensaje)\s+a\s+([^:,]{2,30}?)(?:\s*[:,]\s*|\s+(?:y\s+)?(?:que|dici[eé]ndo(?:le)?|avis[aá]ndo(?:le)?|cont[aá]ndo(?:le)?|decile|avisale|contale|dile)\b[\s:,]*(?:en\s+)?(?:que\b\s*)?)(.+)/i, // destinatario no-greedy (test adversario)
    run(m){ const dest=m[1].trim(), msg=actuaLimpiaConector(m[2]); // v47-decile
            const num=actuaNumOk(dest)?dest:(actuaContacto(dest)||{}).tel; // v37-agenda (A2)
            /* v39-actua (19/08/2026): la negativa era correcta pero dejaba al usuario en la nada.
               wa.me NO abre sin número — eso no se puede tapar. Pero el texto que ya escribió
               no tiene por qué perderse: se le ofrece la salida que SÍ existe (el selector de
               compartir), en vez de solo decirle que no. Negarse sin ofrecer alternativa es
               honesto a medias. */
            if (!num){ const amb=actuaPedirPrecisar(dest,'te lo mando','wa',msg); if (amb) return amb; // v39-agenda + v40-pendiente
              return 'No tengo el número de «'+dest+'» y no lo voy a inventar — WhatsApp no abre sin número. Dos salidas: guardalo («guardá el número de '+dest+' <número>») y te sale solo, o decime «compartí esto: '+msg+'» y elegís vos la app y el contacto.'; }
            const r=actuaWaNum(num); // v37-tel (A1)
            const ok=actuaTarjeta('💬','WhatsApp a '+dest,'«'+msg+'» — leélo, y si está bien, sale con un toque.',actuaWaURL(num,msg),'💬 abrir WhatsApp');
            if (!ok) return 'No pude armar la tarjeta — quedó en mi diagnóstico.';
            return r.seguro?'Mensaje listo ✅ — revisalo en la tarjeta y mandalo.'
                           :'Mensaje listo ✅ — pero ojo: '+r.nota+'.'; }
  },
  { // ★N2: cómo llego → Maps con destino cargado
    re: /(?:c[oó]mo\s+llego\s+a|llevame\s+a|ubicaci[oó]n\s+de|d[oó]nde\s+queda)\s+(?!(?:lo\s+que|todo\s+lo|la\s+(?:memoria|charla|info|configuraci[oó]n)|mi\s+(?:memoria|perfil|info)|mis\s+(?:datos|recuerdos|cosas|charlas|documentos)|guardad\w*)\b)(.{3,60})/i, // v40-maps (16/10, auditor 1): «dónde queda lo que hablamos» armaba una tarjeta de Maps
    run(m){ let q=m[1].trim().replace(/[?.!]+$/,'');
            // v37-agenda (A2): «llevame a lo de Laura» → si tiene dirección guardada, se usa esa
            const mLo=q.match(/^(?:lo|la\s+casa)\s+de\s+(.{2,30})$/i);
            let via='';
            if (mLo){ const c=actuaContacto(mLo[1].trim());
                      if (c && c.dir){ q=c.dir; via=' (la dirección que tenés guardada de '+mLo[1].trim()+')'; }
                      else if (c) return 'Tengo a «'+mLo[1].trim()+'» en la agenda pero sin dirección, y no la voy a inventar. Decime «guardá la dirección de '+mLo[1].trim()+': <dirección>».'; }
            const ok=actuaTarjeta('🗺','Cómo llegar','Destino: '+q,actuaMapsURL(q),'🗺 abrir en Maps');
            return ok?'Ruta lista ✅'+via+' — un toque y Maps te lleva.':'No pude armar la tarjeta — quedó en mi diagnóstico.'; }
  },
  { // ★N2: agendar evento → Google Calendar con el título puesto (fecha/hora las pone el usuario)
    re: /agend[aá](?:me)?\s+(?!.*n[uú]mero)(.{3,80})/i,
    run(m){ const _f=_tareaFecha(m.input||m[1]); const t=tituloSinFecha(m[1].trim().replace(/[?.!]+$/,''), _f); // v40-agendar: la fecha va al calendario, no al título
            const ok=actuaTarjeta('📅','Agendar: '+t,(_f?'Para el '+_tareaFechaTarjeta(_f)+' — ':'')+'Se abre tu calendario con el título puesto — '+(_f?'la hora la ponés vos.':'fecha y hora las confirmás vos.'),actuaCalURL(t,_f),'📅 abrir calendario'); // v59-caldate: misma fecha que se guarda
            try{ tareaGuardar(t, _f); }catch(e){} // v39-tareas
            return ok?'Evento pre-armado ✅ — ajustá fecha y hora y guardalo.':'No pude armar la tarjeta — quedó en mi diagnóstico.'; }
  },
  { // música: prender
    re: /(?:pon[eé]|prend[eé]|activ[aá]|arranc[aá])(?:me|la|nos)?\s+(?:la\s+|el\s+)?(?:m[uú]sica|sonido)/i,
    run(){ if (soundOn) return 'La música ya está sonando — si la querés más fuerte, decime «subí la música».';
           startAudioIfNeeded(); return 'Listo, prendí la música ✅ — «El Origen», de fondo.'; }
  },
  { // música: apagar
    re: /(?:apag[aá]|par[aá]|cort[aá]|sac[aá]|silenci[aá])(?:me|la)?\s+(?:la\s+|el\s+)?(?:m[uú]sica|sonido)/i,
    run(){ if (!soundOn) return 'La música no estaba sonando — nada que apagar.';
           toggleSound(); return 'Listo, apagué la música ✅.'; }
  },
  { // música: bajar volumen
    // v37-vol (A6, prueba local 26/07): «bajalo más» y «más bajito» NO entraban.
    /* v39-actua (19/08/2026) — EL DEDAZO NO ES UNA ORDEN DISTINTA.
       Darío escribió «bajá el volumne» y la app no entendió nada. Cuando se dicta por voz o
       se tipea rápido, «volumen» sale «volumne», «volumne», «volúmen» o «bolumen»: es la
       MISMA orden. Rechazarla por una letra es hacerle pagar al usuario un error nuestro de
       tolerancia. Se abre el patrón solo para las variantes que de verdad se escriben — no
       una coincidencia difusa, que se comería frases enteras. */
    /* v39-actua: «poné el volumen más bajo» tampoco entraba — el patrón exigía el verbo
       bajá/subí, y mucha gente dice «poné». Va anclado y con el adjetivo obligatorio para
       no pisar la regla de «poné la música». */
    re: /baj[aá](?:me|la|lo)?\s+(?:un\s+poco\s+)?(?:m[aá]s\s+)?(?:la\s+|el\s+)?(?:m[uú]sica|vol[uú]m(?:en|ne|em|n)|bol[uú]m(?:en|ne)|sonido)|^\s*baj[aá](?:me|la|lo)?\s+(?:un\s+poco\s+)?m[aá]s\s*[.!]*$|^\s*(?:un\s+poco\s+)?m[aá]s\s+(?:baj[oa]|bajito|despacio|suave)\s*[.!]*$|^\s*pon[eé](?:me|lo|la)?\s+(?:el\s+|la\s+)?(?:vol[uú]m(?:en|ne|em|n)|m[uú]sica|sonido)\s+(?:un\s+poco\s+)?(?:m[aá]s\s+)?(?:baj[oa]|bajito|despacio|suave)\s*[.!]*$/i,
    run(){ if (!soundOn) return 'La música no está sonando, no hay nada que bajar. ¿La prendo? Decime «poné la música».';
           const p=volPaso(false); return 'Listo, bajé la música ✅ — al '+Math.round(p*100)+'%.'+(p<=VOL_MIN+0.001?' Es lo más bajo que llega sin apagarla; si la querés en silencio, decime «callate la música».':''); } // v37-vol (B1)
  },
  { // música: subir volumen
    // v37-vol (A6, prueba local 26/07): «subilo más», «subí más» y «más fuerte» NO entraban.
    // Las formas genéricas van ANCLADAS y solas, para no comerse «contame más».
    // v39-actua (19/08/2026): mismas variantes de dedazo que en «bajar» — ver el comentario de arriba.
    re: /sub[ií](?:me|la|lo)?\s+(?:un\s+poco\s+)?(?:m[aá]s\s+)?(?:la\s+|el\s+)?(?:m[uú]sica|vol[uú]m(?:en|ne|em|n)|bol[uú]m(?:en|ne)|sonido)|^\s*sub[ií](?:me|la|lo)?\s+(?:un\s+poco\s+)?m[aá]s\s*[.!]*$|^\s*(?:un\s+poco\s+)?m[aá]s\s+(?:fuerte|alt[oa])\s*[.!]*$|^\s*pon[eé](?:me|lo|la)?\s+(?:el\s+|la\s+)?(?:vol[uú]m(?:en|ne|em|n)|m[uú]sica|sonido)\s+(?:un\s+poco\s+)?(?:m[aá]s\s+)?(?:fuerte|alt[oa])\s*[.!]*$/i,
    run(){ if (!soundOn) return 'La música está apagada — primero la prendo si querés: «poné la música».';
           const p=volPaso(true); return 'Listo, subí la música ✅ — al '+Math.round(p*100)+'%.'+(p>=VOL_MAX-0.001?' Ya está al máximo.':''); } // v37-vol (B1)
  },
  { // lectura en voz alta: prender
    re: /(?:activ[aá]|prend[eé]|pon[eé])(?:me)?\s+(?:la\s+)?(?:voz|lectura)|le[eé]me\s+(?:las?\s+)?(?:respuestas?|en\s+voz\s+alta)/i,
    run(){ if (ttsOn) return 'La lectura ya estaba prendida — te sigo leyendo.';
           toggleTTS(); return ttsOn ? 'Listo, prendí la lectura ✅ — desde ahora te leo las respuestas.'
                                     : 'Quise prenderla pero este navegador no soporta lectura en voz alta.'; }
  },
  { // lectura: apagar / callar
    re: /(?:apag[aá]|sac[aá]|silenci[aá]|cort[aá])(?:me)?\s+(?:la\s+)?(?:voz|lectura)|^\s*call[aá]te/i,
    run(){ if (window.speechSynthesis) speechSynthesis.cancel();
           if (!ttsOn) return 'Silencio hecho — la lectura ya estaba apagada.';
           toggleTTS(); return 'Listo, apagué la lectura ✅ — sigo por escrito.'; }
  },
  { // selector de voz
    re: /(?:cambi[aá]|eleg[ií])(?:me)?\s+(?:la\s+|una\s+)?voz/i,
    run(){ abrirSelectorVoz(); return 'Te abrí el selector de voces ✅ — probalas con ▶ y quedate con la que más te guste.'; }
  },
  { // panel de memoria (el PIN lo pide la app: esa llave no la toca ni MIRROR)
    re: /(?:abr[ií]|mostr[aá])(?:me)?\s+(?:el\s+panel\s+de\s+|la\s+|los\s+|mi\s+|mis\s+)?(?:memoria|recuerdos)/i,
    run(){ abrirMemoria(); return 'Te abro el panel de memoria ✅ — ahí está todo lo que recuerdo, a la vista.'; }
  },
  { // cambio de modo
    re: /(?:^|[^\wáéíóúñ])(?:pas[aá]|cambi[aá]|llev[aá])(?:me|nos)?\s+(?:al?\s+)?(?:modo\s+(tars|jurado|conex)\b|(tars|jurado|conex)\s*[.!?]*\s*$)/i, // v40-1023 (auditor 1): sin «modo», el nombre tiene que cerrar el pedido («llevá al jurado la carpeta» no cambia de modo)
    run(m){ const d=(m[1]||m[2]).toLowerCase(); setMode(d==='conex'?'conn':d);
            const _nm=NMODOS(); const n=(d==='tars'?_nm.tars:(d==='jurado'?_nm.jurado:_nm.conn))||d.toUpperCase(); // v40-modonombre: el nombre que le pusiste, no el de fábrica
            let _resto = ''; try { const _mr = /\s+y\s+(.{3,})$/i.exec(String(m.input||'').slice(m.index + m[0].length)); if (_mr) _resto = _mr[1].trim(); } catch(_){} // verificador 23/10: «pasá al modo tars y explicame…»
            if (_resto){ setTimeout(function(){ try { const _i = document.getElementById('inp'); if (_i && !_i.value) { _i.value = _resto; _i.focus(); } } catch(_){} }, 0); }
            return 'Listo, te dejo con '+n+' ✅ — ojo: él no tiene mis manos. Para volver, tocá el primer botón de arriba.' + (_resto ? ' Tu pedido («'+_resto.slice(0,80)+'») te lo dejé escrito abajo: tocá ↑ y te lo contesta este modo.' : ''); }
  },
  { // ★v36: cambio de modo por el NOMBRE que le puso el usuario en el constructor («pasá al modo ANALISTA»)
    /* v40-modonombre (16/10/2026, auditor 1 — GRAVE): con nombres de varias palabras («MODO ANALÍTICO»,
       «EXPERTO/EXAMINADOR») «pasá al modo analítico» contestaba «No conozco un modo que se llame…»: FALSO,
       el modo existe. La regla agarraba UNA palabra y la comparaba contra el nombre ENTERO. Ahora compara sin
       tildes ni mayúsculas, por nombre completo o por cualquiera de sus palabras, y entiende los nombres de
       fábrica (analista/analítico, examinador/experto/jurado, conex). El disparador es el de siempre (pasá/cambiá/llevá al modo). */
    re: /(?:^|[^\wáéíóúñ])(?:pas[aá]|cambi[aá]|llev[aá])(?:me|nos)?\s+(?:al?\s+)?modo\s+([\wáéíóúñ][\wáéíóúñ\/\- ]{1,40})/i, // verificador 16/10: sin «activá» ni «el modo» (cazaba «desactivá el modo X», «cambiá el modo de pago») y con borde al principio
    run(m){ const N=function(v){ return String(v||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9ñ\/\- ]/g,' ').replace(/\s+/g,' ').trim(); };
            const mm=Object.assign({}, CONFIG_DEFAULT.modos, (typeof CONFIG!=='undefined'&&CONFIG.modos)?CONFIG.modos:{});
            const alias={ tars:['tars','analista','analitico','analitica'], jurado:['jurado','examinador','examinadora','experto','experta'], conn:['conex','conexion'], mirror:['mirror','espejo','siempre','normal'].concat((typeof CONFIG!=='undefined'&&CONFIG.appName)?N(CONFIG.appName).split(/[\s\/\-]+/).filter(function(t){ return t.length>=3; }):[]) }; // v40-1023: «pasá al modo MANIFIESTOS» / «de siempre» = el espejo
            const q=N(m[1]), qw=q.split(/[\s\/\-]+/).filter(Boolean);
            let dest=null;
            for(const k in mm){ const nm=N(mm[k]); if(nm && (q===nm || q.indexOf(nm+' ')===0)){ dest=k; break; } }
            if(!dest && qw.length){ const w=qw[0]==='de'||qw[0]==='del'?qw[1]:qw[0];
              if (w && w.length>=3) for(const k in mm){ const toks=N(mm[k]).split(/[\s\/\-]+/).filter(function(t){ return t.length>=3 && t!=='modo'; }).concat(alias[k]||[]);
                if(toks.indexOf(w)>=0){ dest=k; break; } } }
            const pal=String(m[1]).trim().split(/\s+/)[0];
            if(!dest) return 'No conozco un modo que se llame «'+pal+'» — los tuyos están en los botones de arriba.';
            if(dest==='mirror') return 'Ya estás conmigo — el espejo está activo.';
            setMode(dest);
            const nom=mm[dest]||pal.toUpperCase();
            /* v40-1023 (auditor 1): «PASA AL MODO ANALITICO Y EXPLICAME LA ENTROPIA» cambiaba de modo y el pedido se perdía.
               No se contesta solo (ese modo arma su propio contexto): se deja escrito, listo para mandar con un toque. */
            let _resto = ''; try { const _mr = /\s+y\s+(.{3,})$/i.exec(String(m.input||'').slice(m.index + m[0].length - m[1].length)); if (_mr) _resto = _mr[1].trim(); } catch(_){}
            if (_resto){ setTimeout(function(){ try { const _i = document.getElementById('inp'); if (_i && !_i.value) { _i.value = _resto; _i.focus(); } } catch(_){} }, 0); }
            return 'Listo, te dejo en '+nom+' ✅ — ojo: ese modo no tiene mis manos. Para volver, tocá el primer botón de arriba.' + (_resto ? ' Tu pedido («'+_resto.slice(0,80)+'») te lo dejé escrito abajo: tocá ↑ y te lo contesta este modo.' : ''); }
  },
  { /* ── v39-actua (19/08/2026) · B1 — «PONÉ NIRVANA» (el artista pelado) ────────────────
       HALLAZGO DE DARÍO: «poné música de Nirvana» andaba; «poné Nirvana» no. Nadie habla
       diciendo «poné música de». Pero un «poné <lo que sea>» suelto es un patrón peligroso:
       se comería «poné la mesa», «poné atención», «ponelo en pausa».
       TRES CANDADOS, a propósito:
         1) VA ÚLTIMA EN LA LISTA. ACTUA_CMDS se recorre en orden, así que TODA otra regla
            (música, volumen, voz, modos, mail, agenda…) gana primero. Esta solo ve lo que
            ninguna otra quiso.
         2) ANCLADA Y CORTA: la frase entera tiene que ser el verbo + hasta 3 palabras. Una
            oración de conversación no entra.
         3) LISTA NEGRA de objetos que claramente NO son música. Va DENTRO del patrón, como
            un lookahead negativo, y no adentro del `run`: este loop de la plataforma no
            admite que una regla se arrepienta (`run` no puede devolver null como en el
            MIRROR personal), así que la exclusión tiene que estar en el patrón o no está.
       Y LA HONESTIDAD: no afirma que reconoció un artista —no lo sabe—. Deja una tarjeta de
       búsqueda en YouTube (que el usuario tiene que tocar) y DICE que asumió que era música.
       No suena nada solo: la app no reproduce, ofrece. */
    re: /^\s*(?:pon[eé]|pon[eé]me|pas[aá]|pas[aá]me|escuch(?:emos|ame)|quiero\s+escuchar)\s+(?:algo\s+de\s+|un\s+poco\s+de\s+|a\s+)?(?!(?:la|el|los|las|un|una)\s+(?:mesa|tele|televisi[oó]n|radio|luz|luces|alarma|hora|fecha|clave|pantalla|c[aá]mara|voz|lectura|m[uú]sica|mano|pava|olla|modo)\b)(?!(?:mesa|atenci[oó]n|pausa|play|stop|foco|freno|alarma|timer|temporizador|despertador|tele|televisi[oó]n|radio|luz|luces|aire|calefacci[oó]n|m[uú]sica|sonido|vol[uú]men?|bol[uú]men?|voz|lectura|micr[oó]fono|modo|tema|color|fondo|pantalla|c[aá]mara|foto|imagen|nombre|clave|contrase[nñ]a|pin|fecha|hora|todo|eso|esto|algo|nada|otra|otro|m[aá]s|menos)\b)([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9'&.\-]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9'&.\-]+){0,2})\s*[.!]*$/i,
    run(m){ const q=String(m[1]||'').trim().replace(/[.?!]+$/,'');
            const ok=actuaTarjeta('🎵','Música: '+q,'Asumí que «'+q+'» es música y te dejo la búsqueda en YouTube. Si no era eso, decímelo con más palabras y lo hago bien.',actuaYtURL(q+' música'),'▶ buscar en YouTube');
            return ok?'Te dejo «'+q+'» listo para escuchar ✅ — asumí que era música (no lo sé con certeza) y no suena nada hasta que toques la tarjeta.':'No pude armar la tarjeta — quedó en mi diagnóstico.'; }
  }
];
/* ── v37-orden (E1) — EL GLITCH DE LA TARJETA ARRIBA DEL MENSAJE ──
   El itinerario sospechaba del `appendChild`. NO era eso: appendChild está bien.
   La causa real es el ORDEN de las llamadas en actuaInterceptar: `c.run(m)`
   pinta la tarjeta POR DENTRO (actuaTarjeta → chat.appendChild) y se ejecutaba
   ANTES de `addMsg('user', text)`. O sea: la tarjeta entraba al DOM primera.
   Hilo resultante tras el arreglo: pedido → respuesta → tarjeta. */
let actuaDifiriendo = false;
let actuaDiferidas = [];
/* v40-agendapriv (23/10/2026, auditor 4 — GRAVE de honestidad): «buscá el contacto de Ana» contestaba con su teléfono y
   mail y decía «No sale de tu dispositivo», pero esa respuesta entraba a la charla guardada (tu Firebase) y viajaba al
   modelo en el turno siguiente. Ahora, en lo que se guarda de los comandos, teléfonos y mails se reemplazan por una marca.
   En pantalla (y en voz) se ven completos: eso queda en tu dispositivo. */
function agendaSinDatos(t){
  return String(t == null ? '' : t)
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[mail de tu agenda]')
    .replace(/\+?\d[\d\s\-().]{6,}\d/g, function(m){ return (m.replace(/\D/g,'').length >= 8) ? '[número de tu agenda]' : m; });
}
function actuaInterceptar(text){
  try {
    if (mode !== 'mirror') return false;      // las manos son de MIRROR, no de TARS/jurado
    if (typeof CONFIG!=='undefined' && CONFIG.cap && CONFIG.cap.actua===false) return false; // v36: toggle «Tu MIRROR actúa» — el usuario manda; sin la clave = ON
    const lim = /^(mand|escrib|compart|plantill|tr[aá]mit|justific|redact|necesito|quiero|arm[aá]me|hac[eé]me)/i.test(text.trim()) ? 220 : ACTUA_MAX; // v36-actua2: el WhatsApp lleva mensaje largo · v38-share/v38-tramite (31/07): «compartí esto…» y los pedidos de plantilla traen el texto adentro y necesitan la puerta ancha
    if (text.length > lim) return false; // frase larga = conversación, no comando
    /* v40-pendiente: si veníamos de preguntar «¿cuál?», la respuesta se traduce al pedido
       completo ANTES de probar las reglas. `text` queda intacto: lo que se muestra y lo que va
       al historial siguen siendo las palabras del usuario. */
    let textCmd = text;
    try { const _re = actuaPendReescribir(text); if (_re) textCmd = _re; }
    catch(e){ try{ regError('actua:pend', e); }catch(_){ } }
    for (const c of ACTUA_CMDS){
      const m = c.re.exec(textCmd);
      if (!m) continue;
      addMsg('user', text); // v37-orden (E1): PRIMERO lo que dijo el usuario
      let resp;
      actuaDifiriendo = true; actuaDiferidas = [];
      try { resp = c.run(m); }
      catch(e){ try{ regError('actua', e); }catch(_){ } resp = 'Quise hacerlo pero algo falló acá adentro — quedó anotado en mi diagnóstico (preguntame «¿qué te falló hoy?»).'; }
      finally { actuaDifiriendo = false; } // pase lo que pase, no queda trabado
      addMsg('mirror', resp);
      // v37-orden (E1): y recién ahora las tarjetas, al final del hilo
      try { actuaDiferidas.forEach(function(t){ actuaTarjeta.apply(null, t); }); }
      catch(e){ try{ regError('actua:diferidas', e); }catch(_){ } }
      actuaDiferidas = [];
      try { compartirPintarDiferidas(); }catch(e){ try{ regError('share:flush', e); }catch(_){ } } // v38-share (C1): mismo orden que las demás tarjetas
      history.push({role:'user', content:agendaSinDatos(text)}, {role:'assistant', content:agendaSinDatos(resp)}); // v40-agendapriv
      try { hablar(resp); } catch(e){}
      setButtonsBusy(false);
      return true;
    }
    try{ if(typeof cartaNoReconocido==='function') cartaNoReconocido(text); }catch(e2){} // v36-carta: pedido con pinta de comando que la capa NO reconoció → va a la carta
  } catch(e){ try{ regError('actua', e); }catch(_){ } } // la capa JAMÁS rompe el chat
  return false;
}
// ── v36-actua2 (Etapa 3 Ciclo 2 — porte) — NIVEL 2: TARJETAS DE ACCIÓN HACIA AFUERA ──
// El navegador no puede discar ni enviar solo — y está bien así: la tarjeta deja TODO listo
// y el último toque es del usuario (confirmación humana = seguridad, no limitación).
// SEGURIDAD: las URLs las construye SIEMPRE esta capa desde campos validados; JAMÁS se acepta
// una URL cruda (ni del modelo ni del usuario). Números: solo de la agenda local (localStorage,
// TU dispositivo) o dictados explícitamente — NUNCA inventados.
function actuaAgenda(){ try{ return JSON.parse(localStorage.getItem('mirror_agenda')||'{}') }catch(e){ return {} } }
/* ══ v39-contactos (9/09/2026) — IMPORTAR LA AGENDA DEL CELULAR (pedido de Darío) ══
   El navegador NO puede leer la agenda del teléfono solo: el flujo honesto es «exportá el
   .vcf desde tu celu y subilo acá». Se lee EN EL DISPOSITIVO, nada viaja. Soporta vCard (.vcf)
   y CSV (Google Contactos). No pisa lo que ya tenés: un contacto existente se saltea. */
function _contNormTel(t){ t=String(t||'').trim(); if(!t) return ''; const mas=/^\+/.test(t); const d=t.replace(/[^\d]/g,''); return d?(mas?'+':'')+d:''; }
function _contCsvFilas(t){
  const filas=[]; let campo='',fila=[],q=false;
  t=String(t||'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  for(let i=0;i<t.length;i++){ const ch=t[i];
    if(q){ if(ch==='"'){ if(t[i+1]==='"'){campo+='"';i++;} else q=false; } else campo+=ch; }
    else { if(ch==='"') q=true; else if(ch===','){ fila.push(campo);campo=''; } else if(ch==='\n'){ fila.push(campo); filas.push(fila); fila=[];campo=''; } else campo+=ch; } }
  if(campo!==''||fila.length){ fila.push(campo); filas.push(fila); }
  return filas.filter(f=>f.some(x=>String(x).trim()!==''));
}
/* ══ v39-tareas (9/09/2026) — AGENDA/TAREAS PERSISTENTE (pedido de Darío + de ATIS) ══
   La tarjeta «Agendar» abría el calendario pero no guardaba nada. Ahora, cuando se agenda algo,
   se ANOTA acá (localStorage, nada viaja); la entidad lo recuerda si le preguntás y avisa al
   abrir si algo vence hoy. LEER/recordar, NUNCA enviar ni ejecutar solo — el toque final es tuyo. */
function tareasCargar(){ try{ const a=JSON.parse(localStorage.getItem('mirror_tareas')||'[]'); return Array.isArray(a)?a:[]; }catch(e){ return []; } }
function tareasGuardarTodas(a){ try{ localStorage.setItem('mirror_tareas', JSON.stringify(a)); return true; }catch(e){ return false; } }
function _tareaISO(d){ const z=new Date(d.getTime()-d.getTimezoneOffset()*60000); return z.toISOString().slice(0,10); }
function _tareaFecha(texto){
  const t=String(texto||'').toLowerCase(); const hoy=new Date();
  if(/\bhoy\b/.test(t)) return _tareaISO(hoy);
  if(/pasado\s+ma[nñ]ana/.test(t)){ const d=new Date(hoy); d.setDate(d.getDate()+2); return _tareaISO(d); }
  if(/\bma[nñ]ana\b/.test(t)){ const d=new Date(hoy); d.setDate(d.getDate()+1); return _tareaISO(d); }
  /* v40-audit5 (25/09/2026): «el 30 de septiembre», «3 de octubre de 2026». Antes solo entendía 30/09
     y el calendario abría en HOY. Sin año = la PRÓXIMA vez que cae esa fecha (si ya pasó este año, el
     que viene: nadie agenda para atrás a propósito). Con año explícito, se respeta tal cual (y si ya
     pasó, el agente lo advierte). Fechas imposibles (31 de febrero) no se inventan: se descartan. */
  const MESES3={ene:0,feb:1,mar:2,abr:3,may:4,jun:5,jul:6,ago:7,sep:8,set:8,oct:9,nov:10,dic:11};
  const MESES={enero:0,febrero:1,marzo:2,abril:3,mayo:4,junio:5,julio:6,agosto:7,septiembre:8,setiembre:8,octubre:9,noviembre:10,diciembre:11};
  /* v40-audit9 (2/10, en vivo): «el 15 de diciembr» (le faltó la e) no se entendía y el calendario abría en HOY. Se
     aceptan las abreviaturas y los cortes de tipeo: alcanza con las 3 primeras letras del mes (ene…dic, «set», «sept»). */
  const mn=t.match(/\b(\d{1,2})(?:°|º|ro)?\s+de\s+((ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic)[a-z]*)\.?(?:\s+(?:de(?:l)?\s+)?(\d{4}))?(?![a-z])/);
  // la palabra tiene que ser el COMIENZO del mes (o el mes con la última letra cambiada): «diciembr» sí, «marcos» no
  const _mesOk = mn && (function(w, k){ const full = {ene:'enero',feb:'febrero',mar:'marzo',abr:'abril',may:'mayo',jun:'junio',jul:'julio',ago:'agosto',sep:'septiembre',set:'setiembre',oct:'octubre',nov:'noviembre',dic:'diciembre'}[k]; return full.indexOf(w) === 0 || (w.length === full.length && full.slice(0,-1) === w.slice(0,-1)); })(mn[2], mn[3]);
  if(mn && _mesOk){ const dd=+mn[1], mo=MESES3[mn[3]]; let yy=mn[4]?+mn[4]:hoy.getFullYear(); let d=new Date(yy,mo,dd);
    if(d.getMonth()===mo && d.getDate()===dd){
      if(!mn[4] && _tareaISO(d) < _tareaISO(hoy)){ d=new Date(yy+1,mo,dd); if(d.getMonth()!==mo) return ''; }
      return _tareaISO(d); }
    return ''; }
  const mm={domingo:0,lunes:1,martes:2,miercoles:3,'miércoles':3,jueves:4,viernes:5,sabado:6,'sábado':6};
  for(const dn in mm){ if(new RegExp('\\b'+dn+'\\b').test(t)){ const d=new Date(hoy); const delta=((mm[dn]-d.getDay())+7)%7||7; d.setDate(d.getDate()+delta); return _tareaISO(d); } }
  const m=t.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
  if(m){ const dd=+m[1], mo=+m[2]-1, yy=m[3]?(+m[3]<100?2000+ +m[3]:+m[3]):hoy.getFullYear(); const d=new Date(yy,mo,dd); if(!isNaN(d.getTime()) && d.getMonth()===mo && d.getDate()===dd) return _tareaISO(d); } // v40-agendar: «cuota 12/24» no es el 12 del mes 24 (antes rodaba a otro año)
  return '';
}
/* ══ v40-agendar (2/10/2026) — LA FECHA VA AL CALENDARIO, NO AL TÍTULO (backlog 25/09, punto 4) ══
   En vivo: «agendame pagar la luz el 30 de septiembre» dejaba el evento titulado «pagar la luz el 30
   de septiembre» — la fecha dos veces (en el título y en el día del calendario) y la tarea con la
   fecha pegada. Ahora, SOLO si la fecha se entendió (si no, el título queda entero: no se pierde
   nada), se saca del título: «el 30 de septiembre», «el 30/09», «mañana», «el jueves que viene»…
   De paso, lo que quedó de las auditorías de MIRROR: un «gracias»/«por favor» del final no es parte
   de la tarea, y un pedido dictado TODO EN MAYÚSCULAS se guarda en minúsculas. «A la mañana» NO es
   una fecha (es un momento del día) y queda. */
const _TF_MES = '(?:ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic)[a-z]*\\.?';   // v40-audit9: abreviado o cortado, como en _tareaFecha
const _TF_DIA = '(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)';
const _TF_PRE = '(?:\\s*,?\\s*(?:(?:para|hasta|desde)\\s+)?(?:(?:el|este|esta)\\s+)?(?:pr[oó]ximo\\s+)?)';
function tituloSinFecha(titulo, fechaISO){
  const orig = String(titulo || '').replace(/\s+/g, ' ').trim();
  let s = orig;
  try {
    // 1) mayúsculas sostenidas → minúsculas (con la primera en mayúscula)
    const letras = s.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '');
    if (letras.length >= 6 && letras === letras.toUpperCase()) { s = s.toLowerCase(); s = s.charAt(0).toUpperCase() + s.slice(1); }
    // 2) cortesías del final
    s = s.replace(/[\s,.;!]*(?:muchas\s+)?(?:gracias|por\s+favor|porfa|plis)[\s.!]*$/i, '').trim();
    if (fechaISO) {
      const proteg = [];
      s = s.replace(/\b(?:a|de|por|en)\s+la\s+ma[nñ]ana\b/gi, function(m){ proteg.push(m); return '\u0001' + (proteg.length - 1) + '\u0001'; });
      s = s.replace(new RegExp(_TF_PRE + '(?:' + _TF_DIA + '\\s+)?\\d{1,2}(?:°|º)?\\s+de\\s+' + _TF_MES + '(?:\\s+(?:de(?:l)?\\s+)?\\d{4})?', 'gi'), ' ');
      s = s.replace(new RegExp(_TF_PRE + '(?:' + _TF_DIA + '\\s+)?(\\d{1,2})[\\/\\-](\\d{1,2})(?:[\\/\\-]\\d{2,4})?(?![\\d\\/])', 'gi'), function(m, d, mo){ return (+d >= 1 && +d <= 31 && +mo >= 1 && +mo <= 12) ? ' ' : m; });
      s = s.replace(new RegExp(_TF_PRE + '(?:pasado\\s+)?ma[nñ]ana\\b', 'gi'), ' ');
      s = s.replace(new RegExp(_TF_PRE + 'hoy\\b', 'gi'), ' ');
      s = s.replace(new RegExp('(?:\\s*,?\\s*(?:(?:para|hasta)\\s+)?(?:el|este)\\s+(?:pr[oó]ximo\\s+)?)' + _TF_DIA + '(?:\\s+(?:que\\s+viene|pr[oó]ximo))?\\b', 'gi'), ' ');
      s = s.replace(/\u0001(\d+)\u0001/g, function(_, k){ return proteg[+k]; });
    }
    s = s.replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').replace(/(?:\s*[,;:\-–]\s*|\s+(?:para|el|de|que|y))+\s*$/i, '').replace(/^[\s,;:\-–]+/, '').trim();
    return s.length >= 3 ? s : orig;
  } catch(e){ return orig; }
}
function _tareaNorm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim(); }
/* v40-1029 (en vivo 23/10): en 📋 estaban «Pagar la luz · 15/12» y «pagar la luz el 15 de diciembr». La segunda era de
   ANTES del arreglo del 2/10 (v40-audit9: «diciembr» no se entendía y la fecha quedaba pegada al título, sin fecha). Las
   tareas viven en el dispositivo, así que la vieja seguía ahí. Ahora, al mirar o guardar tareas: (1) una tarea vieja SIN
   fecha cuyo título trae una fecha escrita con todas las letras («el 15 de diciembr») pasa a tener su fecha y el título
   limpio — solo «N de mes»: un «mañana» de hace un mes no es mañana; (2) dos pendientes con el mismo título y la misma
   fecha quedan en uno (el más viejo). Nada sale del dispositivo. */
function tareasSanear(){
  /* verificador 29/10 (GRAVE en la primera versión): reescribía tareas legítimas («la reunión del 3 de octubre» → «la reunión
     d»; una vencida saltaba al año que viene). Ahora es quirúrgico: SOLO una tarea sin fecha cuyo título TERMINA en «el N de
     <mes>» (con el mes entero o cortado: «diciembr»), con el año de CUANDO SE ANOTÓ; y solo se une con una que ya exista
     igual. Todo lo demás no se toca. */
  try {
    const a=tareasCargar(); if(!a.length) return false;
    const MES={ene:0,feb:1,mar:2,abr:3,may:4,jun:5,jul:6,ago:7,sep:8,set:8,oct:9,nov:10,dic:11};
    const RE=/^(.{3,}?)[\s,]+(?:para\s+)?el\s+(\d{1,2})\s+de\s+((ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic)[a-z]*)\s*[.!]*\s*$/i;
    const FULL={ene:'enero',feb:'febrero',mar:'marzo',abr:'abril',may:'mayo',jun:'junio',jul:'julio',ago:'agosto',sep:'septiembre',set:'setiembre',oct:'octubre',nov:'noviembre',dic:'diciembre'};
    let cambio=false; const saneadas=[];
    a.forEach(function(x){
      if(!x || x.hecha || x.fecha) return;
      const m=RE.exec(String(x.titulo||'')); if(!m) return;
      const k=m[4].toLowerCase(), w=m[3].toLowerCase(); if(FULL[k].indexOf(w)!==0) return;   // «marcos» no es marzo
      const base=x.ts?new Date(x.ts):new Date(); const dd=+m[2], mo=MES[k];
      let d=new Date(base.getFullYear(),mo,dd); if(d.getMonth()!==mo) return;
      const ref=new Date(base.getFullYear(),base.getMonth(),base.getDate());
      if(d<ref){ d=new Date(base.getFullYear()+1,mo,dd); if(d.getMonth()!==mo) return; }   // anotada en noviembre «para el 15 de enero» → el enero siguiente
      x.fecha=_tareaISO(d); x.titulo=m[1].trim(); cambio=true; saneadas.push(x);
    });
    let b=a;
    if(saneadas.length){
      b=a.filter(function(x){ if(saneadas.indexOf(x)<0) return true;
        const igual=a.find(function(y){ return y!==x && !y.hecha && saneadas.indexOf(y)<0 && _tareaNorm(y.titulo)===_tareaNorm(x.titulo) && (y.fecha||'')===x.fecha; });
        return !igual; });
    }
    if(cambio) tareasGuardarTodas(b);
    return cambio;
  } catch(e){ return false; }
}
function tareaGuardar(titulo, fechaISO){
  titulo=String(titulo||'').replace(/\s+/g,' ').trim().slice(0,120); if(!titulo) return false;
  try{ tareasSanear(); }catch(e){}
  const a=tareasCargar();
  if(a.some(x=>!x.hecha && _tareaNorm(x.titulo)===_tareaNorm(titulo) && (x.fecha||'')===(fechaISO||''))) return false;
  // v40-1029: la misma tarea que estaba SIN fecha, ahora con fecha → se completa la que estaba, no se duplica
  if(fechaISO){ const sinF=a.find(x=>!x.hecha && !x.fecha && _tareaNorm(x.titulo)===_tareaNorm(titulo)); if(sinF){ sinF.fecha=fechaISO; return tareasGuardarTodas(a); } }
  a.push({id:'t_'+Date.now()+'_'+Math.random().toString(36).slice(2,6), titulo:titulo, fecha:fechaISO||'', ts:Date.now(), hecha:false});
  return tareasGuardarTodas(a);
}
function tareasActivas(){ return tareasCargar().filter(x=>!x.hecha).sort((p,q)=>{ const a=p.fecha||'9999-99', b=q.fecha||'9999-99'; return a<b?-1:a>b?1:((p.ts||0)-(q.ts||0)); }); }
function tareaHecha(id){ const a=tareasCargar(); const x=a.find(t=>t.id===id); if(x){ x.hecha=true; tareasGuardarTodas(a); } try{ renderTareas(); }catch(e){} }
function tareaBorrar(id){ tareasGuardarTodas(tareasCargar().filter(t=>t.id!==id)); try{ renderTareas(); }catch(e){} }
function _tareaFechaLinda(iso){ if(!iso) return ''; const p=String(iso).split('-'); return p.length===3?(p[2]+'/'+p[1]):iso; }
// v40-agendar: en la TARJETA, si la fecha cae en otro año se dice («30/09/2027»): «el 30 de septiembre» ya pasado es el del año que viene
function _tareaFechaTarjeta(iso){ if(!iso) return ''; const y=String(iso).slice(0,4); return _tareaFechaLinda(iso)+(y!==String(new Date().getFullYear())?'/'+y:''); }
function _tareaVence(iso){ if(!iso) return false; return iso <= _tareaISO(new Date()); }
function tareasTexto(){ const a=tareasActivas(); if(!a.length) return ''; return a.map(x=>'• '+x.titulo+(x.fecha?' ('+_tareaFechaLinda(x.fecha)+')':'')).join('\n'); }
function getTareasContext(text){
  try{
    if(!/\b(tarea|tareas|pendient|qu[eé] tengo que hacer|qu[eé] tengo pendiente|mi agenda|agenda de hoy|qu[eé] hay para hoy|recordator)/i.test(text||'')) return '';
    const tt=tareasTexto(); if(!tt) return '';
    return '=== TUS TAREAS/PENDIENTES GUARDADAS (en el dispositivo; son las que el dueño anotó — contáselas tal cual, NO inventes ni agregues) ===\n'+tt;
  }catch(e){ return ''; }
}
function renderTareas(){
  const cont=document.getElementById('tareas-lista'); if(!cont) return;
  try{ tareasSanear(); }catch(e){} // v40-1029
  const a=tareasActivas();
  if(!a.length){ cont.innerHTML='<div style="opacity:0.6;font-size:12px;padding:8px 2px;">No hay tareas guardadas. Cuando me pidas «agendá …» o «recordame …», la anoto acá.</div>'; return; }
  cont.innerHTML=a.map(function(x){
    const f=x.fecha?'<span style="opacity:0.8;'+(_tareaVence(x.fecha)?'color:#ffb454;':'')+'">'+_tareaFechaLinda(x.fecha)+'</span>':'';
    return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 6px;border-bottom:1px solid var(--border);">'
      +'<div style="font-size:12.5px;color:var(--text-bright);">'+actuaEsc(x.titulo)+(f?' · '+f:'')+'</div>'
      +'<div style="display:flex;gap:4px;"><button onclick="tareaHecha(\''+x.id+'\')" title="Marcar como hecha" aria-label="Hecha" style="background:none;border:1px solid var(--border);border-radius:6px;color:var(--text-dim);cursor:pointer;font-size:12px;padding:3px 8px;">✓</button>'
      +'<button onclick="tareaBorrar(\''+x.id+'\')" title="Borrar" aria-label="Borrar" style="background:none;border:1px solid var(--border);border-radius:6px;color:var(--text-dim);cursor:pointer;font-size:12px;padding:3px 8px;">✕</button></div>'
      +'</div>';
  }).join('');
}
function tareasAvisoInicial(){
  try{
    if(sessionStorage.getItem('mirror_tareas_aviso')==='1') return;
    const due=tareasActivas().filter(x=>x.fecha && _tareaVence(x.fecha));
    if(!due.length) return;
    sessionStorage.setItem('mirror_tareas_aviso','1');
    const items=due.slice(0,3).map(x=>String(x.titulo).replace(/</g,'&lt;')).join(', ');
    cumpliLinea('📋 Tenés '+due.length+' pendiente'+(due.length>1?'s':'')+' para hoy o vencido'+(due.length>1?'s':'')+': <b>'+items+'</b>. Preguntame «¿qué tengo pendiente?» cuando quieras.');
  }catch(e){ try{ regError('tareas:aviso',e) }catch(_){} }
}
function contactosParse(texto){
  const t=String(texto||''); const out=[];
  if(/BEGIN:VCARD/i.test(t)){
    const lineas=t.replace(/\r\n/g,'\n').replace(/\n[ \t]/g,'').split('\n');
    let cur=null;
    for(const ln of lineas){
      if(/^BEGIN:VCARD/i.test(ln)){ cur={nombre:'',tel:'',email:'',_n:''}; continue; }
      if(/^END:VCARD/i.test(ln)){ if(cur){ if(!cur.nombre&&cur._n) cur.nombre=cur._n; out.push(cur); } cur=null; continue; }
      if(!cur) continue;
      const c=ln.indexOf(':'); if(c<0) continue;
      const prop=ln.slice(0,c).toUpperCase().replace(/^ITEM\d+\./,'').split(';')[0];
      const val=ln.slice(c+1).trim();
      if(prop==='FN'&&val) cur.nombre=val;
      else if(prop==='N'&&!cur._n){ const p=val.split(';'); cur._n=((p[1]||'')+' '+(p[0]||'')).trim(); }
      else if(prop==='TEL'&&!cur.tel) cur.tel=val;
      else if(prop==='EMAIL'&&!cur.email) cur.email=val;
    }
  } else {
    const filas=_contCsvFilas(t);
    if(filas.length>1){
      const head=filas[0].map(h=>String(h).toLowerCase().trim());
      const idxNom=head.findIndex(h=>h==='name'||h==='nombre'||h==='full name');
      const idxFirst=head.findIndex(h=>/^first name$|^nombre$|given name/.test(h));
      const idxLast=head.findIndex(h=>/^last name$|^apellido$|family name/.test(h));
      const idxTel=head.findIndex(h=>/phone.*value|^tel|tel[eé]fono|celular|m[oó]vil|mobile|phone/.test(h));
      const idxMail=head.findIndex(h=>/e-?mail.*value|^e-?mail|correo/.test(h));
      for(let i=1;i<filas.length;i++){
        const fi=filas[i];
        let nombre=idxNom>=0?(fi[idxNom]||''):'';
        if(!nombre) nombre=[(idxFirst>=0?fi[idxFirst]:''),(idxLast>=0?fi[idxLast]:'')].filter(Boolean).join(' ').trim();
        const tel=idxTel>=0?String(fi[idxTel]||'').split(/ ::: |;/)[0]:'';
        const email=idxMail>=0?String(fi[idxMail]||'').split(/ ::: |;/)[0]:'';
        out.push({nombre:String(nombre).trim(),tel:tel,email:email});
      }
    }
  }
  return out.map(c=>({nombre:String(c.nombre||'').trim(),tel:_contNormTel(c.tel),email:String(c.email||'').trim()}))
            .filter(c=>c.nombre && (c.tel||c.email));
}
function contactosImportarArchivo(ev){
  const f=ev&&ev.target&&ev.target.files&&ev.target.files[0]; if(!f) return;
  const rd=new FileReader();
  rd.onload=function(){
    try{
      const lista=contactosParse(String(rd.result||''));
      if(!lista.length){ agendaAvisoPanel('No encontré contactos en ese archivo. Tiene que ser un .vcf (vCard) o un .csv exportado de tu celular o de Google Contactos.'); }
      else {
        const ag=actuaAgenda(); let nuevos=0,yaEstaban=0,fallos=0;
        lista.forEach(function(c){
          const k=_normNombre(c.nombre); if(!k) return;
          if(ag[k]!==undefined){ yaEstaban++; return; }
          const campos={};
          if(c.tel && actuaNumOk(c.tel)) campos.tel=c.tel;
          if(c.email && actuaMailDirOk(c.email)) campos.email=c.email;
          if(!campos.tel && !campos.email) return;
          if(actuaAgendaGuardar(c.nombre,campos)){ nuevos++; ag[k]=1; } else fallos++;
        });
        renderAgenda();
        agendaAvisoPanel('Importé '+nuevos+' contacto(s) nuevo(s)'+(yaEstaban?' · '+yaEstaban+' ya estaban (no los toqué)':'')+(fallos?' · '+fallos+' no entraron (¿almacenamiento lleno?)':'')+'. Se leyó todo acá, en tu dispositivo — no viajó nada.');
      }
    }catch(e){ agendaAvisoPanel('No pude leer ese archivo. Probá con un .vcf o un .csv.'); try{regError('contactos:importar',e);}catch(_){} }
    try{ ev.target.value=''; }catch(e){}
  };
  rd.onerror=function(){ try{ agendaAvisoPanel('No pude abrir el archivo.'); }catch(e){} };
  rd.readAsText(f);
}
/* ══════════ v39-agenda (22/08/2026) — PORTE DE LA AGENDA DEL MIRROR PERSONAL ══════════
   Se construye ACÁ y se prueba ACÁ; no se copia a ojo. Lo que se trae y por qué:
   · _normNombre + clave normalizada: la agenda guardaba «maría» y se buscaba «maria» → no
     coincidían y decía «no lo tengo» con el dato guardado.
   · match por nombre de pila: el usuario pide «laura», no «Laura Peña». Sin esto la app queda
     DESVINCULADA de su propia agenda — es el bug que Darío vio en vivo en el MIRROR.
   · pedir el apellido cuando hay dos: nunca adivinar a cuál mandarle.
   LO QUE NO SE PORTÓ, Y POR QUÉ: el guard «que la música no se robe la agenda» (F3 del MIRROR)
   acá NO hace falta. Se leyó la regla: la de esta muleta EXIGE la palabra «música» y la de
   artista pelado está anclada a «poné/pasá», así que «buscá el contacto de X» no le entra a
   ninguna. Portar un fix que no aplica sería ruido. */
function _normNombre(s){
  const re = new RegExp('[\\u0300-\\u036f]', 'g');   // marcas diacríticas combinantes
  try { return String(s||'').toLowerCase().trim().normalize('NFD').replace(re,''); }
  catch(e){ return String(s||'').toLowerCase().trim(); }   // navegador sin normalize(): al menos may/min
}
/* Candidatos de la agenda para un nombre suelto. Devuelve las CLAVES que coinciden. */
function actuaCandidatos(nombre){
  const a = actuaAgenda();
  const k = _normNombre(nombre);
  if (!k || k.length < 2) return [];
  if (a[k]) return [k];
  for (const kk in a){ if (_normNombre(kk) === k) return [kk]; }   // clave vieja con tilde/mayúsculas
  const cand = [];
  for (const kk in a){
    const nk = _normNombre(kk);
    if (nk.split(/\s+/).indexOf(k) >= 0) cand.push(kk);          // palabra entera (pila o apellido)
    else if (k.length >= 3 && nk.indexOf(k) === 0) cand.push(kk); // o prefijo de >=3 letras (typos)
  }
  return cand;
}
/* '' si no hay ambigüedad. Con dos o más, el pedido de precisión en criollo. */
function actuaPedirPrecisar(nombre, acc, accion, msg){
  const cand = actuaCandidatos(nombre);
  if (cand.length < 2) return '';
  // v40-pendiente: queda anotado qué estábamos por hacer, para entender la respuesta del turno siguiente
  if (accion && typeof actuaPendPedir === 'function') actuaPendPedir(accion, msg);
  const a = actuaAgenda();
  const nombres = cand.map(function(k){ const v = a[k]; return (v && v.nombre) || k; });
  const q = String(nombre||'').trim();
  return 'Tengo '+cand.length+' contactos que coinciden con «'+q+'»: '+nombres.join(' y ')+
         '. No voy a adivinar cuál. Decímelo con el apellido y '+(acc||'sigo')+'.';
}
/* ══════════ v40-pendiente (22/08/2026) — LA APP SE ACUERDA DE LO QUE PREGUNTÓ ══════════
   HALLAZGO EN VIVO DE DARÍO (22/08): la app pidió «decímelo con el apellido», él contestó
   «LAURA PEÑA»… y ese mensaje no matcheaba NINGUNA regla, así que se fue al modelo. El modelo
   NO tiene la agenda: contestó «no tengo el mail de Laura Peña» cuando el mail SÍ estaba
   guardado. Preguntamos y después no sabíamos escuchar la respuesta, y el precio fue una
   afirmación FALSA sobre un dato real. Eso rompe la Regla de Oro.
   POR QUÉ EL ARREGLO ES ASÍ DE CONSERVADOR (esto es estado entre turnos, lo más fácil de
   arruinar, y va a producción sin auditoría en vivo — se blinda a propósito):
   · La pendiente vive en una propiedad de función, NO en localStorage: se muere al recargar.
     Nada puede quedar pegado entre sesiones ni entre dispositivos.
   · Dura UN turno. El mensaje siguiente la usa o la borra. Se consume SIEMPRE, aunque no sirva.
   · Solo la toma un mensaje que sea un NOMBRE PELADO (letras, espacios, 2 a 29) y que resuelva
     a UN contacto único. Si sigue habiendo dos, o si no está, no hace nada y vuelve a preguntar.
   · NO duplica la lógica de las tarjetas: REESCRIBE el pedido a su forma canónica y deja
     trabajar a las reglas de siempre, que ya tienen sus pruebas amarradas. Menos código nuevo.
   · Lo que se ve en pantalla y lo que va al historial siguen siendo las palabras del usuario:
     la reescritura es interna. La app no le pone palabras en la boca. */
function actuaPendBox(){ if (!actuaPendBox._v) actuaPendBox._v = { p:null }; return actuaPendBox._v; }
function actuaPendPedir(accion, msg){ actuaPendBox().p = { accion:accion, msg:String(msg||'') }; }
function actuaPendReescribir(text){
  const box = actuaPendBox();
  const p = box.p;
  box.p = null;                                  // se consume siempre: nunca sobrevive un turno
  if (!p) return '';
  const q = String(text||'').trim().replace(/[?.!¿¡]+$/,'').trim();
  // nombre pelado: sin dígitos, sin dos puntos ni comas (romperían la captura del destinatario)
  if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ' ]{1,28}$/.test(q)) return '';
  if (!actuaContacto(q)) return '';              // no resuelve, o sigue habiendo dos → que pregunte de nuevo
  if (p.accion === 'tel')   return 'llamá a ' + q;
  if (p.accion === 'datos') return 'buscá el contacto de ' + q;
  if (!p.msg.trim())        return 'buscá el contacto de ' + q;   // sin mensaje no hay nada que mandar
  if (p.accion === 'wa')    return 'mandale un whatsapp a ' + q + ' que ' + p.msg;
  if (p.accion === 'mail')  return 'mandale un mail a ' + q + ' que ' + p.msg;
  return '';
}

/* ── v37-agenda (A2) — la mini-agenda ahora guarda TEL, MAIL y DIRECCIÓN ──
   Antes era nombre → número (un string suelto). Por eso el redactor de mails
   dejaba «destinatario a completar»: no tenía de dónde sacar la dirección, y no
   la inventa. Ahora es nombre → {tel, email, dir}.
   RETROCOMPAT: una entrada vieja (string) se lee como tel. Nada de lo guardado
   se pierde ni hay que volver a dictarlo.
   Sigue viviendo SOLO en localStorage: el dispositivo del usuario, no sale de ahí. */
function actuaContacto(nombre){
  const a = actuaAgenda();
  const k = _normNombre(nombre);
  let v = a[k];
  if (!v) { for (const kk in a){ if (_normNombre(kk) === k){ v = a[kk]; break; } } } // clave vieja
  // v39-agenda: match por nombre de pila. SOLO resuelve si hay UN candidato: con dos «Laura»
  //   devuelve null y la regla pide el apellido (actuaPedirPrecisar). Adivinar está prohibido.
  if (!v && k && k.length >= 2){
    const cand = actuaCandidatos(nombre);
    if (cand.length === 1) v = a[cand[0]];
  }
  if (!v) return null;
  if (typeof v === 'string') return { tel:v, email:'', dir:'', nombre:nombre }; // formato viejo
  return { tel:v.tel||'', email:v.email||'', dir:v.dir||'', nombre:(v.nombre||nombre) };
}
/* Guarda MEZCLANDO: guardar el mail de alguien no le borra el teléfono. */
/* ══════════ v38-contacto (C3) — CONTACT PICKER ══════════
   El navegador jamás entrega la agenda: abre el selector del usuario, toca UN contacto y
   llega ese. Por eso `select()` tiene que salir SIN un await antes (si no, el navegador
   considera perdido el gesto y lo rechaza) — ojo si algún día se suma `getProperties()`. */
/* ══════════ v38-tramite (C4) — PLANTILLAS DE TRÁMITES ══════════
   Lo burocrático es la fricción que más tiempo come: justificar una inasistencia, pedir un
   turno, hacer un reclamo, pedir un certificado, autorizar a alguien. Estas plantillas se
   arman ACÁ, sin modelo, sin red y sin un token: son esqueletos honestos.
   REGLA DE ORO: lo que el usuario no dijo NO se inventa — queda entre <corchetes> a la
   vista. La firma sale de SU perfil del constructor; si no lo cargó, queda <tu nombre>.
   La entrega va por la tarjeta de compartir (C1): sale por la app que quiera, o se copia. */
function tramiteFirma(){ try{ return (typeof CONFIG!=='undefined' && CONFIG.perfil && CONFIG.perfil.nombre) ? String(CONFIG.perfil.nombre).trim() : '<tu nombre>'; }catch(e){ return '<tu nombre>'; } }
function tramiteCampo(txt, re){ try{ const m=re.exec(txt); return m ? String(m[1]).trim().replace(/[.,;]+$/,'') : ''; }catch(e){ return ''; } }
function tramiteDatos(txt){
  const t=String(txt||'');
  return {
    para:   tramiteCampo(t, /\b(?:a|para|ante)\s+(?:la|el|los|las)\s+([a-záéíóúüñ][a-záéíóúüñ\s]{2,40})/i),
    fecha:  tramiteCampo(t, /\b(?:del|el|para\s+el|desde\s+el)\s+(\d{1,2}(?:\s*\/\s*\d{1,2}(?:\s*\/\s*\d{2,4})?|\s+de\s+[a-záéíóúñ]{3,10}(?:\s+de\s+\d{4})?))/i),
    motivo: tramiteCampo(t, /\b(?:por|porque|debido\s+a|a\s+causa\s+de)\s+(.{3,90})$/i)
  };
}
const TRAMITE_PLANTILLAS = [
  { id:'inasistencia', nom:'justificar una inasistencia', re:/inasistencia|justificar\s+(?:una\s+)?falta|ausencia|no\s+pude\s+ir/i,
    arma(d){ return 'Estimado/a '+(d.para||'<a quién va dirigido>')+':\n\n'
      +'Me dirijo a usted para justificar mi inasistencia '+(d.fecha?'del '+d.fecha:'del <día>')+', '
      +(d.motivo?'debida a '+d.motivo+'.':'por <motivo>.')+' De ser necesario, adjunto la documentación que lo respalde.\n\n'
      +'Quedo a disposición por cualquier trámite adicional.\n\nSaludos cordiales,\n'+tramiteFirma(); } },
  { id:'turno', nom:'pedir un turno', re:/(?:pedir|sacar|solicitar)\s+(?:un\s+)?turno|turno\s+(?:m[eé]dico|con)/i,
    arma(d){ return 'Buen día:\n\nQuisiera solicitar un turno '+(d.para?'en/con '+d.para:'en <lugar o profesional>')+'. '
      +(d.motivo?'El motivo es '+d.motivo+'. ':'Motivo: <motivo>. ')
      +(d.fecha?'Mi preferencia sería el '+d.fecha+', ':'Mi disponibilidad es <días y horarios>, ')
      +'pero puedo acomodarme a lo que tengan.\n\nMis datos: '+tramiteFirma()+', DNI <número>, teléfono <número>.\n\nDesde ya, muchas gracias.'; } },
  { id:'reclamo', nom:'hacer un reclamo', re:/reclamo|reclamar|queja|no\s+me\s+(?:funciona|responden)/i,
    arma(d){ return 'Estimados '+(d.para||'<a quién va dirigido>')+':\n\n'
      +'Presento el siguiente reclamo: '+(d.motivo||'<qué pasó, con fechas y datos concretos>')+'. '
      +(d.fecha?'El hecho ocurrió el '+d.fecha+'. ':'')
      +'Solicito que se me informe qué solución se le dará y en qué plazo.\n\n'
      +'Quedo a la espera de una respuesta por este mismo medio.\n\nSaludos,\n'+tramiteFirma()+'\nDNI <número> · Nº de cliente/expediente <si corresponde>'; } },
  { id:'certificado', nom:'pedir un certificado o constancia', re:/certificado|constancia|comprobante\s+de/i,
    arma(d){ return 'Estimado/a '+(d.para||'<a quién va dirigido>')+':\n\n'
      +'Solicito me sea emitida una constancia '+(d.motivo?'de '+d.motivo:'de <qué debe acreditar>')+', '
      +'para ser presentada ante <dónde se presenta>.\n\n'
      +'Mis datos: '+tramiteFirma()+', DNI <número>'+(d.fecha?', con fecha de referencia '+d.fecha:'')+'.\n\n'
      +'Agradezco me indiquen si debo completar algún formulario o abonar un arancel.\n\nSaludos cordiales.'; } },
  { id:'autorizacion', nom:'autorizar a alguien', re:/autoriza|permiso\s+para|habilit[aá]\s+a/i,
    arma(d){ return 'Por la presente, yo, '+tramiteFirma()+', DNI <número>, autorizo a <nombre completo>, DNI <número>, '
      +'a '+(d.motivo||'<qué queda autorizado a hacer>')+(d.fecha?' el día '+d.fecha:' el día <fecha>')+'.\n\n'
      +'Sin otro particular, saludo atentamente.\n\nFirma: ____________________\nAclaración: '+tramiteFirma(); } }
];
function tramiteBuscar(txt){ for(const p of TRAMITE_PLANTILLAS){ if(p.re.test(txt)) return p; } return null; }
function contactosSoporte(){ try{ return !!(navigator.contacts && typeof navigator.contacts.select==='function'); }catch(e){ return false; } }
async function contactoElegir(){
  if(!contactosSoporte()) return 'Este navegador no me deja abrir tu lista de contactos. Dictámelo: «guardá el número de <nombre> <número>».';
  try{
    const sel = await navigator.contacts.select(['name','tel','email'], { multiple:false });
    if(!sel || !sel.length) return 'No elegiste ninguno — todo sigue como estaba.';
    const c = sel[0]||{};
    const nombre = (c.name && c.name[0]) ? String(c.name[0]).trim() : '';
    const tel    = (c.tel  && c.tel[0])  ? String(c.tel[0]).trim()  : '';
    const email  = (c.email&& c.email[0])? String(c.email[0]).trim(): '';
    if(!nombre) return 'Ese contacto vino sin nombre y no lo puedo guardar así — probá dictándomelo.';
    if(!tel && !email) return 'De «'+nombre+'» no me llegó ni número ni mail: no guardo un contacto vacío.';
    if(!actuaAgendaGuardar(nombre,{tel:tel,email:email})) return 'Elegiste a «'+nombre+'» pero el almacenamiento del navegador me negó el guardado — quedó en mi diagnóstico.';
    return 'Listo ✅ — «'+nombre+'» quedó en TU agenda local'+((tel?' 📞':'')+(email?' ✉':''))+'. Del resto de tu lista no vi nada. Ahora «mandale un whatsapp a '+nombre+' que…» te sale de una.';
  }catch(e){
    try{ regError('contacto:picker',e) }catch(_){}
    if(e && e.name==='AbortError') return 'Cerraste el selector — no guardé nada.';
    return 'No pude abrir tu lista de contactos (el navegador lo rechazó: suele pasar si no fue con un toque directo o si la página no está en https). Dictámelo y lo guardo igual.';
  }
}
function actuaAgendaGuardar(nombre,campos){
  const a = actuaAgenda();
  const k = _normNombre(nombre);
  if (!k) return false;
  // v39-agenda: si había una entrada vieja bajo otra forma del nombre (tilde/mayúsculas), se
  //   migra a la clave normalizada para no dejar duplicados. Nada de lo guardado se pierde.
  if (!a[k]) { for (const kk in a){ if (kk !== k && _normNombre(kk) === k){ a[k] = a[kk]; delete a[kk]; break; } } }
  /* v41-agenda2 (23/08/2026) — POR QUÉ ACÁ NO SE PUEDE USAR actuaContacto.
     `actuaContacto` matchea por nombre de pila y por prefijo: es lo que hace que «mandale un
     mail a maria» encuentre a «María Gómez». Para GUARDAR eso es veneno. Con «María Gómez» en
     la agenda, guardar un contacto nuevo llamado «Maria» tomaba a María Gómez como «previo» y
     el contacto nuevo NACÍA con el mail de otra persona. Un dato ajeno metido en un contacto
     que el usuario acaba de crear es lo más grave que puede hacer una agenda.
     Fusionar solo tiene sentido contra la MISMA entrada: la clave exacta, nada de parecidos. */
  const _ex = a[k];
  const previo = (_ex === undefined) ? { tel:'', email:'', dir:'', nombre:'' }
    : (typeof _ex === 'string') ? { tel:_ex, email:'', dir:'', nombre:'' }
    : { tel:_ex.tel||'', email:_ex.email||'', dir:_ex.dir||'', nombre:_ex.nombre||'' };
  const nuevo = (typeof campos === 'string') ? { tel:campos } : (campos||{});
  a[k] = {
    // el nombre TAL CUAL se escribió, para mostrarlo lindo; la CLAVE va sin tildes
    nombre: String(nombre||'').trim() || previo.nombre || nombre,
    tel:   (nuevo.tel   !== undefined && nuevo.tel   !== '') ? String(nuevo.tel).trim()   : previo.tel,
    email: (nuevo.email !== undefined && nuevo.email !== '') ? String(nuevo.email).trim() : previo.email,
    dir:   (nuevo.dir   !== undefined && nuevo.dir   !== '') ? String(nuevo.dir).trim()   : previo.dir
  };
  try { localStorage.setItem('mirror_agenda',JSON.stringify(a)); return true; } catch(e){ return false; }
}
function actuaNumOk(n){ return /^\+?[\d][\d\s().-]{5,19}$/.test(String(n||'').trim()); }
function actuaTelURL(n){ return 'tel:'+String(n).replace(/[^\d+]/g,''); }

/* ── v37-tel (A1) — WhatsApp EXIGE formato internacional completo ──
   RADAR 26/07: quedó REFUTADO el candidato de usar `api.whatsapp.com/send` en
   lugar de `wa.me` — cada clic en wa.me se convierte en una request a
   api.whatsapp.com un instante después, así que son equivalentes.
   WHITE-LABEL: acá NO se puede asumir Argentina. El código de país lo elige
   cada usuario en su constructor (CONFIG.paisCod). Sin código configurado y con
   un número local, no se adivina: seguro:false y la tarjeta lo avisa. */
const ACTUA_PAIS_MOVIL9 = ['54']; // países que meten un 9 antes del área para móviles
function actuaPaisCod(){ try { return String((CONFIG && CONFIG.paisCod) || '').replace(/[^\d]/g,''); } catch(e) { return ''; } }
function actuaWaNum(n){
  const crudo = String(n||'').trim();
  const inter = crudo.startsWith('+');
  let d = crudo.replace(/[^\d]/g,'');
  if (!d) return { num:'', seguro:false, nota:'no me llegó ningún número' };
  if (inter) return { num:d, seguro:true, nota:'' };
  const pais = actuaPaisCod();
  if (!pais) {
    return { num:d, seguro:false, nota:'para que WhatsApp abra hace falta el número en formato internacional. Poné tu código de país en el constructor, o guardá el número con + y el código (ej: +54 9 299 …)' };
  }
  const nueve = ACTUA_PAIS_MOVIL9.indexOf(pais) >= 0 ? '9' : '';
  if (d.startsWith(pais + '9') && nueve && d.length >= pais.length + 10) return { num:d, seguro:true, nota:'' };
  if (d.startsWith(pais) && d.length >= pais.length + 9) {
    const resto = d.slice(pais.length);
    return { num: pais + nueve + resto, seguro:true, nota:'' };
  }
  if (d.startsWith('0')) d = d.replace(/^0+/,'');
  if (nueve && d.length === 12) {
    for (const corte of [2,3,4]) {
      if (d.slice(corte, corte+2) === '15') {
        const sin15 = d.slice(0,corte) + d.slice(corte+2);
        if (sin15.length === 10) return { num: pais + nueve + sin15, seguro:true, nota:'' };
      }
    }
  }
  if (d.length >= 9 && d.length <= 10) return { num: pais + nueve + d, seguro:true, nota:'' };
  return { num:d, seguro:false, nota:'no pude completar el código de país de «'+crudo+'» — guardalo en formato internacional (con + y el código de tu país)' };
}
function actuaWaURL(n,msg){ const r=actuaWaNum(n); return 'https://wa.me/'+r.num+(msg?'?text='+encodeURIComponent(msg):''); }
function actuaYtURL(q){ return 'https://www.youtube.com/results?search_query='+encodeURIComponent(q); }
function actuaMapsURL(q){ return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q); }
function actuaCalURL(t, fechaISO){
  // v59-caldate (10/09/2026) — POR QUÉ: antes el link no llevaba fecha y Google abría en HOY,
  // aunque MIRROR ya sabía el día (la tarea persistente lo calcula con _tareaFecha). Hallazgo
  // en vivo de Darío 10/09. Ahora, si hay fecha ISO válida, se pre-carga como evento de día
  // completo (Google marca all-day con fin exclusivo = día siguiente). La HORA la seguís
  // poniendo vos — no la inventamos. Sin fecha, se comporta igual que antes.
  var base='https://calendar.google.com/calendar/render?action=TEMPLATE&text='+encodeURIComponent(t);
  var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(fechaISO||''));
  if(m){ var d=new Date(+m[1],+m[2]-1,+m[3]);
    if(!isNaN(d.getTime())){ var p=function(n){return String(n).padStart(2,'0');};
      var fin=new Date(d.getTime()+86400000);
      base+='&dates='+m[1]+m[2]+m[3]+'/'+fin.getFullYear()+p(fin.getMonth()+1)+p(fin.getDate()); } }
  return base;
}
// v36-redactor (Etapa 13 C2) — REDACTOR: mail con asunto y cuerpo listos. La dirección se valida
// con charset estricto (sin comillas ni <>) o se deja vacía y la completa el usuario en su correo.
function actuaMailDirOk(d){ return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(String(d||'').trim()); }
function actuaMailURL(dir,asunto,cuerpo){ return 'mailto:'+(actuaMailDirOk(dir)?String(dir).trim():'')+'?subject='+encodeURIComponent(String(asunto||''))+'&body='+encodeURIComponent(String(cuerpo||'')); }
const REDACTOR_URL_MAX=1800; // v36-redactor: más largo que esto, el enlace se corta según el navegador → portapapeles honesto
const ACTUA_URL_OK=[/^tel:\+?\d{6,20}$/,/^https:\/\/wa\.me\/\d{6,20}(\?text=.*)?$/,/^https:\/\/www\.youtube\.com\/results\?search_query=.+/,/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=.+/,/^https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE&text=.+/,/^mailto:[A-Za-z0-9._%+-]*(@[A-Za-z0-9.-]+\.[A-Za-z]{2,})?\?subject=[^\s&]*&body=\S*$/]; // v36-redactor: mailto sumado a la lista blanca
function actuaURLValida(u){ return typeof u==='string' && ACTUA_URL_OK.some(re=>re.test(u)); }
function actuaEsc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
// la tarjeta es el ÚNICO camino para pintar una acción: URL inválida → no pinta y queda registrado
/* v37-toque (A4/A5) — ¿estamos en un escritorio? Solo para AVISAR de la fricción
   del sistema operativo, nunca para cambiar la acción. */
function actuaEsEscritorio(){
  try {
    if (navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean') return !navigator.userAgentData.mobile;
    return !/Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(navigator.userAgent||'');
  } catch(e) { return false; }
}
function actuaNotaEscritorio(url){
  if (!actuaEsEscritorio()) return '';
  if (/^tel:/.test(url))    return 'En la compu puede pedirte elegir una app para llamar. Desde el celular abre el discador directo.';
  if (/^mailto:/.test(url)) return 'En la compu puede preguntarte con qué app abrirlo.';
  return '';
}
// la tarjeta es el ÚNICO camino para pintar una acción: URL inválida → no pinta
function actuaTarjeta(icono,titulo,detalle,url,boton,textoShare){
  if (!actuaURLValida(url)){ try{ regError('actua2:url_rechazada', new Error(String(url).slice(0,80))) }catch(e){} return false; }
  // v37-orden (E1): dentro de un comando, la tarjeta espera su turno
  if (actuaDifiriendo){ actuaDiferidas.push([icono,titulo,detalle,url,boton,textoShare]); return true; }
  const chat=document.getElementById('chat');
  const div=document.createElement('div'); div.className='msg';
  const notaOS=actuaNotaEscritorio(url); // v37-toque (A5)
  div.innerHTML='<div class="av mav" style="opacity:0;"></div><div class="actua-card actua-tap" role="link" tabindex="0" aria-label="'+actuaEsc(titulo+'. '+boton)+'">'
    +'<div class="actua-tit">'+actuaEsc(icono)+' '+actuaEsc(titulo)+'</div>'
    +(detalle?'<div class="actua-det">'+actuaEsc(detalle)+'</div>':'')
    +'<a class="actua-btn" href="'+actuaEsc(url)+'" target="_blank" rel="noopener noreferrer">'+actuaEsc(boton)+'</a>'
    /* v38-share (C1): segundo botón SOLO si hay algo que compartir y el navegador da el
       selector. El botón de siempre no se toca: la tarjeta con destinatario ya puesto
       sigue siendo el camino principal — esto es la salida «a cualquier otra app». */
    +((textoShare && mirrorCompartirSoporte())?'<a class="actua-btn actua-share" href="#" data-share2="1">📤 mandarlo por otra app</a>':'')
    +(notaOS?'<div class="actua-os">'+actuaEsc(notaOS)+'</div>':'')+'</div>';
  try{
    const bs=div.querySelector('[data-share2]');
    if(bs) bs.addEventListener('click',function(ev){ ev.preventDefault(); ev.stopPropagation();
      mirrorCompartir(String(textoShare||''),titulo).then(function(ok){ if(ok) bs.textContent='✅ listo — el envío lo diste vos'; else compartirCopiar(bs,String(textoShare||'')); },
                                                          function(){ compartirCopiar(bs,String(textoShare||'')); });
    });
  }catch(e){ try{ regError('share:boton',e) }catch(_){} } // si el botón extra falla, la tarjeta sigue entera
  /* v37-toque (A4) — TODA la tarjeta abre la acción. Se dispara el click del <a>
     real para conservar la activación del gesto, el target y el rel. */
  try {
    const card=div.querySelector('.actua-card');
    const link=div.querySelector('.actua-btn');
    if (card && link){
      const disparar=function(ev){
        if (ev.target && ev.target.closest && ev.target.closest('.actua-btn')) return;
        ev.preventDefault(); link.click();
      };
      card.addEventListener('click', disparar);
      card.addEventListener('keydown', function(ev){ if (ev.key==='Enter'||ev.key===' '){ disparar(ev); } });
    }
  } catch(e){ try{ regError('actua2:tap', e) }catch(_){} }
  chat.appendChild(div); chat.scrollTop=chat.scrollHeight; return true;
}
// v36-redactor: entrega del borrador — si la URL entra en un enlace, tarjeta normal (lista blanca);
// si el borrador es más largo de lo que una URL aguanta, HONESTIDAD + copiar al portapapeles.
function redactorTarjeta(icono,titulo,detalle,url,boton,textoCopia){
  // v38-share (C1): el borrador viaja también como texto para compartir → la tarjeta suma
  // el botón «mandarlo por otra app» sin perder el camino de siempre (mailto/wa.me).
  if (url && url.length<=REDACTOR_URL_MAX) return actuaTarjeta(icono,titulo,detalle,url,boton,textoCopia);
  const chat=document.getElementById('chat'); if(!chat) return false;
  const div=document.createElement('div'); div.className='msg';
  div.innerHTML='<div class="av mav" style="opacity:0;"></div><div class="actua-card">'
    +'<div class="actua-tit">'+actuaEsc(icono)+' '+actuaEsc(titulo)+'</div>'
    +'<div class="actua-det">El borrador quedó más largo de lo que un enlace aguanta — te lo copio al portapapeles y lo pegás donde va. '+actuaEsc(detalle||'')+'</div>'
    +'<a class="actua-btn" href="#" data-copia="1">📋 copiar el borrador</a>'
    +(mirrorCompartirSoporte()?'<a class="actua-btn actua-share" href="#" data-share3="1">📤 mandarlo por otra app</a>':'')+'</div>'; // v38-share (C1)
  const btn=div.querySelector('[data-copia]'); const texto=String(textoCopia||'');
  try{
    const bs=div.querySelector('[data-share3]');
    if(bs) bs.addEventListener('click',function(ev){ ev.preventDefault(); ev.stopPropagation();
      mirrorCompartir(texto,titulo).then(function(ok){ if(ok) bs.textContent='✅ listo — el envío lo diste vos'; else compartirCopiar(bs,texto); }, function(){ compartirCopiar(bs,texto); });
    });
  }catch(e){ try{ regError('share:boton_redactor',e) }catch(_){} }
  btn.addEventListener('click',function(ev){ ev.preventDefault();
    const listo=function(){ btn.textContent='✅ copiado — pegalo donde va'; };
    try{ if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(texto).then(listo,function(){ redactorCopiaVieja(texto,listo); }); } else { redactorCopiaVieja(texto,listo); } }
    catch(e){ try{ redactorCopiaVieja(texto,listo) }catch(e2){ btn.textContent='no pude copiar — seleccioná el texto del chat'; try{regError('redactor:copiar',e2)}catch(e3){} } }
  });
  chat.appendChild(div); chat.scrollTop=chat.scrollHeight; return true;
}
function redactorCopiaVieja(texto,cb){ const ta=document.createElement('textarea'); ta.value=texto; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); if(cb)cb(); } finally{ document.body.removeChild(ta); } }
/* ══════════ v38-share (C1) — «HABLÁ Y MANDÁ» ══════════
   Generaliza las tarjetas wa.me/mailto a CUALQUIER app instalada, sin integraciones,
   sin claves y sin que nada pase por un servidor: navigator.share abre el selector del
   sistema operativo y el usuario elige a dónde va y da el toque final.
   EL PRINCIPIO (no es limitación, es diseño): el navegador NO puede apretar «enviar» por
   el usuario. Las apps que mandan solas viven con sus contraseñas en la nube. Acá la
   fricción baja a un segundo y el consentimiento sigue siendo humano. En la white-label
   esto importa doble: lo que se reparte a terceros no puede mandar nada por su cuenta.
   CUÁNDO USA CADA CAMINO:
   · destinatario Y app conocidos → tarjeta wa.me/mailto de siempre (pre-llena todo)
   · «mandá esto a quien sea / por donde sea» → navigator.share
   En escritorio, donde el selector suele no estar, cae al portapapeles — nunca se promete
   una lista de apps que el navegador no da. */
function mirrorCompartirSoporte(){ try{ return typeof navigator!=='undefined' && typeof navigator.share==='function'; }catch(e){ return false; } }
async function mirrorCompartir(texto,titulo){
  if(!mirrorCompartirSoporte()) return false;
  const datos={ text:String(texto||'') }; if(titulo) datos.title=String(titulo);
  try{ if(navigator.canShare && !navigator.canShare(datos)) return false; }catch(e){}
  try{ await navigator.share(datos); return true; }
  catch(e){
    if(e && e.name==='AbortError') return true;   // el usuario cerró el selector: no es un error
    try{ regError('share:compartir',e) }catch(_){}
    return false;
  }
}
function compartirCopiar(btn,texto){
  const listo=function(){ btn.textContent='✅ copiado — pegalo donde va'; };
  try{ if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(texto).then(listo,function(){ redactorCopiaVieja(texto,listo); }); } else { redactorCopiaVieja(texto,listo); } }
  catch(e){ try{ redactorCopiaVieja(texto,listo) }catch(e2){ btn.textContent='no pude copiar — seleccioná el texto del chat'; try{ regError('share:copiar',e2) }catch(e3){} } }
}
let compartirDiferidas=[]; // mismo orden que las tarjetas de acción: pedido → respuesta → tarjeta
function compartirTarjeta(icono,titulo,detalle,texto){
  if(actuaDifiriendo){ compartirDiferidas.push([icono,titulo,detalle,texto]); return true; }
  const chat=document.getElementById('chat'); if(!chat) return false;
  const hay=mirrorCompartirSoporte(); const txt=String(texto||''); if(!txt.trim()) return false;
  const div=document.createElement('div'); div.className='msg';
  div.innerHTML='<div class="av mav" style="opacity:0;"></div><div class="actua-card">'
    +'<div class="actua-tit">'+actuaEsc(icono||'📤')+' '+actuaEsc(titulo||'Compartir')+'</div>'
    +'<div class="actua-det">'+actuaEsc(detalle||('«'+txt.slice(0,200)+(txt.length>200?'…':'')+'»'))+'</div>'
    +'<a class="actua-btn" href="#" data-share="1">'+(hay?'📤 elegir a dónde va':'📋 copiar el texto')+'</a>'
    +(hay?'':'<div class="actua-os">Este navegador no tiene el selector de compartir (pasa en la mayoría de las compus). Te lo copio y lo pegás donde va.</div>')+'</div>';
  const btn=div.querySelector('[data-share]');
  btn.addEventListener('click',function(ev){ ev.preventDefault();
    if(!hay){ compartirCopiar(btn,txt); return; }
    mirrorCompartir(txt,titulo).then(function(ok){
      if(ok){ btn.textContent='✅ listo — el envío lo diste vos'; }
      else { btn.textContent='📋 copiar el texto'; compartirCopiar(btn,txt); }
    },function(){ compartirCopiar(btn,txt); });
  });
  chat.appendChild(div); chat.scrollTop=chat.scrollHeight; return true;
}
function compartirPintarDiferidas(){ try{ compartirDiferidas.forEach(function(t){ compartirTarjeta.apply(null,t); }); }catch(e){ try{ regError('share:diferidas',e) }catch(_){} } compartirDiferidas=[]; }
// [ACCION:{...}] — el modelo PIDE una acción (solo modo espejo); esta capa valida los campos
// y construye la URL. Números que no estén en la conversación o la agenda local → NO hay tarjeta.
let actuaPend=null; let redactorPend=null; let sharePend=null; // v36-redactor · v38-share (C1)

/* ══ v38-dest (5/08/2026) — EL NÚMERO TIENE QUE PODER RASTREARSE ═══════════════════════
   PORTADO DEL MIRROR PERSONAL EL MISMO DÍA, a propósito: hoy ya pasó tres veces que un
   arreglo quedara en una sola muleta (v38-proc, M1, v29) y siempre se pagó en producción.
   EL HALLAZGO: Darío pidió «mandale un whatsapp» SIN decir a quién y la app armó una
   tarjeta para «Laura», con su agenda local vacía. El destinatario y el número los había
   elegido el modelo; la app solo le miraba el FORMATO al número, nunca el ORIGEN.
   POR QUÉ IMPORTA MÁS ACÁ QUE ALLÁ: en la plataforma esto no le pasa a Darío, le pasa a
   quien la instale. Un mensaje que sale hacia la persona equivocada es el único error de
   esta app que se lleva puesta a un tercero que nunca la usó.
   REGLA: un número solo se usa si viene de la agenda local bajo ESE nombre, o del propio
   pedido del usuario en este turno. Cualquier otra cosa: no hay tarjeta, y se dice por qué. */
let ultimoPedidoUsuario = '';
function soloDigitos(s){ return String(s||'').replace(/[^\d]/g,''); }
function numeroRastreable(para, numDelModelo){
  try {
    const c = actuaContacto(para);
    if (c && actuaNumOk(c.tel)) return { num: c.tel, fuente: 'agenda' };
  } catch(e){}
  try {
    const d = soloDigitos(numDelModelo);
    const pedido = (typeof ultimoPedidoUsuario === 'string') ? ultimoPedidoUsuario : '';
    if (d.length >= 6 && soloDigitos(pedido).indexOf(d.slice(-8)) >= 0) {
      return { num: numDelModelo, fuente: 'dictado' };
    }
  } catch(e){}
  return { num: null, fuente: null };
}
function actuaProcesarReply(reply){
  actuaPend=null; redactorPend=null; sharePend=null; // v36-redactor · v38-share (C1)
  if (mode!=='mirror'||typeof reply!=='string') return reply;
  if (typeof CONFIG!=='undefined' && CONFIG.cap && CONFIG.cap.actua===false) return reply; // toggle OFF → sin tarjetas del modelo
  const m=reply.match(/\[ACCION:(\{[\s\S]{2,6000}?\})\]/); // tope ampliado en Etapa 12 (encuestas) y otra vez en Etapa 13 (v36-redactor): un borrador de mail formal no entra en 1500 — JSON.parse + truncados siguen custodiando
  if (!m) return reply;
  let _shareDescartado = false; // v40-1029
  const limpio=reply.replace(m[0],'').trim();
  try {
    const a=JSON.parse(m[1]);
    /* v38-dest: antes el número del MODELO ganaba y solo se le miraba el formato. Ahora
       manda la agenda del dispositivo y, si no hay, tiene que estar en el pedido del usuario. */
    const _r = numeroRastreable(a.para, a.num);
    const num = _r.num;
    if ((a.tipo==='tel' || a.tipo==='wa') && !num) {
      const quien = a.para ? '«'+String(a.para).slice(0,40)+'»' : 'esa persona';
      const traido = a.num ? ' Tenía un número dando vueltas en la charla, pero no me consta que sea de '+quien+' y no lo voy a usar a ciegas.' : '';
      return (limpio ? limpio+'\n\n' : '') + 'No tengo el número de '+quien+' en la agenda de este dispositivo, así que no armo el mensaje.'+traido+' Guardalo primero —«guardá el número de '+(a.para||'NOMBRE')+' 2995551234»— o dictámelo en el mismo pedido.';
    }
    if (a.tipo==='tel'&&actuaNumOk(num)) actuaPend=['📞','Llamar'+(a.para?' a '+a.para:''),'El discador se abre con el número puesto.',actuaTelURL(num),'📞 llamar'];
    else if (a.tipo==='wa'&&actuaNumOk(num)){ const wurl=actuaWaURL(num,a.msg||''); if(wurl.length>REDACTOR_URL_MAX){ redactorPend=['💬','WhatsApp'+(a.para?' a '+a.para:''),'El mensaje quedó listo.',null,'',String(a.msg||'')]; } else { actuaPend=['💬','WhatsApp'+(a.para?' a '+a.para:''),a.msg?('«'+String(a.msg).slice(0,200)+'»'):'',wurl,'💬 abrir WhatsApp',String(a.msg||'')]; } } // v36-redactor: borrador largo → portapapeles honesto · v38-share (C1): el mensaje también sale por otra app
    else if (a.tipo==='yt'&&a.q) actuaPend=['🎵','Música: '+String(a.q).slice(0,60),'YouTube con la búsqueda lista.',actuaYtURL(String(a.q).slice(0,60)),'▶ abrir en YouTube'];
    else if (a.tipo==='maps'&&a.q) actuaPend=['🗺','Cómo llegar','Destino: '+String(a.q).slice(0,80),actuaMapsURL(String(a.q).slice(0,80)),'🗺 abrir en Maps'];
    else if (a.tipo==='cal'&&a.titulo){
      /* v39-agenda2 (2/09/2026): la tarjeta de agendar SOLO si el usuario la pidió DE VERDAD
         (agendá/recordame/anotá/recordatorio/calendario/«en la agenda»). El modelo la tiraba
         hasta cuando el usuario solo contaba un plan o se despedía («me voy a merendar y a jugar
         a la Play»). Red local: sin verbo de agendar en el último pedido, se descarta la tarjeta
         — la respuesta de texto queda igual. Hallazgo en vivo de Darío. */
      const _ped = (typeof ultimoPedidoUsuario === 'string') ? ultimoPedidoUsuario : '';
      if (/\b(agend[a\u00e1]|record[a\u00e1]|anot[a\u00e1]|recordatorio|calendario|en\s+(?:la\s+)?agenda)\b/i.test(_ped))
      { const _f=_tareaFecha(_ped)||_tareaFecha(String(a.titulo)); const _t=tituloSinFecha(String(a.titulo).slice(0,80), _f); // v40-agendar
        actuaPend=['📅','Agendar: '+_t,_f?('Para el '+_tareaFechaTarjeta(_f)+' — la hora la ponés vos.'):'Fecha y hora las confirmás vos.',actuaCalURL(_t,_f),'📅 abrir calendario']; // v59-caldate
        try{ tareaGuardar(_t, _f); }catch(e){} } // v39-tareas
    }
    // v37-agenda (A2): si el modelo no trae una dirección válida, se busca en la agenda LOCAL.
    // Cierra el hueco del redactor («destinatario a completar»). Nunca inventada.
    else if (a.tipo==='mail'&&(typeof CONFIG==='undefined'||!CONFIG.cap||CONFIG.cap.redactor!==false)&&(a.cuerpo||a.asunto)){ let dir=actuaMailDirOk(a.para)?String(a.para).trim():'';
      /* v41-para (23/08/2026): el prompt ahora manda el NOMBRE en "para" cuando no tiene la
         dirección (antes mandaba "" y acá no quedaba NADA con qué buscar en la agenda: por eso
         el correo se abría con el «Para» vacío teniendo el mail guardado). Dos consecuencias:
         se busca igual que siempre, y si no se encuentra, el título dice A QUIÉN iba — que es
         lo que el usuario necesita para completarlo, mucho más útil que «destinatario a
         completar» a secas. La dirección se sigue sin inventar jamás. */
      const _nom = String(a.para||'').trim();
      if (!dir){ const c=actuaContacto(_nom); if (c && actuaMailDirOk(c.email)) dir=c.email; } const cu=String(a.cuerpo||''); redactorPend=['✉','Mail'+(dir?' a '+dir:(_nom?' a '+_nom.slice(0,40)+' — falta su dirección':' — destinatario a completar')),(a.asunto?'Asunto: '+String(a.asunto).slice(0,120)+'. ':'')+'Leélo, y si está bien, sale con un toque.',actuaMailURL(dir,String(a.asunto||'').slice(0,200),cu),'✉ abrir el correo',(a.asunto?'Asunto: '+String(a.asunto)+'\n\n':'')+cu]; } // v36-redactor (Etapa 13 C2): el modelo redacta, el humano envía
    else if (a.tipo==='encuesta' && a.titulo && Array.isArray(a.preguntas) && a.preguntas.length){ try{ encOferta(a); }catch(e){ try{ regError('encuesta:oferta', e); }catch(_){ } } } // v36-encuesta: el modelo propone, el humano crea
    // v38-share (C1): «mandá esto a quien sea / por donde sea» — sin destinatario fijo.
    // No hay URL ni lista blanca acá: el texto no sale a ningún lado hasta que el usuario
    // elige la app en el selector del sistema. Mismo tope de 6000 que el resto de las marcas.
    /* v40-1029 (en vivo 23/10): a «QUE SABES HACER?» el modelo le colgó una tarjeta «Funciones de MANIFIESTOS · elegir a
       dónde va». Nadie pidió compartir nada. Igual que la de agendar (v39-agenda2): solo si el pedido lo dice. */
    else if (a.tipo==='share' && a.texto && String(a.texto).trim()){ if (/\b(?:compart|m[aá]nd[aá]|p[aá]s[aá]|env[ií][aá]|reenv[ií]|difund|poste[aá]|sub[ií](?:lo|la)|public[aá]|whats|wasap|mail|correo|telegram|linkedin|instagram|facebook|tuit)/i.test(typeof ultimoPedidoUsuario === 'string' ? ultimoPedidoUsuario : '')) sharePend=['📤',String(a.titulo||'Mandarlo a donde quieras').slice(0,80),'',String(a.texto).slice(0,6000)]; else { _shareDescartado = String(a.texto).slice(0,6000); try{ regError('actua2:share_no_pedido', new Error(String(a.titulo||'').slice(0,60))) }catch(e){} } }
    else { try{ regError('actua2:accion_invalida', new Error(m[1].slice(0,80))) }catch(e){} }
  } catch(e){ try{ regError('actua2:json',e) }catch(_){} }
  return limpio||(_shareDescartado?_shareDescartado:'Te dejé la tarjeta abajo — el toque final es tuyo.'); // v40-1029 (verificador): sin tarjeta, el texto igual se ve
}
function actuaPintarTarjeta(){ if(actuaPend){ try{ actuaTarjeta.apply(null,actuaPend) }catch(e){ try{ regError('actua2:pintar',e) }catch(_){} } actuaPend=null; } if(redactorPend){ try{ redactorTarjeta.apply(null,redactorPend) }catch(e){ try{ regError('redactor:pintar',e) }catch(_){} } redactorPend=null; } if(sharePend){ try{ compartirTarjeta.apply(null,sharePend) }catch(e){ try{ regError('share:pintar',e) }catch(_){} } sharePend=null; } } // v36-redactor · v38-share (C1)

// ══════════ FIN v36-actua ══════════

