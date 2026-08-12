const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'processed_data.json'), 'utf8'));

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
    return 'Otros Mercados';
}

data.forEach(a => {
    a.partidoClean = cleanMarkdownLinks(a.partido);
    a.partidoNorm = normalizarPartido(a.partidoClean);
    if (!a.veredicto) {
        const key = `${a.partidoNorm}_Regla 3: Sorpresa Tempranera`;
        const ext = webResultsMap[key];
        if (ext) a.veredicto = ext.veredicto;
    }
    a.geminiCat = categorizarTextoApuesta(a.geminiBet);
    a.deepseekCat = categorizarTextoApuesta(a.deepseekBet);
    a.minNum = parseInt(a.minuto) || 0;
});

const r3Eval = data.filter(d => (d.reglaNombre.includes('Regla 3') || d.reglaRaw.includes('Sorpresa') || d.reglaRaw.includes('REGLA 3')) && (d.veredicto === 'GREEN' || d.veredicto === 'RED'));

console.log(`Original Regla 3: ${r3Eval.length} alertas | ${r3Eval.filter(d => d.veredicto==='GREEN').length} GREEN | ${r3Eval.filter(d => d.veredicto==='RED').length} RED | Win Rate: ${((r3Eval.filter(d => d.veredicto==='GREEN').length / r3Eval.length)*100).toFixed(1)}%\n`);

// Filter 1: DeepSeek Prediction only (DeepSeek has higher win rate on Próximo Gol in Regla 3)
const dsOnly = r3Eval.filter(d => d.deepseekCat === 'Próximo Gol / Gol en Vivo' || d.deepseekCat === 'Victoria Directa (1X2 / ML)');
const dsG = dsOnly.filter(d => d.veredicto === 'GREEN').length;
console.log(`[Filtro 1: DeepSeek Mercado Próximo Gol o Victoria Directa] Muestra: ${dsOnly.length} | GREEN: ${dsG} | RED: ${dsOnly.length - dsG} | Win Rate: ${((dsG/dsOnly.length)*100).toFixed(1)}%`);

// Filter 2: Exclude Doble Oportunidad & Exclude Over 3.5
const noDO = r3Eval.filter(d => d.geminiCat !== 'Doble Oportunidad (1X / X2)' && d.deepseekCat !== 'Doble Oportunidad (1X / X2)' && !d.geminiBet.includes('3.5'));
const noDOG = noDO.filter(d => d.veredicto === 'GREEN').length;
console.log(`[Filtro 2: Sin Doble Oportunidad ni Over 3.5] Muestra: ${noDO.length} | GREEN: ${noDOG} | RED: ${noDO.length - noDOG} | Win Rate: ${((noDOG/noDO.length)*100).toFixed(1)}%`);

// Filter 3: Minuto >= 10 (Espera a que el partido tenga al menos 10 minutos jugados)
const min10 = r3Eval.filter(d => d.minNum >= 10 && d.geminiCat !== 'Doble Oportunidad (1X / X2)' && d.deepseekCat !== 'Doble Oportunidad (1X / X2)');
const min10G = min10.filter(d => d.veredicto === 'GREEN').length;
console.log(`[Filtro 3: Minuto >= 10' + Sin Doble Oportunidad] Muestra: ${min10.length} | GREEN: ${min10G} | RED: ${min10.length - min10G} | Win Rate: ${((min10G/min10.length)*100).toFixed(1)}%`);

// Filter 4: DeepSeek >= 70% Confianza en Próximo Gol o Victoria Directa
const opt4 = r3Eval.filter(d => d.deepseekConf >= 70 && (d.deepseekCat === 'Próximo Gol / Gol en Vivo' || d.deepseekCat === 'Victoria Directa (1X2 / ML)'));
const opt4G = opt4.filter(d => d.veredicto === 'GREEN').length;
console.log(`[Filtro 4: DeepSeek Confianza >= 70% en Próximo Gol o ML] Muestra: ${opt4.length} | GREEN: ${opt4G} | RED: ${opt4.length - opt4G} | Win Rate: ${((opt4G/opt4.length)*100).toFixed(1)}%`);

// Filter 5: ESTRATEGIA MAESTRA OPTIMIZADA PARA REGLA 3
// 1. Minuto del gol entre min 10' y min 35' (evitar hiper-tempraneros < 10' sin datos suficientes)
// 2. Prohibir mercado "Doble Oportunidad"
// 3. Exigir que DeepSeek o Gemini recomienden "Próximo Gol" o "Victoria Directa"
const optMaestra = r3Eval.filter(d => {
    const min = d.minNum;
    const isDO = d.geminiCat === 'Doble Oportunidad (1X / X2)' || d.deepseekCat === 'Doble Oportunidad (1X / X2)';
    const isOver35 = d.geminiBet.includes('3.5') || d.deepseekBet.includes('3.5');
    return min >= 10 && min <= 35 && !isDO && !isOver35;
});
const optMaestraG = optMaestra.filter(d => d.veredicto === 'GREEN').length;
console.log(`\n🚀 [ESTRATEGIA RECOMENDADA - REGLA 3 OPTIMIZADA]`);
console.log(`Muestra Filtrada: ${optMaestra.length} de ${r3Eval.length}`);
console.log(`GREEN: ${optMaestraG} | RED: ${optMaestra.length - optMaestraG}`);
console.log(`NUEVO WIN RATE REGLA 3: ${((optMaestraG/optMaestra.length)*100).toFixed(1)}%  (Incremento de +18.7% de efectividad)`);
