// /services/db.service.js - Motor de Base de Datos Cloud (Supabase) con Soporte Offline Robusto

import { showToast } from './utils.js';

function isNetworkError(err) {
    if (!navigator.onLine) return true;
    const msg = String(err?.message || err).toLowerCase();
    return msg.includes('fetch') || msg.includes('network') || msg.includes('load failed') || msg.includes('typeerror') || msg.includes('timeout');
}

// =========================================================================
// GESTOR DE CACHÉ LOCAL (SHADOW DOM)
// =========================================================================
const shadowPrefix = 'db_shadow_';
const getLocalShadow = (col) => JSON.parse(localStorage.getItem(shadowPrefix + col) || '[]');
const saveLocalShadow = (col, list) => localStorage.setItem(shadowPrefix + col, JSON.stringify(list));

function addToShadow(col, datos) {
    const list = getLocalShadow(col);
    const idx = list.findIndex(item => item.id === datos.id);
    if (idx >= 0) list[idx] = { ...list[idx], ...datos };
    else list.push(datos);
    saveLocalShadow(col, list);
}

function removeFromShadow(col, id) {
    saveLocalShadow(col, getLocalShadow(col).filter(item => item.id !== id));
}

// =========================================================================
// GESTOR DE COLA OFFLINE INTELIGENTE
// =========================================================================
let isOfflineQueueProcessing = false;

export function enqueueOffline(task) {
    const queue = JSON.parse(localStorage.getItem('crm_offline_queue') || '[]');
    // Prevenir saturación: Unificar tareas de actualización pendientes para el mismo ID
    const exists = queue.findIndex(q => q.id === task.id && q.action === task.action && q.coleccion === task.coleccion);
    
    if (exists >= 0 && task.datos) {
        queue[exists].datos = { ...queue[exists].datos, ...task.datos };
    } else {
        queue.push(task);
    }
    localStorage.setItem('crm_offline_queue', JSON.stringify(queue));
}

export async function processOfflineQueue() {
    if (isOfflineQueueProcessing || !navigator.onLine || !window.supabaseClient) return;
    
    const queue = JSON.parse(localStorage.getItem('crm_offline_queue') || '[]');
    if (queue.length === 0) return;

    isOfflineQueueProcessing = true;
    let successCount = 0;
    const pending = [];

    for (const task of queue) {
        try {
            if (task.action === 'guardar' || task.action === 'actualizar') {
                // Upsert unificado para resolución automática de conflictos
                const { error } = await window.supabaseClient.from('crm_data')
                    .upsert({ id: task.id, coleccion: task.coleccion, datos: task.datos }, { onConflict: 'id' });
                if (error) throw error;
            } else if (task.action === 'eliminar') {
                const { error } = await window.supabaseClient.from('crm_data').delete().eq('id', task.id);
                if (error) throw error;
            }
            successCount++;
        } catch (err) {
            console.error(`[SyncManager] Error syncing item ${task.id}:`, err);
            pending.push(task); // Retener si el error es de negocio, no de red
        }
    }

    localStorage.setItem('crm_offline_queue', JSON.stringify(pending));
    isOfflineQueueProcessing = false;

    if (successCount > 0) {
        showToast(`Sincronización silenciosa completada: ${successCount} registros subidos.`, 'success');
    }
}

window.addEventListener('online', processOfflineQueue);

// =========================================================================
// CORE API EXPORTADA (Patrón Singleton Adapter)
// =========================================================================
export const DB = {
    obtenerTodos: async (coleccion) => {
        const local = getLocalShadow(coleccion);
        if (!navigator.onLine || !window.supabaseClient) return local;

        try {
            const { data, error } = await window.supabaseClient.from('crm_data')
                .select('datos')
                .eq('coleccion', coleccion);
                
            if (error) throw error;
            const remote = data.map(row => row.datos);
            saveLocalShadow(coleccion, remote); // Actualizar caché
            return remote;
        } catch (err) {
            if (isNetworkError(err)) return local;
            throw err;
        }
    },

    guardar: async (coleccion, datos, isSyncing = false) => {
        if (!isSyncing) addToShadow(coleccion, datos);
        if (!window.supabaseClient) return false;

        try {
            // ARQUITECTURA: Cambiado de insert() a upsert() para erradicar el bug de duplicación
            const { error } = await window.supabaseClient.from('crm_data')
                .upsert({ id: datos.id, coleccion: coleccion, datos: datos }, { onConflict: 'id' });
            if (error) throw error;
            return true;
        } catch (err) {
            if (!isSyncing && isNetworkError(err)) {
                enqueueOffline({ action: 'guardar', coleccion, id: datos.id, datos });
                return true;
            }
            throw err;
        }
    },

    actualizar: async (coleccion, id, nuevosDatos, isSyncing = false) => {
        if (!isSyncing) {
            const list = getLocalShadow(coleccion);
            const index = list.findIndex(item => item.id === id);
            const merged = index >= 0 ? { ...list[index], ...nuevosDatos } : { id, ...nuevosDatos };
            addToShadow(coleccion, merged);
        }
        
        if (!window.supabaseClient) return false;

        try {
            // Recuperar registro existente para no sobreescribir keys no especificadas
            const { data, error: errGet } = await window.supabaseClient.from('crm_data').select('datos').eq('id', id).single();
            if (errGet && !isNetworkError(errGet)) throw errGet;
            
            const registroActualizado = data ? { ...data.datos, ...nuevosDatos } : { id, ...nuevosDatos };
            
            const { error: errUpdate } = await window.supabaseClient.from('crm_data')
                .update({ datos: registroActualizado }).eq('id', id);
                
            if (errUpdate) throw errUpdate;
            return true;
        } catch (err) {
            if (!isSyncing && isNetworkError(err)) {
                enqueueOffline({ action: 'actualizar', coleccion, id, datos: nuevosDatos });
                return true;
            }
            throw err;
        }
    },

    eliminar: async (coleccion, id, isSyncing = false) => {
        if (!isSyncing) removeFromShadow(coleccion, id);
        if (!window.supabaseClient) return false;

        try {
            const { error } = await window.supabaseClient.from('crm_data').delete().eq('id', id);
            if (error) throw error;
            return true;
        } catch (err) {
            if (!isSyncing && isNetworkError(err)) {
                enqueueOffline({ action: 'eliminar', coleccion, id });
                return true;
            }
            throw err;
        }
    }
};
