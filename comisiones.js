// comisiones.js — FULL SAFE RECOVERY BUILD v15 (BETA)
// REBUILD COMPLETO
// Compatible con:
// - app.js actual
// - Router SPA
// - Supabase global
// - Samsung Internet
// - Chrome Android
// - Service Worker v6

console.log('COMISIONES V15 BETA SAFE');

import { DB } from './db.js';
import { showToast } from './utils.js';

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

const fmtMoney = n => {
    return new Intl.NumberFormat(
        'es-MX',
        {
            style: 'currency',
            currency: 'MXN'
        }
    ).format(n || 0);
};

function getSupabaseClient() {
    if (!window.supabaseClient) {
        throw new Error('Supabase client no inicializado');
    }
    return window.supabaseClient;
}

async function getCurrentUser() {
    const sb = getSupabaseClient();
    const { data, error } = await sb.auth.getUser();

    if (error) throw error;
    if (!data?.user) throw new Error('Sesión inválida');

    return data.user;
}

// ═══════════════════════════════════════════════════════════════
// MAIN RENDER
// ═══════════════════════════════════════════════════════════════

export function renderComisiones() {
    return `
    <div id="fin-root" style="min-height:100%; display:flex; align-items:center; justify-content:center; padding:24px;">
        <div style="display:flex; flex-direction:column; align-items:center; gap:16px;">
            <div style="width:42px; height:42px; border-radius:50%; border:3px solid var(--separator); border-top-color:var(--accent); animation:spin .8s linear infinite;"></div>
            <div style="font-size:13px; color:var(--text-secondary);">Cargando módulo financiero...</div>
        </div>
    </div>
    <style>
    @keyframes spin { to { transform:rotate(360deg); } }
    </style>
    `;
}

// ═══════════════════════════════════════════════════════════════
// ENTRYPOINT
// ═══════════════════════════════════════════════════════════════

export async function bindComisionesEvents() {
    console.log('[COMISIONES] INIT');
    const root = document.getElementById('fin-root');

    if (!root) {
        console.error('[COMISIONES] ROOT NOT FOUND');
        return;
    }

    try {
        const user = await getCurrentUser();
        console.log('[COMISIONES] USER OK', user.id);

        const perfil = await loadPerfil(user.id);
        console.log('[COMISIONES] PERFIL', perfil);

        if (!perfil) {
            console.log('[COMISIONES] SHOW CONFIG');
            root.innerHTML = renderSetupScreen();
            bindSetupEvents();
            return;
        }

        console.log('[COMISIONES] SHOW DASHBOARD');
        root.innerHTML = renderDashboard(perfil);
        bindDashboardEvents(perfil);

    } catch (err) {
        console.error('[COMISIONES] FATAL', err);
        root.innerHTML = `
        <div style="padding:32px; text-align:center;">
            <div style="font-size:56px; margin-bottom:16px;">⚠️</div>
            <div style="font-size:20px; font-weight:700; margin-bottom:8px;">Error cargando módulo</div>
            <div style="color:var(--danger); font-size:14px; line-height:1.5;">${err.message}</div>
        </div>
        `;
    }
}

// ═══════════════════════════════════════════════════════════════
// LOAD PERFIL
// ═══════════════════════════════════════════════════════════════

async function loadPerfil(userId) {
    try {
        const sb = getSupabaseClient();
        const { data, error } = await sb
            .from('crm_data')
            .select('*')
            .eq('user_id', userId)
            .eq('coleccion', 'perfil_asesor')
            .maybeSingle();

        if (error) {
            console.error('[LOAD PERFIL]', error);
            return null;
        }

        if (!data) return null;

        return { id: data.id, ...data.datos };
    } catch (err) {
        console.error(err);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════
// SETUP SCREEN
// ═══════════════════════════════════════════════════════════════

function renderSetupScreen(perfil = null) {
    const valFecha = perfil?.fecha_conexion || '';
    const valLimra = perfil?.limra || 75.5;
    const valIgc = perfil?.igc || 91;
    const isEdit = !!perfil;

    return `
    <div style="width:100%; display:flex; align-items:center; justify-content:center; padding:20px;">
        <div class="card" style="width:100%; max-width:460px; border-left:4px solid var(--accent);">
            <div style="font-size:30px; text-align:center; margin-bottom:10px;">🧩</div>
            <div style="text-align:center; font-size:22px; font-weight:700; margin-bottom:8px;">
                ${isEdit ? 'Editar Motor Financiero' : 'Configurar Motor Financiero'}
            </div>
            <div style="text-align:center; font-size:13px; color:var(--text-secondary); line-height:1.5; margin-bottom:24px;">
                Configura tu esquema profesional
            </div>
            <div style="display:flex; flex-direction:column; gap:18px;">
                <div>
                    <label style="font-size:12px; font-weight:600; color:var(--text-secondary);">Fecha de conexión</label>
                    <input type="date" id="cfg-fecha" value="${valFecha}" style="width:100%; margin-top:6px;" />
                </div>
                <div>
                    <label style="font-size:12px; font-weight:600; color:var(--text-secondary);">LIMRA %</label>
                    <input type="number" id="cfg-limra" value="${valLimra}" step="0.1" min="0" max="100" style="width:100%; margin-top:6px;" />
                </div>
                <div>
                    <label style="font-size:12px; font-weight:600; color:var(--text-secondary);">IGC %</label>
                    <input type="number" id="cfg-igc" value="${valIgc}" step="0.1" min="0" max="100" style="width:100%; margin-top:6px;" />
                </div>
                
                <div style="display:flex; gap:12px; margin-top:8px;">
                    ${isEdit ? `<button id="btn-cancel-profile" class="btn-secondary" style="flex:1;">Cancelar</button>` : ''}
                    <button id="btn-save-profile" class="btn-primary" style="flex:2;">
                        ${isEdit ? '💾 Guardar Cambios' : '🚀 Iniciar Motor'}
                    </button>
                </div>
            </div>
        </div>
    </div>
    `;
}

// ═══════════════════════════════════════════════════════════════
// SETUP EVENTS
// ═══════════════════════════════════════════════════════════════

function bindSetupEvents(perfilExistente = null) {
    const btnSave = document.getElementById('btn-save-profile');
    const btnCancel = document.getElementById('btn-cancel-profile');

    if (btnCancel) {
        btnCancel.addEventListener('click', () => {
            const root = document.getElementById('fin-root');
            root.innerHTML = renderDashboard(perfilExistente);
            bindDashboardEvents(perfilExistente);
        });
    }

    if (!btnSave) return;

    btnSave.addEventListener('click', async () => {
        try {
            btnSave.disabled = true;
            const fecha = document.getElementById('cfg-fecha').value;
            const limra = parseFloat(document.getElementById('cfg-limra').value) || 75.5;
            const igc = parseFloat(document.getElementById('cfg-igc').value) || 91;

            if (!fecha) {
                showToast('Selecciona fecha', 'danger');
                btnSave.disabled = false;
                return;
            }

            const user = await getCurrentUser();
            const sb = getSupabaseClient();
            const payload = {
                id: 'perfil_' + user.id,
                user_id: user.id,
                coleccion: 'perfil_asesor',
                datos: {
                    fecha_conexion: fecha,
                    limra,
                    igc,
                    esquema: 'PROFESIONAL'
                }
            };

            const { error } = await sb.from('crm_data').upsert(payload, { onConflict: 'id' });
            if (error) throw error;

            try {
                await DB.guardar('perfil_asesor', { id: payload.id, ...payload.datos });
            } catch (localErr) {
                console.warn('[LOCAL SAVE]', localErr);
            }

            showToast('✅ Perfil guardado', 'success');

            // Actualizar vista dinámicamente sin recargar la ruta
            const root = document.getElementById('fin-root');
            const updatedPerfil = { id: payload.id, ...payload.datos };
            root.innerHTML = renderDashboard(updatedPerfil);
            bindDashboardEvents(updatedPerfil);

        } catch (err) {
            console.error('[SAVE FATAL]', err);
            showToast(err.message || 'Error al guardar', 'danger');
            btnSave.disabled = false;
        }
    });
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════

function renderDashboard(perfil) {
    return `
    <div style="padding:18px; display:flex; flex-direction:column; gap:18px; width:100%; max-width:600px; margin:0 auto;">
        <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-size:13px; color:var(--text-secondary); margin-bottom:6px;">Motor Financiero</div>
                    <div style="font-size:24px; font-weight:700;">Profesional</div>
                </div>
                <button id="btn-edit-profile" class="btn-secondary">✏️ Editar</button>
            </div>
        </div>

        <div class="card">
            <div style="display:grid; grid-template-columns: repeat(auto-fit,minmax(140px,1fr)); gap:18px;">
                <div>
                    <div style="font-size:12px; color:var(--text-secondary); margin-bottom:4px;">Fecha conexión</div>
                    <div style="font-size:18px; font-weight:700;">${perfil.fecha_conexion}</div>
                </div>
                <div>
                    <div style="font-size:12px; color:var(--text-secondary); margin-bottom:4px;">LIMRA</div>
                    <div style="font-size:18px; font-weight:700;">${perfil.limra}%</div>
                </div>
                <div>
                    <div style="font-size:12px; color:var(--text-secondary); margin-bottom:4px;">IGC</div>
                    <div style="font-size:18px; font-weight:700;">${perfil.igc}%</div>
                </div>
            </div>
        </div>

        <button id="btn-continuar" class="btn-primary" style="margin-top:8px; padding:16px; font-size:16px;">
            📊 Calcular Comisiones
        </button>
    </div>
    `;
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD EVENTS
// ═══════════════════════════════════════════════════════════════

function bindDashboardEvents(perfil) {
    document.getElementById('btn-edit-profile')?.addEventListener('click', () => {
        const root = document.getElementById('fin-root');
        root.innerHTML = renderSetupScreen(perfil);
        bindSetupEvents(perfil);
    });

    document.getElementById('btn-continuar')?.addEventListener('click', async () => {
        const root = document.getElementById('fin-root');
        
        // Pantalla de carga transitoria
        root.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:300px; gap:16px;">
            <div style="width:42px; height:42px; border-radius:50%; border:3px solid var(--separator); border-top-color:var(--accent); animation:spin .8s linear infinite;"></div>
            <div style="font-size:14px; color:var(--text-secondary);">Procesando cartera local...</div>
        </div>`;

        try {
            const resultados = await calcularResumenComisiones();
            root.innerHTML = renderPanelComisiones(perfil, resultados);
            
            document.getElementById('btn-volver-resumen')?.addEventListener('click', () => {
                root.innerHTML = renderDashboard(perfil);
                bindDashboardEvents(perfil);
            });
            
        } catch (error) {
            console.error('Error al calcular:', error);
            showToast('Error procesando la cartera', 'danger');
            root.innerHTML = renderDashboard(perfil);
            bindDashboardEvents(perfil);
        }
    });
}

// ═══════════════════════════════════════════════════════════════
// CÁLCULO BETA
// ═══════════════════════════════════════════════════════════════

async function calcularResumenComisiones() {
    const cartera = await DB.obtenerTodos('cartera') || [];
    let produccion = 0;
    let inicial = 0;
    let renovacion = 0;
    let polizas = 0;

    for (const p of cartera) {
        // Excluir pólizas personales
        if (p.esPersonal === true || p.esPersonal === 'SI' || String(p.esPersonal).toUpperCase() === 'SÍ') {
            continue;
        }

        // Ignorar si faltan fechas base
        if (!p.emision || !p.fechaPago) {
            continue;
        }

        polizas++;
        const prima = Number(p.prima) || 0;
        produccion += prima;

        const emision = new Date(p.emision + 'T12:00:00');
        const aniversario = new Date(emision);
        aniversario.setFullYear(aniversario.getFullYear() + 1);
        const fechaPago = new Date(p.fechaPago + 'T12:00:00');

        if (fechaPago <= aniversario) {
            inicial += prima;
        } else {
            renovacion += prima;
        }
    }

    return { polizas, produccion, inicial, renovacion };
}

// ═══════════════════════════════════════════════════════════════
// PANEL FINAL BETA
// ═══════════════════════════════════════════════════════════════

function renderPanelComisiones(perfil, resultados) {
    return `
    <div style="padding:18px; display:flex; flex-direction:column; gap:18px; width:100%; max-width:600px; margin:0 auto;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size:20px; font-weight:700;">Resultados (Beta)</div>
            <button id="btn-volver-resumen" class="btn-secondary" style="padding:6px 12px; font-size:12px;">Volver</button>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
            <div class="card" style="display:flex; flex-direction:column; align-items:center; padding:16px;">
                <div style="font-size:12px; color:var(--text-secondary); margin-bottom:4px;">Pólizas Computables</div>
                <div style="font-size:24px; font-weight:700; color:var(--accent);">${resultados.polizas}</div>
            </div>
            
            <div class="card" style="display:flex; flex-direction:column; align-items:center; padding:16px;">
                <div style="font-size:12px; color:var(--text-secondary); margin-bottom:4px;">Producción Total</div>
                <div style="font-size:20px; font-weight:700; color:var(--success);">${fmtMoney(resultados.produccion)}</div>
            </div>
        </div>

        <div class="card" style="padding:20px;">
            <div style="font-size:14px; font-weight:700; margin-bottom:16px; border-bottom:1px solid var(--separator); padding-bottom:8px;">
                Desglose por Antigüedad
            </div>
            
            <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
                <span style="color:var(--text-secondary); font-size:14px;">Prima Inicial (Año 1)</span>
                <span style="font-weight:600;">${fmtMoney(resultados.inicial)}</span>
            </div>
            
            <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--text-secondary); font-size:14px;">Prima Renovación (> Año 1)</span>
                <span style="font-weight:600;">${fmtMoney(resultados.renovacion)}</span>
            </div>
        </div>
    </div>
    `;
}
