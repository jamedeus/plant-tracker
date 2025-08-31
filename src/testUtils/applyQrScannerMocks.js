class FakeMediaStreamTrack {
    constructor(kind = 'video', facingMode = 'environment', deviceId = 'back-id') {
        this.kind = kind;
        this.enabled = true;
        this.readyState = 'live';
        this.label = 'Fake Camera';
        this._settings = {
            width: 640,
            height: 480,
            aspectRatio: 640 / 480,
            facingMode,
            deviceId
        };
    }
    stop = jest.fn(() => { this.readyState = 'ended'; });
    getSettings = () => ({ ...this._settings });
    getConstraints = () => ({});
    getCapabilities = () => ({});
    applyConstraints = jest.fn().mockResolvedValue(undefined);
}

class FakeMediaStream {
    constructor(tracks = [new FakeMediaStreamTrack()]) {
        this._tracks = tracks;
        this.active = true;
        this.id = 'fake-stream';
    }
    getTracks() { return this._tracks.slice(); }
    getVideoTracks() { return this._tracks.filter(t => t.kind === 'video'); }
    addTrack(track) { this._tracks.push(track); }
    removeTrack(track) { this._tracks = this._tracks.filter(t => t !== track); }
}

export default function applyQrScannerMocks() {
    // Mock HTTPS (required for camera access)
    Object.defineProperty(window, 'isSecureContext', {
        get: () => true,
    });

    // Mock function used for video stream
    window.URL.createObjectURL = jest.fn(() => 'blob:mock-stream');

    // Mock mediaDevices to simulate mobile browser (front + back cameras)
    Object.defineProperty(navigator, 'mediaDevices', {
        value: {
            getSupportedConstraints: () => ({ facingMode: true }),
            enumerateDevices: jest.fn().mockResolvedValue([
                {
                    deviceId: 'front-id',
                    kind: 'videoinput',
                    label: 'Front Camera',
                    groupId: 'grp1'
                },
                {
                    deviceId: 'back-id',
                    kind: 'videoinput',
                    label: 'Back Camera',
                    groupId: 'grp1'
                }
            ]),
            // Mock getUserMedia to return a fake stream (needs getTracks,
            // getVideoTracks, removeTrack, getSettings, and stop methods)
            getUserMedia: jest.fn().mockResolvedValue(new FakeMediaStream()),
        },
        configurable: true,
    });

    // Mock video ready as soon as overlay opens
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
        configurable: true,
        get: () => 4,
    });

    // Mock methods used to draw bounding box around QR code
    window.DOMRectReadOnly = class DOMRectReadOnly {
        constructor(x = 0, y = 0, width = 0, height = 0) {
            this.x      = x;
            this.y      = y;
            this.width  = width;
            this.height = height;
            this.top    = y;
            this.left   = x;
            this.right  = x + width;
            this.bottom = y + height;
        }
    };
    window.DOMRect = window.DOMRectReadOnly;
    window.DOMRectReadOnly.fromRect = function(rect) {
        return new window.DOMRectReadOnly(
            rect.x, rect.y,
            rect.width, rect.height
        );
    };
    window.DOMRect.fromRect = window.DOMRectReadOnly.fromRect;

    // Mock video methods to silence errors (will work fine without these)
    HTMLMediaElement.prototype.play = jest.fn(function () {
        this.dispatchEvent(new Event('play'));
        this.dispatchEvent(new Event('playing'));
        return Promise.resolve();
    });
    HTMLMediaElement.prototype.load = jest.fn(function () {
        this.dispatchEvent(new Event('emptied'));
        this.dispatchEvent(new Event('loadedmetadata'));
        this.dispatchEvent(new Event('loadeddata'));
        this.dispatchEvent(new Event('canplay'));
        this.dispatchEvent(new Event('canplaythrough'));
    });
}
