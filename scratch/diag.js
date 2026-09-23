const { getLiveMatches, getMatchesByDate } = require('../apiClient');
const { isMajorLeague, isWithinActiveHours } = require('../config');
const { evaluateRules } = require('../rulesEngine');

async function testDiagnosis() {
  console.log("=== DIAGNÓSTICO DEL BOT ===");
  console.log("Fecha/hora actual JS:", new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" }));
  console.log("¿Está dentro de horario activo (7 AM - 9 PM CDMX)?:", isWithinActiveHours());

  console.log("\n1. Consultando partidos en vivo (live=all)...");
  try {
    const liveMatches = await getLiveMatches();
    console.log(`Total de partidos en vivo devueltos por la API: ${liveMatches.length}`);

    if (liveMatches.length > 0) {
      console.log("\nPrimeros 5 partidos en vivo:");
      liveMatches.slice(0, 5).forEach(m => {
        console.log(`- [Fixture ${m.fixture.id}] ${m.teams.home.name} ${m.goals.home} - ${m.goals.away} ${m.teams.away.name} | Liga: [${m.league.id}] ${m.league.name} (${m.league.country}) | Min: ${m.fixture.status.elapsed}' (Status: ${m.fixture.status.short})`);
      });

      const majorLive = liveMatches.filter(m => isMajorLeague(m.league));
      console.log(`\nPartidos en vivo en Ligas Principales (Major Leagues): ${majorLive.length}`);
      majorLive.forEach(m => {
        console.log(`  * [Fixture ${m.fixture.id}] ${m.teams.home.name} ${m.goals.home} - ${m.goals.away} ${m.teams.away.name} | Liga: [${m.league.id}] ${m.league.name} | Min: ${m.fixture.status.elapsed}'`);
      });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    console.log(`\n2. Consultando partidos del día de hoy (${todayStr})...`);
    const todayMatches = await getMatchesByDate(todayStr);
    console.log(`Total de partidos programados hoy devueltos por la API: ${todayMatches.length}`);

    const majorToday = todayMatches.filter(m => isMajorLeague(m.league));
    console.log(`Total de partidos en Ligas Principales hoy: ${majorToday.length}`);
    if (majorToday.length > 0) {
      console.log("Primeros 10 partidos en ligas principales hoy:");
      majorToday.slice(0, 10).forEach(m => {
        console.log(`- [${m.fixture.status.short}] ${m.teams.home.name} vs ${m.teams.away.name} | Liga: ${m.league.name} | Hora: ${new Date(m.fixture.date).toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City" })}`);
      });
    }

  } catch (err) {
    console.error("Error durante el diagnóstico:", err);
  }
}

testDiagnosis();
