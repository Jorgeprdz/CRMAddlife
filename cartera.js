// /modules/cartera.js - Motor de Gestión de Pólizas (Completo y Corregido)
import { DB } from './db.js';
import { showToast, showConfirm } from './utils.js';

const CarteraState = {
    idEdicion: null,
    datos: [],
    
    resetForm() {
        this.idEdicion = null;
        const formTitulo = document.getElementById('formulario-titulo');
        if (formTitulo) formTitulo.innerText = 'Alta de Póliza';
        
        ['c-cliente', 'c-nacimiento', 'c-emision', 'c-poliza', 'c-plan', 'c-variante', 'c-edad-gmm', 'c-forma-pago', 'c-cobro', 'c-prima', 'c-suma'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        
        const monedaEl = document.getElementById('c-moneda');
        if (monedaEl) monedaEl.value = 'MXN';
        
        const personalEl = document.getElementById('c-personal');
        if (personalEl) personalEl.checked = false;
        
        const btnGuardar = document.getElementById('btn-guardar-cartera');
        if (btnGuardar) btnGuardar.innerText = '💾 Guardar Póliza';
        
        const btnCancelar = document.getElementById('btn-cancelar-edicion');
        if (btnCancelar) btnCancelar.style.display = 'none';
    }
};

export function renderCartera() {
    return `
        <div class="glass-widget" style="padding: 16px; margin-bottom: 20px;">
            <h2 style="font-size: 16px; margin-bottom: 12px; font-weight:700;">📊 Resumen de Cartera</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div style="background: rgba(150,150,150,0.05); padding: 12px; border-radius: 14px; border: 1px solid var(--separator);">
                    <span style="font-size: 11px; color: var(--text-secondary); font-weight: 600; text-transform: uppercase;">Pólizas Vigentes</span><br>
                    <strong id="kpi-total-polizas" style="font-size: 18px; color: var(--text-primary);">0</strong>
                </div>
                <div style="background: rgba(150,150,150,0.05); padding: 12px; border-radius: 14px; border: 1px solid var(--separator);">
                    <span style="font-size: 11px; color: var(--text-secondary); font-weight: 600; text-transform: uppercase;">Prima de Cartera</span><br>
                    <strong id="kpi-prima-total" style="font-size: 18px; color: var(--success);">$0.00</strong>
                </div>
                <div style="grid-column: span 2; background: rgba(150,150,150,0.05); padding: 12px; border-radius: 14px; border: 1px solid var(--separator); display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 12px; color: var(--text-secondary); font-weight: 500;">Alertas de Cobranza (<= 30 días):</span>
                    <strong id="kpi-alertas" class="status-badge" style="font-size: 12px;">0 pólizas</strong>
                </div>
            </div>
        </div>

        <div class="glass-widget" style="padding: 16px; margin-bottom: 20px;">
            <h2 id="formulario-titulo" style="font-size:16px; margin-bottom:12px; font-weight:700;">Alta de Póliza</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <input id="c-cliente" class="glass-input" placeholder="Nombre del Cliente" style="grid-column: span 2;">
                
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <label style="font-size: 11px; color: var(--text-secondary); font-weight:500;">Fecha Nacimiento</label>
                    <input id="c-nacimiento" class="glass-input" type="date">
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <label style="font-size: 11px; color: var(--text-secondary); font-weight:500;">Fecha Emisión</label>
                    <input id="c-emision" class="glass-input" type="date">
                </div>

                <input id="c-poliza" class="glass-input" placeholder="Número de Póliza" style="grid-column: span 2;">
                
                <select id="c-plan" class="glass-input" style="grid-column: span 2;">
                    <option value="">Producto contratado...</option>
                    <optgroup label="Seguros de Vida">
                        <option value="Star Temporal">Star Temporal</option>
                        <option value="Orvi 99">Orvi 99</option>
                        <option value="Respaldo Educativo">Respaldo Educativo</option>
                        <option value="Segubeca">Segubeca</option>
                        <option value="Respaldo Negocio">Respaldo Negocio</option>
                        <option value="Mio">Mío</option>
                        <option value="Imagina Ser">Imagina Ser</option>
                        <option value="Objetivo Vida">Objetivo Vida</option>
                        <option value="Nuevo Plenitud">Nuevo Plenitud</option>
                        <option value="Vida Mujer">Vida Mujer</option>
                    </optgroup>
                    <optgroup label="Gastos Médicos Mayores">
                        <option value="Alfa Medical">Alfa Medical</option>
                        <option value="Alfa Medical Flex">Alfa Medical Flex</option>
                        <option value="Alfa Medical Internacional">Alfa Medical Internacional</option>
                    </optgroup>
                </select>

                <select id="c-variante" class="glass-input"><option value="">Plazo...</option><option value="1">1 Año</option><option value="5">5 Años</option><option value="10">10 Años</option><option value="Prima Única">Prima Única</option></select>
                <input id="c-edad-gmm" class="glass-input" type="number" placeholder="Edad GMM">
                <select id="c-moneda" class="glass-input"><option value="MXN">MXN - Pesos</option><option value="USD">USD - Dólares</option><option value="UDIS">UDIS</option></select>
                <select id="c-forma-pago" class="glass-input"><option value="">Frecuencia...</option><option value="Mensual">Mensual</option><option value="Trimestral">Trimestral</option><option value="Semestral">Semestral</option><option value="Anual">Anual</option><option value="Prima Única">Prima Única</option></select>
                <select id="c-cobro" class="glass-input" style="grid-column: span 2;"><option value="">Conducto de Cobro...</option><option value="Tarjeta de Crédito">Tarjeta de Crédito</option><option value="Transferencia">Transferencia / Efectivo</option></select>
                
                <input id="c-prima" class="glass-input" type="number" placeholder="Prima Neta">
                <input id="c-suma" class="glass-input" type="number" placeholder="Suma Asegurada">

                <div style="display: flex; align-items: center; gap: 8px; grid-column: span 2; margin-top:4px;">
                    <input type="checkbox" id="c-personal" style="width: auto; transform: scale(1.1);">
                    <label for="c-personal" style="font-size: 13px; color: var(--text-secondary);">Póliza Personal (Excluir de concursos)</label>
                </div>

                <button id="btn-guardar-cartera" class="btn-primary" style="grid-column: span 2; margin-top: 10px;">💾 Procesar Póliza</button>
                <button id="btn-cancelar-edicion" class="btn-secondary" style="grid-column: span 2; display: none;">❌ Cancelar</button>
            </div>
        </div>

        <div class="glass-widget" style="padding: 16px; margin-bottom: 20px; border: 2px dashed rgba(150,150,150,0.3); background: transparent;">
            <h2 style="font-size:16px; margin-bottom:8px; font-weight:700;">Sincronización Masiva</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <input type="file" id="excel-file-input" accept=".xlsx, .xls" style="display: none;">
                <button id="btn-trigger-excel" class="btn-secondary btn-sm">📥 Importar Excel</button>
                <button id="btn-exportar-excel" class="btn-secondary btn-sm" style="color: var(--accent); border-color: var(--accent);">📤 Exportar</button>
            </div>
        </div>

        <div class="glass-widget" style="padding: 16px;">
            <div style="display: flex; gap: 8px; margin-bottom: 15px;">
                <input type="text" id="filtro-texto" class="glass-input" placeholder="Buscar por cliente o póliza..." style="flex: 1;">
            </div>
            <div id="lista-cartera-container" style="display: flex; flex-direction: column; gap: 12px;"></div>
        </div>
    `;
}

export async function bindCarteraEvents() {
    if (!window.XLSX) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
        script.async = true;
        document.head.appendChild(script);
    }

    document.getElementById('btn-guardar-cartera')?.addEventListener('click', () => Controller.guardarPoliza());
    document.getElementById('btn-cancelar-edicion')?.addEventListener('click', () => CarteraState.resetForm());
    document.getElementById('btn-trigger-excel')?.addEventListener('click', () => document.getElementById('excel-file-input').click());
    document.getElementById('excel-file-input')?.addEventListener('change', (e) => Controller.importarExcel(e));
    document.getElementById('filtro-texto')?.addEventListener('input', () => Controller.renderLista());

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
            else if (formaPago === 'Trimestral') fPago.setMonth(fPago.getMonth() + 3);
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

    async importarExcel(e) {
        const file = e.target.files[0];
        if (!file || !window.XLSX) return;
        
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                showToast('Procesando archivo de cartera...', 'warning');
                const workbook = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
                const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                
                const promesasGuardado = rows.map(row => {
                    // RESOLUCIÓN DE NORMALIZACIÓN DE LLAVES (Mapeo Insensible a Mayúsculas/Minúsculas)
                    const cliente = row.cliente || row.Cliente;
                    const poliza = row.poliza || row.Poliza;
                    const emision = row.emision || row.Emision || new Date().toISOString().split('T')[0];
                    const fp = row.formapago || row.FormaPago || 'Anual';
                    const plan = row.plan || row.Plan || '';
                    const prima = Number(row.prima || row.Prima) || 0;
                    const nacimiento = row.nacimiento || row.Nacimiento || '';
                    const variante = row.variante || row.Variante || '';
                    const edadgmm = row.edadgmm || row.EdadGMM || '';
                    const moneda = row.moneda || row.Moneda || 'MXN';
                    const conducto = row.conducto || row.Conducto || '';
                    const suma = Number(row.suma || row.Suma) || 0;
                    const espersonal = String(row.espersonal || row.EsPersonal || 'NO').toUpperCase() === 'SI';

                    if (!cliente && !poliza) return Promise.resolve();

                    const data = {
                        id: 'pol_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
                        cliente: cliente || 'Sin Nombre',
                        nacimiento: nacimiento,
                        emision: emision,
                        poliza: String(poliza),
                        plan: plan,
                        variante: variante,
                        edadGmm: edadgmm,
                        moneda: moneda,
                        formaPago: fp,
                        conductoCobro: conducto,
                        prima: prima,
                        suma: suma,
                        esPersonal: espersonal,
                        fechaPago: row.fechapago || row.FechaPago || this._calcularProximoVencimiento(emision, fp)
                    };
                    return DB.guardar('cartera', data);
                });

                await Promise.all(promesasGuardado);
                await this.cargarDatos();
                showToast(`Sincronización masiva completada con éxito.`, 'success');
            } catch (err) {
                console.error(err);
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
            kpiAlertas.style.background = criticas > 0 ? 'rgba(255,59,48,0.1)' : 'rgba(52,199,89,0.1)';
            kpiAlertas.style.color = criticas > 0 ? '#FF3B30' : '#34C759';
            kpiAlertas.style.border = criticas > 0 ? '1px solid rgba(255,59,48,0.2)' : '1px solid rgba(52,199,89,0.2)';
        }
    },

    renderLista() {
        const container = document.getElementById('lista-cartera-container');
        if (!container) return;
        const txt = (document.getElementById('filtro-texto')?.value || '').toLowerCase();
        
        const filtrados = CarteraState.datos.filter(p => p.cliente.toLowerCase().includes(txt) || p.poliza.toLowerCase().includes(txt));
        const hoy = new Date();

        container.innerHTML = filtrados.map(p => {
            const dias = p.fechaPago ? Math.ceil((new Date(p.fechaPago+'T12:00:00') - hoy)/86400000) : 99;
            const badgeColor = p.formaPago === 'Prima Única' ? '#34C759' : dias < 0 ? '#FF3B30' : dias <= 15 ? '#FF9500' : '#007AFF';
            const icon = p.formaPago === 'Prima Única' ? '✅' : dias < 0 ? '🚨' : dias <= 15 ? '⚠️' : '🟢';

            return `
                <div class="glass-widget" style="padding:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <h3 style="margin:0; font-size:15px; font-weight:700;">${p.cliente}</h3>
                            <span style="font-size:12px; color:var(--text-secondary);">Pol: <strong>${p.poliza}</strong> | ${p.plan}</span>
                        </div>
                        <span class="status-badge" style="background:${badgeColor}1A; color:${badgeColor}; border:1px solid ${badgeColor}30; font-size:11px; font-weight:700;">
                            ${icon} ${p.fechaPago || ''}
                        </span>
                    </div>
                    <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:14px; padding-top:12px; border-top:1px solid rgba(150,150,150,0.1);">
                        <button onclick="window.cargarPolizaParaEditar('${p.id}')" class="btn-secondary btn-sm">✏️ Editar</button>
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
    ['c-cliente', 'c-emision', 'c-poliza', 'c-plan', 'c-forma-pago', 'c-prima'].forEach(k => {
        const el = document.getElementById(k);
        if(el) el.value = p[k.replace('c-','')] || '';
    });
    const btnCan = document.getElementById('btn-cancelar-edicion');
    if (btnCan) btnCan.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
};
