// utils.js - Herramientas Globales del Sistema
export function agendarCita(nombre, detalle) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + 1); // Cita programada para el día siguiente por defecto
    const dateStr = fecha.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    window.open(`https://www.google.com/calendar/render?action=TEMPLATE&text=Cita+con:+${encodeURIComponent(nombre)}&details=${encodeURIComponent(detalle)}&dates=${dateStr}/${dateStr}`, '_blank');
}
