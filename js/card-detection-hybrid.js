/**
 * SpellTable Pro+ — Hybrid Card Detection (client half)
 *
 * Pipeline (fastest path first):
 *   1. Frame throttle   — skip if < MIN_INTERVAL ms since last run
 *   2. Scene-change     — draw to a tiny 160×90 thumb, single getImageData call,
 *                         skip if frame looks identical to last
 *   3. OpenCV quads     — downscale source to PROC_MAX_W (720px) for fast edge
 *                         detection; scale corner coords back to original res;
 *                         perspective-warp from the ORIGINAL frame for quality
 *   4. pHash Worker     — compute DCT pHash in a Web Worker (no network), ~2-5ms
 *        → high confidence (≥ WORKER_CONF_ACCEPT)?  Done. No server call.
 *        → low confidence?  Fall through to step 5.
 *   5. Server lite      — POST /api/detect/lite (phash on server, ~10ms + RTT)
 *        → high confidence?  Done.
 *        → still low?  Escalate to step 6 only if OCR mode is on.
 *   6. Server full      — POST /api/detect (phash + Tesseract OCR, up to ~4s)
 *        Triggered only by manual "Identify" button, never automatically.
 *
 * Designed for 1080p Logitech-class webcams:
 *   - Scene-change thumb: ~0.5ms
 *   - OpenCV at 720p: ~15-25ms (vs ~60-100ms at 1080p)
 *   - Crop warp from original: preserves quality for pHash
 *
 * Requires OpenCV.js (loaded lazily from CDN).
 * Requires /js/phash-worker.js (served by Express static).
 */

(function () {
    'use strict';

    // ── Config ────────────────────────────────────────────────────────────────
    const OPENCV_URL         = 'https://docs.opencv.org/4.9.0/opencv.js';
    const API_DETECT         = (typeof window !== 'undefined' && window.__DETECT_API_URL__)
                               ? window.__DETECT_API_URL__ + '/api/detect'
                               : '/api/detect';
    const API_DETECT_LITE    = API_DETECT + '/lite';

    const CARD_ASPECT        = 2.5 / 3.5;
    const ASPECT_TOL         = 0.25;
    const MIN_AREA_FRAC      = 0.01;
    const MAX_AREA_FRAC      = 0.60;

    // OpenCV runs on a downscaled copy — 4× less pixels than 1080p, ~4× faster
    const PROC_MAX_W         = 720;     // px; source scaled down to this width

    const MIN_INTERVAL       = 600;     // ms between detection runs
    // Scene-change: one 160×90 thumbnail drawn per tick, single getImageData call
    const SCENE_THUMB_W      = 160;
    const SCENE_THUMB_H      = 90;
    const SCENE_DIFF_THRESH  = 0.06;    // 6% pixel change triggers new detection
    const WORKER_CONF_ACCEPT = 0.72;    // worker confidence threshold — skip server
    const LITE_CONF_ACCEPT   = 0.55;    // server-lite confidence threshold — skip OCR

    // ── State ─────────────────────────────────────────────────────────────────
    let cvReady       = null;
    let worker        = null;
    let workerReady   = false;
    let pendingHashes = new Map();   // id → { resolve, reject }
    let hashIdCounter = 0;

    let lastRunAt     = 0;
    let lastPixels    = null;        // Uint8ClampedArray — thumbnail RGBA from last run
    let sceneThumb    = null;        // reusable offscreen canvas (160×90)

    // ── OpenCV lazy loader ────────────────────────────────────────────────────
    function loadOpenCV() {
        if (cvReady) return cvReady;
        cvReady = new Promise((resolve, reject) => {
            if (window.cv?.Mat) return resolve(window.cv);
            const existing = document.querySelector(`script[src="${OPENCV_URL}"]`);
            if (!existing) {
                const s = document.createElement('script');
                s.src    = OPENCV_URL;
                s.async  = true;
                s.onerror = () => reject(new Error('OpenCV.js load failed'));
                document.head.appendChild(s);
            }
            const check = () => {
                if (window.cv?.Mat) return resolve(window.cv);
                if (window.cv && typeof window.cv.onRuntimeInitialized !== 'undefined') {
                    window.cv.onRuntimeInitialized = () => resolve(window.cv);
                    return;
                }
                setTimeout(check, 100);
            };
            check();
        });
        return cvReady;
    }

    // ── pHash Web Worker ──────────────────────────────────────────────────────
    function initWorker() {
        if (worker) return;
        try {
            worker = new Worker('/js/phash-worker.js');
            worker.onmessage = (e) => {
                const { type, id, cardCount } = e.data;
                if (type === 'ready') {
                    workerReady = true;
                    console.log(`✅ pHash worker ready (${cardCount} cards)`);
                    return;
                }
                if (type === 'result' || type === 'error') {
                    const pending = pendingHashes.get(id);
                    if (!pending) return;
                    pendingHashes.delete(id);
                    if (type === 'error') pending.reject(new Error(e.data.message));
                    else                  pending.resolve(e.data);
                }
            };
            worker.onerror = (err) => {
                console.warn('pHash worker error:', err.message);
                workerReady = false;
            };
        } catch (err) {
            console.warn('Could not create pHash worker:', err.message);
        }
    }

    /** Hash one ImageData via the Web Worker. Returns { match, elapsed }. */
    function workerHash(imageData, width, height) {
        return new Promise((resolve, reject) => {
            if (!worker || !workerReady) {
                return reject(new Error('Worker not ready'));
            }
            const id = ++hashIdCounter;
            pendingHashes.set(id, { resolve, reject });
            worker.postMessage({ type: 'hash', id, imageData, width, height });
            // Timeout safety — shouldn't trigger for a 64×64 hash
            setTimeout(() => {
                if (pendingHashes.has(id)) {
                    pendingHashes.delete(id);
                    reject(new Error('Worker hash timeout'));
                }
            }, 3000);
        });
    }

    // ── Scene-change detection ─────────────────────────────────────────────────
    // Draws the video source into a reusable 160×90 offscreen canvas, then reads
    // all pixels in ONE getImageData call (~0.5ms vs 64 individual calls).
    // Returns true if enough pixels changed to warrant a new detection run.
    function sceneChanged(source) {
        if (!sceneThumb) {
            sceneThumb = document.createElement('canvas');
            sceneThumb.width  = SCENE_THUMB_W;
            sceneThumb.height = SCENE_THUMB_H;
        }
        const ctx = sceneThumb.getContext('2d');
        ctx.drawImage(source, 0, 0, SCENE_THUMB_W, SCENE_THUMB_H);

        // Single GPU→CPU transfer for all pixels
        const current = ctx.getImageData(0, 0, SCENE_THUMB_W, SCENE_THUMB_H).data;

        if (!lastPixels || lastPixels.length !== current.length) {
            lastPixels = new Uint8ClampedArray(current);
            return true;
        }

        // Compare greyscale values; count pixels that changed by > 10 luma units
        let diff = 0;
        const total = SCENE_THUMB_W * SCENE_THUMB_H;
        for (let i = 0; i < current.length; i += 4) {
            const prevL = 0.299 * lastPixels[i] + 0.587 * lastPixels[i + 1] + 0.114 * lastPixels[i + 2];
            const currL = 0.299 * current[i]    + 0.587 * current[i + 1]    + 0.114 * current[i + 2];
            if (Math.abs(currL - prevL) > 10) diff++;
        }

        // Store copy for next comparison (reuse typed array if possible)
        lastPixels.set(current);
        return (diff / total) > SCENE_DIFF_THRESH;
    }

    // ── Perspective warp helpers ───────────────────────────────────────────────
    function orderCorners(pts) {
        const byXY = pts.map(p => ({ x: p.x, y: p.y, s: p.x + p.y, d: p.x - p.y }));
        const tl = byXY.reduce((a, b) => a.s < b.s ? a : b);
        const br = byXY.reduce((a, b) => a.s > b.s ? a : b);
        const tr = byXY.reduce((a, b) => a.d > b.d ? a : b);
        const bl = byXY.reduce((a, b) => a.d < b.d ? a : b);
        return [tl, tr, br, bl];
    }

    /**
     * detectCardQuads — optimised for 1080p webcam input.
     *
     * Strategy:
     *   1. Downscale source to ≤ PROC_MAX_W (720px) for OpenCV edge detection.
     *      720p has ~4× fewer pixels than 1080p → Canny + findContours run ~4× faster.
     *   2. Scale the detected corner coordinates back to original resolution.
     *   3. Perspective-warp from the ORIGINAL full-res frame so the card crop
     *      stays sharp — important for pHash accuracy.
     */
    async function detectCardQuads(source) {
        const cv  = await loadOpenCV();
        const origW = source.videoWidth  || source.width;
        const origH = source.videoHeight || source.height;
        if (!origW || !origH) return [];

        // ── Step 1: downscaled canvas for OpenCV ──────────────────────────────
        const scale  = Math.min(1, PROC_MAX_W / origW);
        const procW  = Math.round(origW * scale);
        const procH  = Math.round(origH * scale);

        const procCanvas = document.createElement('canvas');
        procCanvas.width  = procW;
        procCanvas.height = procH;
        procCanvas.getContext('2d').drawImage(source, 0, 0, procW, procH);

        // ── Step 2: original-res canvas for high-quality warp ─────────────────
        // Only created once per frame — shared across all quads found.
        const origCanvas = document.createElement('canvas');
        origCanvas.width  = origW;
        origCanvas.height = origH;
        origCanvas.getContext('2d').drawImage(source, 0, 0, origW, origH);

        const procMat   = cv.imread(procCanvas);
        const origMat   = cv.imread(origCanvas);
        const gray      = new cv.Mat();
        const blur      = new cv.Mat();
        const edges     = new cv.Mat();
        const contours  = new cv.MatVector();
        const hierarchy = new cv.Mat();

        try {
            cv.cvtColor(procMat, gray, cv.COLOR_RGBA2GRAY);
            cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
            cv.Canny(blur, edges, 50, 150);
            cv.dilate(edges, edges, cv.Mat.ones(3, 3, cv.CV_8U));
            cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

            const procArea = procW * procH;
            const results  = [];

            for (let i = 0; i < contours.size(); i++) {
                const cnt  = contours.get(i);
                const area = cv.contourArea(cnt);
                if (area < procArea * MIN_AREA_FRAC || area > procArea * MAX_AREA_FRAC) {
                    cnt.delete(); continue;
                }
                const peri   = cv.arcLength(cnt, true);
                const approx = new cv.Mat();
                cv.approxPolyDP(cnt, approx, 0.02 * peri, true);

                if (approx.rows === 4) {
                    // Scale corners back to original resolution
                    const pts = [];
                    for (let j = 0; j < 4; j++) {
                        pts.push({
                            x: Math.round(approx.data32S[j * 2]     / scale),
                            y: Math.round(approx.data32S[j * 2 + 1] / scale),
                        });
                    }
                    const [tl, tr, br, bl] = orderCorners(pts);
                    const maxW  = Math.max(Math.hypot(br.x - bl.x, br.y - bl.y),
                                           Math.hypot(tr.x - tl.x, tr.y - tl.y));
                    const maxH  = Math.max(Math.hypot(tr.x - br.x, tr.y - br.y),
                                           Math.hypot(tl.x - bl.x, tl.y - bl.y));
                    const aspect = Math.min(maxW, maxH) / Math.max(maxW, maxH);

                    if (Math.abs(aspect - CARD_ASPECT) > ASPECT_TOL) {
                        approx.delete(); cnt.delete(); continue;
                    }

                    // Warp from original-res mat for maximum crop quality
                    const dstW   = 488; const dstH = 680;
                    const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2,
                        [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]);
                    const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2,
                        [0, 0, dstW, 0, dstW, dstH, 0, dstH]);
                    const M      = cv.getPerspectiveTransform(srcTri, dstTri);
                    const warped = new cv.Mat();
                    cv.warpPerspective(origMat, warped, M, new cv.Size(dstW, dstH));

                    const out = document.createElement('canvas');
                    out.width = dstW; out.height = dstH;
                    cv.imshow(out, warped);

                    // Corners reported in original resolution for overlay drawing
                    results.push({ corners: [tl, tr, br, bl], canvas: out,
                                   cropDataUrl: out.toDataURL('image/jpeg', 0.85) });

                    srcTri.delete(); dstTri.delete(); M.delete(); warped.delete();
                }
                approx.delete(); cnt.delete();
            }
            return results;
        } finally {
            procMat.delete(); origMat.delete();
            gray.delete(); blur.delete(); edges.delete();
            contours.delete(); hierarchy.delete();
        }
    }

    // ── Recognition: worker → server-lite → (manual OCR) ─────────────────────
    async function recognizeOneCard(crop) {
        // Step 1 — Worker pHash (no network, ~2-5ms)
        if (workerReady) {
            try {
                const ctx  = crop.canvas.getContext('2d');
                const imgD = ctx.getImageData(0, 0, crop.canvas.width, crop.canvas.height);
                const { match } = await workerHash(imgD.data, imgD.width, imgD.height);
                if (match && match.confidence >= WORKER_CONF_ACCEPT) {
                    return { ...match, method: 'worker-phash' };
                }
                // Low confidence — fall through to server-lite
            } catch (err) {
                console.debug('Worker hash failed, falling back to server:', err.message);
            }
        }

        // Step 2 — Server lite (phash on server, ~10ms + RTT)
        try {
            const resp = await fetch(API_DETECT_LITE, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ cards: [crop.cropDataUrl] }),
            });
            if (resp.ok) {
                const json   = await resp.json();
                const result = json.results?.[0];
                if (result && result.confidence >= LITE_CONF_ACCEPT) {
                    return { ...result, method: result.method + '+server-lite' };
                }
            }
        } catch (err) {
            console.debug('Server-lite failed:', err.message);
        }

        return null; // Unrecognised — caller can offer manual OCR button
    }

    async function recognizeCards(crops) {
        return Promise.all(crops.map(c => recognizeOneCard(c).catch(() => null)));
    }

    /** Full OCR pipeline — only call on explicit user request */
    async function recognizeWithOcr(crops) {
        if (!crops.length) return [];
        const resp = await fetch(API_DETECT, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ cards: crops.map(c => c.cropDataUrl) }),
        });
        if (!resp.ok) throw new Error(`detect API ${resp.status}`);
        const data = await resp.json();
        return (data.results || []).map((r, i) => ({ ...crops[i], recognition: r }));
    }

    // ── Overlay ────────────────────────────────────────────────────────────────
    function drawOverlay(ctx, detections) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.lineWidth = 3;
        ctx.font      = 'bold 16px sans-serif';

        for (const det of detections) {
            const { corners, recognition } = det;
            const matched = recognition && recognition.confidence >= 0.6;
            ctx.strokeStyle = matched ? '#00ff88' : '#ffaa00';
            ctx.beginPath();
            ctx.moveTo(corners[0].x, corners[0].y);
            for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
            ctx.closePath(); ctx.stroke();

            if (recognition) {
                const label = `${recognition.name} ${Math.round(recognition.confidence * 100)}%`;
                const tw    = ctx.measureText(label).width + 10;
                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                ctx.fillRect(corners[0].x, corners[0].y - 24, tw, 22);
                ctx.fillStyle = matched ? '#00ff88' : '#ffaa00';
                ctx.fillText(label, corners[0].x + 5, corners[0].y - 7);
            }
        }
    }

    // ── Public API ─────────────────────────────────────────────────────────────
    window.HybridCardDetection = {
        loadOpenCV,
        initWorker,
        detectCardQuads,
        recognizeCards,
        recognizeWithOcr,
        drawOverlay,

        /**
         * Full auto pipeline with throttle + scene-change guard.
         * Call this from the analysis loop — it self-skips when nothing changed.
         *
         * @param {HTMLVideoElement|HTMLCanvasElement} source  — webcam feed or canvas
         * @param {CanvasRenderingContext2D}           overlayCtx  — for drawOverlay()
         */
        async analyzeFrame(source, overlayCtx) {
            const now = Date.now();
            if (now - lastRunAt < MIN_INTERVAL) return null; // throttled

            // Scene-change: draws source into a tiny thumb itself — no ctx needed
            if (!sceneChanged(source)) return null; // unchanged

            lastRunAt = now;

            const quads = await detectCardQuads(source);
            if (!quads.length) return [];

            const matches = await recognizeCards(quads);
            return quads.map((q, i) => ({ ...q, recognition: matches[i] }));
        },

        get workerReady() { return workerReady; }
    };

    // Boot worker as soon as this module loads
    initWorker();

})();
