require('dotenv').config();
const aiService = require('./aiService');

async function testFootball() {
    console.log("\n--- Probando IA con Alerta de Fútbol ---");
    const mockMatchData = {
        homeTeam: "Real Madrid",
        awayTeam: "Barcelona",
        elapsed: 78,
        score: { home: 0, away: 1 },
        odds: { home: 1.85, draw: 3.40, away: 4.20 },
        ruleName: "Asedio de Favorito Tarde",
        ruleDetails: "El favorito Real Madrid va perdiendo 0-1, juega en casa y el asedio en tiros de esquina/ataques peligrosos se ha intensificado desde el minuto 70.",
        stats: [
            { type: "Ball Possession", value: "65% vs 35%" },
            { type: "Total Shots", value: "18 vs 6" },
            { type: "Shots on Goal", value: "8 vs 2" },
            { type: "Corner Kicks", value: "9 vs 2" }
        ],
        events: [
            { type: "Goal", elapsed: 42, team: "Barcelona", detail: "Raphinha" },
            { type: "Card", elapsed: 65, team: "Barcelona", detail: "Yellow Card" }
        ]
    };

    const prediction = await aiService.generatePrediction(mockMatchData, 'football');
    console.log("Resultado de Fútbol:");
    console.log(prediction || "⚠️ ERROR: No se obtuvo respuesta de la IA.");
}

async function testBaseball() {
    console.log("\n--- Probando IA con Alerta de Béisbol (MLB) ---");
    const mockMatchData = {
        homeTeam: "New York Yankees",
        awayTeam: "Boston Red Sox",
        inning: "Inning 8 (Alta)",
        score: { home: 4, away: 5 },
        odds: { home: 1.65, away: 2.25 },
        ruleName: "Cierre Apretado / Tensión",
        ruleDetails: "El partido entra a las entradas finales (inning 7-9) con una diferencia de apenas 1 carrera y bases llenas para el equipo visitante.",
        stats: {
            runsByInning: {
                home: [1, 0, 2, 0, 0, 0, 1, 0],
                away: [0, 2, 0, 1, 1, 0, 0, 1]
            },
            hits: "home 8 | away 10",
            errors: "home 1 | away 0"
        }
    };

    const prediction = await aiService.generatePrediction(mockMatchData, 'baseball');
    console.log("Resultado de Béisbol:");
    console.log(prediction || "⚠️ ERROR: No se obtuvo respuesta de la IA.");
}

async function run() {
    const fs = require('fs');
    try {
        console.log("Iniciando pruebas...");
        // Capturar salidas en variables
        let outputText = "";
        
        console.log("\n--- Probando IA con Alerta de Fútbol ---");
        const mockMatchDataFootball = {
            homeTeam: "Real Madrid",
            awayTeam: "Barcelona",
            elapsed: 78,
            score: { home: 0, away: 1 },
            odds: { home: 1.85, draw: 3.40, away: 4.20 },
            ruleName: "Asedio de Favorito Tarde",
            ruleDetails: "El favorito Real Madrid va perdiendo 0-1, juega en casa y el asedio en tiros de esquina/ataques peligrosos se ha intensificado desde el minuto 70.",
            stats: [
                { type: "Ball Possession", value: "65% vs 35%" },
                { type: "Total Shots", value: "18 vs 6" },
                { type: "Shots on Goal", value: "8 vs 2" },
                { type: "Corner Kicks", value: "9 vs 2" }
            ],
            events: [
                { type: "Goal", elapsed: 42, team: "Barcelona", detail: "Raphinha" },
                { type: "Card", elapsed: 65, team: "Barcelona", detail: "Yellow Card" }
            ]
        };
        const predFootball = await aiService.generatePrediction(mockMatchDataFootball, 'football');
        outputText += `=== FÚTBOL ===\n${predFootball || 'Error'}\n\n`;

        console.log("\n--- Probando IA con Alerta de Béisbol (MLB) ---");
        const mockMatchDataBaseball = {
            homeTeam: "New York Yankees",
            awayTeam: "Boston Red Sox",
            inning: "Inning 8 (Alta)",
            score: { home: 4, away: 5 },
            odds: { home: 1.65, away: 2.25 },
            ruleName: "Cierre Apretado / Tensión",
            ruleDetails: "El partido entra a las entradas finales (inning 7-9) con una diferencia de apenas 1 carrera y bases llenas para el equipo visitante.",
            stats: {
                runsByInning: {
                    home: [1, 0, 2, 0, 0, 0, 1, 0],
                    away: [0, 2, 0, 1, 1, 0, 0, 1]
                },
                hits: "home 8 | away 10",
                errors: "home 1 | away 0"
            }
        };
        const predBaseball = await aiService.generatePrediction(mockMatchDataBaseball, 'baseball');
        outputText += `=== BÉISBOL ===\n${predBaseball || 'Error'}\n\n`;

        fs.writeFileSync('testAi_output.txt', outputText, 'utf-8');
        console.log("Pruebas completadas. Archivo testAi_output.txt generado.");
    } catch (error) {
        console.error("Error al ejecutar las pruebas:", error);
    }
}

run();
