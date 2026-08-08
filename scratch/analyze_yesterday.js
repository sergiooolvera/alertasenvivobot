const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'messages.html');
const content = fs.readFileSync(filePath, 'utf8');

// Match message divs including date title and text
const messageBlockRegex = /<div class="message[^"]*" id="message([^"]+)"[\s\S]*?<div class="pull_right date details" title="([^"]+)"[\s\S]*?<div class="text">([\s\S]*?)<\/div>/g;

let match;
const messages = [];

while ((match = messageBlockRegex.exec(content)) !== null) {
    const id = match[1];
    const dateTitle = match[2];
    let text = match[3].trim();
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/?[^>]+(>|$)/g, "");
    text = text.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    
    messages.push({ id, dateTitle, text });
}

console.log(`Total de mensajes procesados en HTML: ${messages.length}`);

// Filtrar por fecha 07.08.2026
const targetDate = '07.08.2026';
const yesterdayMessages = messages.filter(m => m.dateTitle.includes(targetDate));
console.log(`Mensajes del ${targetDate}: ${yesterdayMessages.length}`);

// También incluiremos veredictos de la madrugada del 08.08.2026 si corresponden a partidos del 07.08.2026
const targetDateNextDay = '08.08.2026';
const nextDayMessages = messages.filter(m => m.dateTitle.includes(targetDateNextDay));

const alertas = [];
const veredictos = [];
const parlays = [];

yesterdayMessages.forEach(msg => {
    const text = msg.text;
    if (text.includes('REGLA ') && (text.includes('ANÁLISIS DE IA') || text.includes('GOOGLE GEMINI') || text.includes('DEEPSEEK'))) {
        alertas.push(msg);
    } else if (text.includes('VEREDICTO POST-PARTIDO')) {
        veredictos.push(msg);
    } else if (text.includes('PARLAY DEL DÍA')) {
        parlays.push(msg);
    }
});

// Agregar veredictos que cayeron el 08.08.2026 en las primeras horas si hay algunos
nextDayMessages.forEach(msg => {
    const text = msg.text;
    if (text.includes('VEREDICTO POST-PARTIDO')) {
        veredictos.push(msg);
    }
});

console.log(`Alertas del 07.08.2026: ${alertas.length}`);
console.log(`Veredictos totales considerados (07 y madrugada 08): ${veredictos.length}`);
console.log(`Parlays del 07.08.2026: ${parlays.length}`);

function normalizarRegla(regla) {
    let normal = regla.replace(/^(?:🔥|⏳|🟥|🟨|🟢)\s*/i, '');
    normal = normal.replace(/^REGLA\s*\d+\s*:\s*/i, '');
    normal = normal.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    
    if (normal.includes('sorpresa')) return 'sorpresa';
    if (normal.includes('roja') || normal.includes('expulsion')) return 'roja';
    if (normal.includes('sufre')) return 'sufre';
    if (normal.includes('caliente') || normal.includes('tarjeta')) return 'caliente';
    if (normal.includes('remontada') || normal.includes('comeback')) return 'remontada';
    if (normal.includes('asedio') || normal.includes('goal') || normal.includes('gol')) return 'asedio';
    
    return normal.replace(/[^a-z0-9]/g, '');
}

function normalizarPartido(partido) {
    return partido
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+vs\s+/g, 'vs')
        .replace(/[^a-z0-9]/g, '');
}

const alertasProcesadas = [];
const alertasPorClave = {};

alertas.forEach(alerta => {
    const text = alerta.text;
    
    const reglaMatch = text.match(/(?:🔥|⏳|🟥|🟨|🟢)?\s*(REGLA\s*\d+:\s*[^━\n]+)/i) || text.match(/(REGLA\s*\d+:\s*[^━\n]+)/i);
    const reglaStr = reglaMatch ? reglaMatch[1].trim() : 'REGLA DESCONOCIDA';
    const reglaNorm = normalizarRegla(reglaStr);
    
    const lineas = text.split('\n');
    let partido = 'Desconocido';
    let liga = 'Desconocida';
    let minuto = '';
    let marcador = '';
    
    lineas.forEach(l => {
        if (l.includes('Liga:')) {
            liga = l.replace(/.*Liga:\s*/i, '').trim();
        }
        if (l.includes('vs')) {
            partido = l.replace(/⚽\s*/i, '').trim();
        }
        if (l.includes('Minuto:')) {
            minuto = l.replace(/.*Minuto:\s*/i, '').split('|')[0].trim();
        }
        if (l.includes('Marcador:')) {
            marcador = l.replace(/.*Marcador:\s*/i, '').trim();
        }
    });
    
    partido = partido.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1').replace(/[\[\]]/g, '').trim();
    if (partido === 'Desconocido') {
        const partidoMatch = text.match(/⚽\s*([^\n]+vs[^\n]+)/i);
        if (partidoMatch) {
            partido = partidoMatch[1].replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1').replace(/[\[\]]/g, '').trim();
        }
    }
    
    const geminiIndex = text.indexOf('GOOGLE GEMINI');
    const deepseekIndex = text.indexOf('DEEPSEEK');
    
    let geminiText = '';
    let deepseekText = '';
    
    if (geminiIndex !== -1 && deepseekIndex !== -1) {
        geminiText = text.substring(geminiIndex, deepseekIndex);
        deepseekText = text.substring(deepseekIndex);
    } else if (geminiIndex !== -1) {
        geminiText = text.substring(geminiIndex);
    } else if (deepseekIndex !== -1) {
        deepseekText = text.substring(deepseekIndex);
    }
    
    let geminiApuesta = 'No recomendada';
    let geminiConfianza = 0;
    if (geminiText) {
        const betMatch = geminiText.match(/🎯\s*Apuesta:\s*([^\n\(]+)/i) || geminiText.match(/Apuesta:\s*([^\n\(]+)/i);
        const confMatch = geminiText.match(/Confianza:\s*(\d+)%/i);
        if (betMatch) geminiApuesta = betMatch[1].trim();
        if (confMatch) geminiConfianza = parseInt(confMatch[1]);
    }
    
    let deepseekApuesta = 'No recomendada';
    let deepseekConfianza = 0;
    if (deepseekText) {
        const betMatch = deepseekText.match(/🎯\s*Apuesta:\s*([^\n\(]+)/i) || deepseekText.match(/Apuesta:\s*([^\n\(]+)/i);
        const confMatch = deepseekText.match(/Confianza:\s*(\d+)%/i);
        if (betMatch) deepseekApuesta = betMatch[1].trim();
        if (confMatch) deepseekConfianza = parseInt(confMatch[1]);
    }
    
    const geminiEvita = geminiApuesta.toLowerCase().includes('evitar') || geminiApuesta.toLowerCase().includes('no recomendada') || geminiConfianza < 40;
    const deepseekEvita = deepseekApuesta.toLowerCase().includes('evitar') || deepseekApuesta.toLowerCase().includes('no recomendada') || deepseekConfianza < 40;
    
    const partidoNorm = normalizarPartido(partido);
    const key = `${partidoNorm}_${reglaNorm}`;
    
    const alertaData = {
        id: alerta.id,
        dateTitle: alerta.dateTitle,
        partido,
        partidoNorm,
        liga,
        regla: reglaStr,
        reglaNorm,
        minuto,
        marcador,
        geminiApuesta,
        geminiConfianza,
        geminiRecomendoApuesta: !geminiEvita,
        deepseekApuesta,
        deepseekConfianza,
        deepseekRecomendoApuesta: !deepseekEvita,
        veredicto: null,
        veredictoDetalle: null
    };
    
    alertasPorClave[key] = alertaData;
    alertasProcesadas.push(alertaData);
});

// Emparejar veredictos
veredictos.forEach(v => {
    const text = v.text;
    
    let resultado = 'Desconocido';
    if (text.includes('GREEN')) {
        resultado = 'GREEN';
    } else if (text.includes('RED')) {
        resultado = 'RED';
    } else if (text.includes('APUESTA EVITADA')) {
        resultado = 'APUESTA EVITADA';
    }
    
    const lineas = text.split('\n');
    let partido = 'Desconocido';
    let reglaStr = 'Desconocida';
    let marcadorFinal = '';
    
    lineas.forEach(l => {
        if (l.includes('Regla:')) {
            reglaStr = l.replace(/.*Regla:\s*/i, '').trim();
        }
        if (l.includes('⚽')) {
            partido = l.replace(/⚽\s*/i, '').trim();
            const vsMatch = partido.match(/([^\d\-]+)\s*\d+\s*-\s*\d+\s*([^\d\-]+)/);
            if (vsMatch) {
                partido = `${vsMatch[1].trim()} vs ${vsMatch[2].trim()}`;
            }
        }
        if (l.includes('Resultado:')) {
            marcadorFinal = l.replace(/.*Resultado:\s*/i, '').trim();
        }
    });
    
    partido = partido.replace(/[\[\]]/g, '').trim();
    const partidoNorm = normalizarPartido(partido);
    const reglaNorm = normalizarRegla(reglaStr);
    let key = `${partidoNorm}_${reglaNorm}`;
    
    let alertaEncontrada = alertasPorClave[key];
    
    if (!alertaEncontrada) {
        const keys = Object.keys(alertasPorClave);
        const matchKey = keys.find(k => {
            const parts = k.split('_');
            const alertPart = parts[0];
            const alertRegla = parts[1];
            
            if (alertRegla === reglaNorm) {
                if (partidoNorm.includes(alertPart) || alertPart.includes(partidoNorm)) {
                    return true;
                }
                const eqVeredicto = partidoNorm.split('vs');
                const eqAlerta = alertPart.split('vs');
                if (eqVeredicto.length === 2 && eqAlerta.length === 2) {
                    const v1 = eqVeredicto[0];
                    const v2 = eqVeredicto[1];
                    const a1 = eqAlerta[0];
                    const a2 = eqAlerta[1];
                    if ((v1.includes(a1) || a1.includes(v1) || v1.substring(0, 5) === a1.substring(0, 5)) &&
                        (v2.includes(a2) || a2.includes(v2) || v2.substring(0, 5) === a2.substring(0, 5))) {
                        return true;
                    }
                }
            }
            return false;
        });
        
        if (matchKey) {
            alertaEncontrada = alertasPorClave[matchKey];
        }
    }
    
    if (alertaEncontrada && !alertaEncontrada.veredicto) {
        alertaEncontrada.veredicto = resultado;
        alertaEncontrada.veredictoDetalle = {
            id: v.id,
            dateTitle: v.dateTitle,
            marcadorFinal,
            rawText: text
        };
    }
});

// Generar resumen consolidado
console.log('\n=========================================');
console.log('--- RESUMEN DE MENSAJES DEL 07 DE AGOSTO DE 2026 ---');
console.log('=========================================\n');

let totalAlertas = alertasProcesadas.length;
let emparejadas = alertasProcesadas.filter(a => a.veredicto !== null);
let sinVeredicto = alertasProcesadas.filter(a => a.veredicto === null);

let greenCount = emparejadas.filter(a => a.veredicto === 'GREEN').length;
let redCount = emparejadas.filter(a => a.veredicto === 'RED').length;
let evitadaCount = emparejadas.filter(a => a.veredicto === 'APUESTA EVITADA').length;

console.log(`Alertas Totales Emitidas: ${totalAlertas}`);
console.log(`Alertas con Veredicto Registrado: ${emparejadas.length}`);
console.log(`  🟢 GREEN: ${greenCount} (${emparejadas.length ? ((greenCount/emparejadas.length)*100).toFixed(1) : 0}%)`);
console.log(`  🔴 RED: ${redCount} (${emparejadas.length ? ((redCount/emparejadas.length)*100).toFixed(1) : 0}%)`);
console.log(`  ⚪ EVITADA: ${evitadaCount} (${emparejadas.length ? ((evitadaCount/emparejadas.length)*100).toFixed(1) : 0}%)`);
console.log(`Alertas Sin Veredicto Encontrado en HTML: ${sinVeredicto.length}\n`);

// Análisis por IA
let gRecomendadas = emparejadas.filter(a => a.geminiRecomendoApuesta);
let gGreen = gRecomendadas.filter(a => a.veredicto === 'GREEN').length;
let gRed = gRecomendadas.filter(a => a.veredicto === 'RED').length;
let gEvitadas = emparejadas.filter(a => !a.geminiRecomendoApuesta).length;

let dRecomendadas = emparejadas.filter(a => a.deepseekRecomendoApuesta);
let dGreen = dRecomendadas.filter(a => a.veredicto === 'GREEN').length;
let dRed = dRecomendadas.filter(a => a.veredicto === 'RED').length;
let dEvitadas = emparejadas.filter(a => !a.deepseekRecomendoApuesta).length;

console.log('--- RENDIMIENTO DE IAs (Sobre Alertas con Veredicto) ---');
console.log('Google Gemini:');
console.log(`  - Apuestas Recomendadas: ${gRecomendadas.length}`);
console.log(`  - GREEN: ${gGreen} (${gRecomendadas.length ? ((gGreen/gRecomendadas.length)*100).toFixed(1) : 0}%)`);
console.log(`  - RED: ${gRed} (${gRecomendadas.length ? ((gRed/gRecomendadas.length)*100).toFixed(1) : 0}%)`);
console.log(`  - Alertas Evitadas/No recomendadas: ${gEvitadas}`);

console.log('DeepSeek:');
console.log(`  - Apuestas Recomendadas: ${dRecomendadas.length}`);
console.log(`  - GREEN: ${dGreen} (${dRecomendadas.length ? ((dGreen/dRecomendadas.length)*100).toFixed(1) : 0}%)`);
console.log(`  - RED: ${dRed} (${dRecomendadas.length ? ((dRed/dRecomendadas.length)*100).toFixed(1) : 0}%)`);
console.log(`  - Alertas Evitadas/No recomendadas: ${dEvitadas}\n`);

// Desglose por Regla
console.log('--- DESGLOSE POR REGLA ---');
const porRegla = {};
alertasProcesadas.forEach(a => {
    const r = a.regla;
    if (!porRegla[r]) porRegla[r] = { total: 0, green: 0, red: 0, evitada: 0, sinVeredicto: 0 };
    porRegla[r].total++;
    if (a.veredicto === 'GREEN') porRegla[r].green++;
    else if (a.veredicto === 'RED') porRegla[r].red++;
    else if (a.veredicto === 'APUESTA EVITADA') porRegla[r].evitada++;
    else porRegla[r].sinVeredicto++;
});

Object.keys(porRegla).forEach(r => {
    const stats = porRegla[r];
    console.log(`${r}: ${stats.total} alertas | GREEN: ${stats.green}, RED: ${stats.red}, EVITADA: ${stats.evitada}, Sin veredicto: ${stats.sinVeredicto}`);
});

if (sinVeredicto.length > 0) {
    console.log('\n--- ALERTAS SIN VEREDICTO EN EL HTML (07.08.2026) ---');
    sinVeredicto.forEach(a => {
        console.log(`- [${a.regla}] ${a.partido} (${a.liga}) | Min: ${a.minuto}, Marcador: ${a.marcador}`);
        console.log(`  Gemini (${a.geminiConfianza}%): ${a.geminiApuesta}`);
        console.log(`  DeepSeek (${a.deepseekConfianza}%): ${a.deepseekApuesta}`);
    });
}

if (parlays.length > 0) {
    console.log('\n--- PARLAYS DEL DÍA (07.08.2026) ---');
    parlays.forEach(p => {
        console.log(`\n[Parlay ID: ${p.id} (${p.dateTitle})]\n${p.text}`);
    });
}

// Guardar los datos JSON para uso posterior
fs.writeFileSync(path.join(__dirname, 'yesterday_analysis.json'), JSON.stringify({
    totalAlertas,
    emparejadasCount: emparejadas.length,
    sinVeredictoCount: sinVeredicto.length,
    greenCount,
    redCount,
    evitadaCount,
    alertasProcesadas,
    parlays
}, null, 2));
