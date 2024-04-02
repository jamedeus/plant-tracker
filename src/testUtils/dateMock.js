const OriginalDate = Date;

// Mocks system time so relative times ("1 hour ago") don't change
class MockDate extends OriginalDate {
    constructor(...args) {
        if (args.length) {
            super(...args);
        } else {
            super('2024-03-01T12:00:00');
        }
    }

    static now() {
        return new OriginalDate('2024-03-01T12:00:00').getTime();
    }

    static UTC(...args) {
        return OriginalDate.UTC(...args);
    }

    static parse(...args) {
        return OriginalDate.parse(...args);
    }
}

global.Date = MockDate;
