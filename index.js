require('dotenv').config();
const botModule = require('node-telegram-bot-api');
const TelegramBot = botModule.default || botModule;
const cron = require('node-cron');

// Módulos de Fútbol
const { getLiveMatches, getMatchEvents, getPreMatchOdds, getMatchStatistics, getMatchesByDate, getMatchById } = require('./apiClient');
const { evaluateRules, needsStats, needsEvents, evaluateAlertResults } = require('./rulesEngine');
const { isMajorLeague } = require('./config');

// Módulos de Béisbol (MLB)
const { getLiveBaseballGames, getPreGameBaseballOdds, getBaseballGameById } = require('./baseballApiClient');
const { evaluateBaseballRules, evaluateBaseballAlertResults } = require('./baseballRulesEngine');

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
        bot.sendMessage(chatId, "⚽⚾ ¡Bienvenido jefe! Bot Multideporte (Fútbol + MLB) iniciado.\nMonitoreando 7 Reglas de Fútbol y 3 Reglas de MLB con Verificación GREEN/RED.", { parse_mode: 'Markdown' });
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

// ===================================================
// MONITOREO DE FÚTBOL
// ===================================================
async function checkMatches() {
    console.log(`[${new Date().toLocaleTimeString()}] Revisando partidos de fútbol en vivo...`);
    const liveMatches = await getLiveMatches();

    for (const match of liveMatches) {
        const leagueName = match.league && match.league.name ? match.league.name.toLowerCase() : '';
        if (leagueName.includes('friendl') || leagueName.includes('amistoso')) {
            continue;
        }

        const fixtureId = match.fixture.id;
        const isTop = isMajorLeague(match.league);
        
        if (!oddsCache.has(fixtureId)) {
            await new Promise(r => setTimeout(r, 200));
            const odds = await getPreMatchOdds(fixtureId);
            if (odds) {
                oddsCache.set(fixtureId, odds);
            } else {
                continue;
            }
        }
        const matchOdds = oddsCache.get(fixtureId);

        let events = [];
        if (needsEvents(match, isTop)) {
            events = await getMatchEvents(fixtureId);
        }

        let stats = [];
        if (needsStats(match, matchOdds, isTop)) {
            stats = await getMatchStatistics(fixtureId);
        }

        const alerts = evaluateRules(match, matchOdds, events, stats, isTop);

        if (alerts.length > 0) {
            if (!trackedMatches.has(fixtureId)) {
                trackedMatches.set(fixtureId, {
                    home: match.teams.home.name,
                    away: match.teams.away.name,
                    alertsMetadata: []
                });
            }

            const trackedInfo = trackedMatches.get(fixtureId);

            for (const alert of alerts) {
                trackedInfo.alertsMetadata.push(alert.metadata);

                for (const chatId of subscribedChats) {
                    try {
                        await bot.sendMessage(chatId, alert.text, { parse_mode: 'Markdown' });
                    } catch (e) {
                        console.error(`Error enviando alerta fútbol al chat ${chatId}:`, e.message);
                    }
                }
            }
        }
    }
}

async function checkFinishedMatches() {
    for (const [fixtureId, matchInfo] of trackedMatches.entries()) {
        const matchData = await getMatchById(fixtureId);
        if (matchData && (matchData.fixture.status.short === 'FT' || matchData.fixture.status.short === 'AET' || matchData.fixture.status.short === 'PEN')) {
            const finalEvents = await getMatchEvents(fixtureId);
            const finalStats = await getMatchStatistics(fixtureId);

            const results = evaluateAlertResults(matchInfo.alertsMetadata, matchData, finalEvents, finalStats);

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

    for (const game of liveGames) {
        const gameId = game.game.id;

        if (!baseballOddsCache.has(gameId)) {
            await new Promise(r => setTimeout(r, 200));
            const odds = await getPreGameBaseballOdds(gameId);
            if (odds) {
                baseballOddsCache.set(gameId, odds);
            } else {
                continue;
            }
        }
        const gameOdds = baseballOddsCache.get(gameId);

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

                for (const chatId of subscribedChats) {
                    try {
                        await bot.sendMessage(chatId, alert.text, { parse_mode: 'Markdown' });
                    } catch (e) {
                        console.error(`Error enviando alerta béisbol al chat ${chatId}:`, e.message);
                    }
                }
            }
        }
    }
}

async function checkFinishedBaseballMatches() {
    for (const [gameId, gameInfo] of trackedBaseballGames.entries()) {
        const gameData = await getBaseballGameById(gameId);
        if (gameData && (gameData.status.short === 'FT' || gameData.status.short === 'POST' || gameData.status.short === 'FINISHED')) {
            const results = evaluateBaseballAlertResults(gameInfo.alertsMetadata, gameData);

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

// Programar revisión cada minuto para ambos deportes
cron.schedule('* * * * *', async () => {
    await checkMatches();
    await checkFinishedMatches();
    await checkBaseballMatches();
    await checkFinishedBaseballMatches();
});

// Resumen Matutino todos los días a las 7:30 AM
cron.schedule('30 7 * * *', async () => {
    console.log("Ejecutando Resumen Matutino de Ligas Principales...");
    const today = new Date().toISOString().split('T')[0];
    const matches = await getMatchesByDate(today);
    
    const topMatches = matches.filter(m => isMajorLeague(m.league)).slice(0, 20); 
    const topFavorites = [];

    for (const match of topMatches) {
        const fixtureId = match.fixture.id;
        await new Promise(r => setTimeout(r, 200));
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
});

console.log("🟢 Sistema Multideporte automatizado (Fútbol + MLB Béisbol) en marcha.");
// Ejecutar primera revisión de ambos deportes al arrancar
checkMatches();
checkBaseballMatches();
