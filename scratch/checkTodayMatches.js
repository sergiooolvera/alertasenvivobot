require('dotenv').config();
const { getMatchesByDate, getPreMatchOdds, getMatchEvents, getMatchStatistics } = require('../apiClient');
const { evaluateRules } = require('../rulesEngine');
const { isMajorLeague } = require('../config');

// Obtener fecha de hoy en formato YYYY-MM-DD (CST)
function getTodayString() {
    const d = new Date();
    // Convertir a hora de México (-6) para asegurar que sea consistente
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const mxDate = new Date(utc + (3600000 * -6));
    const year = mxDate.getFullYear();
    const month = String(mxDate.getMonth() + 1).padStart(2, '0');
    const day = String(mxDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function run() {
    const today = getTodayString();
    console.log(`=== AUDITANDO PARTIDOS DE HOY (${today}) DESDE LAS 7:00 AM HASTA LAS 4:00 PM CST ===`);
    try {
        const matches = await getMatchesByDate(today);
        console.log(`Total partidos devueltos por la API para hoy: ${matches.length}`);
        
        // Filtrar partidos que iniciaron hoy entre las 7:00 AM y las 4:00 PM CST (13:00 a 22:00 UTC)
        const filteredMatches = matches.filter(m => {
            const date = new Date(m.fixture.date);
            
            // Obtener la hora local en America/Mexico_City
            const hourStr = date.toLocaleTimeString('en-US', { timeZone: 'America/Mexico_City', hour: '2-digit', hour12: false });
            const hourCST = parseInt(hourStr, 10);
            
            // Obtener la fecha local en America/Mexico_City
            const dateLocalStr = date.toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' }); // sv-SE devuelve YYYY-MM-DD
            
            return dateLocalStr === today && hourCST >= 7 && hourCST < 16;
        });

        console.log(`Partidos iniciados en el rango de auditoría de hoy: ${filteredMatches.length}`);
        
        let checkedCount = 0;
        let evaluatedAlertsCount = 0;

        for (const match of filteredMatches) {
            checkedCount++;
            const fixtureId = match.fixture.id;
            const home = match.teams.home.name;
            const away = match.teams.away.name;
            const leagueName = match.league ? match.league.name : 'N/A';
            const status = match.fixture.status.short; // FT, HT, 1H, 2H, etc.
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

            // Obtener eventos y estadísticas en vivo
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
                
                // Si el partido está finalizado (FT) o en el segundo tiempo, simulamos cómo estaba al HT (Medio Tiempo)
                if (status === 'FT' || status === '2H') {
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
        console.log(`Resumen de auditoría:`);
        console.log(`- Partidos procesados en el rango: ${checkedCount}`);
        console.log(`- Alertas totales que debieron dispararse: ${evaluatedAlertsCount}`);
    } catch (error) {
        console.error("Error en la ejecución:", error.message);
    }
}

run();
