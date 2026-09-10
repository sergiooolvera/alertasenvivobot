const { evaluateRules } = require('./rulesEngine');
const { isOffFieldCard } = require('./utils');

console.log("=== INICIANDO PRUEBA DE TARJETAS FUERA DEL CAMPO ===");

// 1. Caso real del partido Stevenage vs Luton
const fixtureStevenageLuton = {
    fixture: { id: 999901, status: { elapsed: 45, short: '1H' } },
    teams: {
        home: { name: 'Stevenage' },
        away: { name: 'Luton' }
    },
    goals: { home: 1, away: 0 },
    league: { name: 'League One' }
};

const oddsStevenageLuton = { home: 3.1, draw: 3.3, away: 2.15 };

const eventsOffFieldLuton = [
    { type: 'Card', detail: 'Yellow Card', team: { name: 'Stevenage' }, player: { name: 'Phillips D.' }, time: { elapsed: 14 } },
    { type: 'Goal', detail: 'Normal Goal', team: { name: 'Stevenage' }, player: { name: 'Kemp D.' }, time: { elapsed: 23 } },
    { type: 'Card', detail: 'Red Card', comments: 'Fuera del campo, Conducta antideportiva', team: { name: 'Luton' }, player: { name: 'Wilshere J.' }, time: { elapsed: 24 } },
    { type: 'Card', detail: 'Yellow Card', team: { name: 'Stevenage' }, player: { name: 'Freestone L.' }, time: { elapsed: 26 } }
];

// Verificar directamente isOffFieldCard
const wilshereCard = eventsOffFieldLuton[2];
const isOffField = isOffFieldCard(wilshereCard, eventsOffFieldLuton);
console.log(`\n1. Verificación isOffFieldCard para Wilshere J.:`);
console.log(`   Resultado esperado: true | Resultado obtenido: ${isOffField}`);

if (!isOffField) {
    console.error("❌ ERROR: Wilshere J. no fue clasificado como tarjeta fuera del campo.");
    process.exit(1);
}

// Evaluar Reglas con evento fuera de cancha
const alertsOffField = evaluateRules(fixtureStevenageLuton, oddsStevenageLuton, eventsOffFieldLuton, [], false);
console.log(`\n2. Evaluación de reglas para Stevenage vs Luton (Roja fuera del campo):`);
console.log(`   Alertas generadas: ${alertsOffField.length}`);

const rule1Alerts = alertsOffField.filter(a => a.metadata.ruleType === 1);
if (rule1Alerts.length > 0) {
    console.error("❌ ERROR: Se generó una alerta de Regla 1 para tarjeta fuera del campo.");
    process.exit(1);
} else {
    console.log("   ✅ ÉXITO: Se previno correctamente la alerta de Regla 1.");
}

// 3. Caso de prueba: Tarjeta roja real EN CANCHA a un jugador titular
const eventsOnFieldLuton = [
    { type: 'Card', detail: 'Yellow Card', team: { name: 'Stevenage' }, player: { name: 'Phillips D.' }, time: { elapsed: 14 } },
    { type: 'Goal', detail: 'Normal Goal', team: { name: 'Stevenage' }, player: { name: 'Kemp D.' }, time: { elapsed: 23 } },
    { type: 'Card', detail: 'Red Card', comments: 'Foul', team: { name: 'Luton' }, player: { name: 'Morris C.' }, time: { elapsed: 36 } }
];

const fixtureMin36 = {
    ...fixtureStevenageLuton,
    fixture: { id: 999902, status: { elapsed: 36, short: '1H' } }
};

const alertsOnField = evaluateRules(fixtureMin36, oddsStevenageLuton, eventsOnFieldLuton, [], false);
const rule1OnField = alertsOnField.filter(a => a.metadata.ruleType === 1);

console.log(`\n3. Evaluación de reglas para roja REAL en cancha (Morris C. min 36'):`);
console.log(`   Alertas de Regla 1 generadas: ${rule1OnField.length}`);

if (rule1OnField.length === 1) {
    console.log("   ✅ ÉXITO: La tarjeta roja real en cancha SÍ generó la alerta de Regla 1 adecuadamente.");
} else {
    console.error("❌ ERROR: No se generó la alerta de Regla 1 para una roja real en cancha.");
    process.exit(1);
}

console.log("\n=== TODAS LAS PRUEBAS PASARON EXITOSAMENTE ===");
