const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'processed_data.json'), 'utf8'));

// Filter evaluated alerts
const evaluated = data.filter(d => d.veredicto === 'GREEN' || d.veredicto === 'RED');

console.log(`Total apuestas evaluadas (GREEN + RED): ${evaluated.length}`);
const greenCount = data.filter(d => d.veredicto === 'GREEN').length;
const redCount = data.filter(d => d.veredicto === 'RED').length;

// Check odds in alerts
let oddsCount = 0;
let sumOdds = 0;

evaluated.forEach(item => {
    let odd = 1.65; // default suggested entry odd if not specified
    if (item.momios) {
        const m = item.momios.match(/@(\d+\.\d+)/) || item.momios.match(/(\d+\.\d+)/);
        if (m) {
            const parsedOdd = parseFloat(m[1]);
            if (parsedOdd > 1.1 && parsedOdd < 5.0) {
                odd = parsedOdd;
            }
        }
    }
    item.odds = odd;
    sumOdds += odd;
    oddsCount++;
});

const avgOdd = sumOdds / oddsCount;
console.log(`Momio promedio detectado: @${avgOdd.toFixed(2)}`);

// Financial Simulation @ $100 pesos per bet
function runSim(stakePerBet, oddToUse = null) {
    let totalStaked = 0;
    let totalReturned = 0;
    
    evaluated.forEach(item => {
        const odd = oddToUse || item.odds;
        totalStaked += stakePerBet;
        if (item.veredicto === 'GREEN') {
            totalReturned += (stakePerBet * odd);
        }
    });

    const netProfit = totalReturned - totalStaked;
    const roi = (netProfit / totalStaked) * 100;
    return { totalStaked, totalReturned, netProfit, roi };
}

console.log('\n--- ESCENARIO 1: Momio promedio sugerido (@1.65) ---');
const sim165 = runSim(100, 1.65);
console.log(`Inversión total: $${sim165.totalStaked} MXN`);
console.log(`Retorno total: $${sim165.totalReturned.toFixed(2)} MXN`);
console.log(`Ganancia Neta: $${sim165.netProfit.toFixed(2)} MXN`);
console.log(`ROI: ${sim165.roi.toFixed(2)}%`);

console.log('\n--- ESCENARIO 2: Momio promedio conservador (@1.70) ---');
const sim170 = runSim(100, 1.70);
console.log(`Inversión total: $${sim170.totalStaked} MXN`);
console.log(`Retorno total: $${sim170.totalReturned.toFixed(2)} MXN`);
console.log(`Ganancia Neta: $${sim170.netProfit.toFixed(2)} MXN`);
console.log(`ROI: ${sim170.roi.toFixed(2)}%`);

console.log('\n--- ESCENARIO 3: Momio promedio óptimo (@1.80) ---');
const sim180 = runSim(100, 1.80);
console.log(`Inversión total: $${sim180.totalStaked} MXN`);
console.log(`Retorno total: $${sim180.totalReturned.toFixed(2)} MXN`);
console.log(`Ganancia Neta: $${sim180.netProfit.toFixed(2)} MXN`);
console.log(`ROI: ${sim180.roi.toFixed(2)}%`);

// Gemini-only simulation
const geminiEvaluated = data.filter(d => d.geminiRecommend && (d.veredicto === 'GREEN' || d.veredicto === 'RED'));
function runGeminiSim(stakePerBet, oddToUse = 1.65) {
    let totalStaked = 0;
    let totalReturned = 0;
    geminiEvaluated.forEach(item => {
        totalStaked += stakePerBet;
        if (item.veredicto === 'GREEN') totalReturned += (stakePerBet * oddToUse);
    });
    return { totalStaked, totalReturned, netProfit: totalReturned - totalStaked, roi: ((totalReturned - totalStaked)/totalStaked)*100 };
}
console.log('\n--- GEMINI SOLO (@1.65) ---');
const gemSim = runGeminiSim(100, 1.65);
console.log(`Apuestas: ${geminiEvaluated.length} | Invertido: $${gemSim.totalStaked} | Ganancia: $${gemSim.netProfit.toFixed(2)} | ROI: ${gemSim.roi.toFixed(2)}%`);

// DeepSeek-only simulation
const deepseekEvaluated = data.filter(d => d.deepseekRecommend && (d.veredicto === 'GREEN' || d.veredicto === 'RED'));
function runDeepseekSim(stakePerBet, oddToUse = 1.65) {
    let totalStaked = 0;
    let totalReturned = 0;
    deepseekEvaluated.forEach(item => {
        totalStaked += stakePerBet;
        if (item.veredicto === 'GREEN') totalReturned += (stakePerBet * oddToUse);
    });
    return { totalStaked, totalReturned, netProfit: totalReturned - totalStaked, roi: ((totalReturned - totalStaked)/totalStaked)*100 };
}
console.log('\n--- DEEPSEEK SOLO (@1.65) ---');
const dsSim = runDeepseekSim(100, 1.65);
console.log(`Apuestas: ${deepseekEvaluated.length} | Invertido: $${dsSim.totalStaked} | Ganancia: $${dsSim.netProfit.toFixed(2)} | ROI: ${dsSim.roi.toFixed(2)}%`);

// Consensus simulation (Both recommend)
const consensusEvaluated = data.filter(d => d.geminiRecommend && d.deepseekRecommend && (d.veredicto === 'GREEN' || d.veredicto === 'RED'));
function runConsensusSim(stakePerBet, oddToUse = 1.65) {
    let totalStaked = 0;
    let totalReturned = 0;
    consensusEvaluated.forEach(item => {
        totalStaked += stakePerBet;
        if (item.veredicto === 'GREEN') totalReturned += (stakePerBet * oddToUse);
    });
    return { totalStaked, totalReturned, netProfit: totalReturned - totalStaked, roi: ((totalReturned - totalStaked)/totalStaked)*100 };
}
console.log('\n--- CONSENSO DUAL (GEMINI + DEEPSEEK) (@1.65) ---');
const consSim = runConsensusSim(100, 1.65);
console.log(`Apuestas: ${consensusEvaluated.length} | Invertido: $${consSim.totalStaked} | Ganancia: $${consSim.netProfit.toFixed(2)} | ROI: ${consSim.roi.toFixed(2)}%`);
