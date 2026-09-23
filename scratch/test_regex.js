const fs = require('fs');

const testCases = [
    "Nottingham Forest U21 2 - 1 Manchester City U21",
    "FSV Mainz 05 0 - 0 SC Paderborn 07",
    "Moreirense U19 2 - 3 Famalicão U19",
    "Pachuca U21 2 - 1 Guadalajara Chivas U21",
    "Istra 1961 2 - 2 Dinamo Zagreb",
    "Ajman U23 1 - 1 Al Jazira U23",
    "Talleres Cordoba 2 - 2 Rosario Central",
    "Brann W 2 - 1 Austria Wien W"
];

testCases.forEach(tc => {
    // Buscar el patrón de marcador "\s(\d{1,2})\s*-\s*(\d{1,2})\s"
    const m = tc.match(/^(.*?)\s+(\d{1,2})\s*-\s*(\d{1,2})\s+(.*)$/);
    if (m) {
        console.log(`Original: "${tc}" => Equipo1: "${m[1]}", Score: "${m[2]} - ${m[3]}", Equipo2: "${m[4]}"`);
    } else {
        console.log(`FAILED: "${tc}"`);
    }
});
