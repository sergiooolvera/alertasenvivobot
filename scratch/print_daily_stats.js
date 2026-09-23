const fs = require('fs');
const data = JSON.parse(fs.readFileSync('scratch/full_dataset_calculated.json', 'utf8'));

const dates = Object.keys(data.statsByDate);
console.log('=== RENDIMIENTO POR DÍA (31 DÍAS) ===');
console.log('Fecha | Alertas | Resueltas | Greens | Reds | Winrate | Profit Diario | Profit Acumulado');

let cumProfit = 0;
const dailyRows = [];

dates.forEach(d => {
    const s = data.statsByDate[d];
    const dec = s.green + s.red;
    const wr = dec > 0 ? ((s.green / dec) * 100).toFixed(1) + '%' : 'N/A';
    cumProfit += s.profit;
    dailyRows.push({
        date: d,
        alerts: s.totalAlertas,
        resolved: s.withVeredicto,
        green: s.green,
        red: s.red,
        winrate: wr,
        profit: s.profit.toFixed(2),
        cumProfit: cumProfit.toFixed(2)
    });
});

console.table(dailyRows);
