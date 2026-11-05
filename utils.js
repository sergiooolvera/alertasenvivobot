/**
 * Utilidades compartidas para el sistema de alertas de fútbol.
 */

/**
 * Determina si una tarjeta / expulsión fue fuera del campo (banca, entrenador, cuerpo técnico, suplente o jugador ya sustituido).
 * @param {Object} e - Evento de tarjeta
 * @param {Array} events - Lista completa de eventos del partido
 * @returns {boolean} true si la tarjeta fue fuera del campo, false de lo contrario.
 */
function isOffFieldCard(e, events = []) {
    if (!e) return false;

    const comments = (e.comments || '').toLowerCase();
    const detail = (e.detail || '').toLowerCase();
    const playerName = (e.player && e.player.name ? e.player.name : '').toLowerCase();

    // Palabras clave que indican sanción fuera del campo / banca / cuerpo técnico / suplente
    const offFieldKeywords = [
        'fuera del campo',
        'fuera del terreno',
        'fuera de la cancha',
        'off-pitch',
        'off pitch',
        'off the pitch',
        'off field',
        'off-field',
        'bench',
        'banca',
        'banquillo',
        'coach',
        'entrenador',
        'manager',
        'director tecnico',
        'director técnico',
        'dt',
        'cuerpo tecnico',
        'cuerpo técnico',
        'staff',
        'assistant',
        'asistente',
        'substitute',
        'suplente',
        'reserva'
    ];

    const textToTest = `${comments} ${detail} ${playerName}`;
    const matchesKeyword = offFieldKeywords.some(keyword => textToTest.includes(keyword));
    if (matchesKeyword) return true;

    // Verificar si el jugador ya había sido sustituido (salió del campo) antes o en el mismo minuto
    if (e.player && (e.player.id || e.player.name) && Array.isArray(events) && events.length > 0) {
        const cardTime = (e.time && typeof e.time.elapsed === 'number') ? e.time.elapsed : 999;
        const isSubbedOut = events.some(sub => {
            if (sub.type !== 'Subst') return false;
            const subTime = (sub.time && typeof sub.time.elapsed === 'number') ? sub.time.elapsed : 0;
            if (subTime > cardTime) return false; // La sustitución fue posterior a la tarjeta
            
            // sub.player es el jugador que sale de la cancha
            if (e.player.id && sub.player && sub.player.id) {
                return e.player.id === sub.player.id;
            }
            if (e.player.name && sub.player && sub.player.name) {
                return e.player.name.toLowerCase() === sub.player.name.toLowerCase();
            }
            return false;
        });
        if (isSubbedOut) return true;
    }

    return false;
}

/**
 * Convierte un momio decimal a momio americano tradicional (formato Caliente/Playdoit).
 * @param {number|string} decimalOdd 
 * @returns {string} Ejemplo: "-137", "+150"
 */
function toAmericanOdd(decimalOdd) {
    const odd = parseFloat(decimalOdd);
    if (!odd || isNaN(odd) || odd <= 1.0) return '-';
    if (odd >= 2.0) {
        const american = Math.round((odd - 1) * 100);
        return `+${american}`;
    } else {
        const american = Math.round(-100 / (odd - 1));
        return `${american}`;
    }
}

/**
 * Construye el mensaje formateado como Ticket de Apuesta (estilo Caliente / Casa de Apuestas).
 * Cumple con:
 * - Formato ticket de apuesta estilizado
 * - Cero análisis (sin párrafos redundantes ni justificaciones)
 * - Cero mención a "DEEPSEEK"
 * - Mantiene los enlaces hacia Flashscore (equipos y partido)
 * @param {Object} params
 * @returns {string} Mensaje Markdown listo para Telegram
 */
function buildBetTicketMessage(params) {
    const {
        homeTeam,
        awayTeam,
        leagueName,
        elapsed,
        scoreHome,
        scoreAway,
        recommendation,
        oddVal,
        confidence,
        ruleName,
        isUpdate = false,
        updateReason = '',
        stakeAmount = 500
    } = params;

    const matchSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(homeTeam + ' vs ' + awayTeam + ' Flashscore')}`;
    const decOdd = parseFloat(oddVal) || 1.60;
    const americanOdd = toAmericanOdd(decOdd);
    const totalReturn = (stakeAmount * decOdd).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const elapsedDisplay = typeof elapsed === 'number' ? `${elapsed}'` : (elapsed || 'En vivo');

    let msg = `⚽ *${homeTeam} vs ${awayTeam}*\n`;
    if (leagueName) {
        msg += `🏆 *Liga:* ${leagueName}\n`;
    }
    msg += `⏱️ *Minuto:* ${elapsedDisplay}  |  📊 *Marcador:* ${scoreHome ?? 0} - ${scoreAway ?? 0}\n`;
    msg += `🔍 *Flashscore:* [Ver Partido en Flashscore](${matchSearchUrl})\n\n`;

    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    if (isUpdate) {
        msg += `🔄 *APUESTA ACTUALIZADA*\n`;
        if (updateReason) msg += `_${updateReason}_\n`;
    }
    msg += `*${recommendation}* ➔ *${americanOdd}*\n`;
    if (ruleName) {
        msg += `_${ruleName}_\n`;
    }
    msg += `${homeTeam} vs. ${awayTeam}  •  Minuto ${elapsedDisplay}\n`;
    msg += `──────────────────────────\n`;
    msg += `Momios / Cuota: *${americanOdd} (@${decOdd.toFixed(2)})*\n`;
    msg += `Apuesta total: *$${stakeAmount.toFixed(2)}*\n`;
    msg += `Ganancia Total: *🟩 $${totalReturn}*\n`;
    if (confidence && confidence !== 'N/D') {
        const confNum = parseInt(confidence, 10);
        if (!isNaN(confNum)) {
            msg += `Confianza: *${confNum}%*\n`;
        }
    }
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    return msg;
}

/**
 * Construye el mensaje formateado como Ticket Parlay.
 * @param {Object} params
 * @returns {string} Mensaje Markdown listo para Telegram
 */
function buildParlayTicketMessage(params) {
    const {
        title = 'TICKET PARLAY EN VIVO',
        badge = '',
        selections = [],
        totalOdd,
        stakeAmount = 500,
        combinedConfidence,
        note = 'Ingresar a la brevedad en tu casa de apuestas.'
    } = params;

    const decOdd = parseFloat(totalOdd) || 1.60;
    const americanOdd = toAmericanOdd(decOdd);
    const stakeUnits = stakeAmount === 250 ? '0.5u' : '1.0u';
    const totalReturn = (stakeAmount * decOdd).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const netProfit = (stakeAmount * (decOdd - 1)).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    let msg = `🎫 ━━━━━━━━━━━━━━━━━━━━━━━ 🎫\n`;
    msg += `        *${title}*\n`;
    if (badge) {
        msg += `${badge}\n`;
    }
    msg += `🎫 ━━━━━━━━━━━━━━━━━━━━━━━ 🎫\n\n`;

    msg += `📋 *SELECCIONES DEL PARLAY:*\n`;
    selections.forEach((sel, idx) => {
        const home = sel.homeTeam || sel.home;
        const away = sel.awayTeam || sel.away;
        const matchSearch = `https://www.google.com/search?q=${encodeURIComponent(home + ' vs ' + away + ' Flashscore')}`;
        const pickOdd = parseFloat(sel.odd || sel.estimatedOdd) || 1.40;
        const pickAmerican = toAmericanOdd(pickOdd);

        msg += `${idx + 1}️⃣ ⚽ *${home} vs ${away}*\n`;
        if (sel.league) {
            msg += `   🏆 *Liga:* ${sel.league}\n`;
        }
        msg += `   👉 *Pick:* *${sel.recommendation || sel.market}* (${pickAmerican} / @${pickOdd.toFixed(2)})\n`;
        msg += `   🔍 *Flashscore:* [Ver Partido](${matchSearch})\n\n`;
    });

    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📊 *DETALLES DEL TICKET:*\n`;
    msg += `📈 *Momio Total Combinado:* ${americanOdd} (@${decOdd.toFixed(2)})\n`;
    msg += `💵 *Apuesta Total:* $${stakeAmount.toFixed(2)} MXN (${stakeUnits})\n`;
    msg += `💰 *Ganancia Total:* $${totalReturn} MXN (+$${netProfit} MXN)\n`;
    if (combinedConfidence) {
        msg += `🔥 *Confianza Combinada:* ${combinedConfidence}%\n`;
    }
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    if (note) {
        msg += `⚠️ *Nota:* ${note}`;
    }

    return msg.trim();
}

module.exports = {
    isOffFieldCard,
    toAmericanOdd,
    buildBetTicketMessage,
    buildParlayTicketMessage
};
