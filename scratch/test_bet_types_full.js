const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'processed_data.json'), 'utf8'));

function categorizarTextoApuesta(str) {
    if (!str || str === 'N/A') return 'Sin Especificar / Evitada';
    const s = str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    if (s.includes('evitar') || s.includes('no recomendada')) return 'Apuesta Evitada / Descartada';
    if (s.includes('ambos anotan') || s.includes('ambos marcan') || s.includes('btts') || s.includes('ambos equipos')) return 'Ambos Anotan (BTTS)';
    if (s.includes('over 2.5') || s.includes('mas de 2.5') || s.includes('> 2.5') || s.includes('+2.5') || s.includes('over 3.5') || s.includes('mas de 3.5') || s.includes('over 1.5') || s.includes('mas de 1.5') || s.includes('goles totales') || s.includes('linea de goles') || (s.includes('over') && !s.includes('tarjeta') && !s.includes('corner'))) return 'Línea de Goles (Over 1.5 / 2.5 / 3.5)';
    if (s.includes('proximo gol') || s.includes('siguiente gol') || s.includes('primer gol') || s.includes('gol de')) return 'Próximo Gol / Gol en Vivo';
    if (s.includes('doble oportunidad') || s.includes('empate o') || s.includes('1x') || s.includes('x2') || s.includes('12')) return 'Doble Oportunidad (1X / X2)';
    if (s.includes('victoria') || s.includes('gana') || s.includes('ml') || s.includes('resultado final') || s.includes('ganador') || s.includes('apuesta sin empate') || s.includes('dnb') || s.includes('handicap')) return 'Victoria Directa (1X2 / ML)';
    if (s.includes('tarjeta') || s.includes('tarjetas')) return 'Tarjetas Totales / Tarjetas en Vivo';
    if (s.includes('corner') || s.includes('corners') || s.includes('esquina')) return 'Córneres Totales / Saques de Esquina';
    if (s.includes('carrera') || s.includes('entrada') || s.includes('beisbol') || s.includes('mlb')) return 'Béisbol Live (Carreras / ML)';

    return 'Otros Mercados';
}

// Compute metrics for a given model bet field
function computeMarketStats(field) {
    const stats = {};
    data.forEach(item => {
        const text = item[field];
        const cat = categorizarTextoApuesta(text);
        if (!stats[cat]) stats[cat] = { mercado: cat, total: 0, green: 0, red: 0, evitadas: 0, pendientes: 0 };
        const st = stats[cat];
        st.total++;
        if (item.veredicto === 'GREEN') st.green++;
        else if (item.veredicto === 'RED') st.red++;
        else if (item.veredicto === 'APUESTA EVITADA') st.evitadas++;
        else st.pendientes++;
    });

    Object.keys(stats).forEach(k => {
        const st = stats[k];
        st.winRate = (st.green + st.red) > 0 ? ((st.green / (st.green + st.red)) * 100).toFixed(1) + '%' : '0.0%';
    });

    return stats;
}

console.log('--- GOOGLE GEMINI POR TIPO DE APUESTA ---');
console.table(computeMarketStats('geminiBet'));

console.log('\n--- DEEPSEEK POR TIPO DE APUESTA ---');
console.table(computeMarketStats('deepseekBet'));
