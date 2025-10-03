import { useState, memo, lazy, Suspense } from 'react';
import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { LuScanSearch } from "react-icons/lu";
import LoadingAnimation from './LoadingAnimation';
import CloseButtonIcon from 'src/components/CloseButtonIcon';
import clsx from 'clsx';

// Dynamic import (don't request webpack bundle until scanner opened)
const QrScanner = lazy(
    () => import(/* webpackChunkName: "qr-scanner" */ './QrScanner')
);

// Button shown at bottom of scanner when URL detected (navigates to URL)
export const ScannedUrlButton = ({ scannedUrl, onExit }) => {
    return (
        <Link
            to={scannedUrl}
            className='btn btn-accent rounded-full text-lg'
            data-testid="scanned-url"
            key={scannedUrl}
            onClick={onExit}
            discover="none"
        >
            Open
        </Link>
    );
};

ScannedUrlButton.propTypes = {
    scannedUrl: PropTypes.string.isRequired,
    onExit: PropTypes.func.isRequired
};

// Button that toggles QR scanner visibility (rendered in portal)
const QrScannerButton = memo(function QrScannerButton() {
    const [isOpen, setIsOpen] = useState(false);

    const toggleScanner = () => {
        setIsOpen(!isOpen);
    };

    const closeScanner = () => {
        setIsOpen(false);
    };

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
                    <QrScanner
                        onExit={closeScanner}
                        ScannedUrlButton={ScannedUrlButton}
                    />
                </Suspense>,
                document.body
            )}
        </>
    );
});

export default QrScannerButton;
