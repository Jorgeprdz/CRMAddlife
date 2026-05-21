// utils.js - Utilidades compartidas

export const agendarCita = (nombreProspecto, detalle) => {
    const titulo = encodeURIComponent(`Cita Asesoría Financiera - ${nombreProspecto}`);
    const descripcion = encodeURIComponent(`Reunión: ${detalle}`);
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${titulo}&details=${descripcion}`;
    window.open(url, '_blank');
};
// utils.js - Herramientas Globales del Sistema
export function agendarCita(nombre, detalle) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + 1); // Cita para mañana por defecto
    const dateStr = fecha.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    window.open(`https://www.google.com/calendar/render?action=TEMPLATE&text=Cita+con:+${encodeURIComponent(nombre)}&details=${encodeURIComponent(detalle)}&dates=${dateStr}/${dateStr}`, '_blank');
}
