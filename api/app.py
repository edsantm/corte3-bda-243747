import os
import redis
import psycopg2
import psycopg2.extras
from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import datetime

app = Flask(__name__)
CORS(app)

class DateEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime.date, datetime.datetime)):
            return obj.isoformat()
        if isinstance(obj, datetime.timedelta):
            return str(obj)
        return super().default(obj)

def get_env_var(name):
    value = os.environ.get(name)
    if value is None:
        raise RuntimeError(f"Falta variable de entorno: {name}")
    return value

DB_CONFIG = {
    'host': get_env_var('DB_HOST'),
    'port': get_env_var('DB_PORT'),
    'dbname': get_env_var('DB_NAME'),
    'user': get_env_var('DB_USER'),
    'password': get_env_var('DB_PASSWORD')
}

REDIS_HOST = get_env_var('REDIS_HOST')
REDIS_PORT = int(get_env_var('REDIS_PORT'))
redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)

CACHE_TTL = 120
CACHE_KEY_PREFIX = "vacunacion_pendiente"

def get_cache_key(rol, veterinario_id=None):
    if rol == 'rol_veterinario' and veterinario_id:
        return f"{CACHE_KEY_PREFIX}:{rol}:{veterinario_id}"
    else:
        return f"{CACHE_KEY_PREFIX}:{rol}"

def get_db_connection(rol, veterinario_id=None):
    conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = False
    cur = conn.cursor()
    cur.execute(f"SET ROLE {rol};")
    if veterinario_id:
        cur.execute("SELECT set_veterinario_id(%s);", (veterinario_id,))
    conn.commit()
    cur.close()
    return conn

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    return jsonify({'rol': data.get('rol'), 'veterinario_id': data.get('veterinario_id')})

@app.route('/vacunas', methods=['GET'])
def vacunas():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT id, nombre, stock_actual FROM inventario_vacunas ORDER BY id;")
        vacunas = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify(vacunas)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/buscar_mascotas', methods=['POST'])
def buscar_mascotas():
    data = request.get_json()
    rol = data.get('rol')
    vet_id = data.get('veterinario_id')
    termino = data.get('termino', '')
    try:
        conn = get_db_connection(rol, vet_id)
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT id, nombre, especie FROM mascotas WHERE nombre ILIKE %s", (f"%{termino}%",))
        resultados = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify(resultados)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/vacunacion_pendiente', methods=['POST'])
def vacunacion_pendiente():
    data = request.get_json()
    rol = data.get('rol')
    vet_id = data.get('veterinario_id')
    if rol not in ['rol_veterinario', 'rol_admin']:
        return jsonify({'error': 'No autorizado'}), 403
    cache_key = get_cache_key(rol, vet_id)
    cached = redis_client.get(cache_key)
    if cached:
        print(f"[CACHE HIT] {cache_key}")
        return jsonify(json.loads(cached))
    print(f"[CACHE MISS] {cache_key}")
    try:
        conn = get_db_connection(rol, vet_id)
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM v_mascotas_vacunacion_pendiente;")
        resultados = cur.fetchall()
        cur.close()
        conn.close()
        redis_client.setex(cache_key, CACHE_TTL, json.dumps(resultados, cls=DateEncoder))
        return jsonify(resultados)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/aplicar_vacuna', methods=['POST'])
def aplicar_vacuna():
    data = request.get_json()
    rol = data.get('rol')
    vet_id = data.get('veterinario_id')
    mascota_id = data.get('mascota_id')
    vacuna_id = data.get('vacuna_id')
    if rol != 'rol_veterinario':
        return jsonify({'error': 'No autorizado'}), 403
    try:
        conn = get_db_connection(rol, vet_id)
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO vacunas_aplicadas (mascota_id, vacuna_id, veterinario_id, fecha_aplicacion, costo_cobrado)
            VALUES (%s, %s, %s, CURRENT_DATE, (SELECT costo_unitario FROM inventario_vacunas WHERE id=%s))
        """, (mascota_id, vacuna_id, vet_id, vacuna_id))
        conn.commit()
        cur.close()
        conn.close()
        # Invalidar caché del veterinario actual y del admin
        keys = [get_cache_key('rol_veterinario', vet_id), get_cache_key('rol_admin', None)]
        for k in keys:
            redis_client.delete(k)
            print(f"[CACHE INVALIDADO] {k}")
        return jsonify({'message': 'Vacuna aplicada, caché invalidado'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== ADMINISTRACIÓN (SOLO PARA rol_admin) ====================
# Todas estas funciones llaman a procedimientos almacenados en PostgreSQL
# (definidos en 01_procedures.sql), sin SQL explícito en la API.

@app.route('/admin/veterinarios', methods=['GET'])
def admin_get_veterinarios():
    data = request.get_json() or {}
    rol = data.get('rol')
    if rol != 'rol_admin':
        return jsonify({'error': 'No autorizado'}), 403
    try:
        conn = get_db_connection(rol)
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM admin_listar_veterinarios();")
        resultados = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify(resultados)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/admin/veterinarios', methods=['POST'])
def admin_create_veterinario():
    data = request.get_json()
    rol = data.get('rol')
    if rol != 'rol_admin':
        return jsonify({'error': 'No autorizado'}), 403
    nombre = data.get('nombre')
    cedula = data.get('cedula')
    dias_descanso = data.get('dias_descanso', '')
    if not nombre or not cedula:
        return jsonify({'error': 'Faltan campos'}), 400
    try:
        conn = get_db_connection(rol)
        cur = conn.cursor()
        cur.execute("SELECT admin_crear_veterinario(%s, %s, %s);", (nombre, cedula, dias_descanso))
        new_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'message': 'Veterinario creado', 'id': new_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/admin/veterinarios/<int:vet_id>', methods=['PUT'])
def admin_update_veterinario(vet_id):
    data = request.get_json()
    rol = data.get('rol')
    if rol != 'rol_admin':
        return jsonify({'error': 'No autorizado'}), 403
    nombre = data.get('nombre')
    cedula = data.get('cedula')
    dias_descanso = data.get('dias_descanso')
    activo = data.get('activo')
    try:
        conn = get_db_connection(rol)
        cur = conn.cursor()
        cur.execute("SELECT admin_actualizar_veterinario(%s, %s, %s, %s, %s);",
                    (vet_id, nombre, cedula, dias_descanso, activo))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'message': 'Veterinario actualizado'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/admin/veterinarios/<int:vet_id>', methods=['DELETE'])
def admin_delete_veterinario(vet_id):
    data = request.get_json() or {}
    rol = data.get('rol')
    if rol != 'rol_admin':
        return jsonify({'error': 'No autorizado'}), 403
    try:
        conn = get_db_connection(rol)
        cur = conn.cursor()
        cur.execute("SELECT admin_eliminar_veterinario(%s);", (vet_id,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'message': 'Veterinario eliminado'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/admin/asignaciones', methods=['GET'])
def admin_get_asignaciones():
    data = request.get_json() or {}
    rol = data.get('rol')
    if rol != 'rol_admin':
        return jsonify({'error': 'No autorizado'}), 403
    try:
        conn = get_db_connection(rol)
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM admin_listar_asignaciones();")
        resultados = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify(resultados)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/admin/asignar', methods=['POST'])
def admin_asignar_mascota():
    data = request.get_json()
    rol = data.get('rol')
    if rol != 'rol_admin':
        return jsonify({'error': 'No autorizado'}), 403
    vet_id = data.get('vet_id')
    mascota_id = data.get('mascota_id')
    if not vet_id or not mascota_id:
        return jsonify({'error': 'Faltan vet_id o mascota_id'}), 400
    try:
        conn = get_db_connection(rol)
        cur = conn.cursor()
        cur.execute("SELECT admin_asignar_mascota(%s, %s);", (vet_id, mascota_id))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'message': 'Mascota asignada al veterinario'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/admin/desasignar', methods=['POST'])
def admin_desasignar_mascota():
    data = request.get_json()
    rol = data.get('rol')
    if rol != 'rol_admin':
        return jsonify({'error': 'No autorizado'}), 403
    asignacion_id = data.get('asignacion_id')
    if not asignacion_id:
        return jsonify({'error': 'Falta asignacion_id'}), 400
    try:
        conn = get_db_connection(rol)
        cur = conn.cursor()
        cur.execute("SELECT admin_desasignar_mascota(%s);", (asignacion_id,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'message': 'Asignación eliminada'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/admin/inventario', methods=['GET'])
def admin_get_inventario():
    data = request.get_json() or {}
    rol = data.get('rol')
    if rol != 'rol_admin':
        return jsonify({'error': 'No autorizado'}), 403
    try:
        conn = get_db_connection(rol)
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM admin_listar_inventario();")
        resultados = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify(resultados)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/admin/inventario', methods=['POST'])
def admin_create_vacuna():
    data = request.get_json()
    rol = data.get('rol')
    if rol != 'rol_admin':
        return jsonify({'error': 'No autorizado'}), 403
    nombre = data.get('nombre')
    stock_actual = data.get('stock_actual', 0)
    stock_minimo = data.get('stock_minimo', 5)
    costo_unitario = data.get('costo_unitario')
    if not nombre or not costo_unitario:
        return jsonify({'error': 'Faltan campos'}), 400
    try:
        conn = get_db_connection(rol)
        cur = conn.cursor()
        cur.execute("SELECT admin_crear_vacuna(%s, %s, %s, %s);", (nombre, stock_actual, stock_minimo, costo_unitario))
        new_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'message': 'Vacuna creada', 'id': new_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/admin/inventario/<int:vacuna_id>', methods=['PUT'])
def admin_update_vacuna(vacuna_id):
    data = request.get_json()
    rol = data.get('rol')
    if rol != 'rol_admin':
        return jsonify({'error': 'No autorizado'}), 403
    nombre = data.get('nombre')
    stock_actual = data.get('stock_actual')
    stock_minimo = data.get('stock_minimo')
    costo_unitario = data.get('costo_unitario')
    try:
        conn = get_db_connection(rol)
        cur = conn.cursor()
        cur.execute("SELECT admin_actualizar_vacuna(%s, %s, %s, %s, %s);",
                    (vacuna_id, nombre, stock_actual, stock_minimo, costo_unitario))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'message': 'Vacuna actualizada'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/admin/inventario/<int:vacuna_id>', methods=['DELETE'])
def admin_delete_vacuna(vacuna_id):
    data = request.get_json() or {}
    rol = data.get('rol')
    if rol != 'rol_admin':
        return jsonify({'error': 'No autorizado'}), 403
    try:
        conn = get_db_connection(rol)
        cur = conn.cursor()
        cur.execute("SELECT admin_eliminar_vacuna(%s);", (vacuna_id,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'message': 'Vacuna eliminada'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)