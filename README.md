# Sistema Clínica Veterinaria – Corte 3

## Decisiones de diseño

### 1. ¿Qué política RLS aplicaste a la tabla `mascotas`? Pega la cláusula exacta y explica con tus palabras qué hace.

```sql
CREATE POLICY mascotas_veterinario_policy ON mascotas
    FOR ALL TO rol_veterinario
    USING ( id IN (
        SELECT mascota_id FROM vet_atiende_mascota
        WHERE vet_id = current_setting('app.current_veterinario_id', TRUE)::INT
    ) );
```

Explicación:
La política filtra las filas de mascotas que un veterinario puede ver. Solo muestra aquellas mascotas cuyo id aparezca en la tabla vet_atiende_mascota asociadas al vet_id que el backend ha guardado en la variable de sesión app.current_veterinario_id. Así cada veterinario ve únicamente las mascotas que atiende.

2. Cualquiera que sea la estrategia que elegiste para identificar al veterinario actual en RLS, tiene un vector de ataque posible. ¿Cuál es? ¿Tu sistema lo previene? ¿Cómo?
El vector de ataque es la manipulación de la variable de sesión app.current_veterinario_id mediante inyección SQL si el backend concatenara valores directamente.
Mi sistema lo previene porque toda consulta que envía el ID del veterinario usa parámetros (ej. cur.execute("SELECT set_veterinario_id(%s)", (vet_id,))). Nunca concateno el ID en la cadena SQL, por lo que un atacante no puede modificar la variable de sesión.

3. Si usas SECURITY DEFINER en algún procedimiento, ¿qué medida específica tomaste para prevenir la escalada de privilegios que ese modo habilita? Si no lo usas, justifica por qué no era necesario.
No uso SECURITY DEFINER en ningún procedimiento. Todos los procedimientos y funciones se ejecutan con SECURITY INVOKER (comportamiento por defecto). La razón es que no necesito que un rol con menos privilegios ejecute código con permisos elevados. El diseño de RLS + roles ya proporciona el aislamiento necesario sin exponer la base a escalada de privilegios por manipulación de search_path.

4. ¿Qué TTL le pusiste al caché Redis y por qué ese valor específico? ¿Qué pasaría si fuera demasiado bajo? ¿Demasiado alto?
TTL = 120 segundos (2 minutos).
Elegí este valor porque la consulta de vacunación pendiente es costosa (recorre todas las mascotas y vacunas), pero los datos no cambian cada segundo. Con 2 minutos se reduce la carga en la BD sin que los datos queden demasiado obsoletos.

Si fuera demasiado bajo (ej. 5 segundos): el caché sería inútil, la mayoría de las consultas irían a la BD.

Si fuera demasiado alto (ej. 1 hora): un cliente vería mascotas que ya fueron vacunadas como pendientes, dando información incorrecta.

5. Tu frontend manda input del usuario al backend. Elige un endpoint crítico y pega la línea exacta donde el backend maneja ese input antes de enviarlo a la base de datos. Explica qué protege esa línea y de qué. Indica archivo y número de línea.
Endpoint: /buscar_mascotas
Archivo: api/app.py, línea donde se ejecuta la consulta:

python
cur.execute("SELECT id, nombre, especie FROM mascotas WHERE nombre ILIKE %s", (f"%{termino}%",))
Protección: El uso del segundo argumento de execute() con parámetros (%s) hace que el driver psycopg2 escape automáticamente el valor de termino. Esto evita que un atacante pueda inyectar SQL, incluso si escribe algo como ' OR '1'='1.

6. Si revocas todos los permisos del rol de veterinario excepto SELECT en mascotas, ¿qué deja de funcionar en tu sistema? Lista tres operaciones que se romperían.
Agendar una cita – requiere INSERT en citas.

Aplicar una vacuna – requiere INSERT en vacunas_aplicadas y SELECT en inventario_vacunas.

Ver la lista de vacunación pendiente – requiere SELECT en la vista v_mascotas_vacunacion_pendiente (que a su vez necesita acceso a duenos, vacunas_aplicadas, etc.).