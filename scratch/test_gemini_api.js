require('dotenv').config();
const axios = require('axios');

const keys = process.env.GEMINI_API_KEYS.split(',').map(k => k.trim());
const models = ['gemini-1.5-flash', 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-latest'];

async function test() {
    console.log(`Claves cargadas: ${keys.length}`);
    for (let kIdx = 0; kIdx < keys.length; kIdx++) {
        const key = keys[kIdx];
        const maskedKey = key.substring(0, 8) + '...' + key.substring(key.length - 4);
        console.log(`\n--- Probando Clave #${kIdx + 1} (${maskedKey}) con Google Search Grounding ---`);
        
        for (const model of models) {
            const correctUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
            
            try {
                const res = await axios.post(correctUrl, {
                    contents: [{ parts: [{ text: "Busca en internet cuál fue el resultado del partido de fútbol entre Bolívar y Flamengo jugado en agosto de 2024 (o recientemente)." }] }],
                    tools: [{ google_search: {} }]
                }, { timeout: 15000 });
                
                const text = res.data.candidates[0].content.parts[0].text;
                console.log(`  Model '${model}': SUCCESS! Response text preview: "${text.substring(0, 150)}..."`);
                if (res.data.candidates[0].groundingMetadata) {
                    console.log(`    -> Grounding metadata present! Source: ${JSON.stringify(res.data.candidates[0].groundingMetadata.webSearchQueries)}`);
                }
            } catch (err) {
                const status = err.response ? err.response.status : 'NO_STATUS';
                const message = err.response && err.response.data && err.response.data.error ? err.response.data.error.message : err.message;
                console.log(`  Model '${model}': FAILED (Status: ${status}) -> Error: ${message}`);
            }
            // Pequeño retardo entre peticiones para evitar rate limit de 15 RPM
            await new Promise(r => setTimeout(r, 2000));
        }
    }
}

test();
