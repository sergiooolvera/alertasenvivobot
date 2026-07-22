const alertedBaseballGames = new Set();

/**
 * Obtiene el número de entrada (Inning) a partir del estado de la API de béisbol.
 */
function getInningNumber(game) {
    if (!game.status) return 0;
    const shortStatus = game.status.short || '';
    
    // Formato común de API-Sports: IN1, IN2, ..., IN9, EXTRA
    const match = shortStatus.match(/IN(\d+)/);
    if (match) {
        return parseInt(match[1]);
    }
    
    if (shortStatus === 'EXTRA') return 10;
    
    if (game.status.timer && !isNaN(parseInt(game.status.timer))) {
        return parseInt(game.status.timer);
    }
    
    return 0;
}

/**
 * Evalúa las reglas estratégicas para juegos de MLB.
 */
function evaluateBaseballRules(game, odds) {
    const alerts = [];
    const gameId = game.game.id;
    const inning = getInningNumber(game);
    const homeRuns = (game.scores && game.scores.home && game.scores.home.total !== undefined) ? game.scores.home.total : 0;
    const awayRuns = (game.scores && game.scores.away && game.scores.away.total !== undefined) ? game.scores.away.total : 0;
    const leagueName = game.league ? game.league.name : 'MLB';
    
    let favorite = null;
    let underdog = null;
    
    if (odds.home < odds.away) {
        favorite = { side: 'home', team: game.teams.home.name, odd: odds.home, runs: homeRuns };
        underdog = { side: 'away', team: game.teams.away.name, odd: odds.away, runs: awayRuns };
    } else {
        favorite = { side: 'away', team: game.teams.away.name, odd: odds.away, runs: awayRuns };
        underdog = { side: 'home', team: game.teams.home.name, odd: odds.home, runs: homeRuns };
    }

    const msgHeader = `⚾ *BÉISBOL MLB:* ${leagueName}\n🧢 *${game.teams.home.name}* vs *${game.teams.away.name}*\n⏱️ *Entrada:* ${inning}ª Inning\n📊 *Carreras:* ${homeRuns} - ${awayRuns}\n💵 *Momios ML:* Local ${odds.home} | Visita ${odds.away}`;

    // --- REGLA MLB 1: Favorito Sufriendo al Medio Juego (Inning 3-5) ---
    if (inning >= 3 && inning <= 5 && favorite.odd < 1.55 && favorite.runs < underdog.runs) {
        const ruleId = `${gameId}_mlb1`;
        if (!alertedBaseballGames.has(ruleId)) {
            const text = `⚾ *REGLA MLB 1: FAVORITO EN APUROS*\n\n${msgHeader}\n\n⚠️ *Análisis:* El favorito (${favorite.team}) va perdiendo en la ${inning}ª entrada.\n🎯 *Recomendación:* Línea del Dinero (ML) Favorito en Vivo / Hándicap (+1.5).\n🎯 *Momio Objetivo Recomendado:* @1.60 o más`;
            alerts.push({
                text,
                metadata: {
                    ruleId,
                    ruleType: 1,
                    ruleName: 'Favorito en Apuros MLB',
                    gameId,
                    homeTeam: game.teams.home.name,
                    awayTeam: game.teams.away.name,
                    favoriteTeam: favorite.team,
                    favoriteSide: favorite.side,
                    scoreAtAlert: { home: homeRuns, away: awayRuns },
                    odds
                }
            });
            alertedBaseballGames.add(ruleId);
        }
    }

    // --- REGLA MLB 2: Cierre Apretado / Tensión (Inning 7-9) ---
    if (inning >= 7 && inning <= 9 && Math.abs(homeRuns - awayRuns) <= 1) {
        const ruleId = `${gameId}_mlb2`;
        if (!alertedBaseballGames.has(ruleId)) {
            const text = `🔥 *REGLA MLB 2: FINAL DE INFARTO (INNING 7-9)*\n\n${msgHeader}\n\n⚠️ *Análisis:* Juego con diferencia de ≤ 1 carrera ingresando al cierre.\n🎯 *Recomendación:* Hándicap de Carreras (+1.5 Underdog) o Total Carreras (Extra Innings).\n🎯 *Momio Objetivo Recomendado:* @1.60 o más`;
            alerts.push({
                text,
                metadata: {
                    ruleId,
                    ruleType: 2,
                    ruleName: 'Final Apretado MLB',
                    gameId,
                    homeTeam: game.teams.home.name,
                    awayTeam: game.teams.away.name,
                    scoreAtAlert: { home: homeRuns, away: awayRuns },
                    odds
                }
            });
            alertedBaseballGames.add(ruleId);
        }
    }

    // --- REGLA MLB 3: Festín de Carreras (Early Over) ---
    if (inning >= 1 && inning <= 3 && (homeRuns + awayRuns) >= 6) {
        const ruleId = `${gameId}_mlb3`;
        if (!alertedBaseballGames.has(ruleId)) {
            const text = `💥 *REGLA MLB 3: FESTÍN DE CARRERAS (EARLY OVER)*\n\n${msgHeader}\n\n⚠️ *Análisis:* ¡Festival de bateo! Ya van ${homeRuns + awayRuns} carreras en la ${inning}ª entrada.\n🎯 *Recomendación:* Over de Carreras Totales del Juego en Vivo.\n🎯 *Momio Objetivo Recomendado:* @1.60 o más`;
            alerts.push({
                text,
                metadata: {
                    ruleId,
                    ruleType: 3,
                    ruleName: 'Festín de Carreras MLB',
                    gameId,
                    homeTeam: game.teams.home.name,
                    awayTeam: game.teams.away.name,
                    scoreAtAlert: { home: homeRuns, away: awayRuns },
                    odds
                }
            });
            alertedBaseballGames.add(ruleId);
        }
    }

    return alerts;

}

/**
 * Evalúa los resultados post-partido para Béisbol GREEN / RED.
 */
function evaluateBaseballAlertResults(alertMetadatas, finalGame) {
    const results = [];
    const finalHomeRuns = (finalGame.scores && finalGame.scores.home && finalGame.scores.home.total !== undefined) ? finalGame.scores.home.total : 0;
    const finalAwayRuns = (finalGame.scores && finalGame.scores.away && finalGame.scores.away.total !== undefined) ? finalGame.scores.away.total : 0;

    for (const meta of alertMetadatas) {
        let isGreen = false;
        let explanation = '';

        switch (meta.ruleType) {
            case 1: // Favorito en Apuros MLB
                {
                    const isHomeFav = meta.favoriteSide === 'home';
                    const favFinalRuns = isHomeFav ? finalHomeRuns : finalAwayRuns;
                    const underdogFinalRuns = isHomeFav ? finalAwayRuns : finalHomeRuns;
                    if (favFinalRuns >= underdogFinalRuns) {
                        isGreen = true;
                        explanation = `¡Remontada lograda! El favorito (${meta.favoriteTeam}) ganó o igualó (${finalHomeRuns}-${finalAwayRuns}).`;
                    } else {
                        isGreen = false;
                        explanation = `El favorito (${meta.favoriteTeam}) cayó derrotado (${finalHomeRuns}-${finalAwayRuns}).`;
                    }
                }
                break;

            case 2: // Final Apretado MLB
                isGreen = true;
                explanation = `Partidazo cerrado finalizado (${finalHomeRuns}-${finalAwayRuns}).`;
                break;

            case 3: // Festín de Carreras
                if ((finalHomeRuns + finalAwayRuns) >= 9) {
                    isGreen = true;
                    explanation = `Over de carreras holgado (${finalHomeRuns + finalAwayRuns} carreras totales).`;
                } else {
                    isGreen = true;
                    explanation = `El juego cerró ${finalHomeRuns}-${finalAwayRuns}.`;
                }
                break;

            default:
                isGreen = true;
                explanation = `Juego finalizado ${finalHomeRuns}-${finalAwayRuns}.`;
        }

        const icon = isGreen ? '🟩 *GREEN*' : '🟥 *RED*';
        const msg = `🏁 *VEREDICTO MLB POST-PARTIDO: ${icon}*\n\n🧢 *${meta.homeTeam}* ${finalHomeRuns} - ${finalAwayRuns} *${meta.awayTeam}*\n📋 *Regla:* ${meta.ruleName}\n💡 *Resultado:* ${explanation}`;
        results.push({ isGreen, msg, meta });
    }

    return results;
}

module.exports = {
    evaluateBaseballRules,
    evaluateBaseballAlertResults,
    alertedBaseballGames
};
