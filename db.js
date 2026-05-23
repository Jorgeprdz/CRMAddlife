// db.js - Motor de Base de Datos Cloud (Supabase) con Soporte Offline

import { showToast } from './utils.js';

// Auxiliar para comprobar fallas de red
function isNetworkError(err) {
    if (!navigator.onLine) return true;
    const msg = String(err.message || err).toLowerCase();
    return msg.includes('failed to fetch') || msg.includes('network') || msg.includes('load failed') || msg.includes('typeerror');
}

// Auxiliares de LocalStorage Shadow
function getLocalShadow(coleccion) {
    return JSON.parse(localStorage.getItem(`db_shadow_${coleccion}`) || '[]');
}

function saveLocalShadow(coleccion, list) {
    localStorage.setItem(`db_shadow_${coleccion}`, JSON.stringify(list));
}

function addToShadow(coleccion, datos) {
    const list = getLocalShadow(coleccion);
    const index = list.findIndex(item => item.id === datos.id);
    if (index >= 0) {
        list[index] = datos;
    } else {
        list.push(datos);
    }
    saveLocalShadow(coleccion, list);
}

function removeFromShadow(coleccion, id) {
    const list = getLocalShadow(coleccion);
    const filtered = list.filter(item => item.id !== id);
    saveLocalShadow(coleccion, filtered);
}

function updateInShadow(coleccion, id, nuevosDatos) {
    const list = getLocalShadow(coleccion);
    const index = list.findIndex(item => item.id === id);
    if (index >= 0) {
        list[index] = { ...list[index], ...nuevosDatos };
        saveLocalShadow(coleccion, list);
        return list[index];
    }
    return null;
}

// Manejo de la Cola de Cambios Fuera de Línea
function getOfflineQueue() {
    return JSON.parse(localStorage.getItem('db_offline_queue') || '[]');
}

function saveOfflineQueue(queue) {
    localStorage.setItem('db_offline_queue', JSON.stringify(queue));
}

function enqueueOffline(item) {
    const queue = getOfflineQueue();
    queue.push(item);
    saveOfflineQueue(queue);
}

export async function processOfflineQueue() {
    if (!navigator.onLine) return;
    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    let itemsProcessed = 0;
    while (queue.length > 0) {
        const item = queue[0];
        try {
            let success = false;
            if (item.action === 'guardar') {
                success = await DB.guardar(item.coleccion, item.datos, true);
            } else if (item.action === 'eliminar') {
                success = await DB.eliminar(item.coleccion, item.id, true);
            } else if (item.action === 'actualizar') {
                success = await DB.actualizar(item.coleccion, item.id, item.datos, true);
            }

            if (success) {
                queue.shift();
                saveOfflineQueue(queue);
                itemsProcessed++;
            } else {
                break;
            }
        } catch (err) {
            if (isNetworkError(err)) {
                break;
            } else {
                // Registro defectuoso (ej: restricciones DB), omitir para evitar bloqueo
                console.error("Descartando elemento inválido de la cola offline:", item, err);
                queue.shift();
                saveOfflineQueue(queue);
            }
        }
    }

    if (itemsProcessed > 0) {
        showToast(`Se sincronizaron ${itemsProcessed} cambios pendientes con la nube.`, 'success');
    }
}

export const DB = {
    guardar: async (coleccion, datos, isSyncing = false) => {
        if (!isSyncing) {
            addToShadow(coleccion, datos);
        }

        try {
            const { data: { user } } = await window.supabaseClient.auth.getUser();
            if (!user) throw new Error("No autenticado.");

            const { error } = await window.supabaseClient.from('crm_data').insert([{
                id: datos.id,
                user_id: user.id,
                coleccion: coleccion,
                datos: datos
            }]);
            if (error) throw error;
            return true;
        } catch (err) {
            if (!isSyncing && isNetworkError(err)) {
                enqueueOffline({ action: 'guardar', coleccion, datos });
                showToast('Sin conexión. Guardado localmente.', 'warning');
                return true;
            }
            throw err;
        }
    },

    obtenerTodos: async (coleccion) => {
        try {
            const { data: { user } } = await window.supabaseClient.auth.getUser();
            if (!user) return getLocalShadow(coleccion);

            const { data, error } = await window.supabaseClient.from('crm_data')
                .select('datos')
                .eq('user_id', user.id)
                .eq('coleccion', coleccion);
                
            if (error) throw error;
            
            const list = data ? data.map(row => row.datos) : [];
            saveLocalShadow(coleccion, list); // Guardar copia espejo
            return list;
        } catch (err) {
            if (isNetworkError(err)) {
                showToast('Sin conexión. Trabajando con caché local.', 'warning');
                return getLocalShadow(coleccion);
            }
            console.error("Error al obtener todos:", err);
            return getLocalShadow(coleccion);
        }
    },

    eliminar: async (coleccion, id, isSyncing = false) => {
        if (!isSyncing) {
            removeFromShadow(coleccion, id);
        }

        try {
            const { error } = await window.supabaseClient.from('crm_data')
                .delete()
                .eq('id', id);
            if (error) throw error;
            return true;
        } catch (err) {
            if (!isSyncing && isNetworkError(err)) {
                enqueueOffline({ action: 'eliminar', coleccion, id });
                showToast('Sin conexión. Eliminación encolada.', 'warning');
                return true;
            }
            throw err;
        }
    },

    actualizar: async (coleccion, id, nuevosDatos, isSyncing = false) => {
        if (!isSyncing) {
            updateInShadow(coleccion, id, nuevosDatos);
        }

        try {
            const { data, error: errGet } = await window.supabaseClient.from('crm_data')
                .select('datos')
                .eq('id', id)
                .single();
                
            if (errGet || !data) {
                if (errGet && isNetworkError(errGet)) throw errGet;
                return false;
            }

            const registroActualizado = { ...data.datos, ...nuevosDatos };
            
            const { error: errUpdate } = await window.supabaseClient.from('crm_data')
                .update({ datos: registroActualizado })
                .eq('id', id);
                
            if (errUpdate) throw errUpdate;
            return true;
        } catch (err) {
            if (!isSyncing && isNetworkError(err)) {
                enqueueOffline({ action: 'actualizar', coleccion, id, datos: nuevosDatos });
                showToast('Sin conexión. Edición guardada localmente.', 'warning');
                return true;
            }
            throw err;
        }
    }
};
