import Navbar from '../Navbar';

describe('Navbar', () => {
    it('adjusts title font size when window is resized', () => {
        const { container, getByText } = render(
            <Navbar title={'Test Page'} />
        );

        // Create variables to mock navbar and menu button widths
        let mockNavbarWidth, mockMenuButtonWidth;

        // Mock the navbar element offsetWidth to return variable above
        const navbarElement = container.querySelector('.navbar');
        Object.defineProperty(navbarElement, 'offsetWidth', {
            get: () => mockNavbarWidth,
            configurable: true,
        });

        // Mock the menu button element offsetWidth to return variable above
        const menuButtonElement = navbarElement.children[0];
        Object.defineProperty(menuButtonElement, 'offsetWidth', {
            get: () => mockMenuButtonWidth,
            configurable: true,
        });

        // Mock the title element offsetWidth so it scales predictably with
        // font size (always return fontSize * 10)
        const titleElement = getByText('Test Page');
        Object.defineProperty(titleElement, 'offsetWidth', {
            get: function () {
                return parseInt(this.style.fontSize) * 10;
            },
            configurable: true,
        });

        // Mock navbar width to 250, menu button width to 35
        // getMaxWidth function should return 148 (250 - 35 * 2 - 32)
        // Initial fontSize is 32px so offsetWidth will be 320, so font size
        // should decrement until reaching 16px (largest size that fits)
        mockNavbarWidth = 200;
        mockMenuButtonWidth = 35;

        // Trigger resize event, confirm font size was set to 14px
        act(() => {
            window.dispatchEvent(new Event('resize'));
        });
        expect(titleElement.style.fontSize).toBe('14px');

        // Mock navbar width to 400, menu button width to 50
        // getMaxWidth function should return 268 (400 - 50 * 2 - 32)
        // Title font size is 14px so offsetWidth will be 140, so font size
        // should increment until reaching 26px (highest without exceeding 268)
        mockNavbarWidth = 400;
        mockMenuButtonWidth = 50;

        // Trigger resize event, confirm font size is set to 26px
        act(() => {
            window.dispatchEvent(new Event('resize'));
        });
        expect(titleElement.style.fontSize).toBe('26px');
    });
});
