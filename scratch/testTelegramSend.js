require('dotenv').config();
const botModule = require('node-telegram-bot-api');
const TelegramBot = botModule.default || botModule;

const token = process.env.TELEGRAM_BOT_TOKEN;
const MY_CHAT_ID = 890184744;
const PROMPTS_CHAT_ID = process.env.TELEGRAM_PROMPTS_CHAT_ID;

if (!token) {
    console.error("Error: TELEGRAM_BOT_TOKEN no configurado en .env");
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: false });

async function run() {
    console.log(`Intentando enviar mensaje de prueba a tu chat privado (${MY_CHAT_ID})...`);
    try {
        await bot.sendMessage(MY_CHAT_ID, "🔔 *Prueba del Bot de Alertas*\nEl canal de comunicación privada está activo. ¡Mensaje recibido con éxito!", { parse_mode: 'Markdown' });
        console.log("✅ Mensaje enviado exitosamente a tu chat privado.");
    } catch (e) {
        console.error("❌ Error al enviar mensaje al chat privado:", e.message);
    }

    if (PROMPTS_CHAT_ID) {
        console.log(`Intentando enviar mensaje al canal de auditoría (${PROMPTS_CHAT_ID})...`);
        try {
            await bot.sendMessage(PROMPTS_CHAT_ID, "📋 *Prueba del Bot de Alertas - Auditoría*\nCanal de auditoría activo.", { parse_mode: 'Markdown' });
            console.log("✅ Mensaje enviado exitosamente al canal de auditoría.");
        } catch (e) {
            console.error("❌ Error al enviar mensaje al canal de auditoría:", e.message);
        }
    } else {
        console.log("⚠️ TELEGRAM_PROMPTS_CHAT_ID no configurado en el archivo local .env");
    }
}

run();
