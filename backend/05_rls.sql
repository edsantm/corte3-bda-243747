-- 05_rls.sql
ALTER TABLE mascotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacunas_aplicadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE citas ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION set_veterinario_id(id INT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM set_config('app.current_veterinario_id', id::TEXT, FALSE);
END;
$$;

GRANT EXECUTE ON FUNCTION set_veterinario_id TO rol_veterinario;

-- Política mascotas
CREATE POLICY mascotas_veterinario_policy ON mascotas
    FOR ALL TO rol_veterinario
    USING ( id IN (
        SELECT mascota_id FROM vet_atiende_mascota
        WHERE vet_id = current_setting('app.current_veterinario_id', TRUE)::INT
    ) );

CREATE POLICY mascotas_admin_recepcion_policy ON mascotas
    FOR ALL TO rol_admin, rol_recepcion
    USING (true);

-- Políticas vacunas_aplicadas
CREATE POLICY vacunas_veterinario_select ON vacunas_aplicadas
    FOR SELECT TO rol_veterinario
    USING ( mascota_id IN (
        SELECT mascota_id FROM vet_atiende_mascota
        WHERE vet_id = current_setting('app.current_veterinario_id', TRUE)::INT
    ) );

CREATE POLICY vacunas_veterinario_insert ON vacunas_aplicadas
    FOR INSERT TO rol_veterinario
    WITH CHECK ( mascota_id IN (
        SELECT mascota_id FROM vet_atiende_mascota
        WHERE vet_id = current_setting('app.current_veterinario_id', TRUE)::INT
    ) );

CREATE POLICY vacunas_admin_policy ON vacunas_aplicadas
    FOR ALL TO rol_admin
    USING (true)
    WITH CHECK (true);

-- Políticas citas
CREATE POLICY citas_veterinario_policy ON citas
    FOR ALL TO rol_veterinario
    USING ( veterinario_id = current_setting('app.current_veterinario_id', TRUE)::INT );

CREATE POLICY citas_recepcion_admin_policy ON citas
    FOR ALL TO rol_recepcion, rol_admin
    USING (true);

ALTER VIEW v_mascotas_vacunacion_pendiente SET (security_invoker = true);