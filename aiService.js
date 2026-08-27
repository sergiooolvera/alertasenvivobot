const axios = require('axios');

const deepseekApiKey = process.env.DEEPSEEK_API_KEY || null;

/**
 * Realiza la llamada HTTP a la API de DeepSeek con fallback de modelos.
 */
async function callDeepSeekWithRotation(prompt, options = {}) {
    if (!deepseekApiKey) {
        throw new Error("No hay API Key de DeepSeek configurada en las variables de entorno (DEEPSEEK_API_KEY).");
    }

    const models = ['deepseek-reasoner', 'deepseek-chat', 'deepseek-v4-flash'];
    let attempts = 0;

    while (attempts < models.length) {
        const model = models[attempts];
        try {
            console.log(`[AI-Service] Intentando generar contenido con DeepSeek usando modelo '${model}'`);
            
            const payload = {
                model: model,
                messages: [
                    { role: 'user', content: prompt }
                ],
                max_tokens: options.max_tokens || 2000
            };

            // Los modelos reasoner (R1) no admiten parámetro de temperature en la API de DeepSeek
            if (model !== 'deepseek-reasoner') {
                payload.temperature = options.temperature !== undefined ? options.temperature : 0.7;
            }

            const response = await axios.post('https://api.deepseek.com/chat/completions', payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${deepseekApiKey}`
                },
                timeout: options.timeout || 60000
            });

            if (response.status === 200 && response.data.choices && response.data.choices[0].message && response.data.choices[0].message.content) {
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
        const prompt = buildFootballPromptDeepSeek(matchData);

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
 * Construye el prompt específico para DeepSeek (Fútbol) - Optimizado para brevedad y análisis técnico.
 */
function buildFootballPrompt(matchData) {
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
 * Genera el análisis y recomendación de IA usando DeepSeek.
 * Devuelve null si ocurre un fallo.
 */
async function generatePrediction(matchData, sport = 'football', outContext = null) {
    if (!deepseekApiKey) {
        console.warn("[AI-Service] No hay API key de DeepSeek configurada en .env.");
        return null;
    }

    try {
        const prompt = buildFootballPrompt(matchData);

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
 * Alias de compatibilidad para generatePrediction.
 */
async function generatePredictionDeepSeek(matchData, sport = 'football', outContext = null) {
    return generatePrediction(matchData, sport, outContext);
}

/**
 * Construye el prompt para el Parlay del Día pre-partido.
 */
function buildDailyParlayPrompt(matchesData) {
    const matchesStr = matchesData.map((m, idx) => {
        const type = '⚽ FÚTBOL';
        const oddsStr = `Local ${m.odds.home} | Empate ${m.odds.draw} | Visita ${m.odds.away}`;
        
        const lastHome = formatLastMatches(m.homeTeam, m.lastMatchesHome);
        const lastAway = formatLastMatches(m.awayTeam, m.lastMatchesAway);
        const lastMatchesStr = `\n${lastHome}\n${lastAway}`;
        
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
 * Genera el Parlay del Día usando DeepSeek a partir de una lista de partidos pre-partido.
 */
async function generateDailyParlay(matchesData) {
    if (!deepseekApiKey) {
        console.warn("[AI-Service] No hay API key de DeepSeek configurada en .env. No se puede generar parlay.");
        return null;
    }

    try {
        const prompt = buildDailyParlayPrompt(matchesData);
        const result = await callDeepSeekWithRotation(prompt, { max_tokens: 3000 });
        return result;
    } catch (error) {
        console.error(`[AI-Service] Error crítico generando parlay con DeepSeek: ${error.message}`);
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
 * Evalúa si una recomendación de la IA resultó en GREEN o RED según el resultado final del encuentro con DeepSeek.
 */
async function evaluatePredictionOutcome(sport, aiRecommendation, finalData) {
    if (!deepseekApiKey) {
        console.warn("[AI-Service] No hay API key de DeepSeek configurada para evaluar. Se usará fallback estático.");
        return null;
    }

    try {
        const formattedData = formatFootballFinalData(finalData);

        const prompt = `Actúa como un validador oficial y objetivo de apuestas deportivas en español.
Determina si la siguiente recomendación de apuesta resultó ganadora (GREEN), perdedora (RED) o nula/reembolsada (VOID) basándote en los datos finales del partido.

Deporte: Fútbol
Recomendación de apuesta realizada: "${aiRecommendation}"

Datos finales del partido:
${formattedData}

Instrucciones obligatorias:
1. Responde ÚNICAMENTE en formato JSON válido con la siguiente estructura exacta:
{
  "outcome": "GREEN", "RED" o "VOID",
  "explanation": "Una breve explicación de una sola frase (en español) de por qué la recomendación se ganó, se perdió o se anuló basándote en el marcador o eventos finales."
}
2. No incluyas nada más en tu respuesta. No uses bloques de código con markdown (como \`\`\`json). Solo el texto plano del objeto JSON.`;

        console.log(`[AI-Service] Evaluando veredicto con DeepSeek para: "${aiRecommendation}"`);
        const resultText = await callDeepSeekWithRotation(prompt, { max_tokens: 500, temperature: 0.1 });
        if (resultText) {
            const cleanJsonText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
            const jsonMatch = cleanJsonText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const resultObj = JSON.parse(jsonMatch[0]);
                return {
                    outcome: resultObj.outcome,
                    isGreen: resultObj.outcome === 'GREEN',
                    isVoid: resultObj.outcome === 'VOID',
                    explanation: resultObj.explanation || 'Evaluación completada por DeepSeek.'
                };
            }
        }
        return null;
    } catch (error) {
        console.error(`[AI-Service] Error evaluando el resultado con DeepSeek: ${error.message}`);
        return null;
    }
}

/**
 * Resuelve el veredicto de una recomendación a partir de los datos disponibles del partido usando DeepSeek.
 */
async function resolveVerdictViaWeb(sport, homeTeam, awayTeam, date, aiRecommendation) {
    if (!deepseekApiKey) {
        console.warn("[AI-Service] No hay API key de DeepSeek configurada.");
        return null;
    }

    try {
        const prompt = `Actúa como un validador oficial y objetivo de apuestas deportivas en español.
Analiza la recomendación de apuesta "${aiRecommendation}" para el partido de Fútbol jugado el ${date} entre ${homeTeam} y ${awayTeam}.
Determina si la recomendación resultó ganadora (GREEN), perdedora (RED), o cancelada/nula (CANCELLED/VOID).

Instrucciones obligatorias:
1. Responde ÚNICAMENTE en formato JSON válido con la siguiente estructura exacta:
{
  "score": "Marcador o estado (ej. 2-1)",
  "outcome": "GREEN" | "RED" | "CANCELLED",
  "explanation": "Una breve explicación de por qué la recomendación fue GREEN, RED o CANCELLED."
}
2. No incluyas nada más en tu respuesta. Solo el texto plano del objeto JSON.`;

        const resultText = await callDeepSeekWithRotation(prompt, { max_tokens: 500, temperature: 0.1 });
        if (resultText) {
            const cleanJsonText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
            const jsonMatch = cleanJsonText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const resultObj = JSON.parse(jsonMatch[0]);
                return {
                    score: resultObj.score || 'N/D',
                    outcome: resultObj.outcome || 'RED',
                    isGreen: resultObj.outcome === 'GREEN',
                    isVoid: resultObj.outcome === 'CANCELLED' || resultObj.outcome === 'VOID',
                    explanation: resultObj.explanation || 'Evaluación completada por DeepSeek.'
                };
            }
        }
        return null;
    } catch (error) {
        console.error(`[AI-Service] Error resolviendo veredicto con DeepSeek: ${error.message}`);
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

