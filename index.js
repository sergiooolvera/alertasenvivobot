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

// Cola de alertas pendientes del sistema SafeOdds por cuota objetivo
const pendingAlertsQueue = [];

function getLiveOddForRecommendation(oddsArray, recommendation, homeTeam, awayTeam) {
    if (!oddsArray || !recommendation) return null;
    
    const recLower = recommendation.toLowerCase();
    
    // 1. Fulltime Result / Match Winner / 3-Way (ML)
    const isHomeWin = (recLower.includes('victoria') && recLower.includes(homeTeam.toLowerCase())) || 
                      recLower.includes(`${homeTeam.toLowerCase()} (resultado final)`) ||
                      recLower.includes(`${homeTeam.toLowerCase()} ml`) ||
                      (recLower.includes('victoria') && recLower.includes('local')) ||
                      recLower === homeTeam.toLowerCase();
                      
    const isAwayWin = (recLower.includes('victoria') && recLower.includes(awayTeam.toLowerCase())) || 
                      recLower.includes(`${awayTeam.toLowerCase()} (resultado final)`) ||
                      recLower.includes(`${awayTeam.toLowerCase()} ml`) ||
                      (recLower.includes('victoria') && recLower.includes('visita')) ||
                      recLower === awayTeam.toLowerCase();
                      
    const isDraw = recLower.includes('empate') && !recLower.includes('o empate') && !recLower.includes('draw or');

    if (isHomeWin || isAwayWin || isDraw) {
        const ftMarket = oddsArray.find(o => o.id === 59 || o.id === 1 || o.name.toLowerCase().includes('fulltime result') || o.name.toLowerCase().includes('match winner') || o.name.toLowerCase().includes('3-way result'));
        if (ftMarket) {
            const targetVal = isHomeWin ? 'Home' : (isAwayWin ? 'Away' : 'Draw');
            const oddObj = ftMarket.values.find(v => v.value === targetVal);
            if (oddObj && !oddObj.suspended) {
                return parseFloat(oddObj.odd);
            }
        }
    }

    // 2. Double Chance
    const isDoubleChance = recLower.includes('doble oportunidad') || recLower.includes('double chance') || recLower.includes('o empate') || recLower.includes('1x') || recLower.includes('x2') || recLower.includes('12');
    if (isDoubleChance) {
        const dcMarket = oddsArray.find(o => o.id === 72 || o.name.toLowerCase().includes('double chance'));
        if (dcMarket) {
            let targetVal = null;
            if (recLower.includes(homeTeam.toLowerCase()) && (recLower.includes('empate') || recLower.includes('draw') || recLower.includes('1x'))) {
                targetVal = 'Home or Draw';
            } else if (recLower.includes(awayTeam.toLowerCase()) && (recLower.includes('empate') || recLower.includes('draw') || recLower.includes('x2'))) {
                targetVal = 'Away or Draw';
            } else if (recLower.includes('home or away') || recLower.includes('12')) {
                targetVal = 'Home or Away';
            }
            
            if (targetVal) {
                const oddObj = dcMarket.values.find(v => v.value === targetVal);
                if (oddObj && !oddObj.suspended) {
                    return parseFloat(oddObj.odd);
                }
            }
        }
    }

    // 3. Over Goals
    const isOverGoals = recLower.includes('over') || recLower.includes('más de') || recLower.includes('mas de');
    if (isOverGoals) {
        const goalsMarket = oddsArray.find(o => o.id === 25 || o.id === 36 || o.name.toLowerCase().includes('goals') || o.name.toLowerCase().includes('over/under') || o.name.toLowerCase().includes('total goals'));
        if (goalsMarket) {
            const oddObj = goalsMarket.values.find(v => v.value === 'Over');
            if (oddObj && !oddObj.suspended) {
                return parseFloat(oddObj.odd);
            }
        }
    }

    return null;
}

async function processPendingAlerts(liveMatches, liveOddsMap) {
    if (pendingAlertsQueue.length === 0) return;
    
    console.log(`[SafeOdds] Procesando ${pendingAlertsQueue.length} alertas pendientes en cola...`);
    const activeLiveMatchesMap = new Map(liveMatches.map(m => [m.fixture.id, m]));
    
    for (let i = pendingAlertsQueue.length - 1; i >= 0; i--) {
        const alert = pendingAlertsQueue[i];
        const match = activeLiveMatchesMap.get(alert.fixtureId);
        
        // 1. Si el partido ya no está en vivo o ya finalizó, eliminar la alerta
        if (!match) {
            console.log(`[SafeOdds] Partido finalizado o no en vivo. Cancelando alerta pendiente para ${alert.homeTeam} vs ${alert.awayTeam}`);
            pendingAlertsQueue.splice(i, 1);
            continue;
        }
        
        const currentHomeGoals = match.goals.home || 0;
        const currentAwayGoals = match.goals.away || 0;
        
        // 2. Si el marcador cambió, la alerta ya no sirve, eliminar de la cola
        if (currentHomeGoals !== alert.scoreAtTime.home || currentAwayGoals !== alert.scoreAtTime.away) {
            console.log(`[SafeOdds] El marcador cambió (${alert.scoreAtTime.home}-${alert.scoreAtTime.away} -> ${currentHomeGoals}-${currentAwayGoals}). Cancelando alerta pendiente para ${alert.homeTeam} vs ${alert.awayTeam}`);
            pendingAlertsQueue.splice(i, 1);
            continue;
        }
        
        const elapsed = match.fixture.status.elapsed || 0;
        let oddTriggered = false;
        let currentOddValue = null;
        let method = '';
        
        // 3. Revisar si tenemos momios en vivo en la API para este partido
        const oddsArray = liveOddsMap.get(alert.fixtureId);
        if (oddsArray) {
            currentOddValue = getLiveOddForRecommendation(oddsArray, alert.aiRecommendation, alert.homeTeam, alert.awayTeam);
            if (currentOddValue !== null) {
                method = 'API en vivo';
                if (currentOddValue >= alert.targetOdd) {
                    oddTriggered = true;
                }
            }
        }
        
        // 4. Si no hay momios en vivo en la API, usar el estimador por tiempo transcurrido
        if (currentOddValue === null) {
            method = 'Estimador de tiempo';
            const elapsedMinutesSinceIncident = elapsed - alert.minuteAtIncident;
            if (elapsedMinutesSinceIncident >= alert.waitMinutes) {
                oddTriggered = true;
                currentOddValue = alert.targetOdd; // Valor estimado
            }
        }
        
        // 5. Si se activa el trigger, enviar la alerta
        if (oddTriggered) {
            console.log(`[SafeOdds] ¡Alerta ACTIVADA! ${alert.homeTeam} vs ${alert.awayTeam}. Momio: @${currentOddValue.toFixed(2)} (${method}) en el minuto ${elapsed}'`);
            
            let finalMsg = alert.textToSend;
            const activationNote = `\n\n📊 *ALERTA ACTIVADA EN VIVO:* El momio alcanzó la cuota objetivo de *@${alert.targetOdd.toFixed(2)}* (Momio actual: *@${currentOddValue.toFixed(2)}* en el minuto ${elapsed}', detectado vía ${method}).`;
            finalMsg += activationNote;
            
            for (const chatId of subscribedChats) {
                try {
                    await bot.sendMessage(chatId, finalMsg, { parse_mode: 'Markdown' });
                } catch (e) {
                    console.error(`Error enviando alerta fútbol en vivo activada al chat ${chatId}:`, e.message);
                }
            }
            
            // Encolar para parlays en vivo si tiene alta confianza
            await handleLiveParlayQueue(alert.fixtureId, 'football', alert.homeTeam, alert.awayTeam, finalMsg);
            
            pendingAlertsQueue.splice(i, 1);
        } else {
            console.log(`[SafeOdds] Esperando. ${alert.homeTeam} vs ${alert.awayTeam}. Momio objetivo: @${alert.targetOdd.toFixed(2)}, Momio en vivo/est: @${currentOddValue ? currentOddValue.toFixed(2) : 'N/D'} (${method}). Minuto actual: ${elapsed}' (espera est restante: ${alert.waitMinutes - (elapsed - alert.minuteAtIncident)}m)`);
        }
    }
}

// ===================================================
// MONITOREO DE FÚTBOL
// ===================================================
async function checkMatches() {
    console.log(`[${new Date().toLocaleTimeString()}] Revisando partidos de fútbol en vivo...`);
    const liveMatches = await getLiveMatches();
    
    // Obtener momios en vivo del endpoint consolidado
    const liveOddsMap = new Map();
    try {
        const liveOddsResponse = await apiClient.get('/odds/live');
        if (liveOddsResponse.data && liveOddsResponse.data.response) {
            liveOddsResponse.data.response.forEach(item => {
                if (item.fixture && item.fixture.id) {
                    liveOddsMap.set(item.fixture.id, item.odds);
                }
            });
        }
        console.log(`[SafeOdds] Descargados momios en vivo para ${liveOddsMap.size} partidos.`);
    } catch (err) {
        console.error(`[SafeOdds] Error al obtener momios en vivo de la API:`, err.message);
    }
    
    // Procesar la cola de alertas en espera
    await processPendingAlerts(liveMatches, liveOddsMap);

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
                        const header = splitIndex !== -1 ? alert.text.substring(0, splitIndex).trim() : alert.text;
                        
                        // Parsear y formatear la predicción de IA de forma premium
                        const analysisMatch = aiPrediction.match(/🧠 Análisis de IA:\s*([^\n]+)/i);
                        const oddMatch = aiPrediction.match(/📈 Momio Sugerido:\s*@?\s*([^\n]+)/i);
                        const confidenceMatch = aiPrediction.match(/🔥 Confianza Estimada:\s*(\d+)%/i);
                        
                        const analysis = analysisMatch ? analysisMatch[1].trim() : 'N/D';
                        const recommendation = recMatch ? recMatch[1].replace(/\*/g, '').trim() : 'N/D';
                        const oddVal = oddMatch ? oddMatch[1].replace(/\*/g, '').replace('@', '').trim() : '1.60';
                        const confidence = confidenceMatch ? confidenceMatch[1] : '80';
                        
                        const formattedAiSection = 
                            `🤖 *ANÁLISIS INTELIGENTE DE IA*\n` +
                            `🧠 ${analysis}\n\n` +
                            `🎯 *Recomendación:* *${recommendation}*\n` +
                            `📈 *Momio Sugerido:* *@${oddVal}*\n` +
                            `🔥 *Confianza Estimada:* *${confidence}%*`;
                            
                        textToSend = `${header}\n\n${formattedAiSection}`;

                        // --- INTEGRACIÓN DE SAFEODDS SYSTEM ---
                        const suggestedOddMatch = aiPrediction.match(/📈 Momio Sugerido:\s*@?\s*([0-9.]+)/i);
                        const suggestedOdd = suggestedOddMatch ? parseFloat(suggestedOddMatch[1]) : 1.60;
                        const targetOdd = Math.max(1.60, suggestedOdd);
                        
                        const currentHomeGoals = match.goals.home || 0;
                        const currentAwayGoals = match.goals.away || 0;
                        const elapsed = match.fixture.status.elapsed || 0;
                        
                        let liveOddVal = null;
                        const oddsArray = liveOddsMap.get(fixtureId);
                        if (oddsArray && alert.metadata.aiRecommendation) {
                            liveOddVal = getLiveOddForRecommendation(oddsArray, alert.metadata.aiRecommendation, match.teams.home.name, match.teams.away.name);
                        }
                        
                        if (liveOddVal === null || liveOddVal < targetOdd) {
                            // Estimar cuota de inicio
                            let estimatedStartOdd = 1.30;
                            const favOdd = matchOdds.home < matchOdds.away ? matchOdds.home : matchOdds.away;
                            
                            if (alert.metadata.ruleName.includes('TARJETA ROJA')) {
                                estimatedStartOdd = Math.max(1.05, favOdd * 0.95);
                            } else if (alert.metadata.ruleName.includes('EL FAVORITO SUFRE')) {
                                estimatedStartOdd = Math.max(1.10, favOdd * 1.4);
                            } else if (alert.metadata.ruleName.includes('SORPRESA TEMPRANERA')) {
                                estimatedStartOdd = Math.max(1.20, favOdd * 1.8);
                            } else if (alert.metadata.ruleName.includes('ASEDIO INTENSO')) {
                                estimatedStartOdd = 1.30;
                            }
                            
                            // Si la cuota de inicio estimada ya cumple la meta, enviar de inmediato
                            if (liveOddVal === null && estimatedStartOdd >= targetOdd) {
                                console.log(`[SafeOdds] Alerta enviada de inmediato (cuota de inicio estimada @${estimatedStartOdd.toFixed(2)} >= @${targetOdd.toFixed(2)}).`);
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
                            } else {
                                // Calcular minutos de espera
                                const timeRemaining = 90 - elapsed;
                                let waitMinutes = 0;
                                const startOdd = liveOddVal !== null ? liveOddVal : estimatedStartOdd;
                                if (startOdd < targetOdd && timeRemaining > 0) {
                                    const ratio = (startOdd - 1) / (targetOdd - 1);
                                    waitMinutes = timeRemaining * (1 - Math.pow(Math.max(0.01, ratio), 0.9));
                                    waitMinutes = Math.max(1, Math.min(timeRemaining, Math.round(waitMinutes)));
                                }
                                
                                console.log(`[SafeOdds] Encolando alerta pendiente para ${match.teams.home.name} vs ${match.teams.away.name}. Cuota inicial/en-vivo: @${startOdd.toFixed(2)}, Objetivo: @${targetOdd.toFixed(2)}, Espera: ${waitMinutes} min.`);
                                pendingAlertsQueue.push({
                                    id: `${fixtureId}_${alert.metadata.ruleName}`,
                                    fixtureId,
                                    sport: 'football',
                                    homeTeam: match.teams.home.name,
                                    awayTeam: match.teams.away.name,
                                    ruleName: alert.metadata.ruleName,
                                    textToSend,
                                    aiRecommendation: alert.metadata.aiRecommendation || '',
                                    suggestedOdd,
                                    targetOdd,
                                    scoreAtTime: { home: currentHomeGoals, away: currentAwayGoals },
                                    timestamp: Date.now(),
                                    minuteAtIncident: elapsed,
                                    estimatedStartOdd: startOdd,
                                    waitMinutes,
                                    sent: false
                                });
                            }
                        } else {
                            // Enviar de inmediato porque la cuota en vivo actual ya es mayor o igual a la objetivo
                            console.log(`[SafeOdds] Alerta enviada de inmediato (cuota en vivo @${liveOddVal.toFixed(2)} >= @${targetOdd.toFixed(2)}).`);
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
                } catch (aiError) {
                    console.error(`[index.js] Error al procesar IA para fútbol: ${aiError.message}`);
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
                        const header = splitIndex !== -1 ? alert.text.substring(0, splitIndex).trim() : alert.text;
                        
                        // Parsear y formatear la predicción de IA de forma premium
                        const analysisMatch = aiPrediction.match(/🧠 Análisis de IA:\s*([^\n]+)/i);
                        const oddMatch = aiPrediction.match(/📈 Momio Sugerido:\s*@?\s*([^\n]+)/i);
                        const confidenceMatch = aiPrediction.match(/🔥 Confianza Estimada:\s*(\d+)%/i);
                        
                        const analysis = analysisMatch ? analysisMatch[1].trim() : 'N/D';
                        const recommendation = recMatch ? recMatch[1].replace(/\*/g, '').trim() : 'N/D';
                        const oddVal = oddMatch ? oddMatch[1].replace(/\*/g, '').replace('@', '').trim() : '1.60';
                        const confidence = confidenceMatch ? confidenceMatch[1] : '80';
                        
                        const formattedAiSection = 
                            `🤖 *ANÁLISIS INTELIGENTE DE IA*\n` +
                            `🧠 ${analysis}\n\n` +
                            `🎯 *Recomendación:* *${recommendation}*\n` +
                            `📈 *Momio Sugerido:* *@${oddVal}*\n` +
                            `🔥 *Confianza Estimada:* *${confidence}%*`;
                            
                        textToSend = `${header}\n\n${formattedAiSection}`;
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
    const match = text.match(/🔥\s*\*?Confianza(?: Estimada)?\*?:\s*\*?(\d+)%/i);
    return match ? parseInt(match[1]) : 0;
}

async function handleLiveParlayQueue(fixtureId, sport, homeTeam, awayTeam, textToSend) {
    const confidence = extractConfidence(textToSend);
    if (confidence < 85) {
        return;
    }

    console.log(`[Parlay en Vivo] Alerta de alta confianza detectada para ${homeTeam} vs ${awayTeam} (${confidence}%). Agregando a la cola...`);

    const recMatch = textToSend.match(/🎯\s*\*?Recomendación(?:\s+Inteligente)?\*?:\s*\*?([^\n\*]+)/i);
    const oddMatch = textToSend.match(/📈\s*\*?Momio(?:\s+Sugerido)?\*?:\s*\*?@?\s*([^\n\*]+)/i);
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


