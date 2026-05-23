// comisiones.js - Motor Financiero Corregido
import { DB } from './db.js';
import { callGemini, getSupabase } from './app.js';

const TablaComisiones = {
    'Star Temporal': { nn: 0.35, ry: 0.10, ramo: 'Vida' },
    'Orvi 99': { nn: 0.44, ry: 0.15, ramo: 'Vida' },
    'Respaldo Educativo': { nn: 0.35, ry: 0.10, ramo: 'Vida' },
    'Segubeca': { nn: 0.37, ry: 0.09, ramo: 'Vida' },
    'Respaldo Negocio': { nn: 0.35, ry: 0.10, ramo: 'Vida' },
    'Mio': { nn: 0.80, ry: 0.20, ramo: 'Vida' },
    'Imagina Ser': { nn: 0.35, ry: 0.12, ramo: 'Vida' },
    'Objetivo Vida': { nn: 0.44, ry: 0.05, ramo: 'Vida' },
    'Nuevo Plenitud': { nn: 0.35, ry: 0.12, ramo: 'Vida' },
    'Vida Mujer': { nn: 0.40, ry: 0.15, ramo: 'Vida' },
    'Alfa Medical': { nn: 0.17, ry: 0.15, ramo: 'GMM' },
    'Alfa Medical Flex': { nn: 0.15, ry: 0.15, ramo: 'GMM' },
    'Alfa Medical Internacional': { nn: 0.17, ry: 0.10, ramo: 'GMM' }
};

// Tabla 2 del Cuaderno ajustada a escalones reales
const MetasTraining = {
    1: { comision: 9000, vidas: 3 },
    2: { comision: 15000, vidas: 6 },
    3: { comision: 21000, vidas: 9 },
    4: { comision: 31000, vidas: 12 },
    5: { comision: 39000, vidas: 14 },
    6: { comision: 50000, vidas: 15 },
    7: { comision: 9000, vidas: 3 },
    8: { comision: 15000, vidas: 6 },
    9: { comision: 21000, vidas: 9 },
    10: { comision: 31000, vidas: 12 },
    11: { comision: 39000, vidas: 14 },
    12: { comision: 50000, vidas: 15 }
};

export function renderComisiones() {
    return `<div id="comisiones-bi-container" style="min-height: 60vh;">
                <div style="text-align:center; padding:40px; color:var(--text-secondary);">Sincronizando motor financiero...</div>
            </div>`;
}

export async function bindComisionesEvents() {
    const container = document.getElementById('comisiones-bi-container');
    if (!container) return;

    const supabase = getSupabase();
    if (!supabase) {
        container.innerHTML = `<div class="card" style="color:var(--danger);">Error: Sin conexión a BD.</div>`;
        return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: perfiles } = await supabase.from('perfil_asesor').select('*').eq('user_id', user.id);
    const perfil = perfiles && perfiles.length > 0 ? perfiles[0] : null;

    if (!perfil) {
        container.innerHTML = `
            <div class="card" style="border-left: 4px solid var(--accent);">
                <h2>⚙️ Calibración de Cuaderno</h2>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <select id="cfg-esquema">
                        <option value="Desarrollo">Asesor en Desarrollo (Mes 1 a 12)</option>
                        <option value="Profesional">Nuevo Profesional (Mes 13+)</option>
                    </select>
                    <input type="date" id="cfg-fecha">
                    <button id="btn-guardar-perfil" class="btn-primary">Iniciar Motor</button>
                </div>
            </div>`;

        document.getElementById('btn-guardar-perfil').addEventListener('click', async () => {
            const esquema = document.getElementById('cfg-esquema').value;
            const fecha = document.getElementById('cfg-fecha').value;
            if (!fecha) return alert('Debes ingresar fecha.');
            await supabase.from('perfil_asesor').insert([{ user_id: user.id, esquema, fecha_conexion: fecha }]);
            window.navigateTo('comisiones');
        });
        return;
    }

    // Interfaz del Dashboard (Mantenemos la estructura UI exacta)
    container.innerHTML = `
        <div class="widget-grid">
            <div class="widget widget-full" style="padding:10px 16px; border:1px dashed var(--danger); background:rgba(255,59,48,0.05);">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:11px; font-weight:600;">⚙️ MODO DESARROLLADOR:</span>
                    <button id="btn-reset-conexion" style="padding:4px 10px !important; font-size:11px; background:var(--danger) !important; color:white !important; border:none;">Reset</button>
                </div>
                <p style="font-size:10px; margin-top:2px;">Esquema: <strong>${perfil.esquema}</strong> | Nube: <strong>${perfil.fecha_conexion}</strong></p>
            </div>
            <div class="widget widget-full" style="background: var(--accent); color: white;">
                <span class="widget-title" style="color: rgba(255,255,255,0.85);">Ganancias Mensuales (Actuales)</span>
                <span id="fin-total" class="widget-value" style="color: white; font-size: 26px;">$0.00</span>
            </div>
            <div class="widget"><span class="widget-title">Iniciales Mes</span><span id="fin-inicial" class="widget-value" style="color: var(--success);">$0.00</span></div>
            <div class="widget"><span class="widget-title">Renovación Mes</span><span id="fin-renovacion" class="widget-value" style="color: var(--warning);">$0.00</span></div>
            <div class="widget widget-full">
                <span class="widget-title" id="titulo-bono">Bono del Mes</span>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span id="fin-bono-proyectado" class="widget-value">$0.00</span>
                    <span id="fin-puntos" class="badge badge-blue">0 Puntos</span>
                </div>
                <p id="brecha-bono" style="font-size: 12px; margin-top: 8px;"></p>
            </div>
            <div class="widget widget-full">
                <span class="widget-title">Histórico Real (Últimos 6 meses)</span>
                <div id="chart-container" style="display:flex; align-items:flex-end; gap:8px; height:110px; margin-top:15px; border-bottom:1px solid var(--separator);"></div>
                <div id="chart-labels" style="display:flex; justify-content:space-between; margin-top:6px; font-size:9px;"></div>
            </div>
        </div>`;

    document.getElementById('btn-reset-conexion').addEventListener('click', async () => {
        await supabase.from('perfil_asesor').delete().eq('user_id', user.id);
        window.navigateTo('comisiones');
    });

    const listado = await DB.obtenerTodos('cartera');
    const formatear = (n) => new Intl.NumberFormat('es-MX', {style:'currency', currency:'MXN'}).format(n);
    
    const hoy = new Date();
    const fConexion = new Date(perfil.fecha_conexion + 'T12:00:00');
    let mesConcurso = Math.floor((hoy - fConexion) / (1000 * 60 * 60 * 24 * 30.44)) + 1;
    if (mesConcurso < 1) mesConcurso = 1;

    let comisionInicialMes = 0;
    let comisionRenovacionMes = 0;
    let puntosConcursoValidos = 0;

    // Configurar los 6 meses reales
    const barrasValores = Array(6).fill(0);
    const barrasEtiquetas = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
        barrasEtiquetas.push(d.toLocaleString('es-MX', {month:'short'}).toUpperCase());
    }

    listado.forEach((p) => {
        if (!p.emision) return;
        const fEmision = new Date(p.emision + 'T12:00:00');
        const fPago = p.fechaPago ? new Date(p.fechaPago + 'T12:00:00') : fEmision;
        
        const añosAntiguedad = (fPago.getFullYear() - fEmision.getFullYear()) + ((fPago.getMonth() - fEmision.getMonth()) / 12);
        const planLimpio = (p.plan || '').trim();
        const tasa = TablaComisiones[planLimpio] || { nn: 0.10, ry: 0.05, ramo: 'Vida' };
        
        let factorFraccion = p.formaPago === 'Mensual' ? 1/12 : p.formaPago === 'Trimestral' ? 1/4 : p.formaPago === 'Semestral' ? 1/2 : 1;
        const primaNeta = Number(String(p.prima).replace(/[^0-9.-]+/g,"")) || 0;
        const primaFraccionada = primaNeta * factorFraccion;

        // Distribución en la gráfica basada en mes de emisión/pago real
        const diffMeses = (hoy.getFullYear() - fPago.getFullYear()) * 12 + (hoy.getMonth() - fPago.getMonth());
        
        // Es póliza de primer año (Inicial)?
        const esInicial = añosAntiguedad < 1;
        const factorEsquema = (perfil.esquema === 'Desarrollo' && tasa.ramo === 'Vida') ? 0.90 : 1.0;
        const ganancia = esInicial ? primaFraccionada * (tasa.nn * factorEsquema) : primaFraccionada * tasa.ry;

        // Si la póliza corresponde al mes en curso
        if (diffMeses === 0) {
            if (esInicial) {
                comisionInicialMes += ganancia;
                if (!p.esPersonal) {
                    puntosConcursoValidos += (tasa.ramo === 'GMM' && primaNeta >= 10000) ? 0.5 : (primaNeta >= 65001 ? 2 : 1);
                }
            } else {
                comisionRenovacionMes += ganancia;
            }
        }

        // Si pertenece a los últimos 6 meses, asignarla a su barra correspondiente
        if (diffMeses >= 0 && diffMeses <= 5) {
            const indexBarra = 5 - diffMeses; // 0 es hace 5 meses, 5 es el actual
            barrasValores[indexBarra] += ganancia;
        }
    });

    document.getElementById('fin-total').innerText = formatear(comisionInicialMes + comisionRenovacionMes);
    document.getElementById('fin-inicial').innerText = formatear(comisionInicialMes);
    document.getElementById('fin-renovacion').innerText = formatear(comisionRenovacionMes);
    document.getElementById('fin-puntos').innerText = `${puntosConcursoValidos} Vidas (Mes Actual)`;

    const txtBrecha = document.getElementById('brecha-bono');
    const valBono = document.getElementById('fin-bono-proyectado');
    
    if (perfil.esquema === 'Desarrollo') {
        document.getElementById('titulo-bono').innerText = `Training Allowance (Mes ${mesConcurso})`;
        const regla = MetasTraining[mesConcurso] || { comision: 50000, vidas: 15 };
        const faltaCom = Math.max(0, regla.comision - comisionInicialMes);
        const faltaVid = Math.max(0, regla.vidas - puntosConcursoValidos);

        if (faltaCom === 0 && faltaVid === 0) {
            valBono.innerText = formatear(comisionInicialMes * 0.15);
            txtBrecha.innerHTML = `<span style="color:var(--success);">✅ Bono del mes asegurado.</span>`;
        } else {
            valBono.innerText = '$0.00';
            txtBrecha.innerHTML = `Faltan: <strong>${formatear(faltaCom)}</strong> (Comisión) y <strong>${faltaVid} vidas</strong>.`;
        }
    }

    const maxG = Math.max(...barrasValores, 1);
    document.getElementById('chart-container').innerHTML = barrasValores.map(v => 
        `<div style="flex:1; background:var(--accent); border-radius:6px 6px 0 0; height:${(v/maxG)*100}%; position:relative; min-height:4px;">
            <span style="position:absolute; top:-16px; left:50%; transform:translateX(-50%); font-size:9px; color:var(--text-secondary);">${Math.round(v/1000)}k</span>
        </div>`
    ).join('');
    document.getElementById('chart-labels').innerHTML = barrasEtiquetas.map(m => `<div style="flex:1; text-align:center;">${m}</div>`).join('');
}
