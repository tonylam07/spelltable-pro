/**
 * SpellTable Pro+ — WebRTC Video Manager
 *
 * Handles:
 *  - Local camera/microphone acquisition
 *  - Peer-to-peer mesh connections for up to 5 remote players (6-player total)
 *  - Signaling via existing Socket.io connection (window.gameSync.socket)
 *  - ICE candidate exchange (STUN-only; add TURN for strict-NAT production use)
 *
 * Signaling flow:
 *  Existing player receives player_joined → calls initiateCall(remoteSocketId)
 *    → createOffer → emit webrtc_offer
 *  New player receives webrtc_offer → createAnswer → emit webrtc_answer
 *  Both sides exchange webrtc_ice_candidate as candidates trickle in
 *
 * Slot mapping:
 *  Slot 1 = local player (always #video-placeholder-1)
 *  Slots 2-6 = remote players, assigned in order of joining
 */

'use strict';

const STUN_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // For production add TURN here:
    // { urls: 'turn:your-turn-server.com', username: '...', credential: '...' }
];

const ICE_CONFIG = { iceServers: STUN_SERVERS };

class VideoManager {
    constructor() {
        this.localStream = null;
        this.isMuted = false;
        this.isVideoOff = false;
        this.isRecording = false;
        this.recordedChunks = [];
        this.mediaRecorder = null;

        // Map<socketId, RTCPeerConnection>
        this.peerConnections = new Map();

        // Map<socketId, slotIndex (2-6)>
        this.socketToSlot = new Map();

        // Set of available slot indices for remote peers
        this.freeSlots = new Set([2, 3, 4, 5, 6]);

        this._signalingReady = false;
        this.init();
    }

    // ── Init ─────────────────────────────────────────────────────────────────

    init() {
        this._bindVideoButtons();
        this._waitForSocket();
        console.log('📹 VideoManager initialised');
    }

    // Wait until window.gameSync.socket is available, then bind signaling events.
    _waitForSocket() {
        const attach = () => {
            const socket = window.gameSync?.socket;
            if (!socket) { setTimeout(attach, 300); return; }
            this._bindSignaling(socket);
            this._signalingReady = true;
            console.log('🔌 WebRTC signaling attached to socket');
        };
        attach();
    }

    _bindSignaling(socket) {
        socket.on('webrtc_offer',         (d) => this._onOffer(d));
        socket.on('webrtc_answer',        (d) => this._onAnswer(d));
        socket.on('webrtc_ice_candidate', (d) => this._onIceCandidate(d));
    }

    // Bind buttons using event delegation — safe even if DOM is re-rendered.
    _bindVideoButtons() {
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;
            const player = btn.dataset.player;

            switch (action) {
                case 'snapshot':    this.takeSnapshot(); break;
                case 'record':      this.toggleRecording(btn); break;
                case 'mute':        this.toggleMute(btn); break;
                case 'video-off':   this.toggleVideo(btn); break;
                case 'mute-remote': this._muteRemote(player); break;
            }
        });
    }

    // ── Camera ───────────────────────────────────────────────────────────────

    async initWebRTC() {
        try {
            console.log('🎥 Acquiring local stream…');
            const settings = this._loadSettings();

            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: this._videoConstraints(settings.videoQuality),
                audio: settings.useMicrophone !== false
            });

            console.log('✅ Local stream acquired');
            this._displayStream(1, this.localStream, 'You (local)', true);

            // Add local tracks to any already-existing peer connections
            // (handles the case of rejoining after a disconnect)
            for (const pc of this.peerConnections.values()) {
                this._addLocalTracks(pc);
            }

        } catch (err) {
            console.error('❌ getUserMedia failed:', err);
            this._showSlotError(1, err);
        }
    }

    stopCamera() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(t => t.stop());
            this.localStream = null;
        }
        this._restoreSlotPlaceholder(1);
    }

    // ── Peer lifecycle ────────────────────────────────────────────────────────

    /**
     * Called by game-sync when a NEW player joins our room.
     * WE (the existing player) initiate the call to them.
     */
    async initiateCall(remoteSocketId) {
        if (this.peerConnections.has(remoteSocketId)) return; // already connected
        if (!this.localStream) {
            console.warn('⚠️ No local stream yet — deferring initiateCall');
            setTimeout(() => this.initiateCall(remoteSocketId), 1000);
            return;
        }

        console.log(`📞 Initiating call to ${remoteSocketId}`);
        const pc = this._createPeerConnection(remoteSocketId);
        this._addLocalTracks(pc);

        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            this._emit('webrtc_offer', { to: remoteSocketId, offer });
            console.log(`📤 Offer sent to ${remoteSocketId}`);
        } catch (err) {
            console.error('❌ createOffer failed:', err);
        }
    }

    /**
     * Called when a peer disconnects (player_left).
     */
    handlePeerLeft(remoteSocketId) {
        const pc = this.peerConnections.get(remoteSocketId);
        if (pc) {
            pc.close();
            this.peerConnections.delete(remoteSocketId);
        }

        const slot = this.socketToSlot.get(remoteSocketId);
        if (slot) {
            this._restoreSlotPlaceholder(slot);
            this.socketToSlot.delete(remoteSocketId);
            this.freeSlots.add(slot);
        }

        console.log(`🔓 Peer disconnected: ${remoteSocketId}`);
    }

    // ── Signaling handlers ────────────────────────────────────────────────────

    async _onOffer({ from, offer }) {
        console.log(`📥 Offer received from ${from}`);

        let pc = this.peerConnections.get(from);
        if (!pc) pc = this._createPeerConnection(from);

        // Add local tracks before creating answer (so remote gets our video)
        if (this.localStream) this._addLocalTracks(pc);

        try {
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            this._emit('webrtc_answer', { to: from, answer });
            console.log(`📤 Answer sent to ${from}`);
        } catch (err) {
            console.error('❌ Answer creation failed:', err);
        }
    }

    async _onAnswer({ from, answer }) {
        console.log(`📥 Answer received from ${from}`);
        const pc = this.peerConnections.get(from);
        if (!pc) { console.warn(`No PC found for ${from}`); return; }

        try {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
            console.error('❌ setRemoteDescription (answer) failed:', err);
        }
    }

    async _onIceCandidate({ from, candidate }) {
        const pc = this.peerConnections.get(from);
        if (!pc) return;

        try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
            // Benign if the candidate arrives before remote description is set
            console.debug('ICE candidate ignored:', err.message);
        }
    }

    // ── RTCPeerConnection factory ─────────────────────────────────────────────

    _createPeerConnection(remoteSocketId) {
        const pc = new RTCPeerConnection(ICE_CONFIG);
        this.peerConnections.set(remoteSocketId, pc);

        // Assign a video slot
        const slot = this._allocateSlot(remoteSocketId);

        // Trickle ICE
        pc.onicecandidate = ({ candidate }) => {
            if (candidate) {
                this._emit('webrtc_ice_candidate', { to: remoteSocketId, candidate });
            }
        };

        // Remote track received — display it
        pc.ontrack = (event) => {
            console.log(`📺 Remote track from ${remoteSocketId} (slot ${slot})`);
            const stream = event.streams[0];
            if (stream) this._displayStream(slot, stream, `Player (slot ${slot})`, false);
        };

        // Connection state logging + reconnect hint
        pc.onconnectionstatechange = () => {
            const state = pc.connectionState;
            console.log(`🔗 ${remoteSocketId} → ${state}`);
            if (state === 'failed') {
                console.warn(`⚠️ Connection to ${remoteSocketId} failed — attempting ICE restart`);
                pc.restartIce();
            }
            if (state === 'disconnected' || state === 'closed') {
                this._restoreSlotPlaceholder(slot);
            }
        };

        // ICE gathering log
        pc.onicegatheringstatechange = () => {
            console.debug(`ICE gathering: ${pc.iceGatheringState} (${remoteSocketId})`);
        };

        return pc;
    }

    _allocateSlot(remoteSocketId) {
        if (this.socketToSlot.has(remoteSocketId)) {
            return this.socketToSlot.get(remoteSocketId);
        }
        const slot = Math.min(...this.freeSlots); // lowest free slot
        this.freeSlots.delete(slot);
        this.socketToSlot.set(remoteSocketId, slot);
        return slot;
    }

    _addLocalTracks(pc) {
        if (!this.localStream) return;
        const senders = pc.getSenders().map(s => s.track);
        this.localStream.getTracks().forEach(track => {
            if (!senders.includes(track)) {
                pc.addTrack(track, this.localStream);
            }
        });
    }

    // ── DOM helpers ───────────────────────────────────────────────────────────

    _displayStream(slotIndex, stream, label, muted) {
        const placeholder = document.getElementById(`video-placeholder-${slotIndex}`);
        if (!placeholder) {
            console.warn(`No placeholder found for slot ${slotIndex}`);
            return;
        }

        placeholder.innerHTML = '';
        placeholder.classList.add('active');

        const video = document.createElement('video');
        video.srcObject = stream;
        video.autoplay = true;
        video.playsInline = true;
        video.muted = muted; // local video: muted to prevent echo
        video.id = slotIndex === 1 ? 'local-video' : `remote-video-${slotIndex}`;
        video.className = 'webrtc-video';

        const badge = document.createElement('div');
        badge.className = 'video-badge';
        badge.innerHTML = `<span>${muted ? '📹' : '👤'} ${label}</span>`;

        placeholder.appendChild(video);
        placeholder.appendChild(badge);

        video.play().catch(() => {
            // Autoplay may be blocked — user interaction will unblock it
        });
    }

    _restoreSlotPlaceholder(slotIndex) {
        const placeholder = document.getElementById(`video-placeholder-${slotIndex}`);
        if (!placeholder) return;

        placeholder.classList.remove('active');
        const label = slotIndex === 1 ? 'You' : `Player ${slotIndex}`;
        const icon = slotIndex === 1 ? '📹' : '👤';
        const sub = slotIndex === 1 ? 'Your camera feed' : 'Remote video feed';

        placeholder.innerHTML = `
            <div class="video-content">
                <span class="video-icon">${icon}</span>
                <h3>${label}</h3>
                <p>${sub}</p>
            </div>
        `;
    }

    _showSlotError(slotIndex, err) {
        const placeholder = document.getElementById(`video-placeholder-${slotIndex}`);
        if (!placeholder) return;

        const msg = this._errorMessage(err);
        placeholder.innerHTML = `
            <div class="video-error">
                <span class="error-icon">⚠️</span>
                <h3>Camera Error</h3>
                <p>${msg}</p>
                <button class="btn btn-sm btn-primary" onclick="window.videoManager.initWebRTC()">
                    Retry
                </button>
            </div>
        `;
    }

    // ── Controls ──────────────────────────────────────────────────────────────

    takeSnapshot() {
        const video = document.getElementById('local-video');
        if (!video?.srcObject) { console.warn('No local video'); return; }

        const canvas = document.createElement('canvas');
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);

        const link = document.createElement('a');
        link.download = `spelltable-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        this._toast('📸 Snapshot saved');
    }

    async toggleRecording(btn) {
        if (this.isRecording) {
            this._stopRecording(btn);
        } else {
            await this._startRecording(btn);
        }
    }

    async _startRecording(btn) {
        const video = document.getElementById('local-video');
        if (!video?.srcObject) { this._toast('No video stream to record', 'error'); return; }

        this.recordedChunks = [];
        const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
            ? 'video/webm;codecs=vp9' : 'video/webm';

        this.mediaRecorder = new MediaRecorder(video.srcObject, { mimeType: mime });
        this.mediaRecorder.ondataavailable = ({ data }) => {
            if (data.size > 0) this.recordedChunks.push(data);
        };
        this.mediaRecorder.onstop = () => this._saveRecording();
        this.mediaRecorder.start();
        this.isRecording = true;
        if (btn) { btn.textContent = '⏹️ Stop'; btn.classList.add('btn-danger'); }
        this._toast('🎬 Recording started');
    }

    _stopRecording(btn) {
        this.mediaRecorder?.stop();
        this.isRecording = false;
        if (btn) { btn.textContent = '⏺️ Record'; btn.classList.remove('btn-danger'); }
    }

    _saveRecording() {
        if (!this.recordedChunks.length) return;
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        const link = document.createElement('a');
        link.download = `spelltable-rec-${Date.now()}.webm`;
        link.href = URL.createObjectURL(blob);
        link.click();
        this._toast('💾 Recording saved');
    }

    toggleMute(btn) {
        if (!this.localStream) return;
        const audio = this.localStream.getAudioTracks()[0];
        if (!audio) return;
        this.isMuted = !this.isMuted;
        audio.enabled = !this.isMuted;
        if (btn) btn.textContent = this.isMuted ? '🔇 Unmute' : '🎤 Mute';
    }

    toggleVideo(btn) {
        if (!this.localStream) return;
        const videoTrack = this.localStream.getVideoTracks()[0];
        if (!videoTrack) return;
        this.isVideoOff = !this.isVideoOff;
        videoTrack.enabled = !this.isVideoOff;
        if (btn) btn.textContent = this.isVideoOff ? '📷 Show' : '🎥 Hide';
    }

    _muteRemote(slotIndex) {
        const video = document.getElementById(`remote-video-${slotIndex}`);
        if (!video) return;
        video.muted = !video.muted;
    }

    // ── Utility ───────────────────────────────────────────────────────────────

    _emit(event, data) {
        const socket = window.gameSync?.socket;
        if (socket?.connected) {
            socket.emit(event, data);
        } else {
            console.warn(`⚠️ Cannot emit ${event} — socket not connected`);
        }
    }

    _loadSettings() {
        try {
            return JSON.parse(localStorage.getItem('spelltable-video-settings') || '{}');
        } catch {
            return {};
        }
    }

    _videoConstraints(quality = 'medium') {
        const presets = {
            low:    { width: { ideal: 640  }, height: { ideal: 360 }, frameRate: { ideal: 15 } },
            medium: { width: { ideal: 960  }, height: { ideal: 540 }, frameRate: { ideal: 24 } },
            high:   { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
        };
        return presets[quality] ?? presets.medium;
    }

    _errorMessage(err) {
        const map = {
            NotAllowedError:       'Camera/mic access denied. Check browser permissions.',
            PermissionDeniedError: 'Camera/mic access denied. Check browser permissions.',
            NotFoundError:         'No camera/microphone found.',
            NotReadableError:      'Camera/mic is in use by another application.',
            OverconstrainedError:  'Camera constraints not supported by your device.'
        };
        return map[err.name] ?? `Video error: ${err.message}`;
    }

    _toast(msg, type = 'info') {
        if (window.showToast) { window.showToast(msg); return; }
        const el = document.createElement('div');
        el.className = `notification ${type}`;
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(() => el.classList.add('show'), 10);
        setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3000);
    }

    // ── Cleanup ───────────────────────────────────────────────────────────────

    destroy() {
        for (const pc of this.peerConnections.values()) pc.close();
        this.peerConnections.clear();
        this.socketToSlot.clear();
        this.freeSlots = new Set([2, 3, 4, 5, 6]);
        this.stopCamera();
    }
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
    window.videoManager = new VideoManager();
    // Auto-start camera when page loads
    window.videoManager.initWebRTC();
});
