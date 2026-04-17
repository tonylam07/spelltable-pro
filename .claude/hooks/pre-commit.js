#!/usr/bin/env node
/**
 * Claude Code pre-commit hook
 * Runs before every commit Claude makes.
 *
 * Checks:
 *  1. No .env file staged
 *  2. No hardcoded secrets (JWT_SECRET=, password= followed by a literal value)
 *  3. No hardcoded ports in Dockerfiles (ENV PORT=<number>)
 *  4. No raw data responses (res.json without success envelope)  — warn only
 */

const { execSync } = require('child_process');

// Get list of staged files
let staged;
try {
    staged = execSync('git diff --cached --name-only', { encoding: 'utf8' })
        .split('\n')
        .filter(Boolean);
} catch {
    // Not in a git repo or no staged files — pass through
    process.exit(0);
}

const errors = [];
const warnings = [];

// ── Rule 1: Never commit .env ──────────────────────────────────────────────
if (staged.includes('.env')) {
    errors.push('.env is staged — remove it with: git restore --staged .env');
}

// ── Rule 2: Hardcoded secrets in staged JS files ───────────────────────────
const jsFiles = staged.filter(f => f.endsWith('.js') || f.endsWith('.ts'));
for (const file of jsFiles) {
    let content;
    try {
        content = execSync(`git show :${file}`, { encoding: 'utf8' });
    } catch {
        continue;
    }

    // Flag literal secret assignments like JWT_SECRET = 'abc123' (not a fallback pattern)
    const secretPattern = /(?:JWT_SECRET|DB_PASSWORD|MONGO_PASSWORD)\s*=\s*['"][^'"]{8,}['"]/g;
    const matches = content.match(secretPattern);
    if (matches) {
        // Allow the approved dev-fallback pattern from code-style.md
        const allowedFallback = /process\.env\.\w+\s*\|\|\s*['"]/;
        const suspicious = matches.filter(m => !allowedFallback.test(m));
        if (suspicious.length) {
            errors.push(`${file}: possible hardcoded secret: ${suspicious[0]}`);
        }
    }
}

// ── Rule 3: ENV PORT hardcoded in Dockerfile ───────────────────────────────
const dockerfiles = staged.filter(f =>
    f.startsWith('Dockerfile') || f.endsWith('.dockerfile')
);
for (const file of dockerfiles) {
    let content;
    try {
        content = execSync(`git show :${file}`, { encoding: 'utf8' });
    } catch {
        continue;
    }
    if (/^ENV\s+(?:PORT|DETECT_PORT)=\d+/m.test(content)) {
        errors.push(
            `${file}: hardcoded ENV PORT — Railway injects PORT dynamically. Remove the ENV line.`
        );
    }
}

// ── Rule 4: Raw res.json (no envelope) — warn only ────────────────────────
for (const file of jsFiles.filter(f => f.startsWith('api/'))) {
    let content;
    try {
        content = execSync(`git show :${file}`, { encoding: 'utf8' });
    } catch {
        continue;
    }
    // Detect res.json({...}) that doesn't contain success:
    const lines = content.split('\n');
    lines.forEach((line, i) => {
        if (/res\.json\s*\(/.test(line) && !/success\s*:/.test(line)) {
            warnings.push(`${file}:${i + 1}: res.json missing success envelope — ${line.trim()}`);
        }
    });
}

// ── Output ─────────────────────────────────────────────────────────────────
if (warnings.length) {
    console.warn('\n⚠️  Pre-commit warnings (non-blocking):');
    warnings.forEach(w => console.warn('   ' + w));
}

if (errors.length) {
    console.error('\n❌ Pre-commit checks failed:');
    errors.forEach(e => console.error('   ' + e));
    console.error('\nFix the issues above and re-stage your changes.\n');
    process.exit(1);
}

console.log('✅ Pre-commit checks passed.');
process.exit(0);
