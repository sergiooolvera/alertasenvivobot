require('dotenv').config();
const { getLiveMatches, getPreMatchOdds, getLiveOdds } = require('../apiClient');
const { isMajorLeague } = require('../config');

async function run() {
    console.log("=== AUDITANDO ESTADO EN VIVO DE LA API ===");
    try {
        const liveMatches = await getLiveMatches();
        console.log(`Partidos en vivo detectados por getLiveMatches(): ${liveMatches.length}`);
        
        const liveOddsResponse = await getLiveOdds();
        const liveOddsMap = new Map();
        if (liveOddsResponse && liveOddsResponse.response) {
            liveOddsResponse.response.forEach(item => {
                if (item.fixture && item.fixture.id) {
                    liveOddsMap.set(item.fixture.id, item.odds);
                }
            });
        }
        console.log(`Momios en vivo de /odds/live mapeados: ${liveOddsMap.size}`);

        for (const match of liveMatches) {
            const fixtureId = match.fixture.id;
            const home = match.teams.home.name;
            const away = match.teams.away.name;
            const leagueName = match.league ? match.league.name : 'N/A';
            const isTop = isMajorLeague(match.league);
            const elapsed = match.fixture.status.elapsed;
            const score = `${match.goals.home}-${match.goals.away}`;
            
            console.log(`\n⚽ Partido: ${home} vs ${away} (ID: ${fixtureId})`);
            console.log(`- Liga: ${leagueName} (Top: ${isTop})`);
            console.log(`- Minuto: ${elapsed}' | Marcador: ${score}`);
            
            const preMatchOdds = await getPreMatchOdds(fixtureId);
            console.log(`- Momios Pre-Partido:`, preMatchOdds);
            
            const hasLiveOdds = liveOddsMap.has(fixtureId);
            console.log(`- ¿Tiene momios en vivo en la API? ${hasLiveOdds ? 'SÍ' : 'NO'}`);
        }
    } catch (error) {
        console.error("Error ejecutando la auditoría:", error.message);
    }
}

run();
