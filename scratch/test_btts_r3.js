const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'processed_data.json'), 'utf8'));

const webResultsMap = {
    "montanavsnesebar_Regla 3: Sorpresa Tempranera": { veredicto: "GREEN" },
    "rodinamoskvavsrubin_Regla 3: Sorpresa Tempranera": { veredicto: "RED" },
    "dinamomakhachkalavskryliasovetov_Regla 3: Sorpresa Tempranera": { veredicto: "RED" },
    "sydkystenvsishj_Regla 3: Sorpresa Tempranera": { veredicto: "GREEN" },
    "brnshjvshbkoge_Regla 3: Sorpresa Tempranera": { veredicto: "APUESTA EVITADA" },
    "hapoelbeershevavsfkcrvenazvezda_Regla 3: Sorpresa Tempranera": { veredicto: "RED" },
    "costaricau20vshaitiu20_Regla 3: Sorpresa Tempranera": { veredicto: "RED" },
    "unitedstatesu20vsguatemalau20_Regla 3: Sorpresa Tempranera": { veredicto: "GREEN" },
    "oddervsskive_Regla 3: Sorpresa Tempranera": { veredicto: "GREEN" },
    "kgewvsrigaw_Regla 3: Sorpresa Tempranera": { veredicto: "GREEN" },
    "brannvsapollonlimassol_Regla 3: Sorpresa Tempranera": { veredicto: "APUESTA EVITADA" },
    "stabku19vsfredrikstadfku19_Regla 3: Sorpresa Tempranera": { veredicto: "RED" },
    "rostovu19vszenitu19_Regla 3: Sorpresa Tempranera": { veredicto: "RED" },
    "mirassolu20vsitapirenseu20_Regla 3: Sorpresa Tempranera": { veredicto: "GREEN" },
    "santosu20vssaobentou20_Regla 3: Sorpresa Tempranera": { veredicto: "GREEN" },
    "operarioprvssaobernardo_Regla 3: Sorpresa Tempranera": { veredicto: "RED" },
    "transnarvavskaljunomme_Regla 3: Sorpresa Tempranera": { veredicto: "GREEN" },
    "nommeunitediivsfcilevadiaii_Regla 3: Sorpresa Tempranera": { veredicto: "RED" },
    "mamelodisundownsvspolokwanecity_Regla 3: Sorpresa Tempranera": { veredicto: "GREEN" },
    "fasvsatleticobalboa_Regla 3: Sorpresa Tempranera": { veredicto: "RED" },
    "transinvestvilniusvspanevezys_Regla 3: Sorpresa Tempranera": { veredicto: "RED" },
    "athleticclubmgu20vscoimbrau20_Regla 3: Sorpresa Tempranera": { veredicto: "GREEN" },
    "jongpsvu21vsfcvolendam_Regla 3: Sorpresa Tempranera": { veredicto: "RED" }
};

function cleanMarkdownLinks(str) {
    if (!str) return '';
    return str.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1').replace(/[\[\]]/g, '').trim();
}

function normalizarPartido(partido) {
    const clean = cleanMarkdownLinks(partido);
    return clean.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+vs\s+/g, 'vs').replace(/[^a-z0-9]/g, '');
}

data.forEach(a => {
    a.partidoClean = cleanMarkdownLinks(a.partido);
    a.partidoNorm = normalizarPartido(a.partidoClean);
    if (!a.veredicto) {
        const key = `${a.partidoNorm}_Regla 3: Sorpresa Tempranera`;
        const ext = webResultsMap[key];
        if (ext) a.veredicto = ext.veredicto;
    }
    a.minNum = parseInt(a.minuto) || 0;
});

const r3Eval = data.filter(d => (d.reglaNombre.includes('Regla 3') || d.reglaRaw.includes('Sorpresa') || d.reglaRaw.includes('REGLA 3')) && (d.veredicto === 'GREEN' || d.veredicto === 'RED'));

function evalRange(minMin, maxMin, confThreshold, label) {
    const subset = r3Eval.filter(d => {
        const minOk = d.minNum >= minMin && d.minNum <= maxMin;
        const confOk = d.geminiConf >= confThreshold || d.deepseekConf >= confThreshold;
        return minOk && confOk;
    });

    const g = subset.filter(d => d.veredicto === 'GREEN').length;
    const r = subset.filter(d => d.veredicto === 'RED').length;
    const wr = (g + r) > 0 ? ((g / (g + r)) * 100).toFixed(1) : '0.0';
    console.log(`[${label}] Alertas: ${subset.length} | GREEN: ${g} | RED: ${r} | Win Rate: ${wr}%`);
}

console.log('--- EVALUACION DE RANGOS DE MINUTO & CONFIANZA === 65% ---');
evalRange(20, 45, 65, 'Minuto >= 20\' + Confianza >= 65%');
evalRange(25, 45, 65, 'Minuto >= 25\' + Confianza >= 65%');
evalRange(30, 45, 65, 'Minuto >= 30\' + Confianza >= 65%');
evalRange(15, 45, 65, 'Minuto >= 15\' + Confianza >= 65%');
