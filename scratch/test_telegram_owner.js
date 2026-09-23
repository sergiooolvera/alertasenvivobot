require('dotenv').config();
const botModule = require('node-telegram-bot-api');
const TelegramBot = botModule.default || botModule;

const token = process.env.TELEGRAM_BOT_TOKEN;
const ownerChatId = process.env.TELEGRAM_OWNER_CHAT_ID || 890184744;

console.log(`Probando envío de Telegram al Chat ID: ${ownerChatId}`);

if (!token) {
  console.error("Error: TELEGRAM_BOT_TOKEN no definido.");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: false });

bot.sendMessage(ownerChatId, "🔔 *Prueba de Conexión de Alertas en Vivo*\n\nSi ves este mensaje, el bot de Telegram está correctamente configurado para enviar notificaciones a este Chat ID.", { parse_mode: 'Markdown' })
  .then((res) => {
    console.log("✅ Mensaje enviado exitosamente. Message ID:", res.message_id);
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Error al enviar mensaje por Telegram:", err.message);
    process.exit(1);
  });
