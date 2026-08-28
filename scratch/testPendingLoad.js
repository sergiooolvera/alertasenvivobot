const path = require('path');
const fs = require('fs');
const { initDb } = require('../db');

// Usar una base de datos temporal de prueba
const TEST_DB_PATH = path.join(__dirname, 'test_pending_database.sqlite');
if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
}

const testDb = initDb(TEST_DB_PATH);

console.log("--- Iniciando Pruebas de Reconstrucción de trackedMatches con SQLite ---\n");

try {
    // 1. Insertar jugadas de prueba en la tabla plays
    const insertStmt = testDb.prepare(`
        INSERT INTO plays (
            fixture_id, date, home, away, recommendation, suggested_odd,
            stake, status, profit, rule_name, metadata_json, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run(99991, '2026-08-04', 'Real Madrid', 'Barcelona', 'Over 2.5 Goles', 1.85, 250, 'PENDING', 0, 'Sorpresa Tempranera', JSON.stringify({ ruleName: "Sorpresa Tempranera", ruleType: 3 }), Date.now());
    insertStmt.run(99992, '2026-08-04', 'Arsenal', 'Chelsea', 'Gana Arsenal', 1.70, 250, 'PENDING', 0, 'HT Comeback Favorito', JSON.stringify({ ruleName: "HT Comeback Favorito", ruleType: 5 }), Date.now());
    insertStmt.run(99993, '2026-08-04', 'Juventus', 'Milan', 'Over 9 Córneres', 1.90, 250, 'GREEN', 225, 'Late Corners', JSON.stringify({ ruleName: "Late Corners", ruleType: 6 }), Date.now());

    console.log("📝 3 jugadas insertadas en SQLite (2 PENDING, 1 GREEN).");

    // 2. Extraer jugadas pendientes desde la DB
    const pendingRows = testDb.prepare("SELECT * FROM plays WHERE status = 'PENDING'").all();
    const pendingPlays = pendingRows.map(row => ({
        fixtureId: row.fixture_id,
        home: row.home,
        away: row.away,
        ruleName: row.rule_name,
        metadata: JSON.parse(row.metadata_json || '{}')
    }));

    console.log(`\n🔍 Jugadas pendientes detectadas: ${pendingPlays.length}`);
    if (pendingPlays.length === 2) {
        console.log("✅ Consulta de pendientes retornó exactamente las 2 jugadas.");
    } else {
        throw new Error(`Debieron retornar 2 jugadas, retornaron ${pendingPlays.length}`);
    }

    // 3. Simular la reconstrucción de trackedMatches
    const trackedMatches = new Map();
    console.log("\n⚙️ Simulando reconstrucción de trackedMatches...");
    
    for (const play of pendingPlays) {
        const fixtureId = play.fixtureId;
        if (!trackedMatches.has(fixtureId)) {
            trackedMatches.set(fixtureId, {
                home: play.home,
                away: play.away,
                alertsMetadata: []
            });
        }
        const trackedInfo = trackedMatches.get(fixtureId);
        const hasRule = trackedInfo.alertsMetadata.some(m => m.ruleName === play.ruleName);
        if (!hasRule && play.metadata) {
            const meta = { ...play.metadata, isSent: true };
            trackedInfo.alertsMetadata.push(meta);
        }
    }

    console.log(`📊 Partidos en trackedMatches reconstruidos: ${trackedMatches.size}`);
    
    // Validar partido 99991 (Real Madrid vs Barcelona)
    const rm = trackedMatches.get(99991);
    if (rm && rm.home === "Real Madrid" && rm.alertsMetadata.length === 1 && rm.alertsMetadata[0].isSent === true) {
        console.log("✅ Partido 99991 reconstruido correctamente con isSent: true.");
    } else {
        throw new Error("Fallo en la reconstrucción del partido 99991.");
    }

    // Validar partido 99992 (Arsenal vs Chelsea)
    const ars = trackedMatches.get(99992);
    if (ars && ars.away === "Chelsea" && ars.alertsMetadata.length === 1 && ars.alertsMetadata[0].ruleName === "HT Comeback Favorito") {
        console.log("✅ Partido 99992 reconstruido correctamente.");
    } else {
        throw new Error("Fallo en la reconstrucción del partido 99992.");
    }

    console.log("\n🎉 Todas las pruebas locales pasaron exitosamente!");

} catch (err) {
    console.error("\n❌ Error durante las pruebas:", err.message);
} finally {
    testDb.close();
    if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
    }
}
