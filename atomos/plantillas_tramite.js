/* ☁ ÁTOMO DE LA NUBE «plantillas_tramite» v1.1 — GENERADO por armar.js desde nube/atomos/plantillas_tramite/codigo.js. NO SE EDITA A MANO.
   Lo trae el cargador del núcleo (organos/cargador) cuando un pedido lo necesita, y lo suelta al terminar. */
(function(){
var fabrica = function(){
/* ☁ ÁTOMO «plantillas de trámites» (v40-nube, 23/11/2026) — antes vivía adentro de las manos (v38-tramite, C4). Ahora vive en
   la nube: el cargador lo trae cuando el pedido coincide con su pista, lo enchufa en SU lugar de la fila (el «hueco» que dejó en
   las manos, así no le roba nada a ninguna regla de antes) y lo suelta al terminar el turno. Mismo código, misma regla. */
const regla = { /* v38-tramite (C4) — PLANTILLAS DE TRÁMITES. Sin modelo, sin red, sin tokens: el
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
  };
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
return { regla: regla };
};
if (typeof window !== 'undefined' && typeof window.__atomoNubeLlega === 'function') window.__atomoNubeLlega("plantillas_tramite", "1.1", fabrica);
else if (typeof module !== 'undefined' && module.exports) module.exports = fabrica;
})();
