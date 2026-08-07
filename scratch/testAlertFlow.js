require('dotenv').config();
const botModule = require('node-telegram-bot-api');
const TelegramBot = botModule.default || botModule;

const token = process.env.TELEGRAM_BOT_TOKEN;
const MI_CHAT_ID = 890184744;

if (!token) {
    console.error("Error: TELEGRAM_BOT_TOKEN no configurado.");
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: false });
const subscribedChats = new Set([MI_CHAT_ID]);

async function simulateImmediateSend() {
    console.log("=== SIMULANDO ENVÍO INMEDIATO DE ALERTA DE FÚTBOL ===");
    
    // 1. Mensaje de prueba simulando la salida de la IA
    const header = `🟥 *REGLA 1: TARJETA ROJA ESTRATÉGICA*
━━━━━━━━━━━━━━━━━━━━━━━━━━
🏆 *Liga:* Leagues Cup
⚽ *Monterrey* vs *Orlando City SC*
⏱️ *Minuto:* 52'  |  📊 *Marcador:* 0 - 1
💵 *Momios Iniciales:* 🏠 2.42  •  🤝 3.8  •  🚀 2.54
🔍 *Flashscore:* [Buscar Partido](https://google.com)`;

    const formattedAiSection = `🤖 *ANÁLISIS DE IA - DUAL*
━━━━━━━━━━━━━━━━━━━━━━━━━━
♊ *GOOGLE GEMINI*
🧠 *Análisis:* Monterrey ha recibido una tarjeta roja y va perdiendo 0-1. Orlando City tiene superioridad numérica y mantendrá la ventaja.
🎯 *Apuesta:* *Victoria de Orlando City (resultado final)* (Confianza: *90%*)
━━━━━━━━━━━━━━━━━━━━━━━━━━
🐳 *DEEPSEEK*
🧠 *Análisis:* El escenario favorece al equipo visitante tras la expulsión en Monterrey.
🎯 *Apuesta:* *Doble Oportunidad Orlando City o Empate* (Confianza: *85%*)
━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 *Momio Sugerido de Entrada:* *@1.60*`;

    const textToSend = `${header}\n\n${formattedAiSection}`;

    console.log("Intentando enviar alerta de prueba a subscribedChats...");
    for (const chatId of subscribedChats) {
        try {
            console.log(`Enviando a ${chatId} con Markdown...`);
            await bot.sendMessage(chatId, textToSend, { parse_mode: 'Markdown' });
            console.log(`✅ Alerta enviada exitosamente a ${chatId}.`);
        } catch (e) {
            console.error(`❌ Error enviando alerta al chat ${chatId}:`, e.message);
            
            // Probar el reintento de fallback en texto plano si falla por parseo
            if (e.message.includes('parse') || e.message.includes('Markdown')) {
                console.log(`[Fallback] Reintentando envío en texto plano para el chat ${chatId}...`);
                try {
                    await bot.sendMessage(chatId, textToSend);
                    console.log(`✅ [Fallback] Alerta enviada en texto plano a ${chatId}.`);
                } catch (e2) {
                    console.error(`❌ [Fallback] Error en reintento de envío al chat ${chatId}:`, e2.message);
                }
            }
        }
    }
}

simulateImmediateSend();
