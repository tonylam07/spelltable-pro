// Test actual paths from api/server.js perspective
const path = require('path');

console.log('🔍 Testing Paths from api/server.js Perspective\n');
console.log(`__dirname: ${__dirname}\n`);

// These are the paths used in server.js
const demoPath = path.join(__dirname, '../demo.html');
const indexPath = path.join(__dirname, '../index.html');
const cssPath = path.join(__dirname, '../css');
const jsPath = path.join(__dirname, '../js');

console.log('HTML Files:');
console.log(`  demo.html: ${demoPath}`);
console.log(`  index.html: ${indexPath}`);

console.log('\nStatic Directories:');
console.log(`  css/: ${cssPath}`);
console.log(`  js/: ${jsPath}`);

// Now test from actual execution context
const fs = require('fs');

console.log('\n✅ File Existence Check:');
console.log(`  demo.html: ${fs.existsSync(demoPath) ? '✅ EXISTS' : '❌ MISSING'}`);
console.log(`  index.html: ${fs.existsSync(indexPath) ? '✅ EXISTS' : '❌ MISSING'}`);
console.log(`  css/ dir: ${fs.existsSync(cssPath) ? '✅ EXISTS' : '❌ MISSING'}`);
console.log(`  js/ dir: ${fs.existsSync(jsPath) ? '✅ EXISTS' : '❌ MISSING'}`);

// Check what's actually in the root
console.log('\n📁 Files in root directory:');
const rootFiles = fs.readdirSync(path.join(__dirname, '..'));
rootFiles.forEach(f => {
  const stat = fs.statSync(path.join(__dirname, '..', f));
  const type = stat.isDirectory() ? '[DIR]' : '[FILE]';
  console.log(`  ${type} ${f}`);
});

// Check css directory
if (fs.existsSync(cssPath)) {
  console.log('\n📁 Files in css/ directory:');
  const cssFiles = fs.readdirSync(cssPath);
  cssFiles.forEach(f => {
    const stat = fs.statSync(path.join(cssPath, f));
    const size = stat.size.toLocaleString();
    console.log(`  ${type} ${f} - ${size} bytes`);
  });
}

// Check js directory
if (fs.existsSync(jsPath)) {
  console.log('\n📁 Files in js/ directory:');
  const jsFiles = fs.readdirSync(jsPath);
  jsFiles.forEach(f => {
    const stat = fs.statSync(path.join(jsPath, f));
    const size = stat.size.toLocaleString();
    console.log(`  ${type} ${f} - ${size} bytes`);
  });
}
