require('dotenv').config();
const { getMatchById, getMatchEvents, getMatchStatistics, getLiveOdds } = require('../apiClient');

async function run() {
    const fixtureId = 1530116; // Monterrey vs Orlando City SC
    console.log(`=== DETALLES RESUMIDOS DEL PARTIDO ${fixtureId} ===`);
    try {
        const match = await getMatchById(fixtureId);
        if (!match) {
            console.error("No se encontró el partido.");
            return;
        }
        console.log(`Partido: ${match.teams.home.name} vs ${match.teams.away.name}`);
        console.log(`Estado: ${match.fixture.status.long} (${match.fixture.status.short}) - ${match.fixture.status.elapsed}'`);
        console.log(`Marcador: ${match.goals.home}-${match.goals.away}`);

        const events = await getMatchEvents(fixtureId);
        console.log(`\n=== EVENTOS (${events ? events.length : 0}) ===`);
        if (events) {
            events.forEach(e => {
                console.log(`- [${e.time.elapsed}'] ${e.type} (${e.detail}) para ${e.team.name} - ${e.player ? e.player.name : 'N/A'}`);
            });
        }

        const liveOddsResponse = await getLiveOdds();
        let matchOdds = null;
        if (liveOddsResponse && liveOddsResponse.response) {
            const item = liveOddsResponse.response.find(r => r.fixture && r.fixture.id === fixtureId);
            if (item) matchOdds = item.odds;
        }
        console.log(`\n=== MERCADOS DISPONIBLES EN VIVO ===`);
        if (matchOdds) {
            matchOdds.forEach(o => {
                console.log(`- ID: ${o.id} | Name: ${o.name} | Values Count: ${o.values ? o.values.length : 0}`);
                // Imprimir valores de Fulltime Result, Double Chance y Goals Over/Under si existen
                if ([1, 59, 72, 25, 36].includes(o.id) || o.name.toLowerCase().includes('double chance') || o.name.toLowerCase().includes('winner')) {
                    o.values.forEach(v => {
                        console.log(`  └ Value: ${v.value} | Odd: ${v.odd} | Handicap: ${v.handicap} | Suspended: ${v.suspended}`);
                    });
                }
            });
        } else {
            console.log("No se encontraron momios en vivo para este partido.");
        }

    } catch (e) {
        console.error("Error obteniendo detalles:", e.message);
    }
}

run();
