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
        ],
        lastMatchesHome: [
            {
                fixture: { date: "2026-07-15T20:00:00Z", status: { short: "FT" } },
                teams: { home: { name: "Real Madrid" }, away: { name: "Atletico Madrid" } },
                goals: { home: 2, away: 1 }
            },
            {
                fixture: { date: "2026-07-11T18:00:00Z", status: { short: "FT" } },
                teams: { home: { name: "Valencia" }, away: { name: "Real Madrid" } },
                goals: { home: 0, away: 2 }
            },
            {
                fixture: { date: "2026-07-08T21:00:00Z", status: { short: "FT" } },
                teams: { home: { name: "Real Madrid" }, away: { name: "Espanyol" } },
                goals: { home: 4, away: 1 }
            },
            {
                fixture: { date: "2026-07-04T19:00:00Z", status: { short: "FT" } },
                teams: { home: { name: "Real Betis" }, away: { name: "Real Madrid" } },
                goals: { home: 1, away: 1 }
            },
            {
                fixture: { date: "2026-07-01T20:00:00Z", status: { short: "FT" } },
                teams: { home: { name: "Real Madrid" }, away: { name: "Athletic Bilbao" } },
                goals: { home: 3, away: 0 }
            }
        ],
        lastMatchesAway: [
            {
                fixture: { date: "2026-07-16T20:00:00Z", status: { short: "FT" } },
                teams: { home: { name: "Barcelona" }, away: { name: "Osasuna" } },
                goals: { home: 3, away: 0 }
            },
            {
                fixture: { date: "2026-07-12T20:00:00Z", status: { short: "FT" } },
                teams: { home: { name: "Real Sociedad" }, away: { name: "Barcelona" } },
                goals: { home: 1, away: 2 }
            },
            {
                fixture: { date: "2026-07-09T19:00:00Z", status: { short: "FT" } },
                teams: { home: { name: "Barcelona" }, away: { name: "Sevilla" } },
                goals: { home: 2, away: 2 }
            },
            {
                fixture: { date: "2026-07-05T21:00:00Z", status: { short: "FT" } },
                teams: { home: { name: "Celta Vigo" }, away: { name: "Barcelona" } },
                goals: { home: 0, away: 1 }
            },
            {
                fixture: { date: "2026-07-02T19:00:00Z", status: { short: "FT" } },
                teams: { home: { name: "Getafe" }, away: { name: "Barcelona" } },
                goals: { home: 1, away: 3 }
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
            ],
            lastMatchesHome: [
                {
                    fixture: { date: "2026-07-15T20:00:00Z", status: { short: "FT" } },
                    teams: { home: { name: "Real Madrid" }, away: { name: "Atletico Madrid" } },
                    goals: { home: 2, away: 1 }
                },
                {
                    fixture: { date: "2026-07-11T18:00:00Z", status: { short: "FT" } },
                    teams: { home: { name: "Valencia" }, away: { name: "Real Madrid" } },
                    goals: { home: 0, away: 2 }
                },
                {
                    fixture: { date: "2026-07-08T21:00:00Z", status: { short: "FT" } },
                    teams: { home: { name: "Real Madrid" }, away: { name: "Espanyol" } },
                    goals: { home: 4, away: 1 }
                },
                {
                    fixture: { date: "2026-07-04T19:00:00Z", status: { short: "FT" } },
                    teams: { home: { name: "Real Betis" }, away: { name: "Real Madrid" } },
                    goals: { home: 1, away: 1 }
                },
                {
                    fixture: { date: "2026-07-01T20:00:00Z", status: { short: "FT" } },
                    teams: { home: { name: "Real Madrid" }, away: { name: "Athletic Bilbao" } },
                    goals: { home: 3, away: 0 }
                }
            ],
            lastMatchesAway: [
                {
                    fixture: { date: "2026-07-16T20:00:00Z", status: { short: "FT" } },
                    teams: { home: { name: "Barcelona" }, away: { name: "Osasuna" } },
                    goals: { home: 3, away: 0 }
                },
                {
                    fixture: { date: "2026-07-12T20:00:00Z", status: { short: "FT" } },
                    teams: { home: { name: "Real Sociedad" }, away: { name: "Barcelona" } },
                    goals: { home: 1, away: 2 }
                },
                {
                    fixture: { date: "2026-07-09T19:00:00Z", status: { short: "FT" } },
                    teams: { home: { name: "Barcelona" }, away: { name: "Sevilla" } },
                    goals: { home: 2, away: 2 }
                },
                {
                    fixture: { date: "2026-07-05T21:00:00Z", status: { short: "FT" } },
                    teams: { home: { name: "Celta Vigo" }, away: { name: "Barcelona" } },
                    goals: { home: 0, away: 1 }
                },
                {
                    fixture: { date: "2026-07-02T19:00:00Z", status: { short: "FT" } },
                    teams: { home: { name: "Getafe" }, away: { name: "Barcelona" } },
                    goals: { home: 1, away: 3 }
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

        // --- Probando Caso del Usuario (Sorpresa Tempranera con Underdog Ganando) ---
        console.log("\n--- Probando Caso del Usuario (Sorpresa Tempranera con Underdog Ganando) ---");
        const mockUserCase = {
            homeTeam: "Confiança",
            awayTeam: "AO Itabaiana",
            elapsed: 45,
            score: { home: 0, away: 1 },
            odds: { home: 1.90, draw: 3.00, away: 4.10 }, // AO Itabaiana es underdog
            ruleName: "Sorpresa Tempranera",
            ruleDetails: "El underdog AO Itabaiana ha tomado la ventaja.",
            stats: [
                {
                    team: { name: "Confiança" },
                    statistics: [
                        { type: "Ball Possession", value: "58%" },
                        { type: "Total Shots", value: 8 },
                        { type: "Corner Kicks", value: 4 }
                    ]
                },
                {
                    team: { name: "AO Itabaiana" },
                    statistics: [
                        { type: "Ball Possession", value: "42%" },
                        { type: "Total Shots", value: 4 },
                        { type: "Corner Kicks", value: 1 }
                    ]
                }
            ],
            events: [
                {
                    time: { elapsed: 15 },
                    team: { name: "AO Itabaiana" },
                    player: { name: "Tiago" },
                    type: "Goal",
                    detail: "Normal Goal"
                }
            ],
            lastMatchesHome: [],
            lastMatchesAway: []
        };
        const predUserCase = await aiService.generatePrediction(mockUserCase, 'football');
        console.log("Resultado del Caso del Usuario (AO Itabaiana va ganando):");
        console.log(predUserCase || "⚠️ ERROR: No se obtuvo respuesta.");
        outputText += `=== CASO USUARIO ===\n${predUserCase || 'Error'}\n\n`;

        // --- Probando IA con Parlay del Día ---
        console.log("\n--- Probando IA con Parlay del Día (Pre-Partido) ---");
        const mockParlayMatches = [
            {
                sport: 'football',
                homeTeam: "Arsenal",
                awayTeam: "Chelsea",
                leagueName: "Premier League",
                odds: { home: 1.45, draw: 4.20, away: 6.50 },
                lastMatchesHome: [
                    { fixture: { date: "2026-07-15", status: { short: "FT" } }, teams: { home: { name: "Arsenal" }, away: { name: "Everton" } }, goals: { home: 3, away: 0 } },
                    { fixture: { date: "2026-07-11", status: { short: "FT" } }, teams: { home: { name: "West Ham" }, away: { name: "Arsenal" } }, goals: { home: 1, away: 2 } }
                ],
                lastMatchesAway: [
                    { fixture: { date: "2026-07-16", status: { short: "FT" } }, teams: { home: { name: "Chelsea" }, away: { name: "Leicester" } }, goals: { home: 1, away: 1 } },
                    { fixture: { date: "2026-07-12", status: { short: "FT" } }, teams: { home: { name: "Bournemouth" }, away: { name: "Chelsea" } }, goals: { home: 2, away: 1 } }
                ]
            },
            {
                sport: 'football',
                homeTeam: "Bayern Munich",
                awayTeam: "Werder Bremen",
                leagueName: "Bundesliga",
                odds: { home: 1.22, draw: 6.00, away: 11.00 },
                lastMatchesHome: [
                    { fixture: { date: "2026-07-14", status: { short: "FT" } }, teams: { home: { name: "Bayern Munich" }, away: { name: "Stuttgart" } }, goals: { home: 4, away: 2 } }
                ],
                lastMatchesAway: [
                    { fixture: { date: "2026-07-15", status: { short: "FT" } }, teams: { home: { name: "Mainz" }, away: { name: "Werder Bremen" } }, goals: { home: 2, away: 0 } }
                ]
            },
            {
                sport: 'football',
                homeTeam: "Manchester City",
                awayTeam: "Liverpool",
                leagueName: "Premier League",
                odds: { home: 2.10, draw: 3.60, away: 3.20 },
                lastMatchesHome: [
                    { fixture: { date: "2026-07-14", status: { short: "FT" } }, teams: { home: { name: "Manchester City" }, away: { name: "Aston Villa" } }, goals: { home: 2, away: 1 } }
                ],
                lastMatchesAway: [
                    { fixture: { date: "2026-07-15", status: { short: "FT" } }, teams: { home: { name: "Liverpool" }, away: { name: "Wolves" } }, goals: { home: 3, away: 0 } }
                ]
            }
        ];

        const predParlay = await aiService.generateDailyParlay(mockParlayMatches);
        outputText += `=== PARLAY DEL DÍA ===\n${predParlay || 'Error'}\n\n`;

        // Validar extracción de confianza de los resultados anteriores
        const confFootball = predFootball ? (predFootball.match(/🔥 Confianza Estimada:\s*(\d+)%/i) ? predFootball.match(/🔥 Confianza Estimada:\s*(\d+)%/i)[1] + "%" : "No encontrada") : "Error";
        const confBaseball = predBaseball ? (predBaseball.match(/🔥 Confianza Estimada:\s*(\d+)%/i) ? predBaseball.match(/🔥 Confianza Estimada:\s*(\d+)%/i)[1] + "%" : "No encontrada") : "Error";
        
        console.log(`\nValidación de confianza en vivo:`);
        console.log(`- Confianza Fútbol: ${confFootball}`);
        console.log(`- Confianza Béisbol: ${confBaseball}`);

        outputText += `=== VALIDACIÓN CONFIANZA ===\nFútbol: ${confFootball}\nBéisbol: ${confBaseball}\n`;

        fs.writeFileSync('testAi_output.txt', outputText, 'utf-8');
        console.log("Pruebas completadas. Archivo testAi_output.txt generado.");
    } catch (error) {
        console.error("Error al ejecutar las pruebas:", error);
    }
}

run();
