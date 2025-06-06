import { ErrorModal, openErrorModal } from 'src/components/ErrorModal';

describe('ErrorModal', () => {
    it('opens error modal when method called', async () => {
        // Render component
        const user = userEvent.setup();
        const component = render(
            <>
                <button onClick={() => openErrorModal('Error message here')}>
                    Open Error Modal
                </button>
                <ErrorModal />
            </>
        );

        // Confirm mock error text is not present
        expect(component.queryByText('Error message here')).toBeNull();

        // Click button to show modal, confirm error text appears
        await user.click(component.getByText('Open Error Modal'));
        expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
        expect(component.queryByText('Error message here')).not.toBeNull();
    });
});
