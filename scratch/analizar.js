const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'messages.html');
const content = fs.readFileSync(filePath, 'utf8');

const messageRegex = /<div class="message[^"]*" id="message([^"]+)"[\s\S]*?<div class="text">([\s\S]*?)<\/div>/g;
let match;
const messages = [];

while ((match = messageRegex.exec(content)) !== null) {
    const id = match[1];
    let text = match[2].trim();
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/?[^>]+(>|$)/g, "");
    text = text.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    messages.push({ id, text });
}

console.log(`Total de mensajes extraídos: ${messages.length}`);

const alertas = [];
const veredictos = [];
const parlays = [];

messages.forEach(msg => {
    const text = msg.text;
    if (text.includes('REGLA ') && (text.includes('ANÁLISIS DE IA') || text.includes('GOOGLE GEMINI') || text.includes('DEEPSEEK'))) {
        alertas.push(msg);
    } else if (text.includes('VEREDICTO POST-PARTIDO')) {
        veredictos.push(msg);
    } else if (text.includes('PARLAY DEL DÍA')) {
        parlays.push(msg);
    }
});

console.log(`Alertas encontradas: ${alertas.length}`);
console.log(`Veredictos encontrados: ${veredictos.length}`);

// Función para normalizar nombres de reglas con equivalencias
function normalizarRegla(regla) {
    let normal = regla.replace(/^(?:🔥|⏳|🟥|🟨|🟢)\s*/i, '');
    normal = normal.replace(/^REGLA\s*\d+\s*:\s*/i, '');
    normal = normal.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    
    // Mapeo de equivalencias
    if (normal.includes('sorpresa')) return 'sorpresa';
    if (normal.includes('roja') || normal.includes('expulsion')) return 'roja';
    if (normal.includes('sufre')) return 'sufre';
    if (normal.includes('caliente') || normal.includes('tarjeta')) return 'caliente';
    if (normal.includes('remontada') || normal.includes('comeback')) return 'remontada';
    if (normal.includes('asedio') || normal.includes('goal') || normal.includes('gol')) return 'asedio';
    
    return normal.replace(/[^a-z0-9]/g, '');
}

// Función para normalizar nombres de partidos/equipos
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
    
    // Extraer Regla
    const reglaMatch = text.match(/(?:🔥|⏳|🟥|🟨|🟢)?\s*(REGLA\s*\d+:\s*[^━\n]+)/i) || text.match(/(REGLA\s*\d+:\s*[^━\n]+)/i);
    const reglaStr = reglaMatch ? reglaMatch[1].trim() : 'REGLA DESCONOCIDA';
    const reglaNorm = normalizarRegla(reglaStr);
    
    // Extraer partido
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
    
    // Limpiar partido de corchetes y links markdown: [Team A](link) vs [Team B](link)
    partido = partido.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1').replace(/[\[\]]/g, '').trim();
    
    if (partido === 'Desconocido') {
        const partidoMatch = text.match(/⚽\s*([^\n]+vs[^\n]+)/i);
        if (partidoMatch) {
            partido = partidoMatch[1].replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1').replace(/[\[\]]/g, '').trim();
        }
    }
    
    // Separar secciones de IA para evitar interferencias
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
    
    // Parsear Google Gemini
    let geminiApuesta = 'No recomendada';
    let geminiConfianza = 0;
    if (geminiText) {
        const betMatch = geminiText.match(/🎯\s*Apuesta:\s*([^\n\(]+)/i) || geminiText.match(/Apuesta:\s*([^\n\(]+)/i);
        const confMatch = geminiText.match(/Confianza:\s*(\d+)%/i);
        if (betMatch) geminiApuesta = betMatch[1].trim();
        if (confMatch) geminiConfianza = parseInt(confMatch[1]);
    }
    
    // Parsear DeepSeek
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

// Procesar Veredictos
let totalGreen = 0;
let totalRed = 0;
let totalEvitada = 0;
const veredictosProcesados = [];

veredictos.forEach(v => {
    const text = v.text;
    
    let resultado = 'Desconocido';
    if (text.includes('GREEN')) {
        resultado = 'GREEN';
        totalGreen++;
    } else if (text.includes('RED')) {
        resultado = 'RED';
        totalRed++;
    } else if (text.includes('APUESTA EVITADA')) {
        resultado = 'APUESTA EVITADA';
        totalEvitada++;
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
            // A veces el partido contiene el marcador final, como: "Independiente Petrolero 1 - 1 Aurora"
            // Limpiemos el marcador final
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
        // Búsqueda difusa si no coincide la clave exacta
        const keys = Object.keys(alertasPorClave);
        const matchKey = keys.find(k => {
            const parts = k.split('_');
            const alertPart = parts[0];
            const alertRegla = parts[1];
            
            if (alertRegla === reglaNorm) {
                // Si el partido veredicto contiene el de la alerta o viceversa
                if (partidoNorm.includes(alertPart) || alertPart.includes(partidoNorm)) {
                    return true;
                }
                
                // O si los nombres de equipos contienen coincidencias
                const eqVeredicto = partidoNorm.split('vs');
                const eqAlerta = alertPart.split('vs');
                if (eqVeredicto.length === 2 && eqAlerta.length === 2) {
                    const v1 = eqVeredicto[0];
                    const v2 = eqVeredicto[1];
                    const a1 = eqAlerta[0];
                    const a2 = eqAlerta[1];
                    // Si el primer equipo de la alerta coincide parcialmente con el del veredicto, y el segundo también
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
            key = matchKey;
        }
    }
    
    if (alertaEncontrada) {
        alertaEncontrada.veredicto = resultado;
        alertaEncontrada.veredictoDetalle = marcadorFinal;
    }
    
    veredictosProcesados.push({
        partido,
        partidoNorm,
        regla: reglaStr,
        reglaNorm,
        resultado,
        marcadorFinal,
        alertaKey: alertaEncontrada ? key : null
    });
});

// Guardar reporte en un archivo
let outputReport = '';
const log = (msg) => {
    console.log(msg);
    outputReport += msg + '\n';
};

log("\n--- RESULTADOS GLOBALES DEL BOT ---");
log(`Veredictos Totales: ${veredictosProcesados.length}`);
log(`🟢 GREEN (Aciertos): ${totalGreen} (${((totalGreen/veredictosProcesados.length)*100).toFixed(1)}%)`);
log(`🔴 RED (Fallos): ${totalRed} (${((totalRed/veredictosProcesados.length)*100).toFixed(1)}%)`);
log(`⚪ APUESTA EVITADA: ${totalEvitada} (${((totalEvitada/veredictosProcesados.length)*100).toFixed(1)}%)`);

// Efectividad de las IAs
let geminiRecomendadas = 0;
let geminiRecomendadasAciertos = 0;
let geminiRecomendadasFallos = 0;
let geminiEvitadas = 0;

let deepseekRecomendadas = 0;
let deepseekRecomendadasAciertos = 0;
let deepseekRecomendadasFallos = 0;
let deepseekEvitadas = 0;

let alertasConVeredicto = 0;

alertasProcesadas.forEach(alerta => {
    if (alerta.veredicto) {
        alertasConVeredicto++;
        const esAcierto = alerta.veredicto === 'GREEN';
        const esFallo = alerta.veredicto === 'RED';
        const esEvitada = alerta.veredicto === 'APUESTA EVITADA';
        
        // Google Gemini
        if (alerta.geminiRecomendoApuesta) {
            if (!esEvitada) { // Si el bot la operó
                geminiRecomendadas++;
                if (esAcierto) geminiRecomendadasAciertos++;
                if (esFallo) geminiRecomendadasFallos++;
            }
        } else {
            geminiEvitadas++;
        }
        
        // DeepSeek
        if (alerta.deepseekRecomendoApuesta) {
            if (!esEvitada) {
                deepseekRecomendadas++;
                if (esAcierto) deepseekRecomendadasAciertos++;
                if (esFallo) deepseekRecomendadasFallos++;
            }
        } else {
            deepseekEvitadas++;
        }
    }
});

log(`\n--- EFECTIVIDAD POR IA (Basado en ${alertasConVeredicto} alertas emparejadas con veredicto) ---`);
log(`Google Gemini:`);
log(`  - Apuestas Recomendadas (Operadas): ${geminiRecomendadas}`);
log(`  - Aciertos (GREEN): ${geminiRecomendadasAciertos} (${geminiRecomendadas > 0 ? ((geminiRecomendadasAciertos/geminiRecomendadas)*100).toFixed(1) : 0}%)`);
log(`  - Fallos (RED): ${geminiRecomendadasFallos} (${geminiRecomendadas > 0 ? ((geminiRecomendadasFallos/geminiRecomendadas)*100).toFixed(1) : 0}%)`);
log(`  - Alertas que recomendó EVITAR en total: ${geminiEvitadas}`);

log(`DeepSeek:`);
log(`  - Apuestas Recomendadas (Operadas): ${deepseekRecomendadas}`);
log(`  - Aciertos (GREEN): ${deepseekRecomendadasAciertos} (${deepseekRecomendadas > 0 ? ((deepseekRecomendadasAciertos/deepseekRecomendadas)*100).toFixed(1) : 0}%)`);
log(`  - Fallos (RED): ${deepseekRecomendadasFallos} (${deepseekRecomendadas > 0 ? ((deepseekRecomendadasFallos/deepseekRecomendadas)*100).toFixed(1) : 0}%)`);
log(`  - Alertas que recomendó EVITAR en total: ${deepseekEvitadas}`);

// Recuento de alertas por regla y recomendaciones
const reglaResumen = {};
alertasProcesadas.forEach(a => {
    if (!reglaResumen[a.regla]) {
        reglaResumen[a.regla] = { total: 0, geminiRecomendo: 0, deepseekRecomendo: 0 };
    }
    reglaResumen[a.regla].total++;
    if (a.geminiRecomendoApuesta) reglaResumen[a.regla].geminiRecomendo++;
    if (a.deepseekRecomendoApuesta) reglaResumen[a.regla].deepseekRecomendo++;
});

log(`\n--- ALERTAS POR REGLA Y RECOMENDACIONES ---`);
for (const r in reglaResumen) {
    log(`${r}: ${reglaResumen[r].total} alertas`);
    log(`  - Gemini recomendó entrar en: ${reglaResumen[r].geminiRecomendo} (Evitó: ${reglaResumen[r].total - reglaResumen[r].geminiRecomendo})`);
    log(`  - DeepSeek recomendó entrar en: ${reglaResumen[r].deepseekRecomendo} (Evitó: ${reglaResumen[r].total - reglaResumen[r].deepseekRecomendo})`);
}

// Alertas sin veredicto
const sinVeredicto = alertasProcesadas.filter(a => !a.veredicto);
log(`\n--- ALERTAS SIN VEREDICTO EN EL HTML (${sinVeredicto.length}) ---`);
sinVeredicto.forEach(alerta => {
    log(`- [${alerta.regla}] ${alerta.partido} (Minuto ${alerta.minuto}, Marcador ${alerta.marcador})`);
    log(`  Gemini: ${alerta.geminiApuesta} (${alerta.geminiConfianza}%) - Recomienda entrar: ${alerta.geminiRecomendoApuesta ? 'SÍ' : 'NO'}`);
    log(`  DeepSeek: ${alerta.deepseekApuesta} (${alerta.deepseekConfianza}%) - Recomienda entrar: ${alerta.deepseekRecomendoApuesta ? 'SÍ' : 'NO'}`);
});

// Veredictos no emparejados
const veredictosNoEmp = veredictosProcesados.filter(v => !v.alertaKey);
log(`\n--- VEREDICTOS SIN ALERTA EMPAREJADA EN EL HTML (${veredictosNoEmp.length}) ---`);
veredictosNoEmp.forEach(v => {
    log(`- [${v.resultado}] [${v.regla}] ${v.partido} (${v.marcadorFinal})`);
});

fs.writeFileSync(path.join(__dirname, 'informe_analisis.txt'), outputReport, 'utf8');
console.log("\n✅ Informe guardado exitosamente en scratch/informe_analisis.txt");

