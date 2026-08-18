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
    return (elapsed > 0 && elapsed <= 60) || (elapsed >= 70 && elapsed <= 85) || fixture.fixture.status.short === 'HT';
}

/**
 * Determina si se requiere consultar el endpoint de eventos.
 */
function needsEvents(fixture, odds, isTopLeague = false) {
    if (!odds || odds === 'NO_ODDS') return false;
    const elapsed = fixture.fixture.status.elapsed;
    return (elapsed > 0 && elapsed <= 60) || (elapsed >= 70 && elapsed <= 85) || fixture.fixture.status.short === 'HT';
}

/**
 * Evalúa las reglas para un partido dado y genera alertas estructuradas.
 */
function evaluateRules(fixture, odds, events = [], stats = [], isTopLeague = false) {
    const hasStats = stats && stats.length > 0;
    const getStat = (teamName, statType) => {
        if (!hasStats) return 0;
        const teamStats = stats.find(s => s.team.name === teamName);
        if (!teamStats || !teamStats.statistics) return 0;
        const stat = teamStats.statistics.find(s => s.type === statType);
        if (!stat || !stat.value) return 0;
        if (typeof stat.value === 'string' && stat.value.includes('%')) return parseInt(stat.value.replace('%', ''));
        return parseInt(stat.value);
    };
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

    const homeSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(fixture.teams.home.name + ' Flashscore')}`;
    const awaySearchUrl = `https://www.google.com/search?q=${encodeURIComponent(fixture.teams.away.name + ' Flashscore')}`;
    const matchSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(fixture.teams.home.name + ' vs ' + fixture.teams.away.name + ' Flashscore')}`;

    const msgHeader = `🏆 *Liga:* ${leagueName}
⚽ *[${fixture.teams.home.name}](${homeSearchUrl})* vs *[${fixture.teams.away.name}](${awaySearchUrl})*
⏱️ *Minuto:* ${elapsed}'  |  📊 *Marcador:* ${homeGoals} - ${awayGoals}
💵 *Momios Iniciales:* 🏠 ${odds.home}  •  🤝 ${odds.draw}  •  🚀 ${odds.away}
🔍 *Flashscore:* [Buscar Partido](${matchSearchUrl})`;

    // ==========================================
    // REGLAS GENERALES (APLICAN A TODAS LAS LIGAS)
    // ==========================================

    // --- REGLA 1: Tarjeta Roja ---
    if (elapsed < 60 && (isDraw || underdogWinning)) {
        const redCards = events.filter(e => e.type === 'Card' && (e.detail === 'Red Card' || e.detail === 'Yellow 2nd'));
        if (redCards.length > 0) {
            const teamWithRed = redCards[0].team.name;
            const teamWithAdvantage = teamWithRed === favorite.team ? underdog.team : favorite.team;
            
            let isDominating = true;
            if (hasStats) {
                const advPoss = getStat(teamWithAdvantage, 'Ball Possession');
                isDominating = advPoss >= 55;
            }
            
            if (isDominating) {
                const ruleId = `${fixtureId}_rule1`;
                if (!alertedMatches.has(ruleId)) {
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
    }

    // --- REGLA 8: Favorito Domina HT (Cualquier Empate) ---
    if (favorite.odd < 1.40 && isDraw) {
        if (fixture.fixture.status.short === 'HT' || elapsed === 45) {
            let isDominating = false;
            if (hasStats) {
                const favPoss = getStat(favorite.team, 'Ball Possession');
                const favShots = getStat(favorite.team, 'Shots on Goal');
                const favCorners = getStat(favorite.team, 'Corner Kicks');
                isDominating = favPoss >= 60 && (favShots >= 3 || favCorners >= 4);
            } else {
                isDominating = favorite.odd < 1.30; // Fallback: super favorito
            }

            if (isDominating) {
                const ruleId = `${fixtureId}_rule8`;
                if (!alertedMatches.has(ruleId)) {
                    const text = `⏳ *REGLA 8: FAVORITO DOMINA HT*
━━━━━━━━━━━━━━━━━━━━━━━━━━
${msgHeader}
⚠️ *Análisis:* El favorito (${favorite.team}) empata al medio tiempo pero domina estadísticamente.
━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 *Recomendación:* Gana Favorito 2da Mitad o Over Goles.
🎯 *Momio Objetivo Recomendado:* @1.60 o más`;
                    alerts.push({
                        text,
                        metadata: {
                            ruleId,
                            ruleType: 8,
                            ruleName: 'Favorito Domina HT',
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
    }

    /*
    // --- REGLA 3: Sorpresa Tempranera ---
    // DESACTIVADA [2026-08-18]: Esta regla tiene un Win Rate histórico del 59.6% según la auditoría de messages.html.
    // Su eliminación eleva la efectividad proyectada del bot al 81.68%.
    if (underdog.odd > 3.50 && elapsed >= 30 && elapsed <= 41 && underdogWinning) {
        let isMasacrado = false;
        if (hasStats) {
            const favPoss = getStat(favorite.team, 'Ball Possession');
            const favShots = getStat(favorite.team, 'Total Shots');
            isMasacrado = favPoss >= 70 && favShots >= 8;
        }
        if (isMasacrado) return alerts; // Abortamos la regla 3 si el favorito está arrasando
        const ruleId = `${fixtureId}_rule3`;
        if (!alertedMatches.has(ruleId)) {
            const text = `🔥 *REGLA 3: SORPRESA TEMPRANERA (30'+ STATS)*
 ━━━━━━━━━━━━━━━━━━━━━━━━━━
 ${msgHeader}
 ⚠️ *Análisis:* El underdog (${underdog.team}) ha tomado la ventaja. Se han acumulado 30+ min de datos estadísticos.
 ━━━━━━━━━━━━━━━━━━━━━━━━━━
 🎯 *Recomendación:* Ambos Anotan (BTTS), Próximo Gol del Favorito o Doble Chance (si la confianza de la IA es ≥75%).
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
                    minConfidence: 75,
                    scoreAtAlert: { home: homeGoals, away: awayGoals },
                    odds
                }
            });
            alertedMatches.add(ruleId);
        }
    }
    */

    // --- REGLA 4: Asedio (Late Goal) ---
    if (elapsed >= 75 && elapsed <= 83 && favorite.odd < 1.50 && favorite.goals <= underdog.goals && stats && stats.length > 0) {
        const teamStats = stats.find(s => s.team.name === favorite.team);
        if (teamStats && teamStats.statistics) {
            const totalShotsStat = teamStats.statistics.find(s => s.type === 'Total Shots');
            const possessionStat = teamStats.statistics.find(s => s.type === 'Ball Possession');
            
            const totalShots = totalShotsStat && totalShotsStat.value ? parseInt(totalShotsStat.value) : 0;
            const shotsOnGoal = getStat(favorite.team, 'Shots on Goal');
            const dangerousAttacks = getStat(favorite.team, 'Dangerous Attacks');
            const possessionStr = possessionStat && possessionStat.value ? possessionStat.value : "0%";
            const possession = parseInt(possessionStr.replace('%', ''));

            // Graceful fallback: si no reporta shots on goal, usamos el viejo > 15
            const asedioFuerte = (shotsOnGoal >= 4 && dangerousAttacks >= 25) || (totalShots >= 15);

            if (asedioFuerte || possession >= 70) {
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

    // --- REGLA 9: Gol Inminente Global ---
    if (hasStats && elapsed > 0) {
        const homeShotsOnGoal = getStat(fixture.teams.home.name, 'Shots on Goal');
        const awayShotsOnGoal = getStat(fixture.teams.away.name, 'Shots on Goal');
        const totalShotsOnGoal = homeShotsOnGoal + awayShotsOnGoal;
        
        // Dispara si el total de tiros a puerta supera 1 tiro cada 6 minutos (ej. 10 tiros al min 60)
        // Se requiere un mínimo de 5 tiros a puerta para evitar alertas prematuras en los primeros minutos.
        if (totalShotsOnGoal >= 5 && totalShotsOnGoal > (elapsed / 6)) {
            const ruleId = `${fixtureId}_rule9`;
            if (!alertedMatches.has(ruleId)) {
                const text = `💥 *REGLA 9: GOL INMINENTE GLOBAL*
━━━━━━━━━━━━━━━━━━━━━━━━━━
${msgHeader}
⚠️ *Análisis:* Partido muy abierto. Ambos equipos combinan *${totalShotsOnGoal}* tiros a puerta en ${elapsed} minutos.
━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 *Recomendación:* Over 0.5 Goles Adicionales / Más Goles.
🎯 *Momio Objetivo Recomendado:* @1.60 o más`;
                alerts.push({
                    text,
                    metadata: {
                        ruleId,
                        ruleType: 9,
                        ruleName: 'Gol Inminente Global',
                        fixtureId,
                        homeTeam: fixture.teams.home.name,
                        awayTeam: fixture.teams.away.name,
                        totalShotsOnGoal,
                        scoreAtAlert: { home: homeGoals, away: awayGoals },
                        totalGoalsAtAlert: homeGoals + awayGoals,
                        odds
                    }
                });
                alertedMatches.add(ruleId);
            }
        }
    }

    // ====================================================
    // REGLAS AVANZADAS (EXCLUSIVAS PARA LIGAS IMPORTANTES)
    // ====================================================
    if (isTopLeague) {

        // --- REGLA 5: HT Comeback (Remontada al Descanso) ---
        if ((fixture.fixture.status.short === 'HT' || elapsed === 45) && favorite.odd < 1.45 && favorite.goals === underdog.goals - 1) {
            let favDomina = true;
            if (hasStats) {
                const favCorners = getStat(favorite.team, 'Corner Kicks');
                const underCorners = getStat(underdog.team, 'Corner Kicks');
                const favShots = getStat(favorite.team, 'Shots on Goal');
                const underShots = getStat(underdog.team, 'Shots on Goal');
                if (underCorners > favCorners || underShots > favShots) {
                    favDomina = false;
                }
            }
            const ruleId = `${fixtureId}_rule5`;
            if (favDomina && !alertedMatches.has(ruleId)) {
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
        if (elapsed >= 25 && elapsed <= 45 && events && events.length > 0 && Math.abs(homeGoals - awayGoals) <= 1) {
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

        // Interceptar si la alerta nunca se envió al usuario debido al sistema SafeOdds
        if (meta.isSent === false) {
            continue;
        }

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
                    {
                        const isHomeRed = meta.teamWithRed === meta.homeTeam;
                        const teamRedWon = isHomeRed ? (finalHome > finalAway) : (finalAway > finalHome);
                        traditionalGreen = !teamRedWon;
                    }
                    break;
                case 2: // Favorito Sufre HT 0-0
                    traditionalGreen = (finalHome + finalAway) > 0;
                    break;
                case 3: // Sorpresa tempranera
                    {
                        const oddsHome = meta.odds ? meta.odds.home : 1;
                        const oddsAway = meta.odds ? meta.odds.away : 1;
                        const isHomeUnderdog = oddsHome > oddsAway;
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
                case 8: // Favorito Domina HT
                    traditionalGreen = (finalHome + finalAway) > (meta.scoreAtAlert.home + meta.scoreAtAlert.away);
                    break;
                case 9: // Gol Inminente Global
                    traditionalGreen = (finalHome + finalAway) > meta.totalGoalsAtAlert;
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

        let geminiOutcome = null;
        let deepseekOutcome = null;

        // Determinar si hay recomendaciones de IA válidas (evitando evaluar strings informativos de error como 'N/D')
        const isGeminiValid = meta.geminiRecommendation && 
                              !meta.geminiRecommendation.includes('N/D') && 
                              !meta.geminiRecommendation.toLowerCase().includes('no disponible');
                              
        const isDeepseekValid = meta.deepseekRecommendation && 
                                !meta.deepseekRecommendation.includes('N/D') && 
                                !meta.deepseekRecommendation.toLowerCase().includes('no disponible');

        if (isGeminiValid) {
            console.log(`[rulesEngine] Evaluando recomendación de Gemini para fútbol: "${meta.geminiRecommendation}"`);
            geminiOutcome = await aiService.evaluatePredictionOutcome('football', meta.geminiRecommendation, {
                fixture: finalFixture,
                events: finalEvents,
                stats: finalStats
            });
        }

        if (isDeepseekValid) {
            console.log(`[rulesEngine] Evaluando recomendación de DeepSeek para fútbol: "${meta.deepseekRecommendation}"`);
            deepseekOutcome = await aiService.evaluatePredictionOutcome('football', meta.deepseekRecommendation, {
                fixture: finalFixture,
                events: finalEvents,
                stats: finalStats
            });
        }

        // Definir el veredicto general (isGreen y explanation) según la IA activa
        let activeOutcome = null;
        const isActiveValid = meta.aiRecommendation && 
                              !meta.aiRecommendation.includes('N/D') && 
                              !meta.aiRecommendation.toLowerCase().includes('no disponible') &&
                              !meta.aiFallbackUsed;

        if (isActiveValid) {
            if (geminiOutcome && meta.aiRecommendation === meta.geminiRecommendation) {
                activeOutcome = geminiOutcome;
            } else if (deepseekOutcome && meta.aiRecommendation === meta.deepseekRecommendation) {
                activeOutcome = deepseekOutcome;
            } else {
                console.log(`[rulesEngine] Evaluando recomendación activa para fútbol: "${meta.aiRecommendation}"`);
                activeOutcome = await aiService.evaluatePredictionOutcome('football', meta.aiRecommendation, {
                    fixture: finalFixture,
                    events: finalEvents,
                    stats: finalStats
                });
            }
        }

        if (activeOutcome) {
            isGreen = activeOutcome.isGreen;
            explanation = activeOutcome.explanation;
            evaluatedByAI = true;
        } else if (geminiOutcome) {
            isGreen = geminiOutcome.isGreen;
            explanation = geminiOutcome.explanation;
            evaluatedByAI = true;
        } else if (deepseekOutcome) {
            isGreen = deepseekOutcome.isGreen;
            explanation = deepseekOutcome.explanation;
            evaluatedByAI = true;
        }

        if (!evaluatedByAI) {
            switch (meta.ruleType) {
            case 1: // Tarjeta roja estratégica
                // GREEN si el equipo perjudicado (teamWithRed) no ganó
                {
                    const isHomeRed = meta.teamWithRed === meta.homeTeam;
                    const teamRedWon = isHomeRed ? (finalHome > finalAway) : (finalAway > finalHome);
                    if (teamRedWon) {
                        isGreen = false;
                        explanation = `Marcador final: ${finalHome}-${finalAway}. El equipo con tarjeta roja (${meta.teamWithRed}) ganó el partido.`;
                    } else {
                        isGreen = true;
                        explanation = `Marcador final: ${finalHome}-${finalAway}. Alerta aprovechada tras la expulsión (el equipo perjudicado no ganó).`;
                    }
                }
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

        let msg = "";
        // Si ambos modelos de IA tuvieron recomendaciones válidas y al menos uno de ellos pudo evaluarse
        if (isGeminiValid && isDeepseekValid && (geminiOutcome || deepseekOutcome)) {
            const gIcon = geminiOutcome ? (geminiOutcome.isGreen ? '🟩 *GREEN*' : '🟥 *RED*') : '⚠️ *N/D*';
            const dsIcon = deepseekOutcome ? (deepseekOutcome.isGreen ? '🟩 *GREEN*' : '🟥 *RED*') : '⚠️ *N/D*';

            msg = `🏁 *VEREDICTO POST-PARTIDO - DUAL*\n\n` +
                  `⚽ *${meta.homeTeam}* ${finalHome} - ${finalAway} *${meta.awayTeam}*\n` +
                  `📋 *Regla:* ${meta.ruleName}\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `♊ *GOOGLE GEMINI: ${gIcon}*\n` +
                  `🎯 *Apuesta:* *${meta.geminiRecommendation}*\n` +
                  `💡 *Resultado:* ${geminiOutcome ? geminiOutcome.explanation : 'Evaluación no disponible'}\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `🐳 *DEEPSEEK: ${dsIcon}*\n` +
                  `🎯 *Apuesta:* *${meta.deepseekRecommendation}*\n` +
                  `💡 *Resultado:* ${deepseekOutcome ? deepseekOutcome.explanation : 'Evaluación no disponible'}`;
        } else {
            const icon = isGreen ? '🟩 *GREEN*' : '🟥 *RED*';
            msg = `🏁 *VEREDICTO POST-PARTIDO: ${icon}*\n\n⚽ *${meta.homeTeam}* ${finalHome} - ${finalAway} *${meta.awayTeam}*\n📋 *Regla:* ${meta.ruleName}\n💡 *Resultado:* ${explanation}`;
        }

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
