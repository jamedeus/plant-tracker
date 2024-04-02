import 'src/testUtils/dateMock';
import { DateTime } from 'src/testUtils/luxonMock';

beforeAll(() => {
    HTMLDialogElement.prototype.show = jest.fn();
    HTMLDialogElement.prototype.showModal = jest.fn();
    HTMLDialogElement.prototype.close = jest.fn();
    window.HTMLElement.prototype.scrollIntoView = jest.fn();

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
