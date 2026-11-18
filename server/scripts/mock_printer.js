const net = require('net');

const PORT = 9100;
const HOST = '127.0.0.1';

const server = net.createServer((socket) => {
  const clientAddress = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`\n🔔 [${new Date().toLocaleTimeString()}] Incoming Print Job from ${clientAddress}...`);

  let buffer = '';

  socket.on('data', (data) => {
    buffer += data.toString('latin1');
  });

  socket.on('end', () => {
    console.log('====================================================');
    console.log('📄 THERMAL PRINTER RECEIPT OUTPUT (80mm Virtual Head)');
    console.log('====================================================');
    
    // Clean ESC/POS control bytes for clean terminal display
    const cleanOutput = buffer
      .replace(/\x1b@/g, '') // init
      .replace(/\x1ba[\x00\x01\x02]/g, '') // align
      .replace(/\x1bE[\x00\x01]/g, '') // bold
      .replace(/\x1d![\x00\x11]/g, '') // size
      .replace(/\x1dV\x41\x10/g, '\n[=== PAPER CUT ===]\n'); // cut

    console.log(cleanOutput.trim());
    console.log('====================================================');
    console.log('✓ Print Job Finished and Paper Cut. Waiting for next receipt...\n');
  });

  socket.on('error', (err) => {
    console.error('Socket error:', err.message);
  });
});

server.listen(PORT, HOST, () => {
  console.log('====================================================');
  console.log(`🖨️  Virtual Thermal Printer Started on ${HOST}:${PORT}`);
  console.log('📡 Ready to receive direct TCP/IP ESC/POS print jobs!');
  console.log('👉 In Admin Settings, set Thermal Printer IP: 127.0.0.1');
  console.log('====================================================\n');
});
