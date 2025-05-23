import NavbarDropdownOptions from '../NavbarDropdownOptions';
import createMockContext from 'src/testUtils/createMockContext';

describe('NavbarDropdownOptions', () => {
    it('render user profile link when SINGLE_USER_MODE disabled', async () => {
        // Simulate SINGLE_USER_MODE disabled on backend
        createMockContext('user_accounts_enabled', true);

        // Render component + create userEvent instance to use in tests
        const component = render(<NavbarDropdownOptions />);

        // Confirm user profile link was not rendered
        expect(component.queryByText('User profile')).not.toBeNull();
    });
});

describe('NavbarDropdownOptions SINGLE_USER_MODE', () => {
    it('does not render user profile link when SINGLE_USER_MODE enabled', async () => {
        // Simulate SINGLE_USER_MODE enabled on backend
        createMockContext('user_accounts_enabled', false);

        // Render component + create userEvent instance to use in tests
        const component = render(<NavbarDropdownOptions />);

        // Confirm user profile link was not rendered
        expect(component.queryByText('User profile')).toBeNull();
    });
});
