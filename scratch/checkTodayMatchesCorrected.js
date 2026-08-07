require('dotenv').config();
const { getMatchesByDate, getPreMatchOdds, getMatchEvents, getMatchStatistics } = require('../apiClient');
const { evaluateRules } = require('../rulesEngine');
const { isMajorLeague } = require('../config');

async function run() {
    const targetDateLocal = '2026-08-05'; // Queremos auditar hoy 5 de agosto
    console.log(`=== AUDITANDO PARTIDOS REALES DE HOY (${targetDateLocal}) ENTRE 12:00 PM Y 7:00 PM CST ===`);
    
    try {
        // Consultamos hoy y mañana (UTC) para capturar los partidos de la tarde local
        const matchesDay1 = await getMatchesByDate('2026-08-05');
        const matchesDay2 = await getMatchesByDate('2026-08-06');
        const allMatches = [...matchesDay1, ...matchesDay2];
        
        console.log(`Total partidos devueltos por la API para 5 y 6 de agosto (UTC): ${allMatches.length}`);
        
        // Filtrar partidos que iniciaron localmente el 5 de agosto entre las 12:00 PM y las 7:00 PM CST
        const filteredMatches = allMatches.filter(m => {
            const date = new Date(m.fixture.date);
            
            // Obtener la fecha local en America/Mexico_City
            const dateLocalStr = date.toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' }); // YYYY-MM-DD
            
            // Obtener la hora local en America/Mexico_City
            const hourStr = date.toLocaleTimeString('en-US', { timeZone: 'America/Mexico_City', hour: '2-digit', hour12: false });
            const hourCST = parseInt(hourStr, 10);
            
            return dateLocalStr === targetDateLocal && hourCST >= 12 && hourCST < 19;
        });

        console.log(`Partidos que iniciaron localmente hoy entre las 12:00 PM y las 7:00 PM CST: ${filteredMatches.length}`);
        
        let checkedCount = 0;
        let evaluatedAlertsCount = 0;

        for (const match of filteredMatches) {
            checkedCount++;
            const fixtureId = match.fixture.id;
            const home = match.teams.home.name;
            const away = match.teams.away.name;
            const leagueName = match.league ? match.league.name : 'N/A';
            const status = match.fixture.status.short; 
            const score = `${match.goals.home}-${match.goals.away}`;
            const date = new Date(match.fixture.date);
            const timeStr = date.toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit' });

            console.log(`\n------------------------------------------------------------`);
            console.log(`[${timeStr}] ⚽ ${home} vs ${away} (ID: ${fixtureId}) - Estado: ${status} | Marcador: ${score}`);
            console.log(`- Liga: ${leagueName} (Top: ${isMajorLeague(match.league)})`);

            // Obtener momios pre-partido
            const preMatchOdds = await getPreMatchOdds(fixtureId);
            if (!preMatchOdds) {
                console.log(`- ⚠️ Sin momios pre-partido en la API (Ignorado por el bot).`);
                continue;
            }
            console.log(`- Momios: 🏠 ${preMatchOdds.home} | 🤝 ${preMatchOdds.draw} | 🚀 ${preMatchOdds.away}`);

            // Obtener eventos y estadísticas
            const events = await getMatchEvents(fixtureId);
            const stats = await getMatchStatistics(fixtureId);
            const isTop = isMajorLeague(match.league);

            console.log(`- Eventos en vivo: ${events.length} registrados`);
            console.log(`- Estadísticas en vivo: ${stats.length} equipos registrados`);

            // Evaluamos con el estado actual
            const alerts = evaluateRules(match, preMatchOdds, events, stats, isTop);
            if (alerts.length > 0) {
                evaluatedAlertsCount += alerts.length;
                console.log(`- 🔔 ALERTA DETECTADA EN EVALUACIÓN ACTUAL:`);
                alerts.forEach(a => console.log(`  * Regla: ${a.metadata.ruleName}`));
            } else {
                console.log(`- 🔕 No se detectó ninguna alerta con el estado actual.`);
                
                // Si el partido está en juego o finalizado, simular HT
                if (status === 'FT' || status === '2H' || status === 'AET' || status === 'PEN') {
                    console.log(`- Simulando estado al medio tiempo (HT) para evaluar Reglas HT...`);
                    let htHomeGoals = 0;
                    let htAwayGoals = 0;
                    events.forEach(e => {
                        if (e.type === 'Goal' && e.time.elapsed <= 45) {
                            if (e.team.name === home) htHomeGoals++;
                            else htAwayGoals++;
                        }
                    });
                    
                    const simulatedHTMatch = JSON.parse(JSON.stringify(match));
                    simulatedHTMatch.fixture.status.elapsed = 45;
                    simulatedHTMatch.fixture.status.short = 'HT';
                    simulatedHTMatch.goals.home = htHomeGoals;
                    simulatedHTMatch.goals.away = htAwayGoals;
                    
                    const htAlerts = evaluateRules(simulatedHTMatch, preMatchOdds, events, stats, isTop);
                    if (htAlerts.length > 0) {
                        evaluatedAlertsCount += htAlerts.length;
                        console.log(`  * 🔔 ALERTA DETECTADA AL SIMULAR HT:`);
                        htAlerts.forEach(a => console.log(`    - Regla: ${a.metadata.ruleName} (marcador HT: ${htHomeGoals}-${htAwayGoals})`));
                    } else {
                        console.log(`  * Tampoco se detectó ninguna alerta al simular el HT (${htHomeGoals}-${htAwayGoals}).`);
                    }
                }
            }
        }
        
        console.log(`\n============================================================`);
        console.log(`Resumen de auditoría para hoy 5 de agosto:`);
        console.log(`- Partidos procesados en el rango: ${checkedCount}`);
        console.log(`- Alertas totales que debieron dispararse: ${evaluatedAlertsCount}`);
    } catch (error) {
        console.error("Error en la ejecución:", error.message);
    }
}

run();
