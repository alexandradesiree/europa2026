/* Genera EUROPA2026.ics a partir de data.js
   Uso:  node generar-ics.js
   El .ics se importa una sola vez en el Calendario del iPhone.
   Las alarmas suenan sin internet, aunque la app esté cerrada. */
global.window = {};
require("./data.js");
const T = window.window ? window.window.TRIP : window.TRIP;
const fs = require("fs");

const toMin = t => { if (!t) return null; const p = t.split(":"); return +p[0] * 60 + +p[1]; };
const pad = n => (n < 10 ? "0" : "") + n;
const stamp = (iso, min) => iso.replace(/-/g, "") + "T" + pad(Math.floor(min / 60)) + pad(min % 60) + "00";
const esc = s => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

function hav(a, b) {
  if (a.lat == null || b.lat == null) return null;
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
function legDur(a, b) {
  const ov = T.legs[a.id + ">" + b.id];
  if (ov) return ov.dur == null ? null : ov.dur;
  const km = hav(a, b);
  if (km == null) return null;
  if (km < 0.06) return 0;
  if (km > 3.2) return Math.round(km / 20 * 60) + 10;
  return Math.max(3, Math.round(km / 4.4 * 60) + 2);
}

const out = [
  "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//EUROPA 2026//ES", "CALSCALE:GREGORIAN",
  "METHOD:PUBLISH", "X-WR-CALNAME:EUROPA 2026", "X-WR-TIMEZONE:Europe/Paris",
  "BEGIN:VTIMEZONE", "TZID:Europe/Paris",
  "BEGIN:DAYLIGHT", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0200", "TZNAME:CEST",
  "DTSTART:19700329T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "END:DAYLIGHT",
  "BEGIN:STANDARD", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0100", "TZNAME:CET",
  "DTSTART:19701025T030000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "END:STANDARD",
  "END:VTIMEZONE"
];

let n = 0;
function ev(o) {
  n++;
  out.push("BEGIN:VEVENT",
    "UID:" + o.uid + "@europa2026",
    "DTSTAMP:20260904T000000Z",
    "DTSTART;TZID=Europe/Paris:" + o.start,
    "DTEND;TZID=Europe/Paris:" + o.end,
    "SUMMARY:" + esc(o.title));
  if (o.loc) out.push("LOCATION:" + esc(o.loc));
  if (o.desc) out.push("DESCRIPTION:" + esc(o.desc));
  (o.alarms || []).forEach(a => {
    out.push("BEGIN:VALARM", "ACTION:DISPLAY",
      "DESCRIPTION:" + esc(a.text),
      "TRIGGER:-PT" + a.min + "M", "END:VALARM");
  });
  out.push("END:VEVENT");
}

T.days.forEach(d => {
  const c = T.cities.find(x => x.id === d.city);
  const stops = d.stops;

  stops.forEach((s, i) => {
    const isAnchor = s.prio === "P1" || s.res;
    if (!isAnchor || !s.t) return;
    const r = s.res ? T.reservations.find(x => x.id === s.res) : null;
    const start = toMin(s.t);
    const end = toMin(s.end) || start + 60;

    // hora de salida desde la parada anterior
    const prev = stops[i - 1];
    let alarms = [];
    if (prev) {
      const dur = legDur(prev, s);
      if (dur == null) {
        alarms.push({ min: 30, text: "Ponte en marcha hacia " + s.name + " · traslado sin verificar, revisa Maps" });
      } else if (dur > 0) {
        alarms.push({ min: dur + 10, text: "SAL YA desde " + prev.name + " hacia " + s.name + " · " + dur + " min de traslado" });
      }
    }
    alarms.push({ min: 15, text: "En 15 min: " + s.name + (r && r.meeting ? " · " + r.meeting : "") });
    // una sola alarma por minuto: si coinciden, manda la de salida
    const seen = {};
    alarms = alarms.filter(a => { if (seen[a.min]) return false; seen[a.min] = 1; return true; });
    if (s.cat === "flight") alarms = [{ min: 180, text: "Vuelo en 3 h — salir hacia el aeropuerto" }, { min: 60, text: "Vuelo en 1 h" }];

    const desc = [
      c ? c.name : "",
      r ? "Reserva: " + r.name + " · " + r.status.toUpperCase() : "",
      r && r.meeting ? "Punto de encuentro: " + r.meeting : "",
      s.do || "",
      (s.pend && s.pend.length) ? "⚠️ PENDIENTE: " + s.pend.join(" / ") : ""
    ].filter(Boolean).join("\n");

    ev({
      uid: s.id,
      start: stamp(d.date, start),
      end: stamp(d.date, end),
      title: (s.prio === "P1" ? "🔒 " : "") + s.name,
      loc: s.addr || "",
      desc: desc,
      alarms: alarms
    });
  });

  // salida del hotel como evento propio cuando el día la define
  if (d.depart) {
    ev({
      uid: d.id + "-salida",
      start: stamp(d.date, toMin(d.depart)),
      end: stamp(d.date, toMin(d.depart) + 15),
      title: "▶ Salir del hotel · " + d.concept,
      loc: c ? c.hotel.addr : "",
      desc: (c ? c.name + " · " : "") + d.concept,
      alarms: [{ min: 30, text: "Salir del hotel en 30 min" }, { min: 10, text: "Salir del hotel en 10 min" }]
    });
  }
});

out.push("END:VCALENDAR");
fs.writeFileSync("EUROPA2026.ics", out.join("\r\n") + "\r\n");
console.log("EUROPA2026.ics generado · " + n + " eventos");
