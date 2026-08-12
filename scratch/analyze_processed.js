const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'processed_data.json'), 'utf8'));

const totalAlertas = data.length;
const totalVeredictos = data.filter(a => a.veredicto).length;
const totalGreen = data.filter(a => a.veredicto === 'GREEN').length;
const totalRed = data.filter(a => a.veredicto === 'RED').length;
const totalEvitadas = data.filter(a => a.veredicto === 'APUESTA EVITADA').length;
const totalPendientes = totalAlertas - totalVeredictos;

const winRateGeneral = (totalGreen + totalRed) > 0 ? ((totalGreen / (totalGreen + totalRed)) * 100).toFixed(1) : 0;
const effectiveWinRate = totalVeredictos > 0 ? (((totalGreen + totalEvitadas) / totalVeredictos) * 100).toFixed(1) : 0;

console.log('--- METRICAS GENERALES ---');
console.log(`Total Alertas: ${totalAlertas}`);
console.log(`Total Evaluados: ${totalVeredictos}`);
console.log(`GREEN (Ganadas): ${totalGreen}`);
console.log(`RED (Perdidas): ${totalRed}`);
console.log(`APUESTA EVITADA: ${totalEvitadas}`);
console.log(`Sin Veredicto Directo: ${totalPendientes}`);
console.log(`Win Rate Directo: ${winRateGeneral}%`);
console.log(`Efectividad Total: ${effectiveWinRate}%`);

// Gemini Stats
const geminiTotalRec = data.filter(a => a.geminiRecommend).length;
const geminiGreen = data.filter(a => a.geminiRecommend && a.veredicto === 'GREEN').length;
const geminiRed = data.filter(a => a.geminiRecommend && a.veredicto === 'RED').length;
const geminiWinRate = (geminiGreen + geminiRed) > 0 ? ((geminiGreen / (geminiGreen + geminiRed)) * 100).toFixed(1) : 0;

// DeepSeek Stats
const deepseekTotalRec = data.filter(a => a.deepseekRecommend).length;
const deepseekGreen = data.filter(a => a.deepseekRecommend && a.veredicto === 'GREEN').length;
const deepseekRed = data.filter(a => a.deepseekRecommend && a.veredicto === 'RED').length;
const deepseekWinRate = (deepseekGreen + deepseekRed) > 0 ? ((deepseekGreen / (deepseekGreen + deepseekRed)) * 100).toFixed(1) : 0;

console.log('\n--- IA STATS ---');
console.log(`Gemini Winrate: ${geminiWinRate}% (${geminiGreen} GREEN / ${geminiRed} RED de ${geminiTotalRec} recomendadas)`);
console.log(`DeepSeek Winrate: ${deepseekWinRate}% (${deepseekGreen} GREEN / ${deepseekRed} RED de ${deepseekTotalRec} recomendadas)`);
