require('dotenv').config();
const { resolveVerdictViaWeb } = require('../aiService');

async function test() {
    console.log("Probando resolveVerdictViaWeb...");
    const res = await resolveVerdictViaWeb('Fútbol', 'Brann W', 'Austria Wien W', '25.08.2026', 'Victoria de Brann W');
    console.log("Resultado de prueba:", res);
}

test();
