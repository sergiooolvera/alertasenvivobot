require('dotenv').config();
const botModule = require('node-telegram-bot-api');
const TelegramBot = botModule.default || botModule;

const token = process.env.TELEGRAM_BOT_TOKEN;
const MY_CHAT_ID = 890184744;

if (!token) {
    console.error("Error: TELEGRAM_BOT_TOKEN no configurado");
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: false });

async function run() {
    try {
        console.log("Consultando información del Bot...");
        const me = await bot.getMe();
        console.log(`🤖 Bot Username: @${me.username}`);
        console.log(`🤖 Bot Name: ${me.first_name}`);
        
        console.log(`\nConsultando información del Chat ID ${MY_CHAT_ID}...`);
        const chat = await bot.getChat(MY_CHAT_ID);
        console.log(`👤 Chat Type: ${chat.type}`);
        console.log(`👤 First Name: ${chat.first_name || 'N/A'}`);
        console.log(`👤 Last Name: ${chat.last_name || 'N/A'}`);
        console.log(`👤 Username: @${chat.username || 'N/A'}`);
        console.log(`👤 Title (si es grupo/canal): ${chat.title || 'N/A'}`);
    } catch (e) {
        console.error("❌ Error en la consulta de Telegram:", e.message);
    }
}

run();
