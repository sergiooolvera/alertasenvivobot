const axios = require('axios');

// Cargar las claves desde variables de entorno
let apiKeys = [];
if (process.env.GEMINI_API_KEYS) {
    apiKeys = process.env.GEMINI_API_KEYS.split(',').map(k => k.trim()).filter(Boolean);
}

// Índice para la rotación de claves
let currentKeyIndex = 0;

/**
 * Obtiene la clave API actual.
 */
function getApiKey() {
    if (apiKeys.length === 0) return null;
    return apiKeys[currentKeyIndex];
}

/**
 * Rota a la siguiente clave API disponible.
 */
function rotateApiKey() {
    if (apiKeys.length > 1) {
        currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
        console.log(`[AI-Service] Rotando clave API de Gemini al índice: ${currentKeyIndex}`);
    }
}

/**
 * Realiza la llamada HTTP a la API de Gemini con reintentos y rotación de claves/modelos.
 */
async function callGeminiWithRotation(prompt) {
    const models = ['gemini-flash-latest', 'gemini-2.5-flash'];
    
    if (apiKeys.length === 0) {
        throw new Error("No hay API Keys de Gemini configuradas en las variables de entorno.");
    }

    let attempts = 0;
    // Permite probar cada combinación de clave + modelo
    const maxAttempts = apiKeys.length * models.length;

    while (attempts < maxAttempts) {
        const apiKey = getApiKey();
        
        // Alternar modelos: primero se intenta con gemini-1.5-flash, luego gemini-2.0-flash
        const modelIndex = Math.floor(attempts / apiKeys.length) % models.length;
        const model = models[modelIndex];
        
        try {
            console.log(`[AI-Service] Intentando generar contenido con modelo '${model}' usando clave de índice ${currentKeyIndex}`);
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            
            const response = await axios.post(url, {
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.85,
                    maxOutputTokens: 4000
                }
            }, {
                timeout: 20000 // 20 segundos de timeout para acomodar el thinking
            });

            if (response.status === 200 && response.data.candidates && response.data.candidates[0].content.parts[0].text) {
                return response.data.candidates[0].content.parts[0].text.trim();
            }
            throw new Error("La API no retornó una respuesta de texto válida.");
        } catch (error) {
            console.error(`[AI-Service] Intento fallido con modelo '${model}' e índice de clave ${currentKeyIndex}: ${error.message}`);
            // Rotamos la clave para el siguiente intento
            rotateApiKey();
            attempts++;
        }
    }

    throw new Error("Todas las claves API de Gemini y modelos de fallback fallaron.");
}

/**
 * Construye el prompt para fútbol en tono informal e irreverente.
 */
function buildFootballPrompt(matchData) {
    const { homeTeam, awayTeam, elapsed, score, odds, ruleName, ruleDetails, stats, events } = matchData;
    
    const statsStr = stats && stats.length > 0 ? JSON.stringify(stats) : "No disponibles";
    const eventsStr = events && events.length > 0 ? JSON.stringify(events) : "Ninguno relevante";

    return `Actúa como un tipster y analista de apuestas de fútbol profesional. Tu estilo de análisis DEBE ser sumamente informal, atrevido, directo, divertido e irreverente, usando emojis y jerga de fútbol. No seas aburrido ni corporativo.

Analiza este partido de fútbol en vivo que acaba de activar una alerta estadística:
- Partido: ${homeTeam} vs ${awayTeam}
- Minuto actual: ${elapsed}'
- Marcador actual: ${score.home} - ${score.away}
- Momios iniciales: Local ${odds.home} | Empate ${odds.draw} | Visitante ${odds.away}
- Regla estadística activada: "${ruleName}"
- Motivo: ${ruleDetails}
- Estadísticas del partido: ${statsStr}
- Eventos recientes: ${eventsStr}

Instrucciones para redactar la respuesta:
1. Genera un análisis rápido, agudo y entretenido de la dinámica del partido (máximo 3 líneas). Sé directo sobre quién está jugando mal, si el favorito está dando vergüenza o quién domina la presión.
2. Da una recomendación de apuesta concreta e inteligente basada en la alerta y las estadísticas del partido.
3. Sugiere un momio objetivo (debe ser @1.60 o superior).

Formato de salida obligatorio (usa exactamente este formato en español, no alteres los títulos de las secciones, no uses negritas en los nombres de campo iniciales sino tal cual se muestra a continuación, pero sí puedes usar negritas en el texto generado por ti):

🧠 Análisis de IA: [Tu análisis agudo e irreverente aquí]
🎯 Recomendación Inteligente: [Tu recomendación concreta de apuesta aquí]
📈 Momio Sugerido: @[Momio sugerido aquí, mínimo 1.60]`;
}

/**
 * Construye el prompt para béisbol en tono informal e irreverente.
 */
function buildBaseballPrompt(matchData) {
    const { homeTeam, awayTeam, inning, score, odds, ruleName, ruleDetails, stats } = matchData;
    const statsStr = stats ? JSON.stringify(stats) : "No disponibles";

    return `Actúa como un tipster y analista de apuestas de béisbol de la MLB profesional. Tu estilo de análisis DEBE ser sumamente informal, atrevido, directo, divertido e irreverente, usando emojis y jerga de béisbol. No seas aburrido ni corporativo.

Analiza este partido de béisbol en vivo que acaba de activar una alerta:
- Partido: ${homeTeam} vs ${awayTeam}
- Inning actual: ${inning}
- Marcador actual (Local - Visitante): ${score.home} - ${score.away}
- Momios iniciales: Local ${odds.home} | Visitante ${odds.away}
- Regla activada: "${ruleName}"
- Motivo: ${ruleDetails}
- Estadísticas o detalles adicionales: ${statsStr}

Instrucciones para redactar la respuesta:
1. Genera un análisis rápido y dinámico del juego (máximo 3 líneas). Opina sobre el picheo, bateo, si a algún lanzador le está temblando la mano o quién está dominando el montículo.
2. Da una recomendación de apuesta de béisbol concreta (ej: Over de carreras en entrada X, Hándicap, Gana en Entrada X, etc.).
3. Sugiere un momio objetivo (debe ser @1.60 o superior).

Formato de salida obligatorio (usa exactamente este formato en español, no alteres los títulos de las secciones, no uses negritas en los nombres de campo iniciales sino tal cual se muestra a continuación, pero sí puedes usar negritas en el texto generado por ti):

🧠 Análisis de IA: [Tu análisis agudo e irreverente aquí]
🎯 Recomendación Inteligente: [Tu recomendación concreta de apuesta aquí]
📈 Momio Sugerido: @[Momio sugerido aquí, mínimo 1.60]`;
}

/**
 * Genera el análisis y recomendación de IA usando Gemini.
 * Devuelve null si ocurre un fallo para que el bot use la alerta predeterminada.
 */
async function generatePrediction(matchData, sport = 'football') {
    if (apiKeys.length === 0) {
        console.warn("[AI-Service] No hay API keys de Gemini configuradas en .env. Se usará el análisis estático predeterminado.");
        return null;
    }

    try {
        let prompt;
        if (sport === 'baseball') {
            prompt = buildBaseballPrompt(matchData);
        } else {
            prompt = buildFootballPrompt(matchData);
        }

        const result = await callGeminiWithRotation(prompt);
        return result;
    } catch (error) {
        console.error(`[AI-Service] Error crítico generando recomendación con IA: ${error.message}. Utilizando fallback estático.`);
        return null;
    }
}

module.exports = {
    generatePrediction
};
