const { evaluateRules } = require('./rulesEngine');

console.log("--- Iniciando Pruebas de Simulación de Reglas ---\n");

const matchTemplate = {
    fixture: { id: 1001, status: { elapsed: 0, short: '1H' } },
    league: { name: 'La Liga' },
    teams: { home: { name: 'Real Madrid' }, away: { name: 'Osasuna' } },
    goals: { home: 0, away: 0 }
};

const oddsTemplate = { home: 1.20, draw: 4.50, away: 8.00 }; // Favorito: Home, Underdog: Away

// ============================================
// Prueba 1: Regla 2 (Favorito Sufre 0-0 al MT)
// ============================================
let test1Match = JSON.parse(JSON.stringify(matchTemplate));
test1Match.fixture.status.elapsed = 45;
test1Match.fixture.status.short = 'HT';
console.log("Prueba 1: Favorito empata 0-0 al medio tiempo");
let alerts1 = evaluateRules(test1Match, oddsTemplate, []);
console.log(alerts1.length > 0 ? `✅ Éxito:\n${alerts1.join('\n')}` : "❌ Falló");

// ============================================
// Prueba 2: Regla 3 (Sorpresa Tempranera)
// ============================================
let test2Match = JSON.parse(JSON.stringify(matchTemplate));
test2Match.fixture.status.elapsed = 30;
test2Match.goals.away = 1; // Underdog anota
console.log("\nPrueba 2: Underdog toma ventaja al minuto 30");
let alerts2 = evaluateRules(test2Match, oddsTemplate, []);
console.log(alerts2.length > 0 ? `✅ Éxito:\n${alerts2.join('\n')}` : "❌ Falló");

// ============================================
// Prueba 3: Regla 1 (Roja + Empate)
// ============================================
let test3Match = JSON.parse(JSON.stringify(matchTemplate));
test3Match.fixture.id = 1002;
test3Match.fixture.status.elapsed = 55;
test3Match.goals.home = 1;
test3Match.goals.away = 1; // Empate
let events = [ { type: 'Card', detail: 'Red Card', team: { name: 'Real Madrid' } } ];
console.log("\nPrueba 3: Roja al minuto 55 con partido empatado");
let alerts3 = evaluateRules(test3Match, oddsTemplate, events);
console.log(alerts3.length > 0 ? `✅ Éxito:\n${alerts3.join('\n')}` : "❌ Falló");

// ============================================
// Prueba 4: Regla 4 (Asedio Min 80)
// ============================================
let test4Match = JSON.parse(JSON.stringify(matchTemplate));
test4Match.fixture.id = 1003;
test4Match.fixture.status.elapsed = 80; // Entre 75 y 83
test4Match.goals.home = 0;
test4Match.goals.away = 1; // Favorito perdiendo
let stats = [
    {
        team: { name: 'Real Madrid' },
        statistics: [
            { type: 'Total Shots', value: 15 }, // Más de 12
            { type: 'Ball Possession', value: '70%' } // Más del 65%
        ]
    }
];
console.log("\nPrueba 4: Favorito perdiendo al min 80 con intenso asedio (15 tiros, 70% pos)");
let alerts4 = evaluateRules(test4Match, oddsTemplate, [], stats);
console.log(alerts4.length > 0 ? `✅ Éxito:\n${alerts4.join('\n')}` : "❌ Falló");

console.log("\n--- Pruebas finalizadas ---");
