require('dotenv').config();
const botModule = require('node-telegram-bot-api');
const TelegramBot = botModule.default || botModule;
const cron = require('node-cron');
const { getLiveMatches, getMatchEvents, getPreMatchOdds, getMatchStatistics, getMatchesByDate, getMatchById } = require('./apiClient');
const { evaluateRules, needsStats, needsEvents, evaluateAlertResults } = require('./rulesEngine');
const { isMajorLeague } = require('./config');

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

// Almacenamos los chats que se han suscrito (quienes enviaron /start al bot)
const subscribedChats = new Set();

if (bot.onText) {
    const MI_CHAT_ID = 890184744; // Tu ID exclusivo

    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        
        // Bloqueo de seguridad: solo aceptar tu ID
        if (chatId !== MI_CHAT_ID) {
            console.log(`Intento de acceso bloqueado del ID: ${chatId}`);
            bot.sendMessage(chatId, "⛔ Acceso denegado. Este es un bot privado de uso exclusivo.");
            return;
        }

        subscribedChats.add(chatId);
        bot.sendMessage(chatId, "⚽ ¡Bienvenido jefe! Bot de Alertas con Verificación GREEN/RED iniciado.\nMonitoreando 7 Reglas Estratégicas en vivo (Reglas 5-7 exclusivas para Ligas Importantes).", { parse_mode: 'Markdown' });
        console.log(`Usuario principal conectado: ${chatId}`);
    });
} else {
    // Si no hay bot real, simulamos un suscriptor
    subscribedChats.add("console_user");
}

// Caché de momios pre-partido para cuidar peticiones a la API
const oddsCache = new Map();

// Mapeo para Seguimiento Post-Partido GREEN / RED
// fixtureId -> { home, away, alertsMetadata: [] }
const trackedMatches = new Map();

async function checkMatches() {
    console.log(`[${new Date().toLocaleTimeString()}] Revisando partidos en vivo...`);
    const liveMatches = await getLiveMatches();
    console.log(`Partidos en vivo encontrados: ${liveMatches.length}`);

    for (const match of liveMatches) {
        // Ignorar partidos amistosos
        const leagueName = match.league && match.league.name ? match.league.name.toLowerCase() : '';
        if (leagueName.includes('friendl') || leagueName.includes('amistoso')) {
            continue;
        }

        const fixtureId = match.fixture.id;
        const isTop = isMajorLeague(match.league);
        
        // 1. Obtener momios pre-partido (desde API o caché)
        if (!oddsCache.has(fixtureId)) {
            await new Promise(r => setTimeout(r, 200)); // Pausa corta
            const odds = await getPreMatchOdds(fixtureId);
            if (odds) {
                oddsCache.set(fixtureId, odds);
            } else {
                continue; // Si no hay momios disponibles, saltamos el partido
            }
        }
        const matchOdds = oddsCache.get(fixtureId);

        // 2. Obtener eventos solo si la regla lo requiere
        let events = [];
        if (needsEvents(match, isTop)) {
            events = await getMatchEvents(fixtureId);
        }

        // 3. Obtener estadísticas solo si la regla lo requiere
        let stats = [];
        if (needsStats(match, matchOdds, isTop)) {
            stats = await getMatchStatistics(fixtureId);
        }

        // 4. Evaluar las 7 reglas (distinguiendo si es liga importante)
        const alerts = evaluateRules(match, matchOdds, events, stats, isTop);

        // 5. Enviar alertas si se activó alguna y registrar para verificación GREEN/RED
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
                        console.error(`Error enviando mensaje al chat ${chatId}:`, e.message);
                    }
                }
            }
        }
    }
}

// Revisa si los partidos alertados ya terminaron y envía la calificación GREEN / RED
async function checkFinishedMatches() {
    for (const [fixtureId, matchInfo] of trackedMatches.entries()) {
        const matchData = await getMatchById(fixtureId);
        if (matchData && (matchData.fixture.status.short === 'FT' || matchData.fixture.status.short === 'AET' || matchData.fixture.status.short === 'PEN')) {
            
            // Consultar eventos finales si hay reglas que los usen
            const finalEvents = await getMatchEvents(fixtureId);
            const finalStats = await getMatchStatistics(fixtureId);

            const results = evaluateAlertResults(matchInfo.alertsMetadata, matchData, finalEvents, finalStats);

            for (const result of results) {
                for (const chatId of subscribedChats) {
                    try {
                        await bot.sendMessage(chatId, result.msg, { parse_mode: 'Markdown' });
                    } catch (e) {
                        console.error(`Error enviando resultado post-partido al chat ${chatId}:`, e.message);
                    }
                }
            }

            // Eliminar de seguimiento tras evaluar
            trackedMatches.delete(fixtureId);
        }
    }
}

// Programar revisión cada minuto
cron.schedule('* * * * *', async () => {
    await checkMatches();
    await checkFinishedMatches();
});

// Resumen Matutino todos los días a las 7:30 AM (Filtrado por ligas principales)
cron.schedule('30 7 * * *', async () => {
    console.log("Ejecutando Resumen Matutino de Ligas Principales...");
    const today = new Date().toISOString().split('T')[0];
    const matches = await getMatchesByDate(today);
    
    // Filtrar partidos de ligas principales
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
        const msg = `☀️ *Resumen Matutino (Ligas Principales)*\nFavoritos claros del día (Momio < 1.35):\n\n${topFavorites.join('\n')}`;
        for (const chatId of subscribedChats) {
            bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' }).catch(e => console.error(e));
        }
    }
});

console.log("🟢 Sistema automatizado con 7 Reglas y Verificación GREEN/RED en marcha.");
// Ejecutar primera revisión al arrancar
checkMatches();
