import { useState, memo, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { LuScanSearch } from "react-icons/lu";
import LoadingAnimation from './LoadingAnimation';
import CloseButtonIcon from 'src/components/CloseButtonIcon';
import { useBackButton } from 'src/useBackButton';
import clsx from 'clsx';

// Dynamic import (don't request webpack bundle until scanner opened)
const QrScanner = lazy(
    () => import(/* webpackChunkName: "qr-scanner" */ './QrScanner')
);

// Button that toggles QR scanner visibility (rendered in portal)
const QrScannerButton = memo(function QrScannerButton() {
    const [isOpen, setIsOpen] = useState(false);

    const toggleScanner = () => {
        setIsOpen(!isOpen);
    };

    const closeScanner = () => {
        setIsOpen(false);
    };

    // Close scanner if user navigates back to page by pressing back button
    // Fixes blank scanner (no camera permission, does not re-prompt)
    useBackButton(closeScanner);

    return (
        <>
            <button
                className="btn btn-ghost btn-circle size-12"
                title={isOpen ? 'Close QR scanner' : 'Open QR scanner'}
                aria-label={isOpen ? 'Close QR scanner' : 'Open QR scanner'}
                onClick={toggleScanner}
            >
                {isOpen ? (
                    <CloseButtonIcon />
                ) : (
                    <LuScanSearch className="size-6" />
                )}
            </button>
            {isOpen && createPortal(
                <Suspense fallback={
                    <div className={clsx(
                        "fixed inset-0 bg-black z-90",
                        "flex items-center justify-center"
                    )}>
                        <LoadingAnimation />
                    </div>
                }>
                    <QrScanner onExit={closeScanner} />
                </Suspense>,
                document.body
            )}
        </>
    );
});

export default QrScannerButton;
