const data = require('./yesterday_analysis.json');
console.log('--- DETALLE DE LAS 22 ALERTAS DEL 07 DE AGOSTO DE 2026 ---');
data.alertasProcesadas.forEach((a, i) => {
    console.log(`\n${i+1}. [VEREDICTO: ${a.veredicto || 'SIN VEREDICTO'}] ${a.regla}`);
    console.log(`   Partido: ${a.partido} (${a.liga}) | Minuto: ${a.minuto} | Marcador Alerta: ${a.marcador}`);
    console.log(`   Google Gemini (${a.geminiConfianza}%): ${a.geminiApuesta} | Operar: ${a.geminiRecomendoApuesta ? 'SÍ' : 'NO'}`);
    console.log(`   DeepSeek (${a.deepseekConfianza}%): ${a.deepseekApuesta} | Operar: ${a.deepseekRecomendoApuesta ? 'SÍ' : 'NO'}`);
    if (a.veredictoDetalle) {
        console.log(`   Resultado Final: ${a.veredictoDetalle.marcadorFinal}`);
    }
});
