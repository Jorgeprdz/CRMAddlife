// comisiones.js — FULL SAFE RECOVERY BUILD (Glass UI + RLS Safe)
import { DB } from './db.js';
import { getSupabase, callGemini } from './app.js';
import { showToast, showConfirm } from './utils.js';

// ═══════════════════════════════════════════════════════════════════════════
// TASAS Y BAREMOS FINANCIEROS
// ═══════════════════════════════════════════════════════════════════════════
const TASAS_VIDA = {
    'Segubeca':           { default:[0.33,0.10,0.07,0.03,0.03,0.00] },
    'Imagina Ser':        { default:[0.35,0.12,0.08,0.05,0.05,0.035], '10 Pagos':[0.27,0.085,0.04,0.04,0.04,0], '15 Pagos':[0.30,0.12,0.08,0.05,0.05,0.035], 'Prima Única':[0.085,0,0,0,0,0] },
    'Orvi':               { default:[0.44,0.15,0.10,0.10,0.05,0.02] },
    'Orvi 99':            { default:[0.44,0.15,0.10,0.10,0.05,0.02] },
    'Realiza':            { default:[0.44,0.15,0.10,0.05,0.05,0.008] },
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

const TASAS_GMM = {
    'Alfa Medical':              { i:[0.17,0.22,0.13,0.10], r:[0.15,0.17,0.13,0.10] },
    'Alfa Medical Flex':         { i:[0.15,0.22,0.13,0.10], r:[0.13,0.17,0.13,0.10] },
    'Alfa Medical Internacional':{ i:[0.17,0.25,0.25,0.10], r:[0.15,0.17,0.17,0.10] },
};
const GMM_PLANES = Object.keys(TASAS_GMM);
const PLANES_SIN_PUNTOS = ['Star Temporal 1','Tempo Vida 1'];

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

const fmt = n => new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(n||0);
const fmtN = n => Number(n||0).toFixed(1);

function getTasaVida(plan, variante, anioP) {
    const prod = TASAS_VIDA[plan]; if (!prod) return 0.10;
    const arr = (variante && prod[variante]) ? prod[variante] : prod.default;
    const idx = anioP===1?0 : anioP===2?1 : anioP===3?2 : anioP<=5?3 : anioP<=10?4 : 5;
    return arr[idx] || 0;
}
function getTasaGMM(plan, edad, esRenov) {
    const p = TASAS_GMM[plan]; if (!p) return 0.15;
    const arr = esRenov ? p.r : p.i;
    return edad<=4?arr[0] : edad<=54?arr[1] : edad<=59?arr[2] : arr[3];
}
function getAnioPoliza(fEmision) {
    if (!fEmision) return 1;
    return Math.max(1, Math.floor((new Date()-new Date(fEmision+'T12:00:00'))/(1000*60*60*24*365.25))+1);
}
function factorPago(fp) { return fp==='Mensual'?1/12 : fp==='Trimestral'?1/4 : fp==='Semestral'?1/2 : 1; }

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
// MOTOR DE CÁLCULO
// ═══════════════════════════════════════════════════════════════════════════
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
    let comMesPasado=0, polsMesPasado=0, comYTD=0, comInicialYTD=0;

    const hist6 = Array(6).fill(null).map(()=>({ini:0,ren:0}));
    const etiq6 = [];
    for(let i=5;i>=0;i--) { etiq6.push(new Date(anio,mes-i,1).toLocaleString('es-MX',{month:'short'}).toUpperCase()); }
    const detallesMes = [];

    cartera.forEach(p => {
        if(!p.emision) return;
        const fE = new Date(p.emision+'T12:00:00');
        const mesEm = fE.getMonth(), anioEm = fE.getFullYear();
        const anioP = getAnioPoliza(p.emision);
        const esRenov = anioP > 1;
        const esGMM = GMM_PLANES.includes(p.plan);
        const prima = Number(String(p.prima||0).replace(/[^0-9.-]/g,''))||0;
        const primaRecibo = prima * factorPago(p.formaPago);
        
        const tasa = (esGMM ? getTasaGMM(p.plan, Number(p.edadContrato)||30, esRenov) : getTasaVida(p.plan, p.variante, anioP)) * factorD;
        const comRecibo = primaRecibo * tasa;
        const puntos = puntosPoliza(p.plan, prima, esGMM);

        if(anioEm===anio){ comYTD+=prima*tasa; if(!esRenov&&!p.esPersonal) comInicialYTD+=prima*tasa; }

        if(mesEm===mes && anioEm===anio) {
            if(esRenov) comRenovMes+=comRecibo; 
            else { comInicialMes+=comRecibo; if(!p.esPersonal){ puntosMes+=puntos; primaMetaMes+=ponderarPrima(p.plan,prima); } }
            detallesMes.push({ cliente:p.cliente||'—', plan:p.plan, formaPago:p.formaPago||'Anual', anioP, tasa, comRecibo, esRenov, puntos, prima });
        }
        if(mesEm===mesPA && anioEm===anioPA){ comMesPasado+=comRecibo; if(!esRenov) polsMesPasado++; }
        if(anioEm===anio && mesEm>=semInicio && mesEm<=mes && !esRenov && !p.esPersonal){ comInicialSem+=comRecibo; puntosSem+=puntos; primaMetaSem+=ponderarPrima(p.plan,prima); }
        if(esGMM&&!esRenov&&anioEm===anio&&mesEm>=trimInicio&&mesEm<=mes){ primaGMMtrim+=prima; polsGMMtrim+=0.5; }

        for(let i=0;i<6;i++){
            const d=new Date(anio,mes-(5-i),1);
            if(mesEm===d.getMonth()&&anioEm===d.getFullYear()){
                if(esRenov) hist6[i].ren+=comRecibo; else hist6[i].ini+=comRecibo;
            }
        }
    });

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

    let bono = {};
    if(esDesarrollo){
        const mc=Math.min(mesConcurso,12), meta=TRAINING_METAS[mc];
        const fCom=Math.max(0,meta.comAcum-comInicialSem);
        const fPtos=Math.max(0,meta.ptosAcum-puntosSem);
        const cumple=fCom<=0&&fPtos<=0;
        const base=cumple?Math.min(comInicialSem,meta.premMax):0;
        const exc=cumple&&comInicialSem>meta.premMax?(comInicialSem-meta.premMax)*0.35:0;
        bono={tipo:'training',mc,meta,fCom,fPtos,cumple,base,exc,total:base+exc};
    } else {
        const limra=Number(perfil.limra||75.5), igc=Number(perfil.igc||91);
        const grupo = (NP_GRUPOS.find(g => primaMetaSem >= g.mes6)||{}).g || null;
        let pct = 0;
        if(grupo) {
            const b = NP_BONO_PCT[grupo];
            if(limra>=95.5) pct=b.l95; else if(limra>=91.5) pct=b.l91; else if(limra>=89.5) pct=b.l89; else if(limra>=87.5) pct=b.l87; else pct=b.min;
            pct /= 100;
        }
        const grupoGMM = GMM_GRUPOS.find(g => primaGMMtrim>=g.mes3 && polsGMMtrim>=g.pols) || null;
        bono={tipo:'np',grupo,pct,montoBI:primaMetaSem*pct,limra,igc,grupoGMM,montoGMM:grupoGMM?primaGMMtrim*grupoGMM.pct:0, total:(primaMetaSem*pct)+(grupoGMM?primaGMMtrim*grupoGMM.pct:0)};
    }

    return { factorD, comInicialMes, comRenovMes, puntosMes, primaMetaMes, comInicialSem, puntosSem, primaMetaSem, primaGMMtrim, polsGMMtrim, comMesPasado, polsMesPasado, comYTD, comInicialYTD, hist6, etiq6, detallesMes, bono };
}

// ═══════════════════════════════════════════════════════════════════════════
// INICIALIZACIÓN Y FLUJO RLS SAFE
// ═══════════════════════════════════════════════════════════════════════════
export function renderComisiones() {
    return `<div id="fin-root" class="flex items-center justify-center min-h-[60vh]">
        <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
    </div>`;
}

export async function bindComisionesEvents() {
    const root = document.getElementById('fin-root');
    const sb = getSupabase();
    if(!sb) return;

    try {
        const { data: { user }, error: authErr } = await sb.auth.getUser();
        if(authErr || !user) throw new Error('Sesión inválida');

        // Leer perfil seguro (Bypass local para asegurar integridad)
        let perfil = null;
        const { data } = await sb.from('crm_data').select('*').eq('user_id', user.id).eq('coleccion', 'perfil_asesor').maybeSingle();
        if (data) perfil = { id: data.id, ...data.datos };

        if (!perfil || !perfil.fecha_conexion) {
            root.innerHTML = renderConfigForm();
            bindConfigForm(sb, user.id);
            return;
        }

        const hoy = new Date();
        const fxConn = new Date(perfil.fecha_conexion+'T12:00:00');
        const mc = Math.max(1, Math.floor((hoy-fxConn)/(1000*60*60*24*30.44))+1);
        
        if (mc >= 15 && (!perfil.limra || !perfil.igc)) {
            root.innerHTML = renderConfigFormIndices(perfil);
            bindConfigFormIndices(sb, user.id, perfil);
            return;
        }

        const cartera = await DB.obtenerTodos('cartera');
        const res = calcularMotor(cartera, perfil);
        root.innerHTML = buildUI(res, perfil);
        bindUIEvents(res, perfil, sb, user.id);

    } catch(e) {
        root.innerHTML = `<div class="text-center p-8"><p class="text-danger">❌ ${e.message}</p></div>`;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// FORMULARIOS DE CONFIGURACIÓN (GLASS UI)
// ═══════════════════════════════════════════════════════════════════════════
function renderConfigForm() {
    return `
    <div class="min-h-[60vh] flex items-center justify-center p-4">
        <div class="glass-card w-full max-w-md p-8 border-t-4 border-t-primary">
            <h2 class="text-xl font-bold text-white text-center mb-6">Configurar Motor Financiero</h2>
            <div class="space-y-4">
                <div>
                    <label class="text-xs text-white/70 uppercase">Fecha de Conexión</label>
                    <input type="date" id="cfg-fec" class="glass-input mt-1">
                </div>
                <div id="cfg-indices-wrap" class="hidden grid-cols-2 gap-3">
                    <div>
                        <label class="text-[10px] text-white/70 uppercase">LIMRA %</label>
                        <input type="number" id="cfg-limra" step="0.1" value="75.5" class="glass-input">
                    </div>
                    <div>
                        <label class="text-[10px] text-white/70 uppercase">IGC %</label>
                        <input type="number" id="cfg-igc" step="0.1" value="91.0" class="glass-input">
                    </div>
                </div>
                <button id="btn-save-cfg" class="glass-btn w-full">🚀 Iniciar Motor</button>
            </div>
        </div>
    </div>`;
}

function renderConfigFormIndices(perfil) {
    return `
    <div class="min-h-[60vh] flex items-center justify-center p-4">
        <div class="glass-card w-full max-w-md p-8 border-t-4 border-t-warning">
            <h2 class="text-xl font-bold text-white text-center mb-6">Actualizar Índices</h2>
            <div class="space-y-4">
                <input type="number" id="idx-limra" step="0.1" value="${perfil.limra||75.5}" class="glass-input text-lg font-bold" placeholder="LIMRA">
                <input type="number" id="idx-igc" step="0.1" value="${perfil.igc||91.0}" class="glass-input text-lg font-bold" placeholder="IGC">
                <button id="btn-save-indices" class="glass-btn w-full">💾 Guardar y Continuar</button>
            </div>
        </div>
    </div>`;
}

function bindConfigForm(sb, userId) {
    document.getElementById('cfg-fec')?.addEventListener('change', () => {
        const f = document.getElementById('cfg-fec').value;
        const mc = Math.max(1, Math.floor((new Date()-new Date(f+'T12:00:00'))/(1000*60*60*24*30.44))+1);
        document.getElementById('cfg-indices-wrap').style.display = mc >= 15 ? 'grid' : 'none';
    });

    document.getElementById('btn-save-cfg')?.addEventListener('click', async () => {
        const f = document.getElementById('cfg-fec').value;
        if(!f) return showToast('Fecha obligatoria','danger');
        
        const mc = Math.max(1, Math.floor((new Date()-new Date(f+'T12:00:00'))/(1000*60*60*24*30.44))+1);
        const esquema = mc<=12 ? 'Desarrollo' : 'Profesional';
        const limra = parseFloat(document.getElementById('cfg-limra')?.value)||75.5;
        const igc = parseFloat(document.getElementById('cfg-igc')?.value)||91.0;

        const payload = { id: 'perfil_'+userId, user_id: userId, coleccion: 'perfil_asesor', datos: { fecha_conexion: f, esquema, limra, igc } };

        try {
            const { error } = await sb.from('crm_data').upsert(payload, { onConflict: 'id' });
            if (error) throw error;
            showToast('Perfil guardado', 'success');
            setTimeout(() => window.navigateTo('comisiones'), 400);
        } catch(e) { showToast('Error al guardar: '+e.message, 'danger'); }
    });
}

function bindConfigFormIndices(sb, userId, perfil) {
    document.getElementById('btn-save-indices')?.addEventListener('click', async () => {
        const limra = parseFloat(document.getElementById('idx-limra').value) || 75.5;
        const igc = parseFloat(document.getElementById('idx-igc').value) || 91.0;
        
        const payload = { id: 'perfil_'+userId, user_id: userId, coleccion: 'perfil_asesor', datos: { ...perfil, limra, igc } };

        try {
            const { error } = await sb.from('crm_data').upsert(payload, { onConflict: 'id' });
            if (error) throw error;
            
            showToast('Índices actualizados', 'success');
            const pAct = { ...perfil, limra, igc };
            const r = calcularMotor(await DB.obtenerTodos('cartera'), pAct);
            document.getElementById('fin-root').innerHTML = buildUI(r, pAct);
            bindUIEvents(r, pAct, sb, userId);
        } catch(e) { showToast('Error: '+e.message, 'danger'); }
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// RENDERIZADO DEL DASHBOARD (GLASS UI)
// ═══════════════════════════════════════════════════════════════════════════
function buildUI(r, perfil) {
    const {bono, hist6, etiq6, detallesMes} = r;
    const totalMes = r.comInicialMes + r.comRenovMes;
    
    // Gráfica HTML
    const maxH = Math.max(...hist6.map(h=>h.ini+h.ren), 1);
    const graficaHTML = hist6.map((h, i) => {
        const tot = h.ini + h.ren, pI = (h.ini/maxH)*90, pR = (h.ren/maxH)*90;
        return `
        <div class="flex-1 flex flex-col items-center gap-1">
            <span class="text-[10px] text-white/50 h-4">${tot>0 ? Math.round(tot/1000)+'k' : ''}</span>
            <div class="w-full flex flex-col justify-end h-24 gap-px rounded-lg overflow-hidden bg-black/20">
                ${pR>0 ? `<div style="height:${pR}%" class="w-full bg-success"></div>` : ''}
                ${pI>0 ? `<div style="height:${pI}%" class="w-full bg-primary ${i===5?'opacity-100':'opacity-50'}"></div>` : ''}
            </div>
            <span class="text-[10px] ${i===5?'text-primary font-bold':'text-white/50'}">${etiq6[i]}</span>
        </div>`;
    }).join('');

    let bonoHTML = '';
    if(bono.tipo === 'training'){
        const pctC = Math.min((r.comInicialSem/bono.meta.comAcum)*100, 100);
        const pctP = Math.min((r.puntosSem/bono.meta.ptosAcum)*100, 100);
        bonoHTML = `
        <div class="glass-card p-5 border-l-4 border-l-warning">
            <h2 class="text-title mb-4">🏆 Training Allowance</h2>
            <div class="mb-4">
                <div class="flex justify-between text-xs mb-1"><span class="text-white/60">Comisiones</span><span>${fmt(r.comInicialSem)} / ${fmt(bono.meta.comAcum)}</span></div>
                <div class="h-2 bg-black/30 rounded-full"><div class="h-full bg-primary rounded-full" style="width:${pctC}%"></div></div>
            </div>
            <div class="mb-5">
                <div class="flex justify-between text-xs mb-1"><span class="text-white/60">Puntos</span><span>${fmtN(r.puntosSem)} / ${bono.meta.ptosAcum}</span></div>
                <div class="h-2 bg-black/30 rounded-full"><div class="h-full bg-success rounded-full" style="width:${pctP}%"></div></div>
            </div>
            <div class="bg-black/20 rounded-xl p-4 text-center">
                <p class="text-subtitle">Bono proyectado</p>
                <div class="text-3xl font-bold ${bono.cumple ? 'text-success' : 'text-white/40'}">${fmt(bono.total)}</div>
            </div>
        </div>`;
    } else {
        bonoHTML = `
        <div class="glass-card p-5 border-l-4 border-l-warning">
            <div class="flex justify-between mb-4"><h2 class="text-title">🏆 Nuevo Profesional</h2><button id="btn-update-indices" class="glass-btn-secondary py-1 px-2">Editar Índices</button></div>
            <div class="bg-black/20 rounded-xl p-3 mb-2 flex justify-between items-center">
                <div><span class="text-xs text-white/60">Bono Vida</span><br><strong class="text-lg text-primary">${fmt(bono.montoBI)}</strong></div>
                <span class="glass-badge bg-primary/20 text-primary border-primary/20">LIMRA ${bono.limra}%</span>
            </div>
            <div class="bg-black/20 rounded-xl p-3 flex justify-between items-center">
                <div><span class="text-xs text-white/60">Bono GMM</span><br><strong class="text-lg text-success">${fmt(bono.montoGMM)}</strong></div>
                <span class="glass-badge bg-success/20 text-success border-success/20">Grupo ${bono.grupoGMM?bono.grupoGMM.g:'-'}</span>
            </div>
        </div>`;
    }

    return `
    <div class="w-full max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div class="glass-panel">
            <p class="text-subtitle text-white/70">💰 Estimación del Mes</p>
            <div class="text-5xl font-extrabold my-2">${fmt(totalMes+bono.total)}</div>
            <div class="flex gap-4 pt-2 border-t border-white/10 mt-2">
                <span class="text-xs"><span class="text-white/50">Iniciales:</span> ${fmt(r.comInicialMes)}</span>
                <span class="text-xs"><span class="text-white/50">Renov:</span> ${fmt(r.comRenovMes)}</span>
            </div>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="glass-widget border-l-4 border-l-primary"><span class="text-subtitle">Pólizas Mes</span><strong class="text-2xl">${detallesMes.length}</strong></div>
            <div class="glass-widget border-l-4 border-l-success"><span class="text-subtitle">Puntos</span><strong class="text-2xl">${fmtN(r.puntosMes)}</strong></div>
            <div class="glass-widget border-l-4 border-l-warning"><span class="text-subtitle">Mes Anterior</span><strong class="text-xl">${fmt(r.comMesPasado)}</strong></div>
            <div class="glass-widget border-l-4 border-l-white/20"><span class="text-subtitle">YTD</span><strong class="text-xl">${fmt(r.comYTD)}</strong></div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="space-y-6">
                <div class="glass-card p-5">
                    <h2 class="text-title mb-4">📊 Histórico (6 Meses)</h2>
                    <div class="flex items-end gap-2">${graficaHTML}</div>
                </div>
                
                <div class="glass-card p-5 border-l-4 border-l-accent">
                    <h2 class="text-title mb-4">🔮 Simulador Rápido</h2>
                    <div class="grid grid-cols-2 gap-3 mb-3">
                        <select id="sim-plan" class="glass-input col-span-2 bg-black/40"><option value="Segubeca">Segubeca</option><option value="Orvi 99">Orvi 99</option><option value="Alfa Medical">Alfa Medical</option></select>
                        <input type="number" id="sim-prima" placeholder="Prima" class="glass-input bg-black/40">
                        <select id="sim-fpago" class="glass-input bg-black/40"><option value="1">Anual</option><option value="0.0833">Mensual</option></select>
                    </div>
                    <button id="btn-simular" class="glass-btn w-full py-2">Calcular</button>
                    <div id="sim-resultado" class="mt-3 text-sm text-success font-bold text-center hidden"></div>
                </div>
            </div>
            
            <div>${bonoHTML}</div>
        </div>
        
        <div class="mt-8 border border-dashed border-danger/40 rounded-xl p-4 bg-danger/5">
            <button id="btn-dev-reset" class="w-full text-danger text-sm font-bold py-2">🔄 Formatear Perfil Financiero</button>
        </div>
    </div>`;
}

function bindUIEvents(r, perfil, sb, userId) {
    document.getElementById('btn-update-indices')?.addEventListener('click', () => {
        document.getElementById('fin-root').innerHTML = renderConfigFormIndices(perfil);
        bindConfigFormIndices(sb, userId, perfil);
    });

    document.getElementById('btn-simular')?.addEventListener('click', () => {
        const plan = document.getElementById('sim-plan').value;
        const prima = parseFloat(document.getElementById('sim-prima').value) || 0;
        const fp = parseFloat(document.getElementById('sim-fpago').value) || 1;
        if(!prima) return;
        
        const esGMM = GMM_PLANES.includes(plan);
        const tasa = (esGMM ? getTasaGMM(plan, 30, false) : getTasaVida(plan, '', 1)) * r.factorD;
        const com = (prima * fp) * tasa;
        
        const res = document.getElementById('sim-resultado');
        res.innerHTML = `Comisión estimada del recibo: ${fmt(com)}`;
        res.classList.remove('hidden');
    });

    document.getElementById('btn-dev-reset')?.addEventListener('click', async () => {
        const ok = await showConfirm('Esto borrará tu perfil financiero local y remoto. ¿Continuar?', 'Resetear', 'Borrar', true);
        if(!ok) return;
        await sb.from('crm_data').delete().eq('user_id', userId).eq('coleccion', 'perfil_asesor');
        showToast('Perfil formateado', 'success');
        setTimeout(() => window.navigateTo('comisiones'), 400);
    });
}
