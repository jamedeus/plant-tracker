import TrayCard from '../TrayCard';

describe('App', () => {
    let component, user;

    beforeEach(() => {
        // Render component + create userEvent instance to use in tests
        component = render(
            <TrayCard
                name={"Test Tray"}
                plants={2}
                uuid={"0640ec3b-1bed-4b15-a078-d6e7ec66be12"}
            />
        );
        user = userEvent.setup();

        // Reset all mocks to isolate tests
        jest.resetAllMocks();
    });

    it('shows the correct information', () => {
        expect(component.getByText('Test Tray').nodeName).toBe('H2');
        expect(component.getByText('Contains 2 plants')).toBeInTheDocument();
    });

    it('redirects to manage tray page when clicked', async () => {
        Object.defineProperty(window, 'location', {
            value: {
                assign: jest.fn(),
            },
        });

        // Click inside div, confirm redirected to manage page
        await user.click(component.getByText('Test Tray'));
        expect(window.location.href).toBe(
            '/manage/0640ec3b-1bed-4b15-a078-d6e7ec66be12'
        );
        jest.resetAllMocks();
    });
});
