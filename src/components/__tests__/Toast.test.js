import { PageWrapper } from 'src/index';
import { showToast } from 'src/components/Toast';

const TestComponent = () => {
    const showInfo = () => {
        showToast('Everything is OK', 'blue', 100);
    };

    const showError = () => {
        showToast('NOTHING IS OK', 'red', 100);
    };

    return (
        <PageWrapper>
            <button onClick={showInfo}>Show Info Toast</button>
            <button onClick={showError}>Show Error Toast</button>
        </PageWrapper>
    );
};

describe('ToastContext', () => {
    let user, component;

    // Mock localStorage API
    beforeEach(() => {
        // Render component + create userEvent instance to use in tests
        user = userEvent.setup();
        component = render(<TestComponent />);
    });

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

        // Wait for timeout + animation (100 + 500ms), confirm toast disappeared
        await waitFor(() => {
            expect(component.container.querySelectorAll('.toast').length).toBe(0);
        }, {timeout: 650});
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
        await new Promise((resolve) => setTimeout(resolve, 50));
        await user.click(component.getByText('Show Info Toast'));
        await new Promise((resolve) => setTimeout(resolve, 50));
        await user.click(component.getByText('Show Info Toast'));
        await new Promise((resolve) => setTimeout(resolve, 50));
        await user.click(component.getByText('Show Info Toast'));
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(
            component.container.querySelector('.toast').classList
        ).not.toContain('opacity-0');

        // Wait for full timeout without clicking, confirm toast is fading out
        await waitFor(() => {
            expect(
                component.container.querySelector('.toast').classList
            ).toContain('opacity-0');
        }, {timeout: 150});

        // Wait for fade animation, confirm toast umounted
        await waitFor(() => {
            expect(component.container.querySelectorAll('.toast').length).toBe(0);
        }, {timeout: 600});
    });
});
