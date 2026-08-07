const { getLiveMatches, getMatchesByDate, getLiveOdds } = require('../apiClient');

async function check() {
  console.log("=== RESUMEN ULYTAU VS FC ASTANA ===");
  
  // 1. Buscar en partidos en vivo
  const liveMatches = await getLiveMatches();
  const targetLive = liveMatches.find(m => {
    const home = m.teams.home.name.toLowerCase();
    const away = m.teams.away.name.toLowerCase();
    return home.includes('ulytau') || away.includes('ulytau') || home.includes('astana') || away.includes('astana');
  });

  if (targetLive) {
    console.log("Partido EN VIVO encontrado:");
    console.log(`- ID: ${targetLive.fixture.id}`);
    console.log(`- Liga: ${targetLive.league.name} (${targetLive.league.country})`);
    console.log(`- Partido: ${targetLive.teams.home.name} vs ${targetLive.teams.away.name}`);
    console.log(`- Tiempo: ${targetLive.fixture.status.elapsed}' (${targetLive.fixture.status.long})`);
    console.log(`- Marcador: ${targetLive.goals.home} - ${targetLive.goals.away}`);
    
    // Obtener momios en vivo
    const liveOddsResponse = await getLiveOdds();
    if (liveOddsResponse && liveOddsResponse.response) {
      const matchOdds = liveOddsResponse.response.find(o => o.fixture.id === targetLive.fixture.id);
      if (matchOdds && matchOdds.odds) {
        console.log("\nMomios en vivo disponibles:");
        matchOdds.odds.forEach(o => {
          // Mostrar solo los más relevantes para no saturar
          if ([1, 2, 48, 69].includes(o.id)) { // Match Winner, Goals Over/Under, Draw No Bet, BTTS
            console.log(`\n* Mercado: ${o.name} (ID: ${o.id})`);
            o.values.forEach(v => {
              console.log(`  - ${v.value}: ${v.odd}${v.handicap ? ' (Handicap: ' + v.handicap + ')' : ''}${v.suspended ? ' [SUSPENDIDO]' : ''}`);
            });
          }
        });
      } else {
        console.log("\nNo se encontraron momios en vivo activos para este fixture en /odds/live.");
      }
    }
  } else {
    console.log("El partido no se encuentra actualmente activo en getLiveMatches().");
    
    // Buscar programados de hoy
    const todayMatches = await getMatchesByDate('2026-08-02');
    const targetToday = todayMatches.filter(m => {
      const home = m.teams.home.name.toLowerCase();
      const away = m.teams.away.name.toLowerCase();
      return home.includes('ulytau') || away.includes('ulytau') || home.includes('astana') || away.includes('astana');
    });
    
    if (targetToday.length > 0) {
      console.log("\nPartidos programados para hoy:");
      targetToday.forEach(m => {
        console.log(`- ID: ${m.fixture.id} | ${m.teams.home.name} vs ${m.teams.away.name} | Estado: ${m.fixture.status.short} (${m.fixture.status.long}) | Marcador: ${m.goals.home}-${m.goals.away} | Fecha: ${m.fixture.date}`);
      });
    } else {
      console.log("\nTampoco se encontró programado en el calendario de hoy.");
    }
  }
}

check().catch(console.error);
