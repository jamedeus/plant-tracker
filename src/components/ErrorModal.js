import PropTypes from 'prop-types';
import clsx from 'clsx';
import LazyModal, { useModal } from 'src/components/LazyModal';

export let openErrorModal;

const ErrorModalBody = ({ close, error }) => {
    return (
        <>
            <div
                className={clsx(
                    'flex flex-col flex-1 justify-center max-w-full mx-auto',
                    'min-h-36 overflow-y-auto whitespace-pre-line break-words'
                )}
                data-testid="error-modal-body"
            >
                {error}
            </div>
            <div className="modal-action">
                <button className="btn btn-accent" onClick={close}>
                    OK
                </button>
            </div>
        </>
    );
};

ErrorModalBody.propTypes = {
    close: PropTypes.func.isRequired,
    error: PropTypes.string.isRequired
};

export const ErrorModal = () => {
    const errorModal = useModal();

    // Takes error message to show inside modal
    openErrorModal = (error) => {
        // Skip mock error returned by sendPostRequest after login redirect
        if (error === 'spa-redirect' || error === JSON.stringify('spa-redirect')) {
            return;
        }

        // Stringify if received raw JSON response
        errorModal.open({
            error: typeof(error) === 'object' ? JSON.stringify(error) : error
        });
    };

    return (
        <LazyModal
            ref={errorModal.ref}
            title="Error"
            ariaLabel="Error modal"
            load={() => Promise.resolve({ default: ErrorModalBody })}
        />
    );
};
