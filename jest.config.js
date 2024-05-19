const path = require('path');

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
    moduleNameMapper: {
        '^src/(.*)$': path.resolve(__dirname, 'src/$1'),
        '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
    },
    coveragePathIgnorePatterns: [
        'src/calendar.css',
        'src/testUtils/',
        'mockContext.js'
    ],
    testPathIgnorePatterns: ['mockContext.js'],
    setupFilesAfterEnv: ['<rootDir>/src/testUtils/jest.setup.js'],
    testTimeout: 5000
};
