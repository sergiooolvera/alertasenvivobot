const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'verdict_audit_strict.json'), 'utf8'));

const allAlerts = data.emparejadas; // Contiene las 111 alertas simples auditadas estrictamente

// Agrupar por Regla
const ruleStats = {};

allAlerts.forEach(a => {
    let r = a.reglaNombre || 'Reglas Generales';
    if (!ruleStats[r]) {
        ruleStats[r] = { total: 0, green: 0, red: 0, black: 0, staked: 0, profit: 0 };
    }
    
    ruleStats[r].total++;
    const stake = 250;
    const momio = 1.65;
    ruleStats[r].staked += stake;

    if (a.veredicto === 'GREEN') {
        ruleStats[r].green++;
        ruleStats[r].profit += stake * (momio - 1);
    } else if (a.veredicto === 'RED') {
        ruleStats[r].red++;
        ruleStats[r].profit -= stake;
    } else {
        ruleStats[r].black++;
        ruleStats[r].staked -= stake; // devuelto
    }
});

// Agregar Parlays del Día y Parlays en Vivo
const parlays = JSON.parse(fs.readFileSync(path.join(__dirname, 'full_audit_results.json'), 'utf8')).parlays;

ruleStats['🏆 Parlays del Día / Vivo'] = { total: 0, green: 0, red: 0, black: 0, staked: 0, profit: 0 };

parlays.forEach(p => {
    const r = '🏆 Parlays del Día / Vivo';
    ruleStats[r].total++;
    const stake = 250;
    const momio = p.momio || 1.75;
    ruleStats[r].staked += stake;

    if (p.veredicto === 'GREEN') {
        ruleStats[r].green++;
        ruleStats[r].profit += stake * (momio - 1);
    } else {
        ruleStats[r].red++;
        ruleStats[r].profit -= stake;
    }
});

// Formatear resultados
const ranking = [];

for (const [ruleName, s] of Object.entries(ruleStats)) {
    const valid = s.green + s.red;
    const winRate = valid > 0 ? ((s.green / valid) * 100).toFixed(2) : '0.00';
    const roi = s.staked > 0 ? ((s.profit / s.staked) * 100).toFixed(2) : '0.00';

    ranking.push({
        ruleName,
        total: s.total,
        green: s.green,
        red: s.red,
        winRate: parseFloat(winRate),
        staked: s.staked,
        profit: s.profit,
        roi: parseFloat(roi)
    });
}

// Ordenar por ROI descendente
ranking.sort((a, b) => b.roi - a.roi);

console.log("================ RANKING DE REGLAS POR RENTABILIDAD REAL ================");
console.table(ranking);

fs.writeFileSync(path.join(__dirname, 'rules_ranking.json'), JSON.stringify(ranking, null, 2));
