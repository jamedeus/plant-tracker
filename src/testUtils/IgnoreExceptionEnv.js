const JsdomEnv = require('jest-environment-jsdom').TestEnvironment;

// Prevents unhandled rejections and uncaught exceptions from failing jest tests
// Useful for testing situations where an exception is expected
class IgnoreExceptionEnv extends JsdomEnv {
    async setup() {
        await super.setup();
        this._origEmit = process.emit.bind(process);
        process.emit = (event, ...args) => {
            if (event === 'unhandledRejection' || event === 'uncaughtException') {
                // Ignore exception, prevent jest from failing test
                return true;
            }
            return this._origEmit(event, ...args);
        };
    }
    async teardown() {
        if (this._origEmit) process.emit = this._origEmit;
        await super.teardown();
    }
}

module.exports = IgnoreExceptionEnv;
