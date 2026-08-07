require('dotenv').config();
const aiService = require('../aiService');

const mockMatchData = {
    homeTeam: 'Boca Juniors',
    awayTeam: 'Estudiantes L.P.',
    leagueName: 'Liga Profesional Argentina',
    leagueRound: 'Ronda 10',
    elapsed: 15,
    score: { home: 0, away: 0 },
    odds: { home: 1.98, draw: 3.05, away: 4.2 },
    ruleName: 'Favorito Sufre en HT',
    ruleDetails: 'El favorito no ha podido anotar al medio tiempo.',
    stats: [],
    events: [],
    lastMatchesHome: [],
    lastMatchesAway: [],
    h2hMatches: []
};

async function testGemini() {
    console.log("--- Probando Google Gemini ---");
    const context = {};
    try {
        const response = await aiService.generatePrediction(mockMatchData, 'football', context);
        console.log("✅ Google Gemini respondió exitosamente.");
        console.log("Respuesta acortada:", response ? response.substring(0, 200) + "..." : "null");
        return true;
    } catch (e) {
        console.error("❌ Error en Google Gemini:", e.message);
        return false;
    }
}

async function testDeepSeek() {
    console.log("\n--- Probando DeepSeek ---");
    const context = {};
    try {
        const response = await aiService.generatePredictionDeepSeek(mockMatchData, 'football', context);
        console.log("✅ DeepSeek respondió exitosamente.");
        console.log("Respuesta acortada:", response ? response.substring(0, 200) + "..." : "null");
        return true;
    } catch (e) {
        console.error("❌ Error en DeepSeek:", e.message);
        return false;
    }
}

async function run() {
    const geminiOk = await testGemini();
    const deepseekOk = await testDeepSeek();
    
    console.log("\n=== Resumen de Diagnóstico ===");
    console.log(`- Google Gemini: ${geminiOk ? 'FUNCIONANDO' : 'FALLANDO'}`);
    console.log(`- DeepSeek: ${deepseekOk ? 'FUNCIONANDO' : 'FALLANDO'}`);
}

run();
