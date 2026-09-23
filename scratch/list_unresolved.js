const fs = require('fs');
const path = require('path');

const parlays = JSON.parse(fs.readFileSync(path.join(__dirname, 'parlays_summary.json'), 'utf8'));
const completeDataset = JSON.parse(fs.readFileSync(path.join(__dirname, 'complete_dataset.json'), 'utf8'));

const unverifiedParlays = parlays; // We will verify all 28 parlays leg by leg
const unverifiedAlerts = completeDataset.pendingAlerts;

console.log(`=== AUDITORÍA DE VERIFICACIÓN WEB DE RESULTADOS ===`);
console.log(`Total Parlays a verificar: ${unverifiedParlays.length}`);
console.log(`Total Alertas Simples a verificar: ${unverifiedAlerts.length}`);

// Extraer todos los partidos a consultar
const itemsToVerify = [];

unverifiedParlays.forEach((p, idx) => {
    p.selecciones.forEach((s, legIdx) => {
        itemsToVerify.push({
            type: 'PARLAY',
            parlayId: p.id,
            parlayNum: idx + 1,
            parlayType: p.type,
            parlayDate: p.date,
            parlayTime: p.time,
            parlayMomio: p.momio,
            legNum: legIdx + 1,
            selectionText: s
        });
    });
});

unverifiedAlerts.forEach(a => {
    itemsToVerify.push({
        type: 'ALERT',
        alertId: a.id,
        date: a.date,
        time: a.time,
        regla: a.reglaNombre,
        partido: a.partido,
        geminiBet: a.geminiBet,
        deepseekBet: a.deepseekBet
    });
});

fs.writeFileSync(path.join(__dirname, 'items_to_verify.json'), JSON.stringify(itemsToVerify, null, 2));

console.log(`Total de selecciones/partidos a consultar en internet: ${itemsToVerify.length}`);
