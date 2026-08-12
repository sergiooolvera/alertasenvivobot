const daysSampled = 7;
const monthDays = 30;
const factor = monthDays / daysSampled; // 4.2857

const bets7Days = 84;
const betsMonth = Math.round(bets7Days * factor); // 360 apuestas

console.log(`Apuestas estimadas al mes (30 días): ${betsMonth}`);

function calcMonth(stake, odd) {
    const green7Days = 56;
    const red7Days = 28;
    
    const profit7Days = (green7Days * stake * odd) - (bets7Days * stake);
    const profitMonth = profit7Days * factor;
    const unitsMonth = profitMonth / stake;
    const stakedMonth = betsMonth * stake;
    const roi = (profitMonth / stakedMonth) * 100;
    
    return { stake, odd, profit7Days, profitMonth, unitsMonth, stakedMonth, roi };
}

console.log('--- STAKE $100 MXN ---');
console.log('Momio @1.65:', calcMonth(100, 1.65));
console.log('Momio @1.70:', calcMonth(100, 1.70));
console.log('Momio @1.80:', calcMonth(100, 1.80));

console.log('\n--- STAKE $300 MXN (Captura) ---');
console.log('Momio @1.65:', calcMonth(300, 1.65));
console.log('Momio @1.70:', calcMonth(300, 1.70));
console.log('Momio @1.80:', calcMonth(300, 1.80));

console.log('\n--- STAKE $500 MXN ---');
console.log('Momio @1.65:', calcMonth(500, 1.65));
console.log('Momio @1.70:', calcMonth(500, 1.70));
console.log('Momio @1.80:', calcMonth(500, 1.80));
