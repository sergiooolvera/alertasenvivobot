const path = require('path');
const fs = require('fs');

const TRACKER_FILE = path.join(__dirname, 'financial_tracker.json');

// Helper para obtener fecha local YYYY-MM-DD
function getLocalDateString(date = new Date()) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Mexico_City',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    return `${year}-${month}-${day}`;
}

// Helper para obtener ayer local YYYY-MM-DD
function getYesterdayDateString() {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return getLocalDateString(yesterday);
}

// Helper para obtener el domingo anterior más cercano (o el mismo día si es domingo)
function getPreviousSundayDateString() {
    const now = new Date();
    const localStr = getLocalDateString(now);
    const [year, month, day] = localStr.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    const dayOfWeek = localDate.getDay(); // 0: Domingo, 1: Lunes, etc.
    localDate.setDate(localDate.getDate() - dayOfWeek);
    
    const y = localDate.getFullYear();
    const m = String(localDate.getMonth() + 1).padStart(2, '0');
    const d = String(localDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// Carga las jugadas y datos desde el disco
function loadData() {
    if (!fs.existsSync(TRACKER_FILE)) {
        const sunday = getPreviousSundayDateString();
        const initialData = {
            startDate: sunday,
            initialBalance: 5000,
            stakeAmount: 250,
            plays: []
        };
        saveData(initialData);
        return initialData;
    }
    try {
        const content = fs.readFileSync(TRACKER_FILE, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error('[FinancialTracker] Error leyendo JSON, retornando valores iniciales:', error.message);
        return {
            startDate: getPreviousSundayDateString(),
            initialBalance: 5000,
            stakeAmount: 250,
            plays: []
        };
    }
}

// Guarda las jugadas y datos en el disco
function saveData(data) {
    try {
        fs.writeFileSync(TRACKER_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error('[FinancialTracker] Error escribiendo JSON:', error.message);
    }
}

// Limpia y parsea el momio a tipo Float
function parseOdd(oddInput) {
    if (typeof oddInput === 'number') return oddInput;
    if (typeof oddInput !== 'string') return 1.60;
    let cleaned = oddInput.replace(/[@\s]/g, '').trim();
    const match = cleaned.match(/(\d+\.\d+|\d+)/);
    if (match) {
        const val = parseFloat(match[1]);
        return isNaN(val) ? 1.60 : val;
    }
    return 1.60;
}

// Agrega una nueva jugada
function addPlay({ fixtureId, home, away, recommendation, suggestedOdd, ruleName, metadata }) {
    const data = loadData();
    
    // Evitar registrar duplicados de la misma alerta para el mismo partido
    const exists = data.plays.some(p => p.fixtureId === fixtureId && p.ruleName === ruleName);
    if (exists) {
        console.log(`[FinancialTracker] La jugada para el fixture ${fixtureId} (${ruleName}) ya está registrada.`);
        return;
    }

    const cleanedOdd = parseOdd(suggestedOdd);
    
    const newPlay = {
        fixtureId,
        date: getLocalDateString(),
        home,
        away,
        recommendation,
        suggestedOdd: cleanedOdd,
        stake: data.stakeAmount,
        status: 'PENDING',
        profit: 0,
        ruleName,
        metadata,
        timestamp: Date.now()
    };

    data.plays.push(newPlay);
    saveData(data);
    console.log(`[FinancialTracker] Jugada registrada: ${home} vs ${away} - Regla: ${ruleName} - Momio: @${cleanedOdd}`);
}

// Actualiza el veredicto en tiempo real al recibirse la confirmación de la API
function updatePlayVerdict(fixtureId, ruleName, isGreen, isOmitted) {
    const data = loadData();
    const play = data.plays.find(p => p.fixtureId === fixtureId && p.ruleName === ruleName);
    if (!play) {
        console.warn(`[FinancialTracker] No se encontró jugada registrada para el fixture ${fixtureId} (${ruleName}) al actualizar veredicto.`);
        return;
    }

    // Si ya fue resuelta previamente, evitamos sobrescribir
    if (play.status !== 'PENDING') {
        console.log(`[FinancialTracker] Jugada ${fixtureId} (${ruleName}) ya resuelta previamente como ${play.status}.`);
        return;
    }

    if (isOmitted) {
        play.status = 'AVOIDED';
        play.profit = 0;
        play.explanation = 'Alerta identificada con alto riesgo por la IA. Se recomendó EVITAR la operación.';
    } else {
        play.status = isGreen ? 'GREEN' : 'RED';
        play.profit = isGreen ? parseFloat((play.stake * (play.suggestedOdd - 1)).toFixed(2)) : -play.stake;
        play.explanation = isGreen ? 'Ganada (veredicto API fútbol).' : 'Perdida (veredicto API fútbol).';
    }
    play.resolvedVia = 'api_live';

    saveData(data);
    console.log(`[FinancialTracker] Veredicto en vivo actualizado para ${play.home} vs ${play.away} (${ruleName}): ${play.status} (Profit: ${play.profit})`);
}

// Resuelve jugadas pendientes mediante la API o búsqueda web de Gemini como contingencia
async function resolvePendingPlays() {
    // Módulos requeridos para llamadas
    const { getMatchById, getMatchEvents, getMatchStatistics } = require('./apiClient');
    const { evaluateAlertResults } = require('./rulesEngine');
    const aiService = require('./aiService');

    const data = loadData();
    const pendingPlays = data.plays.filter(p => p.status === 'PENDING');
    if (pendingPlays.length === 0) {
        console.log('[FinancialTracker] No hay jugadas pendientes por resolver.');
        return;
    }

    console.log(`[FinancialTracker] Iniciando resolución de ${pendingPlays.length} jugadas pendientes...`);

    for (const play of pendingPlays) {
        let resolved = false;

        // 1. Intentar resolver mediante la API
        try {
            console.log(`[FinancialTracker] Intentando resolver vía API para el fixture ${play.fixtureId}...`);
            const matchData = await getMatchById(play.fixtureId);
            if (matchData) {
                const status = matchData.fixture.status.short;
                if (['FT', 'AET', 'PEN'].includes(status)) {
                    const finalEvents = await getMatchEvents(play.fixtureId);
                    const finalStats = await getMatchStatistics(play.fixtureId);

                    const results = await evaluateAlertResults([play.metadata], matchData, finalEvents, finalStats);
                    if (results && results.length > 0) {
                        const result = results[0];
                        if (result.isOmitted) {
                            play.status = 'AVOIDED';
                            play.profit = 0;
                        } else {
                            play.status = result.isGreen ? 'GREEN' : 'RED';
                            play.profit = result.isGreen ? parseFloat((play.stake * (play.suggestedOdd - 1)).toFixed(2)) : -play.stake;
                        }
                        play.explanation = result.explanation || 'Resuelto mediante API de fútbol.';
                        play.score = `${matchData.goals.home}-${matchData.goals.away}`;
                        play.resolvedVia = 'api_batch';
                        resolved = true;
                        console.log(`[FinancialTracker] Resuelto vía API: ${play.home} vs ${play.away} (${play.status}, Marcador: ${play.score})`);
                    }
                } else if (['CANC', 'PST', 'ABD', 'AWD', 'WO', 'SUSP', 'INT'].includes(status)) {
                    play.status = 'CANCELLED';
                    play.profit = 0;
                    play.explanation = `Partido cancelado o suspendido (${status}).`;
                    play.resolvedVia = 'api_batch';
                    resolved = true;
                    console.log(`[FinancialTracker] Cancelado vía API: ${play.home} vs ${play.away}`);
                }
            }
        } catch (apiError) {
            console.error(`[FinancialTracker] Falló resolución vía API para ${play.fixtureId}:`, apiError.message);
        }

        // 2. Si la API falló o no tiene datos de finalización, buscar en la web con Gemini Grounding
        if (!resolved) {
            try {
                console.log(`[FinancialTracker] API sin datos finales para ${play.fixtureId}. Intentando búsqueda web vía Gemini...`);
                const webResult = await aiService.resolveVerdictViaWeb(
                    'football',
                    play.home,
                    play.away,
                    play.date,
                    play.recommendation
                );

                if (webResult) {
                    if (webResult.outcome === 'GREEN') {
                        play.status = 'GREEN';
                        play.profit = parseFloat((play.stake * (play.suggestedOdd - 1)).toFixed(2));
                    } else if (webResult.outcome === 'RED') {
                        play.status = 'RED';
                        play.profit = -play.stake;
                    } else if (webResult.outcome === 'CANCELLED') {
                        play.status = 'CANCELLED';
                        play.profit = 0;
                    } else {
                        play.status = 'RED';
                        play.profit = -play.stake;
                    }

                    play.explanation = webResult.explanation || 'Resuelto mediante búsqueda web de IA.';
                    play.score = webResult.score || 'N/D';
                    play.resolvedVia = 'web';
                    resolved = true;
                    console.log(`[FinancialTracker] Resuelto vía Web: ${play.home} vs ${play.away} (${play.status}, Marcador: ${play.score})`);
                }
            } catch (webError) {
                console.error(`[FinancialTracker] Falló resolución web para ${play.fixtureId}:`, webError.message);
            }
        }
    }

    saveData(data);
}

// Obtiene los datos agrupados para el reporte financiero
function getReportData() {
    const data = loadData();
    const yesterdayStr = getYesterdayDateString();
    const startDateStr = data.startDate;

    // Filtrar jugadas de ayer
    const yesterdayPlays = data.plays.filter(p => p.date === yesterdayStr && p.status !== 'PENDING' && p.status !== 'AVOIDED');
    const yesterdayGreen = yesterdayPlays.filter(p => p.status === 'GREEN').length;
    const yesterdayRed = yesterdayPlays.filter(p => p.status === 'RED').length;
    const yesterdayProfit = yesterdayPlays.reduce((sum, p) => sum + p.profit, 0);
    const yesterdayTotal = yesterdayGreen + yesterdayRed;
    const yesterdayEff = yesterdayTotal > 0 ? (yesterdayGreen / yesterdayTotal) * 100 : 0;

    // Filtrar jugadas acumuladas (desde startDate hasta ayer inclusive)
    const accumPlays = data.plays.filter(p => p.date >= startDateStr && p.date <= yesterdayStr && p.status !== 'PENDING' && p.status !== 'AVOIDED');
    const accumGreen = accumPlays.filter(p => p.status === 'GREEN').length;
    const accumRed = accumPlays.filter(p => p.status === 'RED').length;
    const accumProfit = accumPlays.reduce((sum, p) => sum + p.profit, 0);
    const accumTotal = accumGreen + accumRed;
    const accumEff = accumTotal > 0 ? (accumGreen / accumTotal) * 100 : 0;

    const currentCapital = data.initialBalance + accumProfit;

    return {
        yesterdayStr,
        startDateStr,
        yesterdayProfit,
        yesterdayEff,
        yesterdayGreen,
        yesterdayTotal,
        accumProfit,
        accumEff,
        accumGreen,
        accumTotal,
        currentCapital,
        initialBalance: data.initialBalance,
        stakeAmount: data.stakeAmount
    };
}

// Envía el reporte financiero diario a través de Telegram
async function sendDailyReport(bot, subscribedChats) {
    const report = getReportData();
    
    const formatDateSpanish = (dateStr) => {
        try {
            const [year, month, day] = dateStr.split('-');
            const date = new Date(year, month - 1, day);
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            let formatted = new Intl.DateTimeFormat('es-MX', options).format(date);
            return formatted.charAt(0).toUpperCase() + formatted.slice(1);
        } catch (e) {
            return dateStr;
        }
    };

    const yesterdayLabel = formatDateSpanish(report.yesterdayStr);
    const startLabel = formatDateSpanish(report.startDateStr);

    const signYesterday = report.yesterdayProfit >= 0 ? '+' : '';
    const signAccum = report.accumProfit >= 0 ? '+' : '';

    const msg = `☀️ *CONTROL FINANCIERO DIARIO*
📅 *Fecha:* ${yesterdayLabel} (Cierre de Ayer)
━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 *Capital de Inicio:* $${report.initialBalance.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
💵 *Apuesta Fija por Jugada:* $${report.stakeAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN (5%)

📊 *Rendimiento de Ayer:*
• 💰 *Balance:* *${signYesterday}$${report.yesterdayProfit.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN*
• 🎯 *Efectividad:* *${report.yesterdayEff.toFixed(2)}%* (${report.yesterdayGreen}/${report.yesterdayTotal} jugadas)

📈 *Acumulado (Desde el ${startLabel}):*
• 💰 *Balance Acumulado:* *${signAccum}$${report.accumProfit.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN*
• 💼 *Capital Actual:* *$${report.currentCapital.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN*
• 🎯 *Efectividad Total:* *${report.accumEff.toFixed(2)}%* (${report.accumGreen}/${report.accumTotal} jugadas)
━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 ¡Vamos por más jugadas ganadoras hoy! ⚽`;

    for (const chatId of subscribedChats) {
        try {
            await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
        } catch (e) {
            console.error(`[FinancialTracker] Error enviando reporte financiero al chat ${chatId}:`, e.message);
        }
    }
    console.log(`[FinancialTracker] Reporte financiero diario enviado con éxito.`);
}

module.exports = {
    addPlay,
    updatePlayVerdict,
    resolvePendingPlays,
    getReportData,
    sendDailyReport,
    getLocalDateString,
    getYesterdayDateString,
    getPreviousSundayDateString
};
