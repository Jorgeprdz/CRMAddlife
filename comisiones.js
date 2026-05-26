// comisiones.js — FULL SAFE RECOVERY BUILD v14
// REBUILD COMPLETO
// Compatible con:
// - app.js actual
// - Router SPA
// - Supabase global
// - Samsung Internet
// - Chrome Android
// - Service Worker v6

console.log('COMISIONES V14 SAFE');

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

        throw new Error(
            'Supabase client no inicializado'
        );
    }

    return window.supabaseClient;
}

async function getCurrentUser() {

    const sb = getSupabaseClient();

    const {
        data,
        error
    } = await sb.auth.getUser();

    if (error) {
        throw error;
    }

    if (!data?.user) {

        throw new Error(
            'Sesión inválida'
        );
    }

    return data.user;
}

// ═══════════════════════════════════════════════════════════════
// MAIN RENDER
// ═══════════════════════════════════════════════════════════════

export function renderComisiones() {

    return `
    <div
        id="fin-root"
        style="
            min-height:100%;
            display:flex;
            align-items:center;
            justify-content:center;
            padding:24px;
        "
    >

        <div
            style="
                display:flex;
                flex-direction:column;
                align-items:center;
                gap:16px;
            "
        >

            <div
                style="
                    width:42px;
                    height:42px;
                    border-radius:50%;
                    border:3px solid var(--separator);
                    border-top-color:var(--accent);
                    animation:spin .8s linear infinite;
                "
            ></div>

            <div
                style="
                    font-size:13px;
                    color:var(--text-secondary);
                "
            >
                Cargando módulo financiero...
            </div>

        </div>

    </div>

    <style>

    @keyframes spin {

        to {
            transform:rotate(360deg);
        }

    }

    </style>
    `;
}

// ═══════════════════════════════════════════════════════════════
// ENTRYPOINT
// ═══════════════════════════════════════════════════════════════

export async function bindComisionesEvents() {

    console.log(
        '[COMISIONES] INIT'
    );

    const root =
        document.getElementById(
            'fin-root'
        );

    if (!root) {

        console.error(
            '[COMISIONES] ROOT NOT FOUND'
        );

        return;
    }

    try {

        const user =
            await getCurrentUser();

        console.log(
            '[COMISIONES] USER OK',
            user.id
        );

        const perfil =
            await loadPerfil(
                user.id
            );

        console.log(
            '[COMISIONES] PERFIL',
            perfil
        );

        if (!perfil) {

            console.log(
                '[COMISIONES] SHOW CONFIG'
            );

            root.innerHTML =
                renderSetupScreen();

            bindSetupEvents();

            return;
        }

        console.log(
            '[COMISIONES] SHOW DASHBOARD'
        );

        root.innerHTML =
            renderDashboard(
                perfil
            );

        bindDashboardEvents(
            perfil
        );

    } catch (err) {

        console.error(
            '[COMISIONES] FATAL',
            err
        );

        root.innerHTML = `
        <div
            style="
                padding:32px;
                text-align:center;
            "
        >

            <div
                style="
                    font-size:56px;
                    margin-bottom:16px;
                "
            >
                ⚠️
            </div>

            <div
                style="
                    font-size:20px;
                    font-weight:700;
                    margin-bottom:8px;
                "
            >
                Error cargando módulo
            </div>

            <div
                style="
                    color:var(--danger);
                    font-size:14px;
                    line-height:1.5;
                "
            >
                ${err.message}
            </div>

        </div>
        `;
    }
}

// ═══════════════════════════════════════════════════════════════
// LOAD PERFIL
// ═══════════════════════════════════════════════════════════════

async function loadPerfil(userId) {

    try {

        const sb =
            getSupabaseClient();

        const {
            data,
            error
        } = await sb
            .from('crm_data')
            .select('*')
            .eq('user_id', userId)
            .eq(
                'coleccion',
                'perfil_asesor'
            )
            .maybeSingle();

        if (error) {

            console.error(
                '[LOAD PERFIL]',
                error
            );

            return null;
        }

        if (!data) {
            return null;
        }

        return {

            id: data.id,

            ...data.datos
        };

    } catch (err) {

        console.error(err);

        return null;
    }
}

// ═══════════════════════════════════════════════════════════════
// SETUP SCREEN
// ═══════════════════════════════════════════════════════════════

function renderSetupScreen() {

    return `
    <div
        style="
            width:100%;
            display:flex;
            align-items:center;
            justify-content:center;
            padding:20px;
        "
    >

        <div
            class="card"
            style="
                width:100%;
                max-width:460px;
                border-left:4px solid var(--accent);
            "
        >

            <div
                style="
                    font-size:30px;
                    text-align:center;
                    margin-bottom:10px;
                "
            >
                🧩
            </div>

            <div
                style="
                    text-align:center;
                    font-size:22px;
                    font-weight:700;
                    margin-bottom:8px;
                "
            >
                Configurar Motor Financiero
            </div>

            <div
                style="
                    text-align:center;
                    font-size:13px;
                    color:var(--text-secondary);
                    line-height:1.5;
                    margin-bottom:24px;
                "
            >
                Configura tu esquema profesional
            </div>

            <div
                style="
                    display:flex;
                    flex-direction:column;
                    gap:18px;
                "
            >

                <div>

                    <label
                        style="
                            font-size:12px;
                            font-weight:600;
                            color:var(--text-secondary);
                        "
                    >
                        Fecha de conexión
                    </label>

                    <input
                        type="date"
                        id="cfg-fecha"
                        style="
                            width:100%;
                            margin-top:6px;
                        "
                    />

                </div>

                <div>

                    <label
                        style="
                            font-size:12px;
                            font-weight:600;
                            color:var(--text-secondary);
                        "
                    >
                        LIMRA %
                    </label>

                    <input
                        type="number"
                        id="cfg-limra"
                        value="75.5"
                        step="0.1"
                        min="0"
                        max="100"
                        style="
                            width:100%;
                            margin-top:6px;
                        "
                    />

                </div>

                <div>

                    <label
                        style="
                            font-size:12px;
                            font-weight:600;
                            color:var(--text-secondary);
                        "
                    >
                        IGC %
                    </label>

                    <input
                        type="number"
                        id="cfg-igc"
                        value="91"
                        step="0.1"
                        min="0"
                        max="100"
                        style="
                            width:100%;
                            margin-top:6px;
                        "
                    />

                </div>

                <button
                    id="btn-save-profile"
                    class="btn-primary"
                >
                    🚀 Iniciar Motor Financiero
                </button>

            </div>

        </div>

    </div>
    `;
}

// ═══════════════════════════════════════════════════════════════
// SETUP EVENTS
// ═══════════════════════════════════════════════════════════════

function bindSetupEvents() {

    const btn =
        document.getElementById(
            'btn-save-profile'
        );

    if (!btn) return;

    btn.addEventListener(
        'click',
        async () => {

            try {

                btn.disabled = true;

                const fecha =
                    document.getElementById(
                        'cfg-fecha'
                    ).value;

                const limra =
                    parseFloat(
                        document.getElementById(
                            'cfg-limra'
                        ).value
                    ) || 75.5;

                const igc =
                    parseFloat(
                        document.getElementById(
                            'cfg-igc'
                        ).value
                    ) || 91;

                if (!fecha) {

                    showToast(
                        'Selecciona fecha',
                        'danger'
                    );

                    btn.disabled = false;

                    return;
                }

                const user =
                    await getCurrentUser();

                const sb =
                    getSupabaseClient();

                const payload = {

                    id:
                        'perfil_' +
                        user.id,

                    user_id:
                        user.id,

                    coleccion:
                        'perfil_asesor',

                    datos: {

                        fecha_conexion:
                            fecha,

                        limra,

                        igc,

                        esquema:
                            'PROFESIONAL'
                    }
                };

                console.log(
                    '[SAVE PERFIL]',
                    payload
                );

                const {
                    error
                } = await sb
                    .from('crm_data')
                    .upsert(
                        payload,
                        {
                            onConflict:'id'
                        }
                    );

                if (error) {

                    console.error(
                        '[UPSERT ERROR]',
                        error
                    );

                    throw error;
                }

                try {

                    await DB.guardar(
                        'perfil_asesor',
                        {
                            id: payload.id,
                            ...payload.datos
                        }
                    );

                } catch (localErr) {

                    console.warn(
                        '[LOCAL SAVE]',
                        localErr
                    );
                }

                showToast(
                    '✅ Perfil guardado',
                    'success'
                );

                setTimeout(() => {

                    if (
                        window.navigateTo
                    ) {

                        window.navigateTo(
                            'comisiones'
                        );

                    } else {

                        window.location.reload();

                    }

                }, 450);

            } catch (err) {

                console.error(
                    '[SAVE FATAL]',
                    err
                );

                showToast(
                    err.message ||
                    'Error al guardar',
                    'danger'
                );

                btn.disabled = false;
            }
        }
    );
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════

function renderDashboard(
    perfil
) {

    return `
    <div
        style="
            padding:18px;
            display:flex;
            flex-direction:column;
            gap:18px;
        "
    >

        <div class="card">

            <div
                style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                "
            >

                <div>

                    <div
                        style="
                            font-size:13px;
                            color:var(--text-secondary);
                            margin-bottom:6px;
                        "
                    >
                        Motor Financiero
                    </div>

                    <div
                        style="
                            font-size:24px;
                            font-weight:700;
                        "
                    >
                        Profesional
                    </div>

                </div>

                <button
                    id="btn-edit-profile"
                    class="btn-secondary"
                >
                    ✏️ Editar
                </button>

            </div>

        </div>

        <div class="card">

            <div
                style="
                    display:grid;
                    grid-template-columns:
                    repeat(auto-fit,minmax(180px,1fr));
                    gap:18px;
                "
            >

                <div>

                    <div
                        style="
                            font-size:12px;
                            color:var(--text-secondary);
                            margin-bottom:4px;
                        "
                    >
                        Fecha conexión
                    </div>

                    <div
                        style="
                            font-size:18px;
                            font-weight:700;
                        "
                    >
                        ${perfil.fecha_conexion}
                    </div>

                </div>

                <div>

                    <div
                        style="
                            font-size:12px;
                            color:var(--text-secondary);
                            margin-bottom:4px;
                        "
                    >
                        LIMRA
                    </div>

                    <div
                        style="
                            font-size:18px;
                            font-weight:700;
                        "
                    >
                        ${perfil.limra}%
                    </div>

                </div>

                <div>

                    <div
                        style="
                            font-size:12px;
                            color:var(--text-secondary);
                            margin-bottom:4px;
                        "
                    >
                        IGC
                    </div>

                    <div
                        style="
                            font-size:18px;
                            font-weight:700;
                        "
                    >
                        ${perfil.igc}%
                    </div>

                </div>

            </div>

        </div>

    </div>
    `;
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD EVENTS
// ═══════════════════════════════════════════════════════════════

function bindDashboardEvents() {

    document
        .getElementById(
            'btn-edit-profile'
        )
        ?.addEventListener(
            'click',
            () => {

                if (
                    window.navigateTo
                ) {

                    window.navigateTo(
                        'comisiones'
                    );

                } else {

                    window.location.reload();

                }
            }
        );
}