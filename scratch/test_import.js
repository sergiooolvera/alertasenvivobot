const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'messages.html');
console.log('Ruta del HTML de prueba:', htmlPath);

if (!fs.existsSync(htmlPath)) {
    console.error('No existe el archivo messages.html en la raíz del proyecto.');
    process.exit(1);
}

try {
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const msgBlocks = htmlContent.split('<div class="message default');
    msgBlocks.shift();

    console.log(`Total bloques detectados tras split: ${msgBlocks.length}`);

    const alerts = [];
    const parlays = [];

    msgBlocks.forEach((block, index) => {
        const titleMatch = block.match(/class="pull_right date details" title="([^"]+)"/);
        if (!titleMatch) return;
        
        const fullDateStr = titleMatch[1]; 
        const parts = fullDateStr.split(' ');
        const dateParts = parts[0].split('.'); 
        const formattedDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`; 
        const formattedTime = parts[1].substring(0, 5); 

        const textStartIndex = block.indexOf('<div class="text">');
        if (textStartIndex === -1) return;
        
        let textContent = block.substring(textStartIndex + 18);
        const textEndIndex = textContent.indexOf('</div>');
        if (textEndIndex === -1) return;
        textContent = textContent.substring(0, textEndIndex).trim();

        const cleanText = textContent
            .replace(/&apos;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/<br>/g, '\n')
            .replace(/<[^>]+>/g, ''); 

        if (cleanText.includes('REGLA ')) {
            const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);
            
            let ruleName = '';
            let league = 'Desconocida';
            let home = '';
            let away = '';
            let initialScore = '0-0';
            
            const ruleLine = lines.find(l => l.includes('REGLA'));
            if (ruleLine) ruleName = ruleLine.replace(/[^a-zA-Z0-9\s:]/g, '').trim();

            const leagueLine = lines.find(l => l.includes('Liga:'));
            if (leagueLine) league = leagueLine.replace('Liga:', '').trim();

            const vsLine = lines.find(l => l.includes(' vs '));
            if (vsLine) {
                const teams = vsLine.split(' vs ');
                home = teams[0].replace(/\[|\]|\([^\)]+\)/g, '').trim();
                away = teams[1].replace(/\[|\]|\([^\)]+\)/g, '').trim();
            }

            const scoreLine = lines.find(l => l.includes('Marcador:'));
            if (scoreLine) {
                const match = scoreLine.match(/Marcador:\s*(\d+\s*-\s*\d+)/);
                if (match) initialScore = match[1].replace(/\s/g, '');
            }

            // Recomendación Gemini
            let geminiRec = 'N/D';
            let geminiConf = 80;
            const geminiIndex = cleanText.indexOf('GOOGLE GEMINI');
            if (geminiIndex !== -1) {
                const geminiBlock = cleanText.substring(geminiIndex);
                const recMatch = geminiBlock.match(/Apuesta:\s*([^\(]+)/);
                const confMatch = geminiBlock.match(/Confianza:\s*(\d+)%/);
                if (recMatch) geminiRec = recMatch[1].trim();
                if (confMatch) geminiConf = parseInt(confMatch[1]);
            }

            // Recomendación DeepSeek
            let deepseekRec = 'N/D';
            let deepseekConf = 80;
            const dsIndex = cleanText.indexOf('DEEPSEEK');
            if (dsIndex !== -1) {
                const dsBlock = cleanText.substring(dsIndex);
                const recMatch = dsBlock.match(/Apuesta:\s*([^\(]+)/);
                const confMatch = dsBlock.match(/Confianza:\s*(\d+)%/);
                if (recMatch) deepseekRec = recMatch[1].trim();
                if (confMatch) deepseekConf = parseInt(confMatch[1]);
            }

            const isOmitted = geminiRec.toLowerCase().includes('evitar') || geminiRec.toLowerCase().includes('no recomendada');

            alerts.push({
                date: formattedDate,
                time: formattedTime,
                home,
                away,
                league,
                ruleName,
                initialScore,
                geminiRec,
                geminiConf,
                deepseekRec,
                deepseekConf,
                isOmitted
            });
        } else if (cleanText.includes('PARLAY DEL DÍA DE LA IA')) {
            parlays.push({
                date: formattedDate,
                time: formattedTime,
                text: cleanText.substring(0, 100) + '...'
            });
        }
    });

    console.log(`Alertas parseadas: ${alerts.length}`);
    console.log(`Parlays parseados: ${parlays.length}`);
    if (alerts.length > 0) {
        console.log('Ejemplo de alerta:', alerts[0]);
    }
} catch (e) {
    console.error('Error durante la prueba:', e.message);
}
