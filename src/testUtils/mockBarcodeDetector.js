// Mock barcode-detector for @yudiel/react-qr-scanner tests (if this doesn't
// exist it uses a pollyfill with tons of webassembly that's harder to mock)
class FakeBarcodeDetector {
    static getSupportedFormats() {
        return ['aztec','code_128','ean_13','qr_code'];
    }
    constructor({ formats }) {
        this.formats = formats;
    }
    async detect() {
        return [];
    }
}

// Takes URL, mocks BarcodeDetector to simulate a QR code containing the URL
// entering the viewport
const mockQrCodeInViewport = (url) => {
    jest.spyOn(FakeBarcodeDetector.prototype, 'detect').mockResolvedValue([{
        rawValue: url,
        boundingBox: { x: 0, y: 0, width: 200, height: 100 },
        cornerPoints: [
            { x: 0,   y: 0   },
            { x: 200, y: 0   },
            { x: 200, y: 100 },
            { x: 0,   y: 100 }
        ],
        format: 'qr_code',
    }]);
};

// Export both named and default so any import style works
module.exports = {
    __esModule: true,
    default: FakeBarcodeDetector,
    BarcodeDetector: FakeBarcodeDetector,
    mockQrCodeInViewport: mockQrCodeInViewport
};
