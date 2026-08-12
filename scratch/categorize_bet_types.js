const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'processed_data.json'), 'utf8'));

function categorizarApuesta(apuestaStr) {
    if (!apuestaStr || apuestaStr === 'N/A') return 'Otros Mercados';
    const s = apuestaStr.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    if (s.includes('ambos anotan') || s.includes('ambos marcan') || s.includes('btts') || s.includes('ambos equipos')) {
        return 'Ambos Anotan (BTTS)';
    }
    if (s.includes('over 2.5') || s.includes('mas de 2.5') || s.includes('> 2.5') || s.includes('linea de goles (+2.5)') || s.includes('mas de 2.5 goles') || s.includes('over 3.5') || s.includes('mas de 3.5') || s.includes('over 1.5') || s.includes('mas de 1.5') || s.includes('goles totales') || s.includes('over') || s.includes('mas de')) {
        if (!s.includes('corner') && !s.includes('tarjeta') && !s.includes('carrera')) {
            return 'Línea de Goles (Over/Under)';
        }
    }
    if (s.includes('proximo gol') || s.includes('siguiente gol') || s.includes('primer gol') || s.includes('gol de')) {
        return 'Próximo Gol / Gol en Vivo';
    }
    if (s.includes('doble oportunidad') || s.includes('empate o') || s.includes('1x') || s.includes('x2') || s.includes('12')) {
        return 'Doble Oportunidad';
    }
    if (s.includes('victoria') || s.includes('gana') || s.includes('ml') || s.includes('resultado final') || s.includes('ganador') || s.includes('apuesta sin empate') || s.includes('dnb') || s.includes('handicap')) {
        return 'Victoria Directa (ML / 1X2 / Handicap)';
    }
    if (s.includes('tarjeta') || s.includes('tarjetas')) {
        return 'Tarjetas Totales / Tarjetas en Vivo';
    }
    if (s.includes('corner') || s.includes('corners') || s.includes('esquina') || s.includes('saques de esquina')) {
        return 'Córneres Totales / Córneres Live';
    }
    if (s.includes('carrera') || s.includes('entrada') || s.includes('beisbol') || s.includes('mlb')) {
        return 'Béisbol Live (Carreras / ML)';
    }

    return 'Otros Mercados';
}

// Map each item to bet types (Gemini & DeepSeek & Overall)
data.forEach(item => {
    item.geminiBetCategory = categorizarApuesta(item.geminiBet);
    item.deepseekBetCategory = categorizarApuesta(item.deepseekBet);

    // Primary category
    if (item.geminiBetCategory !== 'Otros Mercados') {
        item.primaryBetCategory = item.geminiBetCategory;
    } else if (item.deepseekBetCategory !== 'Otros Mercados') {
        item.primaryBetCategory = item.deepseekBetCategory;
    } else {
        item.primaryBetCategory = 'Otros Mercados';
    }
});

// Group by primary category stats
const categories = {};

data.forEach(item => {
    const cat = item.primaryBetCategory;
    if (!categories[cat]) {
        categories[cat] = { category: cat, total: 0, green: 0, red: 0, evitadas: 0, pendientes: 0 };
    }
    const stat = categories[cat];
    stat.total++;
    if (item.veredicto === 'GREEN') stat.green++;
    else if (item.veredicto === 'RED') stat.red++;
    else if (item.veredicto === 'APUESTA EVITADA') stat.evitadas++;
    else stat.pendientes++;
});

console.log('--- DESGLOSE POR TIPO DE APUESTA (CATEGORÍA DE MERCADO) ---');
console.table(categories);

// Print samples per category
console.log('\n--- MUESTAS POR CATEGORIA ---');
Object.keys(categories).forEach(cat => {
    const sample = data.find(d => d.primaryBetCategory === cat);
    if (sample) {
        console.log(`[${cat}] Sample Gemini: "${sample.geminiBet}" | DeepSeek: "${sample.deepseekBet}"`);
    }
});
