
-- ---------- VETERINARIOS ----------
CREATE OR REPLACE FUNCTION admin_listar_veterinarios()
RETURNS TABLE(id INT, nombre VARCHAR, cedula VARCHAR, dias_descanso VARCHAR, activo BOOLEAN)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT id, nombre, cedula, dias_descanso, activo
    FROM veterinarios
    ORDER BY id;
$$;

CREATE OR REPLACE FUNCTION admin_crear_veterinario(
    p_nombre VARCHAR,
    p_cedula VARCHAR,
    p_dias_descanso VARCHAR DEFAULT ''
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_id INT;
BEGIN
    INSERT INTO veterinarios (nombre, cedula, dias_descanso, activo)
    VALUES (p_nombre, p_cedula, p_dias_descanso, TRUE)
    RETURNING id INTO new_id;
    RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION admin_actualizar_veterinario(
    p_id INT,
    p_nombre VARCHAR DEFAULT NULL,
    p_cedula VARCHAR DEFAULT NULL,
    p_dias_descanso VARCHAR DEFAULT NULL,
    p_activo BOOLEAN DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE veterinarios SET
        nombre = COALESCE(p_nombre, nombre),
        cedula = COALESCE(p_cedula, cedula),
        dias_descanso = COALESCE(p_dias_descanso, dias_descanso),
        activo = COALESCE(p_activo, activo)
    WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION admin_eliminar_veterinario(p_id INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM veterinarios WHERE id = p_id;
END;
$$;

-- ---------- ASIGNACIONES (vet_atiende_mascota) ----------
CREATE OR REPLACE FUNCTION admin_listar_asignaciones()
RETURNS TABLE(
    id INT,
    vet_id INT,
    vet_nombre VARCHAR,
    mascota_id INT,
    mascota_nombre VARCHAR,
    fecha_inicio_atencion DATE,
    activa BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT vam.id, vam.vet_id, v.nombre, vam.mascota_id, m.nombre,
           vam.fecha_inicio_atencion, vam.activa
    FROM vet_atiende_mascota vam
    JOIN veterinarios v ON v.id = vam.vet_id
    JOIN mascotas m ON m.id = vam.mascota_id
    ORDER BY vam.id;
$$;

CREATE OR REPLACE FUNCTION admin_asignar_mascota(p_vet_id INT, p_mascota_id INT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
    INSERT INTO vet_atiende_mascota (vet_id, mascota_id)
    VALUES (p_vet_id, p_mascota_id)
    ON CONFLICT DO NOTHING;
$$;

CREATE OR REPLACE FUNCTION admin_desasignar_mascota(p_asignacion_id INT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
    DELETE FROM vet_atiende_mascota WHERE id = p_asignacion_id;
$$;

-- ---------- INVENTARIO DE VACUNAS ----------
CREATE OR REPLACE FUNCTION admin_listar_inventario()
RETURNS TABLE(
    id INT,
    nombre VARCHAR,
    stock_actual INT,
    stock_minimo INT,
    costo_unitario NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT id, nombre, stock_actual, stock_minimo, costo_unitario
    FROM inventario_vacunas
    ORDER BY id;
$$;

CREATE OR REPLACE FUNCTION admin_crear_vacuna(
    p_nombre VARCHAR,
    p_stock_actual INT,
    p_stock_minimo INT,
    p_costo_unitario NUMERIC
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_id INT;
BEGIN
    INSERT INTO inventario_vacunas (nombre, stock_actual, stock_minimo, costo_unitario)
    VALUES (p_nombre, p_stock_actual, p_stock_minimo, p_costo_unitario)
    RETURNING id INTO new_id;
    RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION admin_actualizar_vacuna(
    p_id INT,
    p_nombre VARCHAR DEFAULT NULL,
    p_stock_actual INT DEFAULT NULL,
    p_stock_minimo INT DEFAULT NULL,
    p_costo_unitario NUMERIC DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE inventario_vacunas SET
        nombre = COALESCE(p_nombre, nombre),
        stock_actual = COALESCE(p_stock_actual, stock_actual),
        stock_minimo = COALESCE(p_stock_minimo, stock_minimo),
        costo_unitario = COALESCE(p_costo_unitario, costo_unitario)
    WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION admin_eliminar_vacuna(p_id INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM inventario_vacunas WHERE id = p_id;
END;
$$;