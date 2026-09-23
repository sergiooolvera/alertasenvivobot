const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'verdict_audit_strict.json'), 'utf8'));

const rule5Alerts = data.emparejadas.filter(a => a.reglaNombre === 'Regla 5: Partido Caliente');

console.log(`TOTAL ALERTAS EN REGLA 5: ${rule5Alerts.length}`);

function categorizarApuesta(betStr) {
    if (!betStr) return 'Otros';
    const s = betStr.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    if (s.includes('over 2.5') || s.includes('mas de 2.5') || s.includes('> 2.5') || s.includes('+2.5') || s.includes('over 3.5') || s.includes('mas de 3.5') || s.includes('over 1.5') || s.includes('mas de 1.5') || s.includes('goles') || s.includes('linea de goles')) {
        return 'Línea de Goles (Over/Under Goles)';
    }
    if (s.includes('ambos anotan') || s.includes('ambos marcan') || s.includes('btts') || s.includes('ambos equipos')) {
        return 'Ambos Anotan (BTTS)';
    }
    if (s.includes('tarjeta') || s.includes('tarjetas')) {
        return 'Tarjetas Totales / Tarjetas en Vivo';
    }
    if (s.includes('victoria') || s.includes('gana') || s.includes('ml') || s.includes('resultado final') || s.includes('ganador')) {
        return 'Victoria Directa (1X2 / ML)';
    }
    if (s.includes('doble oportunidad') || s.includes('1x') || s.includes('x2')) {
        return 'Doble Oportunidad (1X / X2)';
    }
    if (s.includes('proximo gol') || s.includes('siguiente gol')) {
        return 'Próximo Gol';
    }
    return 'Otros Mercados';
}

const breakdown = {};

rule5Alerts.forEach(a => {
    const bet = a.deepseekBet !== 'N/A' ? a.deepseekBet : a.geminiBet;
    const cat = categorizarApuesta(bet);

    if (!breakdown[cat]) {
        breakdown[cat] = { count: 0, green: 0, red: 0, bets: [] };
    }

    breakdown[cat].count++;
    if (a.veredicto === 'GREEN') breakdown[cat].green++;
    else if (a.veredicto === 'RED') breakdown[cat].red++;

    breakdown[cat].bets.push({
        partido: a.partido,
        bet,
        veredicto: a.veredicto
    });
});

console.log("\n=== DESGLOSE DE PRONÓSTICOS RECOMENDADOS EN REGLA 5 ===");
for (const [cat, info] of Object.entries(breakdown)) {
    const wr = ((info.green / info.count) * 100).toFixed(2);
    console.log(`\n📌 Mercado: ${cat}`);
    console.log(`   Total de recomendaciones: ${info.count} (${((info.count / rule5Alerts.length) * 100).toFixed(1)}% del total)`);
    console.log(`   Ganadas: ${info.green} | Perdidas: ${info.red} | Efectividad: ${wr}%`);
    console.log(`   Ejemplos:`);
    info.bets.slice(0, 5).forEach(b => console.log(`     - [${b.veredicto}] ${b.partido} -> "${b.bet}"`));
}
