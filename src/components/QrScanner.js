import { useState, memo } from 'react';
import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';
import { LuScanSearch } from "react-icons/lu";
import { Scanner, outline } from '@yudiel/react-qr-scanner';
import CloseButtonIcon from 'src/components/CloseButtonIcon';
import clsx from 'clsx';

// Button that toggles QR scanner visibility (rendered in portal)
const QrScannerButton = memo(function QrScannerButton() {
    const [isOpen, setIsOpen] = useState(false);

    const toggleScanner = () => {
        setIsOpen(!isOpen);
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
                <QrScanner onExit={() => setIsOpen(false)} />,
                document.body
            )}
        </>
    );
});

// Full-screen QR scanner overlay
// Lower Z index than navbar (keep close button visible)
const QrScanner = ({ onExit }) => {
    const [scannedUrl, setScannedUrl] = useState(null);

    return (
        <div
            className="fixed inset-0 bg-black z-90"
            data-testid="qr-scanner-overlay"
        >
            <Scanner
                onScan={(result) => setScannedUrl(result[0].rawValue)}
                onError={onExit}
                formats={["qr_code"]}
                components={{
                    tracker: outline,
                    onOff: true,
                    torch: true,
                    zoom: true,
                    finder: true,
                }}
            />
            {scannedUrl && (
                <a
                    href={scannedUrl}
                    className={clsx(
                        'absolute bottom-4 btn btn-accent rounded-full text-lg',
                        'left-1/2 -translate-x-1/2'
                    )}
                    data-testid="scanned-url"
                >
                    Open
                </a>
            )}
        </div>
    );
};

QrScanner.propTypes = {
    onExit: PropTypes.func.isRequired,
};

export default QrScannerButton;
