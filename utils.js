// utils.js - Motor de Notificaciones y Diálogos UI Premium

export function showToast(message, type = 'info') {
    const icons = { success: '✅', danger: '❌', warning: '⚠️', info: 'ℹ️' };

    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 16px;
        left: 50%;
        transform: translateX(-50%) translateY(-80px) scale(0.92);
        background: rgba(28, 28, 30, 0.72);
        -webkit-backdrop-filter: blur(40px) saturate(180%);
        backdrop-filter: blur(40px) saturate(180%);
        color: #ffffff;
        padding: 12px 20px;
        border-radius: 30px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.28), 0 0 0 0.5px rgba(255,255,255,0.12) inset;
        font-size: 13px;
        font-weight: 500;
        z-index: 9999;
        opacity: 0;
        transition: all 0.38s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        display: flex;
        align-items: center;
        gap: 8px;
        max-width: 88vw;
        white-space: nowrap;
        pointer-events: none;
        letter-spacing: -0.1px;
    `;

    toast.innerHTML = `<span style="font-size:15px;">${icons[type]||icons.info}</span><span>${message}</span>`;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            toast.style.transform = 'translateX(-50%) translateY(0) scale(1)';
            toast.style.opacity = '1';
        });
    });

    setTimeout(() => {
        toast.style.transform = 'translateX(-50%) translateY(-60px) scale(0.88)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 380);
    }, 3200);
}

export function showConfirm(text, title = 'Confirmar', confirmText = 'Aceptar', isDestructive = false) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.4);
            backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
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
            <div style="padding:20px 16px;">
                <h3 style="margin:0 0 8px;font-size:16px;font-weight:600;color:var(--text-primary);">${title}</h3>
                <p style="margin:0;font-size:13px;color:var(--text-secondary);line-height:1.4;">${text}</p>
            </div>
            <div style="display:flex;border-top:1px solid var(--separator,#e5e5ea);">
                <button id="btn-cancel" style="flex:1;padding:14px;background:transparent;border:none;border-right:1px solid var(--separator,#e5e5ea);color:var(--text-primary);font-size:15px;font-weight:500;cursor:pointer;">Cancelar</button>
                <button id="btn-confirm" style="flex:1;padding:14px;background:transparent;border:none;color:${btnColor};font-size:15px;font-weight:600;cursor:pointer;">${confirmText}</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            modal.style.transform = 'scale(1)';
        });

        const close = (result) => {
            overlay.style.opacity = '0';
            modal.style.transform = 'scale(0.95)';
            setTimeout(() => { overlay.remove(); resolve(result); }, 200);
        };

        modal.querySelector('#btn-cancel').addEventListener('click', () => close(false));
        modal.querySelector('#btn-confirm').addEventListener('click', () => close(true));
        overlay.addEventListener('click', e => { if(e.target===overlay) close(false); });
    });
}

export function agendarCita(nombre, detalle) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + 1);
    const dateStr = fecha.toISOString().replace(/[-:]/g,'').split('.')[0] + 'Z';
    window.open(`https://www.google.com/calendar/render?action=TEMPLATE&text=Cita+con:+${encodeURIComponent(nombre)}&details=${encodeURIComponent(detalle)}&dates=${dateStr}/${dateStr}`,'_blank');
}
