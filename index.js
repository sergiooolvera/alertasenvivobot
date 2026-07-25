require('dotenv').config();
const botModule = require('node-telegram-bot-api');
const TelegramBot = botModule.default || botModule;
const cron = require('node-cron');
const packageJson = require('./package.json');
const VERSION = packageJson.version;

// Módulos de Fútbol
const { getLiveMatches, getMatchEvents, getPreMatchOdds, getMatchStatistics, getMatchesByDate, getMatchById, getTeamLastMatches } = require('./apiClient');
const { evaluateRules, needsStats, needsEvents, evaluateAlertResults } = require('./rulesEngine');
const { isMajorLeague, isWithinActiveHours, TIMEZONE } = require('./config');

// Módulos de Béisbol (MLB)
const { getLiveBaseballGames, getPreGameBaseballOdds, getBaseballGameById } = require('./baseballApiClient');
const { evaluateBaseballRules, evaluateBaseballAlertResults } = require('./baseballRulesEngine');

// Servicio de IA
const aiService = require('./aiService');

const token = process.env.TELEGRAM_BOT_TOKEN;
let bot;

// Inicialización del bot (o fallback a consola si no hay token)
if (token && token !== 'tu_token_aqui') {
    bot = new TelegramBot(token, { polling: true });
    console.log("✅ Bot de Telegram conectado exitosamente.");
} else {
    console.warn("⚠️ TELEGRAM_BOT_TOKEN no configurado en .env. Las alertas se mostrarán en la consola.");
    bot = {
        sendMessage: (chatId, text, options) => console.log(`\n🔔 [ALERTA TELEGRAM para ${chatId}]:\n${text}\n`)
    };
}

// Almacenamos los chats suscritos
const subscribedChats = new Set();

if (bot.onText) {
    const MI_CHAT_ID = 890184744; // Tu ID exclusivo

    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        
        if (chatId !== MI_CHAT_ID) {
            console.log(`Intento de acceso bloqueado del ID: ${chatId}`);
            bot.sendMessage(chatId, "⛔ Acceso denegado. Este es un bot privado de uso exclusivo.");
            return;
        }

        subscribedChats.add(chatId);
        bot.sendMessage(chatId, `⚽⚾ ¡Bienvenido jefe! Bot Multideporte (Fútbol + MLB) iniciado.\n*Versión:* v${VERSION} (Soporte de Parlays Pre-Partido y En Vivo 🚀)\n\nMonitoreando 7 Reglas de Fútbol y 3 Reglas de MLB con Verificación GREEN/RED.`, { parse_mode: 'Markdown' });
        console.log(`Usuario principal conectado: ${chatId}`);
    });
} else {
    subscribedChats.add("console_user");
}

// Cachés de momios pre-partido
const oddsCache = new Map();
const baseballOddsCache = new Map();

// Seguimiento Post-Partido GREEN / RED
const trackedMatches = new Map();
const trackedBaseballGames = new Map();

// Cachés para almacenar el último resultado de eventos y estadísticas por partido
const eventsCache = new Map();
const statsCache = new Map();

// Tiempos de la última petición exitosa a la API
const lastEventsFetchTime = new Map();
const lastStatsFetchTime = new Map();

const THROTTLE_COOLDOWN_MS = 4 * 60 * 1000; // 4 minutos de cooldown

// Set de partidos/juegos actualmente en vivo para evitar polling a partidos en progreso
let currentLiveFootballIds = new Set();
let currentLiveBaseballIds = new Set();

// ===================================================
// MONITOREO DE FÚTBOL
// ===================================================
async function checkMatches() {
    console.log(`[${new Date().toLocaleTimeString()}] Revisando partidos de fútbol en vivo...`);
    const liveMatches = await getLiveMatches();

    const newLiveIds = new Set();

    for (const match of liveMatches) {
        const fixtureId = match.fixture.id;
        newLiveIds.add(fixtureId);

        const leagueName = match.league && match.league.name ? match.league.name.toLowerCase() : '';
        if (leagueName.includes('friendl') || leagueName.includes('amistoso')) {
            continue;
        }

        const isTop = isMajorLeague(match.league);
        
        if (!oddsCache.has(fixtureId)) {
            await new Promise(r => setTimeout(r, 100));
            const odds = await getPreMatchOdds(fixtureId);
            oddsCache.set(fixtureId, odds || 'NO_ODDS');
        }

        const matchOdds = oddsCache.get(fixtureId);
        if (!matchOdds || matchOdds === 'NO_ODDS') {
            continue; // Si no hay momios disponibles, no podemos calcular las reglas
        }

        let events = [];
        if (needsEvents(match, matchOdds, isTop)) {
            const now = Date.now();
            const lastFetch = lastEventsFetchTime.get(fixtureId) || 0;
            if (now - lastFetch >= THROTTLE_COOLDOWN_MS || !eventsCache.has(fixtureId)) {
                console.log(`[API-Sports] Consultando eventos en vivo para ${match.teams.home.name} vs ${match.teams.away.name} (fixture: ${fixtureId})`);
                events = await getMatchEvents(fixtureId);
                eventsCache.set(fixtureId, events);
                lastEventsFetchTime.set(fixtureId, now);
            } else {
                events = eventsCache.get(fixtureId) || [];
            }
        }

        let stats = [];
        if (needsStats(match, matchOdds, isTop)) {
            const now = Date.now();
            const lastFetch = lastStatsFetchTime.get(fixtureId) || 0;
            if (now - lastFetch >= THROTTLE_COOLDOWN_MS || !statsCache.has(fixtureId)) {
                console.log(`[API-Sports] Consultando estadísticas en vivo para ${match.teams.home.name} vs ${match.teams.away.name} (fixture: ${fixtureId})`);
                stats = await getMatchStatistics(fixtureId);
                statsCache.set(fixtureId, stats);
                lastStatsFetchTime.set(fixtureId, now);
            } else {
                stats = statsCache.get(fixtureId) || [];
            }
        }

        const alerts = evaluateRules(match, matchOdds, events, stats, isTop);

        if (alerts.length > 0) {
            // Carga dinámica on-demand para alimentar a la IA con el contexto completo
            if (stats.length === 0) {
                console.log(`[index.js] Alerta de fútbol detectada para ${match.teams.home.name} vs ${match.teams.away.name}. Consultando estadísticas para la IA...`);
                stats = await getMatchStatistics(fixtureId);
            }
            if (events.length === 0) {
                console.log(`[index.js] Alerta de fútbol detectada para ${match.teams.home.name} vs ${match.teams.away.name}. Consultando eventos para la IA...`);
                events = await getMatchEvents(fixtureId);
            }

            if (!trackedMatches.has(fixtureId)) {
                trackedMatches.set(fixtureId, {
                    home: match.teams.home.name,
                    away: match.teams.away.name,
                    alertsMetadata: []
                });
            }

            const trackedInfo = trackedMatches.get(fixtureId);

            // Obtener los últimos 5 partidos de cada equipo
            const homeTeamId = match.teams.home.id;
            const awayTeamId = match.teams.away.id;
            console.log(`[index.js] Consultando últimos 5 partidos de ${match.teams.home.name} (ID: ${homeTeamId}) y ${match.teams.away.name} (ID: ${awayTeamId}) para la IA...`);
            const lastMatchesHome = await getTeamLastMatches(homeTeamId, 5);
            await new Promise(r => setTimeout(r, 100)); // Delay para respetar rate limit
            const lastMatchesAway = await getTeamLastMatches(awayTeamId, 5);

            for (const alert of alerts) {
                trackedInfo.alertsMetadata.push(alert.metadata);

                let textToSend = alert.text;
                try {
                    const ruleThirdPart = alert.text.split('\n\n').slice(2).join('\n\n');
                    const targetIdx = ruleThirdPart.indexOf('🎯');
                    const cleanRuleDetails = targetIdx !== -1 ? ruleThirdPart.substring(0, targetIdx).trim() : ruleThirdPart;

                    const matchData = {
                        homeTeam: match.teams.home.name,
                        awayTeam: match.teams.away.name,
                        elapsed: match.fixture.status.elapsed,
                        score: { home: match.goals.home || 0, away: match.goals.away || 0 },
                        odds: matchOdds,
                        ruleName: alert.metadata.ruleName,
                        ruleDetails: cleanRuleDetails,
                        stats: stats,
                        events: events,
                        lastMatchesHome: lastMatchesHome,
                        lastMatchesAway: lastMatchesAway
                    };
                    console.log(`[index.js] Solicitando predicción de IA para partido: ${matchData.homeTeam} vs ${matchData.awayTeam}`);
                    const aiPrediction = await aiService.generatePrediction(matchData, 'football');
                    if (aiPrediction) {
                        const recMatch = aiPrediction.match(/🎯 Recomendación Inteligente:\s*([^\n]+)/i);
                        if (recMatch) {
                            alert.metadata.aiRecommendation = recMatch[1].replace(/\*/g, '').trim();
                        }
                        // Buscamos el primer emoji 🎯 que divide la alerta de las recomendaciones estáticas
                        const splitIndex = alert.text.indexOf('🎯');
                        if (splitIndex !== -1) {
                            const header = alert.text.substring(0, splitIndex).trim();
                            textToSend = `${header}\n\n${aiPrediction}`;
                        } else {
                            textToSend = `${alert.text}\n\n${aiPrediction}`;
                        }
                    }
                } catch (aiError) {
                    console.error(`[index.js] Error al procesar IA para fútbol: ${aiError.message}`);
                }

                for (const chatId of subscribedChats) {
                    try {
                        await bot.sendMessage(chatId, textToSend, { parse_mode: 'Markdown' });
                    } catch (e) {
                        console.error(`Error enviando alerta fútbol al chat ${chatId}:`, e.message);
                    }
                }

                if (textToSend) {
                    await handleLiveParlayQueue(fixtureId, 'football', match.teams.home.name, match.teams.away.name, textToSend);
                }
            }
        }
    }

    // Limpieza de cachés para partidos que ya no están en vivo
    for (const cachedFixtureId of lastEventsFetchTime.keys()) {
        if (!newLiveIds.has(cachedFixtureId)) {
            lastEventsFetchTime.delete(cachedFixtureId);
            eventsCache.delete(cachedFixtureId);
        }
    }
    for (const cachedFixtureId of lastStatsFetchTime.keys()) {
        if (!newLiveIds.has(cachedFixtureId)) {
            lastStatsFetchTime.delete(cachedFixtureId);
            statsCache.delete(cachedFixtureId);
        }
    }

    currentLiveFootballIds = newLiveIds;
}

async function checkFinishedMatches() {
    for (const [fixtureId, matchInfo] of trackedMatches.entries()) {
        // Solo consultar detalles por ID si el partido ya NO aparece en la lista de partidos en vivo
        if (currentLiveFootballIds.has(fixtureId)) {
            continue;
        }

        const matchData = await getMatchById(fixtureId);
        if (matchData && (matchData.fixture.status.short === 'FT' || matchData.fixture.status.short === 'AET' || matchData.fixture.status.short === 'PEN')) {
            const finalEvents = await getMatchEvents(fixtureId);
            const finalStats = await getMatchStatistics(fixtureId);

            const results = await evaluateAlertResults(matchInfo.alertsMetadata, matchData, finalEvents, finalStats);

            for (const result of results) {
                for (const chatId of subscribedChats) {
                    try {
                        await bot.sendMessage(chatId, result.msg, { parse_mode: 'Markdown' });
                    } catch (e) {
                        console.error(`Error enviando veredicto fútbol al chat ${chatId}:`, e.message);
                    }
                }
            }
            trackedMatches.delete(fixtureId);
        }
    }
}

// ===================================================
// MONITOREO DE BÉISBOL (MLB)
// ===================================================
async function checkBaseballMatches() {
    console.log(`[${new Date().toLocaleTimeString()}] Revisando juegos de MLB en vivo...`);
    const liveGames = await getLiveBaseballGames();

    const newLiveBaseballIds = new Set();

    for (const game of liveGames) {
        const gameId = game.game.id;
        newLiveBaseballIds.add(gameId);

        if (!baseballOddsCache.has(gameId)) {
            await new Promise(r => setTimeout(r, 100));
            const odds = await getPreGameBaseballOdds(gameId);
            baseballOddsCache.set(gameId, odds || 'NO_ODDS');
        }

        const gameOdds = baseballOddsCache.get(gameId);
        if (!gameOdds || gameOdds === 'NO_ODDS') {
            continue;
        }

        const alerts = evaluateBaseballRules(game, gameOdds);

        if (alerts.length > 0) {
            if (!trackedBaseballGames.has(gameId)) {
                trackedBaseballGames.set(gameId, {
                    home: game.teams.home.name,
                    away: game.teams.away.name,
                    alertsMetadata: []
                });
            }

            const trackedInfo = trackedBaseballGames.get(gameId);

            for (const alert of alerts) {
                trackedInfo.alertsMetadata.push(alert.metadata);

                let textToSend = alert.text;
                try {
                    const ruleThirdPart = alert.text.split('\n\n').slice(2).join('\n\n');
                    const targetIdx = ruleThirdPart.indexOf('🎯');
                    const cleanRuleDetails = targetIdx !== -1 ? ruleThirdPart.substring(0, targetIdx).trim() : ruleThirdPart;

                    const matchData = {
                        homeTeam: game.teams.home.name,
                        awayTeam: game.teams.away.name,
                        inning: game.status.elapsed ? `Inning ${game.status.elapsed}` : 'N/A',
                        score: { home: game.scores.home.total || 0, away: game.scores.away.total || 0 },
                        odds: gameOdds,
                        ruleName: alert.metadata.ruleName,
                        ruleDetails: cleanRuleDetails,
                        stats: game.scores
                    };
                    console.log(`[index.js] Solicitando predicción de IA para MLB: ${matchData.homeTeam} vs ${matchData.awayTeam}`);
                    const aiPrediction = await aiService.generatePrediction(matchData, 'baseball');
                    if (aiPrediction) {
                        const recMatch = aiPrediction.match(/🎯 Recomendación Inteligente:\s*([^\n]+)/i);
                        if (recMatch) {
                            alert.metadata.aiRecommendation = recMatch[1].replace(/\*/g, '').trim();
                        }
                        // Buscamos el primer emoji 🎯 que divide la alerta de las recomendaciones estáticas
                        const splitIndex = alert.text.indexOf('🎯');
                        if (splitIndex !== -1) {
                            const header = alert.text.substring(0, splitIndex).trim();
                            textToSend = `${header}\n\n${aiPrediction}`;
                        } else {
                            textToSend = `${alert.text}\n\n${aiPrediction}`;
                        }
                    }
                } catch (aiError) {
                    console.error(`[index.js] Error al procesar IA para béisbol: ${aiError.message}`);
                }

                for (const chatId of subscribedChats) {
                    try {
                        await bot.sendMessage(chatId, textToSend, { parse_mode: 'Markdown' });
                    } catch (e) {
                        console.error(`Error enviando alerta béisbol al chat ${chatId}:`, e.message);
                    }
                }

                if (textToSend) {
                    await handleLiveParlayQueue(gameId, 'baseball', game.teams.home.name, game.teams.away.name, textToSend);
                }
            }
        }
    }

    currentLiveBaseballIds = newLiveBaseballIds;
}

async function checkFinishedBaseballMatches() {
    for (const [gameId, gameInfo] of trackedBaseballGames.entries()) {
        // Solo consultar si el juego ya no está en vivo
        if (currentLiveBaseballIds.has(gameId)) {
            continue;
        }

        const gameData = await getBaseballGameById(gameId);
        if (gameData && (gameData.status.short === 'FT' || gameData.status.short === 'POST' || gameData.status.short === 'FINISHED')) {
            const results = await evaluateBaseballAlertResults(gameInfo.alertsMetadata, gameData);

            for (const result of results) {
                for (const chatId of subscribedChats) {
                    try {
                        await bot.sendMessage(chatId, result.msg, { parse_mode: 'Markdown' });
                    } catch (e) {
                        console.error(`Error enviando veredicto béisbol al chat ${chatId}:`, e.message);
                    }
                }
            }
            trackedBaseballGames.delete(gameId);
        }
    }
}

// ===================================================
// SISTEMA DE PARLAYS DEL DÍA Y EN VIVO (IA)
// ===================================================
const liveAlertsQueue = [];
const LIVE_ALERT_EXPIRATION_MS = 40 * 60 * 1000; // 40 minutos

function extractConfidence(text) {
    if (!text) return 0;
    const match = text.match(/🔥 Confianza Estimada:\s*(\d+)%/i);
    return match ? parseInt(match[1]) : 0;
}

async function handleLiveParlayQueue(fixtureId, sport, homeTeam, awayTeam, textToSend) {
    const confidence = extractConfidence(textToSend);
    if (confidence < 85) {
        return;
    }

    console.log(`[Parlay en Vivo] Alerta de alta confianza detectada para ${homeTeam} vs ${awayTeam} (${confidence}%). Agregando a la cola...`);

    const recMatch = textToSend.match(/🎯 Recomendación Inteligente:\s*([^\n]+)/i);
    const oddMatch = textToSend.match(/📈 Momio Sugerido:\s*@?\s*([^\n]+)/i);
    const recommendation = recMatch ? recMatch[1].replace(/\*/g, '').trim() : 'N/A';
    const odd = oddMatch ? oddMatch[1].replace(/\*/g, '').trim() : '1.60';

    const now = Date.now();
    let activeAlerts = liveAlertsQueue.filter(a => (now - a.timestamp) < LIVE_ALERT_EXPIRATION_MS);
    activeAlerts = activeAlerts.filter(a => a.fixtureId !== fixtureId);

    activeAlerts.push({
        fixtureId,
        sport,
        homeTeam,
        awayTeam,
        recommendation,
        odd,
        confidence,
        timestamp: now
    });

    liveAlertsQueue.length = 0;
    liveAlertsQueue.push(...activeAlerts);

    if (liveAlertsQueue.length >= 2) {
        console.log(`[Parlay en Vivo] Generando Parlay en Vivo con ${liveAlertsQueue.length} selecciones.`);
        const selections = [];
        let combinedOdd = 1.0;
        let combinedConfidence = 1.0;

        liveAlertsQueue.forEach((alert, idx) => {
            const cleanOddVal = parseFloat(alert.odd.replace('@', '').trim()) || 1.60;
            combinedOdd *= cleanOddVal;
            combinedConfidence *= (alert.confidence / 100);

            const sportIcon = alert.sport === 'baseball' ? '⚾' : '⚽';
            selections.push(`${idx + 1}. ${sportIcon} *${alert.homeTeam} vs ${alert.awayTeam}* -> Pronóstico: *${alert.recommendation}* (Momio: @${cleanOddVal.toFixed(2)})`);
        });

        const finalConfidence = Math.round(combinedConfidence * 100);

        const msg = `🔥 *PARLAY EN VIVO DETECTADO (ALTA CONFIANZA)* 🔥\n\n` +
            `Se han identificado múltiples oportunidades en vivo con alta probabilidad de éxito de forma simultánea:\n\n` +
            `📊 *SELECCIONES:*\n${selections.join('\n')}\n\n` +
            `📈 *MOMIO TOTAL SUGERIDO:* @${combinedOdd.toFixed(2)}\n` +
            `🔥 *CONFIANZA COMBINADA:* ${finalConfidence}%\n\n` +
            `⚠️ *Nota:* Se recomienda ingresar esta apuesta a la brevedad, ya que las cuotas en vivo varían rápidamente.`;

        for (const chatId of subscribedChats) {
            try {
                await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
            } catch (e) {
                console.error(`Error enviando parlay en vivo al chat ${chatId}:`, e.message);
            }
        }

        liveAlertsQueue.length = 0;
    }
}

async function generateAndSendDailyParlay(timeString) {
    console.log(`[${new Date().toLocaleTimeString()}] Ejecutando Parlay del Día (${timeString})...`);
    
    try {
        const today = new Date().toISOString().split('T')[0];
        const matches = await getMatchesByDate(today);
        
        if (!matches || matches.length === 0) {
            console.log(`[Parlay ${timeString}] No se encontraron partidos para hoy.`);
            return;
        }

        const futureMatches = matches.filter(m => {
            const isTop = isMajorLeague(m.league);
            const isNotStarted = m.fixture.status.short === 'NS';
            return isTop && isNotStarted;
        });

        if (futureMatches.length < 2) {
            console.log(`[Parlay ${timeString}] No hay suficientes partidos futuros en ligas principales para armar un parlay (Mínimo 2, encontrados: ${futureMatches.length}).`);
            return;
        }

        console.log(`[Parlay ${timeString}] Encontrados ${futureMatches.length} partidos futuros. Procesando momios y estadísticas...`);

        const eligibleMatches = [];
        const maxToProcess = futureMatches.slice(0, 15);

        for (const match of maxToProcess) {
            const fixtureId = match.fixture.id;
            
            await new Promise(r => setTimeout(r, 200));
            const odds = await getPreMatchOdds(fixtureId);
            if (!odds) continue;

            await new Promise(r => setTimeout(r, 200));
            const lastMatchesHome = await getTeamLastMatches(match.teams.home.id, 5);

            await new Promise(r => setTimeout(r, 200));
            const lastMatchesAway = await getTeamLastMatches(match.teams.away.id, 5);

            eligibleMatches.push({
                sport: 'football',
                fixtureId,
                homeTeam: match.teams.home.name,
                awayTeam: match.teams.away.name,
                leagueName: match.league.name,
                odds,
                lastMatchesHome,
                lastMatchesAway
            });

            if (eligibleMatches.length >= 8) {
                break;
            }
        }

        if (eligibleMatches.length < 2) {
            console.log(`[Parlay ${timeString}] No se pudieron consolidar al menos 2 partidos con momios e historial completo.`);
            return;
        }

        console.log(`[Parlay ${timeString}] Enviando ${eligibleMatches.length} partidos elegibles a Gemini para armar el Parlay...`);
        const parlayMsg = await aiService.generateDailyParlay(eligibleMatches);

        if (parlayMsg) {
            for (const chatId of subscribedChats) {
                try {
                    await bot.sendMessage(chatId, parlayMsg, { parse_mode: 'Markdown' });
                } catch (e) {
                    console.error(`Error enviando Parlay ${timeString} al chat ${chatId}:`, e.message);
                }
            }
            console.log(`[Parlay ${timeString}] ¡Parlay del Día enviado exitosamente!`);
        } else {
            console.warn(`[Parlay ${timeString}] La IA no pudo generar el mensaje del parlay.`);
        }
    } catch (error) {
        console.error(`Error crítico en generateAndSendDailyParlay (${timeString}):`, error.message);
    }
}

// Programar Parlay Pre-Partido a las 8:30 AM, 9:30 AM y 10:30 AM (Hora Centro México)
cron.schedule('30 8 * * *', async () => {
    if (isWithinActiveHours()) {
        await generateAndSendDailyParlay('8:30 AM');
    }
}, {
    timezone: TIMEZONE
});

cron.schedule('30 9 * * *', async () => {
    if (isWithinActiveHours()) {
        await generateAndSendDailyParlay('9:30 AM');
    }
}, {
    timezone: TIMEZONE
});

cron.schedule('30 10 * * *', async () => {
    if (isWithinActiveHours()) {
        await generateAndSendDailyParlay('10:30 AM');
    }
}, {
    timezone: TIMEZONE
});

// Programar revisión cada minuto para ambos deportes (solo en horario 7:00 AM a 9:00 PM CST/CDT)
cron.schedule('* 7-21 * * *', async () => {
    if (!isWithinActiveHours()) {
        return;
    }
    await checkMatches();
    await checkFinishedMatches();
    await checkBaseballMatches();
    await checkFinishedBaseballMatches();
}, {
    timezone: TIMEZONE
});

// Resumen Matutino todos los días a las 7:30 AM (Hora Centro México)
cron.schedule('30 7 * * *', async () => {
    console.log("Ejecutando Resumen Matutino de Ligas Principales...");
    const today = new Date().toISOString().split('T')[0];
    const matches = await getMatchesByDate(today);
    
    const topMatches = matches.filter(m => isMajorLeague(m.league)).slice(0, 20); 
    const topFavorites = [];

    for (const match of topMatches) {
        const fixtureId = match.fixture.id;
        await new Promise(r => setTimeout(r, 100));
        const odds = await getPreMatchOdds(fixtureId);
        if (odds) {
            const homeOdd = odds.home;
            const awayOdd = odds.away;
            const favOdd = homeOdd < awayOdd ? homeOdd : awayOdd;
            const favTeam = homeOdd < awayOdd ? match.teams.home.name : match.teams.away.name;
            const underdogTeam = homeOdd < awayOdd ? match.teams.away.name : match.teams.home.name;
            
            if (favOdd < 1.35) {
                topFavorites.push(`- 🏆 *${match.league.name}*: ${favTeam} (${favOdd}) vs ${underdogTeam}`);
            }
        }
    }

    if (topFavorites.length > 0) {
        const msg = `☀️ *Resumen Matutino (Fútbol & Ligas Principales)*\nFavoritos claros del día (Momio < 1.35):\n\n${topFavorites.join('\n')}`;
        for (const chatId of subscribedChats) {
            bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' }).catch(e => console.error(e));
        }
    }
}, {
    timezone: TIMEZONE
});

console.log(`🟢 Sistema Multideporte automatizado (Fútbol + MLB Béisbol) en marcha. Horario activo: 7:00 AM - 9:00 PM (${TIMEZONE}).`);
// Ejecutar primera revisión únicamente si estamos dentro del horario activo
if (isWithinActiveHours()) {
    checkMatches();
    checkBaseballMatches();
} else {
    console.log(`⏰ Script iniciado fuera del horario de monitoreo (7 AM - 9 PM ${TIMEZONE}). En espera de la ventana activa...`);
}


