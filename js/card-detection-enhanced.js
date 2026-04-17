// SpellTable Pro+ - Enhanced Card Detection
// Improved detection with better parameters and card recognition

class EnhancedCardDetector {
    constructor() {
        this.isRunning = false;
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.cv = null;
        this.detectedCards = [];
        this.initPromise = null;
    }

    async init() {
        if (this.initPromise) return this.initPromise;

        console.log('🤖 Initializing OpenCV.js...');

        this.initPromise = new Promise((resolve, reject) => {
            const cvScript = document.createElement('script');
            cvScript.src = 'https://docs.opencv.org/4.x/opencv.js';
            cvScript.async = true;

            cvScript.onload = () => {
                console.log('✅ OpenCV.js script loaded, waiting for runtime...');
                if (typeof cv !== 'undefined' && cv.onRuntimeInitialized !== undefined) {
                    cv.onRuntimeInitialized = () => {
                        console.log('✅ OpenCV runtime initialized');
                        this.isInitialized = true;
                        resolve();
                    };
                } else {
                    // cv may already be ready
                    this.isInitialized = true;
                    resolve();
                }
            };

            cvScript.onerror = () => {
                console.error('❌ Failed to load OpenCV.js');
                reject(new Error('Failed to load OpenCV.js'));
            };

            // Append to DOM first so onload can fire
            document.body.appendChild(cvScript);
        });

        return this.initPromise;
    }

    async startCamera() {
        try {
            console.log('📷 Requesting camera access...');
            
            // Stop any existing camera first
            this.stop();
            
            // Completely clear the AI preview section
            const aiPreview = document.querySelector('.ai-preview .preview-placeholder');
            if (aiPreview) {
                aiPreview.innerHTML = '';
            }
            
            // Create a container for the video
            const videoContainer = document.createElement('div');
            videoContainer.style.cssText = 'position: relative; width: 100%; height: 100%;';
            
            this.video = document.createElement('video');
            this.video.srcObject = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                }
            });
            this.video.autoplay = true;
            this.video.playsInline = true;
            this.video.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
            
            videoContainer.appendChild(this.video);
            
            if (aiPreview) {
                aiPreview.appendChild(videoContainer);
                aiPreview.classList.add('active');
            }
            
            // Setup canvas for processing (hidden)
            this.canvas = document.createElement('canvas');
            this.canvas.width = 1280;
            this.canvas.height = 720;
            this.ctx = this.canvas.getContext('2d');
            this.canvas.style.display = 'none';
            document.body.appendChild(this.canvas);
            
            await this.video.play();
            
            console.log('✅ Camera initialized');
            return true;
            
        } catch (error) {
            console.error('❌ Camera access denied:', error);
            this.showError('Camera access denied. Please allow camera permissions.');
            return false;
        }
    }

    detectCards() {
        if (!this.isInitialized || !this.video || this.video.readyState !== 4) {
            return;
        }
        
        // Draw video frame to canvas
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        
        // Convert to OpenCV Mat
        const src = cv.imread(this.canvas);
        const gray = new cv.Mat();
        const edges = new cv.Mat();
        const morphed = new cv.Mat();
        
        // Convert to grayscale
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
        
        // Apply Gaussian blur to reduce noise
        cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
        
        // Apply adaptive threshold for better edge detection
        cv.adaptiveThreshold(gray, gray, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2);
        
        // Morphological operations to connect edges
        let kernel = cv.Mat.eye(3, 3, cv.CV_8U);
        cv.morphologyEx(gray, morphed, cv.MORPH_CLOSE, kernel);
        kernel.delete();
        
        // Find contours
        const contours = new cv.MatVector();
        const hierarchy = new cv.Mat();
        cv.findContours(morphed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        
        // Analyze contours to find cards
        this.detectedCards = [];
        const minCardArea = 8000; // Increased minimum area
        const maxCardArea = 200000; // Maximum card area to avoid false positives
        
        for (let i = 0; i < contours.size(); i++) {
            const contour = contours.get(i);
            const area = cv.contourArea(contour);
            
            // Filter by area and aspect ratio
            if (area > minCardArea && area < maxCardArea) {
                const perimeter = cv.arcLength(contour, true);
                const approx = new cv.Mat();
                cv.approxPolyDP(contour, approx, 0.02 * perimeter, true);
                
                // Card-like shapes have 4 corners
                if (approx.rows === 4) {
                    const bbox = cv.boundingRect(contour);
                    
                    // Check aspect ratio (cards are roughly 2.5:3.5)
                    const aspectRatio = bbox.width / bbox.height;
                    if (aspectRatio > 0.5 && aspectRatio < 2.0) {
                        // Found a potential card
                        const vertices = [];
                        for (let j = 0; j < approx.rows; j++) {
                            vertices.push({
                                x: approx.at(j, 0),
                                y: approx.at(j, 1)
                            });
                        }
                        
                        const centerX = bbox.x + bbox.width / 2;
                        const centerY = bbox.y + bbox.height / 2;
                        
                        this.detectedCards.push({
                            id: `card-${Date.now()}-${i}`,
                            type: 'unknown',
                            name: 'Detected Card',
                            confidence: 0.85,
                            bbox: bbox,
                            vertices: vertices,
                            position: { x: centerX, y: centerY }
                        });
                        
                        approx.delete();
                    }
                }
            }
        }
        
        // Cleanup
        src.delete();
        gray.delete();
        edges.delete();
        morphed.delete();
        contours.delete();
        hierarchy.delete();
        
        // Update UI
        this.updateDetectionUI();
        this.drawDetectedCards();
        
        // Update AI analysis
        if (window.spellTableApp && window.spellTableApp.updateAIAnalysis) {
            window.spellTableApp.updateAIAnalysis();
        }
    }

    drawDetectedCards() {
        if (this.detectedCards.length === 0) return;
        
        this.detectedCards.forEach(card => {
            const { x, y, width, height } = card.bbox;
            
            // Draw bounding box
            this.ctx.strokeStyle = '#00ff00';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(x, y, width, height);
            
            // Draw card label
            this.ctx.fillStyle = '#00ff00';
            this.ctx.font = '14px Arial';
            this.ctx.fillText(`Card (${Math.round(card.confidence * 100)}%)`, x, y - 5);
            
            // Draw confidence circle
            this.ctx.beginPath();
            this.ctx.arc(card.position.x, card.position.y, 5, 0, Math.PI * 2);
            this.ctx.fillStyle = '#00ff00';
            this.ctx.fill();
        });
    }

    updateDetectionUI() {
        const detectionList = document.getElementById('ai-detection-results');
        if (!detectionList) return;
        
        if (this.detectedCards.length === 0) {
            detectionList.innerHTML = `
                <div class="detection-item">
                    <span class="detection-icon">🎯</span>
                    <span class="detection-text">Card detected: <strong>No cards detected yet</strong></span>
                </div>
            `;
            return;
        }
        
        const items = this.detectedCards.map(card => `
            <div class="detection-item">
                <span class="detection-icon">🎴</span>
                <span class="detection-text">
                    <strong>${card.name}</strong> 
                    <span class="confidence" title="Confidence: ${Math.round(card.confidence * 100)}%">
                        (${Math.round(card.confidence * 100)}%)
                    </span>
                </span>
            </div>
        `).join('');
        
        detectionList.innerHTML = items;
    }

    updateAnalysis() {
        const analysisContent = document.getElementById('ai-analysis-content');
        if (!analysisContent) return;
        
        const analysis = `
            <div class="analysis-item">
                <span class="analysis-label">Detected Cards:</span>
                <span class="analysis-value">${this.detectedCards.length} cards on board</span>
            </div>
            <div class="analysis-item">
                <span class="analysis-label">Board Status:</span>
                <span class="analysis-value">${this.detectedCards.length === 0 ? 'Empty board' : 'Active play'}</span>
            </div>
            <div class="analysis-item">
                <span class="analysis-label">Recommendation:</span>
                <span class="analysis-value">${this.getRecommendation()}</span>
            </div>
        `;
        
        analysisContent.innerHTML = analysis;
    }

    getRecommendation() {
        if (this.detectedCards.length === 0) {
            return 'Play a land or creature to start';
        } else if (this.detectedCards.length < 3) {
            return 'Continue developing board presence';
        } else {
            return 'Consider attacking or playing spells';
        }
    }

    showError(message) {
        const previewDiv = document.querySelector('.ai-preview .preview-placeholder');
        if (previewDiv) {
            previewDiv.innerHTML = `
                <div class="preview-error">
                    <span class="error-icon">⚠️</span>
                    <h4>AI Detection Error</h4>
                    <p>${message}</p>
                </div>
            `;
        }
    }

    stop() {
        this.isRunning = false;
        
        // Stop the loop if running
        if (this.loopId) {
            clearInterval(this.loopId);
            this.loopId = null;
        }
        
        // Stop camera stream and cleanup
        if (this.video) {
            this.video.srcObject.getTracks().forEach(track => track.stop());
            this.video.remove();
            this.video = null;
        }
        
        // Remove canvas
        if (this.canvas) {
            this.canvas.remove();
            this.canvas = null;
        }
        
        // Clear detections
        this.detectedCards = [];
        this.updateDetectionUI();
        
        // Revert preview to original state
        const previewDiv = document.querySelector('.ai-preview .preview-placeholder');
        if (previewDiv) {
            previewDiv.innerHTML = `
                <div class="preview-placeholder">
                    <span class="preview-icon">🔍</span>
                    <h4>AI Detection Preview</h4>
                    <p>Camera feed will appear here when AI detection is active</p>
                </div>
            `;
            previewDiv.classList.remove('active');
        }
        
        // Revert analysis to original
        const analysisContent = document.getElementById('ai-analysis-content');
        if (analysisContent) {
            analysisContent.innerHTML = `
                <div class="analysis-item">
                    <span class="analysis-label">Board State:</span>
                    <span class="analysis-value">No cards on board</span>
                </div>
                <div class="analysis-item">
                    <span class="analysis-label">Recommended:</span>
                    <span class="analysis-value">Start playing lands</span>
                </div>
            `;
        }
        
        console.log('⏹️ OpenCV detection stopped');
    }
}

// Kept for backwards-compat; actual button handler is wired below to the
// HybridCardDetection pipeline in ai-detection.js + card-detection-hybrid.js.
document.addEventListener('DOMContentLoaded', () => {
    window.enhancedDetector = new EnhancedCardDetector();

    const startBtn = document.getElementById('start-ai');
    if (!startBtn) return;

    startBtn.addEventListener('click', async () => {
        const ai = window.aiDetection;
        if (!ai) {
            console.error('window.aiDetection not initialized');
            return;
        }
        await ai.toggle();
        if (ai.isRunning) {
            startBtn.textContent = '⏹️ Stop Detection';
            startBtn.classList.add('btn-primary');
        } else {
            startBtn.textContent = '🔍 Start Detection';
            startBtn.classList.remove('btn-primary');
        }
    });
});
