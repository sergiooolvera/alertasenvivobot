const assert = require('assert');
const { toAmericanOdd, buildBetTicketMessage, buildParlayTicketMessage } = require('./utils');

console.log("==================================================================");
console.log("  SUITE DE PRUEBAS: TICKET DE APUESTA & ELIMINACIÓN DE VEREDICTOS ");
console.log("==================================================================\n");

// 1. Verificación de toAmericanOdd
console.log("--- 1. Verificación de conversión de Momios a Formato Americano ---");
assert.strictEqual(toAmericanOdd(1.73), '-137', "1.73 debe convertirse a -137");
assert.strictEqual(toAmericanOdd(1.60), '-167', "1.60 debe convertirse a -167");
assert.strictEqual(toAmericanOdd(1.40), '-250', "1.40 debe convertirse a -250");
assert.strictEqual(toAmericanOdd(2.00), '+100', "2.00 debe convertirse a +100");
assert.strictEqual(toAmericanOdd(2.50), '+150', "2.50 debe convertirse a +150");
console.log("✅ [PASÓ] Conversión correcta de momios decimales a momio americano (+/-).");

// 2. Verificación de buildBetTicketMessage (Ticket Limpio) y buildTicketCaption
console.log("\n--- 2. Verificación de buildBetTicketMessage (Ticket Limpio) y buildTicketCaption ---");
const ticketMsg = buildBetTicketMessage({
    homeTeam: 'Lorient',
    awayTeam: 'Brest',
    leagueName: 'Ligue 1',
    elapsed: 54,
    scoreHome: 0,
    scoreAway: 0,
    recommendation: 'Lorient',
    oddVal: '1.73',
    confidence: '85',
    ruleName: '1x2 Súper Pago Anticipado · Partido',
    stakeAmount: 500
});

console.log("Ticket en texto generado de muestra:\n");
console.log(ticketMsg);
console.log("\n--------------------------------------------------");

const { generateBetTicketImage, buildTicketCaption } = require('./ticketImageService');
const caption = buildTicketCaption({
    homeTeam: 'Lorient',
    awayTeam: 'Brest',
    leagueName: 'Ligue 1',
    elapsed: 54,
    scoreHome: 0,
    scoreAway: 0
});

console.log("Caption de imagen generado de muestra:\n");
console.log(caption);
console.log("\n--------------------------------------------------");

// Validaciones requeridas:
assert(caption.includes('⚽ *Lorient vs Brest*'), "Caption debe tener el partido principal en texto limpio");
assert(!caption.includes('Lorient]('), "Caption NO debe tener link en el nombre del equipo");
assert(!caption.includes('Brest]('), "Caption NO debe tener link en el nombre del equipo");
assert(caption.includes('Flashscore:* [Ver Partido en Flashscore]'), "Caption DEBE tener el enlace único a Flashscore");

assert(ticketMsg.includes('⚽ *Lorient vs Brest*'), "El mensaje de texto no debe tener links en los nombres del partido principal");
assert(ticketMsg.includes('-137 (@1.73)'), "Debe mostrar momio en formato americano y decimal (-137 (@1.73))");
assert(ticketMsg.includes('Apuesta total: *$500.00*'), "Debe mostrar la apuesta total sugerida");
assert(ticketMsg.includes('Ganancia Total: *🟩 $865.00*'), "Debe mostrar el cálculo correcto de la ganancia total");

// Validaciones de exclusión (quitar análisis y la palabra DEEPSEEK):
assert(!ticketMsg.toUpperCase().includes('DEEPSEEK'), "NO debe contener la palabra DEEPSEEK");
assert(!caption.toUpperCase().includes('DEEPSEEK'), "Caption NO debe contener la palabra DEEPSEEK");
assert(!ticketMsg.includes('Análisis:'), "NO debe contener bloque de Análisis");
assert(!ticketMsg.includes('🧠'), "NO debe contener emoji de cerebro");
console.log("✅ [PASÓ] buildBetTicketMessage y buildTicketCaption cumplen al 100% las especificaciones.");

// 3. Verificación de buildParlayTicketMessage
console.log("\n--- 3. Verificación de buildParlayTicketMessage (Ticket Parlay) ---");
const parlayTicket = buildParlayTicketMessage({
    title: 'TICKET PARLAY EN VIVO',
    badge: '🔥 *ALTA CONFIANZA*',
    selections: [
        { home: 'Lorient', away: 'Brest', league: 'Ligue 1', recommendation: 'Over 0.5 Goles', odd: 1.35 },
        { home: 'Real Madrid', away: 'Valencia', league: 'LaLiga', recommendation: 'Victoria Local', odd: 1.60 }
    ],
    totalOdd: 2.16,
    combinedConfidence: 75,
    stakeAmount: 500
});

console.log("Parlay generado de muestra:\n");
console.log(parlayTicket);
console.log("\n--------------------------------------------------");

assert(parlayTicket.includes('TICKET PARLAY EN VIVO'), "Debe incluir encabezado de Ticket Parlay");
assert(parlayTicket.includes('Flashscore'), "Debe incluir links a Flashscore");
assert(parlayTicket.includes('+116 (@2.16)'), "Debe calcular momio americano para parlay (+116)");
assert(!parlayTicket.toUpperCase().includes('DEEPSEEK'), "NO debe contener la palabra DEEPSEEK");
assert(!parlayTicket.includes('Justificación'), "NO debe contener justificaciones ni análisis");
console.log("✅ [PASÓ] buildParlayTicketMessage cumple con el formato ticket.");

// 4. Verificación de ausencia de DEEPSEEK en index.js en strings de envío
console.log("\n--- 4. Verificación en index.js ---");
const fs = require('fs');
const indexContent = fs.readFileSync('./index.js', 'utf8');

assert(!indexContent.includes('ANÁLISIS DE IA - DEEPSEEK'), "index.js no debe tener 'ANÁLISIS DE IA - DEEPSEEK'");
assert(!indexContent.includes('🐳 *DEEPSEEK'), "index.js no debe tener '🐳 *DEEPSEEK'");
assert(!indexContent.includes('DEEPSEEK (RE-ANÁLISIS)'), "index.js no debe tener 'DEEPSEEK (RE-ANÁLISIS)'");

// 5. Verificación de eliminación de envío de veredicto final en index.js
assert(!indexContent.includes('await sendSafeMarkdownMessage(chatId, result.msg)'), "index.js ya NO debe enviar result.msg de veredicto al chat de Telegram");
console.log("✅ [PASÓ] index.js verificado: cero envío de veredictos finales y cero menciones de DEEPSEEK en alertas.");

console.log("\n==================================================================");
console.log("  TODAS LAS PRUEBAS DE LA SUITE PASARON EXITOSAMENTE (5/5) 🎉");
console.log("==================================================================");
