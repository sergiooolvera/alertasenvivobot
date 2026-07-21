// Set para recordar de qué partidos ya enviamos qué alerta y no hacer spam
const alertedMatches = new Set();

function needsStats(fixture, odds) {
    const elapsed = fixture.fixture.status.elapsed;
    if (elapsed >= 75 && elapsed <= 83) {
        const homeGoals = fixture.goals.home || 0;
        const awayGoals = fixture.goals.away || 0;
        
        const favoriteOdd = odds.home < odds.away ? odds.home : odds.away;
        const favoriteGoals = odds.home < odds.away ? homeGoals : awayGoals;
        const underdogGoals = odds.home < odds.away ? awayGoals : homeGoals;
        
        if (favoriteOdd < 1.50 && favoriteGoals <= underdogGoals) {
            return true;
        }
    }
    return false;
}

function evaluateRules(fixture, odds, events, stats = []) {
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

    // Header común para hacer el mensaje más estético
    const msgHeader = `🏆 *LIGA:* ${leagueName}\n⚽ *${fixture.teams.home.name}* vs *${fixture.teams.away.name}*\n⏱️ *Minuto:* ${elapsed}'\n📊 *Marcador:* ${homeGoals} - ${awayGoals}\n💵 *Momios Iniciales:* Local ${odds.home} | Empate ${odds.draw} | Visita ${odds.away}`;

    // --- REGLA 1: Tarjeta Roja ---
    if (elapsed < 60 && (isDraw || underdogWinning)) {
        const redCards = events.filter(e => e.type === 'Card' && e.detail === 'Red Card');
        if (redCards.length > 0) {
            const ruleId = `${fixtureId}_rule1`;
            if (!alertedMatches.has(ruleId)) {
                const teamWithRed = redCards[0].team.name;
                alerts.push(`🟥 *REGLA 1: TARJETA ROJA ESTRATÉGICA*\n\n${msgHeader}\n\n⚠️ *Incidente:* Tarjeta roja para ${teamWithRed}`);
                alertedMatches.add(ruleId);
            }
        }
    }

    // --- REGLA 2: Favorito Sufre ---
    if (favorite.odd < 1.40 && homeGoals === 0 && awayGoals === 0) {
        if (fixture.fixture.status.short === 'HT' || elapsed === 45) {
            const ruleId = `${fixtureId}_rule2`;
            if (!alertedMatches.has(ruleId)) {
                alerts.push(`⏳ *REGLA 2: EL FAVORITO SUFRE*\n\n${msgHeader}\n\n⚠️ *Análisis:* El favorito (${favorite.team}) no puede anotar al medio tiempo.`);
                alertedMatches.add(ruleId);
            }
        }
    }

    // --- REGLA 3: Sorpresa Tempranera ---
    if (underdog.odd > 3.50 && elapsed < 60 && underdogWinning) {
        const ruleId = `${fixtureId}_rule3`;
        if (!alertedMatches.has(ruleId)) {
            alerts.push(`🔥 *REGLA 3: SORPRESA TEMPRANERA*\n\n${msgHeader}\n\n⚠️ *Análisis:* El underdog (${underdog.team}) ha tomado la ventaja.`);
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
                    alerts.push(`🚨 *REGLA 4: ASEDIO INTENSO (HUELE A GOL)*\n\n${msgHeader}\n\n⚠️ *Análisis:* El favorito (${favorite.team}) está atacando con todo: ${totalShots} tiros y ${possession}% de posesión. ¡Candidato a gol tardío!`);
                    alertedMatches.add(ruleId);
                }
            }
        }
    }

    return alerts;
}

module.exports = {
    evaluateRules,
    needsStats,
    alertedMatches
};
