const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'processed_data.json'), 'utf8'));

// Also load updated web results
const webResultsMap = {
    "montanavsnesebar_Regla 3: Sorpresa Tempranera": { veredicto: "GREEN", geminiVeredicto: "GREEN", deepseekVeredicto: "GREEN" },
    "rodinamoskvavsrubin_Regla 3: Sorpresa Tempranera": { veredicto: "RED", geminiVeredicto: "RED", deepseekVeredicto: "RED" },
    "dinamomakhachkalavskryliasovetov_Regla 3: Sorpresa Tempranera": { veredicto: "RED", geminiVeredicto: "RED", deepseekVeredicto: "RED" },
    "sydkystenvsishj_Regla 3: Sorpresa Tempranera": { veredicto: "GREEN", geminiVeredicto: "GREEN", deepseekVeredicto: "GREEN" },
    "brnshjvshbkoge_Regla 3: Sorpresa Tempranera": { veredicto: "APUESTA EVITADA", geminiVeredicto: "APUESTA EVITADA", deepseekVeredicto: "RED" },
    "hapoelbeershevavsfkcrvenazvezda_Regla 3: Sorpresa Tempranera": { veredicto: "RED", geminiVeredicto: "RED", deepseekVeredicto: "RED" },
    "costaricau20vshaitiu20_Regla 3: Sorpresa Tempranera": { veredicto: "RED", geminiVeredicto: "RED", deepseekVeredicto: "GREEN" },
    "unitedstatesu20vsguatemalau20_Regla 3: Sorpresa Tempranera": { veredicto: "GREEN", geminiVeredicto: "GREEN", deepseekVeredicto: "GREEN" },

    "oddervsskive_Regla 3: Sorpresa Tempranera": { veredicto: "GREEN", geminiVeredicto: "GREEN", deepseekVeredicto: "GREEN" },
    "kgewvsrigaw_Regla 3: Sorpresa Tempranera": { veredicto: "GREEN", geminiVeredicto: "GREEN", deepseekVeredicto: "GREEN" },
    "brannvsapollonlimassol_Regla 3: Sorpresa Tempranera": { veredicto: "APUESTA EVITADA", geminiVeredicto: "APUESTA EVITADA", deepseekVeredicto: "RED" },

    "stabku19vsfredrikstadfku19_Regla 3: Sorpresa Tempranera": { veredicto: "RED", geminiVeredicto: "RED", deepseekVeredicto: "RED" },

    "rostovu19vszenitu19_Regla 3: Sorpresa Tempranera": { veredicto: "RED", geminiVeredicto: "RED", deepseekVeredicto: "RED" },
    "mirassolu20vsitapirenseu20_Regla 3: Sorpresa Tempranera": { veredicto: "GREEN", geminiVeredicto: "GREEN", deepseekVeredicto: "GREEN" },
    "santosu20vssaobentou20_Regla 3: Sorpresa Tempranera": { veredicto: "GREEN", geminiVeredicto: "GREEN", deepseekVeredicto: "GREEN" },
    "operarioprvssaobernardo_Regla 3: Sorpresa Tempranera": { veredicto: "RED", geminiVeredicto: "RED", deepseekVeredicto: "GREEN" },

    "transnarvavskaljunomme_Regla 3: Sorpresa Tempranera": { veredicto: "GREEN", geminiVeredicto: "GREEN", deepseekVeredicto: "GREEN" },
    "nommeunitediivsfcilevadiaii_Regla 3: Sorpresa Tempranera": { veredicto: "RED", geminiVeredicto: "RED", deepseekVeredicto: "GREEN" },
    "mamelodisundownsvspolokwanecity_Regla 3: Sorpresa Tempranera": { veredicto: "GREEN", geminiVeredicto: "GREEN", deepseekVeredicto: "GREEN" },

    "fasvsatleticobalboa_Regla 3: Sorpresa Tempranera": { veredicto: "RED", geminiVeredicto: "RED", deepseekVeredicto: "RED" },

    "transinvestvilniusvspanevezys_Regla 3: Sorpresa Tempranera": { veredicto: "RED", geminiVeredicto: "RED", deepseekVeredicto: "RED" },
    "athleticclubmgu20vscoimbrau20_Regla 3: Sorpresa Tempranera": { veredicto: "GREEN", geminiVeredicto: "GREEN", deepseekVeredicto: "GREEN" },
    "jongpsvu21vsfcvolendam_Regla 3: Sorpresa Tempranera": { veredicto: "RED", geminiVeredicto: "RED", deepseekVeredicto: "GREEN" }
};

function cleanMarkdownLinks(str) {
    if (!str) return '';
    return str.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1').replace(/[\[\]]/g, '').trim();
}

function normalizarPartido(partido) {
    const clean = cleanMarkdownLinks(partido);
    return clean.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+vs\s+/g, 'vs').replace(/[^a-z0-9]/g, '');
}

function categorizarTextoApuesta(str) {
    if (!str || str === 'N/A') return 'Otros Mercados';
    const s = str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    if (s.includes('evitar') || s.includes('no recomendada')) return 'Apuesta Evitada / Descartada';
    if (s.includes('ambos anotan') || s.includes('ambos marcan') || s.includes('btts')) return 'Ambos Anotan (BTTS)';
    if (s.includes('over 2.5') || s.includes('mas de 2.5') || s.includes('> 2.5') || s.includes('+2.5') || s.includes('over 3.5') || s.includes('mas de 3.5') || s.includes('over 1.5') || s.includes('mas de 1.5') || s.includes('goles totales') || s.includes('linea de goles') || (s.includes('over') && !s.includes('tarjeta') && !s.includes('corner'))) return 'Línea de Goles (Over/Under)';
    if (s.includes('proximo gol') || s.includes('siguiente gol') || s.includes('primer gol') || s.includes('gol de')) return 'Próximo Gol / Gol en Vivo';
    if (s.includes('doble oportunidad') || s.includes('empate o') || s.includes('1x') || s.includes('x2') || s.includes('12')) return 'Doble Oportunidad (1X / X2)';
    if (s.includes('victoria') || s.includes('gana') || s.includes('ml') || s.includes('resultado final') || s.includes('ganador') || s.includes('apuesta sin empate') || s.includes('dnb') || s.includes('handicap')) return 'Victoria Directa (1X2 / ML)';
    if (s.includes('tarjeta') || s.includes('tarjetas')) return 'Tarjetas Totales';
    if (s.includes('corner') || s.includes('corners')) return 'Córneres Totales';

    return 'Otros Mercados';
}

// Inject veredictos
data.forEach(a => {
    a.partidoClean = cleanMarkdownLinks(a.partido);
    a.partidoNorm = normalizarPartido(a.partidoClean);
    if (!a.veredicto) {
        const key = `${a.partidoNorm}_Regla 3: Sorpresa Tempranera`;
        const ext = webResultsMap[key];
        if (ext) {
            a.veredicto = ext.veredicto;
        }
    }
});

const r3All = data.filter(d => d.reglaNombre.includes('Regla 3') || d.reglaRaw.includes('Sorpresa') || d.reglaRaw.includes('REGLA 3'));

console.log(`Total Regla 3 encontradas: ${r3All.length}`);

const r3Eval = r3All.filter(d => d.veredicto === 'GREEN' || d.veredicto === 'RED');

console.log(`Regla 3 Evaluadas (GREEN/RED): ${r3Eval.length} (${r3Eval.filter(d => d.veredicto === 'GREEN').length} GREEN / ${r3Eval.filter(d => d.veredicto === 'RED').length} RED)\n`);

r3Eval.forEach(item => {
    item.geminiCat = categorizarTextoApuesta(item.geminiBet);
    item.deepseekCat = categorizarTextoApuesta(item.deepseekBet);
    item.minNum = parseInt(item.minuto) || 0;
});

function printSub(subset, label) {
    const g = subset.filter(d => d.veredicto === 'GREEN').length;
    const r = subset.filter(d => d.veredicto === 'RED').length;
    const wr = (g + r) > 0 ? ((g / (g + r)) * 100).toFixed(1) : '0.0';
    console.log(`[${label}] Total: ${subset.length} | GREEN: ${g} | RED: ${r} | Win Rate: ${wr}%`);
}

// 1. By Gemini Market Category
console.log('--- 1. GEMINI MARKET CATEGORIES IN REGLA 3 ---');
const gCats = [...new Set(r3Eval.map(d => d.geminiCat))];
gCats.forEach(c => printSub(r3Eval.filter(d => d.geminiCat === c), c));

// 2. By DeepSeek Market Category
console.log('\n--- 2. DEEPSEEK MARKET CATEGORIES IN REGLA 3 ---');
const dCats = [...new Set(r3Eval.map(d => d.deepseekCat))];
dCats.forEach(c => printSub(r3Eval.filter(d => d.deepseekCat === c), c));

// 3. By Minute Range
console.log('\n--- 3. POR MINUTO EN REGLA 3 ---');
printSub(r3Eval.filter(d => d.minNum <= 10), 'Minuto 1\' - 10\'');
printSub(r3Eval.filter(d => d.minNum > 10 && d.minNum <= 25), 'Minuto 11\' - 25\'');
printSub(r3Eval.filter(d => d.minNum > 25), 'Minuto 26\' - 45\'');

// 4. Detailed audit of REDs
console.log('\n--- AUDITORIA DE REDS EN REGLA 3 ---');
const reds = r3Eval.filter(d => d.veredicto === 'RED');
reds.forEach((r, i) => {
    console.log(`[RED ${i+1}] Date: ${r.date} | Min: ${r.minuto} | Score: ${r.marcador} | ${r.partidoClean} (${r.liga})`);
    console.log(`        Gemini: "${r.geminiBet}" (${r.geminiConf}%) [${r.geminiCat}]`);
    console.log(`        DeepSeek: "${r.deepseekBet}" (${r.deepseekConf}%) [${r.deepseekCat}]`);
});
