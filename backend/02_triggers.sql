-- 02_triggers.sql
CREATE OR REPLACE FUNCTION fn_historial_cita()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO historial_movimientos (tipo, referencia_id, descripcion)
    VALUES ('CITA', NEW.id, FORMAT('Cita %s para mascota %s con vet %s en %s',
                                    NEW.estado, NEW.mascota_id, NEW.veterinario_id, NEW.fecha_hora));
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_historial_cita
AFTER INSERT ON citas
FOR EACH ROW
EXECUTE FUNCTION fn_historial_cita();