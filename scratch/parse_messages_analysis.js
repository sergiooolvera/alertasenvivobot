const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'messages.html');
const content = fs.readFileSync(filePath, 'utf8');

// Parse HTML blocks
// Telegram export structures:
// <div class="message service" id="message-1"><div class="body details">4 August 2026</div></div>
// <div class="message default clearfix" id="message19840">... <div class="pull_right date details" title="04.08.2026 08:56:15 UTC-06:00">08:56</div> ... <div class="text">...</div>

const messageBlocks = content.split(/<div class="message /);

console.log(`Total blocks: ${messageBlocks.length}`);

let currentDate = 'Desconocida';
const alertList = [];
const veredictoList = [];
const rawMessages = [];

messageBlocks.forEach((block, idx) => {
    if (idx === 0) return;
    
    // Check if it's service date
    if (block.startsWith('service')) {
        const dateMatch = block.match(/<div class="body details">\s*([^<]+)\s*<\/div>/);
        if (dateMatch) {
            currentDate = dateMatch[1].trim();
        }
        return;
    }

    // Check message id
    const idMatch = block.match(/id="message(\d+)"/);
    const id = idMatch ? idMatch[1] : `block_${idx}`;

    // Check date title e.g. title="04.08.2026 08:56:15 UTC-06:00"
    const titleDateMatch = block.match(/title="(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2}:\d{2})/);
    let fullDate = currentDate;
    let timeStr = '';
    if (titleDateMatch) {
        fullDate = titleDateMatch[1]; // DD.MM.YYYY
        timeStr = titleDateMatch[2];
    }

    // Extract text
    const textMatch = block.match(/<div class="text">([\s\S]*?)<\/div>/);
    if (!textMatch) return;

    let text = textMatch[1].trim();
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/?[^>]+(>|$)/g, '');
    text = text.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

    rawMessages.push({ id, date: fullDate, time: timeStr, text });
});

console.log(`Parsed raw messages: ${rawMessages.length}`);
const datesFound = [...new Set(rawMessages.map(m => m.date))];
console.log(`Dates found:`, datesFound);

// Let's filter alerts and veredictos
rawMessages.forEach(msg => {
    const text = msg.text;
    if (text.includes('REGLA') || text.includes('ANÁLISIS DE IA') || text.includes('DEEPSEEK') || text.includes('GEMINI')) {
        alertList.push(msg);
    }
    if (text.includes('VEREDICTO') || text.includes('GREEN') || text.includes('RED') || text.includes('APUESTA EVITADA')) {
        veredictoList.push(msg);
    }
});

console.log(`Alert-like messages: ${alertList.length}`);
console.log(`Veredicto-like messages: ${veredictoList.length}`);

// Print sample alert and sample veredicto
if (alertList.length > 0) {
    console.log('--- SAMPLE ALERT ---');
    console.log(alertList[0].text);
}
if (veredictoList.length > 0) {
    console.log('--- SAMPLE VEREDICTO ---');
    console.log(veredictoList[0].text);
}
