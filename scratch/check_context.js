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

// Veamos el mensaje 22253 y 22256
const targetIds = ['22252', '22253', '22254', '22255', '22256', '22257'];
targetIds.forEach(tid => {
    const m = rawMessages.find(x => x.id === tid);
    if (m) {
        console.log(`=== MSG ${m.id} (${m.date} ${m.time}) ===`);
        console.log(m.text);
    }
});
