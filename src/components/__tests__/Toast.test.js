import { Toast, showToast, hideToast } from 'src/components/Toast';

const TestComponent = () => {
    const showInfo = () => {
        showToast('Everything is OK', 'blue', 100);
    };

    const showError = () => {
        showToast('NOTHING IS OK', 'red', 100);
    };

    return (
        <>
            <button onClick={showInfo}>Show Info Toast</button>
            <button onClick={showError}>Show Error Toast</button>
            <Toast />
        </>
    );
};

describe('ToastContext', () => {
    let user, component;

    // Mock localStorage API
    beforeEach(() => {
        // Allow fast forwarding (skip delay before fade out)
        jest.useFakeTimers({ doNotFake: ['Date'] });

        // Render component + create userEvent instance to use in tests
        user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        component = render(<TestComponent />);
    });

    // Clean up pending timers after each test
    afterEach(() => {
        act(() => jest.runAllTimers());
        jest.useRealTimers();
    });

    const advanceTimers = async (delay) => {
        await act(async () => {
            await jest.advanceTimersByTimeAsync(delay);
        });
    };

    it('renders toast div when showToast method called', async () => {
        // Confirm no toast div exists in document
        expect(component.container.querySelectorAll('.toast').length).toBe(0);

        // Click button, confirm toast appears
        await user.click(component.getByText('Show Info Toast'));
        expect(component.container.querySelectorAll('.toast').length).toBe(1);

        // Confirm toast has expected text and color class
        let toast = component.getByText('Everything is OK').closest('span');
        expect(toast.classList).toContain('bg-info');
        expect(toast.classList).not.toContain('bg-error');

        // Click button that passes different color arg
        await user.click(component.getByText('Show Error Toast'));

        // Confirm text and color class changed to expected values
        toast = component.getByText('NOTHING IS OK').closest('span');
        expect(toast.classList).not.toContain('bg-info');
        expect(toast.classList).toContain('bg-error');
    });

    it('fades out toast automatically after timeout milliseconds', async () => {
        // Click button, confirm toast appears
        await user.click(component.getByText('Show Info Toast'));
        expect(component.container.querySelectorAll('.toast').length).toBe(1);
        // Confirm toast is fully visible
        expect(component.container.querySelector('.toast').classList).toContain('opacity-100');

        // Wait for timeout (100ms), confirm toast still visible but fading out
        await advanceTimers(100);
        expect(component.container.querySelectorAll('.toast').length).toBe(1);
        expect(component.container.querySelector('.toast').classList).toContain('opacity-0');

        // Wait for fade animation (500ms), confirm toast disappeared
        await advanceTimers(500);
        expect(component.container.querySelectorAll('.toast').length).toBe(0);
    });

    it('fades out toast immediately when clicked', async () => {
        // Click button, confirm toast appears
        await user.click(component.getByText('Show Info Toast'));
        expect(component.container.querySelectorAll('.toast').length).toBe(1);
        // Confirm toast is fully visible
        expect(component.container.querySelector('.toast').classList).toContain('opacity-100');

        // Click toast immediately, confirm toast starts fading out
        await user.click(component.getByText('Everything is OK'));
        expect(component.container.querySelector('.toast').classList).toContain('opacity-0');

        // Wait for fade animation (500ms), confirm toast disappeared
        await advanceTimers(500);
        expect(component.container.querySelectorAll('.toast').length).toBe(0);
    });

    it('fades out toast immediately when hideToast function called', async () => {
        // Click button, confirm toast appears
        await user.click(component.getByText('Show Info Toast'));
        expect(component.container.querySelectorAll('.toast').length).toBe(1);
        // Confirm toast is fully visible
        expect(component.container.querySelector('.toast').classList).toContain('opacity-100');

        // Call hideToast immediately, confirm toast starts fading out
        hideToast();
        await advanceTimers(0);
        expect(component.container.querySelector('.toast').classList).toContain('opacity-0');

        // Wait for fade animation (500ms), confirm toast disappeared
        await advanceTimers(500);
        expect(component.container.querySelectorAll('.toast').length).toBe(0);
    });

    it('resets hide timer each time showToast is called', async () => {
        // Click button, confirm toast appears and does not have fade-out class
        await user.click(component.getByText('Show Info Toast'));
        expect(component.container.querySelectorAll('.toast').length).toBe(1);
        expect(
            component.container.querySelector('.toast').classList
        ).not.toContain('opacity-0');

        // Keep clicking button half way through animation, confirm never
        // starts fading even though >100ms have passed
        await jest.advanceTimersByTimeAsync(50);
        await user.click(component.getByText('Show Info Toast'));
        await jest.advanceTimersByTimeAsync(50);
        await user.click(component.getByText('Show Info Toast'));
        await jest.advanceTimersByTimeAsync(50);
        await user.click(component.getByText('Show Info Toast'));
        await jest.advanceTimersByTimeAsync(50);
        expect(
            component.container.querySelector('.toast').classList
        ).not.toContain('opacity-0');

        // Wait for full timeout without clicking, confirm toast is fading out
        await advanceTimers(150);
        expect(
            component.container.querySelector('.toast').classList
        ).toContain('opacity-0');

        // Wait for fade animation, confirm toast umounted
        await advanceTimers(600);
        expect(component.container.querySelectorAll('.toast').length).toBe(0);
    });
});
