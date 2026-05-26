// db.js — Motor de Persistencia SMNYL v3
// Arquitectura endurecida:
// ✅ Supabase RLS Safe
// ✅ Offline First
// ✅ Shadow Cache
// ✅ Ownership seguro
// ✅ Compatibilidad retroactiva
// ✅ Sin romper UI existente
// ✅ Compatible con comisiones.js v11

import { getSupabase } from './app.js';
import { showToast } from './utils.js';

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════

const TABLE = 'crm_data';

const SHADOW_PREFIX = 'shadow_';
const QUEUE_KEY = 'crm_offline_queue_v3';

let syncing = false;

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function log(...args) {
    console.log('[DB]', ...args);
}

function debugError(context, err) {

    console.error(`[DB:${context}]`, {
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code,
        full: err
    });
}

function isNetworkError(err) {

    if (!navigator.onLine) return true;

    const msg = String(
        err?.message || ''
    ).toLowerCase();

    return (
        msg.includes('network') ||
        msg.includes('fetch') ||
        msg.includes('failed') ||
        msg.includes('timeout')
    );
}

function generateId() {

    return (
        'id_' +
        Date.now() +
        '_' +
        Math.random()
            .toString(36)
            .substring(2, 9)
    );
}

async function getUser() {

    const sb = getSupabase();

    if (!sb) return null;

    try {

        const {
            data: { user },
            error
        } = await sb.auth.getUser();

        if (error) throw error;

        return user || null;

    } catch (err) {

        debugError('getUser', err);

        return null;
    }
}

// ═══════════════════════════════════════════════════════════════
// NORMALIZACIÓN
// ═══════════════════════════════════════════════════════════════

function cleanDatos(datos = {}) {

    if (
        !datos ||
        typeof datos !== 'object'
    ) {
        return {};
    }

    const clean = { ...datos };

    delete clean.user_id;
    delete clean.coleccion;
    delete clean.created_at;
    delete clean.updated_at;

    if (!clean.id) {
        clean.id = generateId();
    }

    return clean;
}

function normalizeRow(row) {

    if (!row) return null;

    return {
        id: row.id,
        user_id: row.user_id,
        coleccion: row.coleccion,
        created_at: row.created_at,
        updated_at: row.updated_at,
        datos: cleanDatos(
            row.datos || {}
        )
    };
}

function buildRow(
    userId,
    coleccion,
    datos
) {

    const clean = cleanDatos(datos);

    return {
        id: clean.id,
        user_id: userId,
        coleccion,
        datos: clean,
        updated_at:
            new Date().toISOString()
    };
}

// ═══════════════════════════════════════════════════════════════
// SHADOW CACHE
// ═══════════════════════════════════════════════════════════════

function shadowKey(coleccion) {
    return SHADOW_PREFIX + coleccion;
}

function readShadowRows(coleccion) {

    try {

        return JSON.parse(
            localStorage.getItem(
                shadowKey(coleccion)
            ) || '[]'
        );

    } catch {

        return [];
    }
}

function writeShadowRows(
    coleccion,
    rows
) {

    localStorage.setItem(
        shadowKey(coleccion),
        JSON.stringify(rows)
    );
}

function readShadow(coleccion) {

    return readShadowRows(coleccion)
        .map(r => r.datos || r)
        .filter(Boolean);
}

function upsertShadowRow(
    coleccion,
    row
) {

    const rows =
        readShadowRows(coleccion);

    const index =
        rows.findIndex(
            r => r.id === row.id
        );

    if (index >= 0) {

        rows[index] = {
            ...rows[index],
            ...row,
            datos: {
                ...(rows[index].datos || {}),
                ...(row.datos || {})
            }
        };

    } else {

        rows.push(row);
    }

    writeShadowRows(
        coleccion,
        rows
    );
}

function removeShadowRow(
    coleccion,
    id
) {

    const rows =
        readShadowRows(coleccion);

    writeShadowRows(
        coleccion,
        rows.filter(r => r.id !== id)
    );
}

// ═══════════════════════════════════════════════════════════════
// OFFLINE QUEUE
// ═══════════════════════════════════════════════════════════════

function getQueue() {

    try {

        return JSON.parse(
            localStorage.getItem(
                QUEUE_KEY
            ) || '[]'
        );

    } catch {

        return [];
    }
}

function saveQueue(queue) {

    localStorage.setItem(
        QUEUE_KEY,
        JSON.stringify(queue)
    );
}

function enqueue(task) {

    const queue = getQueue();

    queue.push({
        ...task,
        timestamp: Date.now()
    });

    saveQueue(queue);

    log(
        'Task offline:',
        task.action,
        task.id
    );
}

// ═══════════════════════════════════════════════════════════════
// OFFLINE SYNC
// ═══════════════════════════════════════════════════════════════

export async function processOfflineQueue() {

    if (syncing) return;
    if (!navigator.onLine) return;

    syncing = true;

    const sb = getSupabase();

    if (!sb) {
        syncing = false;
        return;
    }

    const user = await getUser();

    if (!user) {
        syncing = false;
        return;
    }

    const queue = getQueue();

    if (!queue.length) {
        syncing = false;
        return;
    }

    const pending = [];

    for (const task of queue) {

        try {

            if (
                task.action === 'guardar' ||
                task.action === 'actualizar'
            ) {

                const row = buildRow(
                    user.id,
                    task.coleccion,
                    task.datos
                );

                const { error } =
                    await sb
                        .from(TABLE)
                        .upsert(
                            row,
                            {
                                onConflict:'id'
                            }
                        );

                if (error) throw error;
            }

            else if (
                task.action === 'eliminar'
            ) {

                const { error } =
                    await sb
                        .from(TABLE)
                        .delete()
                        .eq('id', task.id)
                        .eq(
                            'user_id',
                            user.id
                        );

                if (error) throw error;
            }

        } catch (err) {

            debugError(
                'offlineSync',
                err
            );

            pending.push(task);
        }
    }

    saveQueue(pending);

    syncing = false;

    if (pending.length === 0) {

        showToast(
            '✅ Datos sincronizados',
            'success'
        );
    }
}

window.addEventListener(
    'online',
    processOfflineQueue
);

// ═══════════════════════════════════════════════════════════════
// DB API
// ═══════════════════════════════════════════════════════════════

export const DB = {

    // ═══════════════════════════════════════════════════════
    // OBTENER TODOS
    // ═══════════════════════════════════════════════════════

    async obtenerTodos(
        coleccion
    ) {

        const local =
            readShadow(coleccion);

        const sb = getSupabase();

        if (!navigator.onLine || !sb) {

            log(
                'Offline:',
                coleccion
            );

            return local;
        }

        try {

            const user =
                await getUser();

            if (!user) {

                return local;
            }

            const {
                data,
                error
            } = await sb
                .from(TABLE)
                .select('*')
                .eq(
                    'coleccion',
                    coleccion
                )
                .eq(
                    'user_id',
                    user.id
                );

            if (error) throw error;

            const rows =
                (data || [])
                    .map(normalizeRow);

            writeShadowRows(
                coleccion,
                rows
            );

            return rows
                .map(r => r.datos);

        } catch (err) {

            debugError(
                'obtenerTodos',
                err
            );

            return local;
        }
    },

    // ═══════════════════════════════════════════════════════
    // GUARDAR
    // ═══════════════════════════════════════════════════════

    async guardar(
        coleccion,
        datos,
        isSyncing = false
    ) {

        try {

            const clean =
                cleanDatos(datos);

            if (!clean.id) {
                clean.id = generateId();
            }

            if (!isSyncing) {

                upsertShadowRow(
                    coleccion,
                    {
                        id: clean.id,
                        coleccion,
                        datos: clean
                    }
                );
            }

            const sb = getSupabase();

            if (!sb) {
                return true;
            }

            const user =
                await getUser();

            if (!user) {

                throw new Error(
                    'No hay sesión'
                );
            }

            const row = buildRow(
                user.id,
                coleccion,
                clean
            );

            const { error } =
                await sb
                    .from(TABLE)
                    .upsert(
                        row,
                        {
                            onConflict:'id'
                        }
                    );

            if (error) {
                throw error;
            }

            return true;

        } catch (err) {

            debugError(
                'guardar',
                err
            );

            if (
                isNetworkError(err)
            ) {

                enqueue({
                    action:'guardar',
                    coleccion,
                    id: datos.id,
                    datos
                });

                return true;
            }

            throw err;
        }
    },

    // ═══════════════════════════════════════════════════════
    // ACTUALIZAR
    // ═══════════════════════════════════════════════════════

    async actualizar(
        coleccion,
        id,
        nuevosDatos,
        isSyncing = false
    ) {

        try {

            const clean =
                cleanDatos(
                    nuevosDatos
                );

            const rows =
                readShadowRows(
                    coleccion
                );

            const existing =
                rows.find(
                    r => r.id === id
                );

            const merged = {
                ...(existing?.datos || {}),
                ...clean,
                id
            };

            if (!isSyncing) {

                upsertShadowRow(
                    coleccion,
                    {
                        id,
                        coleccion,
                        datos: merged
                    }
                );
            }

            const sb = getSupabase();

            if (!sb) {
                return true;
            }

            const user =
                await getUser();

            if (!user) {

                throw new Error(
                    'No hay sesión'
                );
            }

            const row = buildRow(
                user.id,
                coleccion,
                merged
            );

            const { error } =
                await sb
                    .from(TABLE)
                    .upsert(
                        row,
                        {
                            onConflict:'id'
                        }
                    );

            if (error) {
                throw error;
            }

            return true;

        } catch (err) {

            debugError(
                'actualizar',
                err
            );

            if (
                isNetworkError(err)
            ) {

                enqueue({
                    action:'actualizar',
                    coleccion,
                    id,
                    datos:nuevosDatos
                });

                return true;
            }

            throw err;
        }
    },

    // ═══════════════════════════════════════════════════════
    // ELIMINAR
    // ═══════════════════════════════════════════════════════

    async eliminar(
        coleccion,
        id,
        isSyncing = false
    ) {

        try {

            if (!isSyncing) {

                removeShadowRow(
                    coleccion,
                    id
                );
            }

            const sb = getSupabase();

            if (!sb) {
                return true;
            }

            const user =
                await getUser();

            if (!user) {

                throw new Error(
                    'No hay sesión'
                );
            }

            const { error } =
                await sb
                    .from(TABLE)
                    .delete()
                    .eq('id', id)
                    .eq(
                        'user_id',
                        user.id
                    );

            if (error) {
                throw error;
            }

            return true;

        } catch (err) {

            debugError(
                'eliminar',
                err
            );

            if (
                isNetworkError(err)
            ) {

                enqueue({
                    action:'eliminar',
                    coleccion,
                    id
                });

                return true;
            }

            throw err;
        }
    }
};

// ═══════════════════════════════════════════════════════════════
// AUTO SYNC
// ═══════════════════════════════════════════════════════════════

setTimeout(() => {
    processOfflineQueue();
}, 3000);