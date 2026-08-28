const path = require('path');
const fs = require('fs');
const { getDb, getConfig, setConfig } = require('./db');

const TRACKER_FILE = path.join(__dirname, 'financial_tracker.json');
const TRACKER_FILE_BAK = path.join(__dirname, 'financial_tracker.json.bak');

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

// Inicialización y migración automática desde financial_tracker.json
function initTracker() {
    const db = getDb();
    
    // Inicializar configuración predeterminada si no existe
    let startDate = getConfig('startDate');
    if (!startDate) {
        startDate = getPreviousSundayDateString();
        setConfig('startDate', startDate);
    }
    if (getConfig('initialBalance') === null) {
        setConfig('initialBalance', 5000);
    }
    if (getConfig('stakeAmount') === null) {
        setConfig('stakeAmount', 250);
    }

    // Migración automática si existe financial_tracker.json
    if (fs.existsSync(TRACKER_FILE)) {
        try {
            console.log('[FinancialTracker] Archivo financial_tracker.json detectado. Iniciando migración a SQLite...');
            const content = fs.readFileSync(TRACKER_FILE, 'utf8');
            const data = JSON.parse(content);

            if (data.startDate) setConfig('startDate', data.startDate);
            if (data.initialBalance !== undefined) setConfig('initialBalance', data.initialBalance);
            if (data.stakeAmount !== undefined) setConfig('stakeAmount', data.stakeAmount);

            if (Array.isArray(data.plays) && data.plays.length > 0) {
                const insertStmt = db.prepare(`
                    INSERT OR IGNORE INTO plays (
                        fixture_id, date, home, away, recommendation, suggested_odd,
                        stake, status, profit, rule_name, explanation, score,
                        resolved_via, metadata_json, timestamp
                    ) VALUES (
                        @fixture_id, @date, @home, @away, @recommendation, @suggested_odd,
                        @stake, @status, @profit, @rule_name, @explanation, @score,
                        @resolved_via, @metadata_json, @timestamp
                    )
                `);

                const insertMany = db.transaction((plays) => {
                    let imported = 0;
                    for (const p of plays) {
                        const info = insertStmt.run({
                            fixture_id: p.fixtureId || p.fixture_id,
                            date: p.date || getLocalDateString(),
                            home: p.home,
                            away: p.away,
                            recommendation: p.recommendation,
                            suggested_odd: p.suggestedOdd || p.suggested_odd || 1.60,
                            stake: p.stake || 250,
                            status: p.status || 'PENDING',
                            profit: p.profit || 0,
                            rule_name: p.ruleName || p.rule_name,
                            explanation: p.explanation || null,
                            score: p.score || null,
                            resolved_via: p.resolvedVia || p.resolved_via || null,
                            metadata_json: p.metadata ? JSON.stringify(p.metadata) : null,
                            timestamp: p.timestamp || Date.now()
                        });
                        if (info.changes > 0) imported++;
                    }
                    return imported;
                });

                const totalImported = insertMany(data.plays);
                console.log(`[FinancialTracker] Migración completada con éxito. ${totalImported} jugadas importadas.`);
            }

            // Respaldar archivo JSON
            fs.renameSync(TRACKER_FILE, TRACKER_FILE_BAK);
            console.log(`[FinancialTracker] Archivo JSON respaldado como: ${TRACKER_FILE_BAK}`);
        } catch (migError) {
            console.error('[FinancialTracker] Error durante la migración de JSON a SQLite:', migError.message);
        }
    }
}

// Ejecutar inicialización al cargar el módulo
initTracker();

// Helper para mapear fila de SQLite a objeto JS
function mapRowToPlay(row) {
    if (!row) return null;
    let metadata = null;
    if (row.metadata_json) {
        try {
            metadata = JSON.parse(row.metadata_json);
        } catch {
            metadata = {};
        }
    }
    return {
        id: row.id,
        fixtureId: row.fixture_id,
        date: row.date,
        home: row.home,
        away: row.away,
        recommendation: row.recommendation,
        suggestedOdd: row.suggested_odd,
        stake: row.stake,
        status: row.status,
        profit: row.profit,
        ruleName: row.rule_name,
        explanation: row.explanation,
        score: row.score,
        resolvedVia: row.resolved_via,
        metadata: metadata,
        timestamp: row.timestamp
    };
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
    const db = getDb();
    
    // Evitar registrar duplicados de la misma alerta para el mismo partido
    const existing = db.prepare('SELECT id FROM plays WHERE fixture_id = ? AND rule_name = ?').get(fixtureId, ruleName);
    if (existing) {
        console.log(`[FinancialTracker] La jugada para el fixture ${fixtureId} (${ruleName}) ya está registrada en SQLite.`);
        return;
    }

    const cleanedOdd = parseOdd(suggestedOdd);
    const stakeAmount = getConfig('stakeAmount', 250);
    const dateStr = getLocalDateString();
    const metaStr = metadata ? JSON.stringify(metadata) : null;
    const now = Date.now();

    try {
        db.prepare(`
            INSERT INTO plays (
                fixture_id, date, home, away, recommendation, suggested_odd,
                stake, status, profit, rule_name, metadata_json, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', 0, ?, ?, ?)
        `).run(fixtureId, dateStr, home, away, recommendation, cleanedOdd, stakeAmount, ruleName, metaStr, now);

        console.log(`[FinancialTracker] Jugada registrada en SQLite: ${home} vs ${away} - Regla: ${ruleName} - Momio: @${cleanedOdd}`);
    } catch (error) {
        console.error(`[FinancialTracker] Error al registrar jugada en SQLite:`, error.message);
    }
}

// Actualiza el veredicto en tiempo real al recibirse la confirmación de la API
function updatePlayVerdict(fixtureId, ruleName, isGreen, isOmitted) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM plays WHERE fixture_id = ? AND rule_name = ?').get(fixtureId, ruleName);
    
    if (!row) {
        console.warn(`[FinancialTracker] No se encontró jugada registrada para el fixture ${fixtureId} (${ruleName}) al actualizar veredicto.`);
        return;
    }

    // Si ya fue resuelta previamente, evitamos sobrescribir
    if (row.status !== 'PENDING') {
        console.log(`[FinancialTracker] Jugada ${fixtureId} (${ruleName}) ya resuelta previamente como ${row.status}.`);
        return;
    }

    let status = 'PENDING';
    let profit = 0;
    let explanation = '';

    if (isOmitted) {
        status = 'AVOIDED';
        profit = 0;
        explanation = 'Alerta identificada con alto riesgo por la IA. Se recomendó EVITAR la operación.';
    } else {
        status = isGreen ? 'GREEN' : 'RED';
        profit = isGreen ? parseFloat((row.stake * (row.suggested_odd - 1)).toFixed(2)) : -row.stake;
        explanation = isGreen ? 'Ganada (veredicto API fútbol).' : 'Perdida (veredicto API fútbol).';
    }

    try {
        db.prepare(`
            UPDATE plays
            SET status = ?, profit = ?, explanation = ?, resolved_via = 'api_live', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(status, profit, explanation, row.id);

        console.log(`[FinancialTracker] Veredicto en vivo actualizado para ${row.home} vs ${row.away} (${ruleName}): ${status} (Profit: ${profit})`);
    } catch (error) {
        console.error(`[FinancialTracker] Error actualizando veredicto en SQLite:`, error.message);
    }
}

// Actualiza los metadatos de una jugada pendiente (útil para guardar correcciones de VAR)
function updatePlayMetadata(fixtureId, ruleName, updatedMetadata) {
    const db = getDb();
    try {
        const row = db.prepare('SELECT id, metadata_json FROM plays WHERE fixture_id = ? AND rule_name = ?').get(fixtureId, ruleName);
        if (!row) {
            console.warn(`[FinancialTracker] No se encontró jugada registrada para el fixture ${fixtureId} (${ruleName}) al actualizar metadatos.`);
            return;
        }

        let currentMeta = {};
        if (row.metadata_json) {
            try {
                currentMeta = JSON.parse(row.metadata_json);
            } catch {
                currentMeta = {};
            }
        }

        const mergedMeta = { ...currentMeta, ...updatedMetadata };
        db.prepare(`
            UPDATE plays
            SET metadata_json = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(JSON.stringify(mergedMeta), row.id);

        console.log(`[FinancialTracker] Metadatos actualizados en SQLite para el fixture ${fixtureId} (${ruleName}).`);
    } catch (e) {
        console.error('[FinancialTracker] Error al actualizar metadatos de la jugada:', e.message);
    }
}

// Obtiene todas las jugadas en estado PENDING
function getPendingPlays() {
    const db = getDb();
    try {
        const rows = db.prepare("SELECT * FROM plays WHERE status = 'PENDING'").all();
        return rows.map(mapRowToPlay);
    } catch (e) {
        console.error('[FinancialTracker] Error al obtener jugadas pendientes de SQLite:', e.message);
        return [];
    }
}

// Resuelve jugadas pendientes mediante la API o búsqueda web de Gemini como contingencia
async function resolvePendingPlays() {
    const { getMatchById, getMatchEvents, getMatchStatistics } = require('./apiClient');
    const { evaluateAlertResults } = require('./rulesEngine');
    const aiService = require('./aiService');
    const db = getDb();

    const pendingPlays = getPendingPlays();
    if (pendingPlays.length === 0) {
        console.log('[FinancialTracker] No hay jugadas pendientes por resolver en SQLite.');
        return;
    }

    console.log(`[FinancialTracker] Iniciando resolución de ${pendingPlays.length} jugadas pendientes...`);

    const updateStmt = db.prepare(`
        UPDATE plays
        SET status = ?, profit = ?, explanation = ?, score = ?, resolved_via = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `);

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
                        let finalStatus = 'PENDING';
                        let profit = 0;

                        if (result.isOmitted) {
                            finalStatus = 'AVOIDED';
                            profit = 0;
                        } else {
                            finalStatus = result.isGreen ? 'GREEN' : 'RED';
                            profit = result.isGreen ? parseFloat((play.stake * (play.suggestedOdd - 1)).toFixed(2)) : -play.stake;
                        }
                        const explanation = result.explanation || 'Resuelto mediante API de fútbol.';
                        const score = `${matchData.goals.home}-${matchData.goals.away}`;
                        
                        updateStmt.run(finalStatus, profit, explanation, score, 'api_batch', play.id);
                        resolved = true;
                        console.log(`[FinancialTracker] Resuelto vía API: ${play.home} vs ${play.away} (${finalStatus}, Marcador: ${score})`);
                    }
                } else if (['CANC', 'PST', 'ABD', 'AWD', 'WO', 'SUSP', 'INT'].includes(status)) {
                    const explanation = `Partido cancelado o suspendido (${status}).`;
                    updateStmt.run('CANCELLED', 0, explanation, null, 'api_batch', play.id);
                    resolved = true;
                    console.log(`[FinancialTracker] Cancelado vía API: ${play.home} vs ${play.away}`);
                }
            }
        } catch (apiError) {
            console.error(`[FinancialTracker] Falló resolución vía API para ${play.fixtureId}:`, apiError.message);
        }

        // 2. Si la API falló o no tiene datos de finalización, resolver veredicto vía DeepSeek / Gemini Web
        if (!resolved) {
            try {
                console.log(`[FinancialTracker] API sin datos finales para ${play.fixtureId}. Intentando resolución vía DeepSeek...`);
                const webResult = await aiService.resolveVerdictViaWeb(
                    'football',
                    play.home,
                    play.away,
                    play.date,
                    play.recommendation
                );

                if (webResult) {
                    let finalStatus = 'RED';
                    let profit = -play.stake;

                    if (webResult.outcome === 'GREEN') {
                        finalStatus = 'GREEN';
                        profit = parseFloat((play.stake * (play.suggestedOdd - 1)).toFixed(2));
                    } else if (webResult.outcome === 'RED') {
                        finalStatus = 'RED';
                        profit = -play.stake;
                    } else if (webResult.outcome === 'CANCELLED') {
                        finalStatus = 'CANCELLED';
                        profit = 0;
                    }

                    const explanation = webResult.explanation || 'Resuelto mediante búsqueda web de IA.';
                    const score = webResult.score || 'N/D';

                    updateStmt.run(finalStatus, profit, explanation, score, 'web', play.id);
                    resolved = true;
                    console.log(`[FinancialTracker] Resuelto vía Web: ${play.home} vs ${play.away} (${finalStatus}, Marcador: ${score})`);
                }
            } catch (webError) {
                console.error(`[FinancialTracker] Falló resolución web para ${play.fixtureId}:`, webError.message);
            }
        }
    }
}

// Obtiene los datos agrupados para el reporte financiero
function getReportData() {
    const db = getDb();
    const yesterdayStr = getYesterdayDateString();
    const startDateStr = getConfig('startDate', getPreviousSundayDateString());
    const initialBalance = Number(getConfig('initialBalance', 5000));
    const stakeAmount = Number(getConfig('stakeAmount', 250));

    // Estadísticas de ayer
    const yesterdayStats = db.prepare(`
        SELECT 
            SUM(CASE WHEN status = 'GREEN' THEN 1 ELSE 0 END) as greenCount,
            SUM(CASE WHEN status = 'RED' THEN 1 ELSE 0 END) as redCount,
            SUM(profit) as totalProfit
        FROM plays 
        WHERE date = ? AND status IN ('GREEN', 'RED')
    `).get(yesterdayStr);

    const yesterdayGreen = yesterdayStats.greenCount || 0;
    const yesterdayRed = yesterdayStats.redCount || 0;
    const yesterdayProfit = parseFloat((yesterdayStats.totalProfit || 0).toFixed(2));
    const yesterdayTotal = yesterdayGreen + yesterdayRed;
    const yesterdayEff = yesterdayTotal > 0 ? (yesterdayGreen / yesterdayTotal) * 100 : 0;

    // Estadísticas acumuladas desde startDate hasta ayer
    const accumStats = db.prepare(`
        SELECT 
            SUM(CASE WHEN status = 'GREEN' THEN 1 ELSE 0 END) as greenCount,
            SUM(CASE WHEN status = 'RED' THEN 1 ELSE 0 END) as redCount,
            SUM(profit) as totalProfit
        FROM plays 
        WHERE date >= ? AND date <= ? AND status IN ('GREEN', 'RED')
    `).get(startDateStr, yesterdayStr);

    const accumGreen = accumStats.greenCount || 0;
    const accumRed = accumStats.redCount || 0;
    const accumProfit = parseFloat((accumStats.totalProfit || 0).toFixed(2));
    const accumTotal = accumGreen + accumRed;
    const accumEff = accumTotal > 0 ? (accumGreen / accumTotal) * 100 : 0;

    const currentCapital = parseFloat((initialBalance + accumProfit).toFixed(2));

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
        initialBalance,
        stakeAmount
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
    updatePlayMetadata,
    resolvePendingPlays,
    getReportData,
    sendDailyReport,
    getLocalDateString,
    getYesterdayDateString,
    getPreviousSundayDateString,
    getPendingPlays,
    initTracker
};
