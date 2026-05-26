// comisiones.js — Motor Financiero SMNYL v10
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
        // Leer perfil local primero (tiene limra e igc)
        try { const loc=await DB.obtenerTodos('perfil_asesor'); if(loc.length) perfil=loc[0]; } catch(_){}
        // Si no hay local, leer de Supabase
        if(!perfil){ try{ const {data}=await sb.from('crm_data').select('*').eq('user_id',user.id).eq('coleccion','perfil_asesor'); if(data?.length) perfil=data[0].datos; }catch(_){} }
        // Si hay local Y Supabase, mergear para tener fecha_conexion y esquema de Supabase + limra/igc de local
        if(perfil && (!perfil.fecha_conexion && !perfil.fechaConexion)) {
            try{ const {data}=await sb.from('crm_data').select('*').eq('user_id',user.id).eq('coleccion','perfil_asesor'); if(data?.length) perfil={...data[0].datos,...perfil}; }catch(_){}
        }

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
            // Bypass completo de DB.guardar y DB.actualizar
            const loc = await DB.obtenerTodos('perfil_asesor');
            const perfilExistente = loc.length > 0 ? loc[0] : null;

            if (perfilExistente) {
                const datosUpdate = perfilExistente.datos ? { ...perfilExistente.datos, fecha_conexion: f, esquema, limra, igc } : { ...perfilExistente, fecha_conexion: f, esquema, limra, igc };
                delete datosUpdate.id; delete datosUpdate.user_id; delete datosUpdate.coleccion; // Limpieza de seguridad

                const { error } = await sb.from('crm_data')
                    .update({ datos: datosUpdate })
                    .eq('user_id', userId)
                    .eq('coleccion', 'perfil_asesor');
                if (error) throw error;
            } else {
                const { error } = await sb.from('crm_data').insert([{
                    id: 'perfil_' + Date.now(),
                    user_id: userId,
                    coleccion: 'perfil_asesor',
                    datos: { fecha_conexion: f, esquema, limra, igc }
                }]);
                if (error) throw error;
            }

            showToast('✅ Perfil guardado','success');
            setTimeout(() => window.navigateTo('comisiones'), 400);
        } catch(e){
            console.error(e);
            showToast('Error al guardar: '+e.message,'danger');
        }
    });
}

function bindConfigFormIndices(sb, userId, perfil) {
    document.getElementById('btn-save-indices')?.addEventListener('click', async () => {
        const limra = parseFloat(document.getElementById('idx-limra').value) || 75.5;
        const igc   = parseFloat(document.getElementById('idx-igc').value) || 91.0;

        try {
            const loc = await DB.obtenerTodos('perfil_asesor');
            const perfilExistente = loc.length > 0 ? loc[0] : null;

            if (perfilExistente) {
                // 1. Update directo en Supabase con los parámetros autenticados
                const datosUpdate = perfilExistente.datos ? { ...perfilExistente.datos, limra, igc } : { ...perfilExistente, limra, igc };
                delete datosUpdate.id; delete datosUpdate.user_id; delete datosUpdate.coleccion; // Limpieza de metadatos

                const { error } = await sb.from('crm_data')
                    .update({ datos: datosUpdate })
                    .eq('user_id', userId)
                    .eq('coleccion', 'perfil_asesor');
                if (error) throw error;
            } else {
                // 2. Insert directo
                const { error } = await sb.from('crm_data').insert([{
                    id: 'perfil_' + Date.now(),
                    user_id: userId,
                    coleccion: 'perfil_asesor',
                    datos: { ...perfil, limra, igc }
                }]);
                if (error) throw error;
            }
            
            showToast('✅ Índices actualizados', 'success');
            
            // 3. Bypass del router: Construir UI directamente con datos en memoria
            const cartera = await DB.obtenerTodos('cartera');
            const perfilActualizado = { ...perfil, limra, igc };
            const r = calcularMotor(cartera, perfilActualizado);
