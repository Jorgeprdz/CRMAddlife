// /services/db.service.js
// Motor de Base de Datos Cloud (Supabase) v2
// Arquitectura endurecida para:
// - Supabase RLS
// - Offline First
// - Ownership seguro
// - Shadow Cache consistente
// - Sincronización robusta
// - Compatibilidad retroactiva
//
// IMPORTANTE:
// Este archivo fue diseñado para:
// ✅ NO romper la UI existente
// ✅ NO romper módulos actuales
// ✅ Mantener compatibilidad total
// ✅ Corregir problemas estructurales reales
//
// Cambios principales:
// - Ownership explícito con user_id
// - Queries RLS-safe
// - Shadow cache normalizado
// - Protección contra corrupción de datos
// - Protección contra race conditions
// - Upserts seguros
// - Offline queue robusta
// - Normalización de rows
// - Sync inteligente
// - Compatibilidad con estructura antigua

import { showToast } from './utils.js';

// ════════════════════════════════════════════════════════════════════════
// CONFIG
// ════════════════════════════════════════════════════════════════════════

const TABLE_NAME = 'crm_data';
const OFFLINE_QUEUE_KEY = 'crm_offline_queue_v2';
const SHADOW_PREFIX = 'db_shadow_';

let isOfflineQueueProcessing = false;

// ════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════

function isNetworkError(err) {
    if (!navigator.onLine) return true;

    const msg = String(err?.message || err).toLowerCase();

    return (
        msg.includes('fetch') ||
        msg.includes('network') ||
        msg.includes('load failed') ||
        msg.includes('failed to fetch') ||
        msg.includes('typeerror') ||
        msg.includes('timeout')
    );
}

function log(...args) {
    console.log('[DB]', ...args);
}

function warn(...args) {
    console.warn('[DB]', ...args);
}

function error(...args) {
    console.error('[DB]', ...args);
}

async function getCurrentUser() {
    if (!window.supabaseClient) return null;

    try {
        const {
            data: { user },
            error: authError
        } = await window.supabaseClient.auth.getUser();

        if (authError) {
            error('Auth Error:', authError);
            return null;
        }

        return user || null;

    } catch (err) {
        error('Error obteniendo usuario:', err);
        return null;
    }
}

function generateId() {
    return (
        'id_' +
        Date.now() +
        '_' +
        Math.random().toString(36).substring(2, 9)
    );
}

// ════════════════════════════════════════════════════════════════════════
// NORMALIZACIÓN
// ════════════════════════════════════════════════════════════════════════

function normalizeDatos(datos = {}) {
    if (!datos || typeof datos !== 'object') {
        return {};
    }

    const clean = { ...datos };

    // Protección contra metadata contaminada
    delete clean.user_id;
    delete clean.coleccion;
    delete clean.created_at;
    delete clean.updated_at;

    // Garantizar ID
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
        datos: normalizeDatos(row.datos || {})
    };
}

function buildSupabaseRow(userId, coleccion, datos) {
    const normalized = normalizeDatos(datos);

    return {
        id: normalized.id,
        user_id: userId,
        coleccion,
        datos: normalized,
        updated_at: new Date().toISOString()
    };
}

// ════════════════════════════════════════════════════════════════════════
// SHADOW CACHE
// ════════════════════════════════════════════════════════════════════════

function getShadowKey(coleccion) {
    return SHADOW_PREFIX + coleccion;
}

function getLocalShadowRows(coleccion) {
    try {
        return JSON.parse(
            localStorage.getItem(getShadowKey(coleccion)) || '[]'
        );
    } catch {
        return [];
    }
}

function saveLocalShadowRows(coleccion, rows) {
    localStorage.setItem(
        getShadowKey(coleccion),
        JSON.stringify(rows)
    );
}

function getLocalShadow(coleccion) {
    return getLocalShadowRows(coleccion)
        .map(row => row.datos || row)
        .filter(Boolean);
}

function upsertShadowRow(coleccion, row) {
    const rows = getLocalShadowRows(coleccion);

    const index = rows.findIndex(r => r.id === row.id);

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

    saveLocalShadowRows(coleccion, rows);
}

function removeShadowRow(coleccion, id) {
    const rows = getLocalShadowRows(coleccion);

    saveLocalShadowRows(
        coleccion,
        rows.filter(r => r.id !== id)
    );
}

// ════════════════════════════════════════════════════════════════════════
// OFFLINE QUEUE
// ════════════════════════════════════════════════════════════════════════

function getOfflineQueue() {
    try {
        return JSON.parse(
            localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]'
        );
    } catch {
        return [];
    }
}

function saveOfflineQueue(queue) {
    localStorage.setItem(
        OFFLINE_QUEUE_KEY,
        JSON.stringify(queue)
    );
}

export function enqueueOffline(task) {
    const queue = getOfflineQueue();

    const existingIndex = queue.findIndex(
        q =>
            q.id === task.id &&
            q.action === task.action &&
            q.coleccion === task.coleccion
    );

    if (existingIndex >= 0) {
        queue[existingIndex] = {
            ...queue[existingIndex],
            ...task,
            datos: {
                ...(queue[existingIndex].datos || {}),
                ...(task.datos || {})
            }
        };
    } else {
        queue.push({
            ...task,
            timestamp: Date.now()
        });
    }

    saveOfflineQueue(queue);

    log('Tarea offline encolada:', task.action, task.id);
}

// ════════════════════════════════════════════════════════════════════════
// OFFLINE SYNC ENGINE
// ════════════════════════════════════════════════════════════════════════

export async function processOfflineQueue() {

    if (isOfflineQueueProcessing) return;
    if (!navigator.onLine) return;
    if (!window.supabaseClient) return;

    isOfflineQueueProcessing = true;

    const queue = getOfflineQueue();

    if (queue.length === 0) {
        isOfflineQueueProcessing = false;
        return;
    }

    const user = await getCurrentUser();

    if (!user) {
        warn('No hay sesión activa para sincronizar');
        isOfflineQueueProcessing = false;
        return;
    }

    log(`Procesando cola offline (${queue.length})`);

    const pending = [];
    let synced = 0;

    for (const task of queue) {

        try {

            if (!task?.id || !task?.coleccion) {
                warn('Task inválida omitida:', task);
                continue;
            }

            if (task.action === 'guardar' || task.action === 'actualizar') {

                const row = buildSupabaseRow(
                    user.id,
                    task.coleccion,
                    task.datos
                );

                const { error: upsertError } =
                    await window.supabaseClient
                        .from(TABLE_NAME)
                        .upsert(row, {
                            onConflict: 'id'
                        });

                if (upsertError) {
                    throw upsertError;
                }

                synced++;
            }

            else if (task.action === 'eliminar') {

                const { error: deleteError } =
                    await window.supabaseClient
                        .from(TABLE_NAME)
                        .delete()
                        .eq('id', task.id)
                        .eq('user_id', user.id);

                if (deleteError) {
                    throw deleteError;
                }

                synced++;
            }

        } catch (err) {

            error('Error sincronizando task:', task, err);

            // Mantener task si no es error de red
            pending.push(task);
        }
    }

    saveOfflineQueue(pending);

    isOfflineQueueProcessing = false;

    if (synced > 0) {
        showToast(
            `Sincronización completada (${synced})`,
            'success'
        );
    }

    if (pending.length > 0) {
        warn(`${pending.length} tareas pendientes`);
    }
}

window.addEventListener('online', processOfflineQueue);

// ════════════════════════════════════════════════════════════════════════
// CORE API
// ════════════════════════════════════════════════════════════════════════

export const DB = {

    // ════════════════════════════════════════════════════════════════════
    // OBTENER TODOS
    // ════════════════════════════════════════════════════════════════════

    obtenerTodos: async (coleccion) => {

        const local = getLocalShadow(coleccion);

        if (!navigator.onLine || !window.supabaseClient) {
            log(`Modo offline → usando shadow cache (${coleccion})`);
            return local;
        }

        try {

            const user = await getCurrentUser();

            if (!user) {
                warn('Sin usuario autenticado → usando local cache');
                return local;
            }

            const { data, error: selectError } =
                await window.supabaseClient
                    .from(TABLE_NAME)
                    .select('*')
                    .eq('coleccion', coleccion)
                    .eq('user_id', user.id);

            if (selectError) {
                throw selectError;
            }

            const rows = (data || []).map(normalizeRow);

            saveLocalShadowRows(coleccion, rows);

            log(`Sync remoto exitoso (${coleccion})`);

            return rows
                .map(r => r.datos)
                .filter(Boolean);

        } catch (err) {

            if (isNetworkError(err)) {
                warn('Network error → fallback local');
                return local;
            }

            error('Error obtenerTodos:', err);
            throw err;
        }
    },

    // ════════════════════════════════════════════════════════════════════
    // GUARDAR
    // ════════════════════════════════════════════════════════════════════

    guardar: async (
        coleccion,
        datos,
        isSyncing = false
    ) => {

        const normalized = normalizeDatos(datos);

        if (!normalized.id) {
            normalized.id = generateId();
        }

        // Shadow cache inmediato
        if (!isSyncing) {

            upsertShadowRow(
                coleccion,
                {
                    id: normalized.id,
                    coleccion,
                    datos: normalized
                }
            );
        }

        if (!window.supabaseClient) {
            warn('Sin Supabase → guardado local únicamente');
            return true;
        }

        try {

            const user = await getCurrentUser();

            if (!user) {
                throw new Error(
                    'No hay sesión activa'
                );
            }

            const row = buildSupabaseRow(
                user.id,
                coleccion,
                normalized
            );

            const { error: upsertError } =
                await window.supabaseClient
                    .from(TABLE_NAME)
                    .upsert(row, {
                        onConflict: 'id'
                    });

            if (upsertError) {
                throw upsertError;
            }

            log('Registro guardado:', normalized.id);

            return true;

        } catch (err) {

            error('Error guardar:', err);

            if (
                !isSyncing &&
                isNetworkError(err)
            ) {

                enqueueOffline({
                    action: 'guardar',
                    coleccion,
                    id: normalized.id,
                    datos: normalized
                });

                return true;
            }

            throw err;
        }
    },

    // ════════════════════════════════════════════════════════════════════
    // ACTUALIZAR
    // ════════════════════════════════════════════════════════════════════

    actualizar: async (
        coleccion,
        id,
        nuevosDatos,
        isSyncing = false
    ) => {

        const normalized = normalizeDatos(nuevosDatos);

        // Shadow cache inmediato
        if (!isSyncing) {

            const rows = getLocalShadowRows(coleccion);

            const existing =
                rows.find(r => r.id === id);

            const merged = {
                ...(existing?.datos || {}),
                ...normalized,
                id
            };

            upsertShadowRow(
                coleccion,
                {
                    id,
                    coleccion,
                    datos: merged
                }
            );
        }

        if (!window.supabaseClient) {
            warn('Sin Supabase → actualización local');
            return true;
        }

        try {

            const user = await getCurrentUser();

            if (!user) {
                throw new Error(
                    'No hay sesión activa'
                );
            }

            // Obtener row actual segura
            const {
                data: existingRow,
                error: getError
            } = await window.supabaseClient
                .from(TABLE_NAME)
                .select('*')
                .eq('id', id)
                .eq('user_id', user.id)
                .maybeSingle();

            if (getError) {
                throw getError;
            }

            const currentDatos =
                existingRow?.datos || {};

            const mergedDatos = {
                ...currentDatos,
                ...normalized,
                id
            };

            const updatePayload =
                buildSupabaseRow(
                    user.id,
                    coleccion,
                    mergedDatos
                );

            const {
                error: updateError
            } = await window.supabaseClient
                .from(TABLE_NAME)
                .upsert(updatePayload, {
                    onConflict: 'id'
                });

            if (updateError) {
                throw updateError;
            }

            log('Registro actualizado:', id);

            return true;

        } catch (err) {

            error('Error actualizar:', err);

            if (
                !isSyncing &&
                isNetworkError(err)
            ) {

                enqueueOffline({
                    action: 'actualizar',
                    coleccion,
                    id,
                    datos: normalized
                });

                return true;
            }

            throw err;
        }
    },

    // ════════════════════════════════════════════════════════════════════
    // ELIMINAR
    // ════════════════════════════════════════════════════════════════════

    eliminar: async (
        coleccion,
        id,
        isSyncing = false
    ) => {

        if (!isSyncing) {
            removeShadowRow(coleccion, id);
        }

        if (!window.supabaseClient) {
            return true;
        }

        try {

            const user = await getCurrentUser();

            if (!user) {
                throw new Error(
                    'No hay sesión activa'
                );
            }

            const { error: deleteError } =
                await window.supabaseClient
                    .from(TABLE_NAME)
                    .delete()
                    .eq('id', id)
                    .eq('user_id', user.id);

            if (deleteError) {
                throw deleteError;
            }

            log('Registro eliminado:', id);

            return true;

        } catch (err) {

            error('Error eliminar:', err);

            if (
                !isSyncing &&
                isNetworkError(err)
            ) {

                enqueueOffline({
                    action: 'eliminar',
                    coleccion,
                    id
                });

                return true;
            }

            throw err;
        }
    }
};

// ════════════════════════════════════════════════════════════════════════
// AUTO SYNC
// ════════════════════════════════════════════════════════════════════════

setTimeout(() => {
    processOfflineQueue();
}, 3000);