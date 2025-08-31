import NavbarDropdownOptions from '../NavbarDropdownOptions';

describe('NavbarDropdownOptions', () => {
    it('render user profile link when SINGLE_USER_MODE disabled', async () => {
        // Simulate SINGLE_USER_MODE disabled on backend
        globalThis.USER_ACCOUNTS_ENABLED = true;

        // Render component + create userEvent instance to use in tests
        const component = render(<NavbarDropdownOptions />);

        // Confirm user profile link was not rendered
        expect(component.queryByText('User profile')).not.toBeNull();
    });
});

describe('NavbarDropdownOptions SINGLE_USER_MODE', () => {
    it('does not render user profile link when SINGLE_USER_MODE enabled', async () => {
        // Simulate SINGLE_USER_MODE enabled on backend
        globalThis.USER_ACCOUNTS_ENABLED = false;

        // Render component + create userEvent instance to use in tests
        const component = render(<NavbarDropdownOptions />);

        // Confirm user profile link was not rendered
        expect(component.queryByText('User profile')).toBeNull();
    });
});
