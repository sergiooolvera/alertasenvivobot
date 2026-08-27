const { evaluateAlertResults } = require('./rulesEngine');

async function testOmission() {
    console.log('=== INICIANDO PRUEBA DE OMISIÓN/DESCARTE DE APUESTAS ===\n');

    // 1. Simulación Fútbol (Alerta Evitada - Control tradicional RED)
    const alertMetaFootballRed = {
        ruleId: 'test_123_rule5',
        ruleType: 5, // HT Comeback
        ruleName: 'HT Comeback Favorito',
        homeTeam: 'Real Madrid',
        awayTeam: 'Barcelona',
        favoriteTeam: 'Real Madrid',
        favoriteSide: 'home',
        odds: { home: 1.50, draw: 3.80, away: 5.00 }, // Real Madrid favorito
        aiRecommendation: 'Evitar apuesta / No recomendada'
    };

    // Simulamos partido finalizado donde el favorito no remontó (perdió 1-2, tradicionalmente RED)
    const finalFixtureFootballRed = {
        goals: { home: 1, away: 2 } // Real Madrid 1 - 2 Barcelona
    };

    console.log('Evaluando Fútbol (Caso RED tradicional)...');
    const resultsFootballRed = await evaluateAlertResults([alertMetaFootballRed], finalFixtureFootballRed, [], []);
    console.log('Veredicto Fútbol RED:');
    console.log(resultsFootballRed[0].msg);
    console.log('Metadatos devueltos:', JSON.stringify(resultsFootballRed[0].meta));
    console.log('isOmitted:', resultsFootballRed[0].isOmitted);
    console.log('isGreen:', resultsFootballRed[0].isGreen);
    console.log('-'.repeat(60) + '\n');


    // 2. Simulación Fútbol (Alerta Evitada - Control tradicional GREEN)
    const alertMetaFootballGreen = {
        ruleId: 'test_124_rule5',
        ruleType: 5, // HT Comeback
        ruleName: 'HT Comeback Favorito',
        homeTeam: 'Bayern Munich',
        awayTeam: 'Stuttgart',
        favoriteTeam: 'Bayern Munich',
        favoriteSide: 'home',
        odds: { home: 1.45, draw: 4.00, away: 6.00 }, // Bayern favorito
        aiRecommendation: 'Evitar apuesta / No recomendada'
    };

    // Simulamos partido finalizado donde el favorito sí remontó (ganó 3-2, tradicionalmente GREEN)
    const finalFixtureFootballGreen = {
        goals: { home: 3, away: 2 } // Bayern 3 - 2 Stuttgart
    };

    console.log('Evaluando Fútbol (Caso GREEN tradicional)...');
    const resultsFootballGreen = await evaluateAlertResults([alertMetaFootballGreen], finalFixtureFootballGreen, [], []);
    console.log('Veredicto Fútbol GREEN:');
    console.log(resultsFootballGreen[0].msg);
    console.log('\n=== PRUEBA DE OMISIÓN COMPLETADA ===');
}

testOmission().catch(err => console.error('Error en prueba:', err));
