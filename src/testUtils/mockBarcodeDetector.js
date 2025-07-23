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

// Export both named and default so any import style works
module.exports = {
    __esModule: true,
    default: FakeBarcodeDetector,
    BarcodeDetector: FakeBarcodeDetector,
};
