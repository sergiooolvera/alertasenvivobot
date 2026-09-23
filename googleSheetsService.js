const axios = require('axios');

/**
 * Servicio de Integración con Google Sheets.
 * Envía las jugadas en tiempo real y actualiza los resultados nocturnos/post-partido
 * mediante un Webhook de Google Apps Script.
 */

function getWebhookUrl() {
    return process.env.GOOGLE_SHEETS_WEBHOOK_URL || null;
}

/**
 * Envía un pick en vivo a Google Sheets apenas se genera la alerta.
 */
async function sendPickToSheet({
    fixtureId,
    date,
    time,
    league,
    home,
    away,
    ruleName,
    recommendation,
    suggestedOdd,
    stake = 500
}) {
    const webhookUrl = getWebhookUrl();
    if (!webhookUrl) {
        // Modo silencioso si aún no se ha configurado la variable de entorno
        return { success: false, reason: 'GOOGLE_SHEETS_WEBHOOK_URL no configurada' };
    }

    const payload = {
        action: 'add_pick',
        data: {
            fixtureId,
            date: date || new Date().toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' }),
            time: time || new Date().toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour12: false }),
            league: league || 'Fútbol en Vivo',
            match: `${home} vs ${away}`,
            home,
            away,
            ruleName: ruleName || 'Regla General',
            recommendation,
            suggestedOdd: parseFloat(suggestedOdd) || 1.60,
            stake: parseFloat(stake) || 500.00,
            status: 'PENDIENTE',
            timestamp: Date.now()
        }
    };

    try {
        const response = await axios.post(webhookUrl, payload, {
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' }
        });
        console.log(`[GoogleSheets] Pick enviado exitosamente para fixture ${fixtureId} (${home} vs ${away})`);
        return { success: true, data: response.data };
    } catch (error) {
        console.error(`[GoogleSheets] Error enviando pick para fixture ${fixtureId}:`, error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Actualiza el resultado final y beneficio de una jugada en Google Sheets.
 */
async function updateResultInSheet({
    fixtureId,
    ruleName,
    status,
    score,
    profit,
    explanation
}) {
    const webhookUrl = getWebhookUrl();
    if (!webhookUrl) {
        return { success: false, reason: 'GOOGLE_SHEETS_WEBHOOK_URL no configurada' };
    }

    const payload = {
        action: 'update_result',
        data: {
            fixtureId,
            ruleName,
            status: status ? status.toUpperCase() : 'PENDIENTE',
            score: score || 'N/D',
            profit: parseFloat(profit) || 0.00,
            explanation: explanation || ''
        }
    };

    try {
        const response = await axios.post(webhookUrl, payload, {
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' }
        });
        console.log(`[GoogleSheets] Resultado actualizado para fixture ${fixtureId} (${ruleName}): ${status} - Profit: $${profit} MXN`);
        return { success: true, data: response.data };
    } catch (error) {
        console.error(`[GoogleSheets] Error actualizando resultado para fixture ${fixtureId}:`, error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Envío de múltiples jugadas en lote (útil para auditorías o sincronización nocturna).
 */
async function syncBatchToSheet(plays) {
    const webhookUrl = getWebhookUrl();
    if (!webhookUrl || !Array.isArray(plays) || plays.length === 0) {
        return { success: false, reason: 'URL no configurada o lote vacío' };
    }

    const payload = {
        action: 'batch_sync',
        data: { plays }
    };

    try {
        const response = await axios.post(webhookUrl, payload, {
            timeout: 25000,
            headers: { 'Content-Type': 'application/json' }
        });
        console.log(`[GoogleSheets] Lote de ${plays.length} jugadas sincronizado con éxito.`);
        return { success: true, data: response.data };
    } catch (error) {
        console.error(`[GoogleSheets] Error sincronizando lote de jugadas:`, error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    sendPickToSheet,
    updateResultInSheet,
    syncBatchToSheet
};
