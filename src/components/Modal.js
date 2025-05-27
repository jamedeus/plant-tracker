import React, { useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import PropTypes from 'prop-types';
import CloseButtonIcon from 'src/components/CloseButtonIcon';

// Reusable modal component with forwardRef that allows rendering contents
// before modal is opened, can be closed with button or by clicking outside
const Modal = forwardRef(function Modal({ title, children, className='', onClose }, ref) {
    // Don't render children until modal has been opened, keep rendered after
    const [hasBeenOpened, setHasBeenOpened] = React.useState(false);

    const dialogRef = useRef(null);

    // Allow parent component to pre-render modal contents before opening
    useImperativeHandle(ref, () => ({
        preload: () => setHasBeenOpened(true),
        open: () => dialogRef.current.showModal(),
        close: () => dialogRef.current.close()
    }));

    // Render contents when modal opened for first time
    useEffect(() => {
        /* istanbul ignore else */
        if (dialogRef.current) {
            // Set state the first time modal is opened
            const observer = new MutationObserver(() => {
                const open = dialogRef.current.hasAttribute("open");
                if (open && !hasBeenOpened) {
                    setHasBeenOpened(true);
                }
            });

            observer.observe(dialogRef.current, { attributes: true });

            return () => observer.disconnect();
        }
    }, [dialogRef, hasBeenOpened]);

    return (
        <dialog className="modal" ref={dialogRef} onClose={onClose}>
            <div className={`modal-box text-center flex flex-col pt-4 ${className}`}>
                <form method="dialog">
                    <button
                        className="btn-close absolute right-4 top-4"
                        aria-label="Close modal"
                    >
                        <CloseButtonIcon />
                    </button>
                </form>

                {title && (
                    <h1 className="font-bold text-lg leading-8 md:text-xl mb-3">
                        {title}
                    </h1>
                )}

                {hasBeenOpened && children}
            </div>
            <form method="dialog" className="modal-backdrop">
                <button>close</button>
            </form>
        </dialog>
    );
});

Modal.propTypes = {
    title: PropTypes.string,
    children: PropTypes.node.isRequired,
    className: PropTypes.string,
    onClose: PropTypes.func
};

export default Modal;
