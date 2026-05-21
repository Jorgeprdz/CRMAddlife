// db.js - Motor de Base de Datos Local Avanzado (IndexedDB)
const DB_NAME = 'CRM_Addlife_DB';
const DB_VERSION = 2; // Actualizado para incluir Cartera

function abrirDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            
            if (!db.objectStoreNames.contains('referidos')) {
                db.createObjectStore('referidos', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('historial_actividad')) {
                db.createObjectStore('historial_actividad', { keyPath: 'id' });
            }
            // NUEVA TABLA DE CARTERA
            if (!db.objectStoreNames.contains('cartera')) {
                db.createObjectStore('cartera', { keyPath: 'id' });
            }
        };

        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

export const DB = {
    guardar: async (coleccion, datos) => {
        const db = await abrirDB();
        return new Promise((resolve, reject) => {
            const transaccion = db.transaction(coleccion, 'readwrite');
            const almacén = transaccion.objectStore(coleccion);
            almacén.put(datos);
            transaccion.oncomplete = () => resolve(true);
            transaccion.onerror = () => reject(transaccion.error);
        });
    },
    
    obtenerTodos: async (coleccion) => {
        const db = await abrirDB();
        return new Promise((resolve, reject) => {
            const transaccion = db.transaction(coleccion, 'readonly');
            const almacén = transaccion.objectStore(coleccion);
            const solicitud = almacén.getAll();
            solicitud.onsuccess = () => resolve(solicitud.result || []);
            solicitud.onerror = () => reject(solicitud.error);
        });
    },

    eliminar: async (coleccion, id) => {
        const db = await abrirDB();
        return new Promise((resolve, reject) => {
            const transaccion = db.transaction(coleccion, 'readwrite');
            const almacén = transaccion.objectStore(coleccion);
            almacén.delete(id);
            transaccion.oncomplete = () => resolve(true);
            transaccion.onerror = () => reject(transaccion.error);
        });
    },

    actualizar: async (coleccion, id, nuevosDatos) => {
        const db = await abrirDB();
        return new Promise((resolve, reject) => {
            const transaccion = db.transaction(coleccion, 'readwrite');
            const almacén = transaccion.objectStore(coleccion);
            const consulta = almacén.get(id);

            consulta.onsuccess = () => {
                const registroExistente = consulta.result;
                if (registroExistente) {
                    const registroActualizado = { ...registroExistente, ...nuevosDatos };
                    almacén.put(registroActualizado);
                }
            };
            transaccion.oncomplete = () => resolve(true);
            transaccion.onerror = () => reject(transaccion.error);
        });
    }
};
