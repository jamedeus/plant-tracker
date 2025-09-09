import GroupCard from '../GroupCard';

describe('GroupCard', () => {
    let component, user;

    beforeEach(() => {
        // Render component + create userEvent instance to use in tests
        user = userEvent.setup();
        component = render(
            <GroupCard
                display_name='Test Group'
                plants={2}
                uuid='0640ec3b-1bed-4b15-a078-d6e7ec66be12'
                created='2024-02-13T12:00:00+00:00'
                location='Top shelf'
                description='Brightest grow light'
            />
        );
    });

    it('shows the correct information', () => {
        expect(component.getByText('Test Group').nodeName).toBe('H2');
        expect(component.getByText('Contains 2 plants')).toBeInTheDocument();
    });

    it('expands/collapses details when arrow button is clicked', async () => {
        // Confirm that hidden checkbox that controls collapse is not checked
        expect(component.container.querySelector('input').checked).toBeFalse();

        // Click button, confirm checkbox is now checked
        await user.click(component.container.querySelector('.btn-close'));
        expect(component.container.querySelector('input').checked).toBeTrue();

        // Click button again, confirm checkbox is no longer checked
        await user.click(component.container.querySelector('.btn-close'));
        expect(component.container.querySelector('input').checked).toBeFalse();
    });

    it('redirects to manage group page when clicked', async () => {
        // Confirm card has correct href
        expect(component.getByRole('link')).toHaveAttribute(
            'href',
            '/manage/0640ec3b-1bed-4b15-a078-d6e7ec66be12'
        );
    });
});
