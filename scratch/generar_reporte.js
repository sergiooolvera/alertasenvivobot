const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'messages.html');
const content = fs.readFileSync(filePath, 'utf8');

const messageRegex = /<div class="message[^"]*" id="message([^"]+)"[\s\S]*?<div class="text">([\s\S]*?)<\/div>/g;
let match;
const messages = [];

while ((match = messageRegex.exec(content)) !== null) {
    const id = match[1];
    let text = match[2].trim();
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/?[^>]+(>|$)/g, "");
    text = text.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    messages.push({ id, text });
}

const alertas = [];
const veredictos = [];

messages.forEach(msg => {
    const text = msg.text;
    if (text.includes('REGLA ') && (text.includes('ANÁLISIS DE IA') || text.includes('GOOGLE GEMINI') || text.includes('DEEPSEEK'))) {
        alertas.push(msg);
    } else if (text.includes('VEREDICTO POST-PARTIDO')) {
        veredictos.push(msg);
    }
});

// Función para normalizar nombres de reglas con equivalencias
function normalizarRegla(regla) {
    let normal = regla.replace(/^(?:🔥|⏳|🟥|🟨|🟢)\s*/i, '');
    normal = normal.replace(/^REGLA\s*\d+\s*:\s*/i, '');
    normal = normal.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    
    if (normal.includes('sorpresa')) return 'sorpresa';
    if (normal.includes('roja') || normal.includes('expulsion')) return 'roja';
    if (normal.includes('sufre')) return 'sufre';
    if (normal.includes('caliente') || normal.includes('tarjeta')) return 'caliente';
    if (normal.includes('remontada') || normal.includes('comeback')) return 'remontada';
    if (normal.includes('asedio') || normal.includes('goal') || normal.includes('gol')) return 'asedio';
    
    return normal.replace(/[^a-z0-9]/g, '');
}

// Función para normalizar nombres de partidos
function normalizarPartido(partido) {
    return partido
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+vs\s+/g, 'vs')
        .replace(/[^a-z0-9]/g, '');
}

const resultadosWeb = {
    "montanavsnesebar_sorpresa": { veredicto: "GREEN", detalle: "Marcador final 3-1. Gana local." },
    "rodinamoskvavsrubin_sorpresa": { veredicto: "RED", detalle: "Marcador final 5-0. Gana local. Rubin perdió." },
    "dinamomakhachkalavskryliasovetov_sorpresa": { veredicto: "RED", detalle: "Marcador final 1-2. Gana visitante." },
    "sydkystenvsishoj_sorpresa": { veredicto: "GREEN", detalle: "Marcador final 3-1. Más de 2.5 goles totalizados." },
    "bronshojvshbkoge_sorpresa": { veredicto: "APUESTA EVITADA", detalle: "Marcador final 1-0. Gana local (underdog). Favorito falló." },
    "vibyvsasaaarhus_sufre": { veredicto: "APUESTA EVITADA", detalle: "Marcador final 0-0. Empate en copa. Favorito falló en 90 min." },
    "sydkystenvsishoj_roja": { veredicto: "GREEN", detalle: "Marcador final 3-1. Gana local tras expulsión." },
    "hapoelbeershevavsfkcrvenazvezda_sorpresa": { veredicto: "RED", detalle: "Marcador final 1-0. Underdog defendió ventaja." },
    "godoycruzresvsracingclubres_roja": { veredicto: "RED", detalle: "Marcador final 1-1. Empate tras roja." },
    "unionstgilloisevsbodoglimt_caliente": { veredicto: "GREEN", detalle: "Marcador final 3-3. Hubo 7 tarjetas amarillas y 6 goles." },
    "oddervsskive_sorpresa": { veredicto: "GREEN", detalle: "Marcador final 2-2. Más de 2.5 goles y gol Skive acertados." },
    "kogewvsrigaw_sorpresa": { veredicto: "GREEN", detalle: "Marcador final 4-1. Gana local." },
    "brannvsapollonlimassol_sorpresa": { veredicto: "APUESTA EVITADA", detalle: "Marcador final 0-1. Gana visitante. Favorito falló." },
    "monterreyvsorlandocitysc_roja": { veredicto: "GREEN", detalle: "Marcador final 1-2. Gana visitante tras roja al local." }
};

const alertasProcesadas = [];
const alertasPorClave = {};

alertas.forEach(alerta => {
    const text = alerta.text;
    
    // Extraer Regla
    const reglaMatch = text.match(/(?:🔥|⏳|🟥|🟨|🟢)?\s*(REGLA\s*\d+:\s*[^━\n]+)/i) || text.match(/(REGLA\s*\d+:\s*[^━\n]+)/i);
    const reglaStr = reglaMatch ? reglaMatch[1].trim() : 'REGLA DESCONOCIDA';
    const reglaNorm = normalizarRegla(reglaStr);
    
    // Extraer partido
    const lineas = text.split('\n');
    let partido = 'Desconocido';
    let liga = 'Desconocida';
    let minuto = '';
    let marcador = '';
    
    lineas.forEach(l => {
        if (l.includes('Liga:')) {
            liga = l.replace(/.*Liga:\s*/i, '').trim();
        }
        if (l.includes('vs')) {
            partido = l.replace(/⚽\s*/i, '').trim();
        }
        if (l.includes('Minuto:')) {
            minuto = l.replace(/.*Minuto:\s*/i, '').split('|')[0].trim();
        }
        if (l.includes('Marcador:')) {
            marcador = l.replace(/.*Marcador:\s*/i, '').trim();
        }
    });
    
    partido = partido.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1').replace(/[\[\]]/g, '').trim();
    if (partido === 'Desconocido') {
        const partidoMatch = text.match(/⚽\s*([^\n]+vs[^\n]+)/i);
        if (partidoMatch) {
            partido = partidoMatch[1].replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1').replace(/[\[\]]/g, '').trim();
        }
    }
    
    const geminiIndex = text.indexOf('GOOGLE GEMINI');
    const deepseekIndex = text.indexOf('DEEPSEEK');
    
    let geminiText = '';
    let deepseekText = '';
    
    if (geminiIndex !== -1 && deepseekIndex !== -1) {
        geminiText = text.substring(geminiIndex, deepseekIndex);
        deepseekText = text.substring(deepseekIndex);
    } else if (geminiIndex !== -1) {
        geminiText = text.substring(geminiIndex);
    } else if (deepseekIndex !== -1) {
        deepseekText = text.substring(deepseekIndex);
    }
    
    // Parsear Google Gemini
    let geminiApuesta = 'No recomendada';
    let geminiConfianza = 0;
    if (geminiText) {
        const betMatch = geminiText.match(/🎯\s*Apuesta:\s*([^\n\(]+)/i) || geminiText.match(/Apuesta:\s*([^\n\(]+)/i);
        const confMatch = geminiText.match(/Confianza:\s*(\d+)%/i);
        if (betMatch) geminiApuesta = betMatch[1].trim();
        if (confMatch) geminiConfianza = parseInt(confMatch[1]);
    }
    
    // Parsear DeepSeek
    let deepseekApuesta = 'No recomendada';
    let deepseekConfianza = 0;
    if (deepseekText) {
        const betMatch = deepseekText.match(/🎯\s*Apuesta:\s*([^\n\(]+)/i) || deepseekText.match(/Apuesta:\s*([^\n\(]+)/i);
        const confMatch = deepseekText.match(/Confianza:\s*(\d+)%/i);
        if (betMatch) deepseekApuesta = betMatch[1].trim();
        if (confMatch) deepseekConfianza = parseInt(confMatch[1]);
    }
    
    const geminiEvita = geminiApuesta.toLowerCase().includes('evitar') || geminiApuesta.toLowerCase().includes('no recomendada') || geminiConfianza < 40;
    const deepseekEvita = deepseekApuesta.toLowerCase().includes('evitar') || deepseekApuesta.toLowerCase().includes('no recomendada') || deepseekConfianza < 40;
    
    const partidoNorm = normalizarPartido(partido);
    const key = `${partidoNorm}_${reglaNorm}`;
    
    const alertaData = {
        id: alerta.id,
        partido,
        partidoNorm,
        liga,
        regla: reglaStr,
        reglaNorm,
        minuto,
        marcador,
        geminiApuesta,
        geminiConfianza,
        geminiRecomendoApuesta: !geminiEvita,
        deepseekApuesta,
        deepseekConfianza,
        deepseekRecomendoApuesta: !deepseekEvita,
        veredicto: null,
        veredictoDetalle: null,
        origen: 'HTML'
    };
    
    alertasPorClave[key] = alertaData;
    alertasProcesadas.push(alertaData);
});

// Procesar veredictos del HTML
veredictos.forEach(v => {
    const text = v.text;
    let resultado = 'Desconocido';
    if (text.includes('GREEN')) resultado = 'GREEN';
    else if (text.includes('RED')) resultado = 'RED';
    else if (text.includes('APUESTA EVITADA')) resultado = 'APUESTA EVITADA';
    
    const lineas = text.split('\n');
    let partido = 'Desconocido';
    let reglaStr = 'Desconocida';
    let marcadorFinal = '';
    
    lineas.forEach(l => {
        if (l.includes('Regla:')) reglaStr = l.replace(/.*Regla:\s*/i, '').trim();
        if (l.includes('⚽')) {
            partido = l.replace(/⚽\s*/i, '').trim();
            const vsMatch = partido.match(/([^\d\-]+)\s*\d+\s*-\s*\d+\s*([^\d\-]+)/);
            if (vsMatch) partido = `${vsMatch[1].trim()} vs ${vsMatch[2].trim()}`;
        }
        if (l.includes('Resultado:')) marcadorFinal = l.replace(/.*Resultado:\s*/i, '').trim();
    });
    
    partido = partido.replace(/[\[\]]/g, '').trim();
    const partidoNorm = normalizarPartido(partido);
    const reglaNorm = normalizarRegla(reglaStr);
    let key = `${partidoNorm}_${reglaNorm}`;
    
    let alertaEncontrada = alertasPorClave[key];
    if (!alertaEncontrada) {
        // Coincidencia difusa
        const keys = Object.keys(alertasPorClave);
        const matchKey = keys.find(k => {
            const parts = k.split('_');
            const alertPart = parts[0];
            const alertRegla = parts[1];
            if (alertRegla === reglaNorm) {
                if (partidoNorm.includes(alertPart) || alertPart.includes(partidoNorm)) return true;
                const eqVeredicto = partidoNorm.split('vs');
                const eqAlerta = alertPart.split('vs');
                if (eqVeredicto.length === 2 && eqAlerta.length === 2) {
                    const v1 = eqVeredicto[0];
                    const v2 = eqVeredicto[1];
                    const a1 = eqAlerta[0];
                    const a2 = eqAlerta[1];
                    if ((v1.includes(a1) || a1.includes(v1) || v1.substring(0, 5) === a1.substring(0, 5)) &&
                        (v2.includes(a2) || a2.includes(v2) || v2.substring(0, 5) === a2.substring(0, 5))) {
                        return true;
                    }
                }
            }
            return false;
        });
        if (matchKey) {
            alertaEncontrada = alertasPorClave[matchKey];
            key = matchKey;
        }
    }
    
    if (alertaEncontrada) {
        alertaEncontrada.veredicto = resultado;
        alertaEncontrada.veredictoDetalle = marcadorFinal;
    }
});

// Inyectar resultados de Internet a las alertas que quedaron sin veredicto
let inyectadosCount = 0;
alertasProcesadas.forEach(alerta => {
    if (!alerta.veredicto) {
        const key = `${alerta.partidoNorm}_${alerta.reglaNorm}`;
        const resultadoExterno = resultadosWeb[key];
        if (resultadoExterno) {
            alerta.veredicto = resultadoExterno.veredicto;
            alerta.veredictoDetalle = resultadoExterno.detalle;
            alerta.origen = 'WEB';
            inyectadosCount++;
        }
    }
});

console.log(`Resultados inyectados desde la web: ${inyectadosCount}`);

// Calcular estadísticas finales
let totalAlertas = alertasProcesadas.length;
let totalVeredictos = alertasProcesadas.filter(a => a.veredicto).length;
let totalGreen = alertasProcesadas.filter(a => a.veredicto === 'GREEN').length;
let totalRed = alertasProcesadas.filter(a => a.veredicto === 'RED').length;
let totalEvitadas = alertasProcesadas.filter(a => a.veredicto === 'APUESTA EVITADA').length;

// Métricas de IA
let geminiRec = 0, geminiGreen = 0, geminiRed = 0, geminiEvit = 0, geminiEvitOk = 0;
let deepseekRec = 0, deepseekGreen = 0, deepseekRed = 0, deepseekEvit = 0;

alertasProcesadas.forEach(a => {
    const esGreen = a.veredicto === 'GREEN';
    const esRed = a.veredicto === 'RED';
    const esEvitada = a.veredicto === 'APUESTA EVITADA';
    
    // Google Gemini
    if (a.geminiRecomendoApuesta) {
        if (!esEvitada) {
            geminiRec++;
            if (esGreen) geminiGreen++;
            if (esRed) geminiRed++;
        } else {
            // El bot la evitó porque Gemini dijo evitar, pero qué recomendación de apuesta tenía?
            // Si la recomendación de entrada era true pero el veredicto fue APUESTA EVITADA, usualmente no pasa.
        }
    } else {
        geminiEvit++;
        // Se evitó. Si el partido terminó en desastre (RED o APUESTA EVITADA que representaba desastre de favorito)
        if (esRed || esEvitada) geminiEvitOk++;
    }
    
    // DeepSeek
    if (a.deepseekRecomendoApuesta) {
        if (!esEvitada) {
            deepseekRec++;
            if (esGreen) deepseekGreen++;
            if (esRed) deepseekRed++;
        } else {
            // Si se evitó por Gemini, contamos cómo le habría ido a DeepSeek que sí quería entrar: habría sido RED
            deepseekRec++;
            deepseekRed++;
        }
    } else {
        deepseekEvit++;
    }
});

const geminiWinrate = geminiRec > 0 ? ((geminiGreen / geminiRec) * 100).toFixed(1) : '0.0';
const deepseekWinrate = deepseekRec > 0 ? ((deepseekGreen / deepseekRec) * 100).toFixed(1) : '0.0';
const botWinrate = (totalGreen + totalEvitadas) > 0 ? (((totalGreen) / (totalGreen + totalRed)) * 100).toFixed(1) : '0.0';

// Agrupar por reglas para el listado interactivo
const reglasAgrupadas = {};
alertasProcesadas.forEach(a => {
    if (!reglasAgrupadas[a.regla]) {
        reglasAgrupadas[a.regla] = [];
    }
    reglasAgrupadas[a.regla].push(a);
});

// Generar código HTML
const htmlReport = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SafeOdds AI - Auditoría Completa de Rendimiento</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Plus+Jakarta+Sans:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-dark: #0a0e17;
            --bg-card: #121824;
            --bg-header: #162032;
            --primary: #4f46e5;
            --primary-light: #818cf8;
            --green: #10b981;
            --green-bg: rgba(16, 185, 129, 0.15);
            --red: #ef4444;
            --red-bg: rgba(239, 68, 68, 0.15);
            --yellow: #f59e0b;
            --yellow-bg: rgba(245, 158, 11, 0.15);
            --gray: #6b7280;
            --text-main: #f3f4f6;
            --text-secondary: #9ca3af;
            --border: #1f2937;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            background-color: var(--bg-dark);
            color: var(--text-main);
            font-family: 'Plus Jakarta Sans', sans-serif;
            line-height: 1.6;
            padding-bottom: 60px;
        }

        header {
            background: linear-gradient(135deg, var(--bg-header), var(--bg-dark));
            border-bottom: 1px solid var(--border);
            padding: 40px 20px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }

        header::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(79,70,229,0.08) 0%, transparent 60%);
            pointer-events: none;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
        }

        h1 {
            font-family: 'Outfit', sans-serif;
            font-size: 2.5rem;
            font-weight: 800;
            background: linear-gradient(135deg, #fff 30%, var(--primary-light));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 10px;
        }

        .subtitle {
            color: var(--text-secondary);
            font-size: 1.1rem;
            max-width: 600px;
            margin: 0 auto;
        }

        /* Dashboard KPIs */
        .dashboard-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 20px;
            margin: -30px auto 40px auto;
            position: relative;
            z-index: 10;
        }

        .kpi-card {
            background-color: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 24px;
            text-align: center;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
            transition: transform 0.3s ease, border-color 0.3s ease;
        }

        .kpi-card:hover {
            transform: translateY(-5px);
            border-color: var(--primary-light);
        }

        .kpi-val {
            font-family: 'Outfit', sans-serif;
            font-size: 2.2rem;
            font-weight: 800;
            color: #fff;
            margin-bottom: 5px;
        }

        .kpi-card.green .kpi-val { color: var(--green); }
        .kpi-card.red .kpi-val { color: var(--red); }
        .kpi-card.primary .kpi-val { color: var(--primary-light); }

        .kpi-lbl {
            font-size: 0.85rem;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 600;
        }

        /* Comparador de IAs */
        .ia-comparison {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
            gap: 30px;
            margin-bottom: 40px;
        }

        @media (max-width: 600px) {
            .ia-comparison {
                grid-template-columns: 1fr;
            }
        }

        .ia-card {
            background-color: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 20px;
            padding: 30px;
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }

        .ia-card::after {
            content: '';
            position: absolute;
            top: 0;
            right: 0;
            width: 150px;
            height: 150px;
            pointer-events: none;
            opacity: 0.15;
        }

        .ia-card.gemini::after {
            background: radial-gradient(circle, var(--primary-light) 0%, transparent 70%);
        }

        .ia-card.deepseek::after {
            background: radial-gradient(circle, #0ea5e9 0%, transparent 70%);
        }

        .ia-header {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 25px;
            border-bottom: 1px solid var(--border);
            padding-bottom: 15px;
        }

        .ia-icon {
            font-size: 2rem;
        }

        .ia-name {
            font-family: 'Outfit', sans-serif;
            font-size: 1.5rem;
            font-weight: 700;
            color: #fff;
        }

        .winrate-gauge {
            display: flex;
            align-items: center;
            gap: 30px;
            margin-bottom: 30px;
        }

        .gauge-circle {
            position: relative;
            width: 100px;
            height: 100px;
        }

        .gauge-svg {
            transform: rotate(-90deg);
        }

        .gauge-bg {
            fill: none;
            stroke: #1f2937;
            stroke-width: 8;
        }

        .gauge-bar {
            fill: none;
            stroke-width: 8;
            stroke-linecap: round;
            transition: stroke-dashoffset 1s ease-out;
        }

        .gemini .gauge-bar { stroke: var(--primary-light); }
        .deepseek .gauge-bar { stroke: #0ea5e9; }

        .gauge-text {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-family: 'Outfit', sans-serif;
            font-size: 1.4rem;
            font-weight: 800;
            color: #fff;
        }

        .winrate-desc h4 {
            font-size: 1.2rem;
            margin-bottom: 5px;
        }

        .winrate-desc p {
            color: var(--text-secondary);
            font-size: 0.9rem;
        }

        .ia-stats-list {
            list-style: none;
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-top: auto;
        }

        .ia-stat-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 14px;
            background-color: rgba(255,255,255,0.02);
            border-radius: 10px;
            border: 1px solid rgba(255,255,255,0.04);
            font-size: 0.95rem;
        }

        .ia-stat-item span {
            color: var(--text-secondary);
        }

        .ia-stat-item strong {
            color: #fff;
        }

        .badge {
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 700;
            text-transform: uppercase;
        }

        .badge.green { background-color: var(--green-bg); color: var(--green); }
        .badge.red { background-color: var(--red-bg); color: var(--red); }
        .badge.yellow { background-color: var(--yellow-bg); color: var(--yellow); }

        /* Acordeón de Reglas */
        .section-title {
            font-family: 'Outfit', sans-serif;
            font-size: 1.8rem;
            font-weight: 700;
            margin: 40px 0 20px 0;
            border-left: 4px solid var(--primary);
            padding-left: 15px;
            color: #fff;
        }

        .accordion-item {
            background-color: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 12px;
            margin-bottom: 15px;
            overflow: hidden;
        }

        .accordion-header {
            padding: 20px;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: rgba(255,255,255,0.01);
            transition: background-color 0.2s ease;
        }

        .accordion-header:hover {
            background-color: rgba(255,255,255,0.03);
        }

        .accordion-title {
            font-weight: 700;
            font-size: 1.1rem;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .accordion-title span.count {
            background-color: rgba(255,255,255,0.08);
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: 400;
            color: var(--text-secondary);
        }

        .accordion-content {
            display: none;
            padding: 20px;
            border-top: 1px solid var(--border);
            background-color: rgba(0,0,0,0.15);
        }

        .accordion-arrow {
            transition: transform 0.2s ease;
            color: var(--text-secondary);
        }

        .accordion-item.active .accordion-content {
            display: block;
        }

        .accordion-item.active .accordion-arrow {
            transform: rotate(180deg);
        }

        /* Tabla de Partidos */
        .table-responsive {
            overflow-x: auto;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
            font-size: 0.9rem;
        }

        th {
            background-color: rgba(255,255,255,0.02);
            color: var(--text-secondary);
            font-weight: 600;
            padding: 12px 16px;
            border-bottom: 2px solid var(--border);
            text-transform: uppercase;
            font-size: 0.75rem;
            letter-spacing: 0.5px;
        }

        td {
            padding: 14px 16px;
            border-bottom: 1px solid var(--border);
            vertical-align: middle;
        }

        tr:last-child td {
            border-bottom: none;
        }

        tr:hover td {
            background-color: rgba(255,255,255,0.01);
        }

        .partido-cell {
            font-weight: 700;
            color: #fff;
        }

        .liga-cell {
            color: var(--text-secondary);
            font-size: 0.8rem;
        }

        .ia-pred-cell {
            font-size: 0.85rem;
        }

        .ia-pred-cell strong {
            display: block;
            color: #fff;
        }

        .ia-pred-cell span {
            color: var(--text-secondary);
            font-size: 0.8rem;
        }

        .source-badge {
            font-size: 0.7rem;
            padding: 2px 6px;
            border-radius: 4px;
            background-color: rgba(255,255,255,0.05);
            color: var(--text-secondary);
            font-weight: 700;
        }

        .source-badge.web {
            background-color: rgba(79,70,229,0.15);
            color: var(--primary-light);
        }
    </style>
</head>
<body>

    <header>
        <div class="container">
            <h1>SafeOdds AI</h1>
            <div class="subtitle">Auditoría completa de efectividad del bot y análisis comparativo de IAs en base a messages.html</div>
        </div>
    </header>

    <div class="container">
        
        <!-- Dashboard Grid -->
        <div class="dashboard-grid">
            <div class="kpi-card primary">
                <div class="kpi-val">${totalAlertas}</div>
                <div class="kpi-lbl">Alertas Totales</div>
            </div>
            <div class="kpi-card green">
                <div class="kpi-val">${totalGreen}</div>
                <div class="kpi-lbl">Aciertos (GREEN)</div>
            </div>
            <div class="kpi-card red">
                <div class="kpi-val">${totalRed}</div>
                <div class="kpi-lbl">Fallos (RED)</div>
            </div>
            <div class="kpi-card yellow">
                <div class="kpi-val">${totalEvitadas}</div>
                <div class="kpi-lbl">Apuestas Evitadas</div>
            </div>
        </div>

        <div class="section-title">Análisis de Desempeño de Inteligencia Artificial</div>

        <!-- Comparación IAs -->
        <div class="ia-comparison">
            
            <!-- Gemini Card -->
            <div class="ia-card gemini">
                <div class="ia-header">
                    <span class="ia-icon">♊</span>
                    <div>
                        <div class="ia-name">Google Gemini</div>
                        <div style="color: var(--text-secondary); font-size: 0.8rem;">Modelo Principal de Filtro</div>
                    </div>
                </div>
                
                <div class="winrate-gauge">
                    <div class="gauge-circle">
                        <svg class="gauge-svg" width="100" height="100">
                            <circle class="gauge-bg" cx="50" cy="50" r="42"></circle>
                            <circle class="gauge-bar" cx="50" cy="50" r="42" stroke-dasharray="263.8" stroke-dashoffset="${263.8 - (263.8 * geminiWinrate / 100)}"></circle>
                        </svg>
                        <div class="gauge-text">${geminiWinrate}%</div>
                    </div>
                    <div class="winrate-desc">
                        <h4>Porcentaje de Aciertos</h4>
                        <p>Efectividad real basada en recomendaciones marcadas como operables.</p>
                    </div>
                </div>

                <div class="ia-stats-list">
                    <div class="ia-stat-item">
                        <span>Total Recomendadas (Operadas)</span>
                        <strong>${geminiRec}</strong>
                    </div>
                    <div class="ia-stat-item">
                        <span>Aciertos (GREEN)</span>
                        <strong style="color: var(--green);">${geminiGreen}</strong>
                    </div>
                    <div class="ia-stat-item">
                        <span>Fallos (RED)</span>
                        <strong style="color: var(--red);">${geminiRed}</strong>
                    </div>
                    <div class="ia-stat-item">
                        <span>Recomendó Evitar (Filtro de Riesgo)</span>
                        <strong>${geminiEvit}</strong>
                    </div>
                    <div class="ia-stat-item">
                        <span>Efectividad de Evitadas (RED prevenidos)</span>
                        <strong style="color: var(--green);">${((geminiEvitOk/geminiEvit)*100).toFixed(1)}% (${geminiEvitOk}/${geminiEvit})</strong>
                    </div>
                </div>
            </div>

            <!-- DeepSeek Card -->
            <div class="ia-card deepseek">
                <div class="ia-header">
                    <span class="ia-icon">🐳</span>
                    <div>
                        <div class="ia-name">DeepSeek</div>
                        <div style="color: var(--text-secondary); font-size: 0.8rem;">Modelo Secundario Dual</div>
                    </div>
                </div>
                
                <div class="winrate-gauge">
                    <div class="gauge-circle">
                        <svg class="gauge-svg" width="100" height="100">
                            <circle class="gauge-bg" cx="50" cy="50" r="42"></circle>
                            <circle class="gauge-bar" cx="50" cy="50" r="42" stroke-dasharray="263.8" stroke-dashoffset="${263.8 - (263.8 * deepseekWinrate / 100)}"></circle>
                        </svg>
                        <div class="gauge-text">${deepseekWinrate}%</div>
                    </div>
                    <div class="winrate-desc">
                        <h4>Porcentaje de Aciertos</h4>
                        <p>Efectividad real basada en recomendaciones marcadas como operables.</p>
                    </div>
                </div>

                <div class="ia-stats-list">
                    <div class="ia-stat-item">
                        <span>Total Recomendadas (Operadas)</span>
                        <strong>${deepseekRec}</strong>
                    </div>
                    <div class="ia-stat-item">
                        <span>Aciertos (GREEN)</span>
                        <strong style="color: var(--green);">${deepseekGreen}</strong>
                    </div>
                    <div class="ia-stat-item">
                        <span>Fallos (RED)</span>
                        <strong style="color: var(--red);">${deepseekRed}</strong>
                    </div>
                    <div class="ia-stat-item">
                        <span>Recomendó Evitar (Filtro de Riesgo)</span>
                        <strong>${deepseekEvit}</strong>
                    </div>
                    <div class="ia-stat-item">
                        <span>Efectividad de Evitadas</span>
                        <strong>N/A (No evitó alertas)</strong>
                    </div>
                </div>
            </div>

        </div>

        <div class="section-title">Registro Detallado por Estrategias de Fútbol</div>

        <!-- Renderizado de Acordeones -->
        <div class="accordion-container">
            ${Object.keys(reglasAgrupadas).map(regla => {
                const list = reglasAgrupadas[regla];
                return `
                <div class="accordion-item">
                    <div class="accordion-header" onclick="toggleAccordion(this)">
                        <div class="accordion-title">
                            <span class="accordion-icon">📋</span>
                            ${regla}
                            <span class="count">${list.length} alertas</span>
                        </div>
                        <span class="accordion-arrow">▼</span>
                    </div>
                    <div class="accordion-content">
                        <div class="table-responsive">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Partido / Liga</th>
                                        <th>Min. / Marcador</th>
                                        <th>Recomendación Gemini</th>
                                        <th>Recomendación DeepSeek</th>
                                        <th>Resultado Final / Auditoría</th>
                                        <th>Veredicto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${list.map(partido => {
                                        let badgeClass = 'yellow';
                                        if (partido.veredicto === 'GREEN') badgeClass = 'green';
                                        if (partido.veredicto === 'RED') badgeClass = 'red';
                                        
                                        const geminiEvita = !partido.geminiRecomendoApuesta;
                                        const deepseekEvita = !partido.deepseekRecomendoApuesta;

                                        return `
                                        <tr>
                                            <td>
                                                <div class="partido-cell">${partido.partido}</div>
                                                <div class="liga-cell">${partido.liga}</div>
                                            </td>
                                            <td>
                                                <div>Min. ${partido.minuto}</div>
                                                <div class="liga-cell">Marcador: ${partido.marcador}</div>
                                            </td>
                                            <td class="ia-pred-cell">
                                                <strong>${partido.geminiApuesta}</strong>
                                                <span>Confianza: ${partido.geminiConfianza}% ${geminiEvita ? '❌' : '✅'}</span>
                                            </td>
                                            <td class="ia-pred-cell">
                                                <strong>${partido.deepseekApuesta}</strong>
                                                <span>Confianza: ${partido.deepseekConfianza}% ${deepseekEvita ? '❌' : '✅'}</span>
                                            </td>
                                            <td>
                                                <div style="font-size: 0.85rem; max-width: 250px;">
                                                    ${partido.veredictoDetalle || 'Resultado no registrado en el chat'}
                                                </div>
                                                <span class="source-badge ${partido.origen === 'WEB' ? 'web' : ''}">${partido.origen}</span>
                                            </td>
                                            <td>
                                                <span class="badge ${badgeClass}">${partido.veredicto || 'PENDIENTE'}</span>
                                            </td>
                                        </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                `;
            }).join('')}
        </div>

    </div>

    <script>
        function toggleAccordion(header) {
            const item = header.parentElement;
            item.classList.toggle('active');
        }
    </script>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, '..', 'reporte_auditoria_messages.html'), htmlReport, 'utf8');
console.log("✅ Reporte HTML guardado exitosamente en reporte_auditoria_messages.html");
