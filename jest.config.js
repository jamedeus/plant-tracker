const path = require('path');

module.exports = {
    testEnvironment: 'jsdom',
    transform: {
        '^.+\\.[t|j]sx?$': 'babel-jest'
    },
    moduleNameMapper: {
        '^src/(.*)$': path.resolve(__dirname, 'src/$1')
    },
    testPathIgnorePatterns: ['mockContext.js']
};
