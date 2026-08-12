const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'processed_data.json'), 'utf8'));

const pendientes = data.filter(d => !d.veredicto || d.veredicto === 'DESCONOCIDO');

console.log(`Total pendientes: ${pendientes.length} de ${data.length} alertas totales.\n`);

pendientes.forEach((p, idx) => {
    console.log(`[${idx + 1}] Date: ${p.date} | Regla: ${p.reglaNombre} | ${p.partido} (${p.liga}) | Min: ${p.minuto} | Score: ${p.marcador}`);
    console.log(`     Gemini: "${p.geminiBet}" (${p.geminiConf}%) | DeepSeek: "${p.deepseekBet}" (${p.deepseekConf}%)`);
    console.log(`     Key: ${p.partidoNorm}_${p.reglaNombre}`);
    console.log('----------------------------------------------------');
});
