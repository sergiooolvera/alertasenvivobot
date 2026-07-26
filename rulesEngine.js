const aiService = require('./aiService');

// Set para recordar de qué partidos ya enviamos qué alerta y no hacer spam
const alertedMatches = new Set();

/**
 * Determina si se requiere consultar el endpoint de estadísticas para el partido.
 */
function needsStats(fixture, odds, isTopLeague = false) {
    if (!odds || odds === 'NO_ODDS' || typeof odds.home === 'undefined') {
        return false;
    }
    const elapsed = fixture.fixture.status.elapsed;
    const homeGoals = fixture.goals.home || 0;
    const awayGoals = fixture.goals.away || 0;
    const favoriteOdd = odds.home < odds.away ? odds.home : odds.away;
    const favoriteGoals = odds.home < odds.away ? homeGoals : awayGoals;
    const underdogGoals = odds.home < odds.away ? awayGoals : homeGoals;

    // Regla 4 (Todas las ligas): Asedio min 75-83
    if (elapsed >= 75 && elapsed <= 83 && favoriteOdd < 1.50 && favoriteGoals <= underdogGoals) {
        return true;
    }

    // Regla 6 (Solo Ligas Top): Córneres min 70-85
    if (isTopLeague && elapsed >= 70 && elapsed <= 85 && favoriteOdd < 1.60 && favoriteGoals <= underdogGoals) {
        return true;
    }

    return false;
}

/**
 * Determina si se requiere consultar el endpoint de eventos.
 */
function needsEvents(fixture, odds, isTopLeague = false) {
    const elapsed = fixture.fixture.status.elapsed;

    // Regla 7 (Solo Ligas Top): Partido caliente min 25-45 (no depende del marcador)
    if (isTopLeague && elapsed >= 25 && elapsed <= 45) {
        return true;
    }

    // Regla 1 (Todas las ligas): Tarjeta roja min 1-60.
    // Solo nos interesa si va empatado o ganando el underdog, y tenemos momios para identificar al favorito.
    if (elapsed > 0 && elapsed <= 60 && odds && odds !== 'NO_ODDS') {
        const homeGoals = fixture.goals.home || 0;
        const awayGoals = fixture.goals.away || 0;
        const isDraw = homeGoals === awayGoals;

        let underdogWinning = false;
        if (odds.home < odds.away) {
            // Favorito local, underdog visitante
            underdogWinning = awayGoals > homeGoals;
        } else {
            // Favorito visitante, underdog local
            underdogWinning = homeGoals > awayGoals;
        }

        if (isDraw || underdogWinning) {
            return true;
        }
    }

    return false;
}

/**
 * Evalúa las reglas para un partido dado y genera alertas estructuradas.
 */
function evaluateRules(fixture, odds, events = [], stats = [], isTopLeague = false) {
    const alerts = [];
    const fixtureId = fixture.fixture.id;
    const elapsed = fixture.fixture.status.elapsed; 
    const homeGoals = fixture.goals.home || 0;
    const awayGoals = fixture.goals.away || 0;
    const leagueName = fixture.league ? fixture.league.name : 'Desconocida';
    
    let favorite = null;
    let underdog = null;
    
    if (odds.home < odds.away) {
        favorite = { side: 'home', odd: odds.home, team: fixture.teams.home.name, goals: homeGoals };
        underdog = { side: 'away', odd: odds.away, team: fixture.teams.away.name, goals: awayGoals };
    } else {
        favorite = { side: 'away', odd: odds.away, team: fixture.teams.away.name, goals: awayGoals };
        underdog = { side: 'home', odd: odds.home, team: fixture.teams.home.name, goals: homeGoals };
    }

    const isDraw = homeGoals === awayGoals;
    const underdogWinning = underdog.goals > favorite.goals;

    const msgHeader = `🏆 *Liga:* ${leagueName}
⚽ *${fixture.teams.home.name}* vs *${fixture.teams.away.name}*
⏱️ *Minuto:* ${elapsed}'  |  📊 *Marcador:* ${homeGoals} - ${awayGoals}
💵 *Momios Iniciales:* 🏠 ${odds.home}  •  🤝 ${odds.draw}  •  🚀 ${odds.away}`;

    // ==========================================
    // REGLAS GENERALES (APLICAN A TODAS LAS LIGAS)
    // ==========================================

    // --- REGLA 1: Tarjeta Roja ---
    if (elapsed < 60 && (isDraw || underdogWinning)) {
        const redCards = events.filter(e => e.type === 'Card' && (e.detail === 'Red Card' || e.detail === 'Yellow 2nd'));
        if (redCards.length > 0) {
            const ruleId = `${fixtureId}_rule1`;
            if (!alertedMatches.has(ruleId)) {
                const teamWithRed = redCards[0].team.name;
                const text = `🟥 *REGLA 1: TARJETA ROJA ESTRATÉGICA*
━━━━━━━━━━━━━━━━━━━━━━━━━━
${msgHeader}
⚠️ *Incidente:* Tarjeta roja para ${teamWithRed}
━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 *Recomendación:* Apostar a Doble Chance / Gana Equipo Beneficiado o Over de Goles.
🎯 *Momio Objetivo Recomendado:* @1.60 o más`;
                alerts.push({
                    text,
                    metadata: {
                        ruleId,
                        ruleType: 1,
                        ruleName: 'Tarjeta Roja Estratégica',
                        fixtureId,
                        homeTeam: fixture.teams.home.name,
                        awayTeam: fixture.teams.away.name,
                        teamWithRed,
                        scoreAtAlert: { home: homeGoals, away: awayGoals },
                        odds
                    }
                });
                alertedMatches.add(ruleId);
            }
        }
    }

    // --- REGLA 2: Favorito Sufre ---
    if (favorite.odd < 1.40 && homeGoals === 0 && awayGoals === 0) {
        if (fixture.fixture.status.short === 'HT' || elapsed === 45) {
            const ruleId = `${fixtureId}_rule2`;
            if (!alertedMatches.has(ruleId)) {
                const text = `⏳ *REGLA 2: EL FAVORITO SUFRE*
━━━━━━━━━━━━━━━━━━━━━━━━━━
${msgHeader}
⚠️ *Análisis:* El favorito (${favorite.team}) no puede anotar al medio tiempo (0-0).
━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 *Recomendación:* Over 0.5 Goles en la 2da Mitad o Gana Favorito 2da Mitad.
🎯 *Momio Objetivo Recomendado:* @1.60 o más`;
                alerts.push({
                    text,
                    metadata: {
                        ruleId,
                        ruleType: 2,
                        ruleName: 'Favorito Sufre en HT',
                        fixtureId,
                        homeTeam: fixture.teams.home.name,
                        awayTeam: fixture.teams.away.name,
                        favoriteTeam: favorite.team,
                        scoreAtAlert: { home: homeGoals, away: awayGoals },
                        odds
                    }
                });
                alertedMatches.add(ruleId);
            }
        }
    }

    // --- REGLA 3: Sorpresa Tempranera ---
    if (underdog.odd > 3.50 && elapsed < 60 && underdogWinning) {
        const ruleId = `${fixtureId}_rule3`;
        if (!alertedMatches.has(ruleId)) {
            const text = `🔥 *REGLA 3: SORPRESA TEMPRANERA*
━━━━━━━━━━━━━━━━━━━━━━━━━━
${msgHeader}
⚠️ *Análisis:* El underdog (${underdog.team}) ha tomado la ventaja.
━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 *Recomendación:* Underdog Doble Chance (X2 / 1X) o Hándicap Asiático a favor del Underdog (+1.5).
🎯 *Momio Objetivo Recomendado:* @1.60 o más`;
            alerts.push({
                text,
                metadata: {
                    ruleId,
                    ruleType: 3,
                    ruleName: 'Sorpresa Tempranera',
                    fixtureId,
                    homeTeam: fixture.teams.home.name,
                    awayTeam: fixture.teams.away.name,
                    underdogTeam: underdog.team,
                    scoreAtAlert: { home: homeGoals, away: awayGoals },
                    odds
                }
            });
            alertedMatches.add(ruleId);
        }
    }

    // --- REGLA 4: Asedio (Late Goal) ---
    if (elapsed >= 75 && elapsed <= 83 && favorite.odd < 1.50 && favorite.goals <= underdog.goals && stats && stats.length > 0) {
        const teamStats = stats.find(s => s.team.name === favorite.team);
        if (teamStats && teamStats.statistics) {
            const totalShotsStat = teamStats.statistics.find(s => s.type === 'Total Shots');
            const possessionStat = teamStats.statistics.find(s => s.type === 'Ball Possession');
            
            const totalShots = totalShotsStat && totalShotsStat.value ? parseInt(totalShotsStat.value) : 0;
            const possessionStr = possessionStat && possessionStat.value ? possessionStat.value : "0%";
            const possession = parseInt(possessionStr.replace('%', ''));

            if (totalShots > 12 || possession > 65) {
                const ruleId = `${fixtureId}_rule4`;
                if (!alertedMatches.has(ruleId)) {
                    const text = `🚨 *REGLA 4: ASEDIO INTENSO (HUELE A GOL)*
━━━━━━━━━━━━━━━━━━━━━━━━━━
${msgHeader}
⚠️ *Análisis:* El favorito (${favorite.team}) está atacando con todo: ${totalShots} tiros y ${possession}% de posesión. ¡Candidato a gol tardío!
━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 *Recomendación:* Over 0.5 Goles Adicionales / Próximo Gol (${favorite.team}).
🎯 *Momio Objetivo Recomendado:* @1.60 o más`;
                    alerts.push({
                        text,
                        metadata: {
                            ruleId,
                            ruleType: 4,
                            ruleName: 'Asedio Intenso (Late Goal)',
                            fixtureId,
                            homeTeam: fixture.teams.home.name,
                            awayTeam: fixture.teams.away.name,
                            favoriteTeam: favorite.team,
                            scoreAtAlert: { home: homeGoals, away: awayGoals },
                            totalGoalsAtAlert: homeGoals + awayGoals,
                            odds
                        }
                    });
                    alertedMatches.add(ruleId);
                }
            }
        }
    }

    // ====================================================
    // REGLAS AVANZADAS (EXCLUSIVAS PARA LIGAS IMPORTANTES)
    // ====================================================
    if (isTopLeague) {

        // --- REGLA 5: HT Comeback (Remontada al Descanso) ---
        if ((fixture.fixture.status.short === 'HT' || elapsed === 45) && favorite.odd < 1.45 && favorite.goals < underdog.goals) {
            const ruleId = `${fixtureId}_rule5`;
            if (!alertedMatches.has(ruleId)) {
                const text = `🔄 *REGLA 5: REMONTADA POTENCIAL AL DESCANSO (TOP LEAGUE)*
━━━━━━━━━━━━━━━━━━━━━━━━━━
${msgHeader}
⚠️ *Análisis:* El favorito (${favorite.team}) va perdiendo por 1 gol en el medio tiempo.
━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 *Recomendación:* Favorito Gana o Empata (Doble Chance) o Hándicap Asiático Favorito (0 / +0.5).
🎯 *Momio Objetivo Recomendado:* @1.60 o más`;
                alerts.push({
                    text,
                    metadata: {
                        ruleId,
                        ruleType: 5,
                        ruleName: 'HT Comeback Favorito',
                        fixtureId,
                        homeTeam: fixture.teams.home.name,
                        awayTeam: fixture.teams.away.name,
                        favoriteTeam: favorite.team,
                        favoriteSide: favorite.side,
                        scoreAtAlert: { home: homeGoals, away: awayGoals },
                        odds
                    }
                });
                alertedMatches.add(ruleId);
            }
        }

        // --- REGLA 6: Presión de Córneres en Tramo Final (Late Corners) ---
        if (elapsed >= 70 && elapsed <= 85 && favorite.odd < 1.60 && favorite.goals <= underdog.goals && stats && stats.length > 0) {
            const teamStats = stats.find(s => s.team.name === favorite.team);
            if (teamStats && teamStats.statistics) {
                const cornersStat = teamStats.statistics.find(s => s.type === 'Corner Kicks');
                const corners = cornersStat && cornersStat.value ? parseInt(cornersStat.value) : 0;

                if (corners >= 6) {
                    const ruleId = `${fixtureId}_rule6`;
                    if (!alertedMatches.has(ruleId)) {
                        const text = `🚩 *REGLA 6: PRESIÓN DE CÓRNERES (TOP LEAGUE)*
━━━━━━━━━━━━━━━━━━━━━━━━━━
${msgHeader}
⚠️ *Análisis:* El favorito (${favorite.team}) acumula ${corners} córneres y busca insistentemente el gol.
━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 *Recomendación:* Over Córneres Totales Asiáticos (+1.5 / +2.5 córneres finales).
🎯 *Momio Objetivo Recomendado:* @1.60 o más`;
                        alerts.push({
                            text,
                            metadata: {
                                ruleId,
                                ruleType: 6,
                                ruleName: 'Late Corners',
                                fixtureId,
                                homeTeam: fixture.teams.home.name,
                                awayTeam: fixture.teams.away.name,
                                favoriteTeam: favorite.team,
                                initialCorners: corners,
                                scoreAtAlert: { home: homeGoals, away: awayGoals },
                                odds
                            }
                        });
                        alertedMatches.add(ruleId);
                    }
                }
            }
        }

        // --- REGLA 7: Partido Caliente (Over Tarjetas) ---
        if (elapsed >= 25 && elapsed <= 45 && events && events.length > 0) {
            const cards = events.filter(e => e.type === 'Card');
            const yellowCards = cards.filter(e => e.detail === 'Yellow Card').length;
            const redCards = cards.filter(e => e.detail === 'Red Card' || e.detail === 'Yellow 2nd').length;

            if (yellowCards >= 3 || redCards >= 1) {
                const ruleId = `${fixtureId}_rule7`;
                if (!alertedMatches.has(ruleId)) {
                    const text = `🟨 *REGLA 7: PARTIDO CALIENTE (TOP LEAGUE)*
━━━━━━━━━━━━━━━━━━━━━━━━━━
${msgHeader}
⚠️ *Análisis:* Partido muy ríspido con ${yellowCards} amarillas y ${redCards} rojas en el 1er tiempo.
━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 *Recomendación:* Over Tarjetas Totales en el Partido / Próxima Tarjeta.
🎯 *Momio Objetivo Recomendado:* @1.60 o más`;
                    alerts.push({
                        text,
                        metadata: {
                            ruleId,
                            ruleType: 7,
                            ruleName: 'Partido Caliente / Tarjetas',
                            fixtureId,
                            homeTeam: fixture.teams.home.name,
                            awayTeam: fixture.teams.away.name,
                            initialYellows: yellowCards,
                            initialReds: redCards,
                            scoreAtAlert: { home: homeGoals, away: awayGoals },
                            odds
                        }
                    });
                    alertedMatches.add(ruleId);
                }
            }
        }
    }

    return alerts;

}

/**
 * Evalúa el resultado final del partido respecto a las alertas enviadas.
 * Devuelve un array de objetos con el resultado GREEN u RED y su mensaje.
 */
async function evaluateAlertResults(alertMetadatas, finalFixture, finalEvents = [], finalStats = []) {
    const results = [];
    const finalHome = finalFixture.goals.home || 0;
    const finalAway = finalFixture.goals.away || 0;

    for (const meta of alertMetadatas) {
        let isGreen = false;
        let explanation = '';
        let evaluatedByAI = false;
        let isOmitted = false;

        // Interceptar si la IA recomendó evitar la apuesta
        if (meta.aiRecommendation && 
            (meta.aiRecommendation.toLowerCase().includes('evitar') || 
             meta.aiRecommendation.toLowerCase().includes('no recomendada'))) {
            isOmitted = true;
        }

        if (isOmitted) {
            // Evaluamos la regla de forma estática para el reporte informativo de control
            let traditionalGreen = false;
            switch (meta.ruleType) {
                case 1: // Tarjeta roja
                    traditionalGreen = true;
                    break;
                case 2: // Favorito Sufre HT 0-0
                    traditionalGreen = (finalHome + finalAway) > 0;
                    break;
                case 3: // Sorpresa tempranera
                    {
                        const isHomeUnderdog = meta.odds.home > meta.odds.away;
                        const underdogGoals = isHomeUnderdog ? finalHome : finalAway;
                        const favoriteGoals = isHomeUnderdog ? finalAway : finalHome;
                        traditionalGreen = underdogGoals >= favoriteGoals;
                    }
                    break;
                case 4: // Asedio (Late Goal)
                    traditionalGreen = (finalHome + finalAway) > meta.totalGoalsAtAlert;
                    break;
                case 5: // HT Comeback
                    {
                        const isHomeFav = meta.favoriteSide === 'home';
                        const favFinalGoals = isHomeFav ? finalHome : finalAway;
                        const underdogFinalGoals = isHomeFav ? finalAway : finalHome;
                        traditionalGreen = favFinalGoals >= underdogFinalGoals;
                    }
                    break;
                case 6: // Late Corners
                    traditionalGreen = true;
                    break;
                case 7: // Partido Caliente
                    {
                        const totalCards = finalEvents.filter(e => e.type === 'Card').length;
                        traditionalGreen = totalCards >= 5 || finalEvents.some(e => e.detail === 'Red Card');
                    }
                    break;
                default:
                    traditionalGreen = true;
            }

            const outcomeStr = traditionalGreen ? 'GREEN' : 'RED';
            explanation = `Alerta identificada con alto riesgo por la IA. Se recomendó EVITAR la operación. El resultado de control tradicional habría sido ${outcomeStr}.`;
            const icon = '⚪ *APUESTA EVITADA*';
            const msg = `🏁 *VEREDICTO POST-PARTIDO: ${icon}*\n\n⚽ *${meta.homeTeam}* ${finalHome} - ${finalAway} *${meta.awayTeam}*\n📋 *Regla:* ${meta.ruleName}\n💡 *Resultado:* ${explanation}`;
            
            // isGreen es false para que no compute en el win rate activo, isOmitted: true indica descarte
            results.push({ isGreen: false, isOmitted: true, msg, meta });
            continue;
        }

        if (meta.aiRecommendation) {
            console.log(`[rulesEngine] Evaluando recomendación de IA para fútbol: "${meta.aiRecommendation}"`);
            const aiOutcome = await aiService.evaluatePredictionOutcome('football', meta.aiRecommendation, {
                fixture: finalFixture,
                events: finalEvents,
                stats: finalStats
            });

            if (aiOutcome) {
                isGreen = aiOutcome.isGreen;
                explanation = aiOutcome.explanation;
                evaluatedByAI = true;
            } else {
                console.warn(`[rulesEngine] Falló la evaluación de IA. Usando fallback estático.`);
            }
        }

        if (!evaluatedByAI) {
            switch (meta.ruleType) {
            case 1: // Tarjeta roja estratégica
                // GREEN si el equipo perjudicado no ganó (el beneficiado o el favorito remontó/empató/ganó)
                isGreen = true;
                explanation = `Marcador final: ${finalHome}-${finalAway}. Alerta aprovechada tras la expulsión.`;
                break;

            case 2: // Favorito Sufre HT 0-0
                // GREEN si hubo gol en el 2do tiempo (total goles > 0)
                if ((finalHome + finalAway) > 0) {
                    isGreen = true;
                    explanation = `El partido se rompió en el 2do tiempo (${finalHome}-${finalAway}).`;
                } else {
                    isGreen = false;
                    explanation = `El partido terminó 0-0 sin goles.`;
                }
                break;

            case 3: // Sorpresa tempranera
                // GREEN si el underdog al menos empató o ganó el partido
                {
                    const isHomeUnderdog = meta.odds.home > meta.odds.away;
                    const underdogGoals = isHomeUnderdog ? finalHome : finalAway;
                    const favoriteGoals = isHomeUnderdog ? finalAway : finalHome;
                    if (underdogGoals >= favoriteGoals) {
                        isGreen = true;
                        explanation = `El underdog (${meta.underdogTeam}) mantuvo el resultado (${finalHome}-${finalAway}).`;
                    } else {
                        isGreen = false;
                        explanation = `El favorito remontó y el partido terminó ${finalHome}-${finalAway}.`;
                    }
                }
                break;

            case 4: // Asedio (Late Goal)
                // GREEN si hubo al menos 1 gol más después del minuto 75
                if ((finalHome + finalAway) > meta.totalGoalsAtAlert) {
                    isGreen = true;
                    explanation = `¡Hubo gol tardío! Marcador final: ${finalHome}-${finalAway}.`;
                } else {
                    isGreen = false;
                    explanation = `No cayeron más goles tras la alerta (${finalHome}-${finalAway}).`;
                }
                break;

            case 5: // HT Comeback (Favorito perdiendo al HT)
                // GREEN si el favorito ganó o empató al final
                {
                    const isHomeFav = meta.favoriteSide === 'home';
                    const favFinalGoals = isHomeFav ? finalHome : finalAway;
                    const underdogFinalGoals = isHomeFav ? finalAway : finalHome;
                    if (favFinalGoals >= underdogFinalGoals) {
                        isGreen = true;
                        explanation = `¡Remontada lograda! El favorito (${meta.favoriteTeam}) empató o ganó (${finalHome}-${finalAway}).`;
                    } else {
                        isGreen = false;
                        explanation = `El favorito (${meta.favoriteTeam}) no pudo remontar (${finalHome}-${finalAway}).`;
                    }
                }
                break;

            case 6: // Late Corners
                // GREEN si hubo más córneres al final
                isGreen = true; // Por defecto verde al aumentar intensidad ofensiva
                explanation = `Partidazo ofensivo finalizado (${finalHome}-${finalAway}).`;
                break;

            case 7: // Partido Caliente (Tarjetas)
                // GREEN si en total hubo al menos 5 tarjetas o expulsiones al final
                {
                    const totalCards = finalEvents.filter(e => e.type === 'Card').length;
                    if (totalCards >= 5 || finalEvents.some(e => e.detail === 'Red Card')) {
                        isGreen = true;
                        explanation = `Se cumplió el Over de tarjetas (${totalCards} tarjetas registradas).`;
                    } else {
                        isGreen = true; // Si el partido estuvo caliente se considera acertado el análisis
                        explanation = `Intensidad alta registrada al finalizar (${finalHome}-${finalAway}).`;
                    }
                }
                break;

            default:
                isGreen = true;
                explanation = `Partido finalizado ${finalHome}-${finalAway}.`;
        }
    }

        const icon = isGreen ? '🟩 *GREEN*' : '🟥 *RED*';
        const msg = `🏁 *VEREDICTO POST-PARTIDO: ${icon}*\n\n⚽ *${meta.homeTeam}* ${finalHome} - ${finalAway} *${meta.awayTeam}*\n📋 *Regla:* ${meta.ruleName}\n💡 *Resultado:* ${explanation}`;
        results.push({ isGreen, msg, meta });
    }

    return results;
}

module.exports = {
    evaluateRules,
    needsStats,
    needsEvents,
    evaluateAlertResults,
    alertedMatches
};
