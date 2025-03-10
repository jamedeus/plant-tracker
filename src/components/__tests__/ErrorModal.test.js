import { PageWrapper } from 'src/index';
import { openErrorModal } from 'src/components/ErrorModal';

describe('ErrorModal', () => {
    const TestComponent = () => {
        return (
            <button onClick={() => openErrorModal('Error message here')}>
                Open Error Modal
            </button>
        );
    };

    it('opens error modal when method called', async () => {
        // Render component
        const user = userEvent.setup();
        const component = render(
            <PageWrapper>
                <TestComponent />
            </PageWrapper>
        );

        // Confirm mock error text is not present
        expect(component.queryByText('Error message here')).toBeNull();

        // Click button to show modal, confirm error text appears
        await user.click(component.getByText('Open Error Modal'));
        expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
        expect(component.queryByText('Error message here')).not.toBeNull();

        // Click OK button, confirm modal closes
        await user.click(component.getByText('OK'));
        expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
    });
});
