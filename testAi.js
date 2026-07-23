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
            {
                team: { name: "Real Madrid" },
                statistics: [
                    { type: "Ball Possession", value: "65%" },
                    { type: "Total Shots", value: 18 },
                    { type: "Shots on Goal", value: 8 },
                    { type: "Corner Kicks", value: 9 },
                    { type: "Fouls", value: 12 },
                    { type: "Yellow Cards", value: 1 },
                    { type: "Red Cards", value: 0 }
                ]
            },
            {
                team: { name: "Barcelona" },
                statistics: [
                    { type: "Ball Possession", value: "35%" },
                    { type: "Total Shots", value: 6 },
                    { type: "Shots on Goal", value: 2 },
                    { type: "Corner Kicks", value: 2 },
                    { type: "Fouls", value: 14 },
                    { type: "Yellow Cards", value: 3 },
                    { type: "Red Cards", value: 0 }
                ]
            }
        ],
        events: [
            {
                time: { elapsed: 42 },
                team: { name: "Barcelona" },
                player: { name: "Raphinha" },
                type: "Goal",
                detail: "Normal Goal"
            },
            {
                time: { elapsed: 65 },
                team: { name: "Barcelona" },
                player: { name: "Gavi" },
                type: "Card",
                detail: "Yellow Card"
            }
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
            home: {
                total: 4,
                hits: 8,
                errors: 1,
                innings: {
                    "1": 1, "2": 0, "3": 2, "4": 0, "5": 0, "6": 0, "7": 1, "8": 0
                }
            },
            away: {
                total: 5,
                hits: 10,
                errors: 0,
                innings: {
                    "1": 0, "2": 2, "3": 0, "4": 1, "5": 1, "6": 0, "7": 0, "8": 1
                }
            }
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
                {
                    team: { name: "Real Madrid" },
                    statistics: [
                        { type: "Ball Possession", value: "65%" },
                        { type: "Total Shots", value: 18 },
                        { type: "Shots on Goal", value: 8 },
                        { type: "Corner Kicks", value: 9 },
                        { type: "Fouls", value: 12 },
                        { type: "Yellow Cards", value: 1 },
                        { type: "Red Cards", value: 0 }
                    ]
                },
                {
                    team: { name: "Barcelona" },
                    statistics: [
                        { type: "Ball Possession", value: "35%" },
                        { type: "Total Shots", value: 6 },
                        { type: "Shots on Goal", value: 2 },
                        { type: "Corner Kicks", value: 2 },
                        { type: "Fouls", value: 14 },
                        { type: "Yellow Cards", value: 3 },
                        { type: "Red Cards", value: 0 }
                    ]
                }
            ],
            events: [
                {
                    time: { elapsed: 42 },
                    team: { name: "Barcelona" },
                    player: { name: "Raphinha" },
                    type: "Goal",
                    detail: "Normal Goal"
                },
                {
                    time: { elapsed: 65 },
                    team: { name: "Barcelona" },
                    player: { name: "Gavi" },
                    type: "Card",
                    detail: "Yellow Card"
                }
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
                home: {
                    total: 4,
                    hits: 8,
                    errors: 1,
                    innings: {
                        "1": 1, "2": 0, "3": 2, "4": 0, "5": 0, "6": 0, "7": 1, "8": 0
                    }
                },
                away: {
                    total: 5,
                    hits: 10,
                    errors: 0,
                    innings: {
                        "1": 0, "2": 2, "3": 0, "4": 1, "5": 1, "6": 0, "7": 0, "8": 1
                    }
                }
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
