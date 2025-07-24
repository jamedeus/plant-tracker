const path = require('path');

// Tell jest to transform ESM-only dependency
// https://github.com/igordanchenko/yet-another-react-lightbox/issues/66#issuecomment-1418129770
const esModules = ['yet-another-react-lightbox'];

// Mock system timezone
// UTC is deliberately not used to test frontend localization (receives UTC
// timestamps from backend and converts to user's system timezone)
process.env.TZ = 'PST';

module.exports = {
    testEnvironment: 'jsdom',
    transform: {
        '^.+\\.[t|j]sx?$': 'babel-jest',
        '^.+\\.css$': 'jest-css-modules-transform',
    },
    // Tell jest to transform ESM-only dependency
    transformIgnorePatterns: [`node_modules/(?!${esModules.join('|')})`],
    moduleNameMapper: {
        // Ignore mp3 imports
        '\\.(mp3)$': 'jest-transform-stub',
        // Alias src directory
        '^src/(.*)$': path.resolve(__dirname, 'src/$1'),
        '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
        // Give libraries that import barcode-detector a mock (avoid mocking
        // tons of webassembly stuff used by the pollyfill if doesn't exist)
        '^barcode-detector$': '<rootDir>/src/testUtils/mockBarcodeDetector.js'
    },
    coveragePathIgnorePatterns: [
        'src/css/',
        'src/testUtils/',
        'mockContext.js',
        'tailwind.config.js'
    ],
    testPathIgnorePatterns: ['mockContext.js'],
    setupFilesAfterEnv: ['<rootDir>/src/testUtils/jest.setup.js'],
    testTimeout: 10000
};
