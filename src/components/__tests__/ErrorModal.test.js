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

        // Confirm modal is not rendered, mock error text is not present
        expect(component.queryByTestId('error-modal-body')).toBeNull();
        expect(component.queryByText('Error message here')).toBeNull();

        // Click button to show modal, confirm modal appeared with error text
        await user.click(component.getByText('Open Error Modal'));
        expect(component.getByTestId('error-modal-body')).toBeInTheDocument();
        expect(component.getByTestId('error-modal-body')).toHaveTextContent(
            'Error message here'
        );
    });

    it('converts objects passed to openErrorModal to string', async () => {
        // Render component
        const user = userEvent.setup();
        const component = render(
            <>
                <button onClick={() => openErrorModal({ error: 'Error message here' })}>
                    Open Error Modal
                </button>
                <ErrorModal />
            </>
        );

        // Confirm modal is not rendered, mock error text is not present
        expect(component.queryByTestId('error-modal-body')).toBeNull();
        expect(component.queryByText('Error message here')).toBeNull();

        // Click button to show modal, confirm modal appeared with error text
        await user.click(component.getByText('Open Error Modal'));
        expect(component.getByTestId('error-modal-body')).toBeInTheDocument();
        expect(component.getByTestId('error-modal-body')).toHaveTextContent(
            '{"error":"Error message here"}'
        );
    });
});
