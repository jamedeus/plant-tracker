import React, {
    forwardRef,
    useCallback,
    useImperativeHandle,
    useRef,
    useState,
    Suspense
} from 'react';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';
import { useSwipeable } from 'react-swipeable';
import LoadingAnimation from './LoadingAnimation';
import CloseButtonIcon from './CloseButtonIcon';
import { useCloseWithEscKey } from 'src/hooks/useCloseWithEscKey';

// Helper hook to get ref and open/close methods for LazyModal
export function useModal() {
    const ref = useRef(null);
    const open = useCallback((props) => ref.current?.open(props), []);
    const close = useCallback(() => ref.current?.close(), []);
    return { ref, open, close };
}

// Reusable lazy load modal component controlled by forwardRef.
//
// Takes dynamic import function with contents component, lazy loads and mounts
// in portal when modal is opened, fully unmounts when closed.
//
// Ref has open and close methods, open method takes props to pass to contents.
//
// Contents component will receive any props passed to open as well as the close
// callback (closes modal) and setOnClose (takes function to call on close).
const LazyModal = forwardRef(function LazyModal({ load, title, className }, ref) {
    // Renders modal in portal if true
    const [isOpen, setIsOpen] = useState(false);
    // Adds modal-open class if true (starts open animation)
    const [active, setActive] = useState(false);
    // Adds translate down to close animation if true (user closed with swipe)
    const [isSwipeClosing, setIsSwipeClosing] = useState(false);
    // Props passed to lazy loaded contents component (pass to open in parent)
    const [contentProps, setContentProps] = useState({});
    // Stores lazy loaded contents component
    const LazyComponentRef = useRef(null);
    // Stores callback set by lazy loaded contents, runs when modal closes
    const onCloseRef = useRef(null);

    const open = useCallback((props) => {
        // Load contents component and set props passed to it if given
        setContentProps(props);
        if (!LazyComponentRef.current) {
            LazyComponentRef.current = React.lazy(load);
        }
        // Render modal in portal, start open animation on next frame
        setIsOpen(true);
        requestAnimationFrame(() => setActive(true));
    }, []);

    const close = useCallback(() => {
        // Run callback set by child if set
        onCloseRef.current?.();
        // Start close animation
        setActive(false);
        // Unmount after animation completes (300ms + 50ms buffer)
        const timer = setTimeout(() => {
            setIsOpen(false);
            // Prevent sliding up next time modal opened (if closed with swipe)
            setIsSwipeClosing(false);
            onCloseRef.current = null;
        }, 350);
        return () => clearTimeout(timer);
    }, []);

    // Closes modal with slide down animation in addition to fade
    const closeWithSwipe = useCallback(() => {
        setIsSwipeClosing(true);
        close();
    }, []);

    // Close modal by swiping down from title
    const handlers = useSwipeable({
        onSwipedDown: closeWithSwipe,
        ...{
            delta: 50,
            preventScrollOnSwipe: true,
            trackMouse: true,
        },
    });

    // Close modal by pressing escape key
    useCloseWithEscKey(isOpen, close);

    // Expose open and close methods to parent
    useImperativeHandle(ref, () => ({ open, close }), [open, close]);

    // Don't render in portal until user opens modal
    if (!isOpen) {
        return null;
    }

    return createPortal(
        <div
            className={clsx("modal", active && "modal-open")}
            aria-modal="true"
            role="dialog"
        >
            <div className={clsx(
                "modal-box text-center flex flex-col pt-4",
                isSwipeClosing && "translate-y-1/3 md:translate-y-full",
                className
            )}>
                {/* Swipe to close hitbox (top 4rem of modal, full width) */}
                <div
                    className="absolute inset-0 h-16"
                    data-testid="modal-swipe-hitbox"
                    {...handlers}
                ></div>
                {/* Close button */}
                <button
                    className="btn-close absolute right-4 top-4"
                    aria-label="Close modal"
                    onClick={close}
                >
                    <CloseButtonIcon />
                </button>

                {/* Render title if given (can also render this in contents */}
                {title && (
                    <h3 className="font-bold text-lg leading-8 md:text-xl mb-3">
                        {title}
                    </h3>
                )}

                {/* Show loading spinner while lazy loading contents bundle */}
                <Suspense fallback={<LoadingAnimation className="mt-2 mx-auto" />}>
                    {LazyComponentRef.current && (
                        <LazyComponentRef.current
                            {...contentProps}
                            close={close}
                            setOnClose={(fn) => { onCloseRef.current = fn; }}
                        />
                    )}
                </Suspense>
            </div>

            {/* Fullscreen backdrop (click to close) */}
            <div className="modal-backdrop">
                <button onClick={close}>close</button>
            </div>
        </div>,
        document.body
    );
});

LazyModal.propTypes = {
    load: PropTypes.func.isRequired,
    title: PropTypes.string,
    className: PropTypes.string
};

export default LazyModal;
