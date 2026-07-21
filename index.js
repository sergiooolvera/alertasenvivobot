require('dotenv').config();
const botModule = require('node-telegram-bot-api');
const TelegramBot = botModule.default || botModule;
const cron = require('node-cron');
const { getLiveMatches, getMatchEvents, getPreMatchOdds, getMatchStatistics, getMatchesByDate, getMatchById } = require('./apiClient');
const { evaluateRules, needsStats } = require('./rulesEngine');

const token = process.env.TELEGRAM_BOT_TOKEN;
let bot;

// Inicialización del bot (o fallback a consola si no hay token)
if (token && token !== 'tu_token_aqui') {
    bot = new TelegramBot(token, { polling: true });
    console.log("✅ Bot de Telegram conectado exitosamente.");
} else {
    console.warn("⚠️ TELEGRAM_BOT_TOKEN no configurado en .env. Las alertas se mostrarán en la consola.");
    bot = {
        sendMessage: (chatId, text) => console.log(`\n🔔 [ALERTA TELEGRAM para ${chatId}]:\n${text}\n`)
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
        bot.sendMessage(chatId, "⚽ ¡Bienvenido jefe! Bot de Alertas iniciado.\nEstaré monitoreando partidos en vivo y te avisaré con sonido cuando se cumplan nuestras 4 reglas estratégicas.");
        console.log(`Usuario principal conectado: ${chatId}`);
    });
} else {
    // Si no hay bot real, simulamos un suscriptor
    subscribedChats.add("console_user");
}

// Caché de momios pre-partido.
// Como no cambian, los pedimos 1 vez por partido y los guardamos en memoria
// para no agotar el límite de peticiones de la API.
const oddsCache = new Map();

// Para el Seguimiento Post-Partido
// Mapea fixtureId -> Objeto con info básica del partido
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
        
        // 1. Obtener momios pre-partido (desde API o caché)
        if (!oddsCache.has(fixtureId)) {
            // Hacemos una pausa muy corta para no hacer spam masivo a la API de golpe si hay muchos partidos
            await new Promise(r => setTimeout(r, 200)); 
            
            const odds = await getPreMatchOdds(fixtureId);
            if (odds) {
                oddsCache.set(fixtureId, odds);
            } else {
                continue; // Si no hay momios disponibles, no podemos evaluar
            }
        }
        const matchOdds = oddsCache.get(fixtureId);

        // 2. Obtener eventos (solo es necesario si estamos antes del min 60 para checar tarjetas)
        let events = [];
        const elapsed = match.fixture.status.elapsed;
        // Solo pedimos eventos si el partido está en una ventana que nos interesa (Regla 1 usa eventos antes del min 60)
        if (elapsed > 0 && elapsed <= 65) {
             events = await getMatchEvents(fixtureId);
        }

        // 3. Obtener estadísticas para Regla 4 (Asedio) si aplica
        let stats = [];
        if (needsStats(match, matchOdds)) {
            stats = await getMatchStatistics(fixtureId);
        }

        // 4. Evaluar las reglas
        const alerts = evaluateRules(match, matchOdds, events, stats);

        // 5. Enviar alertas si las hay y trackear para Post-Partido
        if (alerts.length > 0) {
            trackedMatches.set(fixtureId, {
                home: match.teams.home.name,
                away: match.teams.away.name
            });
            for (const alert of alerts) {
                for (const chatId of subscribedChats) {
                    try {
                        await bot.sendMessage(chatId, alert);
                    } catch (e) {
                        console.error(`Error enviando mensaje al chat ${chatId}:`, e.message);
                    }
                }
            }
        }
    }
}

// Programar para que la revisión ocurra cada minuto
cron.schedule('* * * * *', async () => {
    await checkMatches();
    await checkFinishedMatches();
});

// Revisa si los partidos trackeados ya terminaron
async function checkFinishedMatches() {
    for (const [fixtureId, matchInfo] of trackedMatches.entries()) {
        const matchData = await getMatchById(fixtureId);
        if (matchData && (matchData.fixture.status.short === 'FT' || matchData.fixture.status.short === 'AET' || matchData.fixture.status.short === 'PEN')) {
            const homeGoals = matchData.goals.home;
            const awayGoals = matchData.goals.away;
            
            for (const chatId of subscribedChats) {
                try {
                    await bot.sendMessage(chatId, `🏁 *POST-PARTIDO*\nEl partido alertado ha terminado:\n${matchInfo.home} ${homeGoals} - ${awayGoals} ${matchInfo.away}`);
                } catch (e) {
                    console.error(`Error enviando post-partido al chat ${chatId}:`, e.message);
                }
            }
            // Ya no lo trackeamos
            trackedMatches.delete(fixtureId);
        }
    }
}

// Resumen Matutino todos los días a las 7:30 AM
cron.schedule('30 7 * * *', async () => {
    console.log("Ejecutando Resumen Matutino...");
    const today = new Date().toISOString().split('T')[0];
    const matches = await getMatchesByDate(today);
    
    const topFavorites = [];
    
    // Para proteger la cuota de la API, solo sacaremos momios de los primeros 20 partidos
    // (En un entorno real, filtrarías matches por id de liga primero).
    const matchesToCheck = matches.slice(0, 20); 

    for (const match of matchesToCheck) {
        const fixtureId = match.fixture.id;
        await new Promise(r => setTimeout(r, 200)); // Pausa para no hacer flood
        const odds = await getPreMatchOdds(fixtureId);
        if (odds) {
            const homeOdd = odds.home;
            const awayOdd = odds.away;
            const favOdd = homeOdd < awayOdd ? homeOdd : awayOdd;
            const favTeam = homeOdd < awayOdd ? match.teams.home.name : match.teams.away.name;
            const underdogTeam = homeOdd < awayOdd ? match.teams.away.name : match.teams.home.name;
            
            if (favOdd < 1.35) {
                topFavorites.push(`- ${favTeam} (${favOdd}) vs ${underdogTeam}`);
            }
        }
    }

    if (topFavorites.length > 0) {
        const msg = `☀️ *Resumen Matutino*\nAquí tienes los claros favoritos de hoy (Momio < 1.35):\n\n${topFavorites.join('\n')}`;
        for (const chatId of subscribedChats) {
            bot.sendMessage(chatId, msg).catch(e => console.error(e));
        }
    }
});

console.log("🟢 Sistema automatizado con Fase 2 en marcha. Esperando...");
// Hacemos una primera revisión inmediatamente al iniciar
checkMatches();
