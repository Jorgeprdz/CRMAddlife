import { DB } from './db.js';

export function renderCartera() {
    return `
        <div class="card">
            <h2>Alta de Póliza</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <input id="c-cliente" placeholder="Nombre del Cliente" style="grid-column: span 2;">
                <input id="c-poliza" placeholder="Número de Póliza">
                <select id="c-plan">
                    <option value="">Tipo de Plan...</option>
                    <option value="Vida">Vida</option>
                    <option value="Retiro">Retiro</option>
                    <option value="Gastos Médicos Mayores">Gastos Médicos Mayores</option>
                    <option value="Ahorro">Ahorro / Educación</option>
                </select>
                
                <select id="c-forma-pago">
                    <option value="">Forma de Pago...</option>
                    <option value="Mensual">Mensual</option>
                    <option value="Trimestral">Trimestral</option>
                    <option value="Semestral">Semestral</option>
                    <option value="Anual">Anual</option>
                </select>
                <select id="c-cobro">
                    <option value="">Conducto de Cobro...</option>
                    <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
                    <option value="Tarjeta de Débito">Tarjeta de Débito</option>
                    <option value="Pago Directo">Pago Directo (Ficha)</option>
                </select>
                
                <input id="c-prima" type="number" placeholder="Prima Anualizada ($ MXN)">
                <input id="c-suma" type="number" placeholder="Suma Asegurada ($)">
                
                <div style="grid-column: span 2;">
                    <label style="font-size: 12px; color: #8E8E93; font-weight: bold;">FECHA DEL PRÓXIMO PAGO:</label>
                    <input type="date" id="c-fecha" style="width: 100%; margin-top: 5px;">
                </div>
            </div>
            <button id="btn-guardar-poliza" class="btn-primary" style="margin-top: 15px; background: #007AFF;">💾 Guardar Póliza</button>
        </div>

        <div class="card" style="background: #1C1C1E; color: white;">
            <h2 style="color: white; margin-bottom: 15px;">Dashboard de Cobranza</h2>
            <div id="dashboard-semaforo" style="display: grid; gap: 10px;"></div>
        </div>

        <div class="card">
            <h2>Directorio de Clientes</h2>
            <div style="display: flex; gap: 8px; margin-bottom: 15px; flex-wrap: wrap;">
                <input id="filtro-cliente" placeholder="🔍 Buscar cliente o póliza..." style="flex: 2; min-width: 150px; padding: 10px; border-radius: 8px; border: 1px solid #E5E5EA;">
                <select id="filtro-estado" style="flex: 1; padding: 10px; border-radius: 8px; border: 1px solid #E5E5EA; font-weight: bold;">
                    <option value="Todos">Todos los Estados</option>
                    <option value="Rojo">🔴 Vencidas</option>
                    <option value="Naranja">🟠 Próximos 30 días</option>
                    <option value="Amarillo">🟡 Próximos 60 días</option>
                    <option value="Verde">🟢 Al corriente</option>
                </select>
            </div>
            <div id="lista-cartera" style="display: grid; gap: 12px;"></div>
        </div>
    `;
}

export async function bindCarteraEvents() {
    await window.renderListasCartera();

    const btnGuardar = document.getElementById('btn-guardar-poliza');
    btnGuardar.replaceWith(btnGuardar.cloneNode(true));
    
    document.getElementById('btn-guardar-poliza').addEventListener('click', async () => {
        const cliente = document.getElementById('c-cliente').value;
        const poliza = document.getElementById('c-poliza').value;
        const fecha = document.getElementById('c-fecha').value;
        
        if (!cliente || !poliza || !fecha) return alert("Cliente, Póliza y Fecha de Próximo Pago son obligatorios.");

        const nuevaPoliza = {
            id: Date.now().toString(),
            cliente,
            poliza,
            plan: document.getElementById('c-plan').value,
            formaPago: document.getElementById('c-forma-pago').value,
            conductoCobro: document.getElementById('c-cobro').value,
            prima: parseFloat(document.getElementById('c-prima').value) || 0,
            suma: parseFloat(document.getElementById('c-suma').value) || 0,
            fechaPago: fecha
        };

        await DB.guardar('cartera', nuevaPoliza);
        
        // Limpiar
        document.querySelectorAll('input').forEach(i => i.value = '');
        document.querySelectorAll('select').forEach(s => s.selectedIndex = 0);
        
        await window.renderListasCartera();
        alert("Póliza guardada en cartera.");
    });

    document.getElementById('filtro-cliente').addEventListener('input', window.renderListasCartera);
    document.getElementById('filtro-estado').addEventListener('change', window.renderListasCartera);
}

// Analizador de fechas para semáforo
function evaluarSemaforo(fechaString) {
    const hoy = new Date();
    hoy.setHours(0,0,0,0);
    const fPago = new Date(fechaString + 'T12:00:00');
    const diasDiferencia = Math.ceil((fPago - hoy) / (1000 * 60 * 60 * 24));

    if (diasDiferencia < 0) return { estado: 'Rojo', color: '#FF3B30', bg: '#FFEBEA', icon: '🔴', texto: `Vencida hace ${Math.abs(diasDiferencia)} días` };
    if (diasDiferencia <= 30) return { estado: 'Naranja', color: '#FF9500', bg: '#FFF5E5', icon: '🟠', texto: `Pago en ${diasDiferencia} días` };
    if (diasDiferencia <= 60) return { estado: 'Amarillo', color: '#FFCC00', bg: '#FFFBEA', icon: '🟡', texto: `Pago en ${diasDiferencia} días` };
    return { estado: 'Verde', color: '#34C759', bg: '#E5FDEB', icon: '🟢', texto: `Pago cubierto (${diasDiferencia} días)` };
}

const formatearDinero = (cant) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(cant);

window.renderListasCartera = async () => {
    const db = await DB.obtenerTodos('cartera');
    
    // 1. Render Dashboard Semáforo (Prioridad: Rojo y Naranja)
    const dashboard = document.getElementById('dashboard-semaforo');
    const criticos = db.map(p => ({ ...p, semaforo: evaluarSemaforo(p.fechaPago) }))
                       .filter(p => p.semaforo.estado === 'Rojo' || p.semaforo.estado === 'Naranja')
                       .sort((a,b) => new Date(a.fechaPago) - new Date(b.fechaPago));

    if(criticos.length === 0) {
        dashboard.innerHTML = `<div style="text-align: center; color: #34C759; padding: 10px;">🟢 ¡Excelente! No hay pagos vencidos ni próximos a vencer.</div>`;
    } else {
        dashboard.innerHTML = criticos.map(p => `
            <div style="background: ${p.semaforo.bg}; border-left: 5px solid ${p.semaforo.color}; padding: 12px; border-radius: 8px; color: #1C1C1E; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h4 style="margin: 0; font-size: 14px;">${p.cliente}</h4>
                    <span style="font-size: 11px; font-weight: bold; color: ${p.semaforo.color};">${p.semaforo.icon} ${p.semaforo.texto}</span>
                </div>
                <div style="text-align: right;">
                    <span style="font-size: 12px; display: block; color: #666;">${p.formaPago} - ${p.conductoCobro}</span>
                    <button onclick="window.open('https://wa.me/?text=${encodeURIComponent(`Hola ${p.cliente}, te recuerdo que el pago de tu póliza ${p.poliza} está próximo/vencido. Quedo a tus órdenes.`)}')"" style="background: #25D366; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; margin-top: 4px;">📲 Cobrar WA</button>
                </div>
            </div>
        `).join('');
    }

    // 2. Render Lista General con Filtros
    const contenedorLista = document.getElementById('lista-cartera');
    const filtroTexto = document.getElementById('filtro-cliente').value.toLowerCase();
    const filtroEstado = document.getElementById('filtro-estado').value;

    let filtrados = db.map(p => ({ ...p, semaforo: evaluarSemaforo(p.fechaPago) }));

    if (filtroTexto) {
        filtrados = filtrados.filter(p => p.cliente.toLowerCase().includes(filtroTexto) || p.poliza.toLowerCase().includes(filtroTexto));
    }
    if (filtroEstado !== 'Todos') {
        filtrados = filtrados.filter(p => p.semaforo.estado === filtroEstado);
    }

    if (filtrados.length === 0) {
        contenedorLista.innerHTML = `<p style="text-align:center; color:gray;">No se encontraron pólizas.</p>`;
        return;
    }

    contenedorLista.innerHTML = filtrados.sort((a,b) => new Date(a.fechaPago) - new Date(b.fechaPago)).map(p => `
        <div style="background: #F9F9FB; border: 1px solid #E5E5EA; border-radius: 12px; padding: 15px; display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <h3 style="margin: 0; font-size: 16px; color: #1C1C1E;">${p.cliente}</h3>
                    <span style="font-size: 12px; color: #007AFF; font-weight: bold;">Pol: ${p.poliza} | ${p.plan || 'N/A'}</span>
                </div>
                <span style="background: ${p.semaforo.bg}; color: ${p.semaforo.color}; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; border: 1px solid ${p.semaforo.color}40;">
                    ${p.semaforo.icon} ${p.fechaPago}
                </span>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; font-size: 12px; color: #48484A; background: #fff; padding: 8px; border-radius: 6px; border: 1px dashed #ccc;">
                <div><strong>Prima Anual:</strong><br>${formatearDinero(p.prima)}</div>
                <div><strong>Suma Asegurada:</strong><br>${formatearDinero(p.suma)}</div>
                <div style="margin-top: 5px;"><strong>Forma:</strong><br>${p.formaPago}</div>
                <div style="margin-top: 5px;"><strong>Cobro:</strong><br>${p.conductoCobro}</div>
            </div>
            
            <div style="display: flex; justify-content: flex-end; margin-top: 5px;">
                <button onclick="eliminarPolizaDobleCheck('${p.id}')" style="background: transparent; color: #FF3B30; border: 1px solid #FF3B30; border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: bold;">🗑️ Eliminar Registro</button>
            </div>
        </div>
    `).join('');
};

window.eliminarPolizaDobleCheck = async (id) => {
    // Primer Check
    if (confirm("¿Deseas eliminar esta póliza de tu cartera?")) {
        // Segundo Check (Seguridad estricta)
        if (confirm("⚠️ ADVERTENCIA: Esta acción es irreversible y borrará el registro financiero. ¿Confirmas que deseas proceder?")) {
            await DB.eliminar('cartera', id);
            await window.renderListasCartera();
        }
    }
};
