const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'messages.html');
const content = fs.readFileSync(filePath, 'utf8');
const messageBlocks = content.split(/<div class="message /);

let currentDate = 'Desconocida';
const rawMessages = [];

messageBlocks.forEach((block, idx) => {
    if (idx === 0) return;
    if (block.startsWith('service')) {
        const dateMatch = block.match(/<div class="body details">\s*([^<]+)\s*<\/div>/);
        if (dateMatch) currentDate = dateMatch[1].trim();
        return;
    }
    const idMatch = block.match(/id="message(\d+)"/);
    const id = idMatch ? idMatch[1] : `block_${idx}`;
    const titleDateMatch = block.match(/title="(\d{2}\.\d{2}\.\d{4}|\d{2}\.\d{4}\.\d{4})\s+(\d{2}:\d{2}:\d{2})/);
    let fullDate = currentDate;
    let timeStr = '';
    if (titleDateMatch) {
        fullDate = titleDateMatch[1];
        timeStr = titleDateMatch[2];
    }
    const textMatch = block.match(/<div class="text">([\s\S]*?)<\/div>/);
    if (!textMatch) return;
    let text = textMatch[1].trim()
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?[^>]+(>|$)/g, '')
        .replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    rawMessages.push({ id, date: fullDate, time: timeStr, text });
});

function cleanMarkdownLinks(str) {
    if (!str) return '';
    return str.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1').replace(/[\[\]]/g, '').trim();
}

function normalizarTexto(str) {
    if (!str) return '';
    return cleanMarkdownLinks(str)
        .replace(/flashscore/gi, '')
        .replace(/%20/g, ' ')
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

function normalizarPartido(str) {
    if (!str) return '';
    const clean = cleanMarkdownLinks(str)
        .replace(/flashscore/gi, '')
        .replace(/%20/g, ' ')
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+vs\s+/g, 'vs')
        .replace(/[^a-z0-9vs]/g, '');
    return clean;
}

function normalizarNombreRegla(regla) {
    let r = (regla || '').toUpperCase();
    if (r.includes('REGLA 1') || r.includes('TARJETA ROJA') || r.includes('ROJA ESTRATÉGICA')) return 'Regla 1: Tarjeta Roja Estratégica';
    if (r.includes('REGLA 4') || r.includes('ASEDIO INTENSO') || r.includes('HUELE A GOL') || r.includes('LATE GOAL')) return 'Regla 4: Asedio Intenso (Huele a Gol)';
    if (r.includes('REGLA 5') || r.includes('REMONTADA POTENCIAL')) return 'Regla 5: Remontada Potencial al Descanso';
    if (r.includes('REGLA 6') || r.includes('CÓRNERES') || r.includes('CORNERES') || r.includes('PRESION DE CORNERES')) return 'Regla 6: Presión de Córneres';
    if (r.includes('REGLA 7') || r.includes('PARTIDO CALIENTE') || r.includes('TARJETAS')) return 'Regla 7: Partido Caliente (Tarjetas)';
    if (r.includes('REGLA 8') || r.includes('FAVORITO DOMINA HT')) return 'Regla 8: Favorito Domina HT';
    if (r.includes('REGLA 9') || r.includes('GOL INMINENTE GLOBAL')) return 'Regla 9: Gol Inminente Global';
    if (r.includes('REGLA 3') || r.includes('SORPRESA TEMPRANERA')) return 'Regla 3: Sorpresa Tempranera';
    if (r.includes('BÉISBOL') || r.includes('BEISBOL')) return 'Béisbol Live';
    return r.trim() || 'Otras Reglas';
}

// 1. Extraer Veredictos
const veredictos = [];
const alerts = [];

rawMessages.forEach(msg => {
    const text = msg.text;
    if (text.includes('VEREDICTO POST-PARTIDO') || text.includes('VEREDICTO:')) {
        let generalOutcome = 'DESCONOCIDO';
        if (text.includes('GREEN') || text.includes('🟩')) generalOutcome = 'GREEN';
        else if (text.includes('RED') || text.includes('🟥')) generalOutcome = 'RED';
        else if (text.includes('APUESTA EVITADA') || text.includes('EVITADA')) generalOutcome = 'APUESTA EVITADA';
        else if (text.includes('VOID') || text.includes('ANULADA')) generalOutcome = 'VOID';

        let partido = 'Desconocido';
        let marcadorFinal = '';
        let reglaRaw = '';
        let detalle = '';
        let geminiOutcome = null;
        let deepseekOutcome = null;
        let geminiBet = '';
        let deepseekBet = '';
        let geminiDetalle = '';
        let deepseekDetalle = '';

        const lines = text.split('\n');
        lines.forEach(l => {
            if (l.includes('Regla:')) reglaRaw = l.replace(/.*Regla:\s*/i, '').trim();
            if (l.includes('⚽') || l.includes('⚾')) {
                const matchLine = l.replace(/[⚽⚾]\s*/g, '').trim();
                const m = matchLine.match(/([^\d\-]+)\s+(\d+\s*-\s*\d+)\s+([^\d\-]+)/);
                if (m) {
                    partido = `${m[1].trim()} vs ${m[3].trim()}`;
                    marcadorFinal = m[2].trim();
                } else {
                    partido = matchLine;
                }
            }
            if (l.includes('Resultado:')) {
                detalle = l.replace(/.*Resultado:\s*/i, '').trim();
            }
        });

        // Parse GEMINI section
        const geminiIdx = text.indexOf('GEMINI');
        const deepseekIdx = text.indexOf('DEEPSEEK');

        if (geminiIdx !== -1) {
            const geminiSub = (deepseekIdx > geminiIdx) ? text.substring(geminiIdx, deepseekIdx) : text.substring(geminiIdx);
            if (geminiSub.includes('GREEN') || geminiSub.includes('🟩')) geminiOutcome = 'GREEN';
            else if (geminiSub.includes('RED') || geminiSub.includes('🟥')) geminiOutcome = 'RED';
            else if (geminiSub.includes('EVITADA')) geminiOutcome = 'APUESTA EVITADA';
            else if (geminiSub.includes('VOID')) geminiOutcome = 'VOID';
            
            const b = geminiSub.match(/Apuesta:\s*([^\n]+)/i);
            if (b) geminiBet = b[1].trim();
            const res = geminiSub.match(/Resultado:\s*([^\n]+)/i);
            if (res) geminiDetalle = res[1].trim();
        }

        if (deepseekIdx !== -1) {
            const deepseekSub = text.substring(deepseekIdx);
            if (deepseekSub.includes('GREEN') || deepseekSub.includes('🟩')) deepseekOutcome = 'GREEN';
            else if (deepseekSub.includes('RED') || deepseekSub.includes('🟥')) deepseekOutcome = 'RED';
            else if (deepseekSub.includes('EVITADA')) deepseekOutcome = 'APUESTA EVITADA';
            else if (deepseekSub.includes('VOID')) deepseekOutcome = 'VOID';

            const b = deepseekSub.match(/Apuesta:\s*([^\n]+)/i);
            if (b) deepseekBet = b[1].trim();
            const res = deepseekSub.match(/Resultado:\s*([^\n]+)/i);
            if (res) deepseekDetalle = res[1].trim();
        }

        // Si no fue dual explícito pero tiene generalOutcome
        if (!geminiOutcome && !deepseekOutcome) {
            if (text.includes('DEEPSEEK')) deepseekOutcome = generalOutcome;
            else if (text.includes('GEMINI')) geminiOutcome = generalOutcome;
            else {
                geminiOutcome = generalOutcome;
                deepseekOutcome = generalOutcome;
            }
        }

        veredictos.push({
            id: msg.id,
            date: msg.date,
            time: msg.time,
            partido,
            marcadorFinal,
            partidoNorm: normalizarPartido(partido),
            reglaRaw,
            reglaNombre: normalizarNombreRegla(reglaRaw),
            generalOutcome,
            geminiOutcome,
            deepseekOutcome,
            geminiBet,
            deepseekBet,
            geminiDetalle,
            deepseekDetalle,
            detalle,
            rawText: text,
            matchedAlertId: null
        });
    } else if (text.includes('REGLA') || text.includes('ANÁLISIS DE IA') || text.includes('GEMINI') || text.includes('DEEPSEEK') || text.includes('BÉISBOL')) {
        alerts.push(msg);
    }
});

console.log(`Veredictos encontrados: ${veredictos.length}`);
console.log(`Alertas encontradas: ${alerts.length}`);

// Guardar muestra para verificar
fs.writeFileSync('scratch/parsed_veredictos_sample.json', JSON.stringify(veredictos.slice(0, 10), null, 2));
