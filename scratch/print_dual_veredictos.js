const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'messages.html');
const content = fs.readFileSync(filePath, 'utf8');

const messageBlocks = content.split(/<div class="message /);

let count = 0;
messageBlocks.forEach((block) => {
    if (block.includes('VEREDICTO POST-PARTIDO - DUAL') && count < 3) {
        const textMatch = block.match(/<div class="text">([\s\S]*?)<\/div>/);
        if (textMatch) {
            let text = textMatch[1].replace(/<br\s*\/?>/gi, '\n').replace(/<\/?[^>]+(>|$)/g, '');
            text = text.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
            console.log('=== DUAL VEREDICTO ===');
            console.log(text);
            count++;
        }
    }
});
