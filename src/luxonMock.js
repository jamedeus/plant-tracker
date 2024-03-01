const { DateTime } = jest.requireActual('luxon');

// Mock the `now` function to return a fixed DateTime
DateTime.now = jest.fn(() => DateTime.fromISO('2024-03-01T12:00:00'));

module.exports = { DateTime };
