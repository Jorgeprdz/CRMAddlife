import { renderDashboard, bindDashboardEvents } from './dashboard.js';
import { renderProspeccion, bindProspeccionEvents } from './prospeccion.js';
import { renderReferidos, bindReferidosEvents } from './referidos.js';
import { renderActividad, bindActividadEvents } from './actividad.js';
import { renderCartera, bindCarteraEvents } from './cartera.js';

export const API_KEY = "AIzaSyBUn0wCKWMtiU2yqk8sKo8I3yCSMjoEDiM";

export async function callGemini(promptText, outputElementId) {
    const output = document.getElementById(outputElementId);
    if (output) output.innerText = "Procesando estrategia con IA...";
    
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
        });
        
        const data = await res.json();
        if (data.candidates && data.candidates.length > 0) {
            if (output) output.innerText = data.candidates[0].content.parts[0].text;
        } else {
            if (output) output.innerText = "Error API: " + (data.error ? data.error.message : "Respuesta vacía");
        }
    } catch (err) {
        if (output) output.innerText = "Error de conexión: " + err.message;
    }
}

window.navigateTo = function(moduleName) {
    const contentArea = document.getElementById('app-content');
    
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`[data-target="${moduleName}"]`);
    if(activeBtn) activeBtn.classList.add('active');

    contentArea.innerHTML = ''; 

    try {
        if (moduleName === 'dashboard') {
            contentArea.innerHTML = renderDashboard();
            setTimeout(() => bindDashboardEvents(), 50);
        } else if (moduleName === 'prospeccion') {
            contentArea.innerHTML = renderProspeccion();
            setTimeout(() => bindProspeccionEvents(), 50);
        } else if (moduleName === 'referidos') {
            contentArea.innerHTML = renderReferidos();
            setTimeout(() => bindReferidosEvents(), 50);
        } else if (moduleName === 'actividad') {
            contentArea.innerHTML = renderActividad();
            setTimeout(() => bindActividadEvents(), 50);
        } else if (moduleName === 'cartera') {
            contentArea.innerHTML = renderCartera();
            setTimeout(() => bindCarteraEvents(), 50);
        } else {
            contentArea.innerHTML = `<div class="card"><h2>${moduleName.toUpperCase()}</h2><p>Módulo en construcción.</p></div>`;
        }
    } catch (error) {
        contentArea.innerHTML = `<div class="card" style="color:red;"><h2>Error</h2><p>${error.message}</p></div>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.body.addEventListener('click', (e) => {
        const navBtn = e.target.closest('.nav-btn');
        if (navBtn) {
            const target = navBtn.getAttribute('data-target');
            if (target) window.navigateTo(target);
        }
    });

    window.navigateTo('dashboard');
});
