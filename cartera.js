// /modules/cartera.js - Motor de Gestión de Pólizas (Optimizado)
import { DB } from './db.js';
import { showToast, showConfirm } from './utils.js';

// Encapsulamiento del Estado (State Management Local)
const CarteraState = {
    idEdicion: null,
    datos: [],
    
    resetForm() {
        this.idEdicion = null;
        document.getElementById('formulario-titulo').innerText = 'Alta de Póliza';
        ['c-cliente', 'c-nacimiento', 'c-emision', 'c-poliza', 'c-plan', 'c-variante', 'c-edad-gmm', 'c-forma-pago', 'c-cobro', 'c-prima', 'c-suma'].forEach(id => document.getElementById(id).value = '');
        document.getElementById('c-moneda').value = 'MXN';
        document.getElementById('c-personal').checked = false;
        document.getElementById('btn-guardar-cartera').innerText = '💾 Guardar Póliza';
        document.getElementById('btn-cancelar-edicion').style.display = 'none';
    }
};

export function renderCartera() {
    return `
        <div class="card" style="border-left: 4px solid var(--accent); margin-bottom: 20px;">
            <h2 style="font-size: 16px; margin-bottom: 12px;">📊 Resumen de Cartera</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div style="background: var(--surface-2); padding: 12px; border-radius: 12px; border: 1px solid var(--separator);">
                    <span style="font-size: 11px; color: var(--text-secondary); font-weight: 600; text-transform: uppercase;">Pólizas Vigentes</span><br>
                    <strong id="kpi-total-polizas" style="font-size: 18px; color: var(--text-primary);">0</strong>
                </div>
                <div style="background: var(--surface-2); padding: 12px; border-radius: 12px; border: 1px solid var(--separator);">
                    <span style="font-size: 11px; color: var(--text-secondary); font-weight: 600; text-transform: uppercase;">Prima de Cartera</span><br>
                    <strong id="kpi-prima-total" style="font-size: 18px; color: var(--success);">$0.00</strong>
                </div>
                <div style="grid-column: span 2; background: var(--surface-2); padding: 12px; border-radius: 12px; border: 1px solid var(--separator); display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 12px; color: var(--text-secondary); font-weight: 500;">Alerta de Cobranza (<= 30 días):</span>
                    <strong id="kpi-alertas" class="badge badge-green" style="font-size: 13px;">0 pólizas</strong>
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
                
                <select id="c-plan" style="grid-column: span 2;">
                    <option value="">Producto contratado...</option>
                    <optgroup label="Seguros de Vida"><option value="Star Temporal">Star Temporal</option><option value="Orvi 99">Orvi 99</option><option value="Segubeca">Segubeca</option><option value="Mio">Mío</option><option value="Vida Mujer">Vida Mujer</option></optgroup>
                    <optgroup label="Gastos Médicos Mayores"><option value="Alfa Medical">Alfa Medical</option><option value="Alfa Medical Flex">Alfa Medical Flex</option></optgroup>
                </select>

                <select id="c-variante"><option value="">Plazo...</option><option value="1">1 Año</option><option value="5">5 Años</option><option value="10">10 Años</option><option value="Prima Única">Prima Única</option></select>
                <input id="c-edad-gmm" type="number" placeholder="Edad GMM (Ej. 35)">
                <select id="c-moneda"><option value="MXN">MXN - Pesos</option><option value="USD">USD - Dólares</option><option value="UDIS">UDIS</option></select>
                <select id="c-forma-pago"><option value="">Frecuencia...</option><option value="Mensual">Mensual</option><option value="Semestral">Semestral</option><option value="Anual">Anual</option><option value="Prima Única">Prima Única</option></select>
                <select id="c-cobro" style="grid-column: span 2;"><option value="">Conducto de Cobro...</option><option value="Tarjeta de Crédito">Tarjeta de Crédito</option><option value="Transferencia">Transferencia / Efectivo</option></select>
                
                <input id="c-prima" type="number" placeholder="Prima Neta">
                <input id="c-suma" type="number" placeholder="Suma Asegurada">

                <div style="display: flex; align-items: center; gap: 8px; grid-column: span 2;">
                    <input type="checkbox" id="c-personal" style="width: auto; transform: scale(1.2);">
                    <label for="c-personal" style="font-size: 13px; color: var(--text-secondary);">Póliza Personal (Excluir cálculos de bono)</label>
                </div>

                <button id="btn-guardar-cartera" class="btn-primary" style="grid-column: span 2; margin-top: 10px;">💾 Procesar Póliza</button>
                <button id="btn-cancelar-edicion" class="btn-secondary" style="grid-column: span 2; display: none;">❌ Cancelar</button>
            </div>
        </div>

        <div class="card" style="border: 2px dashed var(--separator); background: transparent;">
            <h2 style="font-size:16px; margin-bottom:6px;">Sincronización Masiva</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <input type="file" id="excel-file-input" accept=".xlsx, .xls" style="display: none;">
                <button id="btn-trigger-excel" class="btn-secondary">📥 Importar Excel</button>
                <button id="btn-exportar-excel" class="btn-secondary" style="color: var(--accent); border-color: var(--accent);">📤 Exportar</button>
            </div>
        </div>

        <div class="card">
            <div style="display: flex; gap: 8px; margin-bottom: 15px;">
                <input type="text" id="filtro-texto" placeholder="Buscar por cliente o póliza..." style="flex: 1;">
                <select id="filtro-mes" style="width: auto;"><option value="">Mes Pago</option><option value="1">Ene</option><option value="5">May</option><option value="12">Dic</option></select>
            </div>
            <div id="lista-cartera-container" style="display: flex; flex-direction: column; gap: 12px;"></div>
        </div>
    `;
}

export async function bindCarteraEvents() {
    // Inyección diferida del script para mejorar tiempo de carga (Performance)
    if (!window.XLSX) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
        script.async = true;
        document.head.appendChild(script);
    }

    document.getElementById('btn-guardar-cartera')?.addEventListener('click', () => Controller.guardarPoliza());
    document.getElementById('btn-cancelar-edicion')?.addEventListener('click', () => CarteraState.resetForm());
    document.getElementById('btn-trigger-excel')?.addEventListener('click', () => document.getElementById('excel-file-input').click());
    document.getElementById('btn-exportar-excel')?.addEventListener('click', () => Controller.exportarExcel());
    document.getElementById('excel-file-input')?.addEventListener('change', (e) => Controller.importarExcel(e));
    document.getElementById('filtro-texto')?.addEventListener('input', () => Controller.renderLista());
    document.getElementById('filtro-mes')?.addEventListener('change', () => Controller.renderLista());

    await Controller.cargarDatos();
}

const Controller = {
    async cargarDatos() {
        CarteraState.datos = await DB.obtenerTodos('cartera');
        this.renderKPIs();
        this.renderLista();
    },

    _calcularProximoVencimiento(fechaEmisionStr, formaPago) {
        if (!fechaEmisionStr || formaPago === 'Prima Única') return fechaEmisionStr;
        const fPago = new Date(fechaEmisionStr + 'T12:00:00');
        const hoy = new Date();
        hoy.setHours(0,0,0,0);
        
        while (fPago < hoy) {
            if (formaPago === 'Mensual') fPago.setMonth(fPago.getMonth() + 1);
            else if (formaPago === 'Semestral') fPago.setMonth(fPago.getMonth() + 6);
            else if (formaPago === 'Anual') fPago.setFullYear(fPago.getFullYear() + 1);
            else break;
        }
        return fPago.toISOString().split('T')[0];
    },

    async guardarPoliza() {
        const payload = {
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
            esPersonal: document.getElementById('c-personal').checked
        };

        if (!payload.cliente || !payload.poliza || !payload.emision) return showToast('Faltan datos obligatorios.', 'danger');
        payload.fechaPago = this._calcularProximoVencimiento(payload.emision, payload.formaPago);

        if (CarteraState.idEdicion) {
            await DB.actualizar('cartera', CarteraState.idEdicion, payload);
        } else {
            payload.id = 'pol_' + Date.now();
            await DB.guardar('cartera', payload);
        }
        
        CarteraState.resetForm();
        await this.cargarDatos();
        showToast('Póliza procesada correctamente.', 'success');
    },

    // OPTIMIZACIÓN: Promise.all para procesamiento en lote (Evita bloquear el Main Thread)
    async importarExcel(e) {
        const file = e.target.files[0];
        if (!file || !window.XLSX) return;
        
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                showToast('Procesando archivo... por favor espera.', 'warning');
                const workbook = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
                const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                
                const promesasGuardado = rows.map(row => {
                    if (!row.Cliente && !row.Poliza) return Promise.resolve();
                    const emision = row.Emision || new Date().toISOString().split('T')[0];
                    const fp = row.FormaPago || 'Anual';
                    const data = {
                        id: 'pol_' + Date.now() + '_' + Math.random().toString(36).substring(2),
                        cliente: row.Cliente || 'Sin Nombre', emision: emision, poliza: String(row.Poliza),
                        plan: row.Plan || '', formaPago: fp, prima: Number(row.Prima) || 0,
                        fechaPago: row.FechaPago || this._calcularProximoVencimiento(emision, fp)
                    };
                    return DB.guardar('cartera', data);
                });

                await Promise.all(promesasGuardado); // Batch processing paralelo
                await this.cargarDatos();
                showToast(`Sincronización masiva de ${promesasGuardado.length} registros exitosa.`, 'success');
            } catch (err) {
                showToast('Error estructurando Excel. Verifica el formato.', 'danger');
            }
        };
        reader.readAsArrayBuffer(file);
    },

    renderKPIs() {
        const fmt = n => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
        const hoy = new Date();
        const criticas = CarteraState.datos.filter(p => p.fechaPago && Math.ceil((new Date(p.fechaPago+'T12:00:00') - hoy)/86400000) <= 30).length;

        document.getElementById('kpi-total-polizas').innerText = CarteraState.datos.length;
        document.getElementById('kpi-prima-total').innerText = fmt(CarteraState.datos.reduce((sum, p) => sum + (Number(p.prima) || 0), 0));
        
        const kpiAlertas = document.getElementById('kpi-alertas');
        if (kpiAlertas) {
            kpiAlertas.innerText = `${criticas} pólizas`;
            kpiAlertas.className = criticas > 0 ? 'badge badge-red' : 'badge badge-green';
        }
    },

    renderLista() {
        const container = document.getElementById('lista-cartera-container');
        if (!container) return;
        const txt = (document.getElementById('filtro-texto')?.value || '').toLowerCase();
        
        const filtrados = CarteraState.datos.filter(p => p.cliente.toLowerCase().includes(txt) || p.poliza.toLowerCase().includes(txt));
        const fmt = n => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
        const hoy = new Date();

        container.innerHTML = filtrados.map(p => {
            const dias = p.fechaPago ? Math.ceil((new Date(p.fechaPago+'T12:00:00') - hoy)/86400000) : 99;
            const badge = p.formaPago === 'Prima Única' ? 'badge-green' : dias < 0 ? 'badge-red' : dias <= 15 ? 'badge-orange' : 'badge-blue';
            const icon = p.formaPago === 'Prima Única' ? '✅' : dias < 0 ? '🚨' : dias <= 15 ? '⚠️' : '🟢';

            return `
                <div style="background:var(--surface-2); padding:16px; border-radius:16px; border:1px solid var(--separator);">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <h3 style="margin:0; font-size:14px;">${p.cliente}</h3>
                            <span style="font-size:12px; color:var(--text-secondary);">Pol: <strong>${p.poliza}</strong> | ${p.plan}</span>
                        </div>
                        <span class="badge ${badge}">${icon} ${p.fechaPago || ''}</span>
                    </div>
                    <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:12px;">
                        <button onclick="window.cargarPolizaParaEditar('${p.id}')" class="btn-secondary" style="padding:4px 10px!important; font-size:12px;">✏️ Editar</button>
                    </div>
                </div>
            `;
        }).join('');
    }
};

window.cargarPolizaParaEditar = (id) => {
    const p = CarteraState.datos.find(x => x.id === id);
    if (!p) return;
    CarteraState.idEdicion = id;
    document.getElementById('formulario-titulo').innerText = '✏️ Editando Póliza';
    ['c-cliente', 'c-emision', 'c-poliza', 'c-plan', 'c-forma-pago', 'c-prima'].forEach(k => document.getElementById(k).value = p[k.replace('c-','')] || '');
    document.getElementById('btn-cancelar-edicion').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
};
