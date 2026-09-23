const { getLiveMatches, getMatchEvents, getPreMatchOdds, getMatchStatistics } = require('../apiClient');
const { evaluateRules, needsStats, needsEvents } = require('../rulesEngine');
const { isMajorLeague } = require('../config');

async function checkNow() {
  console.log("=== EVALUACIÓN EN VIVO DE REGLAS ===");
  const liveMatches = await getLiveMatches();
  console.log(`Total de partidos en vivo: ${liveMatches.length}`);

  let ruleMatchesCount = 0;
  for (const match of liveMatches) {
    const isTop = isMajorLeague(match.league);
    const odds = await getPreMatchOdds(match.fixture.id);
    if (!odds) {
      console.log(`[Fixture ${match.fixture.id}] ${match.teams.home.name} vs ${match.teams.away.name} - Sin momios pre-partido.`);
      continue;
    }

    let events = [];
    if (needsEvents(match, odds, isTop)) {
      events = (await getMatchEvents(match.fixture.id)) || [];
    }

    let stats = [];
    if (needsStats(match, odds, isTop)) {
      stats = (await getMatchStatistics(match.fixture.id)) || [];
    }

    const alerts = evaluateRules(match, odds, events, stats, isTop);
    if (alerts.length > 0) {
      ruleMatchesCount++;
      console.log(`\n🚨 ¡ALERTA GENERADA! [Fixture ${match.fixture.id}] ${match.teams.home.name} vs ${match.teams.away.name}`);
      alerts.forEach(a => console.log(a.text));
    }
  }

  if (ruleMatchesCount === 0) {
    console.log("\nNingún partido en vivo cumple los criterios de las 7 reglas en este momento exacto.");
  }
}

checkNow();
