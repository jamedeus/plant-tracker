import { useRef } from 'react';
import CollapseCol from '../CollapseCol';

const TestComponent = () => {
    const openRef = useRef(false);

    return (
        <CollapseCol
            title={'History'}
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
        component = render(
            <TestComponent />
        );
        user = userEvent.setup();
    });

    it('opens when title is clicked', async () => {
        // Get reference to hidden checkbox, confirm not checked
        const checkbox = component.getByRole('checkbox');
        expect(checkbox.checked).toBe(false);

        // Click checkbox (title doesn't work in jsdom), confirm checked
        await user.click(checkbox);
        expect(checkbox.checked).toBe(true);
    });
});
