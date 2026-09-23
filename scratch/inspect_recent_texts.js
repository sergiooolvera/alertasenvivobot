const fs = require('fs');
const content = fs.readFileSync('messages.html', 'utf8');
const msgs = content.split(/<div class="message /);
msgs.forEach((b) => {
    const idMatch = b.match(/id="message(\d+)"/);
    if (idMatch && parseInt(idMatch[1]) >= 23678) {
        const textMatch = b.match(/<div class="text">([\s\S]*?)<\/div>/);
        const titleMatch = b.match(/title="([^"]+)"/);
        console.log(`MSG ${idMatch[1]} (${titleMatch ? titleMatch[1] : 'sin fecha'}):`);
        if (textMatch) {
            console.log(textMatch[1].replace(/<br\s*\/?>/gi, '\n').replace(/<\/?[^>]+(>|$)/g, '').substring(0, 300));
        } else {
            console.log('(Sin texto)');
        }
        console.log('==============================');
    }
});
