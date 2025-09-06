import DropdownButton from '../DropdownButton';

const TestComponent = () => (
    <DropdownButton title="Navigation menu" className="btn">
        <span data-testid="icon">☰</span>
    </DropdownButton>
);

describe('DropdownButton', () => {
    it('opens dropdown on first click (button focused)', async () => {
        const user = userEvent.setup();
        const component = render(<TestComponent />);

        // Confirm button is not focused (dropdown closed via CSS)
        const button = component.getByRole('button');
        expect(button).not.toHaveFocus();

        // Click button, confirm focused (dropdown opened via CSS)
        await user.click(button);
        expect(button).toHaveFocus();
    });

    it('closes dropdown on second click (button blurs)', async () => {
        const user = userEvent.setup();
        const component = render(<TestComponent />);

        // Click button, confirm focused (dropdown opened via CSS)
        const button = component.getByRole('button');
        await user.click(button);
        expect(button).toHaveFocus();

        // Click button again, confirm no longer focused (dropdown closed)
        await user.click(button);
        expect(button).not.toHaveFocus();
    });

    it('behaves the same when child (icon) clicked instead of button', async () => {
        const user = userEvent.setup();
        const component = render(<TestComponent />);

        // Click icon (not button), confirm button was focused (dropdown opened)
        const button = component.getByRole('button');
        const icon = component.getByTestId('icon');
        await user.click(icon);
        expect(button).toHaveFocus();

        // Click icon again, confirm button no longer focused (dropdown closed)
        await user.click(icon);
        expect(button).not.toHaveFocus();
        expect(document.body).toHaveFocus();
    });
});
