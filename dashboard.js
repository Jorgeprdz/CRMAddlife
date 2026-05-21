import { DB } from './db.js';

export function renderDashboard() {
    // Retorna un contenedor vacío que se llenará con los datos al cargar
    return `<div id="dashboard-container" style="display: flex; flex-direction: column; gap: 15px;">
                <div style="text-align: center; color: #8E8E93; padding: 20px;">Cargando tu inteligencia de negocio...</div>
            </div>`;
}

export async function bindDashboardEvents() {
    const container = document.getElementById('dashboard-container');
    if (!container) return;

    // 1. Saludo Dinámico
    const hora = new Date().getHours();
    let saludo = "Buenas noches";
    if (hora >= 5 && hora < 12) saludo = "Buenos días";
    else if (hora >= 12 && hora < 19) saludo = "Buenas tardes";
    
    const nombre = "Jorge"; // Tu nombre integrado directamente

    // 2. Cálculos de Actividad (Semana Hábil)
    const historial = await DB.obtenerTodos('historial_actividad');
    const hoy = new Date();
    
    // Calcular Lunes y Viernes de esta semana
    const lunes = new Date(hoy);
    const dia = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1;
    lunes.setDate(hoy.getDate() - dia);
    lunes.setHours(0,0,0,0);
    
    const viernes = new Date(lunes);
    viernes.setDate(lunes.getDate() + 4);
    viernes.setHours(23,59,59,999);

    let puntosSemana = 0;
    historial.forEach(reg => {
        const f = new Date(reg.fecha + 'T12:00:00');
        if(f >= lunes && f <= viernes) puntosSemana += reg.puntos;
    });

    const metaSemana = 125;
    const faltantes = metaSemana - puntosSemana;
    
    // Días hábiles restantes
    let diaSemana = hoy.getDay(); 
    let diasRestantes = (diaSemana >= 1 && diaSemana <= 5) ? (6 - diaSemana) : 0;
    let ritmo = diasRestantes > 0 && faltantes > 0 ? Math.ceil(faltantes / diasRestantes) : 0;

    let textoActividad = '';
    if (faltantes <= 0) {
        textoActividad = `<p style="color: #34C759; font-size: 15px; margin-top: 5px;">¡Meta superada! Llevas <strong>${puntosSemana} puntos</strong> esta semana. 🚀</p>`;
    } else if (diasRestantes === 0) {
        textoActividad = `<p style="color: #FF3B30; font-size: 15px; margin-top: 5px;">Cerraste la semana con <strong>${puntosSemana} puntos de 125</strong>. Es fin de semana, descansa y planifica tu próximo arranque.</p>`;
    } else {
        textoActividad = `<p style="color: #48484A; font-size: 15px; margin-top: 5px;">Esta semana llevas <strong>${puntosSemana} puntos de 125</strong>. Te hacen falta <strong>${faltantes} puntos</strong> para llegar a la meta.<br><br>🎯 Debes hacer <strong>${ritmo} puntos diarios</strong> en los ${diasRestantes} días de la semana hábil restante.</p>`;
    }

    // 3. Cálculos de Cartera (Pendientes del mes)
    const cartera = await DB.obtenerTodos('cartera');
    const mesActual = hoy.getMonth();
    const anioActual = hoy.getFullYear();
    
    const pendientesMes = cartera.filter(p => {
        const f = new Date(p.fechaPago + 'T12:00:00');
        return f.getMonth() === mesActual && f.getFullYear() === anioActual;
    });

    let textoCartera = '';
    if (pendientesMes.length === 0) {
        textoCartera = `<p style="color: #34C759; font-size: 14px; margin-top: 5px;">Todo en orden. No tienes pólizas pendientes de pago para este mes.</p>`;
    } else {
        // Formateamos los nombres en negrita
        const listaNombres = pendientesMes.map(p => `<strong>${p.cliente}</strong>`).join(', ');
        // Manejamos singular o plural
        const verbo = pendientesMes.length > 1 ? 'están pendientes' : 'está pendiente';
        const laPoliza = pendientesMes.length > 1 ? 'Las pólizas de' : 'La póliza de';
        
        textoCartera = `<p style="color: #FF3B30; font-size: 15px; margin-top: 5px;">${laPoliza} ${listaNombres} ${verbo} de pago este mes.</p>`;
    }

    // 4. Inyección del HTML final
    container.innerHTML = `
        <div class="card" style="background: #007AFF; color: white;">
            <h1 style="margin: 0; font-size: 24px;">${saludo}, ${nombre}. 👋</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 14px;">Este es el estatus de tu negocio al día de hoy.</p>
        </div>

        <div class="card" style="border-left: 5px solid #007AFF;">
            <h2 style="display: flex; align-items: center; gap: 8px;">📊 Productividad</h2>
            ${textoActividad}
        </div>

        <div class="card" style="border-left: 5px solid #FF3B30;">
            <h2 style="display: flex; align-items: center; gap: 8px;">💼 Alertas de Cartera</h2>
            ${textoCartera}
        </div>
    `;
}
