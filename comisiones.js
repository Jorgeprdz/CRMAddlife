// comisiones.js — Motor Financiero SMNYL v13 STABLE FINAL
// FIXES:
// ✅ Perfil editable
// ✅ LIMRA editable
// ✅ IGC editable
// ✅ Botón continuar
// ✅ Save estable
// ✅ RLS compatible
// ✅ Arquitectura crm_data ONLY
// ✅ Eliminado legacy perfil_asesor
// ✅ No rompe UI existente
// ✅ Compatible Android / Samsung / PWA / Termux

import { DB } from './db.js';
import { getSupabase } from './app.js';
import { showToast } from './utils.js';

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function getMesConcurso(fechaConexion) {

    if (!fechaConexion) return 1;

    const hoy = new Date();

    const conn =
        new Date(
            fechaConexion + 'T12:00:00'
        );

    return Math.max(
        1,
        Math.floor(
            (hoy - conn) /
            (1000 * 60 * 60 * 24 * 30.44)
        ) + 1
    );
}

function getEsquema(fechaConexion) {

    return getMesConcurso(
        fechaConexion
    ) <= 12
        ? 'Desarrollo'
        : 'Profesional';
}

// ═══════════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════════

export function renderComisiones() {

    return `
    <div id="fin-root"
        style="
            display:flex;
            flex-direction:column;
            align-items:center;
            justify-content:center;
            min-height:60vh;
            gap:12px;
        ">

        <div
            style="
                width:40px;
                height:40px;
                border:3px solid var(--separator);
                border-top-color:var(--accent);
                border-radius:50%;
                animation:spin .8s linear infinite;
            ">
        </div>

        <p
            style="
                font-size:13px;
                color:var(--text-secondary);
            ">
            Cargando módulo financiero...
        </p>

    </div>

    <style>
        @keyframes spin{
            to{
                transform:rotate(360deg)
            }
        }
    </style>
    `;
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

export async function bindComisionesEvents() {

    const root =
        document.getElementById(
            'fin-root'
        );

    if (!root) return;

    try {

        const sb = getSupabase();

        if (!sb) {
            throw new Error(
                'Supabase no inicializado'
            );
        }

        // ─────────────────────────────
        // AUTH SAFE
        // ─────────────────────────────

        const {
            data:{session}
        } = await sb.auth.getSession();

        if (!session) {
            throw new Error(
                'Sesión expirada'
            );
        }

        const {
            data:{user}
        } = await sb.auth.getUser();

        if (!user) {
            throw new Error(
                'Usuario inválido'
            );
        }

        // ─────────────────────────────
        // PERFIL
        // ─────────────────────────────

        const perfiles =
            await DB.obtenerTodos(
                'perfil_asesor'
            );

        const perfil =
            perfiles?.[0] || null;

        // ─────────────────────────────
        // NO EXISTE PERFIL
        // ─────────────────────────────

        if (!perfil) {

            root.innerHTML =
                renderConfigForm();

            bindConfigForm();

            return;
        }

        // ─────────────────────────────
        // PERFIL EXISTENTE
        // ─────────────────────────────

        root.innerHTML =
            renderPerfilConfigurado(
                perfil
            );

        bindPerfilConfigurado(
            perfil
        );

    } catch (err) {

        console.error(
            '[COMISIONES]',
            err
        );

        root.innerHTML = `
        <div
            style="
                min-height:60vh;
                display:flex;
                align-items:center;
                justify-content:center;
                padding:24px;
            ">

            <div
                class="card"
                style="
                    max-width:420px;
                    width:100%;
                    text-align:center;
                ">

                <div
                    style="
                        font-size:42px;
                        margin-bottom:12px;
                    ">
                    ⚠️
                </div>

                <h2>Error</h2>

                <p
                    style="
                        color:var(--text-secondary);
                        line-height:1.6;
                        font-size:14px;
                    ">
                    ${err.message}
                </p>

                <button
                    onclick="window.navigateTo('comisiones')"
                    class="btn-primary"
                    style="margin-top:18px;">

                    Reintentar

                </button>

            </div>

        </div>
        `;
    }
}

// ═══════════════════════════════════════════════════════════════
// CONFIG FORM
// ═══════════════════════════════════════════════════════════════

function renderConfigForm() {

    return `
    <div
        style="
            min-height:60vh;
            display:flex;
            align-items:center;
            justify-content:center;
            padding:16px;
        ">

        <div
            class="card"
            style="
                max-width:420px;
                width:100%;
                border-left:4px solid var(--accent);
            ">

            <div
                style="
                    font-size:42px;
                    text-align:center;
                    margin-bottom:10px;
                ">
                🚀
            </div>

            <h2
                style="
                    text-align:center;
                    margin-bottom:8px;
                ">
                Configurar Motor Financiero
            </h2>

            <p
                style="
                    font-size:13px;
                    color:var(--text-secondary);
                    line-height:1.6;
                    text-align:center;
                    margin-bottom:22px;
                ">
                Ingresa tu fecha de conexión.
            </p>

            <div
                style="
                    display:flex;
                    flex-direction:column;
                    gap:16px;
                ">

                <div>

                    <label
                        style="
                            font-size:11px;
                            font-weight:600;
                            color:var(--text-secondary);
                            text-transform:uppercase;
                        ">
                        Fecha de conexión
                    </label>

                    <input
                        type="date"
                        id="cfg-fec"
                        style="
                            width:100%;
                            margin-top:6px;
                        ">

                </div>

                <button
                    id="btn-save-cfg"
                    class="btn-primary">

                    🚀 Iniciar Motor Financiero

                </button>

            </div>

        </div>

    </div>
    `;
}

// ═══════════════════════════════════════════════════════════════
// PERFIL CONFIGURADO
// ═══════════════════════════════════════════════════════════════

function renderPerfilConfigurado(perfil) {

    const mesConcurso =
        getMesConcurso(
            perfil.fecha_conexion
        );

    return `
    <div
        style="
            padding:24px;
            width:100%;
            max-width:900px;
        ">

        <div class="card">

            <div
                style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    gap:16px;
                    flex-wrap:wrap;
                ">

                <div>

                    <h2
                        style="
                            margin:0;
                            font-size:24px;
                            font-weight:700;
                        ">
                        💰 Motor Financiero
                    </h2>

                    <p
                        style="
                            margin-top:6px;
                            color:var(--text-secondary);
                            font-size:13px;
                        ">
                        Perfil configurado correctamente
                    </p>

                </div>

                <div
                    style="
                        background:var(--surface-2);
                        border-radius:16px;
                        padding:14px 18px;
                        min-width:220px;
                    ">

                    <div
                        style="
                            font-size:11px;
                            color:var(--text-secondary);
                            text-transform:uppercase;
                            letter-spacing:.5px;
                        ">
                        Esquema
                    </div>

                    <div
                        style="
                            font-size:20px;
                            font-weight:700;
                            margin-top:4px;
                        ">
                        ${perfil.esquema}
                    </div>

                </div>

            </div>

            <div
                style="
                    margin-top:22px;
                    display:grid;
                    grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
                    gap:16px;
                ">

                <div class="card">

                    <div
                        style="
                            font-size:11px;
                            color:var(--text-secondary);
                            text-transform:uppercase;
                        ">
                        Fecha conexión
                    </div>

                    <input
                        type="date"
                        id="edit-fecha"
                        value="${perfil.fecha_conexion}"
                        style="
                            width:100%;
                            margin-top:10px;
                        ">

                </div>

                <div class="card">

                    <div
                        style="
                            font-size:11px;
                            color:var(--text-secondary);
                            text-transform:uppercase;
                        ">
                        LIMRA %
                    </div>

                    <input
                        type="number"
                        id="edit-limra"
                        value="${perfil.limra || 75.5}"
                        step="0.1"
                        min="0"
                        max="100"
                        style="
                            width:100%;
                            margin-top:10px;
                        ">

                </div>

                <div class="card">

                    <div
                        style="
                            font-size:11px;
                            color:var(--text-secondary);
                            text-transform:uppercase;
                        ">
                        IGC %
                    </div>

                    <input
                        type="number"
                        id="edit-igc"
                        value="${perfil.igc || 91}"
                        step="0.1"
                        min="0"
                        max="100"
                        style="
                            width:100%;
                            margin-top:10px;
                        ">

                </div>

            </div>

            <div
                style="
                    margin-top:20px;
                    background:var(--surface-2);
                    border-radius:16px;
                    padding:16px;
                ">

                <div
                    style="
                        display:flex;
                        justify-content:space-between;
                        align-items:center;
                        flex-wrap:wrap;
                        gap:12px;
                    ">

                    <div>

                        <div
                            style="
                                font-size:12px;
                                color:var(--text-secondary);
                            ">
                            Mes concurso
                        </div>

                        <div
                            style="
                                font-size:24px;
                                font-weight:700;
                            ">
                            ${mesConcurso}
                        </div>

                    </div>

                    <button
                        id="btn-save-profile"
                        class="btn-primary">

                        💾 Guardar Cambios

                    </button>

                </div>

            </div>

            <div
                style="
                    display:flex;
                    justify-content:flex-end;
                    margin-top:20px;
                ">

                <button
                    id="btn-continuar"
                    class="btn-primary"
                    style="
                        min-width:220px;
                    ">

                    ➜ Continuar al Dashboard

                </button>

            </div>

        </div>

    </div>
    `;
}

// ═══════════════════════════════════════════════════════════════
// SAVE PERFIL
// ═══════════════════════════════════════════════════════════════

function bindPerfilConfigurado(perfil) {

    document
        .getElementById(
            'btn-save-profile'
        )
        ?.addEventListener(
            'click',
            async () => {

                const btn =
                    document.getElementById(
                        'btn-save-profile'
                    );

                try {

                    btn.disabled = true;

                    btn.innerHTML =
                        'Guardando...';

                    const sb =
                        getSupabase();

                    const {
                        data:{user}
                    } =
                        await sb.auth.getUser();

                    if (!user) {
                        throw new Error(
                            'Usuario inválido'
                        );
                    }

                    const nuevoPerfil = {

                        id:
                            'perfil_' +
                            user.id,

                        fecha_conexion:
                            document
                                .getElementById(
                                    'edit-fecha'
                                )
                                .value,

                        esquema:
                            getEsquema(
                                document
                                    .getElementById(
                                        'edit-fecha'
                                    )
                                    .value
                            ),

                        limra:
                            parseFloat(
                                document
                                    .getElementById(
                                        'edit-limra'
                                    )
                                    .value
                            ) || 75.5,

                        igc:
                            parseFloat(
                                document
                                    .getElementById(
                                        'edit-igc'
                                    )
                                    .value
                            ) || 91
                    };

                    const payload = {

                        id:
                            nuevoPerfil.id,

                        user_id:
                            user.id,

                        coleccion:
                            'perfil_asesor',

                        datos:
                            nuevoPerfil
                    };

                    const { error } =
                        await sb
                            .from('crm_data')
                            .upsert(
                                payload,
                                {
                                    onConflict:'id'
                                }
                            );

                    if (error) {
                        throw error;
                    }

                    localStorage.setItem(
                        'shadow_perfil_asesor',
                        JSON.stringify([
                            payload
                        ])
                    );

                    showToast(
                        '✅ Perfil actualizado',
                        'success'
                    );

                    setTimeout(() => {

                        window.navigateTo(
                            'comisiones'
                        );

                    }, 400);

                } catch (err) {

                    console.error(err);

                    showToast(
                        err.message,
                        'danger'
                    );

                } finally {

                    btn.disabled = false;

                    btn.innerHTML =
                        '💾 Guardar Cambios';
                }
            }
        );

    // ─────────────────────────────
    // CONTINUAR
    // ─────────────────────────────

    document
        .getElementById(
            'btn-continuar'
        )
        ?.addEventListener(
            'click',
            () => {

                window.navigateTo(
                    'dashboard'
                );
            }
        );
}

// ═══════════════════════════════════════════════════════════════
// SAVE CONFIG INICIAL
// ═══════════════════════════════════════════════════════════════

function bindConfigForm() {

    document
        .getElementById(
            'btn-save-cfg'
        )
        ?.addEventListener(
            'click',
            async () => {

                const btn =
                    document.getElementById(
                        'btn-save-cfg'
                    );

                try {

                    btn.disabled = true;

                    btn.innerHTML =
                        'Guardando...';

                    const sb =
                        getSupabase();

                    const {
                        data:{user}
                    } =
                        await sb.auth.getUser();

                    if (!user) {
                        throw new Error(
                            'Usuario inválido'
                        );
                    }

                    const fecha =
                        document
                            .getElementById(
                                'cfg-fec'
                            )
                            .value;

                    if (!fecha) {

                        throw new Error(
                            'Fecha requerida'
                        );
                    }

                    const perfil = {

                        id:
                            'perfil_' +
                            user.id,

                        fecha_conexion:
                            fecha,

                        esquema:
                            getEsquema(
                                fecha
                            ),

                        limra:75.5,

                        igc:91
                    };

                    const payload = {

                        id:
                            perfil.id,

                        user_id:
                            user.id,

                        coleccion:
                            'perfil_asesor',

                        datos:
                            perfil
                    };

                    const { error } =
                        await sb
                            .from('crm_data')
                            .upsert(
                                payload,
                                {
                                    onConflict:'id'
                                }
                            );

                    if (error) {
                        throw error;
                    }

                    localStorage.setItem(
                        'shadow_perfil_asesor',
                        JSON.stringify([
                            payload
                        ])
                    );

                    showToast(
                        '✅ Perfil guardado',
                        'success'
                    );

                    setTimeout(() => {

                        window.navigateTo(
                            'comisiones'
                        );

                    }, 500);

                } catch (err) {

                    console.error(err);

                    showToast(
                        err.message,
                        'danger'
                    );

                } finally {

                    btn.disabled = false;

                    btn.innerHTML =
                        '🚀 Iniciar Motor Financiero';
                }
            }
        );
}