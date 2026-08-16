const axios = require('axios');

// Cargar las claves desde variables de entorno
let apiKeys = [];
if (process.env.GEMINI_API_KEYS) {
    apiKeys = process.env.GEMINI_API_KEYS.split(',').map(k => k.trim()).filter(Boolean);
}

const deepseekApiKey = process.env.DEEPSEEK_API_KEY || null;

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
    const models = ['gemini-3.5-flash', 'gemini-flash-latest'];
    
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
 * Realiza la llamada HTTP a la API de DeepSeek con fallback de modelos.
 */
async function callDeepSeekWithRotation(prompt) {
    if (!deepseekApiKey) {
        throw new Error("No hay API Key de DeepSeek configurada en las variables de entorno.");
    }

    const models = ['deepseek-chat', 'deepseek-v4-flash'];
    let attempts = 0;

    while (attempts < models.length) {
        const model = models[attempts];
        try {
            console.log(`[AI-Service] Intentando generar contenido con DeepSeek usando modelo '${model}'`);
            const response = await axios.post('https://api.deepseek.com/chat/completions', {
                model: model,
                messages: [
                    { role: 'user', content: prompt }
                ],
                temperature: 0.85,
                max_tokens: 2000
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${deepseekApiKey}`
                },
                timeout: 60000 // 60 segundos
            });

            if (response.status === 200 && response.data.choices && response.data.choices[0].message.content) {
                return response.data.choices[0].message.content.trim();
            }
            throw new Error("La API de DeepSeek no retornó una respuesta de texto válida.");
        } catch (error) {
            console.error(`[AI-Service] Intento fallido con DeepSeek modelo '${model}': ${error.message}`);
            if (error.response && error.response.status === 402) {
                throw new Error("DeepSeek falló debido a saldo insuficiente (Error 402).");
            }
            attempts++;
        }
    }

    throw new Error("Todos los modelos de DeepSeek fallaron.");
}

/**
 * Genera el análisis y recomendación de IA usando DeepSeek.
 * Devuelve null si ocurre un fallo.
 */
async function generatePredictionDeepSeek(matchData, sport = 'football', outContext = null) {
    if (!deepseekApiKey) {
        console.warn("[AI-Service] No hay API key de DeepSeek configurada en .env.");
        return null;
    }

    try {
        let prompt;
        if (sport === 'baseball') {
            prompt = buildBaseballPromptDeepSeek(matchData);
        } else {
            prompt = buildFootballPromptDeepSeek(matchData);
        }

        if (outContext && typeof outContext === 'object') {
            outContext.prompt = prompt;
        }

        const result = await callDeepSeekWithRotation(prompt);
        return result;
    } catch (error) {
        console.error(`[AI-Service] Error crítico generando recomendación con DeepSeek: ${error.message}`);
        return null;
    }
}

/**
 * Formatea las estadísticas de fútbol de la API en un texto amigable en español.
 */
function formatFootballStats(stats) {
    if (!stats || stats.length === 0) return "Estadísticas del partido: No disponibles";
    
    try {
        const homeTeamStats = stats[0];
        const awayTeamStats = stats[1];
        
        if (!homeTeamStats || !awayTeamStats) return "Estadísticas del partido: No disponibles";

        const homeName = homeTeamStats.team.name;
        const awayName = awayTeamStats.team.name;

        const getStatVal = (teamStat, type) => {
            const item = teamStat.statistics.find(s => s.type === type);
            return item && item.value !== null && item.value !== undefined ? item.value : 0;
        };

        const homePossession = getStatVal(homeTeamStats, "Ball Possession") || "50%";
        const awayPossession = getStatVal(awayTeamStats, "Ball Possession") || "50%";

        const homeShots = getStatVal(homeTeamStats, "Total Shots");
        const awayShots = getStatVal(awayTeamStats, "Total Shots");

        const homeShotsOn = getStatVal(homeTeamStats, "Shots on Goal");
        const awayShotsOn = getStatVal(awayTeamStats, "Shots on Goal");

        const homeCorners = getStatVal(homeTeamStats, "Corner Kicks");
        const awayCorners = getStatVal(awayTeamStats, "Corner Kicks");

        const homeFouls = getStatVal(homeTeamStats, "Fouls");
        const awayFouls = getStatVal(awayTeamStats, "Fouls");

        const homeYellows = getStatVal(homeTeamStats, "Yellow Cards");
        const awayYellows = getStatVal(awayTeamStats, "Yellow Cards");

        const homeReds = getStatVal(homeTeamStats, "Red Cards");
        const awayReds = getStatVal(awayTeamStats, "Red Cards");

        return `📊 Estadísticas de juego en vivo:
- Posesión: ${homeName} ${homePossession} vs ${awayPossession} ${awayName}
- Tiros totales: ${homeName} ${homeShots} (${homeShotsOn} a puerta) vs ${awayShots} (${awayShotsOn} a puerta) ${awayName}
- Tiros de esquina: ${homeName} ${homeCorners} vs ${awayCorners} ${awayName}
- Faltas cometidas: ${homeName} ${homeFouls} vs ${awayFouls} ${awayName}
- Tarjetas: ${homeName} (🟨${homeYellows} / 🟥${homeReds}) vs (🟨${awayYellows} / 🟥${awayReds}) ${awayName}`;
    } catch (e) {
        console.error("[AI-Service] Error formateando estadísticas de fútbol:", e.message);
        return "Estadísticas del partido: Error al procesar.";
    }
}

/**
 * Formatea los eventos de fútbol de la API en una línea de tiempo compacta.
 */
function formatFootballEvents(events) {
    if (!events || events.length === 0) return "Ninguno relevante";
    
    try {
        const relevantEvents = events.filter(e => e.type === "Goal" || e.type === "Card");
        if (relevantEvents.length === 0) return "Ninguno relevante";

        const formatted = relevantEvents.map(e => {
            const time = e.time.elapsed + (e.time.extra ? `+${e.time.extra}` : "");
            const team = e.team.name;
            const player = e.player ? e.player.name : "Jugador desconocido";
            
            if (e.type === "Goal") {
                const detail = e.detail || "Gol";
                return `⚽ [Min ${time}'] ¡GOL de ${team}! - ${player} (${detail})`;
            } else if (e.type === "Card") {
                const isRed = e.detail === "Red Card" || e.detail === "Yellow 2nd";
                const cardEmoji = isRed ? "🟥" : "🟨";
                return `${cardEmoji} [Min ${time}'] Tarjeta para ${team} - ${player} (${e.detail})`;
            }
            return null;
        }).filter(Boolean);

        return formatted.length > 0 ? formatted.join("\n") : "Ninguno relevante";
    } catch (e) {
        console.error("[AI-Service] Error formateando eventos de fútbol:", e.message);
        return "Error al procesar eventos.";
    }
}

/**
 * Formatea las estadísticas de béisbol (MLB) en un texto estructurado.
 */
function formatBaseballStats(stats) {
    if (!stats) return "Estadísticas del partido: No disponibles";

    try {
        const homeTotal = stats.home && stats.home.total !== undefined ? stats.home.total : 0;
        const awayTotal = stats.away && stats.away.total !== undefined ? stats.away.total : 0;
        const homeHits = stats.home && stats.home.hits !== undefined ? stats.home.hits : 0;
        const awayHits = stats.away && stats.away.hits !== undefined ? stats.away.hits : 0;
        const homeErrors = stats.home && stats.home.errors !== undefined ? stats.home.errors : 0;
        const awayErrors = stats.away && stats.away.errors !== undefined ? stats.away.errors : 0;

        let inningsStr = "Carreras por entrada:\n";
        if (stats.home && stats.home.innings) {
            const homeInnings = stats.home.innings;
            const awayInnings = (stats.away && stats.away.innings) ? stats.away.innings : {};
            
            const inningsKeys = Object.keys(homeInnings).sort((a, b) => parseInt(a) - parseInt(b));
            
            if (inningsKeys.length > 0) {
                inningsKeys.forEach(inn => {
                    const hScore = homeInnings[inn] !== null && homeInnings[inn] !== undefined ? homeInnings[inn] : "-";
                    const aScore = awayInnings[inn] !== null && awayInnings[inn] !== undefined ? awayInnings[inn] : "-";
                    inningsStr += `- Inning ${inn}: Local ${hScore} | Visitante ${aScore}\n`;
                });
            } else {
                inningsStr += "- Aún no hay registro de entradas.\n";
            }
        } else {
            inningsStr += "- Detalle de entradas no disponible.\n";
        }

        return `📊 Desglose de Línea (Runs / Hits / Errors):
- Carreras: Local ${homeTotal} vs ${awayTotal} Visitante
- Hits: Local ${homeHits} vs ${awayHits} Visitante
- Errores: Local ${homeErrors} vs ${awayErrors} Visitante

${inningsStr.trim()}`;
    } catch (e) {
        console.error("[AI-Service] Error formateando estadísticas de béisbol:", e.message);
        return "Estadísticas del partido: Error al procesar.";
    }
}

/**
 * Formatea los últimos partidos de un equipo de fútbol en un texto compacto.
 */
function formatLastMatches(teamName, matches) {
    if (!matches || matches.length === 0) return `Últimos partidos de ${teamName}: No disponibles`;
    
    try {
        const formatted = matches.map(m => {
            const date = m.fixture.date ? m.fixture.date.split('T')[0] : 'N/A';
            const homeName = m.teams.home.name;
            const awayName = m.teams.away.name;
            const homeGoals = m.goals.home !== null && m.goals.home !== undefined ? m.goals.home : '-';
            const awayGoals = m.goals.away !== null && m.goals.away !== undefined ? m.goals.away : '-';
            const status = m.fixture.status.short || 'N/A';
            return `- [${date}] ${homeName} ${homeGoals} - ${awayGoals} ${awayName} (${status})`;
        }).join('\n');
        
        return `Últimos partidos de ${teamName}:\n${formatted}`;
    } catch (e) {
        console.error(`[AI-Service] Error formateando últimos partidos para ${teamName}:`, e.message);
        return `Últimos partidos de ${teamName}: Error al procesar.`;
    }
}

/**
 * Formatea los últimos enfrentamientos directos (H2H) en un texto compacto.
 */
function formatH2HMatches(matches) {
    if (!matches || matches.length === 0) return 'Enfrentamientos directos recientes: No disponibles';
    
    try {
        const formatted = matches.map(m => {
            const date = m.fixture.date ? m.fixture.date.split('T')[0] : 'N/A';
            const homeName = m.teams.home.name;
            const awayName = m.teams.away.name;
            const homeGoals = m.goals.home !== null && m.goals.home !== undefined ? m.goals.home : '-';
            const awayGoals = m.goals.away !== null && m.goals.away !== undefined ? m.goals.away : '-';
            const status = m.fixture.status.short || 'N/A';
            return `- [${date}] ${homeName} ${homeGoals} - ${awayGoals} ${awayName} (${status})`;
        }).join('\n');
        
        return `Enfrentamientos directos recientes:\n${formatted}`;
    } catch (e) {
        console.error('[AI-Service] Error formateando enfrentamientos directos H2H:', e.message);
        return 'Enfrentamientos directos recientes: Error al procesar.';
    }
}

/**
 * Construye el prompt para fútbol en tono formal y técnico.
 */
function buildFootballPrompt(matchData) {
    const { homeTeam, awayTeam, leagueName, leagueRound, elapsed, score, odds, ruleName, ruleDetails, stats, events, lastMatchesHome, lastMatchesAway, h2hMatches } = matchData;
    
    const statsStr = formatFootballStats(stats);
    const eventsStr = formatFootballEvents(events);
    const lastMatchesHomeStr = formatLastMatches(homeTeam, lastMatchesHome);
    const lastMatchesAwayStr = formatLastMatches(awayTeam, lastMatchesAway);
    const h2hMatchesStr = formatH2HMatches(h2hMatches);

    return `Actúa como un analista profesional de apuestas deportivas de fútbol. Tu estilo de análisis DEBE ser formal, técnico, objetivo y preciso. Evita el lenguaje informal, coloquial, vulgar o irreverente. Presenta la información de forma estructurada y analítica, adecuada para inversionistas deportivos serios.
 
Analiza este partido de fútbol en vivo que acaba de activar una alerta estadística:
- Partido: ${homeTeam} vs ${awayTeam}
- Competición: ${leagueName}
- Ronda/Fase: ${leagueRound}
- Minuto actual: ${elapsed}'
- Marcador actual: ${score.home} - ${score.away}
- Momios iniciales: Local ${odds.home} | Empate ${odds.draw} | Visitante ${odds.away}
- Regla estadística activada: "${ruleName}"
- Motivo: ${ruleDetails && ruleDetails.trim() ? ruleDetails : 'N/A'}
 
${statsStr}
 
📋 Línea de Tiempo de Eventos:
${eventsStr}
 
📊 Rendimiento Histórico Reciente (Últimos 5 partidos):
${lastMatchesHomeStr}
 
${lastMatchesAwayStr}

📊 Enfrentamientos Directos Recientes (Últimos 5 partidos H2H):
${h2hMatchesStr}
 
Instrucciones para redactar la respuesta:
1. Realice un análisis formal de la dinámica de juego combinando las estadísticas en vivo con el rendimiento histórico reciente provisto de ambos equipos y sus enfrentamientos directos (un solo párrafo conciso de máximo 50 palabras).
   * ANÁLISIS DE ELIMINATORIAS Y CONTEXTO: Evalúa el tipo de partido según la competición y ronda provistas:
     1. Si es una eliminatoria de ida y vuelta (ej. Octavos, Cuartos, Semifinales en copas o liguillas), busca en el historial reciente de los últimos partidos provistos de ambos equipos el encuentro de ida (mismos rivales con localía invertida), deduce su marcador final y calcula el marcador global sumando el resultado en vivo para sopesar cuál equipo tiene la urgencia real de atacar en el vivo.
     2. Si es un encuentro en Cancha Neutral (ej. finales a partido único, mundiales), ignora la ventaja de localía del equipo catalogado como "home" y asume que ambos compiten bajo igualdad de condiciones geográficas.
     3. Si es un partido de torneo o liga regular normal (ej. jornadas semanales de liga regular), analízalo como un partido de liga estándar único donde el local tiene la ventaja habitual del estadio y ambos equipos pelean por los 3 puntos en disputa.
     Incorpora explícitamente estas conclusiones en tu análisis de la dinámica de juego.
2. Proporcione una recomendación de apuesta concreta y de alta probabilidad basada en los datos analizados.
   * REGLA DE DESCARTE DE APUESTAS: Si del análisis de datos en vivo (ej: marcador, pocos tiros a puerta, nula reacción) y del historial de partidos recientes concluyes que operar este partido es sumamente riesgoso, inestable o carece de valor matemático claro, debes recomendar evitar la operación. En ese caso, la recomendación inteligente DEBE ser exactamente: "Evitar apuesta / No recomendada" (sin comillas).
   * REGLA DE VALOR EN LÍNEAS DE GOLES (CRÍTICA): Si el marcador en vivo ya suma un total de G goles (ej: si va 1-0 o 0-1, G = 1; si va 2-0 o 1-1, G = 2), NUNCA sugieras como apuesta "Más de (G + 0.5) Goles en el Partido" (ej. "Más de 1.5 Goles en el Partido" si el marcador actual es 1-0 o 0-1), ya que esta apuesta requiere un solo gol adicional y en vivo pagará una cuota extremadamente baja (menor a @1.30), lo cual no tiene valor de inversión y viola el requisito de momio mínimo de @1.60. Si prevés más goles, debes sugerir una línea con valor real como "Más de (G + 1.5) Goles en el Partido" (ej. "Más de 2.5 Goles en el Partido" si va 1-0), o "Más de (G + 0.5) Goles en el Primer Tiempo" (si estamos en la primera mitad), o "Siguiente Gol de [Nombre del Equipo]".
3. Sugiera un momio objetivo en vivo (mínimo @1.60 o superior). Este momio DEBE ser realista para el mercado en vivo de acuerdo con la situación del partido. En caso de haber recomendado "Evitar apuesta / No recomendada", puedes poner "No aplica" o "@1.60" por compatibilidad de formato.
   * REGLA DE REALISMO DE MOMIOS: Si el equipo recomendado ya va ganando, la Doble Oportunidad (1X/X2) o Hándicaps a su favor (como +1.5) NO tendrán momios de @1.60+ en vivo (serán de @1.10 o menores). Para obtener un momio de @1.60+ en este caso, debes recomendar su victoria directa (ML), que anotará el próximo gol, o el Over de Goles Totales del partido. Solo recomienda Doble Oportunidad o Hándicaps positivos de @1.60+ para el equipo que va empatando o perdiendo.
4. Estime una probabilidad matemática/nivel de confianza de acierto para esta recomendación de apuesta basada estrictamente en los datos del análisis (entre 0% y 100%). Si recomiendas evitar la apuesta, indica una confianza baja (ej: menor al 50%) que refleje la peligrosidad del partido.
 
Formato de salida obligatorio (usa exactamente este formato en español, no alteres los títulos de las secciones, no uses negritas en los nombres de campo iniciales sino tal cual se muestra a continuación, pero sí puedes usar negritas en el texto generado por ti):
 
🧠 Análisis de IA: [Su análisis técnico y formal aquí]
🎯 Recomendación Inteligente: [Su recomendación técnica de apuesta aquí]
📈 Momio Sugerido: @[Momio sugerido aquí, mínimo 1.60]
🔥 Confianza Estimada: [Porcentaje de confianza entre 0% y 100%, solo el número con el símbolo %]`;
}

/**
 * Construye el prompt para béisbol en tono formal y técnico.
 */
function buildBaseballPrompt(matchData) {
    const { homeTeam, awayTeam, leagueName, leagueRound, inning, score, odds, ruleName, ruleDetails, stats } = matchData;
    const statsStr = formatBaseballStats(stats);

    return `Actúa como un analista profesional de apuestas deportivas de béisbol de la MLB. Tu estilo de análisis DEBE ser formal, técnico, objetivo y preciso. Evita el lenguaje informal, coloquial o irreverente. Presenta la información de forma estructurada y analítica, adecuada para inversionistas deportivos serios.
 
Analiza este partido de béisbol en vivo que acaba de activar una alerta:
- Partido: ${homeTeam} vs ${awayTeam}
- Competición: ${leagueName || 'MLB'}
- Ronda/Fase: ${leagueRound || 'Regular Season'}
- Inning actual: ${inning}
- Marcador actual (Local - Visitante): ${score.home} - ${score.away}
- Momios iniciales: Local ${odds.home} | Visitante ${odds.away}
- Regla activada: "${ruleName}"
- Motivo: ${ruleDetails && ruleDetails.trim() ? ruleDetails : 'N/A'}
 
${statsStr}
 
Instrucciones para redactar la respuesta:
1. Realice un análisis formal y técnico del juego (un solo párrafo conciso de máximo 50 palabras) utilizando la dinámica del picheo, bateo, hits y errores mostrados en el vivo, y la importancia del partido de acuerdo con la competición y la ronda (ej. tensión extra si es postemporada/playoffs).
2. Proporcione una recomendación de apuesta concreta basada en los datos estadísticos del partido.
   * REGLA DE DESCARTE DE APUESTAS: Si del análisis en vivo (ej: picheo inestable, alto porcentaje de hits del rival, tendencia a errores) concluyes que operar este partido es sumamente riesgoso, inestable o carece de valor matemático claro, debes recomendar evitar la operación. En ese caso, la recomendación inteligente DEBE ser exactamente: "Evitar apuesta / No recomendada" (sin comillas).
3. Sugiera un momio objetivo (mínimo @1.60 o superior). Este momio DEBE ser realista para el mercado en vivo de acuerdo con la situación del partido. En caso de haber recomendado "Evitar apuesta / No recomendada", puedes poner "No aplica" o "@1.60" por compatibilidad de formato.
   * REGLA DE REALISMO DE MOMIOS: Si el equipo recomendado ya va ganando en las entradas medias/finales, la línea de dinero (ML) o Hándicaps a su favor NO tendrán momios de @1.60+ en vivo. Para obtener un momio de @1.60+ en este caso, debes sugerir el Over de Carreras Totales del juego, Hándicap negativo del líder, o apostar a la reacción del equipo que va perdiendo (ML o Hándicap positivo del equipo en desventaja).
4. Estime una probabilidad matemática/nivel de confianza de acierto para esta recomendación de apuesta basada en los datos del partido (entre 0% y 100%). Si recomiendas evitar la apuesta, indica una confianza baja (ej: menor al 50%) que refleje la peligrosidad del partido.
 
Formato de salida obligatorio (usa exactamente este formato en español, no alteres los títulos de las secciones, no uses negritas en los nombres de campo iniciales sino tal cual se muestra a continuación, pero sí puedes usar negritas en el texto generado por ti):
 
🧠 Análisis de IA: [Su análisis técnico y formal aquí]
🎯 Recomendación Inteligente: [Su recomendación técnica de apuesta aquí]
📈 Momio Sugerido: @[Momio sugerido aquí, mínimo 1.60]
🔥 Confianza Estimada: [Porcentaje de confianza entre 0% y 100%, solo el número con el símbolo %]`;
}

/**
 * Construye el prompt específico para DeepSeek (Fútbol) - Optimizado para brevedad.
 */
function buildFootballPromptDeepSeek(matchData) {
    const { homeTeam, awayTeam, leagueName, leagueRound, elapsed, score, odds, ruleName, ruleDetails, stats, events, lastMatchesHome, lastMatchesAway, h2hMatches } = matchData;
    
    const statsStr = formatFootballStats(stats);
    const eventsStr = formatFootballEvents(events);
    const lastMatchesHomeStr = formatLastMatches(homeTeam, lastMatchesHome);
    const lastMatchesAwayStr = formatLastMatches(awayTeam, lastMatchesAway);
    const h2hMatchesStr = formatH2HMatches(h2hMatches);

    return `Actúa como un analista profesional de apuestas deportivas de fútbol. Tu estilo debe ser sumamente directo, conciso, objetivo y preciso. Evita dar explicaciones largas o análisis redundantes.
 
Analiza este partido de fútbol en vivo que acaba de activar una alerta estadística:
- Partido: ${homeTeam} vs ${awayTeam}
- Competición: ${leagueName}
- Ronda/Fase: ${leagueRound}
- Minuto actual: ${elapsed}'
- Marcador actual: ${score.home} - ${score.away}
- Momios iniciales: Local ${odds.home} | Empate ${odds.draw} | Visitante ${odds.away}
- Regla estadística activada: "${ruleName}"
- Motivo: ${ruleDetails && ruleDetails.trim() ? ruleDetails : 'N/A'}
 
${statsStr}
 
📋 Línea de Tiempo de Eventos:
${eventsStr}
 
📊 Rendimiento Histórico Reciente (Últimos 5 partidos):
${lastMatchesHomeStr}
${lastMatchesAwayStr}
 
📊 Enfrentamientos Directos Recientes (Últimos 5 partidos H2H):
${h2hMatchesStr}

Instrucciones obligatorias para redactar la respuesta:
1. El "Análisis de IA" debe ser extremadamente corto y directo, redactado en un solo párrafo conciso de máximo 50 palabras (máximo 120 caracteres) sobre la dinámica de juego actual.
2. La "Recomendación Inteligente" DEBE ser una apuesta directa de 2 a 8 palabras (ej. "Victoria de ${homeTeam}", "Más de 2.5 Goles en el Partido", "Siguiente Gol de ${awayTeam}", "Más de 8.5 Córners Totales"). NO utilices justificaciones, explicaciones largas ni rodeos.
   * REGLA DE VALOR EN LÍNEAS DE GOLES (CRÍTICA): Si el marcador en vivo ya suma un total de G goles (ej: si va 1-0 o 0-1, G = 1; si va 2-0 o 1-1, G = 2), NUNCA sugieras como apuesta "Más de (G + 0.5) Goles en el Partido" (ej. "Más de 1.5 Goles en el Partido" si el marcador actual es 1-0 o 0-1), ya que esta apuesta requiere un solo gol adicional y en vivo pagará una cuota extremadamente baja (menor a @1.30), lo cual no tiene valor de inversión y viola el requisito de momio mínimo de @1.60. Si prevés más goles, debes sugerir una línea con valor real como "Más de (G + 1.5) Goles en el Partido" (ej. "Más de 2.5 Goles en el Partido" si va 1-0), o "Más de (G + 0.5) Goles en el Primer Tiempo" (si es la primera mitad), o "Siguiente Gol de [Nombre de Equipo]".
3. REGLA DE DESCARTE DE APUESTAS: Evita el sesgo de descarte ("Evitar apuesta / No recomendada"). Solo debes sugerir evitar la apuesta si el partido está completamente muerto (marcador abultado sin nada por jugar o total ausencia de datos). En cualquier otro escenario activo, analiza y busca una recomendación real de valor deportivo.
4. Sugiera un momio objetivo en vivo realista (mínimo @1.60 o superior). Recuerda sugerir victoria directa, próximo gol o totales para momios realistas de @1.60+ si el equipo favorito va ganando.
5. Estime una probabilidad matemática/nivel de confianza de acierto (entre 0% y 100%).
 
Formato de salida obligatorio (usa exactamente este formato en español, no uses negritas en los nombres de los campos, no agregues texto extra fuera de este formato):
 
🧠 Análisis de IA: [Frase ultra corta, un solo párrafo de máximo 50 palabras]
🎯 Recomendación Inteligente: [Apuesta ultra directa, de 2 a 8 palabras]
📈 Momio Sugerido: @[Momio sugerido aquí, mínimo 1.60]
🔥 Confianza Estimada: [Porcentaje]%`;
}

/**
 * Construye el prompt específico para DeepSeek (Béisbol) - Optimizado para brevedad.
 */
function buildBaseballPromptDeepSeek(matchData) {
    const { homeTeam, awayTeam, leagueName, leagueRound, inning, score, odds, ruleName, ruleDetails, stats } = matchData;
    const statsStr = formatBaseballStats(stats);

    return `Actúa como un analista profesional de apuestas deportivas de béisbol de la MLB. Tu estilo debe ser sumamente directo, conciso, objetivo y preciso. Evita dar explicaciones largas o análisis redundantes.
 
Analiza este partido de béisbol en vivo que acaba de activar una alerta:
- Partido: ${homeTeam} vs ${awayTeam}
- Competición: ${leagueName || 'MLB'}
- Ronda/Fase: ${leagueRound || 'Regular Season'}
- Inning actual: ${inning}
- Marcador actual (Local - Visitante): ${score.home} - ${score.away}
- Momios iniciales: Local ${odds.home} | Visitante ${odds.away}
- Regla activada: "${ruleName}"
- Motivo: ${ruleDetails && ruleDetails.trim() ? ruleDetails : 'N/A'}
 
${statsStr}
 
Instrucciones obligatorias para redactar la respuesta:
1. El "Análisis de IA" debe ser extremadamente corto y directo, redactado en un solo párrafo conciso de máximo 50 palabras (máximo 120 caracteres) sobre la dinámica de juego actual.
2. La "Recomendación Inteligente" DEBE ser una apuesta directa de 2 a 8 palabras (ej. "Victoria de ${homeTeam}", "Más de 7.5 Carreras en el Juego", "Hándicap de Run Line ${awayTeam} +1.5"). NO utilices justificaciones, explicaciones largas ni rodeos.
3. REGLA DE DESCARTE DE APUESTAS: Evita el sesgo de descarte ("Evitar apuesta / No recomendada"). Solo debes sugerir evitar la apuesta si el partido está completamente resuelto o no hay datos estadísticos de picheo y bateo. En cualquier otro escenario activo, analiza y busca una recomendación real de valor deportivo.
4. Sugiera un momio objetivo en vivo realista (mínimo @1.60 o superior).
5. Estime una probabilidad matemática/nivel de confianza de acierto (entre 0% y 100%).
 
Formato de salida obligatorio (usa exactamente este formato en español, no uses negritas en los nombres de los campos, no agregues texto extra fuera de este formato):
 
🧠 Análisis de IA: [Frase ultra corta, un solo párrafo de máximo 50 palabras]
🎯 Recomendación Inteligente: [Apuesta ultra directa, de 2 a 8 palabras]
📈 Momio Sugerido: @[Momio sugerido aquí, mínimo 1.60]
🔥 Confianza Estimada: [Porcentaje]%`;
}

/**
 * Genera el análisis y recomendación de IA usando Gemini.
 * Devuelve null si ocurre un fallo para que el bot use la alerta predeterminada.
 */
async function generatePrediction(matchData, sport = 'football', outContext = null) {
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

        if (outContext && typeof outContext === 'object') {
            outContext.prompt = prompt;
        }

        const result = await callGeminiWithRotation(prompt);
        return result;
    } catch (error) {
        console.error(`[AI-Service] Error crítico generando recomendación con IA: ${error.message}. Utilizando fallback estático.`);
        return null;
    }
}

/**
 * Construye el prompt para el Parlay del Día pre-partido.
 */
function buildDailyParlayPrompt(matchesData) {
    const matchesStr = matchesData.map((m, idx) => {
        const type = m.sport === 'baseball' ? '⚾ BÉISBOL MLB' : '⚽ FÚTBOL';
        const oddsStr = m.sport === 'baseball' 
            ? `Local ${m.odds.home} | Visita ${m.odds.away}`
            : `Local ${m.odds.home} | Empate ${m.odds.draw} | Visita ${m.odds.away}`;
        
        let lastMatchesStr = '';
        if (m.sport === 'football') {
            const lastHome = formatLastMatches(m.homeTeam, m.lastMatchesHome);
            const lastAway = formatLastMatches(m.awayTeam, m.lastMatchesAway);
            lastMatchesStr = `\n${lastHome}\n${lastAway}`;
        }
        
        return `--- PARTIDO #${idx + 1} (${type}) ---
- Deporte/Liga: ${type} - ${m.leagueName}
- Encuentro: ${m.homeTeam} vs ${m.awayTeam}
- Momios Iniciales: ${oddsStr}${lastMatchesStr}`;
    }).join('\n\n');

    return `Actúa como un analista profesional senior de apuestas deportivas. Tu estilo de análisis DEBE ser formal, técnico, objetivo y preciso. Evita el lenguaje informal, coloquial o irreverente.

Tu misión es crear el "PARLAY DEL DÍA" (Dupla o Tripla) más certero y seguro posible a partir de la siguiente lista de partidos que se jugarán hoy:

${matchesStr}

Instrucciones para la selección y redacción:
1. Analiza cada partido basándote en los momios iniciales y el rendimiento histórico reciente (si está disponible).
2. Selecciona únicamente los 2 (máximo 3) partidos con mayor certeza matemática y menor riesgo.
3. Define un pronóstico para cada selección elegida (ej. Doble oportunidad, Over 1.5 goles, Gana favorito, etc.).
4. Asegúrate de que las apuestas elegidas sean seguras y sumen un momio acumulado atractivo (idealmente entre @1.70 y @2.50).
5. Justifica formalmente la selección de cada partido en el Parlay.

Formato de salida obligatorio (usa exactamente este formato en español, no alteres los títulos de las secciones, no uses negritas en los nombres de campo iniciales, pero sí puedes usar negritas en el texto generado por ti):

🏆 PARLAY DEL DÍA DE LA IA 🏆

📊 SELECCIONES:
1. [Deporte - Liga] [Equipo Local] vs [Equipo Visitante] -> Pronóstico: [Su recomendación técnica] (Momio: @[Momio])
2. [Deporte - Liga] [Equipo Local] vs [Equipo Visitante] -> Pronóstico: [Su recomendación técnica] (Momio: @[Momio])

📈 MOMIO TOTAL ESTIMADO: @[Suma multiplicada de los momios]
🔥 CONFIANZA COMBINADA: [Porcentaje estimado de certeza del parlay total]%

🧠 JUSTIFICACIÓN TÉCNICA:
• [Justificación técnica formal y estructurada del Partido #1, combinando momios y datos históricos]
• [Justificación técnica formal y estructurada del Partido #2, combinando momios y datos históricos]`;
}

/**
 * Genera el Parlay del Día usando Gemini a partir de una lista de partidos pre-partido.
 */
async function generateDailyParlay(matchesData) {
    if (apiKeys.length === 0) {
        console.warn("[AI-Service] No hay API keys de Gemini configuradas en .env. No se puede generar parlay.");
        return null;
    }

    try {
        const prompt = buildDailyParlayPrompt(matchesData);
        const result = await callGeminiWithRotation(prompt);
        return result;
    } catch (error) {
        console.error(`[AI-Service] Error crítico generando parlay con IA: ${error.message}`);
        return null;
    }
}

/**
 * Formatea los datos finales de un partido de fútbol para el prompt de evaluación de la IA.
 */
function formatFootballFinalData(finalData) {
    const { fixture, events, stats } = finalData;
    const homeTeam = fixture.teams.home.name;
    const awayTeam = fixture.teams.away.name;
    const finalHome = fixture.goals.home || 0;
    const finalAway = fixture.goals.away || 0;
    
    let eventsStr = '';
    if (events && events.length > 0) {
        eventsStr = `\n📋 Eventos del partido:\n` + formatFootballEvents(events);
    }
    
    let statsStr = '';
    if (stats && stats.length > 0) {
        statsStr = `\n📊 Estadísticas del partido:\n` + formatFootballStats(stats);
    }

    return `- Partido: ${homeTeam} vs ${awayTeam}
- Marcador final: ${finalHome} - ${finalAway}${eventsStr}${statsStr}`;
}

/**
 * Formatea los datos finales de un partido de béisbol para el prompt de evaluación de la IA.
 */
function formatBaseballFinalData(finalGame) {
    const homeTeam = finalGame.teams?.home?.name || 'Local';
    const awayTeam = finalGame.teams?.away?.name || 'Visitante';
    const finalHomeRuns = (finalGame.scores && finalGame.scores.home && finalGame.scores.home.total !== undefined) ? finalGame.scores.home.total : 0;
    const finalAwayRuns = (finalGame.scores && finalGame.scores.away && finalGame.scores.away.total !== undefined) ? finalGame.scores.away.total : 0;
    
    let statsStr = '';
    if (finalGame.scores) {
        statsStr = `\n📊 Desglose final:\n` + formatBaseballStats(finalGame.scores);
    }

    return `- Partido: ${homeTeam} vs ${awayTeam}
- Carreras finales: Local ${finalHomeRuns} - ${finalAwayRuns} Visitante${statsStr}`;
}

/**
 * Evalúa si una recomendación de la IA resultó en GREEN o RED según el resultado final del encuentro.
 */
async function evaluatePredictionOutcome(sport, aiRecommendation, finalData) {
    if (apiKeys.length === 0) {
        console.warn("[AI-Service] No hay API keys de Gemini configuradas para evaluar. Se usará fallback estático.");
        return null;
    }

    try {
        const formattedData = sport === 'baseball' 
            ? formatBaseballFinalData(finalData) 
            : formatFootballFinalData(finalData);

        const prompt = `Actúa como un validador oficial y objetivo de apuestas deportivas en español.
Determina si la siguiente recomendación de apuesta resultó ganadora (GREEN) o perdedora (RED) basándote en los datos finales del partido.

Deporte: ${sport === 'baseball' ? 'Béisbol' : 'Fútbol'}
Recomendación de apuesta realizada: "${aiRecommendation}"

Datos finales del partido:
${formattedData}

Instrucciones obligatorias:
1. Responde ÚNICAMENTE en formato JSON válido con la siguiente estructura exacta:
{
  "isGreen": true o false,
  "explanation": "Una breve explicación de una sola frase (en español) de por qué la recomendación se ganó o se perdió basándote en el marcador o eventos finales."
}
2. No incluyas nada más en tu respuesta. No uses bloques de código con markdown (como \`\`\`json). Solo el texto plano del objeto JSON.`;

        console.log(`[AI-Service] Evaluando veredicto para recomendación: "${aiRecommendation}"`);
        const resultText = await callGeminiWithRotation(prompt);
        if (resultText) {
            const cleanJsonText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
            const resultObj = JSON.parse(cleanJsonText);
            return {
                isGreen: !!resultObj.isGreen,
                explanation: resultObj.explanation || 'Evaluación completada por IA.'
            };
        }
        return null;
    } catch (error) {
        console.error(`[AI-Service] Error evaluando el resultado con IA: ${error.message}`);
        return null;
    }
}

/**
 * Busca en la web el resultado de un partido y evalúa la recomendación (GREEN / RED / CANCELLED).
 */
async function resolveVerdictViaWeb(sport, homeTeam, awayTeam, date, aiRecommendation) {
    if (apiKeys.length === 0) {
        console.warn("[AI-Service] No hay API keys de Gemini configuradas para buscar en la web.");
        return null;
    }

    try {
        const prompt = `Actúa como un validador oficial y objetivo de apuestas deportivas en español.
Busca en la web el resultado final del partido de ${sport === 'baseball' ? 'Béisbol' : 'Fútbol'} jugado el ${date} entre ${homeTeam} y ${awayTeam}.
Determina si la recomendación de apuesta "${aiRecommendation}" resultó ganadora (GREEN), perdedora (RED), o si el partido fue cancelado/suspendido/pospuesto (CANCELLED).

Instrucciones obligatorias:
1. Responde ÚNICAMENTE en formato JSON válido con la siguiente estructura exacta:
{
  "score": "Resultado final (ej. 2-1)",
  "outcome": "GREEN" | "RED" | "CANCELLED",
  "explanation": "Una breve explicación de por qué la recomendación fue GREEN, RED o CANCELLED basándote en el resultado del partido encontrado en la web."
}
2. No incluyas nada más en tu respuesta. No uses bloques de código con markdown (como \`\`\`json). Solo el texto plano del objeto JSON.`;

        const models = ['gemini-2.5-flash', 'gemini-flash-latest'];
        let attempts = 0;
        const maxAttempts = apiKeys.length * models.length;

        while (attempts < maxAttempts) {
            const apiKey = getApiKey();
            const modelIndex = Math.floor(attempts / apiKeys.length) % models.length;
            const model = models[modelIndex];

            try {
                console.log(`[AI-Service-Web] Buscando resultado en web con modelo '${model}' usando clave de índice ${currentKeyIndex}`);
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

                const response = await axios.post(url, {
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    tools: [
                        {
                            google_search: {}
                        }
                    ],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 1000
                    }
                }, {
                    timeout: 25000
                });

                if (response.status === 200 && response.data.candidates && response.data.candidates[0].content.parts[0].text) {
                    const resultText = response.data.candidates[0].content.parts[0].text.trim();
                    const cleanJsonText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
                    const jsonMatch = cleanJsonText.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const resultObj = JSON.parse(jsonMatch[0]);
                        return {
                            score: resultObj.score || 'N/D',
                            outcome: resultObj.outcome || 'RED',
                            explanation: resultObj.explanation || 'Evaluación completada por búsqueda web.'
                        };
                    }
                    throw new Error("No se pudo extraer un objeto JSON de la respuesta.");
                }
                throw new Error("La API no retornó una respuesta de texto válida.");
            } catch (error) {
                console.error(`[AI-Service-Web] Intento fallido con modelo '${model}' e índice de clave ${currentKeyIndex}: ${error.message}`);
                rotateApiKey();
                attempts++;
            }
        }

        throw new Error("Todas las claves API de Gemini fallaron para la búsqueda web.");
    } catch (error) {
        console.error(`[AI-Service-Web] Error en búsqueda web: ${error.message}`);
        return null;
    }
}

module.exports = {
    generatePrediction,
    generatePredictionDeepSeek,
    generateDailyParlay,
    evaluatePredictionOutcome,
    resolveVerdictViaWeb
};

