import { render, within } from '@testing-library/react';
import userEvent from "@testing-library/user-event";
import '@testing-library/jest-dom';
import 'src/testUtils/dateMock';
import { DateTime } from 'src/testUtils/luxonMock';

beforeAll(() => {
    // Mock methods not implemented in jsdom
    HTMLDialogElement.prototype.show = jest.fn();
    HTMLDialogElement.prototype.showModal = jest.fn();
    HTMLDialogElement.prototype.close = jest.fn();
    window.HTMLElement.prototype.scrollIntoView = jest.fn();

    // Make available in all tests
    global.render = render;
    global.within = within;
    global.userEvent = userEvent;

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
