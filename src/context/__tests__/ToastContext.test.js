import { useToast, ToastProvider } from 'src/context/ToastContext';

const TestComponent = () => {
    const { showToast } = useToast();

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
        </>
    )
};

describe('ToggleThemeOption', () => {
    let user, component;

    // Mock localStorage API
    beforeEach(() => {
        // Render component + create userEvent instance to use in tests
        user = userEvent.setup();
        component = render(
            <ToastProvider>
                <TestComponent />
            </ToastProvider>
        );
    });

    it('renders toast div when showToast method called', async () => {
        // Confirm no toast div exists in document
        expect(component.container.querySelectorAll('.toast').length).toBe(0);

        // Click button, confirm toast appears
        await user.click(component.getByText('Show Info Toast'));
        expect(component.container.querySelectorAll('.toast').length).toBe(1);

        // Confirm toast has expected text and color class
        let toast = component.getByText('Everything is OK');
        expect(toast.parentElement.classList).toContain('alert-info');
        expect(toast.parentElement.classList).not.toContain('alert-error');

        // Click button that passes different color arg
        await user.click(component.getByText('Show Error Toast'));

        // Confirm text and color class changed to expected values
        toast = component.getByText('NOTHING IS OK');
        expect(toast.parentElement.classList).not.toContain('alert-info');
        expect(toast.parentElement.classList).toContain('alert-error');
    });

    it('fades out toast automatically after timeout milliseconds', async () => {
        // Click button, confirm toast appears
        await user.click(component.getByText('Show Info Toast'));
        expect(component.container.querySelectorAll('.toast').length).toBe(1);

        // Wait for timeout (100ms) plus animation (500ms) (+100 just in case)
        await new Promise((resolve) => setTimeout(resolve, 700));

        // Confirm toast disappeared
        expect(component.container.querySelectorAll('.toast').length).toBe(0);
    });

    it('resets hide timer each time showToast is called', async () => {
        // Click button, confirm toast appears
        await user.click(component.getByText('Show Info Toast'));
        expect(component.container.querySelectorAll('.toast').length).toBe(1);

        // Click button again half way through timeout
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Confirm toast still visible, does not have fade-out class yet
        expect(
            component.container.querySelector('.toast').classList
        ).not.toContain('toast-fade-out');

        // Keep clicking button half way through animation, confirm never
        // starts fading even though >100ms have passed
        await new Promise((resolve) => setTimeout(resolve, 50));
        await user.click(component.getByText('Show Info Toast'));
        await new Promise((resolve) => setTimeout(resolve, 50));
        await user.click(component.getByText('Show Info Toast'));
        await new Promise((resolve) => setTimeout(resolve, 50));
        await user.click(component.getByText('Show Info Toast'));
        await new Promise((resolve) => setTimeout(resolve, 50));
        await user.click(component.getByText('Show Info Toast'));
        expect(
            component.container.querySelector('.toast').classList
        ).not.toContain('toast-fade-out');

        // Wait for full timeout without clicking, confirm toast is fading out
        await new Promise((resolve) => setTimeout(resolve, 200));
        expect(
            component.container.querySelector('.toast').classList
        ).toContain('toast-fade-out');

        // Wait for fade animation, confirm toast umounted
        await new Promise((resolve) => setTimeout(resolve, 501));
        expect(component.container.querySelectorAll('.toast').length).toBe(0);
    });
});
