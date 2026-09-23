const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'verdict_audit_strict.json'), 'utf8'));

console.log("=== 8 ALERTAS SIN VEREDICTO EXPRESO EN TELEGRAM ===");
data.noEmparejadas.forEach((a, idx) => {
    console.log(`${idx + 1}. [${a.date} ${a.time}] ID: ${a.id} | ${a.partido} | Regla: ${a.reglaNombre} | Bet: ${a.deepseekBet !== 'N/A' ? a.deepseekBet : a.geminiBet}`);
});
