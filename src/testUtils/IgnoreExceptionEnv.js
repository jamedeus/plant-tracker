const JsdomEnv = require('jest-environment-jsdom').TestEnvironment;

const EXCEPTION_TYPES = [
    'unhandledRejection',
    'uncaughtException',
    'uncaughtExceptionMonitor'
];

// Prevents unhandled rejections and uncaught exceptions from failing jest tests
// Useful for testing situations where an exception is expected
class IgnoreExceptionEnv extends JsdomEnv {
    async setup() {
        await super.setup();
        const origEmit = process.emit.bind(process);
        const origOn = process.on.bind(process);

        process.on = (event, listener) => {
            if (EXCEPTION_TYPES.includes(event)) {
                // Prevent jest from registering its exception listeners
                return process;
            }
            return origOn(event, listener);
        };

        process.emit = (event, ...args) => {
            if (EXCEPTION_TYPES.includes(event)) {
                // Ignore exception, prevent jest from failing test
                return true;
            }
            return origEmit(event, ...args);
        };

        this._restore = () => {
            process.on = origOn;
            process.emit = origEmit;
        };
    }
    async teardown() {
        if (this._restore) this._restore();
        await super.teardown();
    }
}

module.exports = IgnoreExceptionEnv;
