-- 04_roles_y_permisos.sql
DROP ROLE IF EXISTS rol_veterinario;
DROP ROLE IF EXISTS rol_recepcion;
DROP ROLE IF EXISTS rol_admin;

CREATE ROLE rol_veterinario;
CREATE ROLE rol_recepcion;
CREATE ROLE rol_admin;

-- ADMIN
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO rol_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO rol_admin;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO rol_admin;

-- RECEPCIÓN
GRANT SELECT ON mascotas, duenos, citas TO rol_recepcion;
GRANT INSERT ON citas TO rol_recepcion;
GRANT USAGE ON SEQUENCE citas_id_seq TO rol_recepcion;

-- VETERINARIO
GRANT SELECT, INSERT, UPDATE ON mascotas, citas, vacunas_aplicadas TO rol_veterinario;
GRANT SELECT ON vet_atiende_mascota TO rol_veterinario;
GRANT SELECT ON inventario_vacunas TO rol_veterinario;
GRANT SELECT ON duenos TO rol_veterinario;   
GRANT SELECT ON v_mascotas_vacunacion_pendiente TO rol_veterinario;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO rol_veterinario;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;