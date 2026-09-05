# CÓMO AGREGAR COSAS A LA APP TÚ MISMA

Todo el viaje vive en un solo archivo: **`data.js`**. Se edita desde el navegador de GitHub, sin instalar nada.

**Regla de oro:** solo cambias lo que está **entre comillas**. Las comas, las llaves `{ }` y los corchetes `[ ]` se quedan donde están.

Si algo se rompe, la app te dirá exactamente qué pasó y GitHub guarda todas las versiones anteriores. No se puede perder nada.

---

## 1. Cambiar una hora

Busca la parada y cambia el número:

```js
{ id:"p16d", t:"11:30", end:"14:15", name:"Museo del Louvre", ...
```

`t` es la hora de llegada, `end` la de salida. Formato 24 horas, siempre con dos dígitos: `"09:15"`, no `"9:15"`.

---

## 2. Marcar una reserva como pagada

En la sección `reservations`, busca la reserva y cambia una palabra:

```js
status: "pendiente"    →    status: "pagado"
```

Valores válidos: `"pagado"`, `"confirmado"`, `"pendiente"`, `"revisar"`.

---

## 3. Quitar un aviso de DATO PENDIENTE

Cuando confirmes un dato, borra esa línea completa del bloque `pend`:

```js
pend:["Duración de la sesión: DATO PENDIENTE",
      "Localizador: VERIFICAR EN COMPROBANTE"] },
```

Si quitas una, borra también su coma. Si ya no queda ninguna, borra el `pend:[...]` entero incluida la coma que lo precede.

---

## 4. Agregar una parada nueva

Copia este bloque completo y pégalo **en el lugar de la secuencia que le toca** (el orden en el archivo es el orden del día):

```js
        { id:"p16z", t:"18:00", end:"19:00", name:"Nombre del lugar", cat:"sight", prio:"P3",
          lat:48.8566, lng:2.3522, addr:"Dirección completa, código postal, ciudad",
          what:"Qué es, en una frase.",
          why:"Por qué vale la pena.",
          do:"Qué hacemos aquí.",
          pend:["Lo que todavía no esté confirmado"] },
```

Lo único obligatorio: `id`, `name`, `cat`, `prio`.

**El `id` no se puede repetir.** Usa la letra de la ciudad + el día + una letra libre: `p16z`, `m07n`, `s11z`.

| Campo | Valores |
|---|---|
| `cat` | `sight` `food` `shop` `tour` `show` `hotel` `transport` `flight` `free` |
| `prio` | `P1` fija · `P2` muy importante · `P3` deseable · `P4` prescindible |
| `flex:true` | la app puede proponer quitarla en el plan ligero |

**Las coordenadas importan.** Sin `lat` y `lng`, la app no puede calcular el tramo desde la parada anterior y lo marca como sin verificar. Para sacarlas: busca el lugar en Google Maps, mantén pulsado sobre el punto exacto, y copia los dos números que aparecen.

---

## 5. Agregar una reserva

En la sección `reservations`, copia y pega:

```js
    { id: "r_loquesea", name: "Nombre de la reserva", city: "par",
      date: "2026-09-16", time: "19:30", people: 2, status: "confirmado",
      provider: "Quién la vende", code: "LOCALIZADOR",
      meeting: "Dónde exactamente nos vemos",
      addr: "Dirección completa" },
```

`city` solo puede ser `"mad"`, `"sto"` o `"par"`.

Después, en la parada correspondiente, añade `res:"r_loquesea"` para enlazarlas.

---

## 6. Agregar un punto fotográfico

Dentro de una parada:

```js
          photo:{ frame:"vertical", where:"Dónde pararte exactamente",
                  back:"Qué debe quedar detrás", light:"Golden hour",
                  tip:"Un consejo breve" },
```

---

## 7. Agregar instrucciones de metro verificadas

En la sección `legs`, al final del archivo. La clave es `"idOrigen>idDestino"`:

```js
    "p16d>p16f": { mode:"metro", line:"Línea 1", dir:"Château de Vincennes", dur:12, dist:"3 km",
      steps:["Entra en la estación Palais Royal.",
             "Toma la línea 1 dirección Château de Vincennes.",
             "Baja en la tercera parada: Châtelet.",
             "Sal por la salida Rue de Rivoli y camina 4 minutos."],
      note:"Lo que quieras recordar" },
```

Mientras no exista este bloque, la app calcula la caminata sola y la marca como *sin verificar*. Nunca se queda sin tramo.

---

## 8. Después de guardar

1. GitHub guarda el cambio y publica la app sola en 1–2 minutos.
2. Abre la app **con internet** una vez para que descargue la versión nueva.
3. Si cambiaste horas o reservas, **regenera el calendario**: pídemelo y te devuelvo el `.ics` actualizado, o corre `node generar-ics.js` si tienes Node.

---

## Cuándo conviene mandármelo a mí en vez de editarlo tú

- Una actividad nueva que arrastra cambios de horario en el resto del día
- Un traslado con metro, RER o tren que hay que verificar
- Un comprobante de reserva completo
- Cualquier cosa que toque más de dos paradas a la vez

Para eso mándame la captura o el texto y yo lo cargo verificado. Para cambiar una hora, marcar un pago o borrar un pendiente, hazlo tú: es más rápido que escribirme.
