const {
    parseLiveStats,
    getLiveLeagueTier,
    evaluateLiveMatch,
    LIVE_GREEN_LEAGUES
} = require('./liveEngine');
const { evaluateAlertResults } = require('./rulesEngine');
const apiClient = require('./apiClient');

async function runLiveGoalsTestSuite() {
    console.log("==================================================================");
    console.log("  SUITE DE PRUEBAS: GOLES DESPUÉS DEL MEDIO TIEMPO (HT 0-0)");
    console.log("==================================================================\n");

    let totalTests = 0;
    let passedTests = 0;

    function assert(condition, testName) {
        totalTests++;
        if (condition) {
            console.log(`✅ [PASÓ] ${testName}`);
            passedTests++;
        } else {
            console.error(`❌ [FALLÓ] ${testName}`);
        }
    }

    // ------------------------------------------------------------------
    // Prueba 1: Parseo de estadísticas en vivo
    // ------------------------------------------------------------------
    console.log("--- 1. Verificación de parseLiveStats ---");
    const mockStatsResponse = [
        {
            team: { id: 10, name: "Ajax" },
            statistics: [
                { type: "Shots on Goal", value: 3 },
                { type: "Total Shots", value: 7 },
                { type: "Corner Kicks", value: 4 }
            ]
        },
        {
            team: { id: 20, name: "Feyenoord" },
            statistics: [
                { type: "Shots on Goal", value: 2 },
                { type: "Total Shots", value: 5 },
                { type: "Corner Kicks", value: 2 }
            ]
        }
    ];

    const stats = parseLiveStats(mockStatsResponse);
    assert(stats.totalShotsOnGoal === 5, "Total de tiros a puerta sumados correctamente (3 + 2 = 5)");
    assert(stats.totalShots === 12, "Total de remates sumados correctamente (7 + 5 = 12)");
    assert(stats.totalCorners === 6, "Total de córneres sumados correctamente (4 + 2 = 6)");

    // ------------------------------------------------------------------
    // Prueba 2: Clasificación de Ligas por Tiers (Verde vs Roja)
    // ------------------------------------------------------------------
    console.log("\n--- 2. Clasificación de Ligas por Tiers ---");
    const premierLeagueTier = getLiveLeagueTier(39); // Premier League
    assert(premierLeagueTier.color === 'GREEN', "Premier League (39) clasificada como GREEN");
    assert(premierLeagueTier.stakeAmount === 500, "Stake sugerido para Premier League es 1.0u ($500 MXN)");

    const brasilSerieBTier = getLiveLeagueTier(72); // Serie B Brasil
    assert(brasilSerieBTier.color === 'RED', "Serie B Brasil (72) clasificada como RED (Cuidado / Menor ritmo)");
    assert(brasilSerieBTier.stakeAmount === 250, "Stake sugerido para Serie B Brasil es 0.5u ($250 MXN)");

    // ------------------------------------------------------------------
    // Prueba 3: Filtro de Marcador y Tiempo (evaluateLiveMatch)
    // ------------------------------------------------------------------
    console.log("\n--- 3. Filtro de Marcador y Tiempo en evaluateLiveMatch ---");

    // Caso 3.1: Partido que NO va 0-0 (va 1-0) -> Debe retornar null
    const matchWithGoals = {
        fixture: { id: 991, status: { short: 'HT', elapsed: 45 } },
        league: { id: 39, name: 'Premier League' },
        teams: { home: { id: 10, name: 'Arsenal' }, away: { id: 20, name: 'Chelsea' } },
        goals: { home: 1, away: 0 }
    };
    const resultWithGoals = await evaluateLiveMatch(matchWithGoals);
    assert(resultWithGoals === null, "Partido 1-0 al descanso descartado correctamente (solo aplica 0-0)");

    // Caso 3.2: Partido 0-0 en el minuto 20 (1T) -> Debe retornar null
    const matchMin20 = {
        fixture: { id: 992, status: { short: '1H', elapsed: 20 } },
        league: { id: 39, name: 'Premier League' },
        teams: { home: { id: 10, name: 'Arsenal' }, away: { id: 20, name: 'Chelsea' } },
        goals: { home: 0, away: 0 }
    };
    const resultMin20 = await evaluateLiveMatch(matchMin20);
    assert(resultMin20 === null, "Partido 0-0 al minuto 20 descartado (debe ser HT o 2T min 45-58)");

    // Caso 3.3: Partido 0-0 en el minuto 65 (2T tardío) -> Debe retornar null
    const matchMin65 = {
        fixture: { id: 993, status: { short: '2H', elapsed: 65 } },
        league: { id: 39, name: 'Premier League' },
        teams: { home: { id: 10, name: 'Arsenal' }, away: { id: 20, name: 'Chelsea' } },
        goals: { home: 0, away: 0 }
    };
    const resultMin65 = await evaluateLiveMatch(matchMin65);
    assert(resultMin65 === null, "Partido 0-0 al minuto 65 descartado (fuera de la ventana min 45-58)");

    // ------------------------------------------------------------------
    // Prueba 4: Mock de estadísticas y tendencia de gol pre-partido
    // ------------------------------------------------------------------
    console.log("\n--- 4. Evaluación de Partido Calificado 0-0 al HT ---");

    // Sobrescribir temporalmente llamadas de API para pruebas unitarias deterministas
    const originalGetMatchStatistics = apiClient.getMatchStatistics;
    const originalGetTeamLastMatches = apiClient.getTeamLastMatches;

    // Simular estadísticas con 4 tiros a puerta y 9 tiros totales
    apiClient.getMatchStatistics = async () => [
        {
            team: { id: 10, name: "Bayern Munich" },
            statistics: [
                { type: "Shots on Goal", value: 3 },
                { type: "Total Shots", value: 6 }
            ]
        },
        {
            team: { id: 20, name: "Dortmund" },
            statistics: [
                { type: "Shots on Goal", value: 1 },
                { type: "Total Shots", value: 3 }
            ]
        }
    ];

    // Simular 5 partidos previos con goles (100% de tendencia Over 0.5)
    apiClient.getTeamLastMatches = async () => [
        { goals: { home: 2, away: 1 } },
        { goals: { home: 1, away: 0 } },
        { goals: { home: 0, away: 2 } },
        { goals: { home: 3, away: 1 } },
        { goals: { home: 1, away: 1 } }
    ];

    const qualifiedHTMatch = {
        fixture: { id: 994, status: { short: 'HT', elapsed: 45 } },
        league: { id: 78, name: 'Bundesliga' },
        teams: { home: { id: 10, name: 'Bayern Munich' }, away: { id: 20, name: 'Dortmund' } },
        goals: { home: 0, away: 0 }
    };

    const evalResult = await evaluateLiveMatch(qualifiedHTMatch);
    assert(evalResult !== null, "Partido 0-0 al HT con suficientes tiros y tendencia aprobada es calificado");
    assert(evalResult.homeTeam === 'Bayern Munich', "Equipo local identificado correctamente");
    assert(evalResult.market === 'Over 0.5 Goles en Vivo', "Mercado fijado en Over 0.5 Goles en Vivo");
    assert(evalResult.estimatedOdd === 1.30, "Cuota estimada al HT fijada en 1.30");
    assert(evalResult.tierColor === 'GREEN', "Tier identificado como GREEN para Bundesliga");
    assert(evalResult.preMatchTrendPercent === 100, "Tendencia pre-partido calculada al 100%");

    // Caso 4.2: Minuto 52 (2H) -> Cuota estimada sube a 1.36
    const qualified2HMatch = {
        fixture: { id: 995, status: { short: '2H', elapsed: 52 } },
        league: { id: 78, name: 'Bundesliga' },
        teams: { home: { id: 10, name: 'Bayern Munich' }, away: { id: 20, name: 'Dortmund' } },
        goals: { home: 0, away: 0 }
    };
    const evalResult52 = await evaluateLiveMatch(qualified2HMatch);
    assert(evalResult52.estimatedOdd === 1.36, "Cuota estimada al minuto 52 escala a 1.36");

    // Caso 4.3: Insuficientes tiros -> Debe ser descartado
    apiClient.getMatchStatistics = async () => [
        {
            team: { id: 10, name: "Boring FC" },
            statistics: [
                { type: "Shots on Goal", value: 1 },
                { type: "Total Shots", value: 2 }
            ]
        },
        {
            team: { id: 20, name: "Sleepy FC" },
            statistics: [
                { type: "Shots on Goal", value: 0 },
                { type: "Total Shots", value: 2 }
            ]
        }
    ];
    const lowAttackingMatch = {
        fixture: { id: 996, status: { short: 'HT', elapsed: 45 } },
        league: { id: 78, name: 'Bundesliga' },
        teams: { home: { id: 10, name: 'Boring FC' }, away: { id: 20, name: 'Sleepy FC' } },
        goals: { home: 0, away: 0 }
    };
    const evalResultLowShots = await evaluateLiveMatch(lowAttackingMatch);
    assert(evalResultLowShots === null, "Partido con solo 1 tiro a puerta y 4 tiros totales es descartado correctamente");

    // ------------------------------------------------------------------
    // Prueba 5: Resolución de Veredictos Post-Partido (rulesEngine evaluateAlertResults)
    // ------------------------------------------------------------------
    console.log("\n--- 5. Resolución de Veredictos Post-Partido (GREEN / RED) ---");

    const alertMetadata = {
        ruleId: '994_liveGoal',
        ruleType: 2,
        ruleName: 'Goles después del Medio Tiempo (HT 0-0)',
        fixtureId: 994,
        homeTeam: 'Bayern Munich',
        awayTeam: 'Dortmund',
        scoreAtAlert: { home: 0, away: 0 },
        league: 'Bundesliga',
        isSent: true,
        aiRecommendation: 'Over 0.5 Goles en Vivo'
    };

    // Caso 5.1: Partido termina 1 - 0 (Hubo gol -> GREEN)
    const finishedMatchGreen = {
        fixture: { id: 994, status: { short: 'FT' } },
        goals: { home: 1, away: 0 }
    };
    const veredictoGreen = await evaluateAlertResults([alertMetadata], finishedMatchGreen, [], []);
    assert(veredictoGreen[0].isGreen === true, "Veredicto es GREEN cuando hubo gol en el 2T (1-0)");
    assert(veredictoGreen[0].msg.includes('GREEN'), "Mensaje contiene distintivo GREEN");

    // Caso 5.2: Partido termina 0 - 0 (Sin goles -> RED)
    const finishedMatchRed = {
        fixture: { id: 994, status: { short: 'FT' } },
        goals: { home: 0, away: 0 }
    };
    const veredictoRed = await evaluateAlertResults([alertMetadata], finishedMatchRed, [], []);
    assert(veredictoRed[0].isGreen === false, "Veredicto es RED cuando terminó 0-0");
    assert(veredictoRed[0].msg.includes('RED'), "Mensaje contiene distintivo RED");

    // Restaurar funciones originales de apiClient
    apiClient.getMatchStatistics = originalGetMatchStatistics;
    apiClient.getTeamLastMatches = originalGetTeamLastMatches;

    // Resumen de resultados
    console.log("\n==================================================================");
    console.log(`  RESUMEN: ${passedTests} de ${totalTests} pruebas pasadas exitosamente.`);
    console.log("==================================================================");

    if (passedTests === totalTests) {
        console.log("🎉 TODAS LAS PRUEBAS DE LA ADAPTACIÓN PASARON CON ÉXITO.\n");
        process.exit(0);
    } else {
        console.error("❌ ALGUNAS PRUEBAS FALLARON.\n");
        process.exit(1);
    }
}

runLiveGoalsTestSuite().catch(err => {
    console.error("Error no controlado en suite de pruebas:", err);
    process.exit(1);
});
