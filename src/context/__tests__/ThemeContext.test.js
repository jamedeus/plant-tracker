import { render, act } from '@testing-library/react';
import userEvent from "@testing-library/user-event";
import { useTheme, ThemeProvider } from 'src/context/ThemeContext';

const localStorageMock = (() => {
    let store = {};
    return {
        getItem: jest.fn((key) => store[key] || null),
        setItem: jest.fn((key, value) => {
            store[key] = value.toString();
        }),
        removeItem: jest.fn((key) => {
            delete store[key];
        }),
        clear: jest.fn(() => {
            store = {};
        }),
    };
})();

describe('ToggleThemeOption', () => {
    // Mock localStorage API
    beforeEach(() => {
        Object.defineProperty(window, 'storage', {
            value: localStorageMock,
        });
    });

    afterEach(() => {
        window.localStorage.clear();
    });

    const TestComponent = () => {
        const { ToggleThemeOption } = useTheme();
        return (
            <ThemeProvider>
                <ToggleThemeOption />
            </ThemeProvider>
        );
    };

    it('says "Dark mode" when current theme is light', () => {
        // Mock light theme
        window.localStorage.setItem('theme', 'light');

        // Render component
        const component = render(
            <ThemeProvider>
                <TestComponent />
            </ThemeProvider>
        );

        // Confirm correct text is shown
        expect(component.getByText('Dark mode')).not.toBeNull();
    });

    it('says "Light mode" when current theme is dark', () => {
        // Mock dark theme
        window.localStorage.setItem('theme', 'dark');

        // Render component
        const component = render(
            <ThemeProvider>
                <TestComponent />
            </ThemeProvider>
        );

        // Confirm correct text is shown
        expect(component.getByText('Light mode')).not.toBeNull();
    });

    it('toggles the theme when toggle option is clicked', async () => {
        // Render component in dark mode
        window.localStorage.setItem('theme', 'dark');
        const component = render(
            <ThemeProvider>
                <TestComponent />
            </ThemeProvider>
        );

        // Click toggle option
        await userEvent.click(component.getByText('Light mode'));

        // Confirm localStorage and html dataset attribute changed to light
        expect(window.localStorage.getItem('theme')).toBe('light');
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');

        // Click toggle again, confirm both change to dark
        await userEvent.click(component.getByText('Dark mode'));
        expect(window.localStorage.getItem('theme')).toBe('dark');
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('responds when theme is changed in another tab', async () => {
        // Render component in dark mode, confirm option says "Light mode"
        window.localStorage.setItem('theme', 'dark');
        const component = render(
            <ThemeProvider>
                <TestComponent />
            </ThemeProvider>
        );
        expect(component.getByText('Light mode')).not.toBeNull();

        // Simulate user changing theme to light in another tab
        await act(() => {
            const storageEvent = new Event('storage');
            storageEvent.key = 'theme';
            storageEvent.newValue = 'light';
            window.dispatchEvent(storageEvent);
        });

        // Confirm that toggle component re-rendered
        expect(component.getByText('Dark mode')).not.toBeNull();
    });
});
