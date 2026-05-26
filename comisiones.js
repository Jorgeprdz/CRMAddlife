// comisiones.js — Motor Financiero SMNYL v5
// Cuadernos 2026: Asesores en Desarrollo + Nuevos Profesionales

import { DB } from './db.js';
import { getSupabase, callGemini } from './app.js';
import { showToast, showConfirm } from './utils.js';

// ═══════════════════════════════════════════════════════════════════════════
// TASAS DE COMISIÓN — [año1, año2, año3, año4-5, año6-10, año11+]
// ═══════════════════════════════════════════════════════════════════════════
const TASAS_VIDA = {
    // ── Más vendidos (prioridad visual) ──────────────────────────────────
    'Segubeca':           { default:[0.33,0.10,0.07,0.03,0.03,0.00] },
    'Imagina Ser':        { default:[0.35,0.12,0.08,0.05,0.05,0.035], '10 Pagos':[0.27,0.085,0.04,0.04,0.04,0], '15 Pagos':[0.30,0.12,0.08,0.05,0.05,0.035], 'Prima Única':[0.085,0,0,0,0,0] },
    'Orvi':               { default:[0.44,0.15,0.10,0.10,0.05,0.02] },
    'Orvi 99':            { default:[0.44,0.15,0.10,0.10,0.05,0.02] },
    'Realiza':            { default:[0.44,0.15,0.10,0.05,0.05,0.008] },
    // ── Otros productos ───────────────────────────────────────────────────
    'Star Temporal':      { default:[0.35,0.15,0.10,0.10,0.05,0.02], '20a <500k':[0.44,0.15,0.10,0.10,0.05,0.02], '10a >=500k':[0.30,0.15,0.10,0.10,0.05,0.00], '1a':[0.22,0,0,0,0,0], '5a':[0.35,0.10,0.09,0.09,0,0] },
    'Mio':                { default:[0.80,0.20,0.14,0.08,0.08,0.02] },
    'Objetivo Vida':      { default:[0.44,0.15,0.10,0.05,0.05,0.01] },
    'Nuevo Plenitud':     { default:[0.35,0.12,0.08,0.05,0.05,0.035], '15 Pagos':[0.32,0.05,0.04,0.02,0.02,0] },
    'Plenitud':           { default:[0.35,0.12,0.08,0.05,0.05,0.035] },
    'Vida Mujer':         { default:[0.40,0.15,0.10,0.05,0.05,0.02] },
    'Nuevo Vida Mujer':   { default:[0.40,0.15,0.10,0.05,0.05,0.02] },
    'Star Dotal':         { default:[0.35,0.12,0.10,0.05,0.05,0.02], '5a':[0.11,0.05,0.04,0,0,0], '10a':[0.27,0.09,0.07,0.05,0.05,0], '15a':[0.28,0.09,0.07,0.05,0.05,0.05] },
    'Legado':             { default:[0.44,0.15,0.10,0.05,0.05,0.01] },
    'Respaldo Educativo': { default:[0.35,0.10,0.09,0,0,0] },
    'Respaldo Negocio':   { default:[0.35,0.10,0.09,0,0,0] },
};

// GMM — [edad_0-4, edad_5-54, edad_55-59, edad_60+]
const TASAS_GMM = {
    'Alfa Medical':              { i:[0.17,0.22,0.13,0.10], r:[0.15,0.17,0.13,0.10] },
    'Alfa Medical Flex':         { i:[0.15,0.22,0.13,0.10], r:[0.13,0.17,0.13,0.10] },
    'Alfa Medical Internacional':{ i:[0.17,0.25,0.25,0.10], r:[0.15,0.17,0.17,0.10] },
};
const GMM_PLANES = Object.keys(TASAS_GMM);
const PLANES_SIN_PUNTOS = ['Star Temporal 1','Tempo Vida 1'];

function getTasaVida(plan, variante, anioPoliza) {
    const prod = TASAS_VIDA[plan];
    if (!prod) return 0.10;
    const arr = (variante && prod[variante]) ? prod[variante] : prod.default;
    const idx = anioPoliza===1?0 : anioPoliza===2?1 : anioPoliza===3?2 : anioPoliza<=5?3 : anioPoliza<=10?4 : 5;
    return arr[idx] || 0;
}
function getTasaGMM(plan, edad, esRenov) {
    const p = TASAS_GMM[plan]; if (!p) return 0.15;
    const arr = esRenov ? p.r : p.i;
    return edad<=4?arr[0] : edad<=54?arr[1] : edad<=59?arr[2] : arr[3];
}
function getAnioPoliza(fechaEmision) {
    if (!fechaEmision) return 1;
    return Math.max(1, Math.floor((new Date()-new Date(fechaEmision+'T12:00:00'))/(1000*60*60*24*365.25))+1);
}
function factorPago(fp) {
    return fp==='Mensual'?1/12 : fp==='Trimestral'?1/4 : fp==='Semestral'?1/2 : 1;
}

// ── PUNTOS DE CONCURSO (Reglas de Conteo 2026) ────────────────────────────
function puntosPoliza(plan, primaAnual, esGMM) {
    if (PLANES_SIN_PUNTOS.some(p => plan.includes(p))) return 0;
    if (esGMM) return primaAnual >= 10000 ? 0.5 : 0;
    if (primaAnual < 17000)  return 0;
    if (primaAnual < 65000)  return 1;
    if (primaAnual < 190000) return 2;
    return 3;
}
function ponderarPrima(plan, prima) {
    const p = {'Star Temporal':1.10,'Orvi 99':0.90,'Orvi':0.90,'Mio':1.30,'Imagina Ser':1.10,'Nuevo Plenitud':1.00,'Respaldo Educativo':1.00,'Respaldo Negocio':1.00,'Vida Mujer':1.00,'Nuevo Vida Mujer':1.00,'Star Dotal':0.50,'Legado':1.10,'Realiza':1.10,'Objetivo Vida':1.20,'Segubeca':0.50};
    return prima * (p[plan] || 1.00);
}

// ═══════════════════════════════════════════════════════════════════════════
// CUADERNOS DE CONCURSOS 2026
// ═══════════════════════════════════════════════════════════════════════════
const TRAINING_METAS = {
    1:{comAcum:9000, ptosAcum:3, premMax:33000},   2:{comAcum:15000,ptosAcum:6, premMax:56000},
    3:{comAcum:21000,ptosAcum:9, premMax:69000},   4:{comAcum:31000,ptosAcum:12,premMax:102000},
    5:{comAcum:39000,ptosAcum:15,premMax:129000},  6:{comAcum:51000,ptosAcum:18,premMax:167000},
    7:{comAcum:13000,ptosAcum:3, premMax:38000},   8:{comAcum:21000,ptosAcum:6, premMax:64000},
    9:{comAcum:32000,ptosAcum:9, premMax:95000},  10:{comAcum:43000,ptosAcum:12,premMax:130000},
   11:{comAcum:55000,ptosAcum:15,premMax:165000}, 12:{comAcum:70000,ptosAcum:18,premMax:210000},
};

const NP_GRUPOS = [
    {g:1,mes6:2735000},{g:2,mes6:2505000},{g:3,mes6:2125000},{g:4,mes6:1945000},
    {g:5,mes6:1820000},{g:6,mes6:1675000},{g:7,mes6:1495000},{g:8,mes6:1290000},
    {g:9,mes6:1115000},{g:10,mes6:950000},{g:11,mes6:735000},{g:12,mes6:525000},
    {g:13,mes6:420000},{g:14,mes6:385000},{g:15,mes6:330000},{g:16,mes6:275000},
];
const NP_BONO_PCT = {
    1:{min:9.8,l87:19.5,l89:33.0,l91:36.0,l95:45.0},  2:{min:8.3,l87:16.5,l89:30.5,l91:34.0,l95:43.0},
    3:{min:7.0,l87:14.0,l89:27.5,l91:32.0,l95:40.0},  4:{min:6.3,l87:12.5,l89:26.5,l91:30.0,l95:37.0},
    5:{min:5.8,l87:11.5,l89:24.5,l91:28.0,l95:35.0},  6:{min:5.3,l87:10.5,l89:22.0,l91:26.0,l95:33.0},
    7:{min:5.0,l87:10.0,l89:19.5,l91:25.0,l95:31.0},  8:{min:4.8,l87:9.5, l89:16.5,l91:23.0,l95:29.0},
    9:{min:4.5,l87:9.0, l89:14.0,l91:22.0,l95:27.0}, 10:{min:4.3,l87:8.5, l89:11.0,l91:20.0,l95:25.0},
   11:{min:4.0,l87:8.0, l89:10.0,l91:18.0,l95:23.0}, 12:{min:3.5,l87:7.0, l89:9.0, l91:17.0,l95:21.0},
   13:{min:2.8,l87:5.5, l89:8.0, l91:15.0,l95:19.0}, 14:{min:2.3,l87:4.5, l89:7.0, l91:14.0,l95:17.0},
   15:{min:1.8,l87:3.5, l89:5.5, l91:12.0,l95:15.0}, 16:{min:1.0,l87:2.0, l89:2.5, l91:11.0,l95:14.0},
};
const GMM_GRUPOS = [
    {g:1,pols:8,mes3:790000,pct:0.16},{g:2,pols:6,mes3:610000,pct:0.14},
    {g:3,pols:5,mes3:485000,pct:0.13},{g:4,pols:4,mes3:365000,pct:0.10},
    {g:5,pols:3,mes3:280000,pct:0.09},{g:6,pols:3,mes3:215000,pct:0.08},
    {g:7,pols:2,mes3:160000,pct:0.07},
];

function getNPGrupo(primaMeta) { return (NP_GRUPOS.find(g => primaMeta >= g.mes6)||{}).g || null; }
function getNPBonoPct(grupo, limra) {
    const b = NP_BONO_PCT[grupo]; if(!b) return 0;
    if(limra>=95.5) return b.l95; if(limra>=91.5) return b.l91;
    if(limra>=89.5) return b.l89; if(limra>=87.5) return b.l87;
    return b.min;
}
function getGMMGrupo(primaGMM, polsGMM) {
    return GMM_GRUPOS.find(g => primaGMM>=g.mes3 && polsGMM>=g.pols) || null;
}

// ═══════════════════════════════════════════════════════════════════════════
// MOTOR DE CÁLCULO
// ═══════════════════════════════════════════════════════════════════════════
const fmt  = n => new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(n||0);
const fmtN = n => Number(n||0).toFixed(1);

function calcularMotor(cartera, perfil) {
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const fxConn = new Date((perfil.fecha_conexion||perfil.fechaConexion)+'T12:00:00');
    const mesConcurso = Math.max(1, Math.floor((hoy-fxConn)/(1000*60*60*24*30.44))+1);
    const esDesarrollo = mesConcurso <= 12;
    const factorD = esDesarrollo ? 0.90 : 1.0;

    const mes = hoy.getMonth(), anio = hoy.getFullYear();
    const semInicio  = mes < 6 ? 0 : 6;
    const trimInicio = Math.floor(mes/3)*3;
    const mesPD = new Date(anio, mes-1, 1);
    const mesPA = mesPD.getMonth(), anioPA = mesPD.getFullYear();

    let comInicialMes=0, comRenovMes=0, puntosMes=0, primaMetaMes=0;
    let comInicialSem=0, puntosSem=0, primaMetaSem=0;
    let primaGMMtrim=0, polsGMMtrim=0;
    let comMesPasado=0, polsMesPasado=0;
    let comYTD=0, comInicialYTD=0;

    const hist6 = Array(6).fill(null).map(()=>({ini:0,ren:0}));
    const etiq6 = [];
    for(let i=5;i>=0;i--) {
        const d = new Date(anio,mes-i,1);
        etiq6.push(d.toLocaleString('es-MX',{month:'short'}).toUpperCase());
    }
    const detallesMes = [];

    cartera.forEach(p => {
        if(!p.emision) return;
        const fE    = new Date(p.emision+'T12:00:00');
        const mesEm = fE.getMonth(), anioEm = fE.getFullYear();
        const anioP = getAnioPoliza(p.emision);
        const esRenov = anioP > 1;
        const esGMM   = GMM_PLANES.includes(p.plan);
        const prima   = Number(String(p.prima||0).replace(/[^0-9.-]/g,''))||0;
        const primaRecibo = prima * factorPago(p.formaPago);
        const edad    = p.edadContrato ? Number(p.edadContrato) : 30;

        const tasa = (esGMM
            ? getTasaGMM(p.plan, edad, esRenov)
            : getTasaVida(p.plan, p.variante, anioP)) * factorD;

        const comRecibo = primaRecibo * tasa;
        const comAnual  = prima * tasa;
        const puntos    = puntosPoliza(p.plan, prima, esGMM);

        if(anioEm===anio){ comYTD+=comAnual; if(!esRenov&&!p.esPersonal) comInicialYTD+=comAnual; }

        if(mesEm===mes && anioEm===anio) {
            if(esRenov) { comRenovMes+=comRecibo; }
            else {
                comInicialMes+=comRecibo;
                if(!p.esPersonal){ puntosMes+=puntos; primaMetaMes+=ponderarPrima(p.plan,prima); }
            }
            detallesMes.push({ cliente:p.cliente||'—', plan:p.plan, variante:p.variante||'', prima, formaPago:p.formaPago||'Anual', anioP, tasa, comRecibo, esRenov, esGMM, puntos });
        }

        if(mesEm===mesPA && anioEm===anioPA){ comMesPasado+=comRecibo; if(!esRenov) polsMesPasado++; }

        if(anioEm===anio && mesEm>=semInicio && mesEm<=mes && !esRenov && !p.esPersonal){
            comInicialSem+=comRecibo; puntosSem+=puntos; primaMetaSem+=ponderarPrima(p.plan,prima);
        }

        if(esGMM&&!esRenov&&anioEm===anio&&mesEm>=trimInicio&&mesEm<=mes){
            primaGMMtrim+=prima; polsGMMtrim+=0.5;
        }

        for(let i=0;i<6;i++){
            const d=new Date(anio,mes-(5-i),1);
            if(mesEm===d.getMonth()&&anioEm===d.getFullYear()){
                if(esRenov) hist6[i].ren+=comRecibo; else hist6[i].ini+=comRecibo;
            }
        }
    });

    // Renovaciones confirmadas manualmente
    cartera.forEach(p=>{
        (p.renovacionesPagadas||[]).forEach(r=>{
            const fR=new Date(r.fecha+'T12:00:00');
            if(fR.getMonth()===mes&&fR.getFullYear()===anio){
                const esGMM=GMM_PLANES.includes(p.plan);
                const tasa=(esGMM?getTasaGMM(p.plan,p.edadContrato||30,true):getTasaVida(p.plan,p.variante,r.anioPoliza||2))*factorD;
                comRenovMes+=(r.primaPagada||0)*tasa;
            }
        });
    });

    // Cálculo bono
    let bono = {};
    if(esDesarrollo){
        const mc=Math.min(mesConcurso,12), meta=TRAINING_METAS[mc];
        const fCom=Math.max(0,meta.comAcum-comInicialSem);
        const fPtos=Math.max(0,meta.ptosAcum-puntosSem);
        const cumple=fCom<=0&&fPtos<=0;
        const base=cumple?Math.min(comInicialSem,meta.premMax):0;
        const exc=cumple&&comInicialSem>meta.premMax?(comInicialSem-meta.premMax)*0.35:0;
        bono={tipo:'training',mc,meta,fCom,fPtos,cumple,base,exc,total:base+exc,comSem:comInicialSem,ptosSem:puntosSem};
    } else {
        const limra=Number(perfil.limra||75.5), igc=Number(perfil.igc||91);
        const grupo=getNPGrupo(primaMetaSem);
        const pct=grupo?getNPBonoPct(grupo,limra)/100:0;
        const montoBI=primaMetaSem*pct;
        const grupoGMM=getGMMGrupo(primaGMMtrim,polsGMMtrim);
        const montoGMM=grupoGMM?primaGMMtrim*grupoGMM.pct:0;
        bono={tipo:'np',grupo,pct,montoBI,limra,igc,grupoGMM,montoGMM,total:montoBI+montoGMM,primaMetaSem,comSem:comInicialSem};
    }

    const mesesConDatos = hist6.filter(h=>h.ini+h.ren>0).length || 1;
    const promedioMensual = hist6.reduce((a,h)=>a+h.ini+h.ren,0)/mesesConDatos;
    const proyeccionAnual = comYTD + (promedioMensual * (12-(new Date().getMonth()+1)));

    return { mesConcurso, esDesarrollo, factorD, comInicialMes, comRenovMes, puntosMes, primaMetaMes, comInicialSem, puntosSem, primaMetaSem, primaGMMtrim, polsGMMtrim, comMesPasado, polsMesPasado, comYTD, comInicialYTD, proyeccionAnual, promedioMensual, hist6, etiq6, detallesMes, bono };
}

// ═══════════════════════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════════════════════
export function renderComisiones() {
    // FIX: sin skeleton-shimmer (no estaba en CSS) — spinner simple
    return `<div id="fin-root" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:12px;">
        <div style="width:40px;height:40px;border:3px solid var(--separator);border-top-color:var(--accent);border-radius:50%;animation:spin 0.8s linear infinite;"></div>
        <p style="font-size:13px;color:var(--text-secondary);">Cargando módulo financiero...</p>
    </div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;
}

export async function bindComisionesEvents() {
    const root = document.getElementById('fin-root');
    const sb   = getSupabase();
    if(!sb||!root) return;

    try {
        const {data:{user}} = await sb.auth.getUser();
        if(!user) throw new Error('Sin sesión');

        let perfil = null;
        try { const loc=await DB.obtenerTodos('perfil_asesor'); if(loc.length) perfil=loc[0]; } catch(_){}
        if(!perfil){ const {data}=await sb.from('perfil_asesor').select('*').eq('user_id',user.id); if(data?.length) perfil=data[0]; }

        if(!perfil||(!perfil.fecha_conexion&&!perfil.fechaConexion)){
            root.innerHTML = renderConfigForm(false);
            bindConfigForm(sb, user.id);
            return;
        }

        // Determinar si es mes 15+ para mostrar LIMRA/IGC
        const hoy = new Date();
        const fxConn = new Date((perfil.fecha_conexion||perfil.fechaConexion)+'T12:00:00');
        const mc = Math.max(1, Math.floor((hoy-fxConn)/(1000*60*60*24*30.44))+1);
        const necesitaIndices = mc >= 15;

        // Si es mes 15+ y no tiene índices, mostrar form para capturarlos
        if(necesitaIndices && (!perfil.limra || !perfil.igc)){
            root.innerHTML = renderConfigFormIndices(perfil);
            bindConfigFormIndices(sb, user.id, perfil);
            return;
        }

        const cartera = await DB.obtenerTodos('cartera');
        const r       = calcularMotor(cartera, perfil);
        root.innerHTML = buildUI(r, perfil);
        bindUIEvents(r, perfil, sb, user.id);

    } catch(e){
        console.error('[Comisiones]',e);
        root.innerHTML = `<div style="padding:32px;text-align:center;"><p style="color:var(--danger);">❌ ${e.message}</p><button onclick="window.navigateTo('comisiones')" class="btn-primary" style="margin-top:16px;">Reintentar</button></div>`;
    }
}

// ── Config form inicial ────────────────────────────────────────────────────
function renderConfigForm() {
    return `
    <div style="min-height:60vh;display:flex;align-items:center;justify-content:center;padding:16px;">
    <div class="card" style="border-left:4px solid var(--accent);max-width:420px;width:100%;">
        <div style="font-size:36px;text-align:center;margin-bottom:8px;">🧩</div>
        <h2 style="font-size:18px;margin-bottom:4px;text-align:center;">Configurar Motor Financiero</h2>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:20px;text-align:center;line-height:1.5;">
            Ingresa tu fecha de conexión. El sistema detecta automáticamente tu cuaderno de concursos.
        </p>
        <div style="display:flex;flex-direction:column;gap:14px;">
            <div>
                <label style="font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;">Fecha de Conexión / Concurso</label>
                <input type="date" id="cfg-fec" style="width:100%;margin-top:6px;">
                <p style="font-size:11px;color:var(--text-tertiary);margin-top:4px;">
                    Mes 1–12 → Training Allowance &nbsp;|&nbsp; Mes 13+ → Nuevo Profesional
                </p>
            </div>
            <div id="cfg-indices-wrap" style="display:none;flex-direction:column;gap:10px;">
                <p style="font-size:12px;color:var(--warning);font-weight:600;">Estás en mes 15+ — ingresa tus índices de conservación:</p>
                <div>
                    <label style="font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;">LIMRA %</label>
                    <input type="number" id="cfg-limra" placeholder="Ej. 82.5" step="0.1" min="0" max="100" value="75.5" style="width:100%;margin-top:6px;">
                </div>
                <div>
                    <label style="font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;">IGC %</label>
                    <input type="number" id="cfg-igc" placeholder="Ej. 93.0" step="0.1" min="0" max="100" value="91.0" style="width:100%;margin-top:6px;">
                </div>
            </div>
            <div id="cfg-cuaderno-info" style="background:var(--surface-2);border-radius:12px;padding:12px;font-size:12px;color:var(--text-secondary);display:none;"></div>
            <button id="btn-save-cfg" class="btn-primary" style="margin-top:4px;">🚀 Iniciar Motor Financiero</button>
        </div>
    </div>
    </div>`;
}

function renderConfigFormIndices(perfil) {
    const hoy = new Date();
    const fxConn = new Date((perfil.fecha_conexion||perfil.fechaConexion)+'T12:00:00');
    const mc = Math.max(1, Math.floor((hoy-fxConn)/(1000*60*60*24*30.44))+1);
    return `
    <div style="min-height:60vh;display:flex;align-items:center;justify-content:center;padding:16px;">
    <div class="card" style="border-left:4px solid var(--warning);max-width:420px;width:100%;">
        <div style="font-size:36px;text-align:center;margin-bottom:8px;">📊</div>
        <h2 style="font-size:18px;margin-bottom:4px;text-align:center;">Actualizar Índices</h2>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:20px;text-align:center;line-height:1.5;">
            Estás en el <strong>Mes ${mc} de concurso</strong>. Para calcular tu bono correctamente necesito tus índices actuales.
        </p>
        <div style="display:flex;flex-direction:column;gap:14px;">
            <div>
                <label style="font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;">LIMRA %</label>
                <input type="number" id="idx-limra" placeholder="Ej. 82.5" step="0.1" min="0" max="100" value="${perfil.limra||75.5}" style="width:100%;margin-top:6px;">
                <p style="font-size:11px;color:var(--text-tertiary);margin-top:4px;">Mínimo requerido: 75.5%</p>
            </div>
            <div>
                <label style="font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;">IGC %</label>
                <input type="number" id="idx-igc" placeholder="Ej. 93.0" step="0.1" min="0" max="100" value="${perfil.igc||91.0}" style="width:100%;margin-top:6px;">
                <p style="font-size:11px;color:var(--text-tertiary);margin-top:4px;">Mínimo requerido: 91%</p>
            </div>
            <button id="btn-save-indices" class="btn-primary">💾 Guardar Índices y Continuar</button>
        </div>
    </div>
    </div>`;
}

function bindConfigForm(sb, userId) {
    const fecInput = document.getElementById('cfg-fec');
    const indicesWrap = document.getElementById('cfg-indices-wrap');
    const infoDiv = document.getElementById('cfg-cuaderno-info');

    // Mostrar info dinámica al cambiar fecha
    fecInput?.addEventListener('change', () => {
        const f = fecInput.value;
        if(!f) return;
        const hoy = new Date();
        const conn = new Date(f+'T12:00:00');
        const mc = Math.max(1, Math.floor((hoy-conn)/(1000*60*60*24*30.44))+1);
        const esDes = mc <= 12;

        infoDiv.style.display = 'block';
        infoDiv.innerHTML = `
            <strong style="color:var(--text-primary);">Mes ${mc} de concurso</strong><br>
            Cuaderno: <strong style="color:var(--accent);">${esDes?'Asesor en Desarrollo — Training Allowance':'Nuevo Profesional — Bonos Vida + GMM'}</strong>
            ${!esDes?'<br>Factor comisión: 100%':'<br>Factor comisión: 90% (primeros 12 meses)'}`;

        // Mostrar campos LIMRA/IGC solo si es mes 15+
        if(mc >= 15){
            indicesWrap.style.display = 'flex';
        } else {
            indicesWrap.style.display = 'none';
        }
    });

    document.getElementById('btn-save-cfg')?.addEventListener('click', async () => {
        const f = document.getElementById('cfg-fec').value;
        if(!f) return showToast('La fecha de conexión es obligatoria.','danger');

        const hoy = new Date();
        const conn = new Date(f+'T12:00:00');
        const mc = Math.max(1, Math.floor((hoy-conn)/(1000*60*60*24*30.44))+1);
        const esquema = mc<=12 ? 'Desarrollo' : 'Profesional';

        let limra = 75.5, igc = 91.0;
        if(mc >= 15){
            limra = parseFloat(document.getElementById('cfg-limra')?.value)||75.5;
            igc   = parseFloat(document.getElementById('cfg-igc')?.value)||91.0;
        }

        try {
            // Solo columnas que existen en Supabase (limra e igc van solo en DB local)
            const { error } = await sb.from('perfil_asesor').upsert(
                [{ user_id: userId, fecha_conexion: f, esquema }],
                { onConflict: 'user_id' }
            );
            if(error) throw error;

            // También guardar en DB local para offline
            try {
                const loc = await DB.obtenerTodos('perfil_asesor');
                const datos = { fecha_conexion:f, esquema, limra, igc };
                if(loc.length>0){ await DB.actualizar('perfil_asesor', loc[0].id, datos); }
                else { await DB.guardar('perfil_asesor', { id:'perfil_'+Date.now(), ...datos }); }
            } catch(_){}

            showToast('✅ Perfil guardado','success');
            // FIX: pequeño delay antes de navegar para que el toast sea visible
            setTimeout(() => window.navigateTo('comisiones'), 400);
        } catch(e){
            console.error(e);
            showToast('Error al guardar: '+e.message,'danger');
        }
    });
}

function bindConfigFormIndices(sb, userId, perfil) {
    document.getElementById('btn-save-indices')?.addEventListener('click', async () => {
        const limra = parseFloat(document.getElementById('idx-limra').value)||75.5;
        const igc   = parseFloat(document.getElementById('idx-igc').value)||91.0;

        try {
            // limra e igc no son columnas de Supabase — actualizar solo en DB local
            const loc2 = await DB.obtenerTodos('perfil_asesor');
            if(loc2.length > 0) await DB.actualizar('perfil_asesor', loc2[0].id, { ...loc2[0], limra, igc });
            try {
                const loc = await DB.obtenerTodos('perfil_asesor');
                if(loc.length>0) await DB.actualizar('perfil_asesor', loc[0].id, { ...perfil, limra, igc });
            } catch(_){}
            showToast('✅ Índices actualizados','success');
            setTimeout(() => window.navigateTo('comisiones'), 400);
        } catch(e){
            showToast('Error: '+e.message,'danger');
        }
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// BUILD UI
// ═══════════════════════════════════════════════════════════════════════════
function buildUI(r, perfil) {
    const {bono,hist6,etiq6,detallesMes} = r;
    const totalMes = r.comInicialMes + r.comRenovMes;
    const mesNom   = new Date().toLocaleString('es-MX',{month:'long',year:'numeric'});
    const mesPasNom= new Date(new Date().getFullYear(),new Date().getMonth()-1,1).toLocaleString('es-MX',{month:'long'});

    // Gráfica
    const maxH = Math.max(...hist6.map(h=>h.ini+h.ren),1);
    const graficaHTML = hist6.map((h,i)=>{
        const tot=h.ini+h.ren, pI=(h.ini/maxH)*90, pR=(h.ren/maxH)*90;
        const esAct=i===5;
        return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;">
            <span style="font-size:9px;color:var(--text-secondary);font-weight:600;height:14px;display:flex;align-items:center;">${tot>0?Math.round(tot/1000)+'k':''}</span>
            <div style="width:100%;display:flex;flex-direction:column;justify-content:flex-end;height:90px;gap:1px;border-radius:8px;overflow:hidden;background:var(--surface-2);">
                ${pR>0?`<div style="width:100%;height:${pR}%;background:var(--success);min-height:3px;"></div>`:''}
                ${pI>0?`<div style="width:100%;height:${pI}%;background:var(--accent);opacity:${esAct?1:0.45};min-height:3px;"></div>`:''}
            </div>
            <span style="font-size:9px;color:${esAct?'var(--accent)':'var(--text-secondary)'};font-weight:${esAct?700:400};">${etiq6[i]}</span>
        </div>`;
    }).join('');

    // Tabla pólizas
    const tablaFilas = detallesMes.length===0
        ? `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-tertiary);font-size:13px;">Sin movimientos este mes</td></tr>`
        : detallesMes.map(d=>`
            <tr style="border-bottom:1px solid var(--separator);">
                <td style="padding:10px 8px 10px 0;font-size:13px;font-weight:600;color:var(--text-primary);">${d.cliente}</td>
                <td style="padding:10px 4px;font-size:12px;color:var(--text-secondary);">${d.plan}<br><span style="font-size:10px;color:var(--text-tertiary);">${d.formaPago} · Año ${d.anioP}</span></td>
                <td style="padding:10px 4px;font-size:12px;text-align:right;color:var(--text-primary);">${fmt(d.prima)}</td>
                <td style="padding:10px 4px;text-align:center;"><span style="background:var(--accent-soft);color:var(--accent);padding:2px 6px;border-radius:8px;font-size:11px;font-weight:600;">${(d.tasa*100).toFixed(1)}%</span></td>
                <td style="padding:10px 0 10px 4px;font-size:13px;text-align:right;font-weight:700;color:${d.esRenov?'var(--success)':'var(--accent)'};">${fmt(d.comRecibo)}</td>
                <td style="padding:10px 0;text-align:center;">
                    ${d.esRenov
                        ? `<span style="font-size:10px;background:rgba(52,199,89,.12);color:var(--success);padding:2px 6px;border-radius:8px;">REN</span>`
                        : d.puntos>0
                            ? `<span style="font-size:10px;background:var(--accent-soft);color:var(--accent);padding:2px 6px;border-radius:8px;">${d.puntos}pts</span>`
                            : `<span style="font-size:10px;background:var(--surface-2);color:var(--text-tertiary);padding:2px 6px;border-radius:8px;">0pts</span>`}
                </td>
            </tr>`).join('');

    // Bono
    let bonoHTML = '';
    if(bono.tipo==='training'){
        const pctC=Math.min((r.comInicialSem/bono.meta.comAcum)*100,100);
        const pctP=Math.min((r.puntosSem/bono.meta.ptosAcum)*100,100);
        const semLabel = bono.mc<=6?'Semestre 1':'Semestre 2';
        bonoHTML=`
        <div class="card" style="border-left:4px solid var(--warning);margin:0 16px 16px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;">
                <h2 style="font-size:15px;margin:0;">🏆 Training Allowance</h2>
                <div style="text-align:right;">
                    <span style="font-size:11px;color:var(--text-secondary);background:var(--surface-2);padding:3px 8px;border-radius:20px;">Mes ${bono.mc}</span><br>
                    <span style="font-size:10px;color:var(--text-tertiary);">${semLabel}</span>
                </div>
            </div>
            <div style="margin-bottom:12px;">
                <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
                    <span style="color:var(--text-secondary);">Comisión acumulada semestre</span>
                    <span style="font-weight:700;color:var(--text-primary);">${fmt(r.comInicialSem)} <span style="font-weight:400;color:var(--text-tertiary);">/ ${fmt(bono.meta.comAcum)}</span></span>
                </div>
                <div style="background:var(--surface-2);border-radius:6px;height:8px;overflow:hidden;">
                    <div style="background:var(--accent);width:${pctC}%;height:100%;border-radius:6px;transition:width .6s;"></div>
                </div>
            </div>
            <div style="margin-bottom:16px;">
                <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
                    <span style="color:var(--text-secondary);">Puntos acumulados semestre</span>
                    <span style="font-weight:700;color:var(--text-primary);">${fmtN(r.puntosSem)} <span style="font-weight:400;color:var(--text-tertiary);">/ ${bono.meta.ptosAcum}</span></span>
                </div>
                <div style="background:var(--surface-2);border-radius:6px;height:8px;overflow:hidden;">
                    <div style="background:var(--success);width:${pctP}%;height:100%;border-radius:6px;transition:width .6s;"></div>
                </div>
            </div>
            <div style="background:var(--surface-2);border-radius:16px;padding:16px;text-align:center;margin-bottom:12px;">
                <span style="font-size:11px;color:var(--text-secondary);font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Bono proyectado</span>
                <div style="font-size:36px;font-weight:800;letter-spacing:-1px;color:${bono.cumple?'var(--success)':'var(--text-secondary)'};">${fmt(bono.total)}</div>
                ${bono.exc>0?`<div style="font-size:12px;color:var(--success);margin-top:2px;">Base ${fmt(bono.base)} + Excedente ${fmt(bono.exc)}</div>`:''}
                <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px;">Tope del mes: ${fmt(bono.meta.premMax)}</div>
            </div>
            ${bono.cumple
                ? `<div style="background:rgba(52,199,89,.1);border:1px solid var(--success);border-radius:12px;padding:12px;text-align:center;font-size:13px;font-weight:600;color:var(--success);">✅ ¡Meta cumplida! Anticipo de bono asegurado.</div>`
                : `<div style="background:rgba(255,149,0,.1);border:1px solid var(--warning);border-radius:12px;padding:12px;font-size:13px;color:var(--warning);">⚠️ Falta <strong>${fmt(bono.fCom)}</strong> en comisiones y <strong>${fmtN(bono.fPtos)} puntos</strong> para calificar.</div>`}
        </div>`;
    } else {
        bonoHTML=`
        <div class="card" style="border-left:4px solid var(--warning);margin:0 16px 16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <h2 style="font-size:15px;margin:0;">🏆 Bonos Nuevo Profesional</h2>
                <button id="btn-update-indices" style="font-size:11px;color:var(--accent);background:var(--accent-soft);border:none;padding:4px 10px;border-radius:12px;cursor:pointer;">📊 Actualizar LIMRA/IGC</button>
            </div>
            <div style="background:var(--surface-2);border-radius:14px;padding:14px;margin-bottom:10px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span style="font-size:13px;font-weight:600;color:var(--text-primary);">Bono Inicial Vida</span>
                    <span class="badge badge-blue">${bono.grupo?`Grupo ${bono.grupo}`:'Sin grupo aún'}</span>
                </div>
                <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">Prima meta sem: <strong>${fmt(r.primaMetaSem)}</strong> · LIMRA: <strong>${bono.limra}%</strong> · Bono: <strong>${(bono.pct*100).toFixed(1)}%</strong></div>
                <div style="font-size:28px;font-weight:800;color:${bono.montoBI>0?'var(--accent)':'var(--text-secondary)'};">${fmt(bono.montoBI)}</div>
            </div>
            <div style="background:var(--surface-2);border-radius:14px;padding:14px;margin-bottom:10px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span style="font-size:13px;font-weight:600;color:var(--text-primary);">Bono GMM Trimestral</span>
                    <span class="badge ${bono.grupoGMM?'badge-green':'badge-orange'}">${bono.grupoGMM?`Grupo ${bono.grupoGMM.g}`:'Sin grupo GMM'}</span>
                </div>
                <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">Prima GMM: <strong>${fmt(r.primaGMMtrim)}</strong> · Pólizas: <strong>${r.polsGMMtrim}</strong></div>
                <div style="font-size:28px;font-weight:800;color:${bono.montoGMM>0?'var(--success)':'var(--text-secondary)'};">${fmt(bono.montoGMM)}</div>
            </div>
            <div style="background:var(--surface-2);border-radius:14px;padding:14px;text-align:center;">
                <span style="font-size:11px;color:var(--text-secondary);font-weight:600;text-transform:uppercase;">Total bonos</span>
                <div style="font-size:32px;font-weight:800;color:${bono.total>0?'var(--success)':'var(--text-secondary)'};">${fmt(bono.total)}</div>
            </div>
        </div>`;
    }

    return `
    <style>
        /* Responsive horizontal (landscape) */
        @media (orientation: landscape) and (max-height: 500px) {
            #fin-root .card { margin-left: 12px !important; margin-right: 12px !important; }
            #fin-banner-num { font-size: 28px !important; }
            #fin-kpis { grid-template-columns: 1fr 1fr 1fr 1fr !important; }
            #fin-tabla-wrap { max-height: 220px; overflow-y: auto; }
            #fin-grafica-wrap { display: flex; gap: 16px; align-items: flex-start; }
            #fin-grafica-wrap > * { flex: 1; }
        }
        /* Pantalla grande (tablet landscape) */
        @media (min-width: 768px) {
            #fin-root { display: grid; grid-template-columns: 1fr 1fr; gap: 0; align-items: start; }
            #fin-banner  { grid-column: span 2; }
            #fin-kpis-wrap { grid-column: span 2; }
            #fin-bono    { grid-column: span 1; }
            #fin-tabla   { grid-column: span 1; }
            #fin-grafica { grid-column: span 1; }
            #fin-proyec  { grid-column: span 1; }
            #fin-sim     { grid-column: span 1; }
            #fin-tips    { grid-column: span 1; }
            #fin-ytd     { grid-column: span 1; }
            #fin-dev     { grid-column: span 2; }
        }
        /* Móvil vertical — tamaños compactos */
        @media (max-width: 390px) {
            #fin-banner-num { font-size: 32px !important; }
            #fin-kpis { grid-template-columns: 1fr 1fr !important; }
        }
    </style>
    <!-- ① Banner -->
    <div id="fin-banner" class="card" style="background:linear-gradient(135deg,#1a6bdb 0%,#0a4fb5 100%);color:white;border:none;margin:16px;">
        <p style="font-size:11px;color:rgba(255,255,255,.85);margin:0;text-transform:uppercase;font-weight:600;letter-spacing:.5px;">💰 Ingresos Estimados — ${mesNom}</p>
        <div id="fin-banner-num" style="font-size:42px;font-weight:800;letter-spacing:-2px;color:white;margin:8px 0;">${fmt(totalMes+bono.total)}</div>
        <div style="display:flex;justify-content:space-between;border-top:1px solid rgba(255,255,255,.2);padding-top:10px;">
            <div><span style="font-size:10px;opacity:.8;">INICIALES</span><br><strong style="font-size:16px;">${fmt(r.comInicialMes)}</strong></div>
            <div style="text-align:center;"><span style="font-size:10px;opacity:.8;">RENOVACIÓN</span><br><strong style="font-size:16px;">${fmt(r.comRenovMes)}</strong></div>
            <div style="text-align:right;"><span style="font-size:10px;opacity:.8;">BONO</span><br><strong style="font-size:16px;color:#4CD964;">${fmt(bono.total)}</strong></div>
        </div>
    </div>

    <!-- ② KPIs -->
    <div id="fin-kpis-wrap"><div id="fin-kpis" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 16px 16px;">
        <div class="card" style="margin:0;border-left:4px solid var(--accent);">
            <span style="font-size:11px;color:var(--text-secondary);font-weight:600;text-transform:uppercase;">Pólizas este mes</span><br>
            <strong style="font-size:30px;color:var(--text-primary);">${detallesMes.length}</strong>
        </div>
        <div class="card" style="margin:0;border-left:4px solid var(--success);">
            <span style="font-size:11px;color:var(--text-secondary);font-weight:600;text-transform:uppercase;">Puntos concurso</span><br>
            <strong style="font-size:30px;color:var(--text-primary);">${fmtN(r.puntosMes)}</strong>
        </div>
        <div class="card" style="margin:0;border-left:4px solid var(--warning);">
            <span style="font-size:11px;color:var(--text-secondary);font-weight:600;text-transform:uppercase;">Mes anterior</span><br>
            <strong style="font-size:18px;color:var(--text-primary);">${fmt(r.comMesPasado)}</strong>
            <span style="font-size:11px;color:var(--text-tertiary);display:block;">${mesPasNom}</span>
        </div>
        <div class="card" style="margin:0;border-left:4px solid var(--separator);">
            <span style="font-size:11px;color:var(--text-secondary);font-weight:600;text-transform:uppercase;">YTD</span><br>
            <strong style="font-size:18px;color:var(--text-primary);">${fmt(r.comYTD)}</strong>
        </div>
    </div>

    </div><!-- /fin-kpis-wrap -->
    <!-- ③ Bono -->
    <div id="fin-bono">${bonoHTML}</div>

    <!-- ④ Tabla detalle -->
    <div id="fin-tabla" class="card" style="margin:0 16px 16px;">
        <h2 style="font-size:15px;margin-bottom:4px;">📋 Comisiones del Mes</h2>
        <p style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;">Pólizas que generaron comisión en ${mesNom}.</p>
        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
            <table style="width:100%;border-collapse:collapse;min-width:480px;">
                <thead>
                    <tr style="border-bottom:2px solid var(--separator);">
                        <th style="text-align:left;padding:8px 8px 8px 0;font-size:11px;color:var(--text-secondary);font-weight:600;text-transform:uppercase;">Cliente</th>
                        <th style="text-align:left;padding:8px 4px;font-size:11px;color:var(--text-secondary);font-weight:600;text-transform:uppercase;">Plan</th>
                        <th style="text-align:right;padding:8px 4px;font-size:11px;color:var(--text-secondary);font-weight:600;text-transform:uppercase;">Prima</th>
                        <th style="text-align:center;padding:8px 4px;font-size:11px;color:var(--text-secondary);font-weight:600;text-transform:uppercase;">Tasa</th>
                        <th style="text-align:right;padding:8px 0;font-size:11px;color:var(--text-secondary);font-weight:600;text-transform:uppercase;">Comisión</th>
                        <th style="text-align:center;padding:8px 0 8px 4px;font-size:11px;color:var(--text-secondary);font-weight:600;text-transform:uppercase;">Pts</th>
                    </tr>
                </thead>
                <tbody>${tablaFilas}</tbody>
                ${detallesMes.length>0?`
                <tfoot>
                    <tr style="border-top:2px solid var(--separator);">
                        <td colspan="4" style="padding:10px 4px 6px;font-size:13px;font-weight:700;color:var(--text-primary);">Total</td>
                        <td style="padding:10px 0 6px;text-align:right;font-size:15px;font-weight:800;color:var(--accent);">${fmt(r.comInicialMes+r.comRenovMes)}</td>
                        <td style="padding:10px 0 6px 4px;text-align:center;font-size:13px;font-weight:700;color:var(--text-primary);">${fmtN(r.puntosMes)}</td>
                    </tr>
                </tfoot>`:''}
            </table>
        </div>
    </div>

    <!-- ⑤ Gráfica -->
    <div id="fin-grafica" class="card" style="margin:0 16px 16px;">
        <h2 style="font-size:15px;margin-bottom:16px;">📊 Histórico — Últimos 6 Meses</h2>
        <div style="display:flex;align-items:flex-end;gap:6px;padding:0 4px;">${graficaHTML}</div>
        <div style="display:flex;justify-content:center;gap:20px;margin-top:12px;">
            <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-secondary);"><div style="width:10px;height:10px;background:var(--accent);border-radius:3px;opacity:.45;"></div>Iniciales</div>
            <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-secondary);"><div style="width:10px;height:10px;background:var(--success);border-radius:3px;"></div>Renovación</div>
        </div>
    </div>

    <!-- ⑥ Proyección -->
    <div id="fin-proyec" class="card" style="margin:0 16px 16px;">
        <h2 style="font-size:15px;margin-bottom:12px;">📈 Proyección Anual</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div style="background:var(--surface-2);padding:12px;border-radius:14px;">
                <span style="font-size:11px;color:var(--text-secondary);font-weight:600;text-transform:uppercase;">Promedio mensual</span><br>
                <strong style="font-size:20px;color:var(--text-primary);">${fmt(r.promedioMensual)}</strong>
            </div>
            <div style="background:var(--surface-2);padding:12px;border-radius:14px;">
                <span style="font-size:11px;color:var(--text-secondary);font-weight:600;text-transform:uppercase;">Proyección al cierre</span><br>
                <strong style="font-size:20px;color:var(--accent);">${fmt(r.proyeccionAnual)}</strong>
            </div>
        </div>
        <p style="font-size:11px;color:var(--text-tertiary);margin-top:8px;">Basada en ${hist6.filter(h=>h.ini+h.ren>0).length} meses con actividad.</p>
    </div>

    <!-- ⑦ Simulador -->
    <div id="fin-sim" class="card" style="border-left:4px solid #5856D6;margin:0 16px 16px;">
        <h2 style="font-size:15px;margin-bottom:4px;">🔮 Simulador de Cierre</h2>
        <p style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;">Calcula comisión y puntos antes de emitir.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
            <div>
                <label style="font-size:11px;color:var(--text-secondary);">Producto</label>
                <select id="sim-plan" style="width:100%;margin-top:4px;">
                    <optgroup label="⭐ Más vendidos">
                        <option value="Segubeca">Segubeca</option>
                        <option value="Imagina Ser">Imagina Ser</option>
                        <option value="Orvi 99">Orvi 99</option>
                        <option value="Realiza">Realiza</option>
                        <option value="Vida Mujer">Vida Mujer</option>
                        <option value="Alfa Medical">GMM — Alfa Medical</option>
                        <option value="Alfa Medical Flex">GMM — Alfa Medical Flex</option>
                        <option value="Alfa Medical Internacional">GMM — Alfa Medical Internacional</option>
                    </optgroup>
                    <optgroup label="Otros">
                        <option value="Star Temporal">Star Temporal</option>
                        <option value="Mio">Mío</option>
                        <option value="Objetivo Vida">Objetivo Vida</option>
                        <option value="Nuevo Plenitud">Nuevo Plenitud</option>
                        <option value="Star Dotal">Star Dotal</option>
                        <option value="Legado">Legado</option>
                        <option value="Respaldo Educativo">Respaldo Educativo</option>
                        <option value="Respaldo Negocio">Respaldo Negocio</option>
                    </optgroup>
                </select>
            </div>
            <div>
                <label style="font-size:11px;color:var(--text-secondary);">Prima anual</label>
                <input type="number" id="sim-prima" placeholder="25000" style="width:100%;margin-top:4px;">
            </div>
            <div>
                <label style="font-size:11px;color:var(--text-secondary);">Forma de pago</label>
                <select id="sim-fpago" style="width:100%;margin-top:4px;">
                    <option value="1">Anual (prima completa)</option>
                    <option value="0.5">Semestral (prima ÷ 2)</option>
                    <option value="0.25">Trimestral (prima ÷ 4)</option>
                    <option value="0.0833">Mensual (prima ÷ 12)</option>
                </select>
            </div>
            <div style="display:flex;align-items:flex-end;">
                <button id="btn-simular" class="btn-primary" style="width:100%;">Calcular</button>
            </div>
        </div>
        <div id="sim-resultado" style="background:var(--surface-2);border-radius:12px;padding:14px;display:none;"></div>
    </div>

    <!-- ⑧ Tips IA -->
    <div id="fin-tips" class="card" style="border-left:4px solid var(--accent);margin:0 16px 16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <h2 style="font-size:15px;margin:0;">💡 Tips y Recomendaciones</h2>
            <button id="btn-gen-tips" class="btn-primary" style="padding:8px 14px !important;font-size:12px !important;border-radius:20px !important;">✨ Generar</button>
        </div>
        <div id="out-tips" style="font-size:13px;color:var(--text-primary);line-height:1.7;min-height:60px;white-space:pre-wrap;">Presiona "Generar" para recibir estrategias con tus números reales.</div>
    </div>

    <!-- ⑨ YTD -->
    <div id="fin-ytd" class="card" style="margin:0 16px 16px;">
        <h2 style="font-size:15px;margin-bottom:12px;">🏅 Acumulados del Año</h2>
        <div style="display:flex;flex-direction:column;gap:10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:1px solid var(--separator);">
                <span style="font-size:14px;color:var(--text-secondary);">Ingreso anual total</span>
                <strong style="font-size:18px;color:var(--text-primary);">${fmt(r.comYTD)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:14px;color:var(--text-secondary);">Iniciales YTD</span>
                <strong style="font-size:18px;color:var(--success);">${fmt(r.comInicialYTD)}</strong>
            </div>
        </div>
    </div>

    <!-- ⑩ Modo Dev — botón rojo con borde punteado -->
    <div style="margin:8px 16px 32px;border:2px dashed var(--danger);border-radius:16px;padding:16px;opacity:.75;">
        <p style="font-size:11px;color:var(--danger);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin:0 0 10px;text-align:center;">⚙️ MODO DESARROLLADOR</p>
        <button id="btn-dev-reset" style="width:100%;background:transparent;border:1.5px solid var(--danger);color:var(--danger);border-radius:12px;padding:10px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
            🔄 Resetear Perfil Financiero
        </button>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// BIND UI EVENTS
// ═══════════════════════════════════════════════════════════════════════════
function bindUIEvents(r, perfil, sb, userId) {
    const {bono} = r;

    // Actualizar LIMRA/IGC desde bono NP
    document.getElementById('btn-update-indices')?.addEventListener('click', () => {
        document.getElementById('fin-root').innerHTML = renderConfigFormIndices(perfil);
        bindConfigFormIndices(sb, userId, perfil);
    });

    // Simulador
    document.getElementById('btn-simular')?.addEventListener('click', () => {
        const plan    = document.getElementById('sim-plan').value;
        const prima   = parseFloat(document.getElementById('sim-prima').value)||0;
        const fpFactor= parseFloat(document.getElementById('sim-fpago').value)||1;
        if(!prima) return showToast('Ingresa una prima válida.','danger');

        const fpNombre = {1:'Anual', 0.5:'Semestral', 0.25:'Trimestral', 0.0833:'Mensual'}[fpFactor] || 'Anual';
        const primaRecibo = prima * fpFactor;
        const esGMM   = GMM_PLANES.includes(plan);
        const tasa    = (esGMM?getTasaGMM(plan,30,false):getTasaVida(plan,'',1))*r.factorD;
        const comRecibo = primaRecibo * tasa;   // comisión del recibo según forma de pago
        const comAnual  = prima * tasa;         // comisión anual total (referencia)
        const puntos    = puntosPoliza(plan, prima, esGMM); // puntos siempre por prima anual

        let bonoExtra = '';
        if(bono.tipo==='training'){
            const nuevaCom  = r.comInicialSem + comRecibo;
            const nuevosPtos = r.puntosSem + puntos;
            const fC = Math.max(0, bono.meta.comAcum - nuevaCom);
            const fP = Math.max(0, bono.meta.ptosAcum - nuevosPtos);
            bonoExtra = (fC<=0&&fP<=0)
                ? `<div style="margin-top:8px;color:var(--success);font-weight:600;">✅ Con esta póliza calificarías al bono del mes ${bono.mc}.</div>`
                : `<div style="margin-top:8px;color:var(--warning);">Aún faltarían ${fmt(fC)} y ${fmtN(fP)} puntos.</div>`;
        }

        const res = document.getElementById('sim-resultado');
        res.style.display = 'block';
        res.innerHTML = `
            <div style="background:var(--surface);border-radius:10px;padding:10px;margin-bottom:10px;">
                <div style="font-size:11px;color:var(--text-secondary);margin-bottom:6px;font-weight:600;text-transform:uppercase;">Desglose — Pago ${fpNombre}</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    <div><span style="font-size:10px;color:var(--text-secondary);">Prima del recibo</span><br><strong style="color:var(--text-primary);">${fmt(primaRecibo)}</strong></div>
                    <div><span style="font-size:10px;color:var(--text-secondary);">Comisión del recibo</span><br><strong style="color:var(--accent);font-size:16px;">${fmt(comRecibo)}</strong></div>
                    <div><span style="font-size:10px;color:var(--text-secondary);">Comisión anual</span><br><strong style="color:var(--text-secondary);">${fmt(comAnual)}</strong></div>
                    <div><span style="font-size:10px;color:var(--text-secondary);">Puntos concurso</span><br><strong style="color:var(--success);">${fmtN(puntos)}</strong></div>
                </div>
            </div>
            <div style="font-size:12px;color:var(--text-secondary);">Tasa año 1: ${(tasa*100).toFixed(1)}%${r.factorD<1?' · Factor 90% (Desarrollo)':''}</div>
            ${bonoExtra}`;
    });

    // Tips IA
    document.getElementById('btn-gen-tips')?.addEventListener('click', () => {
        const mesNom = new Date().toLocaleString('es-MX',{month:'long'});
        let ctx = bono.tipo==='training'
            ? `Cuaderno: Asesor en Desarrollo, Mes ${bono.mc}
Factor comisión: ${r.factorD===0.9?'90%':'100%'}
Comisión acumulada semestre: ${fmt(r.comInicialSem)} / ${fmt(bono.meta.comAcum)} — Falta: ${fmt(bono.fCom)}
Puntos acumulados: ${fmtN(r.puntosSem)} / ${bono.meta.ptosAcum} — Faltan: ${fmtN(bono.fPtos)}
Bono en juego: ${fmt(bono.meta.premMax)} + excedente 35%
Estado: ${bono.cumple?'✅ YA CALIFICA':'⚠️ AÚN NO CALIFICA'}
Comisiones mes: ${fmt(r.comInicialMes)} iniciales + ${fmt(r.comRenovMes)} renovación`
            : `Cuaderno: Nuevo Profesional, LIMRA: ${bono.limra}%
Prima meta semestral: ${fmt(r.primaMetaSem)} → Grupo ${bono.grupo||'sin grupo'}
Bono Vida: ${fmt(bono.montoBI)} | Bono GMM: ${fmt(bono.montoGMM)}`;

        callGemini(`Eres coach de élite de SMNYL. Datos reales del asesor — ${mesNom}:\n${ctx}\n\nGenera 4 estrategias concretas para ESTA SEMANA. Cada una: TÍTULO EN MAYÚSCULAS + 2-3 líneas con productos SMNYL reales (Segubeca, Imagina Ser, Orvi 99, Realiza, Alfa Medical). Sin relleno. Solo las 4 numeradas.`, 'out-tips');
    });

    // Dev reset
    document.getElementById('btn-dev-reset')?.addEventListener('click', async () => {
        const ok = await showConfirm('Esto borrará tu perfil financiero para reconfigurarlo desde cero. ¿Continuar?','Resetear Perfil','Resetear',true);
        if(!ok) return;
        try {
            await sb.from('perfil_asesor').delete().eq('user_id',userId);
            try { const loc=await DB.obtenerTodos('perfil_asesor'); for(const p of loc) await DB.eliminar('perfil_asesor',p.id); } catch(_){}
            showToast('Perfil eliminado','success');
            setTimeout(()=>window.navigateTo('comisiones'),400);
        } catch(e){ showToast('Error: '+e.message,'danger'); }
    });
}
