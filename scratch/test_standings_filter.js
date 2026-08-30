// Script para probar el filtro de tabla de posiciones en la Regla 1: Tarjeta Roja Estratégica
// Ejecutar con: node scratch/test_standings_filter.js

// 1. Definimos la función helper exactamente igual a la de index.js
function getTeamRankFromStandings(standings, teamId) {
    if (!standings || !teamId) return null;
    try {
        for (const group of standings) {
            if (Array.isArray(group)) {
                const item = group.find(s => s.team && s.team.id === teamId);
                if (item) return item.rank;
            }
        }
    } catch (e) {
        console.error("Error al buscar rank:", e.message);
    }
    return null;
}

// 2. Definimos la lógica del filtro exactamente igual a la de index.js
function runFilterTest(homeTeam, awayTeam, homeRank, awayRank, teamWithRed, ruleType) {
    const standingsInfo = { homeRank, awayRank };
    
    console.log(`\n--- Evaluando: ${homeTeam} (#${homeRank}) vs ${awayTeam} (#${awayRank}) ---`);
    console.log(`Incidente: Tarjeta roja para ${teamWithRed}`);

    let isAborted = false;

    // --- LÓGICA DE FILTRO EN INDEX.JS ---
    if (ruleType === 1 && standingsInfo.homeRank !== null && standingsInfo.awayRank !== null) {
        const isHomeRed = teamWithRed === homeTeam;
        
        const rankWithRed = isHomeRed ? standingsInfo.homeRank : standingsInfo.awayRank;
        const rankWithAdvantage = isHomeRed ? standingsInfo.awayRank : standingsInfo.homeRank;
        
        const rankDifference = rankWithAdvantage - rankWithRed;
        
        // Si el beneficiado está 5 o más posiciones por debajo del afectado en la tabla
        if (rankDifference >= 5) {
            console.log(`[Standing Filter] ⛔ Alerta abortada para ${homeTeam} vs ${awayTeam} (Regla 1). El equipo beneficiado (${isHomeRed ? awayTeam : homeTeam}) está muy abajo en la tabla (${rankWithAdvantage} vs ${rankWithRed}). Diferencia: ${rankDifference} posiciones.`);
            isAborted = true;
        } else {
            console.log(`[Standing Filter] ✅ Alerta permitida. Diferencia de posiciones aceptable: ${rankDifference} posiciones.`);
        }
    } else {
        console.log(`[Standing Filter] ✅ Alerta permitida (No aplica filtro por datos faltantes o tipo de regla).`);
    }

    return isAborted;
}

// 3. Simulación de datos de Standings
const mockStandingsSingleGroup = [
    [
        { rank: 1, team: { id: 101, name: "Leones Negros UDG" } },
        { rank: 8, team: { id: 102, name: "Piratas" } },
        { rank: 14, team: { id: 103, name: "Seraing United" } },
        { rank: 8, team: { id: 104, name: "K. Lierse S.K." } },
        { rank: 3, team: { id: 105, name: "Equipo Top" } },
        { rank: 5, team: { id: 106, name: "Equipo Medio" } },
        { rank: 10, team: { id: 107, name: "Equipo Bajo" } }
    ]
];

// --- PRUEBA DE EXTRAER RANGO ---
console.log("=== PRUEBA DE EXTRAER RANGO DE STANDINGS ===");
const rankLN = getTeamRankFromStandings(mockStandingsSingleGroup, 101);
const rankLierse = getTeamRankFromStandings(mockStandingsSingleGroup, 104);
console.log(`Rank Leones Negros (Esperado: 1): ${rankLN}`);
console.log(`Rank Lierse (Esperado: 8): ${rankLierse}`);

if (rankLN !== 1 || rankLierse !== 8) {
    console.error("❌ Falló la extracción de rangos.");
    process.exit(1);
}
console.log("✅ Extracción de rangos exitosa.\n");

// --- CASOS DE PRUEBA DEL FILTRO ---
console.log("=== PRUEBA DE FILTROS ===");

// Caso 1: Seraing (14) vs Lierse (8) - Roja Lierse (Visita)
// Beneficiado es Seraing (14) -> rankDifference = 14 - 8 = 6 >= 5. Esperado: Abortada.
const test1 = runFilterTest("Seraing United", "K. Lierse S.K.", 14, 8, "K. Lierse S.K.", 1);
if (!test1) {
    console.error("❌ Falló Caso 1 (Debió abortar)");
    process.exit(1);
}

// Caso 2: Leones Negros (1) vs Piratas (8) - Roja Leones Negros (Local)
// Beneficiado es Piratas (8) -> rankDifference = 8 - 1 = 7 >= 5. Esperado: Abortada.
const test2 = runFilterTest("Leones Negros UDG", "Piratas", 1, 8, "Leones Negros UDG", 1);
if (!test2) {
    console.error("❌ Falló Caso 2 (Debió abortar)");
    process.exit(1);
}

// Caso 3: Equipo Top (3) vs Equipo Medio (5) - Roja Equipo Top (Local)
// Beneficiado es Equipo Medio (5) -> rankDifference = 5 - 3 = 2 < 5. Esperado: Permitida.
const test3 = runFilterTest("Equipo Top", "Equipo Medio", 3, 5, "Equipo Top", 1);
if (test3) {
    console.error("❌ Falló Caso 3 (Debió permitir)");
    process.exit(1);
}

// Caso 4: Equipo Bajo (10) vs Equipo Top (3) - Roja Equipo Bajo (Local)
// Beneficiado es Equipo Top (3) -> rankDifference = 3 - 10 = -7 < 5. Esperado: Permitida.
const test4 = runFilterTest("Equipo Bajo", "Equipo Top", 10, 3, "Equipo Bajo", 1);
if (test4) {
    console.error("❌ Falló Caso 4 (Debió permitir)");
    process.exit(1);
}

console.log("\n✅ ¡Todos los escenarios del filtro pasaron las pruebas unitarias!");
