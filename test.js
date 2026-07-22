const { evaluateRules, evaluateAlertResults } = require('./rulesEngine');
const { isMajorLeague } = require('./config');

console.log("--- Iniciando Pruebas de Simulación de Reglas 1-7 y Verificación GREEN/RED ---\n");

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
// Prueba 1: Regla 5 (HT Comeback - Top League)
// ============================================
let test1Match = JSON.parse(JSON.stringify(matchTemplate));
test1Match.fixture.status.elapsed = 45;
test1Match.fixture.status.short = 'HT';
test1Match.goals.home = 0;
test1Match.goals.away = 1; // Favorito perdiendo al HT

console.log("Prueba 1: Regla 5 (HT Comeback en Premier League)");
let alerts1 = evaluateRules(test1Match, oddsTemplate, [], [], isMajorLeague(test1Match.league));
let r5Alert = alerts1.find(a => a.metadata.ruleType === 5);
console.log(r5Alert ? `✅ Éxito Regla 5 activada:\n${r5Alert.text}` : "❌ Falló Regla 5");

// Comprobar que en liga menor NO salta Regla 5
test1Match.league = minorLeague;
let alerts1Minor = evaluateRules(test1Match, oddsTemplate, [], [], isMajorLeague(test1Match.league));
let r5MinorAlert = alerts1Minor.find(a => a.metadata.ruleType === 5);
console.log(!r5MinorAlert ? `✅ Éxito: Regla 5 ignorada correctamente en liga menor.` : "❌ Falló: Regla 5 saltó en liga menor");

// ============================================
// Prueba 2: Regla 6 (Late Corners - Top League)
// ============================================
let test2Match = JSON.parse(JSON.stringify(matchTemplate));
test2Match.fixture.id = 1002;
test2Match.fixture.status.elapsed = 78;
test2Match.goals.home = 1;
test2Match.goals.away = 1;
let stats2 = [
    {
        team: { name: 'Manchester City' },
        statistics: [{ type: 'Corner Kicks', value: 8 }]
    }
];

console.log("\nPrueba 2: Regla 6 (Late Corners al min 78 con 8 córneres en Top League)");
let alerts2 = evaluateRules(test2Match, oddsTemplate, [], stats2, isMajorLeague(test2Match.league));
let r6Alert = alerts2.find(a => a.metadata.ruleType === 6);
console.log(r6Alert ? `✅ Éxito Regla 6 activada:\n${r6Alert.text}` : "❌ Falló Regla 6");

// ============================================
// Prueba 3: Regla 7 (Partido Caliente - Top League)
// ============================================
let test3Match = JSON.parse(JSON.stringify(matchTemplate));
test3Match.fixture.id = 1003;
test3Match.fixture.status.elapsed = 35;
let events3 = [
    { type: 'Card', detail: 'Yellow Card', team: { name: 'Manchester City' } },
    { type: 'Card', detail: 'Yellow Card', team: { name: 'Bournemouth' } },
    { type: 'Card', detail: 'Yellow Card', team: { name: 'Bournemouth' } }
];

console.log("\nPrueba 3: Regla 7 (Partido Caliente con 3 amarillas en min 35 en Top League)");
let alerts3 = evaluateRules(test3Match, oddsTemplate, events3, [], isMajorLeague(test3Match.league));
let r7Alert = alerts3.find(a => a.metadata.ruleType === 7);
console.log(r7Alert ? `✅ Éxito Regla 7 activada:\n${r7Alert.text}` : "❌ Falló Regla 7");

// ============================================
// Prueba 4: Verificación GREEN/RED Post-Partido
// ============================================
console.log("\nPrueba 4: Evaluación de Resultado Post-Partido (HT Comeback Remontado)");
let alertMeta = r5Alert.metadata; // Metadata de la Regla 5 enviada en HT (0-1)
let finalMatch = {
    fixture: { id: 1001, status: { short: 'FT' } },
    goals: { home: 2, away: 1 } // Man City remontó 2-1
};

let veredicto = evaluateAlertResults([alertMeta], finalMatch, [], []);
console.log(`✅ Veredicto Generado:\n${veredicto[0].msg}`);

console.log("\n--- Pruebas finalizadas con éxito ---");
