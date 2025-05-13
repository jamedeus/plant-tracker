import { render, within } from '@testing-library/react';
import userEvent from "@testing-library/user-event";
import { act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import 'src/testUtils/dateMock';

beforeAll(() => {
    // Mock methods not implemented in jsdom
    HTMLDialogElement.prototype.show = jest.fn(function () {
        this.setAttribute("open", "");
    });
    HTMLDialogElement.prototype.showModal = jest.fn(function () {
        this.setAttribute("open", "");
    });
    HTMLDialogElement.prototype.close = jest.fn();
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
    window.scrollTo = jest.fn();

    // Mock matchMedia for useIsBreakpointActive custom hook
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => {
            // Only process min-width query with px or rem
            const mediaquery = query.match(/\(min-width:\s*(\d+)(px|rem)\)/);
            let matches = false;
            if (mediaquery) {
                // Get media query value, convert rem to px
                const [, value, unit] = mediaquery;
                let minWidth = parseInt(value, 10);
                if (unit === 'rem') {
                    minWidth = minWidth * 16;
                }
                // Check if window is greater than or equal to query
                matches = window.innerWidth >= minWidth;
            }
            return {
                matches,
                media: query,
                onchange: null
            };
        }),
    });

    // Make available in all tests
    global.render = render;
    global.within = within;
    global.userEvent = userEvent;
    global.act = act;
    global.waitFor = waitFor;

    // Mock method called when window.location.href set
    Object.defineProperty(window, 'location', {
        value: {
            assign: jest.fn(),
        },
    });

    // Mock window.location.reload
    Object.defineProperty(window, 'location', {
        configurable: true,
        value: { reload: jest.fn() },
    });

    // Mock DataTransfer and DataTransferItemList objects
    const mockDataTransferItemList = {
        items: [],
        add: jest.fn(function (file) {
            this.items.push(file);
        }),
        clear: jest.fn(function () {
            this.items = [];
        })
    };

    const mockDataTransfer = {
        items: mockDataTransferItemList,
        files: [],
        setData: jest.fn(),
          getData: jest.fn(),
          clearData: jest.fn()
    };

    global.DataTransfer = jest.fn(() => mockDataTransfer);
});

beforeEach(() => {
    // Reset number of calls for each mock to isolate test
    jest.clearAllMocks();
});
