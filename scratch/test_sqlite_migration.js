const path = require('path');
const fs = require('fs');
const assert = require('assert');

// Usamos una base de datos temporal de prueba
const TEST_DB_PATH = path.join(__dirname, 'test_database.sqlite');
if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
}

const { initDb, getDb, getConfig, setConfig } = require('../db');
const db = initDb(TEST_DB_PATH);

console.log("=========================================");
console.log("🧪 INICIANDO TEST SUITE: SQLite (better-sqlite3)");
console.log("=========================================\n");

// 1. Probar configuración clave-valor
console.log("1. Probando config_settings...");
setConfig('initialBalance', 5000);
setConfig('stakeAmount', 250);
setConfig('startDate', '2026-08-02');

assert.strictEqual(getConfig('initialBalance'), 5000, "initialBalance debería ser 5000");
assert.strictEqual(getConfig('stakeAmount'), 250, "stakeAmount debería ser 250");
assert.strictEqual(getConfig('startDate'), '2026-08-02', "startDate debería ser '2026-08-02'");
console.log("✅ Configuración clave-valor verificada correctamente.");

// 2. Probar inserción de jugadas
console.log("\n2. Probando inserción de jugadas...");
const insertStmt = db.prepare(`
    INSERT INTO plays (
        fixture_id, date, home, away, recommendation, suggested_odd,
        stake, status, profit, rule_name, metadata_json, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', 0, ?, ?, ?)
`);

insertStmt.run(1001, '2026-08-26', 'Barcelona', 'Real Madrid', 'Over 2.5 Goles', 1.80, 250, 'Regla 3', JSON.stringify({ test: 1 }), Date.now());
insertStmt.run(1002, '2026-08-26', 'Liverpool', 'Chelsea', 'Victoria Local', 2.10, 250, 'Regla 1', JSON.stringify({ test: 2 }), Date.now());
insertStmt.run(1003, '2026-08-27', 'Bayern', 'Dortmund', 'Over 3.5 Goles', 1.95, 250, 'Regla 4', JSON.stringify({ test: 3 }), Date.now());

const count = db.prepare("SELECT COUNT(*) as total FROM plays").get().total;
assert.strictEqual(count, 3, "Deberían existir 3 jugadas registradas");
console.log(`✅ ${count} jugadas insertadas correctamente.`);

// 3. Probar restricción de duplicados (fixture_id + rule_name)
console.log("\n3. Probando prevención de duplicados en índice único...");
let duplicateCaught = false;
try {
    insertStmt.run(1001, '2026-08-26', 'Barcelona', 'Real Madrid', 'Over 2.5 Goles', 1.80, 250, 'Regla 3', null, Date.now());
} catch (e) {
    duplicateCaught = true;
}
assert.strictEqual(duplicateCaught, true, "El índice único (fixture_id, rule_name) debe prevenir duplicados");
console.log("✅ Prevención de duplicados verificada.");

// 4. Probar actualización de veredictos
console.log("\n4. Probando actualización de veredictos (GREEN / RED / AVOIDED)...");
// Partido 1001: Ganado (GREEN)
const odd1 = 1.80;
const profit1 = parseFloat((250 * (odd1 - 1)).toFixed(2)); // +200
db.prepare("UPDATE plays SET status = 'GREEN', profit = ?, explanation = 'Ganado FT', resolved_via = 'api_live' WHERE fixture_id = 1001").run(profit1);

// Partido 1002: Perdido (RED)
db.prepare("UPDATE plays SET status = 'RED', profit = -250, explanation = 'Perdido FT', resolved_via = 'api_live' WHERE fixture_id = 1002").run();

const row1 = db.prepare("SELECT * FROM plays WHERE fixture_id = 1001").get();
assert.strictEqual(row1.status, 'GREEN');
assert.strictEqual(row1.profit, 200);

const row2 = db.prepare("SELECT * FROM plays WHERE fixture_id = 1002").get();
assert.strictEqual(row2.status, 'RED');
assert.strictEqual(row2.profit, -250);
console.log("✅ Veredictos y balances calculados y guardados correctamente.");

// 5. Probar actualización de metadatos (VAR)
console.log("\n5. Probando actualización de metadatos...");
const row3 = db.prepare("SELECT * FROM plays WHERE fixture_id = 1003").get();
const meta3 = JSON.parse(row3.metadata_json);
meta3.varChecked = true;
meta3.score = "2-1";
db.prepare("UPDATE plays SET metadata_json = ? WHERE fixture_id = 1003").run(JSON.stringify(meta3));

const updated3 = db.prepare("SELECT * FROM plays WHERE fixture_id = 1003").get();
const parsedUpdatedMeta = JSON.parse(updated3.metadata_json);
assert.strictEqual(parsedUpdatedMeta.varChecked, true);
assert.strictEqual(parsedUpdatedMeta.score, "2-1");
console.log("✅ Metadatos actualizados y persistidos con éxito.");

// 6. Probar consultas agregadas para reportes diarios y acumulados
console.log("\n6. Probando agregaciones de reporte financiero...");
const yesterdayStats = db.prepare(`
    SELECT 
        SUM(CASE WHEN status = 'GREEN' THEN 1 ELSE 0 END) as greenCount,
        SUM(CASE WHEN status = 'RED' THEN 1 ELSE 0 END) as redCount,
        SUM(profit) as totalProfit
    FROM plays 
    WHERE date = '2026-08-26' AND status IN ('GREEN', 'RED')
`).get();

assert.strictEqual(yesterdayStats.greenCount, 1);
assert.strictEqual(yesterdayStats.redCount, 1);
assert.strictEqual(yesterdayStats.totalProfit, -50); // 200 - 250 = -50
console.log(`✅ Métricas de ayer: ${yesterdayStats.greenCount} Green, ${yesterdayStats.redCount} Red, Total: $${yesterdayStats.totalProfit} MXN`);

// 7. Probar funcionamiento en financialTracker real
console.log("\n7. Probando módulo financialTracker integrado...");
const financialTracker = require('../financialTracker');

const pendingPlays = financialTracker.getPendingPlays();
console.log(`Jugadas pendientes en financialTracker: ${pendingPlays.length}`);
assert.ok(Array.isArray(pendingPlays));

const report = financialTracker.getReportData();
console.log(`Reporte generado: Capital Actual: $${report.currentCapital} MXN, Acumulado: $${report.accumProfit} MXN`);
assert.ok(typeof report.currentCapital === 'number');

// Limpieza de base de datos de test
db.close();
if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
}

console.log("\n=========================================");
console.log("🎉 TODAS LAS PRUEBAS PASARON EXITOSAMENTE");
console.log("=========================================\n");
