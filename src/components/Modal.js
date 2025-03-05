import React from 'react';
import PropTypes from 'prop-types';
import { XMarkIcon } from '@heroicons/react/16/solid';

// Reusable modal component, can be closed with button or by clicking outside
const Modal = ({ dialogRef, title, children, className='', onClose }) => {
    // Don't render children until modal has been opened, keep rendered after
    const [hasBeenOpened, setHasBeenOpened] = React.useState(false);

    React.useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        // Set state the first time modal is opened
        const observer = new MutationObserver(() => {
            const open = dialog.hasAttribute("open");
            if (open && !hasBeenOpened) {
                setHasBeenOpened(true);
            }
        });

        observer.observe(dialog, { attributes: true });

        return () => observer.disconnect();
    }, [dialogRef, hasBeenOpened]);

    return (
        <dialog className="modal" ref={dialogRef} onClose={onClose}>
            <div className={`modal-box text-center flex flex-col pt-4 ${className}`}>
                <form method="dialog">
                    <button className="btn-close absolute right-4 top-4">
                        <XMarkIcon className="w-8 h-8" />
                    </button>
                </form>

                {title && (
                    <h1 className="font-bold text-lg md:text-xl mb-4">
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
};

Modal.propTypes = {
    dialogRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ]).isRequired,
    title: PropTypes.string,
    children: PropTypes.node.isRequired,
    className: PropTypes.string,
    onClose: PropTypes.func
};

export default Modal;
