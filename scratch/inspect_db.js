const path = require('path');
const { getDb } = require('../db');
const db = getDb();

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tablas existentes:', tables);

const playsCount = db.prepare('SELECT COUNT(*) as c FROM plays').get();
console.log('Total registros en plays:', playsCount.c);

const statusCounts = db.prepare('SELECT status, COUNT(*) as c FROM plays GROUP BY status').all();
console.log('Distribución por status:', statusCounts);

const config = db.prepare('SELECT * FROM config_settings').all();
console.log('Configuraciones:', config);

const lastPlays = db.prepare('SELECT id, date, home, away, rule_name, status, profit, suggested_odd FROM plays ORDER BY id DESC LIMIT 5').all();
console.log('Últimas 5 jugadas:');
console.table(lastPlays);
