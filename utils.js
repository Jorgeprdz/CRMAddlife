// utils.js - Herramientas Globales del Sistema

export function agendarCita(nombre, detalle) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + 1); // Cita programada para el día siguiente por defecto
    const dateStr = fecha.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    window.open(`https://www.google.com/calendar/render?action=TEMPLATE&text=Cita+con:+${encodeURIComponent(nombre)}&details=${encodeURIComponent(detalle)}&dates=${dateStr}/${dateStr}`, '_blank');
}

// Obtener o crear el contenedor global de Toasts
function getToastContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    return container;
}

/**
 * Muestra una notificación flotante temporal One UI (Toast)
 * @param {string} mensaje - El texto a mostrar
 * @param {string} tipo - 'success', 'danger', 'warning', 'info'
 */
export function showToast(mensaje, tipo = 'info') {
    const container = getToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;

    let icon = 'ℹ️';
    if (tipo === 'success') icon = '🟢';
    else if (tipo === 'danger') icon = '🚨';
    else if (tipo === 'warning') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span> <span>${mensaje}</span>`;
    container.appendChild(toast);

    // Remover automáticamente después de que termine la animación
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

/**
 * Muestra un modal elegante One UI de confirmación interactiva
 * @param {string} mensaje - Pregunta a realizar
 * @param {string} titulo - Título de la ventana
 * @param {string} botonAceptarTxt - Texto del botón de confirmar
 * @param {boolean} esPeligroso - True para teñir el botón de confirmar de rojo (peligro)
 * @returns {Promise<boolean>}
 */
export function showConfirm(mensaje, titulo = 'Confirmación', botonAceptarTxt = 'Confirmar', esPeligroso = false) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';

        const btnClass = esPeligroso ? 'dialog-btn-danger' : 'dialog-btn-confirm';

        overlay.innerHTML = `
            <div class="dialog-box">
                <div class="dialog-title">${titulo}</div>
                <div class="dialog-message">${mensaje}</div>
                <div class="dialog-buttons">
                    <button class="dialog-btn dialog-btn-cancel" id="dlg-cancel">Cancelar</button>
                    <button class="dialog-btn ${btnClass}" id="dlg-ok">${botonAceptarTxt}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const btnCancel = overlay.querySelector('#dlg-cancel');
        const btnOk = overlay.querySelector('#dlg-ok');

        const close = (value) => {
            overlay.style.animation = 'dialogFadeOut 0.2s forwards';
            const box = overlay.querySelector('.dialog-box');
            if (box) box.style.animation = 'dialogScaleOut 0.2s forwards';
            setTimeout(() => {
                overlay.remove();
                resolve(value);
            }, 180);
        };

        btnCancel.addEventListener('click', () => close(false));
        btnOk.addEventListener('click', () => close(true));

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close(false);
        });
    });
}

/**
 * Muestra un modal elegante One UI de alerta informativa
 * @param {string} mensaje - Mensaje a informar
 * @param {string} titulo - Título de la ventana
 * @returns {Promise<void>}
 */
export function showAlert(mensaje, titulo = 'Información') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';

        overlay.innerHTML = `
            <div class="dialog-box">
                <div class="dialog-title">${titulo}</div>
                <div class="dialog-message">${mensaje}</div>
                <div class="dialog-buttons">
                    <button class="dialog-btn dialog-btn-confirm" id="dlg-ok" style="width:100% !important;">Aceptar</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const btnOk = overlay.querySelector('#dlg-ok');

        const close = () => {
            overlay.style.animation = 'dialogFadeOut 0.2s forwards';
            const box = overlay.querySelector('.dialog-box');
            if (box) box.style.animation = 'dialogScaleOut 0.2s forwards';
            setTimeout(() => {
                overlay.remove();
                resolve();
            }, 180);
        };

        btnOk.addEventListener('click', close);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });
    });
}
