// SpellTable Pro+ - WebRTC Video Integration
// Version: 1.0.0

class VideoManager {
    constructor() {
        this.localStream = null;
        this.remoteStreams = new Map();
        this.peerConnections = new Map();
        this.isRecording = false;
        this.recordedChunks = [];
        this.mediaRecorder = null;
        this.init();
    }

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.loadVideoSettings();
        console.log('📹 Video manager initialized');
    }

    cacheDOM() {
        // Video containers
        this.primaryVideo = document.querySelector('.video-container.primary .video-placeholder');
        this.secondaryVideo = document.querySelector('.video-container.secondary .video-placeholder');
        
        // Video controls
        this.videoControls = document.querySelectorAll('.video-controls');
        
        // Control buttons
        this.snapshotBtn = document.querySelector('.video-controls:first-child .btn:first-child');
        this.recordBtn = document.querySelector('.video-controls:first-child .btn:nth-child(2)');
        this.muteBtn = document.querySelector('.video-controls:first-child .btn:nth-child(3)');
        
        // Settings button
        this.settingsBtn = document.querySelector('.video-controls:last-child .btn:nth-child(2)');
    }

    bindEvents() {
        // Snapshot
        this.snapshotBtn?.addEventListener('click', () => this.takeSnapshot());
        
        // Record
        this.recordBtn?.addEventListener('click', () => this.toggleRecording());
        
        // Mute
        this.muteBtn?.addEventListener('click', () => this.toggleMute());
        
        // Video settings
        this.settingsBtn?.addEventListener('click', () => this.openVideoSettings());
    }

    async loadVideoSettings() {
        const settings = localStorage.getItem('spelltable-video-settings');
        if (settings) {
            const parsed = JSON.parse(settings);
            this.useWebcam = parsed.useWebcam !== false;
            this.useMicrophone = parsed.useMicrophone !== false;
            this.videoQuality = parsed.videoQuality || 'high';
        }
    }

    async initWebRTC() {
        try {
            console.log('🎥 Initializing WebRTC...');
            
            // Get local stream
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: this.getVideoConstraints(),
                audio: this.useMicrophone
            });
            
            console.log('✅ Local stream acquired');
            this.displayLocalStream();
            
            // Initialize peer connections for remote streams
            this.initializePeerConnection('player1');
            this.initializePeerConnection('player2');
            
        } catch (error) {
            console.error('❌ WebRTC initialization error:', error);
            this.showWebRTCError(error);
        }
    }

    getVideoConstraints() {
        const constraints = {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
        };
        
        switch(this.videoQuality) {
            case 'low':
                constraints.width = { ideal: 640 };
                constraints.height = { ideal: 360 };
                constraints.frameRate = { ideal: 15 };
                break;
            case 'medium':
                constraints.width = { ideal: 960 };
                constraints.height = { ideal: 540 };
                constraints.frameRate = { ideal: 24 };
                break;
            case 'high':
            default:
                constraints.width = { ideal: 1280 };
                constraints.height = { ideal: 720 };
                constraints.frameRate = { ideal: 30 };
                break;
        }
        
        return constraints;
    }

    displayLocalStream() {
        // Create video element for local stream
        const video = document.createElement('video');
        video.srcObject = this.localStream;
        video.autoplay = true;
        video.muted = true;
        video.id = 'local-video';

        // primaryVideo is already the .video-placeholder element
        if (this.primaryVideo) {
            this.primaryVideo.innerHTML = '';
            this.primaryVideo.appendChild(video);
            this.primaryVideo.classList.add('active');
        }
        
        // Add video info
        const infoDiv = document.createElement('div');
        infoDiv.className = 'video-info';
        infoDiv.innerHTML = `
            <span>📹 You</span>
            <span>• ${this.localStream.getVideoTracks().length} video tracks</span>
            <span>• ${this.localStream.getAudioTracks().length} audio tracks</span>
        `;
        
        video.parentElement.appendChild(infoDiv);
    }

    showWebRTCError(error) {
        const errorMessage = this.getWebRTCErrorMessage(error);

        // primaryVideo is already the .video-placeholder element
        if (this.primaryVideo) {
            this.primaryVideo.innerHTML = `
                <div class="video-error">
                    <span class="error-icon">⚠️</span>
                    <h3>Video Error</h3>
                    <p>${errorMessage}</p>
                    <button class="btn btn-primary btn-sm" onclick="location.reload()">Retry</button>
                </div>
            `;
        }
    }

    getWebRTCErrorMessage(error) {
        switch(error.name) {
            case 'NotAllowedError':
            case 'PermissionDeniedError':
                return 'Camera/microphone access denied. Please check your browser permissions.';
            case 'NotFoundError':
                return 'No camera or microphone found. Please connect a device.';
            case 'NotReadableError':
                return 'Camera/microphone is being used by another application.';
            case 'OverconstrainedError':
                return 'The requested video constraints are not supported.';
            case 'StreamApiError':
                return 'WebRTC is not supported in this browser. Please use Chrome, Firefox, or Safari.';
            default:
                return `Video error: ${error.message || 'Unknown error'}`;
        }
    }

    initializePeerConnection(peerId) {
        const config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        
        const pc = new RTCPeerConnection(config);
        
        pc.ontrack = (event) => {
            this.handleRemoteTrack(event, peerId);
        };
        
        pc.onconnectionstatechange = () => {
            this.handleConnectionStateChange(peerId, pc);
        };
        
        this.peerConnections.set(peerId, pc);
        console.log(`🔗 Peer connection initialized for ${peerId}`);
        
        return pc;
    }

    handleRemoteTrack(event, peerId) {
        console.log(`📥 Received remote track from ${peerId}`);
        
        const remoteVideo = document.createElement('video');
        remoteVideo.srcObject = event.streams[0];
        remoteVideo.autoplay = true;
        remoteVideo.id = `remote-${peerId}`;
        
        // Store remote stream
        this.remoteStreams.set(peerId, {
            streams: event.streams[0],
            videoElement: remoteVideo,
            tracks: event.track
        });
        
        // Display in secondary container
        const placeholder = this.secondaryVideo.querySelector('.video-placeholder');
        if (placeholder) {
            placeholder.innerHTML = '';
            placeholder.appendChild(remoteVideo);
            placeholder.classList.add('active');
        }
        
        console.log(`✅ Remote stream for ${peerId} displayed`);
    }

    handleConnectionStateChange(peerId, pc) {
        const state = pc.connectionState;
        console.log(`📶 ${peerId} connection state: ${state}`);
        
        switch(state) {
            case 'connecting':
                console.log(`⏳ ${peerId} connecting...`);
                break;
            case 'connected':
                console.log(`✅ ${peerId} connected`);
                break;
            case 'disconnected':
                console.log(`⚠️ ${peerId} disconnected`);
                break;
            case 'failed':
                console.log(`❌ ${peerId} connection failed`);
                break;
            case 'closed':
                console.log(`🔒 ${peerId} connection closed`);
                break;
        }
    }

    async addTrack(track, peerId) {
        const pc = this.peerConnections.get(peerId);
        if (!pc) {
            console.error(`❌ Peer connection not found for ${peerId}`);
            return;
        }
        
        try {
            const sender = pc.addTrack(track, this.localStream);
            console.log(`➕ Added track to ${peerId}`);
            return sender;
        } catch (error) {
            console.error(`❌ Error adding track to ${peerId}:`, error);
            throw error;
        }
    }

    takeSnapshot() {
        const video = document.getElementById('local-video');
        if (!video || !video.srcObject) {
            console.warn('❌ No video stream available');
            return;
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const dataURL = canvas.toDataURL('image/png');
        
        // Create download link
        const link = document.createElement('a');
        link.download = `spelltable-snapshot-${Date.now()}.png`;
        link.href = dataURL;
        link.click();
        
        console.log('📸 Snapshot taken and downloaded');
        
        // Show notification
        this.showNotification('Snapshot taken!', 'success');
    }

    async toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            await this.startRecording();
        }
    }

    async startRecording() {
        const video = document.getElementById('local-video');
        if (!video || !video.srcObject) {
            console.warn('❌ No video stream available for recording');
            this.showNotification('Cannot start recording - no video stream', 'error');
            return;
        }
        
        try {
            this.recordedChunks = [];
            this.mediaRecorder = new MediaRecorder(video.srcObject, {
                mimeType: 'video/webm;codecs=vp9'
            });

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.saveRecording();
            };

            this.mediaRecorder.start();
            this.isRecording = true;
            this.recordBtn.textContent = '⏹️ Stop';
            this.recordBtn.classList.add('btn-danger');
            
            console.log('🎬 Recording started');
            this.showNotification('Recording started!', 'success');
            
        } catch (error) {
            console.error('❌ Recording error:', error);
            this.showNotification('Recording failed', 'error');
        }
    }

    stopRecording() {
        if (!this.isRecording) return;

        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        
        this.isRecording = false;
        this.recordBtn.textContent = '⏺️ Record';
        this.recordBtn.classList.remove('btn-danger');
        
        console.log('⏹️ Recording stopped');
        this.showNotification('Recording saved!', 'success');
    }

    saveRecording() {
        if (this.recordedChunks.length === 0) {
            console.warn('⚠️ No recording data');
            return;
        }
        
        const blob = new Blob(this.recordedChunks, {
            type: 'video/webm'
        });
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `spelltable-recording-${Date.now()}.webm`;
        link.href = url;
        link.click();
        
        console.log('💾 Recording saved');
    }

    async toggleMute() {
        if (!this.localStream) {
            console.warn('❌ No local stream');
            return;
        }
        
        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            const isMuted = !audioTrack.enabled;
            
            this.muteBtn.textContent = isMuted ? '🔇' : '🎤';
            console.log(`${isMuted ? '🔇' : '🎤'} Audio ${isMuted ? 'muted' : 'unmuted'}`);
        }
    }

    openVideoSettings() {
        const settings = {
            useWebcam: true,
            useMicrophone: true,
            videoQuality: 'high'
        };
        
        console.log('📹 Video settings:', settings);
        localStorage.setItem('spelltable-video-settings', JSON.stringify(settings));
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
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

    async joinSession(sessionId) {
        console.log(`🔗 Joining session: ${sessionId}`);
        
        // In a real implementation, this would connect to a signaling server
        // and establish peer connections with other players
        
        try {
            const response = await fetch(`/api/sessions/${sessionId}`);
            if (response.ok) {
                const session = await response.json();
                console.log('✅ Session joined:', session);
            }
        } catch (error) {
            console.error('❌ Error joining session:', error);
        }
    }

    async leaveSession(sessionId) {
        console.log(`🔓 Leaving session: ${sessionId}`);
        
        // Close all peer connections
        for (const [peerId, pc] of this.peerConnections.entries()) {
            pc.close();
        }
        
        this.peerConnections.clear();
        
        // Remove local stream tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }
        
        this.localStream = null;
        
        console.log('🔒 Session left');
    }
}

// Initialize video manager
document.addEventListener('DOMContentLoaded', () => {
    window.videoManager = new VideoManager();
    
    // Initialize WebRTC when user starts
    window.videoManager.initWebRTC();
});
