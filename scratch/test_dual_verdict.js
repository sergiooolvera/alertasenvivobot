require('dotenv').config();
const { evaluateAlertResults } = require('../rulesEngine');

async function testDualVerdict() {
    console.log("=== PRUEBA DE EVALUACIÓN DE VEREDICTO DUAL ===");

    const mockAlertsMetadata = [
        {
            ruleName: 'Sorpresa Tempranera',
            ruleType: 3,
            homeTeam: 'Operario-PR',
            awayTeam: 'São Bernardo',
            underdogTeam: 'São Bernardo',
            favoriteTeam: 'Operario-PR',
            favoriteSide: 'home',
            totalGoalsAtAlert: 1,
            odds: { home: 1.9, away: 4.1 },
            aiRecommendation: 'Doble Oportunidad - Operario-PR o Empate',
            geminiRecommendation: 'Doble Oportunidad - Operario-PR o Empate',
            deepseekRecommendation: 'Próximo gol de Operario-PR'
        }
    ];

    const mockMatchData = {
        fixture: { id: 123456, status: { short: 'FT' } },
        teams: {
            home: { name: 'Operario-PR' },
            away: { name: 'São Bernardo' }
        },
        goals: { home: 1, away: 3 }
    };

    const mockEvents = [
        { type: 'Goal', detail: 'Normal Goal', team: { name: 'São Bernardo' }, time: { elapsed: 15 } },
        { type: 'Goal', detail: 'Normal Goal', team: { name: 'Operario-PR' }, time: { elapsed: 40 } },
        { type: 'Goal', detail: 'Normal Goal', team: { name: 'São Bernardo' }, time: { elapsed: 60 } },
        { type: 'Goal', detail: 'Normal Goal', team: { name: 'São Bernardo' }, time: { elapsed: 85 } }
    ];

    const mockStats = [
        { team: { name: 'Operario-PR' }, statistics: [{ type: 'Ball Possession', value: '55%' }] },
        { team: { name: 'São Bernardo' }, statistics: [{ type: 'Ball Possession', value: '45%' }] }
    ];

    console.log("\nProcesando veredicto post-partido...");
    const results = await evaluateAlertResults(mockAlertsMetadata, mockMatchData, mockEvents, mockStats);

    for (const res of results) {
        console.log("\n--- RESULTADO DE MENSAJE TELEGRAM ---");
        console.log(res.msg);
    }
}

testDualVerdict().catch(console.error);
