import NavbarDropdownOptions from '../NavbarDropdownOptions';
import { PageWrapper } from 'src/index';
import createMockContext from 'src/testUtils/createMockContext';

describe('NavbarDropdownOptions', () => {
    let component, user;

    beforeAll(() => {
        createMockContext('user_accounts_enabled', true);
    });

    beforeEach(() => {
        // Render component + create userEvent instance to use in tests
        user = userEvent.setup();
        component = render(
            <PageWrapper>
                <NavbarDropdownOptions />
            </PageWrapper>
        );
    });

    it('redirects to overview when dropdown option is clicked', async () => {
        // Click overview dropdown option, confirm redirected
        await user.click(component.getByText('Overview'));
        expect(window.location.href).toBe('/');
    });

    it('redirects to user profile when dropdown option is clicked', async () => {
        // Click User profile dropdown option, confirm redirected
        await user.click(component.getByText('User profile'));
        expect(window.location.href).toBe('/accounts/profile/');
    });
});

describe('NavbarDropdownOptions SINGLE_USER_MODE', () => {
    it('does not render user profile link when SINGLE_USER_MODE enabled', async () => {
        // Simulate SINGLE_USER_MODE enabled on backend
        createMockContext('user_accounts_enabled', false);

        // Render component + create userEvent instance to use in tests
        const user = userEvent.setup();
        const component = render(
            <PageWrapper>
                <NavbarDropdownOptions />
            </PageWrapper>
        );

        // Confirm user profile link was not rendered
        expect(component.queryByText('User profile')).toBeNull();
    });
});
