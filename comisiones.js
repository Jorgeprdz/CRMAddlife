// comisiones.js - Motor Financiero Preciso
import { DB } from './db.js';
import { getSupabase } from './app.js';
import { showToast } from './utils.js';

const TablaComisiones = {
    'Star Temporal': { nn: 0.35, ry: 0.10, ramo: 'Vida' },
    'Orvi 99': { nn: 0.44, ry: 0.15, ramo: 'Vida' },
    'Segubeca': { nn: 0.37, ry: 0.09, ramo: 'Vida' },
    'Mio': { nn: 0.80, ry: 0.20, ramo: 'Vida' },
    'Alfa Medical': { nn: 0.17, ry: 0.15, ramo: 'GMM' }
};

const MetasTraining = {
    1: { comision: 9000, vidas: 3 }, 2: { comision: 15000, vidas: 6 }, 3: { comision: 21000, vidas: 9 },
    4: { comision: 31000, vidas: 12 }, 5: { comision: 39000, vidas: 14 }, 6: { comision: 50000, vidas: 15 }
};

export function renderComisiones() {
    return `<div id="com-container" style="min-height:60vh; text-align:center; padding:40px;">Cargando motor financiero...</div>`;
}

export async function bindComisionesEvents() {
    const container = document.getElementById('com-container');
    const supabase = getSupabase();
    if (!supabase) return;

    const { data: { user } } = await supabase.auth.getUser();
    const { data: perfiles } = await supabase.from('perfil_asesor').select('*').eq('user_id', user.id);
    const perfil = perfiles && perfiles.length > 0 ? perfiles[0] : null;

    if (!perfil) {
        container.innerHTML = `
            <div class="card">
                <h2>⚙️ Calibración</h2>
                <select id="cfg-esq"><option value="Desarrollo">Asesor en Desarrollo</option></select>
                <input type="date" id="cfg-fec">
                <button id="btn-save" class="btn-primary" style="margin-top:10px;">Guardar Perfil</button>
            </div>`;
        document.getElementById('btn-save').addEventListener('click', async () => {
            const f = document.getElementById('cfg-fec').value;
            if (!f) return showToast('Agrega fecha', 'danger');
            await supabase.from('perfil_asesor').insert([{ user_id: user.id, esquema: document.getElementById('cfg-esq').value, fecha_conexion: f }]);
            window.navigateTo('comisiones');
        });
        return;
    }

    container.innerHTML = `
        <div class="widget-grid">
            <div class="widget widget-full" style="background:var(--accent); color:white;">
                <span class="widget-title" style="color:white;">Ingresos del Mes</span>
                <span id="fin-tot" class="widget-value" style="color:white; font-size:26px;">$0</span>
            </div>
            <div class="widget"><span class="widget-title">Iniciales</span><span id="fin-ini" class="widget-value" style="color:var(--success);">$0</span></div>
            <div class="widget"><span class="widget-title">Renovación</span><span id="fin-ren" class="widget-value" style="color:var(--warning);">$0</span></div>
            <div class="widget widget-full">
                <span class="widget-title" id="tit-bono">Bono</span>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span id="val-bono" class="widget-value">$0</span>
                    <span id="val-puntos" class="badge badge-blue">0 Vidas</span>
                </div>
                <p id="txt-brecha" style="font-size:12px; margin-top:8px;"></p>
            </div>
        </div>
    `;

    const cartera = await DB.obtenerTodos('cartera');
    const hoy = new Date();
    const fConexion = new Date(perfil.fecha_conexion + 'T12:00:00');
    const mesConcurso = Math.max(1, Math.floor((hoy - fConexion) / (1000 * 60 * 60 * 24 * 30.44)) + 1);

    let ini = 0, ren = 0, pts = 0;

    cartera.forEach(p => {
        if (!p.emision) return;
        const fe = new Date(p.emision + 'T12:00:00');
        const fp = p.fechaPago ? new Date(p.fechaPago + 'T12:00:00') : fe;
        const mesesVigencia = (fp.getFullYear() - fe.getFullYear()) * 12 + (fp.getMonth() - fe.getMonth());
        
        const planLimpio = (p.plan || '').trim();
        const tasa = TablaComisiones[planLimpio] || { nn: 0.10, ry: 0.05, ramo: 'Vida' };
        
        let fraccion = p.formaPago === 'Mensual' ? 1/12 : p.formaPago === 'Trimestral' ? 1/4 : p.formaPago === 'Semestral' ? 1/2 : 1;
        const primaNeta = Number(String(p.prima).replace(/[^0-9.-]+/g,"")) || 0;
        const ganancia = primaNeta * fraccion * (mesesVigencia < 12 ? tasa.nn : tasa.ry);

        // Solo sumar lo que corresponde al mes actual en curso
        if (fp.getMonth() === hoy.getMonth() && fp.getFullYear() === hoy.getFullYear()) {
            if (mesesVigencia < 12) {
                ini += ganancia;
                if (!p.esPersonal) pts += (tasa.ramo === 'GMM' && primaNeta >= 10000) ? 0.5 : (primaNeta >= 65001 ? 2 : 1);
            } else {
                ren += ganancia;
            }
        }
    });

    const fmt = n => new Intl.NumberFormat('es-MX', {style:'currency', currency:'MXN'}).format(n);
    document.getElementById('fin-tot').innerText = fmt(ini + ren);
    document.getElementById('fin-ini').innerText = fmt(ini);
    document.getElementById('fin-ren').innerText = fmt(ren);
    document.getElementById('val-puntos').innerText = `${pts} Vidas`;

    const valBono = document.getElementById('val-bono');
    const txtBrecha = document.getElementById('txt-brecha');
    
    if (perfil.esquema === 'Desarrollo') {
        document.getElementById('tit-bono').innerText = `Training Allowance (Mes ${mesConcurso})`;
        const regla = MetasTraining[mesConcurso] || { comision: 50000, vidas: 15 };
        const faltaC = Math.max(0, regla.comision - ini);
        const faltaV = Math.max(0, regla.vidas - pts);

        if (faltaC === 0 && faltaV === 0) {
            valBono.innerText = fmt(ini * 0.15);
            txtBrecha.innerHTML = `<span style="color:var(--success);">✅ Bono calificado.</span>`;
        } else {
            valBono.innerText = '$0.00';
            txtBrecha.innerHTML = `Faltan <strong>${fmt(faltaC)}</strong> y <strong>${faltaV} vidas</strong>.`;
        }
    }
}
