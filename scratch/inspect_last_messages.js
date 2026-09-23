const fs = require('fs');
const content = fs.readFileSync('messages.html', 'utf8');
const msgs = content.split(/<div class="message /);
console.log('Últimos 10 bloques de mensajes:');
msgs.slice(-10).forEach((b, i) => {
    console.log(`[Bloque -${10 - i}]`);
    console.log(b.substring(0, 300));
    console.log('---------------------');
});
