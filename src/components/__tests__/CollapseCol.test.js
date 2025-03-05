import { useRef } from 'react';
import CollapseCol from '../CollapseCol';

const TestComponent = () => {
    return (
        <CollapseCol title='History' scroll={true}>
            <div>
                <p>Collapse Contents</p>
            </div>
        </CollapseCol>
    );
};

describe('CollapseCol', () => {
    let component, user;

    beforeEach(() => {
        // Render component + create userEvent instance to use in tests
        user = userEvent.setup();
        component = render(
            <TestComponent />
        );
    });

    it('opens or closes when title is clicked', async () => {
        // Get reference to hidden checkbox, confirm checked (collapse open)
        const checkbox = component.getByRole('checkbox');
        expect(checkbox.checked).toBe(true);

        // Click checkbox (title doesn't work in jsdom), confirm not checked
        await user.click(checkbox);
        expect(checkbox.checked).toBe(false);

        // Click again, wait for animation, confirm scrollIntoView was called
        await user.click(checkbox);
        await waitFor(() => {
            expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
        });
    });
});
