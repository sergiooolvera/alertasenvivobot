require('dotenv').config();
const googleSheetsService = require('../googleSheetsService');

async function testConnection() {
    console.log("--- Probando Conexión con Google Sheets ---");
    console.log("URL:", process.env.GOOGLE_SHEETS_WEBHOOK_URL);

    // 1. Enviar un pick de prueba inicial
    const testPick = {
        fixtureId: 999999,
        date: new Date().toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' }),
        time: new Date().toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour12: false }),
        league: 'Liga de Prueba',
        home: 'Equipo Local Demo',
        away: 'Equipo Visita Demo',
        ruleName: 'Regla 7: Partido Caliente (Tarjetas)',
        recommendation: 'Más de 4.5 Tarjetas Totales en el Partido',
        suggestedOdd: 1.85,
        stake: 500
    };

    console.log("\n1. Enviando pick de prueba ($500 MXN)...");
    const pickResult = await googleSheetsService.sendPickToSheet(testPick);
    console.log("Respuesta de Google Sheets:", pickResult);

    // 2. Probar actualización de resultado (simular resolución GREEN)
    console.log("\n2. Enviando actualización de resultado (GREEN)...");
    const updateResult = await googleSheetsService.updateResultInSheet({
        fixtureId: 999999,
        ruleName: 'Regla 7: Partido Caliente (Tarjetas)',
        status: 'GREEN',
        score: '2 - 1',
        profit: 425.00, // 500 * (1.85 - 1) = $425 MXN
        explanation: 'Prueba de conexión exitosa: se registraron 6 tarjetas amarillas.'
    });
    console.log("Respuesta de actualización:", updateResult);

    console.log("\n--- Prueba Finalizada ---");
}

testConnection();
