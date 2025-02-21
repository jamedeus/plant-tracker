import { render, within } from '@testing-library/react';
import userEvent from "@testing-library/user-event";
import { act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import 'src/testUtils/dateMock';

beforeAll(() => {
    // Mock methods not implemented in jsdom
    HTMLDialogElement.prototype.show = jest.fn();
    HTMLDialogElement.prototype.showModal = jest.fn();
    HTMLDialogElement.prototype.close = jest.fn();
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
    window.scrollTo = jest.fn();

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
