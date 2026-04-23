let currentRol = null;
let currentVetId = null;

// Mostrar/ocultar campo ID veterinario según rol
document.getElementById('rolSelect').onchange = () => {
    const rol = document.getElementById('rolSelect').value;
    const vetGroup = document.getElementById('vetIdGroup');
    vetGroup.style.display = rol === 'rol_veterinario' ? 'block' : 'none';
};
document.getElementById('vetIdGroup').style.display = 'none'; // inicio oculto

// Login
document.getElementById('loginBtn').onclick = async () => {
    const rol = document.getElementById('rolSelect').value;
    const vetId = parseInt(document.getElementById('veterinarioId').value);
    const res = await fetch('http://localhost:5000/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({rol, veterinario_id: vetId})
    });
    const data = await res.json();
    currentRol = data.rol;
    currentVetId = data.veterinario_id;

    document.getElementById('loginPanel').style.display = 'none';
    document.getElementById('busquedaPanel').style.display = 'block';

    // Mostrar paneles según rol
    if (currentRol === 'rol_veterinario' || currentRol === 'rol_admin') {
        document.getElementById('vacunacionPanel').style.display = 'block';
    } else {
        document.getElementById('vacunacionPanel').style.display = 'none';
    }
    if (currentRol === 'rol_veterinario') {
        document.getElementById('vacunaPanel').style.display = 'block';
        cargarMascotasSelect();
        cargarVacunasSelect();
    } else {
        document.getElementById('vacunaPanel').style.display = 'none';
    }
    if (currentRol === 'rol_admin') {
        document.getElementById('adminPanel').style.display = 'block';
        cargarAdminData();
    } else {
        document.getElementById('adminPanel').style.display = 'none';
    }
};

// Logout
document.getElementById('logoutBtn').onclick = () => {
    currentRol = null;
    currentVetId = null;
    document.getElementById('loginPanel').style.display = 'block';
    document.getElementById('busquedaPanel').style.display = 'none';
    document.getElementById('vacunacionPanel').style.display = 'none';
    document.getElementById('vacunaPanel').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('resultadosBusqueda').innerHTML = '';
    document.getElementById('resultadosVacunacion').innerHTML = '';
    document.getElementById('terminoBusqueda').value = '';
};

// Búsqueda de mascotas
document.getElementById('buscarBtn').onclick = async () => {
    const termino = document.getElementById('terminoBusqueda').value;
    const res = await fetch('http://localhost:5000/buscar_mascotas', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({rol: currentRol, veterinario_id: currentVetId, termino})
    });
    const data = await res.json();
    const div = document.getElementById('resultadosBusqueda');
    if (data.error) div.innerHTML = `<p style="color:red">${data.error}</p>`;
    else div.innerHTML = `<ul>${data.map(m => `<li>${m.nombre} (${m.especie})</li>`).join('')}</ul>`;
};

// Vacunación pendiente
document.getElementById('cargarVacunacionBtn').onclick = async () => {
    const res = await fetch('http://localhost:5000/vacunacion_pendiente', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({rol: currentRol, veterinario_id: currentVetId})
    });
    const data = await res.json();
    const div = document.getElementById('resultadosVacunacion');
    if (data.error) div.innerHTML = `<p style="color:red">${data.error}</p>`;
    else if (data.length === 0) div.innerHTML = '<p>No hay vacunaciones pendientes.</p>';
    else {
        let html = '<table border="1"><tr><th>Mascota</th><th>Dueño</th><th>Última vacuna</th><th>Fecha última</th><th>Días desde</th></tr>';
        data.forEach(m => {
            html += `<tr>
                        <td>${m.mascota_nombre}</td>
                        <td>${m.dueno_nombre}</td>
                        <td>${m.ultima_vacuna || 'Ninguna'}</td>
                        <td>${m.ultima_fecha || 'N/A'}</td>
                        <td>${m.dias_desde_ultima || 'N/A'}</td>
                     </tr>`;
        });
        html += '</table>';
        div.innerHTML = html;
    }
};

// Cargar mascotas del veterinario (para el select de aplicar vacuna)
async function cargarMascotasSelect() {
    const res = await fetch('http://localhost:5000/buscar_mascotas', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({rol: currentRol, veterinario_id: currentVetId, termino: ''})
    });
    const data = await res.json();
    const select = document.getElementById('selectMascota');
    select.innerHTML = '';
    if (!data.error && data.length) {
        data.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = `${m.nombre} (${m.especie}) - ID:${m.id}`;
            select.appendChild(opt);
        });
    } else {
        select.innerHTML = '<option>Sin mascotas asignadas</option>';
    }
}

async function cargarVacunasSelect() {
    const res = await fetch('http://localhost:5000/vacunas');
    const data = await res.json();
    const select = document.getElementById('selectVacuna');
    select.innerHTML = '';
    if (!data.error && data.length) {
        data.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.id;
            opt.textContent = `${v.nombre} (Stock: ${v.stock_actual}) - ID:${v.id}`;
            select.appendChild(opt);
        });
    } else {
        select.innerHTML = '<option>Error cargando vacunas</option>';
    }
}

// Aplicar vacuna
document.getElementById('aplicarVacunaBtn').onclick = async () => {
    const mascotaId = document.getElementById('selectMascota').value;
    const vacunaId = document.getElementById('selectVacuna').value;
    const res = await fetch('http://localhost:5000/aplicar_vacuna', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            rol: currentRol,
            veterinario_id: currentVetId,
            mascota_id: parseInt(mascotaId),
            vacuna_id: parseInt(vacunaId)
        })
    });
    const data = await res.json();
    document.getElementById('resultadoVacuna').innerHTML = `<p>${data.message || data.error}</p>`;
    if (!data.error) {
        cargarMascotasSelect();
        document.getElementById('cargarVacunacionBtn').click();
    }
};

// ==================== ADMINISTRACIÓN ====================

async function cargarAdminData() {
    await cargarVeterinarios();
    await cargarAsignaciones();
    await cargarInventario();
}

async function cargarVeterinarios() {
    const res = await fetch('http://localhost:5000/admin/veterinarios', {
        method: 'GET',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({rol: currentRol})
    });
    const data = await res.json();
    const div = document.getElementById('listaVeterinarios');
    if (data.error) div.innerHTML = `<p style="color:red">${data.error}</p>`;
    else {
        let html = '<ul>';
        data.forEach(v => {
            html += `<li>ID:${v.id} - ${v.nombre} (${v.cedula}) - Días descanso: ${v.dias_descanso || 'ninguno'} - Activo:${v.activo}
                     <button onclick="editarVeterinario(${v.id})">Editar</button>
                     <button onclick="eliminarVeterinario(${v.id})">Eliminar</button></li>`;
        });
        html += '</ul>';
        div.innerHTML = html;
    }
}

async function cargarAsignaciones() {
    const res = await fetch('http://localhost:5000/admin/asignaciones', {
        method: 'GET',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({rol: currentRol})
    });
    const data = await res.json();
    const div = document.getElementById('listaAsignaciones');
    if (data.error) div.innerHTML = `<p style="color:red">${data.error}</p>`;
    else {
        let html = '<ul>';
        data.forEach(a => {
            html += `<li>ID Asignación:${a.id} - Vet:${a.vet_nombre} (ID ${a.vet_id}) → Mascota:${a.mascota_nombre} (ID ${a.mascota_id})
                     <button onclick="eliminarAsignacion(${a.id})">Desasignar</button></li>`;
        });
        html += '</ul>';
        div.innerHTML = html;
    }
}

async function cargarInventario() {
    const res = await fetch('http://localhost:5000/admin/inventario', {
        method: 'GET',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({rol: currentRol})
    });
    const data = await res.json();
    const div = document.getElementById('listaInventario');
    if (data.error) div.innerHTML = `<p style="color:red">${data.error}</p>`;
    else {
        let html = '<ul>';
        data.forEach(v => {
            html += `<li>ID:${v.id} - ${v.nombre} | Stock:${v.stock_actual} | Mínimo:${v.stock_minimo} | Costo:$${v.costo_unitario}
                     <button onclick="editarVacuna(${v.id})">Editar</button>
                     <button onclick="eliminarVacuna(${v.id})">Eliminar</button></li>`;
        });
        html += '</ul>';
        div.innerHTML = html;
    }
}

// Veterinario: crear
document.getElementById('formVeterinario').onsubmit = async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('vetNombre').value;
    const cedula = document.getElementById('vetCedula').value;
    const dias_descanso = document.getElementById('vetDescanso').value;
    const res = await fetch('http://localhost:5000/admin/veterinarios', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({rol: currentRol, nombre, cedula, dias_descanso})
    });
    const data = await res.json();
    alert(data.message || data.error);
    if (!data.error) {
        document.getElementById('vetNombre').value = '';
        document.getElementById('vetCedula').value = '';
        document.getElementById('vetDescanso').value = '';
        cargarVeterinarios();
    }
};

// Editar veterinario (prompt simple)
window.editarVeterinario = async (id) => {
    const nuevoNombre = prompt('Nuevo nombre (dejar vacío para no cambiar)');
    const nuevaCedula = prompt('Nueva cédula');
    const nuevoDescanso = prompt('Nuevos días de descanso (ej: lunes,jueves)');
    const activo = confirm('¿Activo? (Aceptar=Sí, Cancelar=No)');
    const res = await fetch(`http://localhost:5000/admin/veterinarios/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            rol: currentRol,
            nombre: nuevoNombre || null,
            cedula: nuevaCedula || null,
            dias_descanso: nuevoDescanso || null,
            activo: activo
        })
    });
    const data = await res.json();
    alert(data.message || data.error);
    cargarVeterinarios();
};

window.eliminarVeterinario = async (id) => {
    if (!confirm('¿Eliminar veterinario?')) return;
    const res = await fetch(`http://localhost:5000/admin/veterinarios/${id}`, {
        method: 'DELETE',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({rol: currentRol})
    });
    const data = await res.json();
    alert(data.message || data.error);
    cargarVeterinarios();
};

// Asignaciones
document.getElementById('formAsignacion').onsubmit = async (e) => {
    e.preventDefault();
    const vet_id = document.getElementById('asignarVetId').value;
    const mascota_id = document.getElementById('asignarMascotaId').value;
    const res = await fetch('http://localhost:5000/admin/asignar', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({rol: currentRol, vet_id, mascota_id})
    });
    const data = await res.json();
    alert(data.message || data.error);
    if (!data.error) {
        document.getElementById('asignarVetId').value = '';
        document.getElementById('asignarMascotaId').value = '';
        cargarAsignaciones();
    }
};

window.eliminarAsignacion = async (asignacion_id) => {
    if (!confirm('¿Desasignar esta mascota?')) return;
    const res = await fetch('http://localhost:5000/admin/desasignar', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({rol: currentRol, asignacion_id})
    });
    const data = await res.json();
    alert(data.message || data.error);
    cargarAsignaciones();
};

// Inventario de vacunas
document.getElementById('formVacuna').onsubmit = async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('vacunaNombre').value;
    const stock_actual = parseInt(document.getElementById('vacunaStock').value);
    const stock_minimo = parseInt(document.getElementById('vacunaMinimo').value);
    const costo_unitario = parseFloat(document.getElementById('vacunaCosto').value);
    const res = await fetch('http://localhost:5000/admin/inventario', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({rol: currentRol, nombre, stock_actual, stock_minimo, costo_unitario})
    });
    const data = await res.json();
    alert(data.message || data.error);
    if (!data.error) {
        document.getElementById('vacunaNombre').value = '';
        document.getElementById('vacunaStock').value = '0';
        document.getElementById('vacunaMinimo').value = '5';
        document.getElementById('vacunaCosto').value = '';
        cargarInventario();
    }
};

window.editarVacuna = async (id) => {
    const nombre = prompt('Nuevo nombre');
    const stock = prompt('Nuevo stock actual');
    const minimo = prompt('Nuevo stock mínimo');
    const costo = prompt('Nuevo costo unitario');
    const res = await fetch(`http://localhost:5000/admin/inventario/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            rol: currentRol,
            nombre: nombre || null,
            stock_actual: stock ? parseInt(stock) : null,
            stock_minimo: minimo ? parseInt(minimo) : null,
            costo_unitario: costo ? parseFloat(costo) : null
        })
    });
    const data = await res.json();
    alert(data.message || data.error);
    cargarInventario();
};

window.eliminarVacuna = async (id) => {
    if (!confirm('¿Eliminar vacuna?')) return;
    const res = await fetch(`http://localhost:5000/admin/inventario/${id}`, {
        method: 'DELETE',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({rol: currentRol})
    });
    const data = await res.json();
    alert(data.message || data.error);
    cargarInventario();
};