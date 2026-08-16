const { evaluateAlertResults } = require('../rulesEngine');

console.log("--- Iniciando Pruebas de Diagnóstico y Corrección de Veredictos (GREEN/RED) ---\n");

// Datos del partido Lens vs PSG para las pruebas
const finalFixtureLensPsg = {
    goals: { home: 1, away: 0 } // Marcador final Lens 1 - 0 PSG
};

// Escenario 1: Fallback a DeepSeek (Gemini falló en la alerta original)
// recomendación DeepSeek: "Siguiente Gol de Paris Saint Germain" (no se cumplió porque quedó 1-0 y al momento de la alerta ya iba 1-0)
const metaDeepseekFallback = {
    ruleId: '2001_rule1',
    ruleType: 1,
    ruleName: 'Tarjeta Roja Estratégica',
    fixtureId: 2001,
    homeTeam: 'Lens',
    awayTeam: 'Paris Saint Germain',
    teamWithRed: 'Lens',
    scoreAtAlert: { home: 1, away: 0 },
    isSent: true,
    aiRecommendation: 'Siguiente Gol de Paris Saint Germain',
    deepseekRecommendation: 'Siguiente Gol de Paris Saint Germain',
    geminiRecommendation: 'N/D (Gemini falló)',
    aiFallbackUsed: false
};

// Escenario 2: Fallback tradicional estático - El equipo con roja (Lens) GANÓ (Lens 1 - 0 PSG)
// Esto debería evaluarse como RED (porque el equipo beneficiado no aprovechó el jugador de más)
const metaTraditionalLoss = {
    ruleId: '2001_rule1_trad',
    ruleType: 1,
    ruleName: 'Tarjeta Roja Estratégica',
    fixtureId: 2001,
    homeTeam: 'Lens',
    awayTeam: 'Paris Saint Germain',
    teamWithRed: 'Lens',
    scoreAtAlert: { home: 1, away: 0 },
    isSent: true,
    aiRecommendation: 'Siguiente Gol de Paris Saint Germain',
    deepseekRecommendation: 'Siguiente Gol de Paris Saint Germain',
    geminiRecommendation: 'N/D (Gemini falló)',
    aiFallbackUsed: true // Fuerza a usar fallback estático tradicional
};

// Escenario 3: Fallback tradicional estático - El equipo con roja (Lens) NO ganó (Empate 1-1)
// Esto debería evaluarse como GREEN (porque el beneficiado aprovechó empatando o ganando)
const finalFixtureLensPsgDraw = {
    goals: { home: 1, away: 1 } // Lens 1 - 1 PSG (Empate)
};
const metaTraditionalWin = {
    ruleId: '2002_rule1_trad',
    ruleType: 1,
    ruleName: 'Tarjeta Roja Estratégica',
    fixtureId: 2001,
    homeTeam: 'Lens',
    awayTeam: 'Paris Saint Germain',
    teamWithRed: 'Lens',
    scoreAtAlert: { home: 1, away: 0 },
    isSent: true,
    aiRecommendation: 'Doble Chance PSG',
    deepseekRecommendation: 'Doble Chance PSG',
    geminiRecommendation: 'N/D (Gemini falló)',
    aiFallbackUsed: true
};

async function runTests() {
    // Escenario 1
    console.log("👉 Escenario 1: Fallback a DeepSeek (Recomendación activa de Deepseek: 'Siguiente Gol de Paris Saint Germain')");
    try {
        const results = await evaluateAlertResults([metaDeepseekFallback], finalFixtureLensPsg, [], []);
        console.log(`Resultado: ${results[0].isGreen ? '🟩 GREEN' : '🟥 RED'}`);
        console.log(`Explicación: ${results[0].msg}\n`);
    } catch (e) {
        console.error("Error en Escenario 1:", e.message);
    }

    // Escenario 2
    console.log("👉 Escenario 2: Fallback tradicional estático - El equipo con roja (Lens) GANÓ (Lens 1 - 0 PSG)");
    try {
        const results = await evaluateAlertResults([metaTraditionalLoss], finalFixtureLensPsg, [], []);
        console.log(`Resultado tradicional: ${results[0].isGreen ? '🟩 GREEN' : '🟥 RED'}`);
        console.log(`Explicación: ${results[0].msg}\n`);
    } catch (e) {
        console.error("Error en Escenario 2:", e.message);
    }

    // Escenario 3
    console.log("👉 Escenario 3: Fallback tradicional estático - El equipo con roja (Lens) NO ganó (Lens 1 - 1 PSG)");
    try {
        const results = await evaluateAlertResults([metaTraditionalWin], finalFixtureLensPsgDraw, [], []);
        console.log(`Resultado tradicional: ${results[0].isGreen ? '🟩 GREEN' : '🟥 RED'}`);
        console.log(`Explicación: ${results[0].msg}\n`);
    } catch (e) {
        console.error("Error en Escenario 3:", e.message);
    }
}

runTests();
