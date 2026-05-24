// /modules/utils.js - Motor de Notificaciones y Diálogos UI Premium

/**
 * Muestra una notificación temporal no intrusiva (Toast).
 * @param {string} message - Texto a mostrar.
 * @param {string} type - 'success', 'danger', 'warning', 'info'.
 */
export function showToast(message, type = 'info') {
    const colors = {
        success: '#34C759',
        danger: '#FF3B30',
        warning: '#FF9500',
        info: '#007AFF'
    };

    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%) translateY(-20px);
        background: var(--surface-2, #ffffff);
        color: var(--text-primary, #000000);
        padding: 12px 20px;
        border-radius: 30px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.15);
        font-size: 13px;
        font-weight: 500;
        z-index: 9999;
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        border-left: 4px solid ${colors[type] || colors.info};
        display: flex;
        align-items: center;
        gap: 8px;
        max-width: 90vw;
        text-align: center;
    `;

    toast.innerHTML = `<span>${message}</span>`;
    document.body.appendChild(toast);

    // Animación de entrada
    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(-50%) translateY(0)';
        toast.style.opacity = '1';
    });

    // Auto-destrucción y limpieza de memoria
    setTimeout(() => {
        toast.style.transform = 'translateX(-50%) translateY(-20px)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

/**
 * Muestra un diálogo de confirmación asíncrono (Modal) sin bloquear el Event Loop.
 * @param {string} text - Pregunta o advertencia.
 * @param {string} title - Título del modal.
 * @param {string} confirmText - Texto del botón de acción.
 * @param {boolean} isDestructive - Si es true, el botón será rojo.
 * @returns {Promise<boolean>} - Resuelve true si el usuario confirma, false si cancela.
 */
export function showConfirm(text, title = 'Confirmar', confirmText = 'Aceptar', isDestructive = false) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.4); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
            z-index: 10000; display: flex; align-items: center; justify-content: center;
            opacity: 0; transition: opacity 0.2s ease;
        `;

        const btnColor = isDestructive ? '#FF3B30' : '#007AFF';
        
        const modal = document.createElement('div');
        modal.style.cssText = `
            background: var(--surface, #ffffff); width: 280px; border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.2); overflow: hidden;
            transform: scale(0.95); transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            text-align: center; border: 1px solid var(--separator, #e5e5ea);
        `;

        modal.innerHTML = `
            <div style="padding: 20px 16px;">
                <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: var(--text-primary);">${title}</h3>
                <p style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.4;">${text}</p>
            </div>
            <div style="display: flex; border-top: 1px solid var(--separator, #e5e5ea);">
                <button id="btn-cancel" style="flex: 1; padding: 14px; background: transparent; border: none; border-right: 1px solid var(--separator, #e5e5ea); color: var(--text-primary); font-size: 15px; font-weight: 500; cursor: pointer;">Cancelar</button>
                <button id="btn-confirm" style="flex: 1; padding: 14px; background: transparent; border: none; color: ${btnColor}; font-size: 15px; font-weight: 600; cursor: pointer;">${confirmText}</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Animación de entrada
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            modal.style.transform = 'scale(1)';
        });

        const close = (result) => {
            overlay.style.opacity = '0';
            modal.style.transform = 'scale(0.95)';
            setTimeout(() => {
                overlay.remove();
                resolve(result);
            }, 200);
        };

        modal.querySelector('#btn-cancel').addEventListener('click', () => close(false));
        modal.querySelector('#btn-confirm').addEventListener('click', () => close(true));
    });
}
