// db.js - Motor de Base de Datos Cloud (Supabase)
import { getSupabase } from './app.js';

export const DB = {
    guardar: async (coleccion, datos) => {
        const sb = getSupabase();
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return false;

        const { error } = await sb.from('crm_data').insert([{
            id: datos.id,
            user_id: user.id,
            coleccion: coleccion,
            datos: datos
        }]);
        if (error) throw error;
        return true;
    },

    obtenerTodos: async (coleccion) => {
        const sb = getSupabase();
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return [];

        const { data, error } = await sb.from('crm_data')
            .select('datos')
            .eq('user_id', user.id)
            .eq('coleccion', coleccion);

        if (error) throw error;
        return data ? data.map(row => row.datos) : [];
    },

    eliminar: async (coleccion, id) => {
        const sb = getSupabase();
        const { error } = await sb.from('crm_data')
            .delete()
            .eq('id', id);
        if (error) throw error;
        return true;
    },

    actualizar: async (coleccion, id, nuevosDatos) => {
        const sb = getSupabase();
        const { data, error: errGet } = await sb.from('crm_data')
            .select('datos')
            .eq('id', id)
            .single();

        if (errGet || !data) return false;

        const registroActualizado = { ...data.datos, ...nuevosDatos };

        const { error: errUpdate } = await sb.from('crm_data')
            .update({ datos: registroActualizado })
            .eq('id', id);

        if (errUpdate) throw errUpdate;
        return true;
    }
};
