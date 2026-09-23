const fs = require('fs');
const path = require('path');

const parlays = JSON.parse(fs.readFileSync(path.join(__dirname, 'parlays_summary.json'), 'utf8'));

console.log(`TOTAL PARLAYS: ${parlays.length}`);

parlays.forEach((p, index) => {
    console.log(`\n=== PARLAY #${index + 1} | ID: ${p.id} | Fecha: ${p.date} ${p.time} | Tipo: ${p.type} | Momio: @${p.momio} | Conf: ${p.confianza}% ===`);
    console.log(`Veredicto en chat: ${p.veredicto || 'SIN VEREDICTO CHAT'}`);
    p.selecciones.forEach((s, idx) => {
        console.log(`  Leg #${idx + 1}: ${s}`);
    });
});
