import { useRef } from 'react';
import CollapseCol from '../CollapseCol';

const TestComponent = () => {
    const openRef = useRef(false);

    return (
        <CollapseCol
            title='History'
            openRef={openRef}
            scroll={true}
        >
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

    it('opens when title is clicked', async () => {
        // Get reference to hidden checkbox, confirm not checked
        const checkbox = component.getByRole('checkbox');
        expect(checkbox.checked).toBe(false);

        // Click checkbox (title doesn't work in jsdom), confirm checked
        await user.click(checkbox);
        expect(checkbox.checked).toBe(true);

        // Wait for animation, confirm scrollIntoView was called
        await waitFor(() => {
            expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
        });
    });
});
