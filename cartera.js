// cartera.js - Módulo de Cartera 
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
                <div style="grid-column: span 2; background: var(--surface-2); padding: 12px; border-radius: 12px; border: 1px solid var(--separator); display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 12px; color: var(--text-secondary); font-weight: 500;">Cobranza crítica (vencida o < 30 días):</span>
                    <strong id="kpi-alertas" class="badge badge-orange" style="font-size: 13px;">0 pólizas</strong>
                </div>
            </div>
        </div>

        <div class="card">
            <h2 id="formulario-titulo" style="font-size:16px; margin-bottom:12px;">Alta de Póliza</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <input id="c-cliente" placeholder="Nombre del Cliente" style="grid-column: span 2;">
                
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <label style="font-size: 11px; color: var(--text-secondary);">Fecha de Nacimiento</label>
                    <input id="c-nacimiento" type="date">
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <label style="font-size: 11px; color: var(--text-secondary);">Fecha de Emisión</label>
                    <input id="c-emision" type="date">
                </div>

                <input id="c-poliza" placeholder="Número de Póliza" style="grid-column: span 2;">
                
                <select id="c-plan">
                    <option value="">Producto específico...</option>
                    <optgroup label="Seguros de Vida">
                        <option value="Star Temporal">Star Temporal</option>
                        <option value="Orvi">Orvi (Vida Entera)</option>
                        <option value="Respaldo Educativo">Respaldo Educativo / Segubeca</option>
                        <option value="Respaldo Negocio">Respaldo Negocio</option>
                        <option value="Mio">Mío (Protección / Ahorro)</option>
                        <option value="Imagina Ser">Imagina Ser / Objetivo Vida</option>
                        <option value="Plenitud">Plenitud</option>
                    </optgroup>
                    <optgroup label="Gastos Médicos Mayores">
                        <option value="Alfa Medical">Alfa Medical</option>
                        <option value="Alfa Medical Flex">Alfa Medical Flex</option>
                    </optgroup>
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
                    <option value="Pago Ventanilla / Transferencia">Ventanilla / Transferencia</option>
                </select>
                <input id="c-prima" type="number" placeholder="Prima Neta ($)">

                <input id="c-suma" type="number" placeholder="Suma Asegurada ($)">
                
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <label style="font-size: 11px; color: var(--text-secondary);">Próxima Fecha de Pago</label>
                    <input id="c-fecha" type="date">
                </div>

                <button id="btn-guardar-cartera" class="btn-primary" style="grid-column: span 2; margin-top: 10px;">💾 Guardar Póliza</button>
                <button id="btn-cancelar-edicion" class="btn-secondary" style="grid-column: span 2; display: none;">❌ Cancelar Edición</button>
            </div>
        </div>

        <div class="card" style="border: 2px dashed var(--separator); background: transparent;">
            <h2 style="font-size:16px; margin-bottom:6px;">Mantenimiento de Información</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <input type="file" id="excel-file-input" accept=".xlsx, .xls" style="display: none;">
                <button id="btn-trigger-excel" class="btn-secondary" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                    📥 Importar Excel
                </button>
                <button id="btn-exportar-excel" class="btn-secondary" style="display: flex; align-items: center; justify-content: center; gap: 8px; color: var(--accent); border-color: var(--accent);">
                    📤 Exportar Cartera
                </button>
            </div>
        </div>

        <div class="card">
            <h2 style="font-size:16px;">Listado de Cartera Vigente</h2>
            <div id="lista-cartera-container" style="display: flex; flex-direction: column; gap: 12px; margin-top: 15px;">
                <div style="text-align: center; color: var(--text-tertiary); padding: 10px;">Cargando registros...</div>
            </div>
        </div>
    `;
}

export async function bindCarteraEvents() {
    if (!window.XLSX) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
        document.head.appendChild(script);
    }

    const btnGuardar = document.getElementById('btn-guardar-cartera');
    const btnCancelar = document.getElementById('btn-cancelar-edicion');
    const btnExcelTrigger = document.getElementById('btn-trigger-excel');
    const btnExportar = document.getElementById('btn-exportar-excel');
    const fileInput = document.getElementById('excel-file-input');

    if (btnGuardar) btnGuardar.addEventListener('click', guardarOActualizarPoliza);
    if (btnCancelar) btnCancelar.addEventListener('click', limpiarFormularioCartera);
    if (btnExcelTrigger) btnExcelTrigger.addEventListener('click', () => fileInput.click());
    if (btnExportar) btnExportar.addEventListener('click', exportarCarteraCompleta);
    if (fileInput) fileInput.addEventListener('change', procesarArchivoExcel);

    await actualizarListadoCartera();
}

async function guardarOActualizarPoliza() {
    const cliente = document.getElementById('c-cliente').value.trim();
    const nacimiento = document.getElementById('c-nacimiento').value;
    const emision = document.getElementById('c-emision').value;
    const poliza = document.getElementById('c-poliza').value.trim();
    const plan = document.getElementById('c-plan').value;
    const formaPago = document.getElementById('c-forma-pago').value;
    const conductoCobro = document.getElementById('c-cobro').value;
    const prima = document.getElementById('c-prima').value;
    const suma = document.getElementById('c-suma').value;
    const fechaPago = document.getElementById('c-fecha').value;

    if (!cliente || !poliza || !fechaPago) {
        alert('Datos obligatorios faltantes: Cliente, Número de Póliza y Fecha de Pago.');
        return;
    }

    const datosPoliza = {
        cliente, nacimiento, emision, poliza, plan, formaPago, conductoCobro,
        prima: Number(prima) || 0,
        suma: Number(suma) || 0,
        fechaPago
    };

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
    const poliza = listado.find(p => p.id === id);
    if (!poliza) return;

    idEdicionActual = id;
    document.getElementById('formulario-titulo').innerText = '✏️ Editando Póliza';
    document.getElementById('c-cliente').value = poliza.cliente || '';
    document.getElementById('c-nacimiento').value = poliza.nacimiento || '';
    document.getElementById('c-emision').value = poliza.emision || '';
    document.getElementById('c-poliza').value = poliza.poliza || '';
    document.getElementById('c-plan').value = poliza.plan || '';
    document.getElementById('c-forma-pago').value = poliza.formaPago || '';
    document.getElementById('c-cobro').value = poliza.conductoCobro || '';
    document.getElementById('c-prima').value = poliza.prima || '';
    document.getElementById('c-suma').value = poliza.suma || '';
    document.getElementById('c-fecha').value = poliza.fechaPago || '';

    document.getElementById('btn-guardar-cartera').innerText = '🔄 Actualizar Datos';
    document.getElementById('btn-cancelar-edicion').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

function limpiarFormularioCartera() {
    idEdicionActual = null;
    document.getElementById('formulario-titulo').innerText = 'Alta de Póliza';
    document.getElementById('c-cliente').value = '';
    document.getElementById('c-nacimiento').value = '';
    document.getElementById('c-emision').value = '';
    document.getElementById('c-poliza').value = '';
    document.getElementById('c-plan').value = '';
    document.getElementById('c-forma-pago').value = '';
    document.getElementById('c-cobro').value = '';
    document.getElementById('c-prima').value = '';
    document.getElementById('c-suma').value = '';
    document.getElementById('c-fecha').value = '';
    document.getElementById('btn-guardar-cartera').innerText = '💾 Guardar Póliza';
    document.getElementById('btn-cancelar-edicion').style.display = 'none';
}

async function exportarCarteraCompleta() {
    try {
        const registros = await DB.obtenerTodos('cartera');
        const matrizDatos = registros.length > 0 ? registros.map(p => ({
            'Cliente': p.cliente, 'Nacimiento': p.nacimiento, 'Emision': p.emision, 
            'Poliza': p.poliza, 'Plan': p.plan, 'FormaPago': p.formaPago, 
            'Conducto': p.conductoCobro, 'Prima': p.prima, 'Suma': p.suma, 'FechaPago': p.fechaPago
        })) : [{ 'Cliente': '', 'Nacimiento': 'YYYY-MM-DD', 'Emision': 'YYYY-MM-DD', 'Poliza': '', 'Plan': '', 'FormaPago': '', 'Conducto': '', 'Prima': 0, 'Suma': 0, 'FechaPago': 'YYYY-MM-DD' }];

        const hoja = XLSX.utils.json_to_sheet(matrizDatos);
        const libro = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(libro, hoja, 'Cartera');
        XLSX.writeFile(libro, `Plantilla_Cartera_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
        console.error(err);
    }
}

function procesarArchivoExcel(e) {
    const archivo = e.target.files[0];
    if (!archivo) return;

    const lector = new FileReader();
    lector.onload = async (evt) => {
        try {
            const data = new Uint8Array(evt.target.result);
            const libro = XLSX.read(data, { type: 'array' });
            const filas = XLSX.utils.sheet_to_json(libro.Sheets[libro.SheetNames[0]]);

            let cargados = 0;
            for (const fila of filas) {
                if(!fila.Cliente && !fila.Poliza) continue;
                const nuevaPoliza = {
                    id: 'pol_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                    cliente: fila.Cliente || fila.cliente || 'Registro Importado',
                    nacimiento: fila.Nacimiento || fila.nacimiento || '',
                    emision: fila.Emision || fila.emision || '',
                    poliza: String(fila.Poliza || fila.poliza || Date.now()),
                    plan: fila.Plan || fila.plan || 'Star Temporal',
                    formaPago: fila.FormaPago || fila.formapago || 'Anual',
                    conductoCobro: fila.Conducto || fila.conducto || 'Tarjeta de Crédito',
                    prima: Number(fila.Prima || fila.prima || 0),
                    suma: Number(fila.Suma || fila.suma || 0),
                    fechaPago: fila.FechaPago || fila.fechapago || new Date().toISOString().split('T')[0]
                };
                await DB.guardar('cartera', nuevaPoliza);
                cargados++;
            }
            alert(`Sincronización en la nube exitosa. Se añadieron ${cargados} pólizas.`);
            await actualizarListadoCartera();
        } catch (err) {
            alert('Formato de archivo corrupto o no reconocido.');
        }
    };
    lector.readAsArrayBuffer(archivo);
}

async function actualizarListadoCartera() {
    const container = document.getElementById('lista-cartera-container');
    if (!container) return;

    const listado = await DB.obtenerTodos('cartera');
    const formatearDinero = (num) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num);

    const totalPolizas = listado.length;
    const primaTotal = listado.reduce((acum, p) => acum + (Number(p.prima) || 0), 0);
    const hoy = new Date();
    
    const alertasCriticas = listado.filter(p => {
        const fPago = new Date(p.fechaPago + 'T12:00:00');
        const diffDias = Math.ceil((fPago - hoy) / (1000 * 60 * 60 * 24));
        return diffDias <= 30;
    }).length;

    document.getElementById('kpi-total-polizas').innerText = totalPolizas;
    document.getElementById('kpi-prima-total').innerText = formatearDinero(primaTotal);
    
    const kpiAlertas = document.getElementById('kpi-alertas');
    if (kpiAlertas) {
        kpiAlertas.innerText = `${alertasCriticas} pólizas`;
        kpiAlertas.className = alertasCriticas > 0 ? 'badge badge-red' : 'badge badge-green';
    }

    if (listado.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 15px;">No hay registros en la cartera.</div>`;
        return;
    }

    container.innerHTML = listado.map(p => {
        const fPago = new Date(p.fechaPago + 'T12:00:00');
        const diffDias = Math.ceil((fPago - hoy) / (1000 * 60 * 60 * 24));

        let badgeStyle = 'badge-blue';
        let alertaIcono = '🟢';
        if (diffDias < 0) { badgeStyle = 'badge-red'; alertaIcono = '🚨 Vencida'; }
        else if (diffDias <= 15) { badgeStyle = 'badge-orange'; alertaIcono = '⚠️ Por vencer'; }

        return `
            <div style="background: var(--surface-2); padding: 16px; border-radius: 18px; display: flex; flex-direction: column; gap: 8px; border: 1px solid var(--separator);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <h3 style="margin: 0; font-size: 15px;">${p.cliente}</h3>
                        <span style="font-size: 12px; color: var(--text-secondary);">Póliza: <strong>${p.poliza}</strong> | ${p.plan}</span>
                    </div>
                    <span class="badge ${badgeStyle}">${alertaIcono} (${p.fechaPago})</span>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 13px; background: var(--surface); padding: 10px; border-radius: 12px; border: 1px solid var(--separator);">
                    <div><span style="color: var(--text-secondary); font-size: 11px;">Prima Anual:</span><br><strong>${formatearDinero(p.prima)}</strong></div>
                    <div><span style="color: var(--text-secondary); font-size: 11px;">Forma Pago:</span><br><strong>${p.formaPago}</strong></div>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
                    <button onclick="marcarPolizaComoPagada('${p.id}')" class="btn-primary" style="padding: 8px 12px !important; font-size: 12px; border-radius: 10px !important; background: var(--success) !important;">✅ Ya pagó</button>
                    <button onclick="cargarPolizaParaEditar('${p.id}')" class="btn-secondary" style="padding: 8px 12px !important; font-size: 12px; border-radius: 10px !important;">✏️ Editar</button>
                    <button onclick="eliminarPolizaDobleCheck('${p.id}')" class="btn-secondary" style="padding: 8px 12px !important; font-size: 12px; border-radius: 10px !important; color: var(--danger) !important; border-color: var(--danger) !important;">🗑️ Eliminar</button>
                </div>
            </div>
        `;
    }).join('');
}

window.marcarPolizaComoPagada = async (id) => {
    const listado = await DB.obtenerTodos('cartera');
    const poliza = listado.find(p => p.id === id);
    if (!poliza) return;

    const fechaActual = new Date(poliza.fechaPago + 'T12:00:00');
    if (poliza.formaPago === 'Mensual') fechaActual.setMonth(fechaActual.getMonth() + 1);
    else if (poliza.formaPago === 'Trimestral') fechaActual.setMonth(fechaActual.getMonth() + 3);
    else if (poliza.formaPago === 'Semestral') fechaActual.setMonth(fechaActual.getMonth() + 6);
    else if (poliza.formaPago === 'Anual') fechaActual.setFullYear(fechaActual.getFullYear() + 1);

    const nuevaFechaStr = fechaActual.toISOString().split('T')[0];
    if (confirm(`¿Confirmar renovación de pago?\nPróximo vencimiento calculado: ${nuevaFechaStr}`)) {
        await DB.actualizar('cartera', id, { fechaPago: nuevaFechaStr });
        await actualizarListadoCartera();
    }
};

window.eliminarPolizaDobleCheck = async (id) => {
    if (confirm('¿Eliminar de forma irreversible este registro comercial?')) {
        await DB.eliminar('cartera', id);
        await actualizarListadoCartera();
    }
};
