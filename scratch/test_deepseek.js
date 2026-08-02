require('dotenv').config();
const axios = require('axios');

const mockMatchDataFootball = {
    homeTeam: "Real Madrid",
    awayTeam: "Barcelona",
    leagueName: "La Liga",
    leagueRound: "Jornada 32",
    elapsed: 78,
    score: { home: 0, away: 1 },
    odds: { home: 1.85, draw: 3.40, away: 4.20 },
    ruleName: "Asedio de Favorito Tarde",
    ruleDetails: "El favorito Real Madrid va perdiendo 0-1, juega en casa y el asedio en tiros de esquina/ataques peligrosos se ha intensificado desde el minuto 70.",
    stats: [
        {
            team: { name: "Real Madrid" },
            statistics: [
                { type: "Ball Possession", value: "65%" },
                { type: "Total Shots", value: 18 },
                { type: "Shots on Goal", value: 8 },
                { type: "Corner Kicks", value: 9 },
                { type: "Fouls", value: 12 },
                { type: "Yellow Cards", value: 1 },
                { type: "Red Cards", value: 0 }
            ]
        },
        {
            team: { name: "Barcelona" },
            statistics: [
                { type: "Ball Possession", value: "35%" },
                { type: "Total Shots", value: 6 },
                { type: "Shots on Goal", value: 2 },
                { type: "Corner Kicks", value: 2 },
                { type: "Fouls", value: 14 },
                { type: "Yellow Cards", value: 3 },
                { type: "Red Cards", value: 0 }
            ]
        }
    ],
    events: [
        {
            time: { elapsed: 42 },
            team: { name: "Barcelona" },
            player: { name: "Raphinha" },
            type: "Goal",
            detail: "Normal Goal"
        },
        {
            time: { elapsed: 65 },
            team: { name: "Barcelona" },
            player: { name: "Gavi" },
            type: "Card",
            detail: "Yellow Card"
        }
    ],
    lastMatchesHome: [
        {
            fixture: { date: "2026-07-15T20:00:00Z", status: { short: "FT" } },
            teams: { home: { name: "Real Madrid" }, away: { name: "Atletico Madrid" } },
            goals: { home: 2, away: 1 }
        },
        {
            fixture: { date: "2026-07-11T18:00:00Z", status: { short: "FT" } },
            teams: { home: { name: "Valencia" }, away: { name: "Real Madrid" } },
            goals: { home: 0, away: 2 }
        },
        {
            fixture: { date: "2026-07-08T21:00:00Z", status: { short: "FT" } },
            teams: { home: { name: "Real Madrid" }, away: { name: "Espanyol" } },
            goals: { home: 4, away: 1 }
        },
        {
            fixture: { date: "2026-07-04T19:00:00Z", status: { short: "FT" } },
            teams: { home: { name: "Real Betis" }, away: { name: "Real Madrid" } },
            goals: { home: 1, away: 1 }
        },
        {
            fixture: { date: "2026-07-01T20:00:00Z", status: { short: "FT" } },
            teams: { home: { name: "Real Madrid" }, away: { name: "Athletic Bilbao" } },
            goals: { home: 3, away: 0 }
        }
    ],
    lastMatchesAway: [
        {
            fixture: { date: "2026-07-16T20:00:00Z", status: { short: "FT" } },
            teams: { home: { name: "Barcelona" }, away: { name: "Osasuna" } },
            goals: { home: 3, away: 0 }
        },
        {
            fixture: { date: "2026-07-12T20:00:00Z", status: { short: "FT" } },
            teams: { home: { name: "Real Sociedad" }, away: { name: "Barcelona" } },
            goals: { home: 1, away: 2 }
        },
        {
            fixture: { date: "2026-07-09T19:00:00Z", status: { short: "FT" } },
            teams: { home: { name: "Barcelona" }, away: { name: "Sevilla" } },
            goals: { home: 2, away: 2 }
        },
        {
            fixture: { date: "2026-07-05T21:00:00Z", status: { short: "FT" } },
            teams: { home: { name: "Celta Vigo" }, away: { name: "Barcelona" } },
            goals: { home: 0, away: 1 }
        },
        {
            fixture: { date: "2026-07-02T19:00:00Z", status: { short: "FT" } },
            teams: { home: { name: "Getafe" }, away: { name: "Barcelona" } },
            goals: { home: 1, away: 3 }
        }
    ]
};

function formatFootballStats(stats) {
    if (!stats || stats.length === 0) return "Estadísticas del partido: No disponibles";
    const homeTeamStats = stats[0];
    const awayTeamStats = stats[1];
    const homeName = homeTeamStats.team.name;
    const awayName = awayTeamStats.team.name;
    const getStatVal = (teamStat, type) => {
        const item = teamStat.statistics.find(s => s.type === type);
        return item && item.value !== null && item.value !== undefined ? item.value : 0;
    };
    const homePossession = getStatVal(homeTeamStats, "Ball Possession") || "50%";
    const awayPossession = getStatVal(awayTeamStats, "Ball Possession") || "50%";
    const homeShots = getStatVal(homeTeamStats, "Total Shots");
    const awayShots = getStatVal(awayTeamStats, "Total Shots");
    const homeShotsOn = getStatVal(homeTeamStats, "Shots on Goal");
    const awayShotsOn = getStatVal(awayTeamStats, "Shots on Goal");
    const homeCorners = getStatVal(homeTeamStats, "Corner Kicks");
    const awayCorners = getStatVal(awayTeamStats, "Corner Kicks");
    const homeFouls = getStatVal(homeTeamStats, "Fouls");
    const awayFouls = getStatVal(awayTeamStats, "Fouls");
    const homeYellows = getStatVal(homeTeamStats, "Yellow Cards");
    const awayYellows = getStatVal(awayTeamStats, "Yellow Cards");
    const homeReds = getStatVal(homeTeamStats, "Red Cards");
    const awayReds = getStatVal(awayTeamStats, "Red Cards");

    return `📊 Estadísticas de juego en vivo:
- Posesión: ${homeName} ${homePossession} vs ${awayPossession} ${awayName}
- Tiros totales: ${homeName} ${homeShots} (${homeShotsOn} a puerta) vs ${awayShots} (${awayShotsOn} a puerta) ${awayName}
- Tiros de esquina: ${homeName} ${homeCorners} vs ${awayCorners} ${awayName}
- Faltas cometidas: ${homeName} ${homeFouls} vs ${awayFouls} ${awayName}
- Tarjetas: ${homeName} (🟨${homeYellows} / 🟥${homeReds}) vs (🟨${awayYellows} / 🟥${awayReds}) ${awayName}`;
}

function formatFootballEvents(events) {
    if (!events || events.length === 0) return "Ninguno relevante";
    const relevantEvents = events.filter(e => e.type === "Goal" || e.type === "Card");
    return relevantEvents.map(e => {
        const time = e.time.elapsed + (e.time.extra ? `+${e.time.extra}` : "");
        const team = e.team.name;
        const player = e.player ? e.player.name : "Jugador desconocido";
        if (e.type === "Goal") {
            return `⚽ [Min ${time}'] ¡GOL de ${team}! - ${player}`;
        } else if (e.type === "Card") {
            const cardEmoji = e.detail === "Red Card" ? "🟥" : "🟨";
            return `${cardEmoji} [Min ${time}'] Tarjeta para ${team} - ${player}`;
        }
    }).join("\n");
}

function formatLastMatches(teamName, matches) {
    if (!matches || matches.length === 0) return `Últimos partidos de ${teamName}: No disponibles`;
    return `Últimos partidos de ${teamName}:\n` + matches.map(m => {
        return `- [${m.fixture.date.split('T')[0]}] ${m.teams.home.name} ${m.goals.home} - ${m.goals.away} ${m.teams.away.name}`;
    }).join('\n');
}

function buildFootballPrompt(matchData) {
    const { homeTeam, awayTeam, leagueName, leagueRound, elapsed, score, odds, ruleName, ruleDetails, stats, events, lastMatchesHome, lastMatchesAway } = matchData;
    const statsStr = formatFootballStats(stats);
    const eventsStr = formatFootballEvents(events);
    const lastMatchesHomeStr = formatLastMatches(homeTeam, lastMatchesHome);
    const lastMatchesAwayStr = formatLastMatches(awayTeam, lastMatchesAway);

    return `Actúa como un analista profesional de apuestas deportivas de fútbol. Tu estilo de análisis DEBE ser formal, técnico, objetivo y preciso. Evita el lenguaje informal, coloquial o irreverente. Presenta la información de forma estructurada y analítica.

Analiza este partido de fútbol en vivo que acaba de activar una alerta estadística:
- Partido: ${homeTeam} vs ${awayTeam}
- Competición: ${leagueName}
- Ronda/Fase: ${leagueRound}
- Minuto actual: ${elapsed}'
- Marcador actual: ${score.home} - ${score.away}
- Momios iniciales: Local ${odds.home} | Empate ${odds.draw} | Visitante ${odds.away}
- Regla estadística activada: "${ruleName}"
- Motivo: ${ruleDetails}

${statsStr}

📋 Línea de Tiempo de Eventos:
${eventsStr}

📊 Rendimiento Histórico Reciente (Últimos 5 partidos):
${lastMatchesHomeStr}

${lastMatchesAwayStr}

Instrucciones para redactar la respuesta:
1. Realice un análisis formal de la dinámica de juego combinando las estadísticas en vivo con el rendimiento histórico reciente provisto de ambos equipos (máximo 3 líneas).
2. Proporcione una recomendación de apuesta concreta y de alta probabilidad basada en los datos analizados.
3. Sugiera un momio objetivo en vivo (mínimo @1.60 o superior).
4. Estime una probabilidad matemática/nivel de confianza de acierto para esta recomendación (entre 0% y 100%).

Formato de salida obligatorio (usa exactamente este formato en español, no alteres los títulos de las secciones, no uses negritas en los nombres de campo iniciales):

🧠 Análisis de IA: [Su análisis técnico y formal aquí]
🎯 Recomendación Inteligente: [Su recomendación técnica de apuesta aquí]
📈 Momio Sugerido: @[Momio sugerido aquí, mínimo 1.60]
🔥 Confianza Estimada: [Porcentaje]%`;
}

async function testDeepSeek() {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
        console.error("Error: DEEPSEEK_API_KEY no encontrada.");
        process.exit(1);
    }

    const prompt = buildFootballPrompt(mockMatchDataFootball);
    const modelsToTest = ['deepseek-chat', 'deepseek-v4-flash', 'deepseek-v4-pro'];

    for (const model of modelsToTest) {
        console.log(`\n--- Probando prompt masivo con modelo: ${model} ---`);
        try {
            const response = await axios.post('https://api.deepseek.com/chat/completions', {
                model: model,
                messages: [
                    { role: 'user', content: prompt }
                ],
                temperature: 0.85,
                max_tokens: 1000
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                timeout: 30000
            });

            console.log(`Éxito con ${model}!`);
            console.log("Respuesta:");
            console.log(response.data.choices[0].message.content);
        } catch (error) {
            console.error(`Fallo con ${model}:`, error.message);
            if (error.response) {
                console.error("Detalle:", error.response.status, error.response.data);
            }
        }
    }
}

testDeepSeek();
