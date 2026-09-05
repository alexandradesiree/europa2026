/* EUROPA 2026 — lógica de la aplicación
   No edites este archivo para cambiar el viaje. Edita data.js. */
(function () {
"use strict";

var T = window.TRIP;

/* Red de seguridad: si data.js tiene un error de sintaxis, el navegador no
   define window.TRIP y la app saldría en blanco. En vez de eso, explicamos qué pasó. */
if (!T || !T.days) {
  document.addEventListener("DOMContentLoaded", function () {
    document.body.innerHTML =
      '<div style="padding:24px;font-family:-apple-system,sans-serif;line-height:1.5">' +
      '<h1 style="font-size:24px;margin:0 0 12px">El archivo data.js tiene un error</h1>' +
      '<p>La app no pudo leer el itinerario. Casi siempre es una de estas tres cosas, ' +
      'en la última línea que editaste:</p>' +
      '<ol style="padding-left:20px"><li>Falta una <b>coma</b> al final de la línea anterior.</li>' +
      '<li>Falta una <b>comilla</b> de cierre en un texto.</li>' +
      '<li>Falta una <b>llave</b> <code>}</code> o un <b>corchete</b> <code>]</code>.</li></ol>' +
      '<p>Abre data.js en GitHub, deshaz tu último cambio y la app vuelve sola. ' +
      'Nada del viaje se pierde: el itinerario está en el historial de GitHub.</p>' +
      '<p style="color:#4A5058;font-size:15px">Tu progreso (paradas terminadas y omitidas) sigue guardado en el teléfono.</p>' +
      '</div>';
  });
  return;
}
var $ = function (s, r) { return (r || document).querySelector(s); };
var el = function (t, c, h) { var n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };

/* ------------------------------------------------------------- estado */
var KEY = "europa2026.state.v1";
var S = { done: {}, skip: {}, day: null, tab: "hoy", simulate: null };
try { var raw = localStorage.getItem(KEY); if (raw) S = Object.assign(S, JSON.parse(raw)); } catch (e) {}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

/* ------------------------------------------------------------- tiempo */
function pad(n) { return (n < 10 ? "0" : "") + n; }
function toMin(hhmm) { if (!hhmm) return null; var p = hhmm.split(":"); return +p[0] * 60 + +p[1]; }
function toHHMM(m) { m = ((m % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ":" + pad(m % 60); }
function todayISO() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function nowMin() {
  if (S.simulate != null) return S.simulate;
  var d = new Date(); return d.getHours() * 60 + d.getMinutes();
}
function durTxt(m) {
  if (m == null) return "—";
  if (m < 60) return m + " min";
  var h = Math.floor(m / 60), r = m % 60;
  return h + " h" + (r ? " " + pad(r) : "");
}
function dateLong(iso) {
  var p = iso.split("-"), M = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  return +p[2] + " de " + M[+p[1] - 1];
}

/* ------------------------------------------------------------- datos */
function city(id) { for (var i = 0; i < T.cities.length; i++) if (T.cities[i].id === id) return T.cities[i]; return null; }
function res(id) { for (var i = 0; i < T.reservations.length; i++) if (T.reservations[i].id === id) return T.reservations[i]; return null; }
function flight(id) { for (var i = 0; i < T.flights.length; i++) if (T.flights[i].id === id) return T.flights[i]; return null; }
function dayById(id) { for (var i = 0; i < T.days.length; i++) if (T.days[i].id === id) return T.days[i]; return null; }
function stopById(id) {
  for (var i = 0; i < T.days.length; i++) for (var j = 0; j < T.days[i].stops.length; j++)
    if (T.days[i].stops[j].id === id) return { stop: T.days[i].stops[j], day: T.days[i] };
  return null;
}
function activeDay() {
  if (S.day) { var d = dayById(S.day); if (d) return d; }
  var t = todayISO();
  for (var i = 0; i < T.days.length; i++) if (T.days[i].date === t) return T.days[i];
  for (var k = 0; k < T.days.length; k++) if (T.days[k].date > t) return T.days[k];
  return T.days[0];
}
function visible(d) {
  return d.stops.filter(function (s) { return !S.skip[s.id]; });
}

/* --------------------------------------------------- tramos (LEG) */
function haversine(a, b) {
  if (a.lat == null || b.lat == null) return null;
  var R = 6371, r = Math.PI / 180;
  var dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
function mapsG(a, b) {
  var o = a && a.lat != null ? a.lat + "," + a.lng : (a && a.addr ? a.addr : "");
  var d = b.lat != null ? b.lat + "," + b.lng : (b.addr || b.name);
  return "https://www.google.com/maps/dir/?api=1&origin=" + encodeURIComponent(o) +
    "&destination=" + encodeURIComponent(d) + "&travelmode=walking";
}
function mapsA(a, b) {
  var o = a && a.lat != null ? a.lat + "," + a.lng : "";
  var d = b.lat != null ? b.lat + "," + b.lng : (b.addr || b.name);
  return "https://maps.apple.com/?saddr=" + encodeURIComponent(o) + "&daddr=" + encodeURIComponent(d) + "&dirflg=w";
}
/* Devuelve SIEMPRE un tramo: nunca hay hueco entre dos paradas. */
function getLeg(a, b) {
  var ov = T.legs[a.id + ">" + b.id];
  if (ov) {
    return { mode: ov.mode, dur: ov.dur, dist: ov.dist, steps: ov.steps || [],
             line: ov.line, dir: ov.dir, note: ov.note, verified: true, from: a, to: b };
  }
  var km = haversine(a, b);
  if (km != null && km < 0.06) {
    return { mode: "en el sitio", dur: 0, dist: null, verified: true, from: a, to: b,
             steps: ["Misma ubicación: no hay traslado."] };
  }
  if (km == null) {
    return { mode: "por definir", dur: null, dist: null, verified: false, from: a, to: b,
             steps: ["Ruta no verificada: falta la dirección o las coordenadas de una de las dos paradas."],
             pending: "TRAMO SIN VERIFICAR. Faltan coordenadas." };
  }
  if (km > 3.2) {
    return { mode: "transporte", dur: Math.round(km / 20 * 60) + 10, dist: km.toFixed(1) + " km", verified: false, from: a, to: b,
             steps: ["Distancia larga para ir a pie.", "Abrir Google Maps o Apple Maps y elegir transporte público."],
             pending: "TRAMO SIN VERIFICAR: línea, sentido y estación de bajada pendientes de confirmar. Usa Maps mientras tanto." };
  }
  return { mode: "a pie", dur: Math.max(3, Math.round(km / 4.4 * 60) + 2), dist: (km < 1 ? Math.round(km * 1000) + " m" : km.toFixed(1) + " km"),
           verified: false, from: a, to: b,
           steps: ["Caminata estimada a partir de las coordenadas de las dos paradas.", "Abrir Maps para el recorrido exacto calle por calle."],
           pending: "Caminata estimada, no verificada calle por calle." };
}

/* --------------------------------------------------- motor de estado */
function dayModel(d) {
  var stops = visible(d), out = [], i;
  for (i = 0; i < stops.length; i++) {
    out.push({ kind: "stop", s: stops[i] });
    if (stops[i + 1]) out.push({ kind: "leg", leg: getLeg(stops[i], stops[i + 1]) });
  }
  return out;
}
function currentIndex(d) {
  var stops = visible(d), n = nowMin(), i, last = -1;
  for (i = 0; i < stops.length; i++) {
    if (S.done[stops[i].id]) { last = i; continue; }
    var t = toMin(stops[i].t);
    if (t == null) return i;
    var e = toMin(stops[i].end) || (t + 45);
    if (n < t) return Math.max(i, 0);
    if (n >= t && n < e) return i;
  }
  return Math.min(last + 1, stops.length - 1);
}
function nowStop(d) { var s = visible(d); var i = currentIndex(d); return s[i] || null; }
function nextStop(d) { var s = visible(d); var i = currentIndex(d); return s[i + 1] || null; }

function delayMin(d) {
  if (d.date !== todayISO() && S.simulate == null) return 0;
  var cur = nowStop(d); if (!cur || !cur.t) return 0;
  var e = toMin(cur.end) || toMin(cur.t);
  var extra = S.simulate != null ? 0 : 0;
  var dl = nowMin() - (toMin(cur.t) + extra);
  return dl > 0 && !S.done[cur.id] ? dl : 0;
}
/* hora a la que hay que salir de la parada actual */
function departFrom(d) {
  var cur = nowStop(d), nx = nextStop(d);
  if (!cur || !nx) return null;
  var leg = getLeg(cur, nx);
  var arrive = toMin(nx.t);
  if (arrive == null || leg.dur == null) return null;
  return arrive - leg.dur;
}
function nextAnchor(d) {
  var s = visible(d), i0 = currentIndex(d);
  for (var i = i0; i < s.length; i++) if (s[i].prio === "P1" && s[i].t && !S.done[s[i].id]) return s[i];
  return null;
}

/* ============================================================ RENDER */
function renderTop() {
  var d = activeDay(), c = city(d.city);
  document.documentElement.style.setProperty("--accent", c ? c.accent : "#12233D");
  $("#topCity").textContent = c ? c.name.toUpperCase() : "EUROPA 2026";
  $("#topMeta").textContent = d.weekday + " " + dateLong(d.date);
  $("#topClock").textContent = toHHMM(nowMin()) + (S.simulate != null ? " ·sim" : "");
}

function chipsFor(s) {
  var h = "";
  if (s.prio === "P1") h += '<span class="chip fix">🔒 FIJA</span>';
  if (s.res) { var r = res(s.res); if (r) h += '<span class="chip ' + (r.status === "pagado" ? "ok" : r.status === "confirmado" ? "ok" : "pend") + '">' + (r.status === "pagado" ? "💳 PAGADO" : r.status === "confirmado" ? "✅ CONFIRMADO" : "⬜ PENDIENTE") + "</span>"; }
  if (s.pend && s.pend.length) h += '<span class="chip pend">⚠️ DATO PENDIENTE</span>';
  if (s.photo) h += '<span class="chip">📷 FOTO</span>';
  if (s.flex) h += '<span class="chip">FLEXIBLE</span>';
  return h;
}

function renderHoy() {
  var d = activeDay(), c = city(d.city), root = $("#hoy");
  root.innerHTML = "";
  var cur = nowStop(d), nx = nextStop(d), dl = delayMin(d);

  /* banner de retraso */
  if (dl >= 15) {
    var b = el("div", "banner " + (dl >= 30 ? "bad" : "warn"));
    b.innerHTML = "<span>⚠️ Vas " + dl + " min tarde</span>";
    var bb = el("button", "", "VER AJUSTE"); bb.onclick = function () { lateSheet(); }; b.appendChild(bb);
    root.appendChild(b);
  }
  var dep = departFrom(d);
  if (dep != null && nowMin() >= dep && !S.done[cur.id]) {
    var b2 = el("div", "banner bad", "<span>SAL AHORA — hora límite " + toHHMM(dep) + "</span>");
    root.appendChild(b2);
  }

  /* cabecera del día */
  var head = el("div");
  head.innerHTML = '<div class="label" style="margin-top:16px">' + (d.type === "transfer" ? "DÍA DE TRASLADO" : d.type === "hybrid" ? "DÍA HÍBRIDO" : d.type === "disney" ? "MODO DISNEY" : d.type === "versailles" ? "VERSALLES" : "HOY") + "</div>" +
    '<div style="font-family:var(--serif);font-size:26px;line-height:1.15;margin:2px 0 6px">' + d.concept + "</div>" +
    '<div class="muted tabular">' + (d.depart ? "Salida " + d.depart + " · " : "") + (d.ret ? "Regreso " + d.ret + " · " : "") + visible(d).length + " paradas · " + visible(d).filter(function (s) { return s.res; }).length + " reservas</div>";
  if (d.note) head.appendChild(el("div", "muted", "<em>" + d.note + "</em>"));
  root.appendChild(head);

  /* vuelo del día */
  if (d.flight) {
    var f = flight(d.flight);
    var fc = el("div", "card");
    fc.innerHTML = '<div class="label">VUELO</div><div class="now-name">' + (f.number || "Vuelo por confirmar") + "</div>" +
      '<div class="muted">' + f.from + " → " + f.to + "</div>" +
      '<div class="grid2"><div><div class="k">Salida</div><div class="v">' + (f.dep || "—") + '</div></div>' +
      '<div><div class="k">Llegada</div><div class="v">' + (f.arr || "—") + '</div></div>' +
      '<div><div class="k">Terminal</div><div class="v">' + (f.terminalOut || "—") + '</div></div>' +
      '<div><div class="k">Puerta</div><div class="v" style="font-size:14px">VERIFICAR EL DÍA</div></div></div>';
    if (f.pend) f.pend.forEach(function (p) { fc.appendChild(el("div", "pending", "<b>DATO PENDIENTE</b>" + p)); });
    root.appendChild(fc);
  }

  /* AHORA */
  if (cur) {
    var card = el("div", "card now");
    var rest = cur.end && toMin(cur.end) > nowMin() ? durTxt(toMin(cur.end) - nowMin()) : null;
    card.innerHTML = '<div class="label">AHORA</div><div class="now-name">' + cur.name + "</div>" +
      '<div class="muted tabular">' + (cur.t || "") + (cur.end ? " – " + cur.end : "") + "</div>" +
      '<div style="margin-top:8px">' + chipsFor(cur) + "</div>" +
      (rest ? '<div class="grid2"><div><div class="k">Queda aquí</div><div class="v">' + rest + "</div></div>" +
        (dep != null ? '<div><div class="k">Salir de aquí</div><div class="v">' + toHHMM(dep) + "</div></div>" : "") + "</div>" : "");
    var bDet = el("button", "btn ghost sm", "VER FICHA DEL LUGAR"); bDet.onclick = function () { placeSheet(cur.id); };
    card.appendChild(bDet);
    var brow = el("div", "btn-row");
    var bDone = el("button", "btn", "✓ TERMINAR"); bDone.onclick = function () { S.done[cur.id] = 1; save(); render(); if (nx) legSheet(cur.id, nx.id); };
    var bSkip = el("button", "btn ghost", "OMITIR"); bSkip.onclick = function () { skipConfirm(cur); };
    brow.appendChild(bDone); brow.appendChild(bSkip);
    card.appendChild(brow);
    root.appendChild(card);
  }

  /* SIGUIENTE */
  if (nx) {
    var leg = getLeg(cur, nx), r = nx.res ? res(nx.res) : null;
    var margin = (toMin(nx.t) != null && leg.dur != null) ? toMin(nx.t) - nowMin() - leg.dur : null;
    var nc = el("div", "card next");
    nc.innerHTML = '<div class="label">SIGUIENTE</div><div class="next-name">' + nx.name + "</div>" +
      '<div style="margin-top:6px">' + chipsFor(nx) + "</div>" +
      '<div class="grid2">' +
      '<div><div class="k">Salir a las</div><div class="v">' + (dep != null ? toHHMM(dep) : "—") + "</div></div>" +
      '<div><div class="k">Llegada prevista</div><div class="v">' + (nx.t || "—") + "</div></div>" +
      '<div><div class="k">Traslado</div><div class="v">' + (leg.mode === "a pie" ? "🚶 " : leg.mode === "taxi" ? "🚕 " : leg.mode === "rer" || leg.mode === "tren" ? "🚆 " : "") + durTxt(leg.dur) + (leg.dist ? " · " + leg.dist : "") + "</div></div>" +
      '<div><div class="k">Margen</div><div class="v" style="color:' + (margin != null && margin < 0 ? "var(--alert)" : margin != null && margin < 10 ? "var(--warn)" : "var(--ok)") + '">' + (margin != null ? (margin < 0 ? "−" : "") + durTxt(Math.abs(margin)) : "—") + "</div></div>" +
      "</div>" + (r ? '<div class="muted" style="margin-top:8px">Reserva ' + (r.time || "") + " · " + r.name + "</div>" : "");
    var go = el("button", "btn", "IR AHORA"); go.onclick = function () { legSheet(cur.id, nx.id); };
    nc.appendChild(go);
    root.appendChild(nc);
  } else if (cur) {
    root.appendChild(el("div", "card", '<div class="label">FIN DEL DÍA</div><div class="muted">No quedan paradas por delante en esta jornada.</div>'));
  }

  /* acciones */
  var act = el("div", "btn-row");
  var l1 = el("button", "btn ghost sm", "VAMOS TARDE"); l1.onclick = lateSheet;
  var l2 = el("button", "btn ghost sm", "ESTAMOS CANSADOS"); l2.onclick = tiredSheet;
  act.appendChild(l1); act.appendChild(l2); root.appendChild(act);
  var l3 = el("button", "btn ghost sm", "VOLVER AL HOTEL"); l3.onclick = hotelSheet; root.appendChild(l3);

  /* timeline */
  root.appendChild(el("div", "section-title", "Jornada completa"));
  var ul = el("ul", "tl"), model = dayModel(d), curId = cur ? cur.id : null;
  model.forEach(function (m) {
    var li;
    if (m.kind === "leg") {
      li = el("li", "leg");
      li.innerHTML = '<span class="st">↓</span><span class="tm"></span><span class="nm">' +
        (m.leg.mode === "a pie" ? "🚶" : m.leg.mode === "taxi" ? "🚕" : "🚆") + " " + durTxt(m.leg.dur) + (m.leg.dist ? " · " + m.leg.dist : "") +
        (m.leg.verified ? "" : " · sin verificar") + "</span>";
      li.onclick = (function (a, b) { return function () { legSheet(a, b); }; })(m.leg.from.id, m.leg.to.id);
    } else {
      var s = m.s, cls = "", ic = "○";
      if (S.done[s.id]) { cls = "done"; ic = "✓"; }
      else if (s.id === curId) { cls = "now"; ic = "●"; }
      else if (nx && s.id === nx.id) { ic = "→"; }
      li = el("li", cls);
      li.innerHTML = '<span class="st">' + ic + '</span><span class="tm">' + (s.t || "—") + '</span><span class="nm">' + s.name +
        (s.pend && s.pend.length ? "<small>⚠️ dato pendiente</small>" : s.res ? "<small>reserva</small>" : "") + "</span>";
      li.onclick = (function (id) { return function () { placeSheet(id); }; })(s.id);
    }
    ul.appendChild(li);
  });
  root.appendChild(ul);

  /* esfuerzo */
  var km = 0, model2 = dayModel(d);
  model2.forEach(function (m) { if (m.kind === "leg" && m.leg.mode === "a pie" && m.leg.dist) { var v = parseFloat(m.leg.dist); km += m.leg.dist.indexOf("m") > -1 && m.leg.dist.indexOf("km") === -1 ? v / 1000 : v; } });
  root.appendChild(el("div", "card", '<div class="label">ESFUERZO ESTIMADO DEL DÍA</div>' +
    '<div class="grid2"><div><div class="k">🚶 Caminata</div><div class="v">' + km.toFixed(1) + ' km</div></div>' +
    '<div><div class="k">👣 Pasos</div><div class="v">' + Math.round(km * 1350).toLocaleString("es-MX") + '</div></div>' +
    '<div><div class="k">🔥 Intensidad</div><div class="v">' + (km > 9 ? "Alta" : km > 5 ? "Media" : "Ligera") + '</div></div></div>' +
    '<div class="muted" style="margin-top:8px">Solo cuenta los tramos a pie entre paradas. No incluye lo que se camina dentro de museos y parques.</div>'));

  root.appendChild(el("div", "sync", "Itinerario versión " + T.version + " · actualizado " + T.updated));
}

/* ------------------------------------------------------------ hojas */
function openSheet(title, build) {
  var sh = $("#sheet"); sh.innerHTML = "";
  var head = el("div", "sheet-head");
  head.innerHTML = '<div class="label">' + title + "</div>";
  var x = el("button", "x", "CERRAR"); x.onclick = closeSheet; head.appendChild(x);
  sh.appendChild(head);
  build(sh);
  sh.classList.add("on"); sh.scrollTop = 0;
}
function closeSheet() { $("#sheet").classList.remove("on"); }

function pendBlock(arr) {
  var w = el("div");
  (arr || []).forEach(function (p) {
    var isConf = /CONFLICTO/.test(p);
    w.appendChild(el("div", isConf ? "conflict" : "pending", (isConf ? "<b>⚠️ CONFLICTO</b>" : "<b>DATO PENDIENTE</b>") + p));
  });
  return w;
}

function placeSheet(id) {
  var f = stopById(id); if (!f) return;
  var s = f.stop, d = f.day, c = city(d.city);
  openSheet(c.name + " · " + (s.t || ""), function (sh) {
    sh.appendChild(el("h2", "", s.name));
    sh.appendChild(el("div", "", chipsFor(s)));
    if (s.addr) sh.appendChild(el("p", "muted", "📍 " + s.addr));
    sh.appendChild(pendBlock(s.pend));
    if (s.what) { sh.appendChild(el("h3", "", "Qué es")); sh.appendChild(el("p", "", s.what)); }
    if (s.why) { sh.appendChild(el("h3", "", "Por qué vale la pena")); sh.appendChild(el("p", "", s.why)); }
    if (s.see) { sh.appendChild(el("h3", "", "Qué mirar")); sh.appendChild(el("p", "", s.see)); }
    if (s.do) { sh.appendChild(el("h3", "", "Qué hacemos aquí")); sh.appendChild(el("p", "", s.do)); }
    if (s.order) { sh.appendChild(el("h3", "", "Qué pedir")); sh.appendChild(el("p", "", s.order)); }
    if (s.fact) { sh.appendChild(el("h3", "", "Dato curioso")); sh.appendChild(el("p", "", s.fact)); }
    if (s.note) { sh.appendChild(el("h3", "", "Nota")); sh.appendChild(el("p", "", s.note)); }
    if (s.t) { sh.appendChild(el("h3", "", "Horario")); sh.appendChild(el("p", "tabular", "Llegada " + s.t + (s.end ? " · salida " + s.end + " · duración " + durTxt(toMin(s.end) - toMin(s.t)) : ""))); }
    if (s.res) {
      var r = res(s.res);
      if (r) {
        sh.appendChild(el("h3", "", "Reserva"));
        sh.appendChild(el("p", "", r.name + "<br>" + (r.time ? "Hora " + r.time + " · " : "") + r.people + " personas · estado " + r.status.toUpperCase() +
          (r.provider ? "<br>Proveedor: " + r.provider : "") + (r.code ? "<br>Localizador: " + r.code : "") +
          (r.meeting ? "<br>Punto de encuentro: " + r.meeting : "") + (r.note ? "<br>" + r.note : "")));
        sh.appendChild(pendBlock(r.pend));
      }
    }
    if (s.photo) {
      sh.appendChild(el("h3", "", "📷 Punto fotográfico"));
      var p = s.photo;
      sh.appendChild(el("p", "", (p.where ? "<b>Dónde ponerte:</b> " + p.where + "<br>" : "") +
        (p.back ? "<b>Qué debe quedar detrás:</b> " + p.back + "<br>" : "") +
        (p.frame ? "<b>Encuadre:</b> " + p.frame + "<br>" : "") +
        (p.light ? "<b>Luz:</b> " + p.light + "<br>" : "") + (p.tip ? "<b>Consejo:</b> " + p.tip : "")));
    }
    if (s.planB) { sh.appendChild(el("h3", "", "☔ Plan B")); sh.appendChild(el("p", "", "<b>" + s.planB.name + "</b><br>" + (s.planB.why || ""))); }
    if (s.lat != null || s.addr) {
      var g = el("button", "btn", "ABRIR EN GOOGLE MAPS");
      g.onclick = function () { window.open("https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(s.lat != null ? s.lat + "," + s.lng : s.addr), "_blank"); };
      sh.appendChild(g);
      var a = el("button", "btn ghost", "ABRIR EN APPLE MAPS");
      a.onclick = function () { window.open("https://maps.apple.com/?q=" + encodeURIComponent(s.lat != null ? s.lat + "," + s.lng : s.addr), "_blank"); };
      sh.appendChild(a);
    }
  });
}

function legSheet(aId, bId) {
  var A = stopById(aId), B = stopById(bId); if (!A || !B) return;
  var a = A.stop, b = B.stop, leg = getLeg(a, b), d = A.day;
  var arrive = toMin(b.t), dep = (arrive != null && leg.dur != null) ? arrive - leg.dur : null;
  var margin = (arrive != null && leg.dur != null) ? arrive - nowMin() - leg.dur : null;
  openSheet("TRASLADO", function (sh) {
    sh.appendChild(el("h2", "", a.name + " → " + b.name));
    sh.appendChild(el("div", "grid2",
      '<div><div class="k">Salir a las</div><div class="v">' + (dep != null ? toHHMM(dep) : "—") + "</div></div>" +
      '<div><div class="k">Llegada</div><div class="v">' + (b.t || "—") + "</div></div>" +
      '<div><div class="k">Duración</div><div class="v">' + durTxt(leg.dur) + "</div></div>" +
      '<div><div class="k">Margen ahora</div><div class="v" style="color:' + (margin != null && margin < 0 ? "var(--alert)" : margin != null && margin < 10 ? "var(--warn)" : "var(--ok)") + '">' + (margin != null ? durTxt(margin) : "—") + "</div></div>"));
    sh.appendChild(el("h3", "", "Modo recomendado"));
    sh.appendChild(el("p", "", (leg.mode === "a pie" ? "🚶 A PIE" : leg.mode === "taxi" ? "🚕 TAXI" : leg.mode === "rer" ? "🚆 " + (leg.line || "RER") : leg.mode.toUpperCase()) +
      (leg.dist ? " · " + leg.dist : "") + (leg.line ? "<br>Línea " + leg.line : "") + (leg.dir ? "<br>Dirección: <b>" + leg.dir + "</b>" : "")));
    if (leg.pending) sh.appendChild(el("div", "pending", "<b>DATO PENDIENTE</b>" + leg.pending));
    sh.appendChild(el("h3", "", "Instrucciones"));
    var ol = el("ol", "steps");
    (leg.steps || []).forEach(function (t) { ol.appendChild(el("li", "", t)); });
    sh.appendChild(ol);
    if (leg.note) sh.appendChild(el("p", "muted", leg.note));
    var g = el("button", "btn", "ABRIR EN GOOGLE MAPS"); g.onclick = function () { window.open(mapsG(a, b), "_blank"); };
    var ap = el("button", "btn ghost", "ABRIR EN APPLE MAPS"); ap.onclick = function () { window.open(mapsA(a, b), "_blank"); };
    sh.appendChild(g); sh.appendChild(ap);
    sh.appendChild(el("h3", "", "Si vamos tarde"));
    sh.appendChild(el("p", "", leg.mode === "a pie" && leg.dur <= 15
      ? "En un trayecto tan corto el taxi no mejora nada de forma significativa: mantener el recorrido a pie."
      : "Si el margen está en rojo, abre Maps y compara con taxi antes de salir."));
    var goB = el("button", "btn ghost sm", "VER FICHA DEL DESTINO"); goB.onclick = function () { placeSheet(b.id); };
    sh.appendChild(goB);
  });
}

function skipConfirm(s) {
  var d = activeDay(), stops = visible(d), i = stops.indexOf(s), nx = stops[i + 1];
  openSheet("OMITIR PARADA", function (sh) {
    sh.appendChild(el("h2", "", "¿Omitir " + s.name + "?"));
    sh.appendChild(el("p", "", nx ? "Si omites esta parada, la siguiente será <b>" + nx.name + "</b>" + (nx.t ? " a las " + nx.t : "") + "." : "Es la última parada del día."));
    if (s.prio === "P1") sh.appendChild(el("div", "conflict", "<b>⚠️ CONFLICTO</b>Esta parada está marcada como FIJA (P1). Puede tener reserva pagada, un tour o un vuelo asociado."));
    var y = el("button", "btn", "SÍ, OMITIR"); y.onclick = function () { S.skip[s.id] = 1; save(); closeSheet(); render(); };
    var n = el("button", "btn ghost", "CANCELAR"); n.onclick = closeSheet;
    sh.appendChild(y); sh.appendChild(n);
  });
}

function lateSheet() {
  var d = activeDay(), dl = delayMin(d), anchor = nextAnchor(d), stops = visible(d), i0 = currentIndex(d);
  var okDrop = function (s) { return s.cat !== "hotel" && s.cat !== "flight" && s.cat !== "transport" && s.prio !== "P1"; };
  var flex = stops.slice(i0 + 1).filter(function (s) { return (s.prio === "P4" || s.flex) && okDrop(s); });
  var mid = stops.slice(i0 + 1).filter(function (s) { return s.prio === "P3" && !s.flex && okDrop(s); });
  var fixed = stops.slice(i0 + 1).filter(function (s) { return s.prio === "P1"; });
  openSheet("VAMOS TARDE", function (sh) {
    sh.appendChild(el("h2", "", dl > 0 ? "Vas " + dl + " min tarde" : "Ajuste por retraso"));
    if (anchor) sh.appendChild(el("p", "", "Próxima cita fija: <b>" + anchor.name + "</b> a las " + anchor.t + ". Es lo que hay que salvar."));
    sh.appendChild(el("h3", "", "+15 minutos · qué ajustar"));
    sh.appendChild(el("p", "", flex.length ? "Recorta la duración de <b>" + flex[0].name + "</b> y cambia el siguiente tramo a pie por taxi o metro si el margen se pone en rojo." : "Sin actividades flexibles por delante: recorta duración dentro de las paradas actuales."));
    sh.appendChild(el("h3", "", "+30 minutos · qué eliminar"));
    if (flex.length) { var u1 = el("ul", "list"); flex.slice(0, 3).forEach(function (s) { var li = el("li", "", '<div class="t">' + s.name + '</div><div class="s">' + (s.t || "") + " · prioridad " + s.prio + "</div>"); var b = el("button", "btn ghost sm", "Omitir esta parada"); b.onclick = (function (x) { return function () { S.skip[x.id] = 1; save(); closeSheet(); render(); }; })(s); li.appendChild(b); u1.appendChild(li); }); sh.appendChild(u1); }
    else sh.appendChild(el("p", "", "No quedan paradas prescindibles. Habría que recortar de las importantes."));
    sh.appendChild(el("h3", "", "+60 minutos · qué conservar obligatoriamente"));
    if (fixed.length) { var u2 = el("ul", "list"); fixed.forEach(function (s) { u2.appendChild(el("li", "", '<div class="t">🔒 ' + s.name + '</div><div class="s">' + (s.t || "") + "</div>")); }); sh.appendChild(u2); }
    else sh.appendChild(el("p", "", "No quedan reservas fijas hoy: el día se puede reorganizar libremente."));
    if (mid.length) sh.appendChild(el("p", "muted", "Después de lo flexible, lo siguiente en caer sería: " + mid.map(function (s) { return s.name; }).join(", ") + "."));
    sh.appendChild(el("p", "muted", "Las reservas nunca se modifican automáticamente. Si hay que mover una, se llama al proveedor."));
  });
}

function tiredSheet() {
  var d = activeDay(), stops = visible(d), i0 = currentIndex(d);
  var cand = stops.slice(i0 + 1).filter(function (s) {
    return (s.prio === "P4" || s.prio === "P3") && !s.res &&
           s.cat !== "hotel" && s.cat !== "flight" && s.cat !== "transport";
  });
  var km = 0;
  cand.forEach(function (s, i) { var prev = stops[stops.indexOf(s) - 1]; if (prev) { var l = getLeg(prev, s); if (l.mode === "a pie" && l.dist) km += parseFloat(l.dist) * (l.dist.indexOf("km") > -1 ? 1 : 0.001); } });
  openSheet("PLAN LIGERO", function (sh) {
    sh.appendChild(el("h2", "", "Plan ligero"));
    sh.appendChild(el("p", "", "Se conservan todas las reservas. Solo se recortan paradas secundarias."));
    if (!cand.length) { sh.appendChild(el("p", "", "No queda nada secundario por delante. Lo que viene es todo importante o está reservado.")); }
    else {
      sh.appendChild(el("p", "", "Podemos eliminar " + cand.length + " parada" + (cand.length > 1 ? "s" : "") + ". Ahorro aproximado: <b>" + km.toFixed(1) + " km</b> y unos <b>" + Math.round(km * 13) + " min</b> caminando."));
      var u = el("ul", "list");
      cand.forEach(function (s) {
        var li = el("li", "", '<div class="t">' + s.name + '</div><div class="s">' + (s.t || "") + " · " + s.prio + "</div>");
        var b = el("button", "btn ghost sm", "Quitar del día"); b.onclick = (function (x) { return function () { S.skip[x.id] = 1; save(); closeSheet(); render(); }; })(s);
        li.appendChild(b); u.appendChild(li);
      });
      sh.appendChild(u);
      var all = el("button", "btn", "APLICAR PLAN LIGERO COMPLETO");
      all.onclick = function () { cand.forEach(function (s) { S.skip[s.id] = 1; }); save(); closeSheet(); render(); };
      sh.appendChild(all);
    }
    var hb = el("button", "btn ghost", "VOLVER AL HOTEL AHORA"); hb.onclick = function () { closeSheet(); hotelSheet(); };
    sh.appendChild(hb);
  });
}

function hotelSheet() {
  var d = activeDay(), c = city(d.city), h = c.hotel, cur = nowStop(d);
  openSheet("NECESITO VOLVER", function (sh) {
    sh.appendChild(el("h2", "", h.name));
    sh.appendChild(el("p", "muted", "📍 " + h.addr));
    sh.appendChild(pendBlock(h.pend));
    var g = el("button", "btn", "RUTA AL HOTEL · GOOGLE MAPS");
    g.onclick = function () { window.open("https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(h.lat != null ? h.lat + "," + h.lng : h.addr), "_blank"); };
    sh.appendChild(g);
    var a = el("button", "btn ghost", "RUTA AL HOTEL · APPLE MAPS");
    a.onclick = function () { window.open("https://maps.apple.com/?daddr=" + encodeURIComponent(h.lat != null ? h.lat + "," + h.lng : h.addr), "_blank"); };
    sh.appendChild(a);
    var an = nextAnchor(d);
    if (an) {
      sh.appendChild(el("h3", "", "Próxima reserva"));
      sh.appendChild(el("p", "", an.name + (an.t ? " · " + an.t : "")));
      var b = el("button", "btn ghost sm", "IR A LA PRÓXIMA RESERVA");
      b.onclick = function () { closeSheet(); placeSheet(an.id); };
      sh.appendChild(b);
    }
    sh.appendChild(el("h3", "", "Aeropuerto"));
    sh.appendChild(el("p", "muted", c.info.aeropuerto));
  });
}

/* --------------------------------------------------------- pantallas */
function renderViaje() {
  var root = $("#viaje"); root.innerHTML = "";
  root.appendChild(el("div", "section-title", "EUROPA 2026"));
  T.cities.forEach(function (c) {
    var box = el("div");
    box.innerHTML = '<div class="label" style="margin-top:18px;color:' + c.accent + '">' + c.name.toUpperCase() + "</div>" +
      '<div class="muted tabular">' + dateLong(c.from) + " – " + dateLong(c.to) + " · " + c.hotel.name + "</div>";
    root.appendChild(box);
    T.days.filter(function (d) { return d.city === c.id; }).forEach(function (d) {
      var b = el("button", "row-link");
      var nres = d.stops.filter(function (s) { return s.res; }).length;
      var npend = d.stops.reduce(function (a, s) { return a + (s.pend ? s.pend.length : 0); }, 0);
      b.innerHTML = '<span><span class="t" style="font-family:var(--serif);font-size:19px">' + d.weekday + " " + (+d.date.split("-")[2]) + '</span><br><span class="s">' + d.concept + " · " + nres + " reservas" + (npend ? " · ⚠️ " + npend + " pendientes" : "") + "</span></span><span class='arrow'>›</span>";
      b.onclick = (function (id) { return function () { S.day = id; save(); go("hoy"); }; })(d.id);
      root.appendChild(b);
    });
  });
  var r = el("button", "btn ghost sm", "VOLVER AL DÍA DE HOY");
  r.onclick = function () { S.day = null; save(); go("hoy"); };
  root.appendChild(r);
}

function renderMapa() {
  var d = activeDay(), root = $("#mapa"); root.innerHTML = "";
  root.appendChild(el("div", "section-title", "Mapa del día"));
  root.appendChild(el("div", "muted", d.weekday + " " + dateLong(d.date) + " · " + city(d.city).name));
  var pts = visible(d).filter(function (s) { return s.lat != null; });
  if (pts.length > 1) {
    var url = "https://www.google.com/maps/dir/" + pts.map(function (s) { return s.lat + "," + s.lng; }).join("/");
    var b = el("button", "btn", "VER RUTA COMPLETA DEL DÍA");
    b.onclick = function () { window.open(url, "_blank"); };
    root.appendChild(b);
  }
  var ul = el("ul", "list");
  visible(d).forEach(function (s, i) {
    var li = el("li", "", '<div class="t">' + (i + 1) + ". " + s.name + '</div><div class="s">' + (s.t || "") + (s.addr ? " · " + s.addr : "") + "</div>");
    if (s.lat != null || s.addr) {
      var bb = el("button", "btn ghost sm", "Abrir en Maps");
      bb.onclick = (function (x) { return function () { window.open("https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(x.lat != null ? x.lat + "," + x.lng : x.addr), "_blank"); }; })(s);
      li.appendChild(bb);
    }
    ul.appendChild(li);
  });
  root.appendChild(ul);
  root.appendChild(el("div", "muted", "El mapa interactivo con mosaicos necesita internet. Esta pantalla funciona sin señal y abre Maps solo cuando lo pides."));
}

var resFilter = "todas";
function renderReservas() {
  var root = $("#reservas"); root.innerHTML = "";
  root.appendChild(el("div", "section-title", "Reservas"));
  var fl = el("div", "");
  ["todas", "hoy", "pendientes", "mad", "sto", "par"].forEach(function (f) {
    var b = el("button", "chip" + (resFilter === f ? " ok" : ""), f === "mad" ? "MADRID" : f === "sto" ? "ESTOCOLMO" : f === "par" ? "PARÍS" : f.toUpperCase());
    b.onclick = function () { resFilter = f; renderReservas(); };
    fl.appendChild(b);
  });
  root.appendChild(fl);
  var list = T.reservations.filter(function (r) {
    if (resFilter === "todas") return true;
    if (resFilter === "hoy") return r.date === activeDay().date;
    if (resFilter === "pendientes") return r.status === "pendiente";
    return r.city === resFilter;
  });
  var ul = el("ul", "list");
  list.forEach(function (r) {
    var li = el("li");
    li.innerHTML = '<div class="t">' + r.name + '</div><div class="s tabular">' + dateLong(r.date) + (r.time ? " · " + r.time : "") + " · " + r.people + " personas</div>" +
      '<div style="margin-top:6px"><span class="chip ' + (r.status === "pagado" || r.status === "confirmado" ? "ok" : "pend") + '">' + r.status.toUpperCase() + "</span>" +
      (r.pend ? '<span class="chip pend">⚠️ PENDIENTE DE DATO</span>' : "") + "</div>" +
      (r.meeting ? '<div class="muted">Punto de encuentro: ' + r.meeting + "</div>" : "") +
      (r.note ? '<div class="muted">' + r.note + "</div>" : "");
    if (r.pend) r.pend.forEach(function (p) { li.appendChild(el("div", "pending", "<b>DATO PENDIENTE</b>" + p)); });
    ul.appendChild(li);
  });
  root.appendChild(ul);
}

function renderMas() {
  var root = $("#mas"); root.innerHTML = "";
  root.appendChild(el("div", "section-title", "Más"));

  root.appendChild(el("div", "label", "BUSCAR"));
  var inp = el("input"); inp.type = "search"; inp.placeholder = "Louvre, La Bola, hotel...";
  inp.style.cssText = "width:100%;padding:14px;font-size:17px;border:1px solid var(--rule);border-radius:5px;background:#fff;font-family:inherit";
  var out = el("ul", "list");
  inp.oninput = function () {
    var q = inp.value.toLowerCase().trim(); out.innerHTML = "";
    if (q.length < 2) return;
    T.days.forEach(function (d) {
      d.stops.forEach(function (s) {
        if (s.name.toLowerCase().indexOf(q) > -1 || (s.addr || "").toLowerCase().indexOf(q) > -1) {
          var li = el("li", "", '<div class="t">' + s.name + '</div><div class="s">' + d.weekday + " " + dateLong(d.date) + (s.t ? " · " + s.t : "") + "</div>");
          li.onclick = (function (id) { return function () { placeSheet(id); }; })(s.id);
          out.appendChild(li);
        }
      });
    });
  };
  root.appendChild(inp); root.appendChild(out);

  root.appendChild(el("div", "section-title", "Vuelos"));
  var uf = el("ul", "list");
  T.flights.forEach(function (f) {
    var li = el("li", "", '<div class="t">' + (f.number || "Vuelo por confirmar") + '</div><div class="s tabular">' + dateLong(f.date) + " · " + f.from + " → " + f.to + (f.dep ? " · " + f.dep + " – " + f.arr : "") + (f.terminalOut ? " · " + f.terminalOut : "") + "</div>" + (f.bag ? '<div class="muted">' + f.bag + "</div>" : ""));
    if (f.pend) f.pend.forEach(function (p) { li.appendChild(el("div", "pending", "<b>DATO PENDIENTE</b>" + p)); });
    uf.appendChild(li);
  });
  root.appendChild(uf);

  root.appendChild(el("div", "section-title", "Hoteles"));
  var uh = el("ul", "list");
  T.cities.forEach(function (c) {
    var li = el("li", "", '<div class="t">' + c.hotel.name + '</div><div class="s">' + c.name + " · " + c.hotel.addr + "</div>");
    if (c.hotel.pend) c.hotel.pend.forEach(function (p) { li.appendChild(el("div", /CONFLICTO/.test(p) ? "conflict" : "pending", (/CONFLICTO/.test(p) ? "<b>⚠️ CONFLICTO</b>" : "<b>DATO PENDIENTE</b>") + p)); });
    uh.appendChild(li);
  });
  root.appendChild(uh);

  root.appendChild(el("div", "section-title", "Información útil"));
  T.cities.forEach(function (c) {
    var box = el("div");
    box.innerHTML = '<div class="label" style="margin-top:14px;color:' + c.accent + '">' + c.name.toUpperCase() + "</div>";
    var p = "";
    for (var k in c.info) p += "<b>" + k.charAt(0).toUpperCase() + k.slice(1) + ":</b> " + c.info[k] + "<br>";
    box.appendChild(el("p", "muted", p));
    root.appendChild(box);
  });

  root.appendChild(el("div", "section-title", "Auditoría del itinerario"));
  var audit = runAudit();
  var ua = el("ul", "list");
  if (!audit.length) ua.appendChild(el("li", "", "Sin conflictos detectados."));
  audit.forEach(function (a) { ua.appendChild(el("li", "", '<div class="t">' + a.title + '</div><div class="s">' + a.detail + "</div>")); });
  root.appendChild(ua);

  root.appendChild(el("div", "section-title", "Ajustes"));
  var sim = el("button", "btn ghost sm", S.simulate == null ? "SIMULAR UNA HORA (pruebas)" : "Simulando " + toHHMM(S.simulate) + " — tocar para cambiar");
  sim.onclick = function () {
    var v = prompt("Hora a simular (HH:MM). Vacío para volver al reloj real.", S.simulate != null ? toHHMM(S.simulate) : "");
    S.simulate = v && v.indexOf(":") > -1 ? toMin(v) : null; save(); render();
  };
  root.appendChild(sim);
  var rst = el("button", "btn ghost sm", "BORRAR PROGRESO DEL VIAJE");
  rst.onclick = function () { if (confirm("¿Borrar todas las marcas de terminado y omitido?")) { S.done = {}; S.skip = {}; save(); render(); } };
  root.appendChild(rst);
  root.appendChild(el("div", "sync", "EUROPA 2026 · datos versión " + T.version + " · " + T.updated));
}

function runAudit() {
  var out = [];
  T.days.forEach(function (d) {
    var stops = d.stops;
    stops.forEach(function (s, i) {
      if (s.lat == null && s.cat !== "flight") out.push({ title: "Sin coordenadas: " + s.name, detail: d.weekday + " " + dateLong(d.date) + " — el tramo hacia esta parada no se puede calcular." });
      if (s.pend) s.pend.forEach(function (p) { if (/CONFLICTO/.test(p)) out.push({ title: "Conflicto: " + s.name, detail: p }); });
      var n = stops[i + 1];
      if (n && s.t && n.t) {
        var l = getLeg(s, n);
        if (l.dur != null && toMin(s.end || s.t) + l.dur > toMin(n.t)) {
          out.push({ title: "Tiempo insuficiente: " + s.name + " → " + n.name, detail: d.weekday + " " + dateLong(d.date) + " — el traslado no cabe entre " + (s.end || s.t) + " y " + n.t + "." });
        }
      }
    });
    if (d.flight) {
      var f = flight(d.flight);
      if (f && !f.dep) out.push({ title: "Vuelo sin hora: " + (f.number || f.to), detail: dateLong(d.date) + " — no se puede calcular la hora de salida del hotel." });
    }
  });
  T.reservations.forEach(function (r) { if (r.status === "pendiente") out.push({ title: "Reserva sin confirmar: " + r.name, detail: dateLong(r.date) + " — estado pendiente." }); });
  return out;
}

/* ------------------------------------------------------------- navegación */
function go(tab) {
  S.tab = tab; save();
  ["hoy", "viaje", "mapa", "reservas", "mas"].forEach(function (t) {
    $("#" + t).classList.toggle("on", t === tab);
    $("#nav-" + t).classList.toggle("on", t === tab);
  });
  window.scrollTo(0, 0);
  render();
}
function render() {
  renderTop();
  if (S.tab === "hoy") renderHoy();
  else if (S.tab === "viaje") renderViaje();
  else if (S.tab === "mapa") renderMapa();
  else if (S.tab === "reservas") renderReservas();
  else renderMas();
}

document.addEventListener("DOMContentLoaded", function () {
  ["hoy", "viaje", "mapa", "reservas", "mas"].forEach(function (t) {
    $("#nav-" + t).onclick = function () { go(t); };
  });
  go(S.tab || "hoy");
  setInterval(render, 60000);
  function net() { document.body.classList.toggle("is-offline", !navigator.onLine); }
  window.addEventListener("online", net); window.addEventListener("offline", net); net();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});
});
})();
