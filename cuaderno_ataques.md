# Cuaderno de Ataques – Corte 3

## Sección 1: Tres ataques de SQL injection que fallan

### Ataque 1: Quote‑escape clásico
- **Input:** `' OR '1'='1` en el campo de búsqueda de mascotas.
- **Pantalla:** Búsqueda de mascotas (frontend).
- **Resultado:** El sistema solo muestra las mascotas que el veterinario actual tiene asignadas (gracias a RLS). No se muestran todas las mascotas de la tabla.
- **Línea defensiva:** `api/app.py` – `cur.execute("SELECT ... WHERE nombre ILIKE %s", (f"%{termino}%",))`  
  El uso de parámetros impide la inyección.

### Ataque 2: Stacked query
- **Input:** `'; DROP TABLE mascotas; --` en el campo de búsqueda.
- **Resultado:** La consulta falla con un error de sintaxis (el driver `psycopg2` no permite múltiples sentencias por defecto). La tabla `mascotas` no se elimina.
- **Línea defensiva:** El protocolo de PostgreSQL y el driver restringen la ejecución a una sola sentencia por `execute()`.

### Ataque 3: Union‑based
- **Input:** `' UNION SELECT nombre, cedula FROM veterinarios --` en el campo de búsqueda.
- **Resultado:** La consulta falla porque el número de columnas no coincide (la consulta original pide `id, nombre, especie`). Además, el rol `rol_veterinario` no tiene permiso para leer `veterinarios` directamente.
- **Línea defensiva:** Parametrización + permisos restrictivos (principio de mínimo privilegio).

## Sección 2: Demostración de RLS en acción

**Configuración:** Dos veterinarios:
- Dr. López (vet_id=1) atiende a Firulais, Toby, Max.
- Dra. García (vet_id=2) atiende a Misifú, Luna, Dante.

**Capturas (describir o pegar imágenes):**
1. **Veterinario ID=1** busca "todas las mascotas" (campo vacío):  
   Resultado: Firulais, Toby, Max. (solo sus mascotas)
2. **Veterinario ID=2** busca "todas las mascotas":  
   Resultado: Misifú, Luna, Dante.

**Política responsable:**  
`mascotas_veterinario_policy` – filtra `mascotas.id` mediante subconsulta a `vet_atiende_mascota` comparando con `current_setting('app.current_veterinario_id')`.

## Sección 3: Demostración de caché Redis funcionando

**Logs del contenedor `clinica_api` (timestamps reales):**
[CACHE MISS] vacunacion_pendiente:rol_veterinario:1
[CACHE HIT] vacunacion_pendiente:rol_veterinario:1
[CACHE INVALIDADO] vacunacion_pendiente:rol_veterinario:1
[CACHE MISS] vacunacion_pendiente:rol_veterinario:1

text

**Explicación:**
- **Primera consulta:** fallo de caché → se consulta BD (latencia ~150ms).
- **Segunda consulta inmediata:** acierto de caché → respuesta desde Redis (~10ms).
- **Aplicación de vacuna:** se invalida la clave del veterinario actual y la del admin.
- **Tercera consulta:** nuevo fallo de caché (la información se actualiza).

**Clave usada:** `vacunacion_pendiente:rol_veterinario:{vet_id}` (para admin: `vacunacion_pendiente:rol_admin`).  
**TTL:** 120 segundos.  
**Justificación:** Equilibrio entre frescura de datos y rendimiento.