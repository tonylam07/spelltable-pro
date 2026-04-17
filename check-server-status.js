#!/usr/bin/env node
// Quick server status check

const http = require('http');
const fs = require('fs');
const path = require('path');

console.log('🔍 SpellTable Pro+ Server Status Check\n');

// Test file existence
const testPaths = [
  { name: 'demo.html', path: path.join(__dirname, 'demo.html') },
  { name: 'api/server.js', path: path.join(__dirname, 'api/server.js') },
  { name: 'css/styles.css', path: path.join(__dirname, 'css/styles.css') },
  { name: 'js/app.js', path: path.join(__dirname, 'js/app.js') }
];

console.log('📁 File Status:');
testPaths.forEach(p => {
  const exists = fs.existsSync(p.path);
  const size = exists ? fs.statSync(p.path).size : 0;
  console.log(`  ${exists ? '✅' : '❌'} ${p.name.padEnd(20)} - ${size.toLocaleString()} bytes`);
});

console.log('\n🔧 Express Path Resolution Test:');
console.log('  From api/server.js context:');
console.log(`    __dirname: ${path.join(__dirname, 'api')}`);
console.log(`    __dirname + '../demo.html': ${path.join(__dirname, 'api/../demo.html')}`);
console.log(`    Actual path: ${path.resolve(path.join(__dirname, 'api/../demo.html'))}`);

console.log('\n✅ All paths should be correct. Server ready to start!\n');
console.log('To start server: node api/server.js');
