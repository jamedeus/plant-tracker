import GroupCard from '../GroupCard';

describe('GroupCard', () => {
    let component, user;

    beforeEach(() => {
        // Render component + create userEvent instance to use in tests
        user = userEvent.setup();
        component = render(
            <GroupCard
                name={"Test Group"}
                plants={2}
                uuid={"0640ec3b-1bed-4b15-a078-d6e7ec66be12"}
                location={"Top shelf"}
                description={"Brightest grow light"}
            />
        );
    });

    it('shows the correct information', () => {
        expect(component.getByText('Test Group').nodeName).toBe('H2');
        expect(component.getByText('Contains 2 plants')).toBeInTheDocument();
    });

    it('flips chevron icon when details collapse is opened', async () => {
        // Confirm that ChevronDownIcon is present, ChevronUpIcon is not
        const icon = component.container.querySelector('svg');
        expect(icon.innerHTML.includes('M4.22')).toBe(true);
        expect(icon.innerHTML.includes('M11.78')).toBe(false);

        // Click button, confirm that icon changes to ChevronUpIcon
        await user.click(component.container.querySelector('.btn-close'));
        const newIcon = component.container.querySelector('svg');
        expect(newIcon.innerHTML.includes('M4.22')).toBe(false);
        expect(newIcon.innerHTML.includes('M11.78')).toBe(true);
    });

    it('redirects to manage group page when clicked', async () => {
        // Click inside div, confirm redirected to manage page
        await user.click(component.getByText('Test Group'));
        expect(window.location.href).toBe(
            '/manage/0640ec3b-1bed-4b15-a078-d6e7ec66be12'
        );
    });
});
