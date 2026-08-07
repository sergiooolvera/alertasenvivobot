require('dotenv').config();
const botModule = require('node-telegram-bot-api');
const TelegramBot = botModule.default || botModule;

async function testPromptSending() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const promptChatId = process.env.TELEGRAM_PROMPTS_CHAT_ID;

    console.log("=== Probando Envío de Prompts a Telegram ===");
    console.log(`Bot Token: ${token ? 'Configurado' : 'NO Configurado'}`);
    console.log(`Prompts Chat ID: ${promptChatId ? promptChatId : 'NO Configurado'}`);

    let testBot;
    if (token && token !== 'tu_token_aqui') {
        testBot = new TelegramBot(token, { polling: false });
        console.log("Instancia de TelegramBot real creada.");
    } else {
        console.log("Usando bot simulado.");
        testBot = {
            sendDocument: (chatId, doc, options, fileOptions) => {
                console.log(`\n[Simulación] Enviando documento a ${chatId}: ${fileOptions.filename}`);
                console.log(`[Simulación] Contenido del buffer (primeros 150 caracteres):\n${doc.toString('utf-8').substring(0, 150)}...`);
                return Promise.resolve({ message_id: 12345 });
            }
        };
    }

    const testPrompt = `Este es un prompt de prueba generado para auditar la integración.
Información del Partido: Real Madrid vs Barcelona
Regla Activada: TARJETA ROJA ESTRATÉGICA
Configuración:
- Confianza mínima: 80%
- Momio sugerido: 1.60

Análisis esperado de IA:
1. Las estadísticas históricas indican alta probabilidad de tarjetas en el segundo tiempo.
2. El árbitro principal promedia 5.2 tarjetas por partido.
Fin del prompt de prueba.`;

    const matchClean = "Real_Madrid_vs_Barcelona";
    const filename = `prompt_gemini_test_${matchClean}.txt`;

    // Si no hay un chat ID real, simulamos o usamos el del usuario principal si lo conocemos
    const targetChat = promptChatId || "console_user";

    try {
        console.log(`Enviando prompt a chat: ${targetChat}...`);
        const res = await testBot.sendDocument(targetChat, Buffer.from(testPrompt, 'utf-8'), {
            caption: `🤖 *Prompt Gemini de Prueba* - Real Madrid vs Barcelona\n📋 *Regla:* TARJETA ROJA ESTRATÉGICA`
        }, {
            filename: filename,
            contentType: 'text/plain'
        });
        console.log("✅ ¡Envío completado de forma exitosa!", res ? `Msg ID: ${res.message_id || res.messageId}` : "");
    } catch (err) {
        console.error("❌ Fallo al enviar el documento a Telegram:", err.message);
    }
}

testPromptSending();
