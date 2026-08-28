const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'database.sqlite');

let dbInstance = null;

function initDb(customPath = DB_PATH) {
    const db = new Database(customPath);
    
    // Habilitar WAL (Write-Ahead Logging) para rendimiento óptimo y concurrencia
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');

    // Crear tabla de configuración (clave-valor)
    db.exec(`
        CREATE TABLE IF NOT EXISTS config_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    `);

    // Crear tabla de jugadas / alertas financieras
    db.exec(`
        CREATE TABLE IF NOT EXISTS plays (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fixture_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            home TEXT NOT NULL,
            away TEXT NOT NULL,
            recommendation TEXT NOT NULL,
            suggested_odd REAL NOT NULL,
            stake REAL NOT NULL,
            status TEXT NOT NULL DEFAULT 'PENDING',
            profit REAL DEFAULT 0,
            rule_name TEXT NOT NULL,
            explanation TEXT,
            score TEXT,
            resolved_via TEXT,
            metadata_json TEXT,
            timestamp INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_plays_fixture_rule ON plays(fixture_id, rule_name);
        CREATE INDEX IF NOT EXISTS idx_plays_date ON plays(date);
        CREATE INDEX IF NOT EXISTS idx_plays_status ON plays(status);
    `);

    return db;
}

function getDb() {
    if (!dbInstance) {
        dbInstance = initDb();
    }
    return dbInstance;
}

// Helpers de configuración
function getConfig(key, defaultValue = null) {
    const db = getDb();
    const row = db.prepare('SELECT value FROM config_settings WHERE key = ?').get(key);
    if (!row) return defaultValue;
    try {
        return JSON.parse(row.value);
    } catch {
        return row.value;
    }
}

function setConfig(key, value) {
    const db = getDb();
    const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    db.prepare(`
        INSERT INTO config_settings (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, strValue);
}

module.exports = {
    initDb,
    getDb,
    getConfig,
    setConfig,
    DB_PATH
};
