const aiService = require('../aiService');

const mockMatchData = {
    homeTeam: 'Real Madrid',
    awayTeam: 'Barcelona',
    leagueName: 'La Liga',
    leagueRound: 'Jornada 25',
    elapsed: 65,
    score: { home: 1, away: 0 },
    odds: { home: 1.85, draw: 3.50, away: 4.00 },
    ruleName: 'Presión Alta + Tarjeta Roja',
    ruleDetails: 'Barcelona con tarjeta roja al min 50. Real Madrid domina posesión y tiros al arco.',
    stats: [
        { team: { name: 'Real Madrid' }, statistics: [{ type: 'Ball Possession', value: '62%' }, { type: 'Shots on Goal', value: 8 }] },
        { team: { name: 'Barcelona' }, statistics: [{ type: 'Ball Possession', value: '38%' }, { type: 'Shots on Goal', value: 2 }] }
    ],
    events: [
        { time: { elapsed: 50 }, team: { name: 'Barcelona' }, type: 'Card', detail: 'Red Card' },
        { time: { elapsed: 58 }, team: { name: 'Real Madrid' }, type: 'Goal', detail: 'Normal Goal' }
    ],
    lastMatchesHome: [
        { fixture: { date: '2026-02-28T20:00:00Z', status: { short: 'FT' } }, teams: { home: { name: 'Real Madrid' }, away: { name: 'Sevilla' } }, goals: { home: 2, away: 1 } },
        { fixture: { date: '2026-02-21T20:00:00Z', status: { short: 'FT' } }, teams: { home: { name: 'Valencia' }, away: { name: 'Real Madrid' } }, goals: { home: 0, away: 2 } }
    ],
    lastMatchesHomeSpecific: [
        { fixture: { date: '2026-02-28T20:00:00Z', status: { short: 'FT' } }, teams: { home: { name: 'Real Madrid' }, away: { name: 'Sevilla' } }, goals: { home: 2, away: 1 } },
        { fixture: { date: '2026-02-14T20:00:00Z', status: { short: 'FT' } }, teams: { home: { name: 'Real Madrid' }, away: { name: 'Getafe' } }, goals: { home: 3, away: 0 } }
    ],
    lastMatchesAway: [
        { fixture: { date: '2026-03-01T20:00:00Z', status: { short: 'FT' } }, teams: { home: { name: 'Barcelona' }, away: { name: 'Athletic Club' } }, goals: { home: 1, away: 1 } },
        { fixture: { date: '2026-02-22T20:00:00Z', status: { short: 'FT' } }, teams: { home: { name: 'Celta Vigo' }, away: { name: 'Barcelona' } }, goals: { home: 2, away: 1 } }
    ],
    lastMatchesAwaySpecific: [
        { fixture: { date: '2026-02-22T20:00:00Z', status: { short: 'FT' } }, teams: { home: { name: 'Celta Vigo' }, away: { name: 'Barcelona' } }, goals: { home: 2, away: 1 } },
        { fixture: { date: '2026-02-08T20:00:00Z', status: { short: 'FT' } }, teams: { home: { name: 'Real Betis' }, away: { name: 'Barcelona' } }, goals: { home: 1, away: 0 } }
    ],
    h2hMatches: [
        { fixture: { date: '2025-10-26T20:00:00Z', status: { short: 'FT' } }, teams: { home: { name: 'Real Madrid' }, away: { name: 'Barcelona' } }, goals: { home: 3, away: 1 } }
    ],
    standingsInfo: { homeRank: 1, awayRank: 3 }
};

console.log("--- TEST FORMATTED FOOTBALL PROMPT ---");
const prompt = aiService.buildFootballPrompt(mockMatchData);
console.log(prompt);

console.log("\n--- TEST FORMATTED DAILY PARLAY PROMPT ---");
const parlayPrompt = aiService.buildDailyParlayPrompt([mockMatchData]);
console.log(parlayPrompt);

console.log("\n--- VERIFICACIÓN EXITOSA ---");
