# EUROPA 2026 · aplicación de viaje

App web instalable (PWA) para usar en el iPhone durante el viaje del 5 al 20 de septiembre de 2026.
Funciona sin señal una vez instalada.

## Archivos

| Archivo | Qué es | ¿Lo editas? |
|---|---|---|
| `data.js` | **El viaje entero.** Días, paradas, reservas, vuelos, tramos verificados. | **SÍ. Es el único que tocas.** |
| `index.html` | Estructura de la app | No |
| `app.js` | Lógica: motor de tiempo, tramos, pantallas | No |
| `styles.css` | Diseño | No |
| `sw.js` | Service worker: hace que funcione sin internet | No |
| `manifest.json` | Nombre e iconos al instalarla | No |
| `PENDIENTES.md` | Lista de todo lo que falta por confirmar | Referencia |

## Cómo cambiar algo del viaje

Abre `data.js` en GitHub (lápiz de editar), busca la parada y cambia el texto entre comillas.

- Cambiar una hora → `t: "11:00"`
- Marcar una reserva como pagada → en `reservations`, `status: "pagado"`
- Añadir una parada → copia un bloque `{ ... }` entero y pégalo en el orden que le toca
- Quitar un `DATO PENDIENTE` → borra esa línea del array `pend: [...]`

Cada vez que guardes en GitHub, la app se actualiza sola en unos minutos. Ábrela con internet una vez para que descargue la versión nueva.

## Qué hace la app

- **HOY** — dónde estás, a dónde vas, a qué hora sales, cuánto margen tienes, botón IR AHORA
- **✓ TERMINAR** — marca la parada como hecha y abre inmediatamente el traslado siguiente
- **OMITIR** — avisa cuál será la siguiente parada y recalcula
- **VAMOS TARDE** — detecta el retraso real y propone qué ajustar (+15), qué eliminar (+30) y qué conservar obligatoriamente (+60)
- **ESTAMOS CANSADOS** — plan ligero conservando todas las reservas
- **VOLVER AL HOTEL** — ruta al hotel de la ciudad desde donde estés
- **Tramos** — nunca hay hueco entre dos paradas: instrucciones paso a paso y enlaces a Google Maps y Apple Maps
- **Auditoría** (en MÁS) — lista los conflictos y datos faltantes que detecta sola

## Reglas que respeta

- No inventa nada. Lo que no está verificado aparece como `DATO PENDIENTE`.
- No modifica reservas automáticamente: solo reorganiza lo flexible.
- El progreso (terminado / omitido) se guarda en el teléfono y sobrevive a cerrar la app.

## Decisiones técnicas

- El mapa no usa mosaicos: una lista numerada de los puntos del día más un botón que abre la ruta completa en Maps. Así la pantalla de mapa funciona sin señal.
- Las distancias a pie entre paradas se calculan con las coordenadas. Se marcan como "sin verificar" hasta que se confirmen calle por calle.
- El clima no está conectado a ninguna API: requeriría internet y una clave. Se puede añadir después.

## Recordatorios en el iPhone

La app avisa mientras la tienes abierta (franja "SAL AHORA"), pero **no puede mandar notificaciones con la app cerrada**: las PWA en iPhone no tienen notificaciones locales programadas, y las push necesitarían un servidor.

La solución que sí funciona, y funciona sin señal: **importar `EUROPA2026.ics` al Calendario del iPhone**. Una sola vez, y el sistema se encarga del resto.

Contiene 61 eventos con 100 alarmas:
- cada reserva y cada actividad fija, con su punto de encuentro y su estado en la descripción
- una alarma a la **hora exacta en que hay que salir** del punto anterior ("SAL YA desde X hacia Y · 8 min de traslado")
- una alarma 15 minutos antes de cada cita
- salida del hotel cada mañana, con avisos a 30 y 10 minutos
- vuelos con avisos a 3 h y 1 h

Todo en horario local europeo (CEST), así que las alarmas suenan a la hora correcta aunque importes el archivo desde Mérida.

**Para regenerarlo después de editar `data.js`:** `node generar-ics.js`
Si no tienes Node instalado, pídemelo y lo regenero yo.
