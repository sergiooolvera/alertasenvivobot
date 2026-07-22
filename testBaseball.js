const { evaluateBaseballRules, evaluateBaseballAlertResults } = require('./baseballRulesEngine');

console.log("--- Iniciando Pruebas de Simulación de MLB (Béisbol) ---\n");

const gameTemplate = {
    game: { id: 2001 },
    league: { name: 'MLB' },
    status: { short: 'IN4', timer: '4' },
    teams: { home: { name: 'NY Yankees' }, away: { name: 'Boston Red Sox' } },
    scores: { home: { total: 1 }, away: { total: 3 } }
};

const oddsTemplate = { home: 1.40, away: 3.10 }; // Favorito: NY Yankees (Home 1.40)

// ============================================
// Prueba 1: Regla MLB 1 (Favorito en Apuros en Inning 4)
// ============================================
console.log("Prueba 1: Favorito (Yankees) perdiendo en la 4ª entrada");
let alerts1 = evaluateBaseballRules(gameTemplate, oddsTemplate);
let r1Alert = alerts1.find(a => a.metadata.ruleType === 1);
console.log(r1Alert ? `✅ Éxito Regla MLB 1 activada:\n${r1Alert.text}` : "❌ Falló Regla MLB 1");

// ============================================
// Prueba 2: Regla MLB 2 (Final Apretado en Inning 8)
// ============================================
let game2 = JSON.parse(JSON.stringify(gameTemplate));
game2.game.id = 2002;
game2.status.short = 'IN8';
game2.scores.home.total = 4;
game2.scores.away.total = 5; // Diferencia de 1 carrera

console.log("\nPrueba 2: Final Apretado al Inning 8 (4 - 5)");
let alerts2 = evaluateBaseballRules(game2, oddsTemplate);
let r2Alert = alerts2.find(a => a.metadata.ruleType === 2);
console.log(r2Alert ? `✅ Éxito Regla MLB 2 activada:\n${r2Alert.text}` : "❌ Falló Regla MLB 2");

// ============================================
// Prueba 3: Regla MLB 3 (Festín de Carreras en Inning 2)
// ============================================
let game3 = JSON.parse(JSON.stringify(gameTemplate));
game3.game.id = 2003;
game3.status.short = 'IN2';
game3.scores.home.total = 4;
game3.scores.away.total = 3; // 7 carreras totales

console.log("\nPrueba 3: Festín de Carreras al Inning 2 (4 - 3)");
let alerts3 = evaluateBaseballRules(game3, oddsTemplate);
let r3Alert = alerts3.find(a => a.metadata.ruleType === 3);
console.log(r3Alert ? `✅ Éxito Regla MLB 3 activada:\n${r3Alert.text}` : "❌ Falló Regla MLB 3");

// ============================================
// Prueba 4: Verificación GREEN / RED Post-Partido MLB
// ============================================
console.log("\nPrueba 4: Evaluación de Resultado Post-Partido MLB (Remontada de Yankees)");
let alertMeta = r1Alert.metadata;
let finalGame = {
    scores: { home: { total: 6 }, away: { total: 4 } } // Yankees remontaron 6-4
};

let veredicto = evaluateBaseballAlertResults([alertMeta], finalGame);
console.log(`✅ Veredicto MLB Generado:\n${veredicto[0].msg}`);

console.log("\n--- Pruebas de Béisbol finalizadas con éxito ---");
