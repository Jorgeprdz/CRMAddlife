import { DB } from './db.js';

let idEdicionActual = null;

export function renderCartera() {
    return `
        <div class="card" style="border-left: 4px solid var(--accent); margin-bottom: 20px;">
            <h2 style="font-size: 16px; margin-bottom: 12px;">📊 Resumen de Cartera</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div style="background: var(--surface-2); padding: 12px; border-radius: 12px; border: 1px solid var(--separator);">
                    <span style="font-size: 11px; color: var(--text-secondary); font-weight: 600; text-transform: uppercase;">Total Pólizas</span><br>
                    <strong id="kpi-total-polizas" style="font-size: 18px; color: var(--text-primary);">0</strong>
                </div>
                <div style="background: var(--surface-2); padding: 12px; border-radius: 12px; border: 1px solid var(--separator);">
                    <span style="font-size: 11px; color: var(--text-secondary); font-weight: 600; text-transform: uppercase;">Prima Anualizada</span><br>
                    <strong id="kpi-prima-total" style="font-size: 18px; color: var(--success);">$0.00</strong>
                </div>
            </div>
        </div>

        <div class="card">
            <h2 id="formulario-titulo" style="font-size:16px; margin-bottom:12px;">Alta de Póliza</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <input id="c-cliente" placeholder="Nombre del Cliente" style="grid-column: span 2;">
                
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <label style="font-size: 11px; color: var(--text-secondary);">Fecha Nacimiento</label>
                    <input id="c-nacimiento" type="date">
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <label style="font-size: 11px; color: var(--text-secondary);">Fecha Emisión</label>
                    <input id="c-emision" type="date">
                </div>

                <input id="c-poliza" placeholder="Número de Póliza" style="grid-column: span 2;">
                
                <select id="c-plan">
                    <option value="">Producto específico...</option>
                    <optgroup label="Seguros de Vida">
                        <option value="Star Temporal">Star Temporal</option>
                        <option value="Orvi">Orvi 99</option>
                        <option value="Respaldo Educativo">Respaldo Educativo / Segubeca</option>
                        <option value="Respaldo Negocio">Respaldo Negocio</option>
                        <option value="Mio">Mío</option>
                        <option value="Imagina Ser">Imagina Ser / Objetivo Vida</option>
                        <option value="Plenitud">Nuevo Plenitud</option>
                        <option value="Vida Mujer">Vida Mujer</option>
                    </optgroup>
                    <optgroup label="Gastos Médicos Mayores">
                        <option value="Alfa Medical">Alfa Medical</option>
                        <option value="Alfa Medical Flex">Alfa Medical Flex</option>
                        <option value="Alfa Medical Internacional">Alfa Medical Internacional</option>
                    </optgroup>
                </select>

                <select id="c-variante">
                    <option value="">Variante / Plazo...</option>
                    <option value="10">10 Años / Pagos 10</option>
                    <option value="20">20 Años / Pagos 20</option>
                    <option value="Nivelado">Nivelado / >20 Años</option>
                    <option value="Edad 65">Edad 65</option>
                    <option value="Unica">Prima Única</option>
                </select>

                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <label style="font-size: 11px; color: var(--text-secondary);">Edad al contratar (Solo GMM)</label>
                    <input id="c-edad-gmm" type="number" placeholder="Ej. 35">
                </div>

                <select id="c-moneda">
                    <option value="MXN">MXN - Pesos</option>
                    <option value="USD">USD - Dólares</option>
                    <option value="UDIS">UDIS</option>
                </select>

                <select id="c-forma-pago">
                    <option value="">Forma de Pago...</option>
                    <option value="Mensual">Mensual</option>
                    <option value="Trimestral">Trimestral</option>
                    <option value="Semestral">Semestral</option>
                    <option value="Anual">Anual</option>
                </select>

                <select id="c-cobro">
                    <option value="">Conducto...</option>
                    <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
                    <option value="Tarjeta de Débito">Tarjeta de Débito</option>
                    <option value="Pago Ventanilla / Transferencia">Transferencia</option>
                </select>

                <input id="c-prima" type="number" placeholder="Prima Neta">
                <input id="c-suma" type="number" placeholder="Suma Asegurada">
                
                <div style="display: flex; flex-direction: column; gap: 4px; grid-column: span 2;">
                    <label style="font-size: 11px; color: var(--text-secondary);">Próxima Fecha de Pago</label>
                    <input id="c-fecha" type="date">
                </div>

                <button id="btn-guardar-cartera" class="btn-primary" style="grid-column: span 2; margin-top: 10px;">💾 Guardar Póliza</button>
                <button id="btn-cancelar-edicion" class="btn-secondary" style="grid-column: span 2; display: none;">❌ Cancelar Edición</button>
            </div>
        </div>

        <div class="card">
            <h2 style="font-size:16px;">Cartera Vigente y Renovaciones</h2>
            <div id="lista-cartera-container" style="display: flex; flex-direction: column; gap: 12px; margin-top: 15px;">
                <div style="text-align: center; color: var(--text-tertiary); padding: 10px;">Cargando registros...</div>
            </div>
        </div>
    `;
}

export async function bindCarteraEvents() {
    const btnGuardar = document.getElementById('btn-guardar-cartera');
    const btnCancelar = document.getElementById('btn-cancelar-edicion');
    if (btnGuardar) btnGuardar.addEventListener('click', guardarOActualizarPoliza);
    if (btnCancelar) btnCancelar.addEventListener('click', limpiarFormularioCartera);
    await actualizarListadoCartera();
}

async function guardarOActualizarPoliza() {
    const datosPoliza = {
        cliente: document.getElementById('c-cliente').value.trim(),
        nacimiento: document.getElementById('c-nacimiento').value,
        emision: document.getElementById('c-emision').value,
        poliza: document.getElementById('c-poliza').value.trim(),
        plan: document.getElementById('c-plan').value,
        variante: document.getElementById('c-variante').value,
        edadGmm: document.getElementById('c-edad-gmm').value,
        moneda: document.getElementById('c-moneda').value,
        formaPago: document.getElementById('c-forma-pago').value,
        conductoCobro: document.getElementById('c-cobro').value,
        prima: Number(document.getElementById('c-prima').value) || 0,
        suma: Number(document.getElementById('c-suma').value) || 0,
        fechaPago: document.getElementById('c-fecha').value
    };

    if (!datosPoliza.cliente || !datosPoliza.poliza || !datosPoliza.fechaPago || !datosPoliza.emision) {
        alert('Faltan datos obligatorios (Cliente, Póliza, Emisión o Fecha de Pago).');
        return;
    }

    try {
        if (idEdicionActual) {
            await DB.actualizar('cartera', idEdicionActual, datosPoliza);
        } else {
            datosPoliza.id = 'pol_' + Date.now();
            await DB.guardar('cartera', datosPoliza);
        }
        limpiarFormularioCartera();
        await actualizarListadoCartera();
    } catch (err) {
        console.error(err);
    }
}

window.cargarPolizaParaEditar = async (id) => {
    const listado = await DB.obtenerTodos('cartera');
    const p = listado.find(x => x.id === id);
    if (!p) return;

    idEdicionActual = id;
    document.getElementById('formulario-titulo').innerText = '✏️ Editando Póliza';
    document.getElementById('c-cliente').value = p.cliente || '';
    document.getElementById('c-nacimiento').value = p.nacimiento || '';
    document.getElementById('c-emision').value = p.emision || '';
    document.getElementById('c-poliza').value = p.poliza || '';
    document.getElementById('c-plan').value = p.plan || '';
    document.getElementById('c-variante').value = p.variante || '';
    document.getElementById('c-edad-gmm').value = p.edadGmm || '';
    document.getElementById('c-moneda').value = p.moneda || 'MXN';
    document.getElementById('c-forma-pago').value = p.formaPago || '';
    document.getElementById('c-cobro').value = p.conductoCobro || '';
    document.getElementById('c-prima').value = p.prima || '';
    document.getElementById('c-suma').value = p.suma || '';
    document.getElementById('c-fecha').value = p.fechaPago || '';

    document.getElementById('btn-guardar-cartera').innerText = '🔄 Actualizar';
    document.getElementById('btn-cancelar-edicion').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

function limpiarFormularioCartera() {
    idEdicionActual = null;
    document.getElementById('formulario-titulo').innerText = 'Alta de Póliza';
    ['c-cliente', 'c-nacimiento', 'c-emision', 'c-poliza', 'c-plan', 'c-variante', 'c-edad-gmm', 'c-forma-pago', 'c-cobro', 'c-prima', 'c-suma', 'c-fecha'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('c-moneda').value = 'MXN';
    document.getElementById('btn-guardar-cartera').innerText = '💾 Guardar Póliza';
    document.getElementById('btn-cancelar-edicion').style.display = 'none';
}

async function actualizarListadoCartera() {
    const container = document.getElementById('lista-cartera-container');
    if (!container) return;

    const listado = await DB.obtenerTodos('cartera');
    const formatearDinero = (num) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num);

    document.getElementById('kpi-total-polizas').innerText = listado.length;
    document.getElementById('kpi-prima-total').innerText = formatearDinero(listado.reduce((acum, p) => acum + (Number(p.prima) || 0), 0));

    if (listado.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 15px;">No hay registros.</div>`;
        return;
    }

    const hoy = new Date();
    container.innerHTML = listado.map(p => {
        const fPago = new Date(p.fechaPago + 'T12:00:00');
        const diffDias = Math.ceil((fPago - hoy) / 86400000);
        
        let badgeStyle = 'badge-blue';
        let alertaIcono = '🟢';
        if (diffDias < 0) { badgeStyle = 'badge-red'; alertaIcono = '🚨 Vencida'; }
        else if (diffDias <= 15) { badgeStyle = 'badge-orange'; alertaIcono = '⚠️ Por vencer'; }

        return `
            <div style="background: var(--surface-2); padding: 16px; border-radius: 16px; display: flex; flex-direction: column; gap: 8px; border: 1px solid var(--separator);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <h3 style="margin: 0; font-size: 15px; color: var(--text-primary);">${p.cliente}</h3>
                        <span style="font-size: 12px; color: var(--text-secondary);">Póliza: <strong>${p.poliza}</strong> | ${p.plan}</span>
                    </div>
                    <span class="badge ${badgeStyle}">${alertaIcono} (${p.fechaPago})</span>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 13px; background: var(--surface); padding: 10px; border-radius: 12px; border: 1px solid var(--separator); color: var(--text-primary);">
                    <div><span style="color: var(--text-secondary); font-size: 11px;">Prima Anual:</span><br><strong>${formatearDinero(p.prima)} ${p.moneda}</strong></div>
                    <div><span style="color: var(--text-secondary); font-size: 11px;">Forma Pago:</span><br><strong>${p.formaPago}</strong></div>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
                    <button onclick="registrarPagoRenovacion('${p.id}')" class="btn-primary" style="padding: 6px 12px !important; font-size: 12px; background: var(--success) !important;">✅ Registrar Pago</button>
                    <button onclick="cargarPolizaParaEditar('${p.id}')" class="btn-secondary" style="padding: 6px 12px !important; font-size: 12px;">✏️ Editar</button>
                </div>
            </div>
        `;
    }).join('');
}

window.registrarPagoRenovacion = async (id) => {
    const listado = await DB.obtenerTodos('cartera');
    const poliza = listado.find(p => p.id === id);
    if (!poliza) return;

    const montoReal = prompt(`Confirma el monto exacto cobrado para ${poliza.cliente} (Prima capturada: ${poliza.prima}):`, poliza.prima);
    if (montoReal === null) return;

    const fechaActual = new Date(poliza.fechaPago + 'T12:00:00');
    if (poliza.formaPago === 'Mensual') fechaActual.setMonth(fechaActual.getMonth() + 1);
    else if (poliza.formaPago === 'Trimestral') fechaActual.setMonth(fechaActual.getMonth() + 3);
    else if (poliza.formaPago === 'Semestral') fechaActual.setMonth(fechaActual.getMonth() + 6);
    else if (poliza.formaPago === 'Anual') fechaActual.setFullYear(fechaActual.getFullYear() + 1);

    const nuevaFechaStr = fechaActual.toISOString().split('T')[0];
    
    // Aquí en el futuro enlazaremos con el historial de cobros
    await DB.actualizar('cartera', id, { fechaPago: nuevaFechaStr, ultimoMontoPagado: Number(montoReal) });
    await actualizarListadoCartera();
    alert(`Pago registrado. Próximo vencimiento: ${nuevaFechaStr}`);
};
