import { render, within, fireEvent } from '@testing-library/react';
import userEvent from "@testing-library/user-event";
import { act, waitFor } from '@testing-library/react';
import * as matchers from 'jest-extended';
import '@testing-library/jest-dom';
import 'src/testUtils/dateMock';
import { BrowserRouter } from 'react-router-dom';
import { enableFetchMocks } from 'jest-fetch-mock'

// Add jest-extended matchers (toEndWith etc)
expect.extend(matchers);

// Custom render function that wraps children in BrowserRouter (fix <Link>s)
const renderWithRouter = (ui, { route = '/' } = {}) => {
    window.history.pushState({}, 'Test page', route);
    return render(ui, { wrapper: BrowserRouter });
};

beforeAll(() => {
    // Fix "Request is not defined" in components that use react-router-dom
    enableFetchMocks();

    // Mock navigator.userAgent to simulate iOS Safari (most common client)
    Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'
    });

    // Mock methods not implemented in jsdom
    HTMLDialogElement.prototype.show = jest.fn(function () {
        this.setAttribute("open", "");
    });
    HTMLDialogElement.prototype.showModal = jest.fn(function () {
        this.setAttribute("open", "");
    });
    HTMLDialogElement.prototype.close = jest.fn(function () {
        this.removeAttribute("open");
    });
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
    window.scrollTo = jest.fn();
    window.HTMLElement.prototype.showPopover = jest.fn();
    window.HTMLElement.prototype.hidePopover = jest.fn();

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

    // Mock getComputedStyles to return a realistic text lineHeight
    const realGetComputedStyle = window.getComputedStyle;
    jest.spyOn(window, 'getComputedStyle').mockImplementation((el) => {
        // Get actual computed styles, override undefined lineHeight
        const style = realGetComputedStyle(el);
        style.lineHeight = '24px';
        return style;
    });

    // Mock fullscreenEnabled so photo gallery renders fullscreen button
    Object.defineProperty(document, 'fullscreenEnabled', {
        configurable: true,
        get: () => true,
    });

    // Track current fullscreen element
    let currentFsElement = null;
    Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: () => currentFsElement,
    });

    // Mock method called when entering fullscreen
    Element.prototype.requestFullscreen = jest.fn().mockImplementation(function () {
        currentFsElement = this;
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
    });

    // Mock method called when exiting fullscreen
    document.exitFullscreen = jest.fn().mockImplementation(() => {
        currentFsElement = null;
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
    });

    // Make available in all tests
    global.render = renderWithRouter;
    global.within = within;
    global.userEvent = userEvent;
    global.act = act;
    global.waitFor = waitFor;
    global.fireEvent = fireEvent;

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
