// db.js - Motor de Base de Datos Cloud (Supabase)

export const DB = {
    guardar: async (coleccion, datos) => {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return false;

        const { error } = await window.supabaseClient.from('crm_data').insert([{
            id: datos.id,
            user_id: user.id,
            coleccion: coleccion,
            datos: datos
        }]);
        if (error) throw error;
        return true;
    },

    obtenerTodos: async (coleccion) => {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return [];

        const { data, error } = await window.supabaseClient.from('crm_data')
            .select('datos')
            .eq('user_id', user.id)
            .eq('coleccion', coleccion);
            
        if (error) throw error;
        return data ? data.map(row => row.datos) : [];
    },

    eliminar: async (coleccion, id) => {
        const { error } = await window.supabaseClient.from('crm_data')
            .delete()
            .eq('id', id);
        if (error) throw error;
        return true;
    },

    actualizar: async (coleccion, id, nuevosDatos) => {
        // Obtenemos los datos actuales para fusionarlos
        const { data, error: errGet } = await window.supabaseClient.from('crm_data')
            .select('datos')
            .eq('id', id)
            .single();
            
        if (errGet || !data) return false;

        const registroActualizado = { ...data.datos, ...nuevosDatos };
        
        const { error: errUpdate } = await window.supabaseClient.from('crm_data')
            .update({ datos: registroActualizado })
            .eq('id', id);
            
        if (errUpdate) throw errUpdate;
        return true;
    }
};
