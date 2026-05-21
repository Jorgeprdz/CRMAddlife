// actividad.js
import { DB } from './db.js';

const PUNTOS = {
    referidos: 3,
    llamadas: 1,
    citas_obt: 2,
    citas_inc: 2,
    citas_cierre: 3,
    solicitud: 5,
    poliza: 10,
    ref_asesor: 10
};

let estadoDiario = {};

export function renderActividad() {
    return `
        <div class="card" style="text-align: center;">
            <h2 style="margin-bottom: 5px;">Meta Diaria: 25 Puntos</h2>
            <p style="color: #8E8E93; font-size: 13px; margin-top: 0;" id="fecha-hoy"></p>

            <div style="margin: 15px 0;">
                <h1 id="total-puntos" style="font-size: 52px; margin: 0; color: #1C1C1E;">0</h1>
                <p style="margin: 0; color: #8E8E93; font-weight: bold; font-size: 12px;">PUNTOS HOY</p>
            </div>

            <div style="background: #E5E5EA; border-radius: 10px; height: 12px; width: 100%; overflow: hidden; margin-bottom: 20px;">
                <div id="barra-progreso" style="background: #FF3B30; width: 0%; height: 100%; transition: width 0.3s ease;"></div>
            </div>

            <div style="display: flex; gap: 10px; margin-top: 15px;">
                <div style="flex: 1; background: #F2F2F7; padding: 10px; border-radius: 10px;">
                    <span id="lbl-semana" style="font-size: 10px; color: #666; font-weight: bold; text-transform: uppercase;">SEMANA</span>
                    <h3 id="puntos-semana" style="margin: 5px 0; color: #007AFF;">0 pts</h3>
                </div>
                <div style="flex: 1; background: #F2F2F7; padding: 10px; border-radius: 10px;">
                    <span id="lbl-mes" style="font-size: 10px; color: #666; font-weight: bold; text-transform: uppercase;">MES</span>
                    <h3 id="puntos-mes" style="margin: 5px 0; color: #34C759;">0 pts</h3>
                </div>
            </div>
        </div>

        <div class="card">
            <h2>Registro de Actividad</h2>
            <div style="display: grid; gap: 10px;">
                ${crearContador('referidos', '👥 Referidos Obtenidos', PUNTOS.referidos)}
                ${crearContador('llamadas', '📞 Llamadas Efectivas', PUNTOS.llamadas)}
                ${crearContador('citas_obt', '📅 Citas Obtenidas', PUNTOS.citas_obt)}
                ${crearContador('citas_inc', '🤝 Citas Iniciales', PUNTOS.citas_inc)}
                ${crearContador('citas_cierre', '🎯 Citas de Cierre', PUNTOS.citas_cierre)}
                ${crearContador('solicitud', '✍️ Solicitud Firmada', PUNTOS.solicitud)}
                ${crearContador('poliza', '💰 Póliza Pagada', PUNTOS.poliza)}
                ${crearContador('ref_asesor', '👔 Referido de Asesor', PUNTOS.ref_asesor)}
            </div>
            <button id="btn-guardar-dia" class="btn-primary" style="margin-top: 15px; background: #007AFF;">💾 Guardar Día</button>
        </div>

        <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h2>Análisis Histórico</h2>
                <button onclick="exportarExcel()" class="btn-secondary" style="padding: 6px 12px; font-size: 12px; background: #34C759; color: white; border: none;">📊 Exportar</button>
            </div>

            <div style="display: flex; gap: 8px; margin-bottom: 15px; flex-wrap: wrap;">
                <input type="date" id="filtro-inicio" style="flex: 1; min-width: 120px; padding: 8px; border-radius: 8px; border: 1px solid #E5E5EA; font-size: 13px;">
                <input type="date" id="filtro-fin" style="flex: 1; min-width: 120px; padding: 8px; border-radius: 8px; border: 1px solid #E5E5EA; font-size: 13px;">
                <button id="btn-filtrar-fechas" class="btn-primary" style="padding: 8px 15px; font-size: 13px; flex-grow: 0;">🔍 Filtrar</button>
                <button id="btn-limpiar-fechas" class="btn-secondary" style="padding: 8px 15px; font-size: 13px; flex-grow: 0;">🧹</button>
            </div>

            <div id="metricas-conversion" style="display: grid; gap: 15px; margin-bottom: 20px;"></div>

            <h3 style="font-size: 15px; margin-bottom: 10px; border-top: 1px solid #eee; padding-top: 15px;">Días Registrados</h3>
            <div id="lista-historial" style="display: grid; gap: 8px;"></div>
        </div>
    `;
}

function crearContador(id, titulo, pts) {
    return `
        <div style="display: flex; justify-content: space-between; align-items: center; background: #F9F9FB; padding: 10px; border-radius: 10px; border: 1px solid #E5E5EA;">
            <div>
                <h4 style="margin: 0; font-size: 14px; color: #1C1C1E;">${titulo}</h4>
                <span style="font-size: 11px; color: #8E8E93;">+${pts} pts</span>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
                <button onclick="modificarContador('${id}', -1)" style="width: 32px; height: 32px; border-radius: 50%; border: none; background: #E5E5EA; font-weight: bold;">-</button>
                <span id="cont-${id}" style="font-size: 16px; font-weight: bold; min-width: 15px; text-align: center;">0</span>
                <button onclick="modificarContador('${id}', 1)" style="width: 32px; height: 32px; border-radius: 50%; border: none; background: #007AFF; color: white; font-weight: bold;">+</button>
            </div>
        </div>
    `;
}

export async function bindActividadEvents() {
    const hoy = new Date();
    const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('fecha-hoy').innerText = hoy.toLocaleDateString('es-MX', opciones).toUpperCase();

    const mesNombre = hoy.toLocaleString('es-MX', { month: 'long' });
    const primerDiaDelMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const diaDeLaSemana = primerDiaDelMes.getDay() || 7;
    const semanaDelMes = Math.ceil((hoy.getDate() + diaDeLaSemana - 1) / 7);

    document.getElementById('lbl-semana').innerText = `SEMANA ${semanaDelMes} DE ${mesNombre}`;
    document.getElementById('lbl-mes').innerText = `${mesNombre}`;

    const defaultState = { referidos: 0, llamadas: 0, citas_obt: 0, citas_inc: 0, citas_cierre: 0, solicitud: 0, poliza: 0, ref_asesor: 0 };
    const temp = localStorage.getItem('actividad_temporal');

    if (temp) {
        const parsed = JSON.parse(temp);
        Object.keys(defaultState).forEach(k => {
            estadoDiario[k] = isNaN(parsed[k]) ? 0 : (parsed[k] || 0);
        });
    } else {
        estadoDiario = { ...defaultState };
    }

    await calcularAcumuladosGlobales();
    await procesarFiltroHistorico();
    actualizarUI();

    document.getElementById('btn-guardar-dia').addEventListener('click', async () => {
        const total = calcularTotalPuntos(estadoDiario);
        if (total === 0) return alert('Registra actividad antes de guardar.');

        const fechaHoy = new Date().toISOString().split('T')[0];
        const registro = { id: fechaHoy, fecha: fechaHoy, puntos: total, desglose: { ...estadoDiario } };

        const historial = await DB.obtenerTodos('historial_actividad');
        if (historial.find(h => h.id === fechaHoy)) {
            await DB.actualizar('historial_actividad', fechaHoy, registro);
        } else {
            await DB.guardar('historial_actividad', registro);
        }

        localStorage.removeItem('actividad_temporal');
        estadoDiario = { ...defaultState };

        alert('Actividad guardada con éxito.');
        await calcularAcumuladosGlobales();
        await procesarFiltroHistorico();
        actualizarUI();
    });

    document.getElementById('btn-filtrar-fechas').addEventListener('click', procesarFiltroHistorico);

    document.getElementById('btn-limpiar-fechas').addEventListener('click', () => {
        document.getElementById('filtro-inicio').value = '';
        document.getElementById('filtro-fin').value = '';
        procesarFiltroHistorico();
    });
}

window.modificarContador = (llave, cant) => {
    if (estadoDiario[llave] + cant < 0) return;
    estadoDiario[llave] += cant;
    localStorage.setItem('actividad_temporal', JSON.stringify(estadoDiario));
    actualizarUI();
};

function calcularTotalPuntos(desglose) {
    return Object.keys(PUNTOS).reduce((acc, curr) => acc + ((desglose[curr] || 0) * PUNTOS[curr]), 0);
}

function actualizarUI() {
    const total = calcularTotalPuntos(estadoDiario);
    document.getElementById('total-puntos').innerText = total;

    Object.keys(estadoDiario).forEach(k => {
        const el = document.getElementById(`cont-${k}`);
        if (el) el.innerText = estadoDiario[k];
    });

    const barra = document.getElementById('barra-progreso');
    const pct = Math.min((total / 25) * 100, 100);
    barra.style.width = `${pct}%`;
    barra.style.background = total >= 25 ? '#34C759' : (total >= 12 ? '#FF9500' : '#FF3B30');
}

async function calcularAcumuladosGlobales() {
    const historial = await DB.obtenerTodos('historial_actividad');
    const hoy = new Date();

    const lunesActual = new Date(hoy);
    lunesActual.setDate(hoy.getDate() - (hoy.getDay() === 0 ? 6 : hoy.getDay() - 1));
    lunesActual.setHours(0, 0, 0, 0);

    const viernesActual = new Date(lunesActual);
    viernesActual.setDate(lunesActual.getDate() + 4);
    viernesActual.setHours(23, 59, 59, 999);

    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    let ptsSemana = 0;
    let ptsMes = 0;

    historial.forEach(reg => {
        const fReg = new Date(reg.fecha + 'T12:00:00');
        if (fReg >= lunesActual && fReg <= viernesActual) ptsSemana += reg.puntos;
        if (fReg >= primerDiaMes) ptsMes += reg.puntos;
    });

    document.getElementById('puntos-semana').innerText = `${ptsSemana} pts`;
    document.getElementById('puntos-mes').innerText = `${ptsMes} pts`;
}

async function procesarFiltroHistorico() {
    const historial = await DB.obtenerTodos('historial_actividad');
    const fInicio = document.getElementById('filtro-inicio')?.value;
    const fFin = document.getElementById('filtro-fin')?.value;

    let registrosFiltrados = historial;

    if (fInicio || fFin) {
        registrosFiltrados = historial.filter(reg => {
            let pasa = true;
            if (fInicio && reg.fecha < fInicio) pasa = false;
            if (fFin && reg.fecha > fFin) pasa = false;
            return pasa;
        });
    } else {
        const hoy = new Date();
        const strMesActual = hoy.toISOString().slice(0, 7);
        registrosFiltrados = historial.filter(reg => reg.fecha.startsWith(strMesActual));
    }

    let totalRango = { referidos: 0, llamadas: 0, citas_obt: 0, citas_inc: 0, citas_cierre: 0, solicitud: 0, poliza: 0 };
    registrosFiltrados.forEach(reg => {
        Object.keys(totalRango).forEach(k => {
            totalRango[k] += (reg.desglose[k] || 0);
        });
    });
    renderGraficasConversion(totalRango);

    const contenedorLista = document.getElementById('lista-historial');
    if (registrosFiltrados.length === 0) {
        contenedorLista.innerHTML = `<p style="color:gray; font-size:13px; text-align:center;">No hay registros en este periodo.</p>`;
        return;
    }

    contenedorLista.innerHTML = registrosFiltrados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).map(dia => {
        const color = dia.puntos >= 25 ? '#34C759' : (dia.puntos >= 12 ? '#FF9500' : '#FF3B30');
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #F9F9FB; border: 1px solid #E5E5EA; border-radius: 8px;">
                <div>
                    <span style="font-weight: bold; color: #1C1C1E; display: block; font-size: 14px;">${dia.fecha}</span>
                    <span style="font-size: 12px; color: ${color}; font-weight: bold;">Total: ${dia.puntos} pts</span>
                </div>
                <button onclick="eliminarDiaActividad('${dia.id}')" style="background: #FF3B30; color: white; border: none; border-radius: 6px; padding: 6px 10px; font-weight: bold; font-size: 12px;">🗑️ Eliminar</button>
            </div>
        `;
    }).join('');
}

function renderGraficasConversion(totales) {
    const div = document.getElementById('metricas-conversion');
    if (!div) return;

    const pctLlamadasRef = totales.referidos ? Math.round((totales.llamadas / totales.referidos) * 100) : 0;
    const pctCitasLlamadas = totales.llamadas ? Math.round((totales.citas_obt / totales.llamadas) * 100) : 0;
    const pctIncObtenidas = totales.citas_obt ? Math.round((totales.citas_inc / totales.citas_obt) * 100) : 0;
    const pctCierreInc = totales.citas_inc ? Math.round((totales.citas_cierre / totales.citas_inc) * 100) : 0;
    const pctSolCierre = totales.citas_cierre ? Math.round((totales.solicitud / totales.citas_cierre) * 100) : 0;
    const pctPolizaSol = totales.solicitud ? Math.round((totales.poliza / totales.solicitud) * 100) : 0;

    div.innerHTML = `
        ${dibujarBarraMetrica('Referidos ➔ Llamadas', `${totales.referidos} Ref / ${totales.llamadas} Llam`, pctLlamadasRef, '#007AFF')}
        ${dibujarBarraMetrica('Llamadas ➔ Citas Obtenidas', `${totales.llamadas} Llam / ${totales.citas_obt} Citas`, pctCitasLlamadas, '#FF9500')}
        ${dibujarBarraMetrica('Citas Obtenidas ➔ Citas Iniciales', `${totales.citas_obt} Obt / ${totales.citas_inc} Inc`, pctIncObtenidas, '#AF52DE')}
        ${dibujarBarraMetrica('Citas Iniciales ➔ Citas de Cierre', `${totales.citas_inc} Inc / ${totales.citas_cierre} Cierre`, pctCierreInc, '#5856D6')}
        ${dibujarBarraMetrica('Citas de Cierre ➔ Solicitud', `${totales.citas_cierre} Cierre / ${totales.solicitud} Sol`, pctSolCierre, '#FF2D55')}
        ${dibujarBarraMetrica('Solicitud ➔ Póliza Pagada', `${totales.solicitud} Sol / ${totales.poliza} Pagos`, pctPolizaSol, '#34C759')}
    `;
}

function dibujarBarraMetrica(titulo, ratio, porcentaje, color) {
    return `
        <div>
            <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                <span style="font-weight: 600; color: #1C1C1E;">${titulo}</span>
                <span style="color: #8E8E93;">${ratio} <strong>(${porcentaje}%)</strong></span>
            </div>
            <div style="background: #E5E5EA; height: 8px; width: 100%; border-radius: 4px; overflow: hidden;">
                <div style="background: ${color}; width: ${porcentaje}%; height: 100%; border-radius: 4px; transition: width 0.5s ease;"></div>
            </div>
        </div>
    `;
}

window.eliminarDiaActividad = async (fechaId) => {
    if (confirm(`¿Deseas eliminar el registro de actividad del día ${fechaId}? Esta acción no se puede deshacer.`)) {
        await DB.eliminar('historial_actividad', fechaId);
        await calcularAcumuladosGlobales();
        await procesarFiltroHistorico();
    }
};

window.exportarExcel = async () => {
    const historial = await DB.obtenerTodos('historial_actividad');
    if (historial.length === 0) return alert('No existen registros históricos para exportar.');

    let csvContent = '\uFEFF';
    csvContent += 'Fecha,Puntos Totales,Referidos,Llamadas,Citas Obtenidas,Citas Iniciales,Citas de Cierre,Solicitudes Firmadas,Polizas Pagadas,Referidos de Asesor\n';

    historial.sort((a, b) => new Date(a.fecha) - new Date(b.fecha)).forEach(r => {
        const d = r.desglose;
        csvContent += `${r.fecha},${r.puntos},${d.referidos || 0},${d.llamadas || 0},${d.citas_obt || 0},${d.citas_inc || 0},${d.citas_cierre || 0},${d.solicitud || 0},${d.poliza || 0},${d.ref_asesor || 0}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Reporte_Productividad_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
