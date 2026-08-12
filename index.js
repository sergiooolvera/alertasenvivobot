require('dotenv').config();
const botModule = require('node-telegram-bot-api');
const TelegramBot = botModule.default || botModule;
const cron = require('node-cron');
const packageJson = require('./package.json');
const VERSION = packageJson.version;
const financialTracker = require('./financialTracker');


// Módulos de Fútbol
const { getLiveMatches, getMatchEvents, getPreMatchOdds, getMatchStatistics, getMatchesByDate, getMatchById, getTeamLastMatches, getLiveOdds, getHeadToHead } = require('./apiClient');
const { evaluateRules, needsStats, needsEvents, evaluateAlertResults } = require('./rulesEngine');
const { isMajorLeague, isWithinActiveHours, TIMEZONE } = require('./config');

// Módulos de Béisbol (MLB) - Deshabilitados para canal separado
// const { getLiveBaseballGames, getPreGameBaseballOdds, getBaseballGameById } = require('./baseballApiClient');
// const { evaluateBaseballRules, evaluateBaseballAlertResults } = require('./baseballRulesEngine');

// Servicio de IA
const aiService = require('./aiService');

const token = process.env.TELEGRAM_BOT_TOKEN;
let bot;

// Inicialización del bot (o fallback a consola si no hay token)
if (token && token !== 'tu_token_aqui') {
    bot = new TelegramBot(token, { polling: true });
    console.log("✅ Bot de Telegram conectado exitosamente.");
    bot.getMe().then(me => {
        console.log(`[Telegram] Bot conectado en producción: @${me.username} (${me.first_name})`);
    }).catch(err => console.error(`[Telegram] Error al obtener info del bot:`, err.message));
} else {
    console.warn("⚠️ TELEGRAM_BOT_TOKEN no configurado en .env. Las alertas se mostrarán en la consola.");
    bot = {
        sendMessage: (chatId, text, options) => console.log(`\n🔔 [ALERTA TELEGRAM para ${chatId}]:\n${text}\n`),
        sendDocument: (chatId, doc, options, fileOptions) => {
            console.log(`\n📄 [DOCUMENTO TELEGRAM para ${chatId}]: ${fileOptions.filename}`);
            console.log(`[Contenido Documento]:\n${doc.toString('utf-8').substring(0, 300)}...\n[Fin de vista previa de documento]\n`);
            return Promise.resolve();
        }
    };
}

// Validación e información del canal/chat de auditoría de prompts
if (process.env.TELEGRAM_PROMPTS_CHAT_ID) {
    const promptChatId = process.env.TELEGRAM_PROMPTS_CHAT_ID;
    console.log(`[Config] 📂 Auditoría de prompts ACTIVA. Canal/Chat destino: ${promptChatId}`);
    if (promptChatId.startsWith('-') && !promptChatId.startsWith('-100')) {
        console.warn(`[Config Warning] El ID del chat de prompts (${promptChatId}) parece un canal de Telegram pero no inicia con '-100'. Esto suele causar errores de envío.`);
    }
} else {
    console.warn(`[Config Warning] 📂 Auditoría de prompts DESACTIVADA. La variable de entorno TELEGRAM_PROMPTS_CHAT_ID no está configurada.`);
}

// Función auxiliar para enviar mensajes con formato Markdown de forma segura y con fallback a texto plano en caso de error de parseo
async function sendSafeMarkdownMessage(chatId, text, options = {}) {
    try {
        const sendOptions = { parse_mode: 'Markdown', ...options };
        return await bot.sendMessage(chatId, text, sendOptions);
    } catch (error) {
        console.error(`[Telegram] Error al enviar mensaje con Markdown al chat ${chatId}:`, error.message);
        if (error.message.includes('parse') || error.message.includes('Markdown')) {
            console.log(`[Telegram] Reintentando envío en texto plano al chat ${chatId} debido a fallo de parsing.`);
            try {
                const plainOptions = { ...options };
                delete plainOptions.parse_mode;
                return await bot.sendMessage(chatId, text, plainOptions);
            } catch (fallbackError) {
                console.error(`[Telegram] Error fatal en envío de fallback al chat ${chatId}:`, fallbackError.message);
                throw fallbackError;
            }
        }
        throw error;
    }
}

// Función auxiliar para registrar logs de SafeOdds en el canal de prompts/auditoría
function logSafeOddsEvent(message) {
    if (process.env.TELEGRAM_PROMPTS_CHAT_ID) {
        bot.sendMessage(process.env.TELEGRAM_PROMPTS_CHAT_ID, message, { parse_mode: 'Markdown' })
            .catch(err => console.error(`[SafeOdds Log] Error al enviar log a Telegram:`, err.message));
    }
}

// Almacenamos los chats suscritos
const subscribedChats = new Set();
const MI_CHAT_ID = 890184744; // Tu ID exclusivo

if (bot.onText) {
    // Suscribir automáticamente al inicio para evitar que los reinicios corten las notificaciones
    subscribedChats.add(MI_CHAT_ID);
    console.log(`[Inicio] Chat principal ${MI_CHAT_ID} auto-suscrito por defecto.`);

    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        
        if (chatId !== MI_CHAT_ID) {
            console.log(`Intento de acceso bloqueado del ID: ${chatId}`);
            bot.sendMessage(chatId, "⛔ Acceso denegado. Este es un bot privado de uso exclusivo.");
            return;
        }

        subscribedChats.add(chatId);
        bot.sendMessage(chatId, `⚽ ¡Bienvenido jefe! Bot de Alertas de Fútbol iniciado.\n*Versión:* v${VERSION} (Soporte de Parlays Pre-Partido y En Vivo 🚀)\n\nMonitoreando 7 Reglas de Fútbol con Verificación GREEN/RED.`, { parse_mode: 'Markdown' });
        console.log(`Usuario principal conectado: ${chatId}`);
    });
} else {
    subscribedChats.add("console_user");
}

// Cachés de momios pre-partido
const oddsCache = new Map();

// Seguimiento Post-Partido GREEN / RED
const trackedMatches = new Map();

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

// Reconstrucción del mapa trackedMatches a partir de las jugadas pendientes en financial_tracker.json
try {
    const pendingPlays = financialTracker.getPendingPlays();
    if (pendingPlays && pendingPlays.length > 0) {
        console.log(`[Inicio] Cargando ${pendingPlays.length} jugadas pendientes desde financial_tracker.json para monitoreo...`);
        for (const play of pendingPlays) {
            const fixtureId = play.fixtureId;
            if (!trackedMatches.has(fixtureId)) {
                trackedMatches.set(fixtureId, {
                    home: play.home,
                    away: play.away,
                    alertsMetadata: []
                });
            }
            const trackedInfo = trackedMatches.get(fixtureId);
            const hasRule = trackedInfo.alertsMetadata.some(m => m.ruleName === play.ruleName);
            if (!hasRule && play.metadata) {
                // Forzar que isSent sea true porque la alerta ya fue enviada en la ejecución previa
                const meta = { ...play.metadata, isSent: true };
                trackedInfo.alertsMetadata.push(meta);
            }
        }
        console.log(`[Inicio] Se reconstruyó el monitoreo de trackedMatches para ${trackedMatches.size} partidos.`);
    } else {
        console.log(`[Inicio] No hay jugadas pendientes en financial_tracker.json.`);
    }
} catch (error) {
    console.error(`[Inicio] Error al reconstruir trackedMatches desde jugadas pendientes:`, error.message);
}


function getLiveOddForRecommendation(oddsArray, recommendation, homeTeam, awayTeam) {
    if (!oddsArray || !recommendation) return null;
    
    const recLower = recommendation.toLowerCase();
    
    // Ignorar por completo si es una recomendación de tarjetas o córneres
    const isCards = recLower.includes('tarjeta') || recLower.includes('tarjetas') || recLower.includes('card') || recLower.includes('cards') || recLower.includes('roja') || recLower.includes('amarilla');
    const isCorners = recLower.includes('corner') || recLower.includes('corners') || recLower.includes('córner') || recLower.includes('córneres') || recLower.includes('tiro de esquina') || recLower.includes('tiros de esquina');
    if (isCards || isCorners) {
        return null;
    }
    
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
            const lineMatch = recommendation.match(/(\d+\.\d+|\d+)/);
            const lineVal = lineMatch ? lineMatch[1] : null;
            const targetValue = (recLower.includes('under') || recLower.includes('menos de')) ? 'Under' : 'Over';
            
            let oddObj;
            if (lineVal) {
                // Buscar coincidencia exacta de la línea de goles en el handicap
                oddObj = goalsMarket.values.find(v => v.value === targetValue && v.handicap === lineVal);
            }
            if (!oddObj) {
                // Fallback a cualquier cuota activa del targetValue
                oddObj = goalsMarket.values.find(v => v.value === targetValue && !v.suspended);
            }
            
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
            const logMsg = `⚠️ *[SafeOdds]* Alerta cancelada para *${alert.homeTeam} vs ${alert.awayTeam}* (Regla: ${alert.ruleName}) porque el partido finalizó o ya no está en vivo.`;
            console.log(`[SafeOdds] Partido finalizado o no en vivo. Cancelando alerta pendiente para ${alert.homeTeam} vs ${alert.awayTeam}`);
            logSafeOddsEvent(logMsg);
            pendingAlertsQueue.splice(i, 1);
            continue;
        }
        
        const currentHomeGoals = match.goals.home || 0;
        const currentAwayGoals = match.goals.away || 0;
        
        // 2. Si el marcador cambió, la alerta ya no sirve, eliminar de la cola
        if (currentHomeGoals !== alert.scoreAtTime.home || currentAwayGoals !== alert.scoreAtTime.away) {
            const logMsg = `❌ *[SafeOdds]* Alerta cancelada para *${alert.homeTeam} vs ${alert.awayTeam}* (Regla: ${alert.ruleName}) por cambio de marcador (${alert.scoreAtTime.home}-${alert.scoreAtTime.away} ➔ ${currentHomeGoals}-${currentAwayGoals}).`;
            console.log(`[SafeOdds] El marcador cambió (${alert.scoreAtTime.home}-${alert.scoreAtTime.away} -> ${currentHomeGoals}-${currentAwayGoals}). Cancelando alerta pendiente para ${alert.homeTeam} vs ${alert.awayTeam}`);
            logSafeOddsEvent(logMsg);
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
            const logMsg = `✅ *[SafeOdds]* ¡Alerta ACTIVADA! *${alert.homeTeam} vs ${alert.awayTeam}* (Regla: ${alert.ruleName}). Momio: *@${currentOddValue.toFixed(2)}* (${method}) en el minuto ${elapsed}'`;
            console.log(`[SafeOdds] ¡Alerta ACTIVADA! ${alert.homeTeam} vs ${alert.awayTeam}. Momio: @${currentOddValue.toFixed(2)} (${method}) en el minuto ${elapsed}'`);
            logSafeOddsEvent(logMsg);
            
            for (const chatId of subscribedChats) {
                try {
                    await sendSafeMarkdownMessage(chatId, alert.textToSend);
                } catch (e) {
                    console.error(`Error enviando alerta pendiente al chat ${chatId}:`, e.message);
                }
            }
            
            const tracked = trackedMatches.get(alert.fixtureId);
            if (tracked) {
                const meta = tracked.alertsMetadata.find(m => m.ruleName === alert.ruleName);
                if (meta) meta.isSent = true;
            }
            
            if (alert.textToSend) {
                await handleLiveParlayQueue(alert.fixtureId, 'football', alert.homeTeam, alert.awayTeam, alert.textToSend);
            }
            
            // Registrar en el control financiero
            financialTracker.addPlay({
                fixtureId: alert.fixtureId,
                home: alert.homeTeam,
                away: alert.awayTeam,
                recommendation: alert.aiRecommendation,
                suggestedOdd: currentOddValue || alert.targetOdd || 1.60,
                ruleName: alert.ruleName,
                metadata: alert.metadata
            });

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
        const liveOddsResponse = await getLiveOdds();
        if (liveOddsResponse && liveOddsResponse.response) {
            liveOddsResponse.response.forEach(item => {
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

        await Promise.all(liveMatches.map(async (match) => {
        const fixtureId = match.fixture.id;
        newLiveIds.add(fixtureId);

        const leagueName = match.league && match.league.name ? match.league.name.toLowerCase() : '';
        if (leagueName.includes('friendl') || leagueName.includes('amistoso')) {
            return;
        }

        const isTop = isMajorLeague(match.league);
        
        if (!oddsCache.has(fixtureId)) {
            await new Promise(r => setTimeout(r, 100));
            const odds = await getPreMatchOdds(fixtureId);
            oddsCache.set(fixtureId, odds || 'NO_ODDS');
        }

        const matchOdds = oddsCache.get(fixtureId);
        if (!matchOdds || matchOdds === 'NO_ODDS') {
            return; // Si no hay momios disponibles, no podemos calcular las reglas
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
            // Carga dinámica on-demand para alimentar a la IA con el contexto completo de forma paralela
            const homeTeamId = match.teams.home.id;
            const awayTeamId = match.teams.away.id;
            console.log(`[index.js] Alerta de fútbol detectada para ${match.teams.home.name} vs ${match.teams.away.name}. Consultando datos adicionales en paralelo para la IA...`);
            
            const [fetchedStats, fetchedEvents, rawLastMatchesHome, rawLastMatchesAway, rawH2hMatches] = await Promise.all([
                stats.length === 0 ? getMatchStatistics(fixtureId) : Promise.resolve(stats),
                events.length === 0 ? getMatchEvents(fixtureId) : Promise.resolve(events),
                getTeamLastMatches(homeTeamId, 6),
                getTeamLastMatches(awayTeamId, 6),
                getHeadToHead(homeTeamId, awayTeamId, 6)
            ]);
            
            stats = fetchedStats;
            events = fetchedEvents;

            // Filtrar para excluir el partido actual (fixtureId) y limitar a los últimos 5
            const lastMatchesHome = (rawLastMatchesHome || [])
                .filter(m => m.fixture && m.fixture.id !== fixtureId)
                .slice(0, 5);

            const lastMatchesAway = (rawLastMatchesAway || [])
                .filter(m => m.fixture && m.fixture.id !== fixtureId)
                .slice(0, 5);

            const h2hMatches = (rawH2hMatches || [])
                .filter(m => m.fixture && m.fixture.id !== fixtureId)
                .slice(0, 5);
            
            if (!trackedMatches.has(fixtureId)) {
                trackedMatches.set(fixtureId, {
                    home: match.teams.home.name,
                    away: match.teams.away.name,
                    alertsMetadata: []
                });
            }

            const trackedInfo = trackedMatches.get(fixtureId);

            for (const alert of alerts) {
                alert.metadata.isSent = false;
                trackedInfo.alertsMetadata.push(alert.metadata);

                let textToSend = alert.text;
                try {
                    const ruleThirdPart = alert.text.split('\n\n').slice(2).join('\n\n');
                    const targetIdx = ruleThirdPart.indexOf('🎯');
                    const cleanRuleDetails = targetIdx !== -1 ? ruleThirdPart.substring(0, targetIdx).trim() : ruleThirdPart;

                    const matchData = {
                        homeTeam: match.teams.home.name,
                        awayTeam: match.teams.away.name,
                        leagueName: match.league && match.league.name ? match.league.name : 'Desconocida',
                        leagueRound: match.league && match.league.round ? match.league.round : 'Ronda Desconocida',
                        elapsed: match.fixture.status.elapsed,
                        score: { home: match.goals.home || 0, away: match.goals.away || 0 },
                        odds: matchOdds,
                        ruleName: alert.metadata.ruleName,
                        ruleDetails: cleanRuleDetails,
                        stats: stats,
                        events: events,
                        lastMatchesHome: lastMatchesHome,
                        lastMatchesAway: lastMatchesAway,
                        h2hMatches: h2hMatches
                    };
                    console.log(`[index.js] Solicitando predicción de IA para partido: ${matchData.homeTeam} vs ${matchData.awayTeam}`);
                    const contextGemini = {};
                    const aiPrediction = await aiService.generatePrediction(matchData, 'football', contextGemini);
                    if (aiPrediction) {
                        const recMatch = aiPrediction.match(/🎯\s*\*?\*?Recomendación Inteligente\*?\*?:?\s*\*?\*?\s*([^\n]+)/i);
                        if (recMatch) {
                            alert.metadata.aiRecommendation = recMatch[1].replace(/\*/g, '').trim();
                        }
                        const splitIndex = alert.text.indexOf('🎯');
                        const header = splitIndex !== -1 ? alert.text.substring(0, splitIndex).trim() : alert.text;
                        
                        const analysisMatch = aiPrediction.match(/🧠\s*\*?\*?Análisis de IA\*?\*?:?\s*\*?\*?\s*([^\n]+)/i);
                        const oddMatch = aiPrediction.match(/📈\s*\*?\*?Momio Sugerido\*?\*?:?\s*\*?\*?\s*@?\s*([^\n]+)/i);
                        const confidenceMatch = aiPrediction.match(/🔥\s*\*?\*?Confianza Estimada\*?\*?:?\s*\*?\*?\s*(\d+)%/i);
                        
                        const analysis = analysisMatch ? analysisMatch[1].trim() : 'N/D';
                        const recommendation = recMatch ? recMatch[1].replace(/\*/g, '').trim() : 'N/D';
                        const oddVal = oddMatch ? oddMatch[1].replace(/\*/g, '').replace('@', '').trim() : '1.60';
                        const confidence = confidenceMatch ? confidenceMatch[1] : '80';
                        alert.metadata.geminiRecommendation = recommendation;

                        // Obtener predicción de DeepSeek para el bloque dual
                        let deepseekPrediction = null;
                        const contextDeepSeek = {};
                        try {
                            deepseekPrediction = await aiService.generatePredictionDeepSeek(matchData, 'football', contextDeepSeek);
                        } catch (err) {
                            console.error("[index.js] Error al obtener recomendación de DeepSeek:", err.message);
                        }

                        let formattedAiSection = "";
                        if (deepseekPrediction) {
                            const dsAnalysisMatch = deepseekPrediction.match(/🧠\s*\*?\*?Análisis de IA\*?\*?:?\s*\*?\*?\s*([^\n]+)/i);
                            const dsRecMatch = deepseekPrediction.match(/🎯\s*\*?\*?Recomendación Inteligente\*?\*?:?\s*\*?\*?\s*([^\n]+)/i);
                            const dsConfidenceMatch = deepseekPrediction.match(/🔥\s*\*?\*?Confianza Estimada\*?\*?:?\s*\*?\*?\s*(\d+)%/i);

                            const dsAnalysis = dsAnalysisMatch ? dsAnalysisMatch[1].trim() : 'N/D';
                            const dsRecommendation = dsRecMatch ? dsRecMatch[1].replace(/\*/g, '').trim() : 'N/D';
                            const dsConfidence = dsConfidenceMatch ? dsConfidenceMatch[1] : '80';
                            if (dsRecommendation && dsRecommendation !== 'N/D') {
                                alert.metadata.deepseekRecommendation = dsRecommendation;
                            }

                            formattedAiSection = 
                                `🤖 *ANÁLISIS DE IA - DUAL*\n` +
                                `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                `♊ *GOOGLE GEMINI*\n` +
                                `🧠 *Análisis:* ${analysis}\n` +
                                `🎯 *Apuesta:* *${recommendation}* (Confianza: *${confidence}%*)\n` +
                                `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                `🐳 *DEEPSEEK*\n` +
                                `🧠 *Análisis:* ${dsAnalysis}\n` +
                                `🎯 *Apuesta:* *${dsRecommendation}* (Confianza: *${dsConfidence}%*)\n` +
                                `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                                `📈 *Momio Sugerido de Entrada:* *@1.60*`;
                        } else {
                            // Fallback al formato clásico si DeepSeek falla (ej. falta de saldo)
                            formattedAiSection = 
                                `🤖 *ANÁLISIS INTELIGENTE DE IA*\n` +
                                `🧠 ${analysis}\n\n` +
                                `🎯 *Recomendación:* *${recommendation}*\n` +
                                `📈 *Momio Sugerido:* *@${oddVal}*\n` +
                                `🔥 *Confianza Estimada:* *${confidence}%*`;
                        }
                        
                        // --- FILTRO DE CONSENSO IA ---
                        const isGeminiLowConfidence = parseInt(confidence) < 40;
                        const isGeminiAvoiding = recommendation.toLowerCase().includes('evitar') || recommendation.toLowerCase().includes('no recomendada');
                        if (isGeminiLowConfidence || isGeminiAvoiding) {
                            console.log(`[Consensus Filter] ⛔ Alerta abortada para ${matchData.homeTeam} vs ${matchData.awayTeam} (Regla: ${matchData.ruleName}). Gemini detectó alto riesgo (${confidence}% - ${recommendation}).`);
                            alert.metadata.isSent = false;
                            alert.metadata.aiRecommendation = recommendation;
                            continue;
                        }

                        textToSend = `${header}\n\n${formattedAiSection}`;

                        // Envío de prompts de IA a Telegram desactivado por solicitud del usuario
                        /*
                        if (process.env.TELEGRAM_PROMPTS_CHAT_ID) {
                            const promptChatId = process.env.TELEGRAM_PROMPTS_CHAT_ID;
                            const matchClean = `${matchData.homeTeam}_vs_${matchData.awayTeam}`.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_');
                            
                            if (contextGemini.prompt) {
                                console.log(`[index.js] Intentando enviar prompt de Gemini a Telegram (${matchData.homeTeam} vs ${matchData.awayTeam}) al chat/canal: ${promptChatId}...`);
                                bot.sendDocument(promptChatId, Buffer.from(contextGemini.prompt, 'utf-8'), {
                                    caption: `🤖 *Prompt Gemini* - ${matchData.homeTeam} vs ${matchData.awayTeam}\n📋 *Regla:* ${matchData.ruleName}`
                                }, {
                                    filename: `prompt_gemini_${matchClean}.txt`,
                                    contentType: 'text/plain'
                                })
                                .then(() => console.log(`[index.js] ✅ Prompt Gemini enviado exitosamente a Telegram.`))
                                .catch(err => console.error(`[index.js] ❌ Error al enviar prompt Gemini a Telegram:`, err.message));
                            }
                            
                            if (contextDeepSeek.prompt) {
                                console.log(`[index.js] Intentando enviar prompt de DeepSeek a Telegram (${matchData.homeTeam} vs ${matchData.awayTeam}) al chat/canal: ${promptChatId}...`);
                                bot.sendDocument(promptChatId, Buffer.from(contextDeepSeek.prompt, 'utf-8'), {
                                    caption: `🐳 *Prompt DeepSeek* - ${matchData.homeTeam} vs ${matchData.awayTeam}\n📋 *Regla:* ${matchData.ruleName}`
                                }, {
                                    filename: `prompt_deepseek_${matchClean}.txt`,
                                    contentType: 'text/plain'
                                })
                                .then(() => console.log(`[index.js] ✅ Prompt DeepSeek enviado exitosamente a Telegram.`))
                                .catch(err => console.error(`[index.js] ❌ Error al enviar prompt DeepSeek a Telegram:`, err.message));
                            }
                        }
                        */

                        // --- INTEGRACIÓN DE SAFEODDS SYSTEM ---
                        const suggestedOddMatch = aiPrediction.match(/📈 Momio Sugerido:\s*@?\s*([0-9.]+)/i);
                        const suggestedOdd = suggestedOddMatch ? parseFloat(suggestedOddMatch[1]) : 1.60;
                        const targetOdd = 1.60;
                        
                        const currentHomeGoals = match.goals.home || 0;
                        const currentAwayGoals = match.goals.away || 0;
                        const elapsed = match.fixture.status.elapsed || 0;
                        
                        let liveOddVal = null;
                        const oddsArray = liveOddsMap.get(fixtureId);
                        if (oddsArray && alert.metadata.aiRecommendation) {
                            liveOddVal = getLiveOddForRecommendation(oddsArray, alert.metadata.aiRecommendation, match.teams.home.name, match.teams.away.name);
                        }
                        
                        const recLower = (alert.metadata.aiRecommendation || '').toLowerCase();
                        const isCards = recLower.includes('tarjeta') || recLower.includes('tarjetas') || recLower.includes('card') || recLower.includes('cards') || recLower.includes('roja') || recLower.includes('amarilla');
                        const isCorners = recLower.includes('corner') || recLower.includes('corners') || recLower.includes('córner') || recLower.includes('córneres') || recLower.includes('tiro de esquina') || recLower.includes('tiros de esquina');
                        const isUnsupportedMarket = isCards || isCorners;
                        
                        if (!oddsArray || isUnsupportedMarket) {
                            const reason = !oddsArray ? 'sin cobertura de cuotas en vivo en la API' : 'mercado no monitorizable en vivo (tarjetas/córneres)';
                            console.log(`[SafeOdds] Enviando alerta de inmediato para ${match.teams.home.name} vs ${match.teams.away.name} por tratarse de un escenario ${reason}.`);
                            for (const chatId of subscribedChats) {
                                try {
                                    await sendSafeMarkdownMessage(chatId, textToSend);
                                } catch (e) {
                                    console.error(`Error enviando alerta fútbol al chat ${chatId}:`, e.message);
                                }
                            }
                            alert.metadata.isSent = true;
                            if (textToSend) {
                                await handleLiveParlayQueue(fixtureId, 'football', match.teams.home.name, match.teams.away.name, textToSend);
                            }
                            
                            // Registrar en el control financiero
                            financialTracker.addPlay({
                                fixtureId,
                                home: match.teams.home.name,
                                away: match.teams.away.name,
                                recommendation: alert.metadata.aiRecommendation,
                                suggestedOdd: suggestedOdd || 1.60,
                                ruleName: alert.metadata.ruleName,
                                metadata: alert.metadata
                            });
                        } else if (liveOddVal !== null && liveOddVal >= targetOdd) {
                            console.log(`[SafeOdds] Alerta enviada de inmediato (cuota en vivo @${liveOddVal.toFixed(2)} >= @${targetOdd.toFixed(2)}).`);
                            for (const chatId of subscribedChats) {
                                try {
                                    await sendSafeMarkdownMessage(chatId, textToSend);
                                } catch (e) {
                                    console.error(`Error enviando alerta fútbol al chat ${chatId}:`, e.message);
                                }
                            }
                            alert.metadata.isSent = true;
                            if (textToSend) {
                                await handleLiveParlayQueue(fixtureId, 'football', match.teams.home.name, match.teams.away.name, textToSend);
                            }

                            // Registrar en el control financiero
                            financialTracker.addPlay({
                                fixtureId,
                                home: match.teams.home.name,
                                away: match.teams.away.name,
                                recommendation: alert.metadata.aiRecommendation,
                                suggestedOdd: liveOddVal || 1.60,
                                ruleName: alert.metadata.ruleName,
                                metadata: alert.metadata
                            });
                        } else {
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
                            
                            if (liveOddVal === null && estimatedStartOdd >= targetOdd) {
                                console.log(`[SafeOdds] Alerta enviada de inmediato (cuota de inicio estimada @${estimatedStartOdd.toFixed(2)} >= @${targetOdd.toFixed(2)}).`);
                                for (const chatId of subscribedChats) {
                                    try {
                                        await sendSafeMarkdownMessage(chatId, textToSend);
                                    } catch (e) {
                                        console.error(`Error enviando alerta fútbol al chat ${chatId}:`, e.message);
                                    }
                                }
                                alert.metadata.isSent = true;
                                if (textToSend) {
                                    await handleLiveParlayQueue(fixtureId, 'football', match.teams.home.name, match.teams.away.name, textToSend);
                                }

                                // Registrar en el control financiero
                                financialTracker.addPlay({
                                    fixtureId,
                                    home: match.teams.home.name,
                                    away: match.teams.away.name,
                                    recommendation: alert.metadata.aiRecommendation,
                                    suggestedOdd: estimatedStartOdd || 1.60,
                                    ruleName: alert.metadata.ruleName,
                                    metadata: alert.metadata
                                });
                            } else {
                                const timeRemaining = 90 - elapsed;
                                let waitMinutes = 0;
                                const startOdd = liveOddVal !== null ? liveOddVal : estimatedStartOdd;
                                if (startOdd < targetOdd && timeRemaining > 0) {
                                    const ratio = (startOdd - 1) / (targetOdd - 1);
                                    waitMinutes = timeRemaining * (1 - Math.pow(Math.max(0.01, ratio), 0.9));
                                    waitMinutes = Math.max(1, Math.min(8, Math.round(waitMinutes))); // Acotado a 8 minutos máximo
                                }
                                
                                const logMsg = `⏳ *[SafeOdds]* Alerta encolada para *${match.teams.home.name} vs ${match.teams.away.name}* (Regla: ${alert.metadata.ruleName}). Cuota inicial: *@${startOdd.toFixed(2)}*, Objetivo: *@${targetOdd.toFixed(2)}*, Tiempo máx espera: *${waitMinutes} min*.`;
                                console.log(`[SafeOdds] Encolando alerta pendiente para ${match.teams.home.name} vs ${match.teams.away.name}. Cuota inicial/en-vivo: @${startOdd.toFixed(2)}, Objetivo: @${targetOdd.toFixed(2)}, Espera: ${waitMinutes} min.`);
                                logSafeOddsEvent(logMsg);
                                
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
                                    sent: false,
                                    metadata: alert.metadata // Guardar metadatos completos para el tracker
                                });
                            }
                        }
                    }
                } catch (aiError) {
                    console.error(`[index.js] Error al procesar IA para fútbol: ${aiError.message}`);
                }
            }
        }
    }));

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

        try {
            const matchData = await getMatchById(fixtureId);
            if (matchData) {
                const status = matchData.fixture.status.short;
                if (status === 'FT' || status === 'AET' || status === 'PEN') {
                    const finalEvents = await getMatchEvents(fixtureId);
                    const finalStats = await getMatchStatistics(fixtureId);

                    const results = await evaluateAlertResults(matchInfo.alertsMetadata, matchData, finalEvents, finalStats);

                    for (const result of results) {
                        for (const chatId of subscribedChats) {
                            try {
                                await sendSafeMarkdownMessage(chatId, result.msg);
                            } catch (e) {
                                console.error(`Error enviando veredicto fútbol al chat ${chatId}:`, e.message);
                            }
                        }
                        
                        // Actualizar en el control financiero
                        financialTracker.updatePlayVerdict(fixtureId, result.meta.ruleName, result.isGreen, result.isOmitted);
                    }
                    trackedMatches.delete(fixtureId);
                } else if (['CANC', 'PST', 'ABD', 'AWD', 'WO', 'SUSP', 'INT'].includes(status)) {
                    console.log(`[checkFinishedMatches] Partido ${fixtureId} cancelado o suspendido (${status}). Eliminando de rastreo.`);
                    trackedMatches.delete(fixtureId);
                }
            }
        } catch (error) {
            console.error(`[checkFinishedMatches] Error procesando partido ${fixtureId}:`, error);
        }
    }
}

// ===================================================
// MONITOREO DE BÉISBOL (MLB) - REMOVIDO PARA CANAL SEPARADO
// ===================================================

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
                await sendSafeMarkdownMessage(chatId, msg);
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
                    await sendSafeMarkdownMessage(chatId, parlayMsg);
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

// Bucle asíncrono de monitoreo continuo cada 30 segundos
async function startMonitoringLoop() {
    while (true) {
        if (isWithinActiveHours()) {
            const startTime = Date.now();
            try {
                await checkMatches();
                await checkFinishedMatches();
            } catch (err) {
                console.error("[startMonitoringLoop] Error en ciclo de monitoreo:", err);
            }
            const duration = Date.now() - startTime;
            const delay = Math.max(5000, 30000 - duration); // Esperar lo necesario para completar 30 segundos, o al menos 5s
            await new Promise(resolve => setTimeout(resolve, delay));
        } else {
            // Fuera de horario activo, chequear cada minuto
            await new Promise(resolve => setTimeout(resolve, 60000));
        }
    }
}

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
            sendSafeMarkdownMessage(chatId, msg).catch(e => console.error(e));
        }
    }
}, {
    timezone: TIMEZONE
});

// Reporte Financiero Matutino todos los días a las 7:35 AM (Hora Centro México)
cron.schedule('35 7 * * *', async () => {
    console.log("[Cron] Iniciando Reporte Financiero Matutino...");
    try {
        // Resolver cualquier veredicto que haya quedado pendiente
        await financialTracker.resolvePendingPlays();
        // Generar y enviar el reporte financiero diario
        await financialTracker.sendDailyReport(bot, subscribedChats);
    } catch (error) {
        console.error("[Cron] Error crítico en Reporte Financiero Matutino:", error.message);
    }
}, {
    timezone: TIMEZONE
});

console.log(`🟢 Bot de Monitoreo de Fútbol en vivo en marcha. Horario activo: 7:00 AM - 9:00 PM (${TIMEZONE}).`);
// Iniciar bucle de monitoreo continuo
startMonitoringLoop();


