// Test server paths
const path = require('path');
const fs = require('fs');

console.log('🔍 Testing SpellTable Pro+ Server Paths...\n');

const basePath = __dirname;
console.log(`📁 Base Path: ${basePath}`);

const files = [
  { name: 'demo.html', path: path.join(basePath, 'demo.html') },
  { name: 'index.html', path: path.join(basePath, 'index.html') },
  { name: 'css/styles.css', path: path.join(basePath, 'css/styles.css') },
  { name: 'css/dark-theme.css', path: path.join(basePath, 'css/dark-theme.css') },
  { name: 'css/responsive.css', path: path.join(basePath, 'css/responsive.css') },
  { name: 'js/app.js', path: path.join(basePath, 'js/app.js') },
  { name: 'js/video.js', path: path.join(basePath, 'js/video.js') },
  { name: 'js/cards.js', path: path.join(basePath, 'js/cards.js') },
  { name: 'js/ai-detection.js', path: path.join(basePath, 'js/ai-detection.js') },
  { name: 'js/game-sync.js', path: path.join(basePath, 'js/game-sync.js') },
  { name: 'api/server.js', path: path.join(basePath, 'api/server.js') }
];

let allGood = true;

files.forEach(file => {
  const exists = fs.existsSync(file.path);
  const size = exists ? fs.statSync(file.path).size : 0;
  const status = exists ? '✅' : '❌';
  console.log(`${status} ${file.name.padEnd(25)} - ${size.toLocaleString()} bytes`);
  if (!exists) {
    allGood = false;
    console.log(`   ⚠️  Path: ${file.path}`);
  }
});

console.log('\n' + '='.repeat(50));
if (allGood) {
  console.log('✅ All files found! Server should work correctly.');
} else {
  console.log('❌ Some files are missing. Please check the paths above.');
}
console.log('='.repeat(50));

// Test Express static path resolution
console.log('\n🔧 Express static path test:');
const cssPath = path.join(__dirname, 'css');
const jsPath = path.join(__dirname, 'js');
console.log(`CSS Path: ${cssPath} - ${fs.existsSync(cssPath) ? '✅' : '❌'}`);
console.log(`JS Path: ${jsPath} - ${fs.existsSync(jsPath) ? '✅' : '❌'}`);
