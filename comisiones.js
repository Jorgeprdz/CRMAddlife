// comisiones.js — Motor Financiero SMNYL v13 ESTABLE
// Arquitectura SPA corregida
// Sin reloads
// Compatible con Router AppManager
// Compatible con Supabase RLS
// Compatible con Service Worker v5

console.log('COMISIONES V13 REAL');

import { DB } from './db.js';
import { getSupabase } from './app.js';
import { showToast } from './utils.js';

// ═══════════════════════════════════════════════════════════════
// CONFIG
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
// RENDER LOADER
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

        // ═══════════════════════════════════════════
        // OBTENER PERFIL
        // ═══════════════════════════════════════════

        let perfil = null;

        try {

            const local =
                await DB.obtenerTodos(
                    'perfil_asesor'
                );

            if (local?.length) {
                perfil = local[0];
            }

        } catch (err) {

            console.error(
                'Error local perfil',
                err
            );
        }

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

            console.error(
                'Error remoto perfil',
                err
            );
        }

        // ═══════════════════════════════════════════
        // SIN PERFIL
        // ═══════════════════════════════════════════

        if (
            !perfil ||
            !perfil.fecha_conexion
        ) {

            root.innerHTML =
                renderConfigScreen();

            bindConfigScreen();

            return;
        }

        // ═══════════════════════════════════════════
        // PERFIL EXISTE
        // ═══════════════════════════════════════════

        root.innerHTML =
            renderFinancialDashboard(
                perfil
            );

        bindDashboardEvents(
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

            <h2
                style="
                    margin-bottom:8px;
                "
            >
                Error cargando módulo
            </h2>

            <p
                style="
                    color:var(--danger);
                    margin-bottom:18px;
                "
            >
                ${err.message}
            </p>

            <button
                class="btn-primary"
                id="retry-comisiones"
            >
                Reintentar
            </button>

        </div>
        `;

        document
            .getElementById(
                'retry-comisiones'
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
}

// ═══════════════════════════════════════════════════════════════
// CONFIG SCREEN
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

            <div
                style="
                    font-size:40px;
                    text-align:center;
                    margin-bottom:10px;
                "
            >
                📊
            </div>

            <h2
                style="
                    text-align:center;
                    margin-bottom:8px;
                "
            >
                Configurar Motor Financiero
            </h2>

            <p
                style="
                    text-align:center;
                    color:var(--text-secondary);
                    font-size:13px;
                    margin-bottom:22px;
                    line-height:1.5;
                "
            >
                Configura tu fecha de conexión
                y tus índices actuales.
            </p>

            <div
                style="
                    display:flex;
                    flex-direction:column;
                    gap:16px;
                "
            >

                <div>

                    <label
                        style="
                            font-size:11px;
                            font-weight:700;
                            text-transform:uppercase;
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
                            font-size:11px;
                            font-weight:700;
                            text-transform:uppercase;
                            color:var(--text-secondary);
                        "
                    >
                        LIMRA %
                    </label>

                    <input
                        type="number"
                        id="cfg-limra"
                        step="0.1"
                        min="0"
                        max="100"
                        value="75.5"
                        style="
                            width:100%;
                            margin-top:6px;
                        "
                    />

                </div>

                <div>

                    <label
                        style="
                            font-size:11px;
                            font-weight:700;
                            text-transform:uppercase;
                            color:var(--text-secondary);
                        "
                    >
                        IGC %
                    </label>

                    <input
                        type="number"
                        id="cfg-igc"
                        step="0.1"
                        min="0"
                        max="100"
                        value="91"
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

function bindConfigScreen() {

    const btn =
        document.getElementById(
            'btn-save-config'
        );

    btn?.addEventListener(
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

                const sb =
                    window.supabaseClient;

                const {
                    data: { user }
                } = await sb.auth.getUser();

                const payload = {
                    fecha_conexion:
                        fecha,
                    limra,
                    igc,
                    esquema:
                        'PROFESIONAL'
                };

                // ═══════════════════════════════
                // UPSERT
                // ═══════════════════════════════

                const {
                    error
                } = await sb
                    .from('crm_data')
                    .upsert(
                        {
                            id:
                                'perfil_' +
                                user.id,

                            user_id:
                                user.id,

                            coleccion:
                                'perfil_asesor',

                            datos:
                                payload
                        },
                        {
                            onConflict:
                                'id'
                        }
                    );

                if (error) {
                    throw error;
                }

                // ═══════════════════════════════
                // CACHE LOCAL
                // ═══════════════════════════════

                try {

                    await DB.guardar(
                        'perfil_asesor',
                        {
                            id:
                                'perfil_' +
                                user.id,

                            ...payload
                        }
                    );

                } catch (err) {

                    console.warn(
                        'No se pudo guardar local',
                        err
                    );
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

                }, 400);

            } catch (err) {

                console.error(err);

                showToast(
                    'Error al guardar perfil',
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

function renderFinancialDashboard(
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

        <div
            class="card"
        >

            <div
                style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    gap:12px;
                    flex-wrap:wrap;
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
                    class="btn-secondary"
                    id="btn-edit-profile"
                >
                    ✏️ Editar Perfil
                </button>

            </div>

        </div>

        <div
            class="card"
        >

            <div
                style="
                    display:grid;
                    grid-template-columns:
                    repeat(auto-fit,minmax(160px,1fr));
                    gap:14px;
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
                        ${perfil.limra || 75.5}%
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

function bindDashboardEvents(
    perfil
) {

    document
        .getElementById(
            'btn-edit-profile'
        )
        ?.addEventListener(
            'click',
            () => {

                const root =
                    document.getElementById(
                        'fin-root'
                    );

                root.innerHTML =
                    renderEditScreen(
                        perfil
                    );

                bindEditEvents(
                    perfil
                );
            }
        );
}

// ═══════════════════════════════════════════════════════════════
// EDIT SCREEN
// ═══════════════════════════════════════════════════════════════

function renderEditScreen(
    perfil
) {

    return `
    <div
        style="
            padding:18px;
            display:flex;
            justify-content:center;
        "
    >

        <div
            class="card"
            style="
                width:100%;
                max-width:420px;
            "
        >

            <h2
                style="
                    margin-bottom:18px;
                "
            >
                Editar Perfil
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
                        id="edit-fecha"
                        value="${perfil.fecha_conexion}"
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
                        id="edit-limra"
                        step="0.1"
                        value="${perfil.limra || 75.5}"
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
                        id="edit-igc"
                        step="0.1"
                        value="${perfil.igc || 91}"
                        style="
                            width:100%;
                            margin-top:6px;
                        "
                    />

                </div>

                <button
                    id="btn-save-edit"
                    class="btn-primary"
                >
                    💾 Guardar Cambios
                </button>

                <button
                    id="btn-back-dashboard"
                    class="btn-secondary"
                >
                    ← Volver
                </button>

            </div>

        </div>

    </div>
    `;
}

// ═══════════════════════════════════════════════════════════════
// EDIT EVENTS
// ═══════════════════════════════════════════════════════════════

function bindEditEvents(
    perfil
) {

    document
        .getElementById(
            'btn-save-edit'
        )
        ?.addEventListener(
            'click',
            async () => {

                try {

                    const fecha =
                        document.getElementById(
                            'edit-fecha'
                        ).value;

                    const limra =
                        parseFloat(
                            document.getElementById(
                                'edit-limra'
                            ).value
                        );

                    const igc =
                        parseFloat(
                            document.getElementById(
                                'edit-igc'
                            ).value
                        );

                    const sb =
                        window.supabaseClient;

                    const {
                        data: { user }
                    } = await sb.auth.getUser();

                    const payload = {
                        fecha_conexion:
                            fecha,
                        limra,
                        igc,
                        esquema:
                            'PROFESIONAL'
                    };

                    const {
                        error
                    } = await sb
                        .from('crm_data')
                        .upsert(
                            {
                                id:
                                    'perfil_' +
                                    user.id,

                                user_id:
                                    user.id,

                                coleccion:
                                    'perfil_asesor',

                                datos:
                                    payload
                            },
                            {
                                onConflict:
                                    'id'
                            }
                        );

                    if (error) {
                        throw error;
                    }

                    await DB.guardar(
                        'perfil_asesor',
                        {
                            id:
                                'perfil_' +
                                user.id,

                            ...payload
                        }
                    );

                    showToast(
                        '✅ Perfil actualizado',
                        'success'
                    );

                    setTimeout(() => {

                        window.App
                            .router
                            .navigate(
                                'comisiones'
                            );

                    }, 350);

                } catch (err) {

                    console.error(err);

                    showToast(
                        'Error guardando',
                        'danger'
                    );
                }
            }
        );

    document
        .getElementById(
            'btn-back-dashboard'
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