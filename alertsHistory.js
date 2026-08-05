const fs = require('fs');
const path = require('path');
const { getLocalDateString, getYesterdayDateString } = require('./financialTracker');
const aiService = require('./aiService');

const HISTORY_FILE = path.join(__dirname, 'alerts_history.json');

function loadHistory() {
    if (!fs.existsSync(HISTORY_FILE)) {
        const initial = {
            alerts: [],
            parlays: []
        };
        saveHistory(initial);
        return initial;
    }
    try {
        return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    } catch (e) {
        console.error('[alertsHistory] Error leyendo alerts_history.json, retornando valores iniciales:', e.message);
        return { alerts: [], parlays: [] };
    }
}

function saveHistory(data) {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('[alertsHistory] Error escribiendo alerts_history.json:', e.message);
    }
}

function addAlert({ fixtureId, home, away, league, ruleName, initialScore, geminiRec, geminiConf, deepseekRec, deepseekConf }) {
    const data = loadHistory();
    const exists = data.alerts.some(a => a.fixtureId === fixtureId && a.ruleName === ruleName);
    if (exists) return;

    const isOmitted = geminiRec && (geminiRec.toLowerCase().includes('evitar') || geminiRec.toLowerCase().includes('no recomendada'));

    const now = new Date();
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Mexico_City',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    const timeStr = timeFormatter.format(now);

    const newAlert = {
        fixtureId,
        date: getLocalDateString(),
        time: timeStr,
        home,
        away,
        league,
        ruleName,
        initialScore,
        geminiRec: geminiRec || 'N/D',
        geminiConf: geminiConf ? parseInt(geminiConf) : 80,
        geminiStatus: isOmitted ? 'AVOIDED' : 'PENDING',
        deepseekRec: deepseekRec || 'N/D',
        deepseekConf: deepseekConf ? parseInt(deepseekConf) : 80,
        deepseekStatus: 'PENDING',
        status: isOmitted ? 'AVOIDED' : 'PENDING',
        finalScore: null,
        isOmitted: !!isOmitted,
        timestamp: Date.now()
    };

    data.alerts.push(newAlert);
    saveHistory(data);
    console.log(`[alertsHistory] Alerta registrada en historial: ${home} vs ${away} (${ruleName})`);
}

function addDailyParlay(timeString, text) {
    const data = loadHistory();
    const dateStr = getLocalDateString();
    
    const exists = data.parlays.some(p => p.date === dateStr && p.time === timeString);
    if (exists) return;

    data.parlays.push({
        date: dateStr,
        time: timeString,
        text,
        status: 'PENDING',
        resultExplanation: null,
        selections: [],
        timestamp: Date.now()
    });
    saveHistory(data);
    console.log(`[alertsHistory] Parlay del Día (${timeString}) registrado en historial.`);
}

async function updateAlertVerdict({ fixtureId, ruleName, finalHome, finalAway, finalEvents, finalStats }) {
    const data = loadHistory();
    const alert = data.alerts.find(a => a.fixtureId === fixtureId && a.ruleName === ruleName);
    if (!alert) return;

    if (alert.status !== 'PENDING' && alert.geminiStatus !== 'PENDING' && alert.deepseekStatus !== 'PENDING') {
        return; 
    }

    const finalScore = `${finalHome} - ${finalAway}`;
    alert.finalScore = finalScore;

    // Evaluamos Gemini
    if (alert.isOmitted) {
        alert.geminiStatus = 'AVOIDED';
    } else {
        try {
            const geminiOutcome = await aiService.evaluatePredictionOutcome('football', alert.geminiRec, {
                fixture: { goals: { home: finalHome, away: finalAway } },
                events: finalEvents,
                stats: finalStats
            });
            alert.geminiStatus = geminiOutcome && geminiOutcome.isGreen ? 'GREEN' : 'RED';
        } catch (e) {
            console.error(`[alertsHistory] Error evaluando Gemini para ${fixtureId}:`, e.message);
            alert.geminiStatus = 'RED';
        }
    }

    // Evaluamos DeepSeek
    try {
        const dsOutcome = await aiService.evaluatePredictionOutcome('football', alert.deepseekRec, {
            fixture: { goals: { home: finalHome, away: finalAway } },
            events: finalEvents,
            stats: finalStats
        });
        alert.deepseekStatus = dsOutcome && dsOutcome.isGreen ? 'GREEN' : 'RED';
    } catch (e) {
        console.error(`[alertsHistory] Error evaluando DeepSeek para ${fixtureId}:`, e.message);
        alert.deepseekStatus = 'RED';
    }

    alert.status = alert.isOmitted ? 'AVOIDED' : alert.geminiStatus;

    saveHistory(data);
    console.log(`[alertsHistory] Veredicto histórico actualizado para ${alert.home} vs ${alert.away}: Gemini: ${alert.geminiStatus}, DeepSeek: ${alert.deepseekStatus}`);
}

async function resolveYesterdayParlays() {
    const data = loadHistory();
    const yesterdayStr = getYesterdayDateString();
    
    // Obtener parlays pendientes de ayer
    const pendingParlays = data.parlays.filter(p => p.date === yesterdayStr && p.status === 'PENDING');
    if (pendingParlays.length === 0) return;

    console.log(`[alertsHistory] Resolviendo ${pendingParlays.length} parlays pendientes de ayer (${yesterdayStr})...`);

    for (const parlay of pendingParlays) {
        try {
            const prompt = `Ayer se propuso este parlay de fútbol pre-partido:
            "${parlay.text}"
            Por favor, busca en la web los resultados de cada uno de los partidos de fútbol mencionados del día ${yesterdayStr} (considerando zonas horarias) y determina si la predicción (pronóstico) fue ganadora o perdedora para cada selección.
            
            Si TODAS las selecciones del parlay fueron ganadoras, el parlay es "GREEN". Si AL MENOS UNA selección fue perdedora, el parlay es "RED".
            
            Responde exclusivamente en formato JSON estructurado, sin markdown, sin texto adicional:
            {
              "status": "GREEN" o "RED",
              "resultExplanation": "Breve resumen en español de cómo quedó cada partido y el veredicto del parlay.",
              "selections": [
                { "match": "Nombre del partido", "hit": true o false, "score": "marcador final" }
              ]
            }`;

            // Llamar a Gemini con Google Search habilitado
            const responseText = await aiService.callGeminiWithGoogleSearch(prompt);
            if (responseText) {
                // Limpiar posible Markdown
                let cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
                const jsonResult = JSON.parse(cleaned);
                
                parlay.status = jsonResult.status || 'RED';
                parlay.resultExplanation = jsonResult.resultExplanation || 'Resuelto mediante búsqueda web de IA.';
                parlay.selections = jsonResult.selections || [];
                console.log(`[alertsHistory] Parlay de las ${parlay.time} resuelto como ${parlay.status}`);
            }
        } catch (error) {
            console.error(`[alertsHistory] Error resolviendo parlay de las ${parlay.time}:`, error.message);
            // Fallback para no atorarse: marcar como RED pero mantener PENDING si fue error de API transitorio
        }
    }
    saveHistory(data);
}

// Genera el reporte HTML de la fecha especificada a partir de los datos históricos
function generateHtmlReport(dateStr, targetFilePath) {
    const data = loadHistory();
    
    // Filtrar alertas y parlays del día solicitado
    const dayAlerts = data.alerts.filter(a => a.date === dateStr);
    const dayParlays = data.parlays.filter(p => p.date === dateStr);

    // Calcular estadísticas globales
    const totalAlerts = dayAlerts.length;
    
    const geminiOperated = dayAlerts.filter(a => !a.isOmitted);
    const geminiGreen = geminiOperated.filter(a => a.geminiStatus === 'GREEN').length;
    const geminiRed = geminiOperated.filter(a => a.geminiStatus === 'RED').length;
    const geminiAvoided = dayAlerts.filter(a => a.isOmitted).length;
    const geminiEff = geminiOperated.length > 0 ? ((geminiGreen / geminiOperated.length) * 100).toFixed(2) : '0.00';

    const dsGreen = dayAlerts.filter(a => a.deepseekStatus === 'GREEN').length;
    const dsRed = dayAlerts.filter(a => a.deepseekStatus === 'RED').length;
    const dsEff = totalAlerts > 0 ? ((dsGreen / totalAlerts) * 100).toFixed(2) : '0.00';

    // Frecuencia de Reglas
    const ruleCounts = {};
    dayAlerts.forEach(a => {
        const key = a.ruleName.split(':')[0].trim();
        if (!ruleCounts[key]) {
            ruleCounts[key] = { name: a.ruleName.split(':')[0].trim() || a.ruleName, count: 0, geminiG: 0, geminiR: 0, geminiA: 0, dsG: 0, dsR: 0 };
        }
        ruleCounts[key].count++;
        if (a.isOmitted) ruleCounts[key].geminiA++;
        else if (a.geminiStatus === 'GREEN') ruleCounts[key].geminiG++;
        else if (a.geminiStatus === 'RED') ruleCounts[key].geminiR++;

        if (a.deepseekStatus === 'GREEN') ruleCounts[key].dsG++;
        else if (a.deepseekStatus === 'RED') ruleCounts[key].dsR++;
    });

    const rulesSorted = Object.values(ruleCounts).sort((a, b) => b.count - a.count);

    // Frecuencia de Mercados (Apuestas) y Efectividad
    // Categorización simple
    const classifyMarket = (rec) => {
        const text = rec.toLowerCase();
        if (text.includes('victoria') || text.includes('gana') || text.includes('ml') || text.includes('línea de dinero') || text.includes('resultado final')) {
            return 'Victoria Directa (Línea de Dinero / ML)';
        }
        if (text.includes('goles') || text.includes('over') || text.includes('under') || text.includes('más de') || text.includes('línea de goles')) {
            if (text.includes('tarjetas')) return 'Tarjetas Totales';
            return 'Línea de Goles (Over/Under)';
        }
        if (text.includes('próximo gol') || text.includes('siguiente gol')) {
            return 'Próximo Gol / Siguiente Gol';
        }
        if (text.includes('doble oportunidad') || text.includes('doble chance') || text.includes('1x') || text.includes('x2')) {
            return 'Doble Oportunidad (1X / X2)';
        }
        if (text.includes('tarjeta') || text.includes('amonestación')) {
            return 'Tarjetas Totales';
        }
        if (text.includes('córner') || text.includes('tiro de esquina')) {
            return 'Córneres Totales';
        }
        return 'Otros Mercados';
    };

    const marketStats = {};
    dayAlerts.forEach(a => {
        if (a.geminiStatus !== 'PENDING' && a.geminiStatus !== 'AVOIDED') {
            const mKey = classifyMarket(a.geminiRec);
            if (!marketStats[mKey]) marketStats[mKey] = { name: mKey, count: 0, green: 0, red: 0 };
            marketStats[mKey].count++;
            if (a.geminiStatus === 'GREEN') marketStats[mKey].green++;
            else marketStats[mKey].red++;
        }
        if (a.deepseekStatus !== 'PENDING') {
            const mKey = classifyMarket(a.deepseekRec);
            if (!marketStats[mKey]) marketStats[mKey] = { name: mKey, count: 0, green: 0, red: 0 };
            marketStats[mKey].count++;
            if (a.deepseekStatus === 'GREEN') marketStats[mKey].green++;
            else marketStats[mKey].red++;
        }
    });

    const marketsSorted = Object.values(marketStats).sort((a, b) => b.count - a.count);

    // Formatear Fecha
    const [year, month, day] = dateStr.split('-');
    const dateObj = new Date(year, month - 1, day);
    const dateLabel = new Intl.DateTimeFormat('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(dateObj);
    const dateLabelClean = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);

    // Inyectar HTML
    let rulesHtml = '';
    rulesSorted.forEach(r => {
        const pct = ((r.count / totalAlerts) * 100).toFixed(2);
        rulesHtml += `
        <div class="insight-item">
            <div class="insight-item-header">
                <span class="insight-name">${r.name}</span>
                <span class="insight-stats">${r.count} Alertas (${pct}%)</span>
            </div>
            <div class="progress-bar-container">
                <div class="progress-bar-fill pbar-frequency" style="width: ${pct}%;"></div>
            </div>
            <div class="insight-pill-group">
                <span class="pill-tag">Gemini: ${r.geminiG} G / ${r.geminiR} R / ${r.geminiA} E</span>
                <span class="pill-tag">DeepSeek: ${r.dsG} G / ${r.dsR} R</span>
            </div>
        </div>`;
    });

    let marketsHtml = '';
    marketsSorted.forEach(m => {
        const eff = ((m.green / m.count) * 100).toFixed(2);
        marketsHtml += `
        <div class="insight-item">
            <div class="insight-item-header">
                <span class="insight-name">${m.name}</span>
                <span class="insight-stats" style="color: var(--green-glow); font-weight: 600;">${eff}% Efectiva</span>
            </div>
            <div class="progress-bar-container">
                <div class="progress-bar-fill pbar-efficiency" style="width: ${eff}%;"></div>
            </div>
            <div style="margin-top: 0.5rem; font-size: 0.8rem; color: var(--text-secondary); display: flex; justify-content: space-between;">
                <span>Recomendada ${m.count} veces (${m.green} G / ${m.red} R)</span>
            </div>
        </div>`;
    });

    let parlaysHtml = '';
    if (dayParlays.length === 0) {
        parlaysHtml = `<div class="insight-item"><p style="color: var(--text-secondary);">No se registraron Parlays pre-partido para este día.</p></div>`;
    } else {
        dayParlays.forEach(p => {
            const statusClass = p.status === 'GREEN' ? 'hit' : 'failed';
            const badgeClass = p.status === 'GREEN' ? 'badge-green' : (p.status === 'PENDING' ? 'badge-yellow' : 'badge-red');
            const listItems = p.selections && p.selections.length > 0
                ? p.selections.map(s => `<li class="${s.hit ? 'hit' : 'miss'}">${s.match}<br><span style="color: var(--text-secondary); font-size: 0.8rem;">Score: ${s.score || 'N/D'}</span></li>`).join('')
                : `<li>${p.text.replace(/\n/g, '<br>')}</li>`;

            parlaysHtml += `
            <div class="parlay-item ${statusClass}">
                <div class="parlay-header">
                    <span class="parlay-title">Parlay del Día (${p.time})</span>
                    <span class="badge ${badgeClass}">${p.status}</span>
                </div>
                <ul class="parlay-selections">
                    ${listItems}
                </ul>
                ${p.resultExplanation ? `<p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.8rem; padding-top: 0.5rem; border-top: 1px dashed var(--border-color);">${p.resultExplanation}</p>` : ''}
            </div>`;
        });
    }

    let tableRows = '';
    dayAlerts.forEach(a => {
        const geminiClass = a.geminiStatus === 'GREEN' ? 'status-green' : (a.geminiStatus === 'AVOIDED' ? 'status-gray' : 'status-red');
        const dsClass = a.deepseekStatus === 'GREEN' ? 'status-green' : 'status-red';
        const finalScoreLabel = a.finalScore || 'N/D';
        const finalBoxClass = a.status === 'GREEN' ? 'highlight-green' : '';

        tableRows += `
        <tr>
            <td>
                <div class="match-info">
                    <span style="font-weight: 600;">${a.time}</span>
                    <span class="match-league">${a.league}</span>
                </div>
            </td>
            <td>
                <div class="match-info">
                    <span class="match-teams">${a.home} vs ${a.away}</span>
                    <span class="match-league">Marcador Alerta: ${a.initialScore}</span>
                </div>
            </td>
            <td><span class="rule-badge">${a.ruleName}</span></td>
            <td><div class="result-box ${finalBoxClass}">${finalScoreLabel}</div></td>
            <td>
                <div class="ai-verdict">
                    <span class="ai-pick">${a.geminiRec}</span>
                    <span class="status-pill ${geminiClass}">${a.geminiStatus}</span>
                    <span class="ai-conf">Conf: ${a.geminiConf}%</span>
                </div>
            </td>
            <td>
                <div class="ai-verdict">
                    <span class="ai-pick">${a.deepseekRec}</span>
                    <span class="status-pill ${dsClass}">${a.deepseekStatus}</span>
                    <span class="ai-conf">Conf: ${a.deepseekConf}%</span>
                </div>
            </td>
        </tr>`;
    });

    const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reporte de Rendimiento IA - ${dateStr}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-primary: #0b0f19;
            --bg-secondary: #131b2e;
            --bg-card: rgba(30, 41, 59, 0.7);
            --accent-gemini: #4d90fe;
            --accent-deepseek: #00d2ff;
            --green-glow: #10b981;
            --green-bg: rgba(16, 185, 129, 0.15);
            --red-glow: #ef4444;
            --red-bg: rgba(239, 68, 68, 0.15);
            --yellow-glow: #f59e0b;
            --yellow-bg: rgba(245, 158, 11, 0.15);
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --border-color: rgba(255, 255, 255, 0.08);
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Outfit', sans-serif;
            background-color: var(--bg-primary);
            background-image: 
                radial-gradient(at 0% 0%, rgba(77, 144, 254, 0.1) 0px, transparent 50%),
                radial-gradient(at 100% 100%, rgba(0, 210, 255, 0.08) 0px, transparent 50%);
            color: var(--text-primary);
            min-height: 100vh;
            padding: 2rem 1rem;
            line-height: 1.5;
        }
        .container { max-width: 1300px; margin: 0 auto; }
        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2rem;
            padding-bottom: 1.5rem;
            border-bottom: 1px solid var(--border-color);
        }
        h1 {
            font-size: 2.2rem;
            font-weight: 700;
            background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .date-badge {
            background-color: var(--bg-secondary);
            border: 1px solid var(--border-color);
            padding: 0.5rem 1rem;
            border-radius: 9999px;
            font-weight: 600;
            color: var(--text-secondary);
            font-size: 0.9rem;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2.5rem;
        }
        .card {
            background: var(--bg-card);
            backdrop-filter: blur(10px);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 1.5rem;
            transition: transform 0.3s ease, border-color 0.3s ease;
        }
        .card:hover { transform: translateY(-5px); border-color: rgba(255, 255, 255, 0.15); }
        .card-title {
            font-size: 0.9rem;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 0.5rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .card-value { font-size: 2.5rem; font-weight: 700; margin-bottom: 0.5rem; }
        .card-desc { font-size: 0.85rem; color: var(--text-secondary); }
        .card-desc span { font-weight: 600; }
        .gemini-card { border-left: 4px solid var(--accent-gemini); }
        .gemini-text { color: var(--accent-gemini); }
        .deepseek-card { border-left: 4px solid var(--accent-deepseek); }
        .deepseek-text { color: var(--accent-deepseek); }
        .highlight-green { color: var(--green-glow); }
        .insights-section {
            background-color: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 1.8rem;
            margin-bottom: 2.5rem;
        }
        .insights-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: 2rem; }
        .insight-block { display: flex; flex-direction: column; gap: 1.2rem; }
        .insight-item {
            background: rgba(15, 23, 42, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            padding: 1rem;
        }
        .insight-item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem; font-size: 0.95rem; }
        .insight-name { font-weight: 600; color: var(--text-primary); }
        .insight-stats { font-size: 0.85rem; color: var(--text-secondary); }
        .progress-bar-container {
            width: 100%;
            height: 8px;
            background-color: rgba(255, 255, 255, 0.05);
            border-radius: 4px;
            overflow: hidden;
        }
        .progress-bar-fill { height: 100%; border-radius: 4px; }
        .pbar-frequency { background: linear-gradient(90deg, #3b82f6, #00d2ff); }
        .pbar-efficiency { background: linear-gradient(90deg, #10b981, #059669); }
        .insight-pill-group { display: flex; gap: 0.5rem; margin-top: 0.4rem; }
        .pill-tag {
            font-size: 0.75rem;
            padding: 0.15rem 0.4rem;
            border-radius: 4px;
            background-color: rgba(255, 255, 255, 0.06);
            color: var(--text-secondary);
        }
        .parlays-section {
            background-color: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 1.5rem;
            margin-bottom: 2.5rem;
        }
        .section-title {
            font-size: 1.4rem;
            margin-bottom: 1.2rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            padding-bottom: 0.5rem;
        }
        .parlays-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem; }
        .parlay-item {
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 1.2rem;
            position: relative;
            overflow: hidden;
        }
        .parlay-item.failed { border-left: 4px solid var(--red-glow); }
        .parlay-item.hit { border-left: 4px solid var(--green-glow); }
        .parlay-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
        .parlay-title { font-weight: 600; font-size: 1rem; }
        .badge { font-size: 0.75rem; padding: 0.25rem 0.6rem; border-radius: 6px; font-weight: 700; text-transform: uppercase; }
        .badge-red { background-color: var(--red-bg); color: var(--red-glow); }
        .badge-green { background-color: var(--green-bg); color: var(--green-glow); }
        .badge-yellow { background-color: var(--yellow-bg); color: var(--yellow-glow); }
        .parlay-selections { list-style: none; font-size: 0.9rem; }
        .parlay-selections li { margin-bottom: 0.6rem; padding-left: 1.2rem; position: relative; }
        .parlay-selections li::before { content: "•"; position: absolute; left: 0; color: var(--text-secondary); }
        .parlay-selections li.hit::before { content: "✓"; color: var(--green-glow); font-weight: bold; }
        .parlay-selections li.miss::before { content: "✗"; color: var(--red-glow); font-weight: bold; }
        .table-container {
            background: var(--bg-card);
            backdrop-filter: blur(10px);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            overflow-x: auto;
            margin-bottom: 2rem;
        }
        table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem; }
        th {
            background-color: rgba(15, 23, 42, 0.8);
            padding: 1rem;
            font-weight: 600;
            color: var(--text-secondary);
            border-bottom: 1px solid var(--border-color);
            text-transform: uppercase;
            font-size: 0.75rem;
            letter-spacing: 0.5px;
        }
        td { padding: 1rem; border-bottom: 1px solid var(--border-color); vertical-align: middle; }
        tr:hover td { background-color: rgba(255, 255, 255, 0.02); }
        .match-info { display: flex; flex-direction: column; }
        .match-teams { font-weight: 600; color: var(--text-primary); }
        .match-league { font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.2rem; }
        .rule-badge {
            background-color: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-color);
            padding: 0.25rem 0.5rem;
            border-radius: 6px;
            font-size: 0.8rem;
            font-weight: 500;
            display: inline-block;
        }
        .result-box {
            background-color: rgba(15, 23, 42, 0.6);
            padding: 0.4rem 0.6rem;
            border-radius: 8px;
            font-weight: 700;
            display: inline-block;
            text-align: center;
            border: 1px solid var(--border-color);
        }
        .ai-verdict { display: flex; flex-direction: column; gap: 0.3rem; min-width: 140px; }
        .ai-pick { font-weight: 600; font-size: 0.85rem; }
        .ai-conf { font-size: 0.75rem; color: var(--text-secondary); }
        .status-pill {
            display: inline-flex;
            align-items: center;
            gap: 0.3rem;
            font-size: 0.75rem;
            font-weight: 700;
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            text-transform: uppercase;
        }
        .status-green { background-color: var(--green-bg); color: var(--green-glow); }
        .status-red { background-color: var(--red-bg); color: var(--red-glow); }
        .status-yellow { background-color: var(--yellow-bg); color: var(--yellow-glow); }
        .status-gray { background-color: rgba(255, 255, 255, 0.08); color: var(--text-secondary); }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div>
                <h1>Dashboard de Rendimiento - Alertas en Vivo</h1>
                <p style="color: var(--text-secondary); margin-top: 0.3rem;">Resumen Comparativo de Inteligencia Artificial Dual</p>
            </div>
            <div class="date-badge">${dateLabelClean}</div>
        </header>
        <div class="stats-grid">
            <div class="card">
                <div class="card-title">📊 Total Alertas en Vivo</div>
                <div class="card-value">${totalAlerts}</div>
                <div class="card-desc">Registradas ayer en el canal</div>
            </div>
            <div class="card gemini-card">
                <div class="card-title">♊ Google Gemini</div>
                <div class="card-value gemini-text">${geminiEff}%</div>
                <div class="card-desc">Efectividad: <span class="highlight-green">${geminiGreen} G</span> / ${geminiRed} R / <span>${geminiAvoided} E</span></div>
            </div>
            <div class="card deepseek-card">
                <div class="card-title">🐳 DeepSeek</div>
                <div class="card-value deepseek-text">${dsEff}%</div>
                <div class="card-desc">Efectividad: <span class="highlight-green">${dsGreen} G</span> / ${dsRed} R</div>
            </div>
            <div class="card">
                <div class="card-title">💰 Balance Operado (Gemini)</div>
                <div class="card-value ${geminiGreen >= geminiRed ? 'highlight-green' : 'status-red'}">
                    ${geminiGreen >= geminiRed ? '+' : ''}${geminiGreen - geminiRed} U
                </div>
                <div class="card-desc">Unidades netas estimadas (Apuestas recomendadas)</div>
            </div>
        </div>
        <div class="insights-section">
            <div class="section-title">🔍 Patrones de Frecuencia y Efectividad de la Operación</div>
            <div class="insights-grid">
                <div class="insight-block">
                    <h3 style="font-size: 1.1rem; color: var(--accent-gemini); margin-bottom: 0.5rem;">📈 Frecuencia de Reglas Utilizadas</h3>
                    ${rulesHtml}
                </div>
                <div class="insight-block">
                    <h3 style="font-size: 1.1rem; color: var(--green-glow); margin-bottom: 0.5rem;">🎯 Efectividad por Tipo de Apuesta</h3>
                    ${marketsHtml}
                </div>
            </div>
        </div>
        <div class="parlays-section">
            <div class="section-title">🏆 Parlays del Día de la IA (Pre-Partido)</div>
            <div class="parlays-grid">
                ${parlaysHtml}
            </div>
        </div>
        <h2 class="section-title" style="margin-bottom: 1rem;">⚽ Detalle de Alertas en Vivo y Resultados</h2>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Hora / Liga</th>
                        <th>Partido / Marcador Alerta</th>
                        <th>Regla</th>
                        <th>Marcador Final</th>
                        <th>Pronóstico Gemini (IA 1)</th>
                        <th>Pronóstico DeepSeek (IA 2)</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>
    </div>
</body>
</html>`;

    fs.writeFileSync(targetFilePath, htmlContent, 'utf8');
    console.log(`[alertsHistory] Reporte HTML generado dinámicamente en: ${targetFilePath}`);
}

async function sendDailySummaryToTelegram(bot, chatId) {
    console.log(`[alertsHistory] Iniciando envío de resumen diario a las 11:00 AM al chat ${chatId}...`);
    
    try {
        // 1. Resolver parlays de ayer
        await resolveYesterdayParlays();
    } catch (e) {
        console.error('[alertsHistory] Falló la resolución de parlays de ayer en el envío:', e.message);
    }

    const yesterdayStr = getYesterdayDateString();
    const data = loadHistory();
    const dayAlerts = data.alerts.filter(a => a.date === yesterdayStr);
    const dayParlays = data.parlays.filter(p => p.date === yesterdayStr);

    if (dayAlerts.length === 0 && dayParlays.length === 0) {
        const msg = `☀️ *RESUMEN DE RENDIMIENTO DIARIO*\n📅 *Fecha:* ${yesterdayStr}\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚠️ Ayer no se registraron alertas en vivo ni parlays en el canal.`;
        await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
        return;
    }

    // Calcular estadísticas de alertas en vivo
    const totalAlerts = dayAlerts.length;
    const geminiOperated = dayAlerts.filter(a => !a.isOmitted);
    const geminiGreen = geminiOperated.filter(a => a.geminiStatus === 'GREEN').length;
    const geminiRed = geminiOperated.filter(a => a.geminiStatus === 'RED').length;
    const geminiAvoided = dayAlerts.filter(a => a.isOmitted).length;
    const geminiEff = geminiOperated.length > 0 ? ((geminiGreen / geminiOperated.length) * 100).toFixed(2) : '0.00';

    const dsGreen = dayAlerts.filter(a => a.deepseekStatus === 'GREEN').length;
    const dsRed = dayAlerts.filter(a => a.deepseekStatus === 'RED').length;
    const dsEff = totalAlerts > 0 ? ((dsGreen / totalAlerts) * 100).toFixed(2) : '0.00';

    // Determinar la regla más frecuente
    const ruleCounts = {};
    dayAlerts.forEach(a => {
        const name = a.ruleName.split(':')[0].trim();
        ruleCounts[name] = (ruleCounts[name] || 0) + 1;
    });
    let topRule = 'Ninguna';
    let topRuleCount = 0;
    for (const [r, count] of Object.entries(ruleCounts)) {
        if (count > topRuleCount) {
            topRule = r;
            topRuleCount = count;
        }
    }

    // Determinar el mercado más frecuente
    const classifyMarket = (rec) => {
        const text = rec.toLowerCase();
        if (text.includes('victoria') || text.includes('gana') || text.includes('ml') || text.includes('línea de dinero')) return 'Victoria Directa';
        if (text.includes('goles') || text.includes('over') || text.includes('under') || text.includes('más de')) {
            if (text.includes('tarjetas')) return 'Tarjetas';
            return 'Línea de Goles';
        }
        if (text.includes('próximo gol') || text.includes('siguiente gol')) return 'Próximo Gol';
        if (text.includes('doble oportunidad') || text.includes('doble chance')) return 'Doble Oportunidad';
        if (text.includes('tarjeta')) return 'Tarjetas';
        if (text.includes('córner')) return 'Córneres';
        return 'Otros';
    };

    const marketStats = {};
    dayAlerts.forEach(a => {
        if (a.geminiStatus !== 'PENDING' && a.geminiStatus !== 'AVOIDED') {
            const m = classifyMarket(a.geminiRec);
            if (!marketStats[m]) marketStats[m] = { name: m, count: 0, green: 0 };
            marketStats[m].count++;
            if (a.geminiStatus === 'GREEN') marketStats[m].green++;
        }
        if (a.deepseekStatus !== 'PENDING') {
            const m = classifyMarket(a.deepseekRec);
            if (!marketStats[m]) marketStats[m] = { name: m, count: 0, green: 0 };
            marketStats[m].count++;
            if (a.deepseekStatus === 'GREEN') marketStats[m].green++;
        }
    });

    let topMarket = 'Ninguno';
    let topMarketCount = 0;
    let topMarketEff = '0.00';
    for (const [m, stat] of Object.entries(marketStats)) {
        if (stat.count > topMarketCount) {
            topMarket = m;
            topMarketCount = stat.count;
            topMarketEff = ((stat.green / stat.count) * 100).toFixed(2);
        }
    }

    // Parlays Texto
    let parlaysSummary = '';
    if (dayParlays.length > 0) {
        parlaysSummary = `\n🏆 *Parlays Pre-Partido de Ayer:*\n`;
        dayParlays.forEach(p => {
            const icon = p.status === 'GREEN' ? '🟩' : (p.status === 'PENDING' ? '⏳' : '🟥');
            parlaysSummary += `• Parlay ${p.time}: *${p.status}* ${icon}\n_${p.resultExplanation || 'Sin explicación disponible'}\n`;
        });
    }

    const reportPath = path.join(__dirname, 'resumen_ayer.html');
    
    // Generar el HTML interactivo correspondiente a ayer
    generateHtmlReport(yesterdayStr, reportPath);

    // Formatear mensaje para Telegram
    const msg = `☀️ *RESUMEN DE RENDIMIENTO DIARIO*
📅 *Fecha:* ${yesterdayStr} (Cierre de Ayer)
━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 *Alertas en Vivo Emitidas:* ${totalAlerts}

♊ *Google Gemini (IA 1):*
• 🎯 *Efectividad:* *${geminiEff}%*
• 🟩 *GREEN:* ${geminiGreen} | 🟥 *RED:* ${geminiRed} | ⚪ *Evitadas:* ${geminiAvoided}

🐳 *DeepSeek (IA 2):*
• 🎯 *Efectividad:* *${dsEff}%*
• 🟩 *GREEN:* ${dsGreen} | 🟥 *RED:* ${dsRed}

━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 *Insights de Patrones:*
• 📈 *Regla más frecuente:* *${topRule}* (${topRuleCount} alertas)
• 🎯 *Apuesta más frecuente:* *${topMarket}* (${topMarketCount} recomendaciones, *${topMarketEff}%* de efectividad)
${parlaysSummary}
━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Adjuntamos el dashboard interactivo en HTML con el desglose completo de partidos. ¡Descárgalo y ábrelo en tu navegador!`;

    // Enviar el mensaje de texto por Telegram
    await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });

    // Enviar el archivo resumen_ayer.html adjunto
    if (fs.existsSync(reportPath)) {
        try {
            await bot.sendDocument(chatId, fs.createReadStream(reportPath), {
                filename: `Reporte_Rendimiento_${yesterdayStr}.html`,
                caption: `📊 Reporte Interactivo - ${yesterdayStr}`
            });
            console.log(`[alertsHistory] Reporte HTML enviado adjunto con éxito.`);
        } catch (docError) {
            console.error('[alertsHistory] Error enviando archivo HTML adjunto:', docError.message);
        }
    }
}

module.exports = {
    addAlert,
    addDailyParlay,
    updateAlertVerdict,
    resolveYesterdayParlays,
    generateHtmlReport,
    sendDailySummaryToTelegram
};
