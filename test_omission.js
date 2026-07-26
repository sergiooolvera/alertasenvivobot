const { evaluateAlertResults } = require('./rulesEngine');
const { evaluateBaseballAlertResults } = require('./baseballRulesEngine');

async function testOmission() {
    console.log('=== INICIANDO PRUEBA DE OMISIÓN/DESCARTE DE APUESTAS ===\n');

    // 1. Simulación Fútbol (Alerta Evitada - Control tradicional RED)
    const alertMetaFootballRed = {
        ruleId: 'test_123_rule3',
        ruleType: 3, // Sorpresa Tempranera
        ruleName: 'Sorpresa Tempranera',
        homeTeam: 'Real Madrid',
        awayTeam: 'Barcelona',
        underdogTeam: 'Barcelona',
        odds: { home: 1.50, draw: 3.80, away: 5.00 }, // Real Madrid favorito
        aiRecommendation: 'Evitar apuesta / No recomendada'
    };

    // Simulamos partido finalizado donde el favorito ganó (lo que significa que el underdog perdió, tradicionalmente RED)
    const finalFixtureFootballRed = {
        goals: { home: 3, away: 1 } // Real Madrid 3 - 1 Barcelona
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
        ruleId: 'test_124_rule3',
        ruleType: 3, // Sorpresa Tempranera
        ruleName: 'Sorpresa Tempranera',
        homeTeam: 'Bayern Munich',
        awayTeam: 'Stuttgart',
        underdogTeam: 'Stuttgart',
        odds: { home: 1.45, draw: 4.00, away: 6.00 }, // Bayern favorito
        aiRecommendation: 'Evitar apuesta / No recomendada'
    };

    // Simulamos partido finalizado donde empataron (el underdog mantuvo resultado, tradicionalmente GREEN)
    const finalFixtureFootballGreen = {
        goals: { home: 2, away: 2 } // Bayern 2 - 2 Stuttgart
    };

    console.log('Evaluando Fútbol (Caso GREEN tradicional)...');
    const resultsFootballGreen = await evaluateAlertResults([alertMetaFootballGreen], finalFixtureFootballGreen, [], []);
    console.log('Veredicto Fútbol GREEN:');
    console.log(resultsFootballGreen[0].msg);
    console.log('-'.repeat(60) + '\n');


    // 3. Simulación Béisbol MLB (Alerta Evitada - Control tradicional RED)
    const alertMetaBaseball = {
        ruleId: 'test_999_rule1',
        ruleType: 1, // Favorito en Apuros MLB
        ruleName: 'Favorito en Apuros MLB',
        homeTeam: 'New York Yankees',
        awayTeam: 'Boston Red Sox',
        favoriteTeam: 'New York Yankees',
        favoriteSide: 'home',
        aiRecommendation: 'Evitar apuesta debido a picheo inestable'
    };

    // Simulamos partido finalizado donde el favorito perdió (tradicionalmente RED)
    const finalGameBaseball = {
        scores: {
            home: { total: 3 }, // Yankees
            away: { total: 7 }  // Boston
        }
    };

    console.log('Evaluando Béisbol MLB (Caso RED tradicional)...');
    const resultsBaseball = await evaluateBaseballAlertResults([alertMetaBaseball], finalGameBaseball);
    console.log('Veredicto Béisbol MLB:');
    console.log(resultsBaseball[0].msg);
    console.log('isOmitted:', resultsBaseball[0].isOmitted);
    console.log('isGreen:', resultsBaseball[0].isGreen);
    console.log('\n=== PRUEBA DE OMISIÓN COMPLETADA ===');
}

testOmission().catch(err => console.error('Error en prueba:', err));
