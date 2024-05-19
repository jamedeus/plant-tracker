const OriginalDate = Date;

// Mocks system time so relative times ("1 hour ago") don't change
// NOTE: timezone mocked to PST in jest.config.js, do not change -08:00 offset
class MockDate extends OriginalDate {
    constructor(...args) {
        if (args.length) {
            super(...args);
        } else {
            super('2024-03-01T12:00:00-08:00');
        }
    }

    static now() {
        return new OriginalDate('2024-03-01T12:00:00-08:00').getTime();
    }

    static UTC(...args) {
        return OriginalDate.UTC(...args);
    }

    static parse(...args) {
        return OriginalDate.parse(...args);
    }

    getTimezoneOffset() {
        return 480;
    }
}

global.Date = MockDate;
