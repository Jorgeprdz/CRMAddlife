// utils.js - Utilidades compartidas

export const agendarCita = (nombreProspecto, detalle) => {
    const titulo = encodeURIComponent(`Cita Asesoría Financiera - ${nombreProspecto}`);
    const descripcion = encodeURIComponent(`Reunión: ${detalle}`);
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${titulo}&details=${descripcion}`;
    window.open(url, '_blank');
};
