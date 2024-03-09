import { DateTime } from 'src/testUtils/luxonMock';

beforeAll(() => {
    HTMLDialogElement.prototype.show = jest.fn();
    HTMLDialogElement.prototype.showModal = jest.fn();
    HTMLDialogElement.prototype.close = jest.fn();
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
});
