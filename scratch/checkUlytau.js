const { getLiveMatches, getMatchesByDate, getLiveOdds, getMatchById } = require('../apiClient');

async function check() {
  console.log("=== INICIANDO BÚSQUEDA DE ULYTAU VS FC ASTANA ===");
  
  // 1. Intentar obtener partidos en vivo
  console.log("\n1. Consultando partidos en vivo...");
  const liveMatches = await getLiveMatches();
  console.log(`Se obtuvieron ${liveMatches.length} partidos en vivo.`);
  
  const targetLive = liveMatches.find(m => {
    const home = m.teams.home.name.toLowerCase();
    const away = m.teams.away.name.toLowerCase();
    return home.includes('ulytau') || away.includes('ulytau') || home.includes('astana') || away.includes('astana');
  });

  if (targetLive) {
    console.log("¡Partido encontrado en vivo!");
    console.log(JSON.stringify(targetLive, null, 2));
  } else {
    console.log("No se encontró el partido en vivo mediante getLiveMatches().");
  }

  // 2. Consultar partidos de hoy (2026-08-02)
  console.log("\n2. Consultando partidos programados para hoy (2026-08-02)...");
  const todayMatches = await getMatchesByDate('2026-08-02');
  console.log(`Se obtuvieron ${todayMatches.length} partidos para el día de hoy.`);
  
  const targetToday = todayMatches.filter(m => {
    const home = m.teams.home.name.toLowerCase();
    const away = m.teams.away.name.toLowerCase();
    return home.includes('ulytau') || away.includes('ulytau') || home.includes('astana') || away.includes('astana');
  });

  if (targetToday.length > 0) {
    console.log(`Se encontraron ${targetToday.length} partidos coincidentes hoy:`);
    targetToday.forEach(m => {
      console.log(`- ID: ${m.fixture.id} | ${m.teams.home.name} vs ${m.teams.away.name} | Estado: ${m.fixture.status.short} (${m.fixture.status.long}) | Marcador: ${m.goals.home}-${m.goals.away} | Fecha: ${m.fixture.date}`);
    });
  } else {
    console.log("No se encontró ningún partido de Ulytau o Astana programado para hoy.");
  }

  // 3. Consultar momios en vivo generales
  console.log("\n3. Consultando momios en vivo generales (/odds/live)...");
  const liveOddsResponse = await getLiveOdds();
  if (liveOddsResponse && liveOddsResponse.response) {
    console.log(`Se obtuvieron ${liveOddsResponse.response.length} momios en vivo.`);
    const targetOdds = liveOddsResponse.response.find(o => {
      if (targetToday.some(todayMatch => todayMatch.fixture.id === o.fixture.id)) {
        return true;
      }
      return false;
    });
    if (targetOdds) {
      console.log("¡Momios en vivo encontrados para el partido!");
      console.log(JSON.stringify(targetOdds, null, 2));
    } else {
      console.log("No se encontraron momios en vivo asociados a los IDs de partidos encontrados.");
    }
  } else {
    console.log("No se pudieron obtener los momios en vivo generales o no retornó datos.");
  }
}

check().catch(console.error);
