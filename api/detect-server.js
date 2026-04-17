/**
 * Standalone detection service.
 *
 * Deployed independently (Railway / Fly / any long-running Node host) because
 * its native deps (sharp, tesseract.js, image-hash) are too large/slow for
 * Vercel serverless. The Vercel-hosted frontend calls this service via the
 * DETECT_API_URL configured at build time.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const detectRoutes = require('./routes/detect');

const app = express();
const PORT = process.env.DETECT_PORT || process.env.PORT || 4000;

app.use(helmet());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true
}));
app.use(express.json({ limit: '20mb' }));
app.use(rateLimit({ windowMs: 60_000, max: 120 }));

const healthPayload = () => ({
    status: 'ok',
    service: 'spelltable-detect',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
});
app.get('/health', (_req, res) => res.json(healthPayload()));
app.get('/api/health', (_req, res) => res.json(healthPayload()));

app.use('/api/detect', detectRoutes);

app.use((err, _req, res, _next) => {
    console.error('detect-server error:', err);
    res.status(err.status || 500).json({ success: false, error: err.message });
});

app.listen(PORT, () => {
    console.log(`🔍 Detect service listening on :${PORT}`);
});

module.exports = app;
