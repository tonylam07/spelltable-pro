// SpellTable Pro+ - AI Card Detection (Placeholder)
// Version: 1.0.0
// Note: This is a placeholder for AI card detection integration

class AICardDetection {
    constructor() {
        this.isRunning = false;
        this.detectedCards = [];
        this.analysisInterval = null;
        this.camStream = null;
        this.canvas = null;
        this.ctx = null;
        this.init();
    }

    init() {
        console.log('🤖 AI card detection initialized (placeholder mode)');
    }

    async startDetection() {
        try {
            console.log('🎥 Starting AI detection...');
            
            // Request camera access
            this.camStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                }
            });
            
            // Setup preview canvas
            const previewDiv = document.querySelector('.ai-preview .preview-placeholder');
            this.canvas = document.createElement('canvas');
            this.canvas.width = 1280;
            this.canvas.height = 720;
            this.ctx = this.canvas.getContext('2d');
            
            const video = document.createElement('video');
            video.srcObject = this.camStream;
            video.autoplay = true;
            video.playsInline = true;
            
            previewDiv.innerHTML = '';
            previewDiv.appendChild(video);
            previewDiv.appendChild(this.canvas);
            previewDiv.classList.add('active');
            
            this.isRunning = true;
            console.log('✅ AI detection started');
            
            // Start analysis loop
            this.startAnalysisLoop();
            
            // Show notification
            this.showNotification('AI detection started!', 'success');
            
        } catch (error) {
            console.error('❌ AI detection error:', error);
            this.showNotification('Failed to start AI detection', 'error');
            this.showError(error);
        }
    }

    stopDetection() {
        this.isRunning = false;
        
        // Stop analysis loop
        if (this.analysisInterval) {
            clearInterval(this.analysisInterval);
            this.analysisInterval = null;
        }
        
        // Stop camera stream
        if (this.camStream) {
            this.camStream.getTracks().forEach(track => track.stop());
            this.camStream = null;
        }
        
        // Clear preview
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
        
        this.canvas = null;
        this.ctx = null;
        
        console.log('⏹️ AI detection stopped');
        
        // Update button state
        const btn = document.getElementById('start-ai');
        if (btn) {
            btn.textContent = '🔍 Start Detection';
            btn.classList.remove('btn-primary');
        }
        
        this.showNotification('AI detection stopped', 'info');
    }

    async toggle() {
        if (this.isRunning) {
            this.stopDetection();
        } else {
            await this.startDetection();
        }
    }

    startAnalysisLoop() {
        // Kick off OpenCV load in the background so first frame is quick
        if (window.HybridCardDetection) {
            window.HybridCardDetection.loadOpenCV().catch(err =>
                console.warn('OpenCV load failed:', err.message));
        }
        this._analyzing = false;
        this.analysisInterval = setInterval(() => this.analyzeFrame(), 1200);
        console.log('🔄 Analysis loop started');
    }

    async analyzeFrame() {
        if (!this.canvas || !this.ctx || !this.camStream) return;
        if (this._analyzing) return; // skip if previous frame still running
        this._analyzing = true;

        try {
            const video = this.canvas.parentElement.querySelector('video');
            if (!video || video.readyState < video.HAVE_ENOUGH_DATA) return;

            this.ctx.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);

            if (!window.HybridCardDetection) {
                // Hybrid module not loaded — fall back to simulation so UI still moves
                this.simulateDetection();
                this.updateAnalysis();
                return;
            }

            const detections = await window.HybridCardDetection.analyzeFrame(video);
            window.HybridCardDetection.drawOverlay(this.ctx, detections);

            this.detectedCards = detections
                .filter(d => d.recognition)
                .map(d => ({
                    id: `detected-${d.recognition.scryfall_id || Date.now()}`,
                    name: d.recognition.name,
                    set: d.recognition.set,
                    type: this.inferType(d.recognition),
                    manaCost: d.recognition.cmc || 0,
                    confidence: d.recognition.confidence,
                    method: d.recognition.method
                }));

            this.updateDetectionUI();
            this.updateAnalysis();
        } catch (error) {
            console.error('❌ Analysis error:', error);
        } finally {
            this._analyzing = false;
        }
    }

    inferType(rec) {
        const line = (rec.type_line || '').toLowerCase();
        if (line.includes('land')) return 'land';
        if (line.includes('creature')) return 'creature';
        if (line.includes('instant')) return 'instant';
        if (line.includes('sorcery')) return 'sorcery';
        if (line.includes('artifact')) return 'artifact';
        if (line.includes('enchantment')) return 'enchantment';
        if (line.includes('planeswalker')) return 'planeswalker';
        return 'unknown';
    }

    simulateDetection() {
        // Placeholder detection - in real implementation, this would use OpenCV or ML model
        const possibleCards = [
            { name: 'Forest', type: 'land', manaCost: 0, power: 0, toughness: 0 },
            { name: 'Mountain', type: 'land', manaCost: 0, power: 0, toughness: 0 },
            { name: 'Lightning Strike', type: 'instant', manaCost: 1, power: 0, toughness: 0 },
            { name: 'Giant Spider', type: 'creature', manaCost: 3, power: 2, toughness: 2 },
            { name: 'Swords to Plowshares', type: 'instant', manaCost: 1, power: 0, toughness: 0 },
            { name: 'Cryptic Command', type: 'instant', manaCost: 3, power: 0, toughness: 0 },
            { name: 'Path to Exile', type: 'instant', manaCost: 1, power: 0, toughness: 0 },
            { name: 'The One Ring', type: 'artifact', manaCost: 2, power: 0, toughness: 0 }
        ];
        
        // Randomly detect 1-3 cards
        const cardsDetected = [];
        const numCards = Math.floor(Math.random() * 3) + 1;
        
        for (let i = 0; i < numCards; i++) {
            const card = possibleCards[Math.floor(Math.random() * possibleCards.length)];
            cardsDetected.push({
                ...card,
                id: `detected-${Date.now()}-${i}`,
                confidence: 0.85 + Math.random() * 0.15
            });
        }
        
        this.detectedCards = cardsDetected;
        this.updateDetectionUI();
        
        console.log('🔍 Detected cards:', cardsDetected.map(c => c.name));
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
                    (${card.type}) 
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
        
        // Calculate board state
        const landCount = this.detectedCards.filter(c => c.type === 'land').length;
        const creatureCount = this.detectedCards.filter(c => c.type === 'creature').length;
        const instantCount = this.detectedCards.filter(c => c.type === 'instant').length;
        const totalMana = this.detectedCards.reduce((sum, c) => sum + c.manaCost, 0);
        
        const analysis = `
            <div class="analysis-item">
                <span class="analysis-label">Board State:</span>
                <span class="analysis-value">
                    ${landCount} lands, ${creatureCount} creatures, ${instantCount} spells
                </span>
            </div>
            <div class="analysis-item">
                <span class="analysis-label">Total Mana:</span>
                <span class="analysis-value">${totalMana} mana</span>
            </div>
            <div class="analysis-item">
                <span class="analysis-label">Detected Cards:</span>
                <span class="analysis-value">${this.detectedCards.length} cards</span>
            </div>
            <div class="analysis-item">
                <span class="analysis-label">Recommended Play:</span>
                <span class="analysis-value">${this.getRecommendation()}</span>
            </div>
        `;
        
        analysisContent.innerHTML = analysis;
    }

    getRecommendation() {
        if (this.detectedCards.length === 0) {
            return 'No cards detected';
        }
        
        const landCount = this.detectedCards.filter(c => c.type === 'land').length;
        const creatureCount = this.detectedCards.filter(c => c.type === 'creature').length;
        
        if (landCount < 2 && creatureCount === 0) {
            return 'Play a land first';
        } else if (landCount >= 2 && creatureCount === 0) {
            return 'Consider playing a creature';
        } else if (this.hasSufficientMana(3) && creatureCount === 0) {
            return 'Play a 3-mana creature';
        } else if (this.hasSufficientMana(1) && creatureCount === 0) {
            return 'Play a 1-mana creature';
        } else {
            return 'Maintain board presence';
        }
    }

    hasSufficientMana(amount) {
        return this.detectedCards.reduce((sum, c) => sum + c.manaCost, 0) >= amount;
    }

    showError(error) {
        const previewDiv = document.querySelector('.ai-preview .preview-placeholder');
        if (previewDiv) {
            previewDiv.innerHTML = `
                <div class="preview-error">
                    <span class="error-icon">⚠️</span>
                    <h4>AI Detection Error</h4>
                    <p>${error.message || 'Camera access denied or unavailable'}</p>
                </div>
            `;
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Add to body
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => notification.classList.add('show'), 10);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    getDetectionStats() {
        return {
            cardsDetected: this.detectedCards.length,
            landCount: this.detectedCards.filter(c => c.type === 'land').length,
            creatureCount: this.detectedCards.filter(c => c.type === 'creature').length,
            totalMana: this.detectedCards.reduce((sum, c) => sum + c.manaCost, 0),
            avgConfidence: this.detectedCards.length > 0 
                ? (this.detectedCards.reduce((sum, c) => sum + c.confidence, 0) / this.detectedCards.length) * 100 
                : 0
        };
    }

    async exportDetectedCards() {
        const cardsJSON = JSON.stringify(this.detectedCards, null, 2);
        const blob = new Blob([cardsJSON], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `spelltable-detection-${Date.now()}.json`;
        link.href = url;
        link.click();
        
        console.log('💾 Detected cards exported');
        this.showNotification('Detected cards exported!', 'success');
    }
}

// Initialize AI detection (button binding handled by card-detection-enhanced.js)
document.addEventListener('DOMContentLoaded', () => {
    window.aiDetection = new AICardDetection();
});
