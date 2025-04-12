import NavbarDropdownOptions from '../NavbarDropdownOptions';
import { PageWrapper } from 'src/index';

describe('NavbarDropdownOptions', () => {
    let component, user;

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
