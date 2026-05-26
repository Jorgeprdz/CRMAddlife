// comisiones.js — Motor Financiero SMNYL v13 HOTFIX
// FIX:
// - elimina import roto getSupabase
// - compatible con app.js v6
// - compatible con router SPA
// - compatible con Supabase global

console.log('COMISIONES V13 HOTFIX');

import { DB } from './db.js';
import { showToast } from './utils.js';

// ═══════════════════════════════════════════════════════════════
// FORMATTERS
// ═══════════════════════════════════════════════════════════════

const fmt = n =>
    new Intl.NumberFormat(
        'es-MX',
        {
            style: 'currency',
            currency: 'MXN'
        }
    ).format(n || 0);

// ═══════════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════════

export function renderComisiones() {

    return `
    <div
        id="fin-root"
        style="
            display:flex;
            flex-direction:column;
            align-items:center;
            justify-content:center;
            min-height:60vh;
            gap:12px;
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

        <p
            style="
                font-size:13px;
                color:var(--text-secondary);
            "
        >
            Cargando módulo financiero...
        </p>

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
// INIT
// ═══════════════════════════════════════════════════════════════

export async function bindComisionesEvents() {

    const root =
        document.getElementById('fin-root');

    if (!root) return;

    try {

        const sb =
            window.supabaseClient;

        if (!sb) {
            throw new Error(
                'Supabase no inicializado'
            );
        }

        const {
            data: { user }
        } = await sb.auth.getUser();

        if (!user) {
            throw new Error(
                'Sesión inválida'
            );
        }

        let perfil = null;

        // ═══════════════════════════════════════
        // LOCAL
        // ═══════════════════════════════════════

        try {

            const local =
                await DB.obtenerTodos(
                    'perfil_asesor'
                );

            if (local?.length) {
                perfil = local[0];
            }

        } catch (err) {

            console.warn(err);
        }

        // ═══════════════════════════════════════
        // REMOTO
        // ═══════════════════════════════════════

        try {

            const {
                data,
                error
            } = await sb
                .from('crm_data')
                .select('*')
                .eq('user_id', user.id)
                .eq(
                    'coleccion',
                    'perfil_asesor'
                )
                .maybeSingle();

            if (!error && data?.datos) {

                perfil = {
                    ...perfil,
                    ...data.datos
                };
            }

        } catch (err) {

            console.warn(err);
        }

        // ═══════════════════════════════════════
        // CONFIG
        // ═══════════════════════════════════════

        if (
            !perfil ||
            !perfil.fecha_conexion
        ) {

            root.innerHTML =
                renderConfigScreen();

            bindConfigEvents();

            return;
        }

        // ═══════════════════════════════════════
        // DASHBOARD
        // ═══════════════════════════════════════

        root.innerHTML =
            renderDashboard(
                perfil
            );

        bindDashboard(
            perfil
        );

    } catch (err) {

        console.error(err);

        root.innerHTML = `
        <div
            style="
                padding:32px;
                text-align:center;
            "
        >

            <div
                style="
                    font-size:48px;
                    margin-bottom:12px;
                "
            >
                ⚠️
            </div>

            <h2>Error cargando módulo</h2>

            <p
                style="
                    color:var(--danger);
                    margin-top:8px;
                "
            >
                ${err.message}
            </p>

        </div>
        `;
    }
}

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════

function renderConfigScreen() {

    return `
    <div
        style="
            min-height:100%;
            display:flex;
            align-items:center;
            justify-content:center;
            padding:18px;
        "
    >

        <div
            class="card"
            style="
                width:100%;
                max-width:420px;
                border-left:4px solid var(--accent);
            "
        >

            <h2
                style="
                    margin-bottom:18px;
                    text-align:center;
                "
            >
                Configurar Motor Financiero
            </h2>

            <div
                style="
                    display:flex;
                    flex-direction:column;
                    gap:16px;
                "
            >

                <div>

                    <label>
                        Fecha conexión
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

                    <label>
                        LIMRA %
                    </label>

                    <input
                        type="number"
                        id="cfg-limra"
                        value="75.5"
                        step="0.1"
                        style="
                            width:100%;
                            margin-top:6px;
                        "
                    />

                </div>

                <div>

                    <label>
                        IGC %
                    </label>

                    <input
                        type="number"
                        id="cfg-igc"
                        value="91"
                        step="0.1"
                        style="
                            width:100%;
                            margin-top:6px;
                        "
                    />

                </div>

                <button
                    id="btn-save-config"
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
// CONFIG EVENTS
// ═══════════════════════════════════════════════════════════════

function bindConfigEvents() {

    document
        .getElementById(
            'btn-save-config'
        )
        ?.addEventListener(
            'click',
            async () => {

                try {

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

                        return;
                    }

                    const sb =
                        window.supabaseClient;

                    const {
                        data: { user }
                    } = await sb.auth.getUser();

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

                    const {
                        error
                    } = await sb
                        .from('crm_data')
                        .upsert(
                            payload
                        );

                    if (error) {
                        throw error;
                    }

                    try {

                        await DB.guardar(
                            'perfil_asesor',
                            {
                                id:
                                    payload.id,

                                ...payload.datos
                            }
                        );

                    } catch (err) {

                        console.warn(err);
                    }

                    showToast(
                        '✅ Perfil guardado',
                        'success'
                    );

                    setTimeout(() => {

                        window.App
                            .router
                            .navigate(
                                'comisiones'
                            );

                    }, 300);

                } catch (err) {

                    console.error(err);

                    showToast(
                        'Error al guardar',
                        'danger'
                    );
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
                            margin-bottom:4px;
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
                    id="btn-edit"
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
                    repeat(auto-fit,minmax(160px,1fr));
                    gap:16px;
                "
            >

                <div>

                    <div
                        style="
                            font-size:12px;
                            color:var(--text-secondary);
                        "
                    >
                        Fecha conexión
                    </div>

                    <div
                        style="
                            font-size:18px;
                            font-weight:700;
                            margin-top:4px;
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
                        "
                    >
                        LIMRA
                    </div>

                    <div
                        style="
                            font-size:18px;
                            font-weight:700;
                            margin-top:4px;
                        "
                    >
                        ${perfil.limra || 75.5}%
                    </div>

                </div>

                <div>

                    <div
                        style="
                            font-size:12px;
                            color:var(--text-secondary);
                        "
                    >
                        IGC
                    </div>

                    <div
                        style="
                            font-size:18px;
                            font-weight:700;
                            margin-top:4px;
                        "
                    >
                        ${perfil.igc || 91}%
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

function bindDashboard(
    perfil
) {

    document
        .getElementById(
            'btn-edit'
        )
        ?.addEventListener(
            'click',
            () => {

                window.App
                    .router
                    .navigate(
                        'comisiones'
                    );
            }
        );
}