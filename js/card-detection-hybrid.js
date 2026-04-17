/**
 * SpellTable Pro+ — Hybrid Card Detection (client half)
 *
 * Runs OpenCV.js in the browser to locate card-shaped quadrilaterals in a
 * video frame, performs a perspective warp to isolate each card, then
 * ships the crops to POST /api/detect where the server does phash+OCR
 * recognition. Draws bounding boxes and recognized names as an overlay.
 *
 * Requires OpenCV.js loaded globally as `cv` (see demo.html/index.html).
 */

(function () {
  const OPENCV_URL = 'https://docs.opencv.org/4.9.0/opencv.js';
  // Split-deploy: override via `window.__DETECT_API_URL__` (set in HTML or env-injected)
  // e.g. window.__DETECT_API_URL__ = 'https://detect.spelltable.app/api/detect';
  const API_DETECT = (typeof window !== 'undefined' && window.__DETECT_API_URL__) || '/api/detect';

  const CARD_ASPECT = 2.5 / 3.5;          // width / height of a Magic card
  const ASPECT_TOLERANCE = 0.25;
  const MIN_AREA_FRAC = 0.01;             // ignore contours < 1% of frame
  const MAX_AREA_FRAC = 0.6;

  let cvReady = null;

  function loadOpenCV() {
    if (cvReady) return cvReady;
    cvReady = new Promise((resolve, reject) => {
      if (window.cv && window.cv.Mat) return resolve(window.cv);
      const existing = document.querySelector(`script[src="${OPENCV_URL}"]`);
      if (!existing) {
        const s = document.createElement('script');
        s.src = OPENCV_URL;
        s.async = true;
        s.onerror = () => reject(new Error('Failed to load OpenCV.js'));
        document.head.appendChild(s);
      }
      const check = () => {
        if (window.cv && window.cv.Mat) return resolve(window.cv);
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

  function orderCorners(pts) {
    // top-left, top-right, bottom-right, bottom-left by sum / diff of coords
    const byXY = pts.map(p => ({ x: p.x, y: p.y, s: p.x + p.y, d: p.x - p.y }));
    const tl = byXY.reduce((a, b) => (a.s < b.s ? a : b));
    const br = byXY.reduce((a, b) => (a.s > b.s ? a : b));
    const tr = byXY.reduce((a, b) => (a.d > b.d ? a : b));
    const bl = byXY.reduce((a, b) => (a.d < b.d ? a : b));
    return [tl, tr, br, bl];
  }

  /**
   * @param {HTMLVideoElement|HTMLCanvasElement} source
   * @returns {Promise<Array<{corners, cropDataUrl}>>}
   */
  async function detectCardQuads(source) {
    const cv = await loadOpenCV();
    const w = source.videoWidth || source.width;
    const h = source.videoHeight || source.height;
    if (!w || !h) return [];

    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    tmp.getContext('2d').drawImage(source, 0, 0, w, h);

    const src = cv.imread(tmp);
    const gray = new cv.Mat();
    const blur = new cv.Mat();
    const edges = new cv.Mat();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();

    try {
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
      cv.Canny(blur, edges, 50, 150);
      cv.dilate(edges, edges, cv.Mat.ones(3, 3, cv.CV_8U));
      cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      const frameArea = w * h;
      const results = [];

      for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i);
        const area = cv.contourArea(cnt);
        if (area < frameArea * MIN_AREA_FRAC || area > frameArea * MAX_AREA_FRAC) {
          cnt.delete();
          continue;
        }
        const peri = cv.arcLength(cnt, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(cnt, approx, 0.02 * peri, true);

        if (approx.rows === 4) {
          const pts = [];
          for (let j = 0; j < 4; j++) {
            pts.push({ x: approx.data32S[j * 2], y: approx.data32S[j * 2 + 1] });
          }
          const [tl, tr, br, bl] = orderCorners(pts);

          const widthA = Math.hypot(br.x - bl.x, br.y - bl.y);
          const widthB = Math.hypot(tr.x - tl.x, tr.y - tl.y);
          const heightA = Math.hypot(tr.x - br.x, tr.y - br.y);
          const heightB = Math.hypot(tl.x - bl.x, tl.y - bl.y);
          const maxW = Math.max(widthA, widthB);
          const maxH = Math.max(heightA, heightB);
          const aspect = Math.min(maxW, maxH) / Math.max(maxW, maxH);

          if (Math.abs(aspect - CARD_ASPECT) > ASPECT_TOLERANCE) {
            approx.delete();
            cnt.delete();
            continue;
          }

          // Perspective-warp to standard 488×680 crop
          const dstW = 488, dstH = 680;
          const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
            tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y
          ]);
          const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
            0, 0, dstW, 0, dstW, dstH, 0, dstH
          ]);
          const M = cv.getPerspectiveTransform(srcTri, dstTri);
          const warped = new cv.Mat();
          cv.warpPerspective(src, warped, M, new cv.Size(dstW, dstH));

          const out = document.createElement('canvas');
          out.width = dstW; out.height = dstH;
          cv.imshow(out, warped);

          results.push({
            corners: [tl, tr, br, bl],
            cropDataUrl: out.toDataURL('image/png')
          });

          srcTri.delete(); dstTri.delete(); M.delete(); warped.delete();
        }

        approx.delete();
        cnt.delete();
      }

      return results;
    } finally {
      src.delete(); gray.delete(); blur.delete(); edges.delete();
      contours.delete(); hierarchy.delete();
    }
  }

  async function recognizeCards(crops) {
    if (crops.length === 0) return [];
    const resp = await fetch(API_DETECT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cards: crops.map(c => c.cropDataUrl) })
    });
    if (!resp.ok) throw new Error(`detect API ${resp.status}`);
    const data = await resp.json();
    return (data.results || []).map((r, i) => ({
      ...crops[i],
      recognition: r
    }));
  }

  function drawOverlay(ctx, detections) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.lineWidth = 3;
    ctx.font = 'bold 18px sans-serif';
    for (const det of detections) {
      const { corners, recognition } = det;
      const matched = recognition && recognition.confidence >= 0.6;
      ctx.strokeStyle = matched ? '#00ff88' : '#ffaa00';
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
      ctx.closePath();
      ctx.stroke();

      const label = recognition
        ? `${recognition.name} (${Math.round(recognition.confidence * 100)}% ${recognition.method})`
        : '?';
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      const w = ctx.measureText(label).width + 10;
      ctx.fillRect(corners[0].x, corners[0].y - 24, w, 22);
      ctx.fillStyle = matched ? '#00ff88' : '#ffaa00';
      ctx.fillText(label, corners[0].x + 5, corners[0].y - 7);
    }
  }

  window.HybridCardDetection = {
    loadOpenCV,
    detectCardQuads,
    recognizeCards,
    drawOverlay,
    /** Full pipeline: detect → recognize → return enriched detections. */
    async analyzeFrame(source) {
      const quads = await detectCardQuads(source);
      if (quads.length === 0) return [];
      try {
        return await recognizeCards(quads);
      } catch (err) {
        console.warn('recognizeCards failed, returning quads only:', err.message);
        return quads.map(q => ({ ...q, recognition: null }));
      }
    }
  };
})();
