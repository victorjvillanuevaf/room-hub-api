# No Solapamiento de Reservaciones (SQL)

Este proyecto evita reservaciones solapadas directamente en PostgreSQL usando una **exclusion constraint**.

## Dónde se implementa

1. Constraint SQL (fuente de verdad):
   - `src/database/migrations/1718400000000-add-no-overlapping-reservations.ts`
2. Manejo del error para respuesta HTTP:
   - `src/modules/reservations/services/reservations.service.ts`

## Query que aplica la regla

La migración crea la extensión e incorpora esta constraint:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE reservations
ADD CONSTRAINT no_overlapping_reservations
EXCLUDE USING gist (
  room_id WITH =,
  tstzrange(start_at, end_at, '[)') WITH &&
)
WHERE (status = 'ACTIVE');
```

## Por qué funciona

La constraint bloquea cualquier par de filas activas donde simultáneamente:

1. `room_id WITH =`: sea la misma sala.
2. `tstzrange(start_at, end_at, '[)') WITH &&`: sus rangos de tiempo se traslapen.

Si ambas condiciones se cumplen, PostgreSQL rechaza el `INSERT`/`UPDATE` con error `23P01` (exclusion constraint violation).

## Detalles importantes

1. `tstzrange(..., '[)')` usa intervalo semiabierto:
   - Incluye el inicio (`[`).
   - Excluye el final (`)`).
   - Permite reservaciones consecutivas sin conflicto, por ejemplo:
     - A: `10:00-11:00`
     - B: `11:00-12:00`

2. `WHERE (status = 'ACTIVE')` hace la regla parcial:
   - Solo compara reservaciones activas.
   - Reservaciones canceladas no bloquean nuevos horarios.

3. `EXCLUDE USING gist` se comporta como constraint + estructura indexada:
   - PostgreSQL usa GiST para evaluar eficientemente la restricción.
   - En la practica, combina validación de integridad con aceleración de búsqueda para detectar colisiones.

## Flujo en la aplicación

1. La API intenta guardar la reservación en `ReservationsService.create`.
2. Si hay solapamiento, PostgreSQL rechaza la operación con `23P01`.
3. El servicio captura ese código y responde `409 Conflict` con el mensaje:
   - `The room is already reserved for the selected time range`.

## Ventaja de este enfoque

La validación vive en la base de datos, por lo que protege contra condiciones de carrera y aplica igual para cualquier cliente/proceso que escriba en la tabla `reservations`.