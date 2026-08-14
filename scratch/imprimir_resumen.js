const fs = require('fs');
const path = require('path');

// Cargar el script de reporte y extraer la cadena JSON inyectada
const reportPath = path.join(__dirname, '..', 'reporte_messages.html');
if (!fs.existsSync(reportPath)) {
    console.error("No se encontró reporte_messages.html");
    process.exit(1);
}

const content = fs.readFileSync(reportPath, 'utf8');
const dataMatch = content.match(/const rawData = (\[[\s\S]*?\]);/);
if (!dataMatch) {
    console.error("No se pudo extraer rawData del HTML");
    process.exit(1);
}

const rawData = JSON.parse(dataMatch[1]);
const total = rawData.length;
const evalAlerts = rawData.filter(d => d.veredicto);
const green = rawData.filter(d => d.veredicto === 'GREEN');
const red = rawData.filter(d => d.veredicto === 'RED');
const evitadas = rawData.filter(d => d.veredicto === 'APUESTA EVITADA');

const globalWinRate = (green.length + red.length) > 0 ? ((green.length / (green.length + red.length)) * 100).toFixed(2) : '0.00';

// Gemini stats
const geminiRec = rawData.filter(d => d.geminiRecommend);
const geminiGreen = geminiRec.filter(d => d.veredicto === 'GREEN').length;
const geminiRed = geminiRec.filter(d => d.veredicto === 'RED').length;
const geminiWR = (geminiGreen + geminiRed) > 0 ? ((geminiGreen / (geminiGreen + geminiRed)) * 100).toFixed(2) : '0.00';

// DeepSeek stats
const deepseekRec = rawData.filter(d => d.deepseekRecommend);
const deepseekGreen = deepseekRec.filter(d => d.veredicto === 'GREEN').length;
const deepseekRed = deepseekRec.filter(d => d.veredicto === 'RED').length;
const deepseekWR = (deepseekGreen + deepseekRed) > 0 ? ((deepseekGreen / (deepseekGreen + deepseekRed)) * 100).toFixed(2) : '0.00';

// Stats por Regla
const reglas = {};
rawData.forEach(d => {
    if (!reglas[d.reglaNombre]) reglas[d.reglaNombre] = { total: 0, green: 0, red: 0, evitadas: 0 };
    reglas[d.reglaNombre].total++;
    if (d.veredicto === 'GREEN') reglas[d.reglaNombre].green++;
    if (d.veredicto === 'RED') reglas[d.reglaNombre].red++;
    if (d.veredicto === 'APUESTA EVITADA') reglas[d.reglaNombre].evitadas++;
});

// Stats por Mercado
const mercados = {};
rawData.forEach(d => {
    const m = d.primaryCategory || 'Otros Mercados';
    if (!mercados[m]) mercados[m] = { total: 0, green: 0, red: 0, evitadas: 0 };
    mercados[m].total++;
    if (d.veredicto === 'GREEN') mercados[m].green++;
    if (d.veredicto === 'RED') mercados[m].red++;
    if (d.veredicto === 'APUESTA EVITADA') mercados[m].evitadas++;
});

// Agrupar por Dia
const dias = {};
rawData.forEach(d => {
    const date = d.date;
    if (!dias[date]) dias[date] = { total: 0, green: 0, red: 0, evitadas: 0 };
    dias[date].total++;
    if (d.veredicto === 'GREEN') dias[date].green++;
    if (d.veredicto === 'RED') dias[date].red++;
    if (d.veredicto === 'APUESTA EVITADA') dias[date].evitadas++;
});

console.log(`\n=== RESUMEN DE RENDIMIENTO DE APUESTAS (MESSAGES.HTML) ===`);
console.log(`Total Alertas: ${total}`);
console.log(`Evaluadas (Veredicto): ${evalAlerts.length} (${((evalAlerts.length/total)*100).toFixed(1)}%)`);
console.log(`  - GREEN 🟩 : ${green.length}`);
console.log(`  - RED 🟥   : ${red.length}`);
console.log(`  - EVITADA ⚪: ${evitadas.length}`);
console.log(`Win Rate Global (GREEN / GREEN+RED): ${globalWinRate}%\n`);

console.log(`=== RENDIMIENTO POR IA ===`);
console.log(`♊ GOOGLE GEMINI:`);
console.log(`  - Recomendadas: ${geminiRec.length}`);
console.log(`  - GREEN: ${geminiGreen} | RED: ${geminiRed}`);
console.log(`  - Win Rate: ${geminiWR}%`);
console.log(`  - Evitadas: ${rawData.filter(d => !d.geminiRecommend).length}`);
console.log(`🐳 DEEPSEEK:`);
console.log(`  - Recomendadas: ${deepseekRec.length}`);
console.log(`  - GREEN: ${deepseekGreen} | RED: ${deepseekRed}`);
console.log(`  - Win Rate: ${deepseekWR}%`);
console.log(`  - Evitadas: ${rawData.filter(d => !d.deepseekRecommend).length}\n`);

console.log(`=== RENDIMIENTO POR REGLA ===`);
Object.keys(reglas).sort().forEach(r => {
    const s = reglas[r];
    const wr = (s.green + s.red) > 0 ? ((s.green / (s.green + s.red)) * 100).toFixed(1) : '0.0';
    console.log(`  - ${r.padEnd(30)}: Total: ${String(s.total).padEnd(3)} | GREEN: ${String(s.green).padEnd(2)} | RED: ${String(s.red).padEnd(2)} | Win Rate: ${wr}%`);
});

console.log(`\n=== RENDIMIENTO POR MERCADO ===`);
Object.keys(mercados).sort().forEach(m => {
    const s = mercados[m];
    const wr = (s.green + s.red) > 0 ? ((s.green / (s.green + s.red)) * 100).toFixed(1) : '0.0';
    console.log(`  - ${m.padEnd(35)}: Total: ${String(s.total).padEnd(3)} | GREEN: ${String(s.green).padEnd(2)} | RED: ${String(s.red).padEnd(2)} | Win Rate: ${wr}%`);
});

console.log(`\n=== HISTORIAL POR DÍAS ===`);
Object.keys(dias).sort((a,b) => {
    const partsA = a.split('.');
    const partsB = b.split('.');
    return new Date(partsA[2], partsA[1]-1, partsA[0]) - new Date(partsB[2], partsB[1]-1, partsB[0]);
}).forEach(d => {
    const s = dias[d];
    const wr = (s.green + s.red) > 0 ? ((s.green / (s.green + s.red)) * 100).toFixed(1) : '0.0';
    console.log(`  - ${d}: Total: ${String(s.total).padEnd(3)} | GREEN: ${String(s.green).padEnd(2)} | RED: ${String(s.red).padEnd(2)} | Win Rate: ${wr}%`);
});
