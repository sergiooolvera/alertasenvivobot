const { sanitizeAndCorrectPrediction } = require('./aiService');

const tests = [
    {
        name: "Caso 1: Marcador 2-1 (3 goles) - Línea sugerida obsoleta (Más de 2.5 goles)",
        score: { home: 2, away: 1 },
        prediction: `🧠 Análisis de IA: Partido de ida y vuelta con ocasiones claras para ambos.
🎯 Recomendación Inteligente: Más de 2.5 Goles en el Partido
📈 Momio Sugerido: @1.70
🔥 Confianza Estimada: 70%`,
        expected: "Más de 3.5 Goles en el Partido",
        shouldModify: true
    },
    {
        name: "Caso 2: Marcador 2-1 (3 goles) - Línea sugerida válida (Más de 4.5 goles)",
        score: { home: 2, away: 1 },
        prediction: `🧠 Análisis de IA: Partido abierto con ambos buscando la victoria.
🎯 Recomendación Inteligente: Más de 4.5 Goles en el Partido
📈 Momio Sugerido: @2.10
🔥 Confianza Estimada: 65%`,
        expected: "Más de 4.5 Goles en el Partido",
        shouldModify: false
    },
    {
        name: "Caso 3: Marcador 2-1 (3 goles) - Otro mercado (Victoria directa)",
        score: { home: 2, away: 1 },
        prediction: `🧠 Análisis de IA: El equipo local es muy superior.
🎯 Recomendación Inteligente: Victoria de Bahia
📈 Momio Sugerido: @1.80
🔥 Confianza Estimada: 80%`,
        expected: "Victoria de Bahia",
        shouldModify: false
    },
    {
        name: "Caso 4: Marcador 3-1 (4 goles) - Línea en inglés obsoleta (Over 3.5)",
        score: { home: 3, away: 1 },
        prediction: `🧠 Análisis de IA: Dinámica muy ofensiva de ambos conjuntos.
🎯 Recomendación Inteligente: Over 3.5 goles
📈 Momio Sugerido: @1.65
🔥 Confianza Estimada: 75%`,
        expected: "Más de 4.5 Goles",
        shouldModify: true
    },
    {
        name: "Caso 5: Marcador 0-0 (0 goles) - Línea sugerida válida (Más de 1.5 goles)",
        score: { home: 0, away: 0 },
        prediction: `🧠 Análisis de IA: Primeros minutos dinámicos pero sin acierto.
🎯 Recomendación Inteligente: Más de 1.5 Goles en el Partido
📈 Momio Sugerido: @1.62
🔥 Confianza Estimada: 80%`,
        expected: "Más de 1.5 Goles en el Partido",
        shouldModify: false
    },
    {
        name: "Caso 6: Marcador 1-0 (1 gol) - Otro mercado con números (Córneres)",
        score: { home: 1, away: 0 },
        prediction: `🧠 Análisis de IA: Constante juego por las bandas.
🎯 Recomendación Inteligente: Más de 9.5 Córners Totales
📈 Momio Sugerido: @1.75
🔥 Confianza Estimada: 75%`,
        expected: "Más de 9.5 Córners Totales",
        shouldModify: false
    }
];

let failed = 0;
console.log("--- Iniciando pruebas de sanitización de predicciones ---\n");

tests.forEach((t, index) => {
    console.log(`[Test #${index + 1}] ${t.name}`);
    const output = sanitizeAndCorrectPrediction(t.prediction, t.score);
    
    const recMatch = output.match(/🎯\s*\*?\*?Recomendación Inteligente\*?\*?:?\s*\*?\*?\s*([^\n]+)/i);
    const actualRec = recMatch ? recMatch[1].replace(/\*/g, '').trim() : 'N/D';
    
    const passed = actualRec === t.expected;
    
    if (passed) {
        console.log(`✅ PASÓ. Recomendación actual: "${actualRec}"`);
    } else {
        console.log(`❌ FALLÓ. Esperado: "${t.expected}", Obtenido: "${actualRec}"`);
        failed++;
    }
    
    if (t.shouldModify && output === t.prediction) {
        console.log(`❌ FALLÓ: El texto de la predicción debió modificarse pero permaneció idéntico.`);
        failed++;
    }
    console.log("--------------------------------------------------");
});

console.log(`\nPruebas finalizadas. Resultados: ${tests.length - failed}/${tests.length} exitosas.`);
process.exit(failed > 0 ? 1 : 0);
