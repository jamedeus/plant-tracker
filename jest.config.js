const path = require('path');

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
    testTimeout: 15000
};
