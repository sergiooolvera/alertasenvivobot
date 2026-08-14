const fs = require('fs');
const path = require('path');

const reportPath = path.join(__dirname, '..', 'reporte_messages.html');
const content = fs.readFileSync(reportPath, 'utf8');
const dataMatch = content.match(/const rawData = (\[[\s\S]*?\]);/);
const rawData = JSON.parse(dataMatch[1]);

// Estructura para almacenar estadísticas
// { mercado: { gemini: { green, red, total }, deepseek: { green, red, total } } }
const stats = {};

rawData.forEach(d => {
    const geminiCat = d.geminiCategory || 'Otros Mercados';
    const deepseekCat = d.deepseekCategory || 'Otros Mercados';
    const veredicto = d.veredicto;
    
    if (d.geminiRecommend && veredicto && veredicto !== 'APUESTA EVITADA') {
        if (!stats[geminiCat]) stats[geminiCat] = { gemini: { green: 0, red: 0 }, deepseek: { green: 0, red: 0 } };
        if (veredicto === 'GREEN') stats[geminiCat].gemini.green++;
        else if (veredicto === 'RED') stats[geminiCat].gemini.red++;
    }
    
    if (d.deepseekRecommend && veredicto && veredicto !== 'APUESTA EVITADA') {
        if (!stats[deepseekCat]) stats[deepseekCat] = { gemini: { green: 0, red: 0 }, deepseek: { green: 0, red: 0 } };
        if (veredicto === 'GREEN') stats[deepseekCat].deepseek.green++;
        else if (veredicto === 'RED') stats[deepseekCat].deepseek.red++;
    }
});

console.log("\n=== RENDIMIENTO CRUZADO: MERCADO + IA ===");
Object.keys(stats).sort().forEach(m => {
    const s = stats[m];
    
    const gTotal = s.gemini.green + s.gemini.red;
    const gWR = gTotal > 0 ? ((s.gemini.green / gTotal) * 100).toFixed(1) : '0.0';
    
    const dTotal = s.deepseek.green + s.deepseek.red;
    const dWR = dTotal > 0 ? ((s.deepseek.green / dTotal) * 100).toFixed(1) : '0.0';
    
    console.log(`\nMercado: ${m}`);
    console.log(`  - Gemini  : WR: ${gWR}% (${s.gemini.green}G / ${s.gemini.red}R) de ${gTotal} recomendadas`);
    console.log(`  - DeepSeek: WR: ${dWR}% (${s.deepseek.green} / ${s.deepseek.red}R) de ${dTotal} recomendadas`);
});
