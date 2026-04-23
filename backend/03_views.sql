-- 03_views.sql
CREATE OR REPLACE VIEW v_mascotas_vacunacion_pendiente AS
SELECT 
    m.id AS mascota_id,
    m.nombre AS mascota_nombre,
    d.nombre AS dueno_nombre,
    iv.nombre AS ultima_vacuna,
    va.fecha_aplicacion AS ultima_fecha,
    NOW() - va.fecha_aplicacion AS dias_desde_ultima
FROM mascotas m
JOIN duenos d ON m.dueno_id = d.id
LEFT JOIN LATERAL (
    SELECT vacuna_id, fecha_aplicacion
    FROM vacunas_aplicadas
    WHERE mascota_id = m.id
    ORDER BY fecha_aplicacion DESC
    LIMIT 1
) va ON true
LEFT JOIN inventario_vacunas iv ON va.vacuna_id = iv.id
WHERE va.fecha_aplicacion IS NULL OR va.fecha_aplicacion < NOW() - INTERVAL '1 year';