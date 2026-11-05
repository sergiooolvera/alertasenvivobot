const apiClient = require('./apiClient');
const { getDb } = require('./db');

// Ligas Live Verde: Alta dinámica ofensiva, promedio goleador elevado y comprobada rentabilidad en Over 0.5 Live
const LIVE_GREEN_LEAGUES = [
    2,   // UEFA Champions League
    3,   // UEFA Europa League
    848, // UEFA Conference League
    39,  // Premier League (Inglaterra)
    140, // LaLiga (España)
    135, // Serie A (Italia)
    78,  // Bundesliga (Alemania)
    61,  // Ligue 1 (Francia)
    88,  // Eredivisie (Países Bajos)
    89,  // Eerste Divisie (Países Bajos)
    94,  // Primeira Liga (Portugal)
    144, // Jupiler Pro League (Bélgica)
    203, // Süper Lig (Turquía)
    113, // Allsvenskan (Suecia)
    103, // Eliteserien (Noruega)
    207, // Super League (Suiza)
    218, // Bundesliga (Austria)
    253, // MLS (USA)
    71,  // Serie A (Brasil)
    98,  // J1 League (Japón)
    292, // K League 1 (Corea del Sur)
    188  // A-League (Australia)
];

/**
 * Retorna la clasificación de una liga para apuestas en vivo (Over 0.5)
 * Verde: Ligas goleadoras y abiertas (Stake normal 1.0u - $500 MXN)
 * Rojo: Ligas defensivas, de ritmo lento o trabadas (Stake reducido 0.5u - $250 MXN)
 */
function getLiveLeagueTier(leagueId) {
    const isGreen = LIVE_GREEN_LEAGUES.includes(Number(leagueId));
    return {
        color: isGreen ? 'GREEN' : 'RED',
        emoji: isGreen ? '🟢' : '🔴',
        label: isGreen ? 'Liga Top Goleadora' : 'Liga de Cuidado / Menor Ritmo',
        stakeSuggestion: isGreen ? 'Stake Normal (1.0u - $500 MXN)' : 'Stake Reducido (0.5u - $250 MXN)',
        stakeUnits: isGreen ? 1.0 : 0.5,
        stakeAmount: isGreen ? 500 : 250
    };
}

// Sets en memoria para deduplicación entre ciclos de escaneo
const alertedFixturesSet = new Set();
const alertedParlaysSet = new Set();

/**
 * Inicializa el Set de fixtures alertados desde SQLite para no repetir tras reinicios
 */
function initAlertedFromDb() {
    try {
        const db = getDb();
        const rows = db.prepare(`
            SELECT fixture_id FROM plays 
            WHERE rule_name = 'Goles después del Medio Tiempo (HT 0-0)' 
               OR rule_name LIKE '%HT 0-0%'
               OR rule_name LIKE '%Over 0.5%'
        `).all();
        rows.forEach(r => alertedFixturesSet.add(Number(r.fixture_id)));
        console.log(`[liveEngine] Inicializados ${alertedFixturesSet.size} fixtures previamente alertados desde SQLite.`);
    } catch (err) {
        console.warn(`[liveEngine] No se pudo precargar historial de SQLite: ${err.message}`);
    }
}

initAlertedFromDb();

function isLiveFixtureAlerted(fixtureId) {
    if (!fixtureId) return false;
    return alertedFixturesSet.has(Number(fixtureId));
}

function markLiveFixtureAlerted(fixtureId) {
    if (fixtureId) {
        alertedFixturesSet.add(Number(fixtureId));
    }
}

function isLiveParlayAlerted(pKey) {
    if (!pKey) return false;
    return alertedParlaysSet.has(String(pKey));
}

function markLiveParlayAlerted(pKey) {
    if (pKey) {
        alertedParlaysSet.add(String(pKey));
    }
}

/**
 * Parsea el array de estadísticas de API-Sports para un partido en vivo
 */
function parseLiveStats(statsResponse) {
    let totalShotsOnGoal = 0;
    let totalShots = 0;
    let totalCorners = 0;

    if (!Array.isArray(statsResponse) || statsResponse.length === 0) {
        return { totalShotsOnGoal: 0, totalShots: 0, totalCorners: 0 };
    }

    statsResponse.forEach(teamStat => {
        const stats = teamStat.statistics || [];
        stats.forEach(s => {
            const val = parseInt(s.value, 10) || 0;
            if (s.type === 'Shots on Goal') {
                totalShotsOnGoal += val;
            } else if (s.type === 'Total Shots') {
                totalShots += val;
            } else if (s.type === 'Corner Kicks') {
                totalCorners += val;
            }
        });
    });

    return {
        totalShotsOnGoal,
        totalShots,
        totalCorners
    };
}

/**
 * Evalúa partidos pasados de un equipo para calcular la tendencia pre-partido de Over 0.5
 */
async function checkPreMatchGoalTrend(homeTeamId, awayTeamId) {
    try {
        const [homeMatches, awayMatches] = await Promise.all([
            apiClient.getTeamLastMatches(homeTeamId, 5),
            apiClient.getTeamLastMatches(awayTeamId, 5)
        ]);

        let over05Count = 0;
        let totalEvaluated = 0;

        [...(homeMatches || []), ...(awayMatches || [])].forEach(m => {
            if (m.goals && m.goals.home !== null && m.goals.away !== null) {
                totalEvaluated++;
                if ((m.goals.home + m.goals.away) >= 1) {
                    over05Count++;
                }
            }
        });

        const ratio = totalEvaluated > 0 ? (over05Count / totalEvaluated) : 0.80;
        return ratio;
    } catch (e) {
        return 0.80; // Default conservador
    }
}

/**
 * Evalúa un partido individual en vivo al HT 0-0
 */
async function evaluateLiveMatch(fixture) {
    const goalsHome = fixture.goals ? fixture.goals.home : null;
    const goalsAway = fixture.goals ? fixture.goals.away : null;

    // Verificar marcador 0 - 0
    if (goalsHome !== 0 || goalsAway !== 0) {
        return null;
    }

    const statusShort = fixture.fixture ? fixture.fixture.status.short : '';
    const elapsed = fixture.fixture ? (fixture.fixture.status.elapsed || 0) : 0;

    // Rango aceptado: Estrictamente desde Entretiempo (HT) o 2da mitad entre minuto 45 y 58
    const isHTorEarly2H = statusShort === 'HT' || (statusShort === '2H' && elapsed >= 45 && elapsed <= 58);

    if (!isHTorEarly2H) {
        return null;
    }

    const leagueName = fixture.league && fixture.league.name ? fixture.league.name.toLowerCase() : '';
    if (leagueName.includes('friendl') || leagueName.includes('amistoso')) {
        return null;
    }

    const fixtureId = fixture.fixture.id;
    const statsData = await apiClient.getMatchStatistics(fixtureId);
    const liveStats = parseLiveStats(statsData);

    // Criterio cuantitativo: al menos 3 tiros a puerta en total O al menos 7 remates totales
    const hasEnoughAttackingPresence = liveStats.totalShotsOnGoal >= 3 || liveStats.totalShots >= 7;

    if (!hasEnoughAttackingPresence) {
        console.log(`[liveEngine] Partido ${fixture.teams.home.name} vs ${fixture.teams.away.name} (Min ${elapsed}') no cumple tiros mínimos (${liveStats.totalShotsOnGoal} a puerta, ${liveStats.totalShots} totales).`);
        return null;
    }

    // Verificar tendencia pre-partido
    const preMatchTrend = await checkPreMatchGoalTrend(fixture.teams.home.id, fixture.teams.away.id);
    if (preMatchTrend < 0.65) {
        console.log(`[liveEngine] Partido ${fixture.teams.home.name} vs ${fixture.teams.away.name} descartado por baja tendencia de gol pre-partido (${(preMatchTrend * 100).toFixed(0)}%).`);
        return null;
    }

    // Estimar cuota Over 0.5 Goles Live (típicamente entre 1.25 y 1.42 al min 45-55)
    let estimatedOdd = 1.30;
    if (elapsed >= 50) estimatedOdd = 1.36;
    if (elapsed >= 55) estimatedOdd = 1.42;

    const leagueTier = getLiveLeagueTier(fixture.league.id);

    return {
        fixtureId: fixtureId,
        league: fixture.league.name,
        leagueId: fixture.league.id,
        homeTeam: fixture.teams.home.name,
        awayTeam: fixture.teams.away.name,
        elapsed: elapsed,
        statusShort: statusShort,
        market: 'Over 0.5 Goles en Vivo',
        estimatedOdd: estimatedOdd,
        stats: liveStats,
        preMatchTrendPercent: Math.round(preMatchTrend * 100),
        tierColor: leagueTier.color,
        tierEmoji: leagueTier.emoji,
        tierLabel: leagueTier.label,
        stakeSuggestion: leagueTier.stakeSuggestion,
        stakeUnits: leagueTier.stakeUnits,
        stakeAmount: leagueTier.stakeAmount
    };
}

/**
 * Escanea todos los partidos en vivo y retorna propuestas Directas y Parlays
 * @param {Array|null} prefetchedMatches - Lista pre-consultada de partidos en vivo para ahorrar llamadas
 */
async function scanLiveMatches(prefetchedMatches = null) {
    console.log('[liveEngine] Buscando partidos en vivo 0-0 al HT / inicio 2H...');
    const liveMatches = Array.isArray(prefetchedMatches) ? prefetchedMatches : await apiClient.getLiveMatches();

    if (!Array.isArray(liveMatches) || liveMatches.length === 0) {
        console.log('[liveEngine] No hay partidos en vivo en este momento.');
        return { directBets: [], parlayBets: [] };
    }

    const qualifiedMatches = [];

    for (const match of liveMatches) {
        const fixtureId = match.fixture ? match.fixture.id : null;
        if (fixtureId && isLiveFixtureAlerted(fixtureId)) {
            continue;
        }

        const evalResult = await evaluateLiveMatch(match);
        if (evalResult) {
            qualifiedMatches.push(evalResult);
        }
    }

    console.log(`[liveEngine] Partidos calificados en vivo (HT 0-0 Over 0.5): ${qualifiedMatches.length}`);

    const directBets = qualifiedMatches;
    const parlayBets = [];

    // Si coinciden 2 o más partidos calificados en este escaneo, armar Parlays en Vivo
    if (qualifiedMatches.length >= 2) {
        for (let i = 0; i < qualifiedMatches.length - 1; i++) {
            for (let j = i + 1; j < qualifiedMatches.length; j++) {
                const p1 = qualifiedMatches[i];
                const p2 = qualifiedMatches[j];
                const combinedOdd = +(p1.estimatedOdd * p2.estimatedOdd).toFixed(2);
                const allGreen = p1.tierColor === 'GREEN' && p2.tierColor === 'GREEN';

                parlayBets.push({
                    type: 'PARLAY_LIVE_2',
                    totalOdd: combinedOdd,
                    picks: [p1, p2],
                    tierColor: allGreen ? 'GREEN' : 'RED',
                    tierEmoji: allGreen ? '🟢' : (p1.tierColor === 'RED' && p2.tierColor === 'RED' ? '🔴' : '🟡'),
                    tierLabel: allGreen ? 'Parlay Alta Confianza' : 'Parlay Mixto / Precaución',
                    stakeSuggestion: allGreen ? 'Stake Normal (1.0u - $500 MXN)' : 'Stake Reducido (0.5u - $250 MXN)'
                });
            }
        }
    }

    return { directBets, parlayBets };
}

module.exports = {
    LIVE_GREEN_LEAGUES,
    getLiveLeagueTier,
    parseLiveStats,
    checkPreMatchGoalTrend,
    evaluateLiveMatch,
    scanLiveMatches,
    isLiveFixtureAlerted,
    markLiveFixtureAlerted,
    isLiveParlayAlerted,
    markLiveParlayAlerted,
    alertedFixturesSet
};
