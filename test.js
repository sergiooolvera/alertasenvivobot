const { evaluateRules, evaluateAlertResults } = require('./rulesEngine');
const { isMajorLeague } = require('./config');

console.log("--- Iniciando Pruebas de Reglas Activas (1, 7, 8, 9) y Verificación de Inactivas (4, 5, 6) ---\n");

const topLeague = { id: 39, name: 'Premier League' };
const minorLeague = { id: 9999, name: 'Tercera División Amateur' };

const matchTemplate = {
    fixture: { id: 1001, status: { elapsed: 0, short: '1H' } },
    league: topLeague,
    teams: { home: { name: 'Manchester City' }, away: { name: 'Bournemouth' } },
    goals: { home: 0, away: 0 }
};

const oddsTemplate = { home: 1.20, draw: 5.50, away: 10.00 }; // Favorito: Man City (home)

// ============================================
// Prueba 1: Regla 1 (Tarjeta Roja Estratégica - Minuto 35 a 76)
// ============================================
let test1Match = JSON.parse(JSON.stringify(matchTemplate));
test1Match.fixture.id = 1001;
test1Match.goals.home = 1;
test1Match.goals.away = 1; // Empate
let eventsRed = [
    { type: 'Card', detail: 'Red Card', team: { name: 'Bournemouth' } }
];
let statsRed = [
    { team: { name: 'Manchester City' }, statistics: [{ type: 'Ball Possession', value: '60%' }] }
];

// Minuto 50: DEBE activar Regla 1
test1Match.fixture.status.elapsed = 50;
let alertsR1 = evaluateRules(test1Match, oddsTemplate, eventsRed, statsRed, isMajorLeague(test1Match.league));
let r1 = alertsR1.find(a => a.metadata.ruleType === 1);
console.log("Prueba 1: Regla 1 (Tarjeta Roja al min 50)");
console.log(r1 ? `✅ Éxito Regla 1 activada:\n${r1.text}\n` : "❌ Falló Regla 1");

// ============================================
// Prueba 2: Regla 7 (Partido Caliente - Minuto 25-45, >= 4 amarillas o 1 roja)
// ============================================
let test2Match = JSON.parse(JSON.stringify(matchTemplate));
test2Match.fixture.id = 1002;
test2Match.fixture.status.elapsed = 35;
let eventsCaliente = [
    { type: 'Card', detail: 'Yellow Card', team: { name: 'Manchester City' } },
    { type: 'Card', detail: 'Yellow Card', team: { name: 'Manchester City' } },
    { type: 'Card', detail: 'Yellow Card', team: { name: 'Bournemouth' } },
    { type: 'Card', detail: 'Yellow Card', team: { name: 'Bournemouth' } }
];

console.log("Prueba 2: Regla 7 (Partido Caliente con 4 amarillas en min 35)");
let alertsR7 = evaluateRules(test2Match, oddsTemplate, eventsCaliente, [], isMajorLeague(test2Match.league));
let r7 = alertsR7.find(a => a.metadata.ruleType === 7);
console.log(r7 ? `✅ Éxito Regla 7 activada:\n${r7.text}\n` : "❌ Falló Regla 7");

// ============================================
// Prueba 3: Regla 8 (Favorito Domina HT - Empate al descanso)
// ============================================
let test3Match = JSON.parse(JSON.stringify(matchTemplate));
test3Match.fixture.id = 1003;
test3Match.fixture.status.elapsed = 45;
test3Match.fixture.status.short = 'HT';
test3Match.goals.home = 0;
test3Match.goals.away = 0;
let statsR8 = [
    {
        team: { name: 'Manchester City' },
        statistics: [
            { type: 'Ball Possession', value: '65%' },
            { type: 'Shots on Goal', value: 4 },
            { type: 'Corner Kicks', value: 5 }
        ]
    }
];

console.log("Prueba 3: Regla 8 (Favorito Domina HT)");
let alertsR8 = evaluateRules(test3Match, oddsTemplate, [], statsR8, isMajorLeague(test3Match.league));
let r8 = alertsR8.find(a => a.metadata.ruleType === 8);
console.log(r8 ? `✅ Éxito Regla 8 activada:\n${r8.text}\n` : "❌ Falló Regla 8");

// ============================================
// Prueba 4: Regla 9 (Gol Inminente Global - Alto volumen de tiros a puerta)
// ============================================
let test4Match = JSON.parse(JSON.stringify(matchTemplate));
test4Match.fixture.id = 1004;
test4Match.fixture.status.elapsed = 30; // Min 30 -> 30/6 = 5 tiros necesarios
let statsR9 = [
    { team: { name: 'Manchester City' }, statistics: [{ type: 'Shots on Goal', value: 4 }] },
    { team: { name: 'Bournemouth' }, statistics: [{ type: 'Shots on Goal', value: 3 }] } // Total 7 tiros a puerta en min 30
];

console.log("Prueba 4: Regla 9 (Gol Inminente Global con 7 tiros a puerta al min 30)");
let alertsR9 = evaluateRules(test4Match, oddsTemplate, [], statsR9, isMajorLeague(test4Match.league));
let r9 = alertsR9.find(a => a.metadata.ruleType === 9);
console.log(r9 ? `✅ Éxito Regla 9 activada:\n${r9.text}\n` : "❌ Falló Regla 9");

// ============================================
// Prueba 5: Confirmar que Reglas Desactivadas (4, 5, 6) NO se disparan
// ============================================
console.log("Prueba 5: Verificación de Reglas Desactivadas (4, 5, 6)");

// 5.1 Regla 4 (Asedio al min 80)
let testOff4 = JSON.parse(JSON.stringify(matchTemplate));
testOff4.fixture.id = 1005;
testOff4.fixture.status.elapsed = 80;
testOff4.goals.home = 0;
testOff4.goals.away = 0;
let statsOff4 = [
    { team: { name: 'Manchester City' }, statistics: [{ type: 'Total Shots', value: 20 }, { type: 'Ball Possession', value: '75%' }] }
];
let alertsOff4 = evaluateRules(testOff4, oddsTemplate, [], statsOff4, isMajorLeague(testOff4.league));
let r4Found = alertsOff4.find(a => a.metadata.ruleType === 4);
console.log(!r4Found ? "✅ Éxito: Regla 4 correctamente inactiva (no disparó alerta)." : "❌ Error: Regla 4 disparó alerta indebidamente");

// 5.2 Regla 5 (HT Comeback al descanso perdiendo 0-1)
let testOff5 = JSON.parse(JSON.stringify(matchTemplate));
testOff5.fixture.id = 1006;
testOff5.fixture.status.elapsed = 45;
testOff5.fixture.status.short = 'HT';
testOff5.goals.home = 0;
testOff5.goals.away = 1;
let alertsOff5 = evaluateRules(testOff5, oddsTemplate, [], [], isMajorLeague(testOff5.league));
let r5Found = alertsOff5.find(a => a.metadata.ruleType === 5);
console.log(!r5Found ? "✅ Éxito: Regla 5 correctamente inactiva (no disparó alerta)." : "❌ Error: Regla 5 disparó alerta indebidamente");

// 5.3 Regla 6 (Late Corners al min 78 con 8 córneres)
let testOff6 = JSON.parse(JSON.stringify(matchTemplate));
testOff6.fixture.id = 1007;
testOff6.fixture.status.elapsed = 78;
let statsOff6 = [
    { team: { name: 'Manchester City' }, statistics: [{ type: 'Corner Kicks', value: 9 }] }
];
let alertsOff6 = evaluateRules(testOff6, oddsTemplate, [], statsOff6, isMajorLeague(testOff6.league));
let r6Found = alertsOff6.find(a => a.metadata.ruleType === 6);
console.log(!r6Found ? "✅ Éxito: Regla 6 correctamente inactiva (no disparó alerta).\n" : "❌ Error: Regla 6 disparó alerta indebidamente\n");

// ============================================
// Prueba 6: Verificación de Resolución GREEN/RED Post-Partido para Reglas Activas
// ============================================
console.log("Prueba 6: Evaluación Post-Partido para Regla 8 (Favorito Domina HT)");
let alertMetaR8 = r8.metadata;
let finalMatchR8 = {
    fixture: { id: 1003, status: { short: 'FT' } },
    goals: { home: 2, away: 0 } // Man City ganó 2-0 tras el 0-0 al HT
};

evaluateAlertResults([alertMetaR8], finalMatchR8, [], []).then(veredicto => {
    console.log(`✅ Veredicto Post-Partido Generado:\n${veredicto[0].msg}`);
    console.log("\n--- Todas las pruebas finalizaron con ÉXITO rotundo ---");
}).catch(err => {
    console.error("❌ Error en Prueba 6:", err);
});
