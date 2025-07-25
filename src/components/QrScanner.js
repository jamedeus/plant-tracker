import { useState, useRef, memo } from 'react';
import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';
import { LuScanSearch } from "react-icons/lu";
import { Scanner } from '@yudiel/react-qr-scanner';
import CloseButtonIcon from 'src/components/CloseButtonIcon';
import useSound from 'use-sound';
import error from 'src/sounds/error.mp3';
import completed from 'src/sounds/completed.mp3';
import 'src/css/qrscanner.css';
import clsx from 'clsx';

const GREEN_FILL = 'oklch(0.7451 0.167 183.61 / 0.35)';
const GREEN_OUTLINE = 'oklch(0.7451 0.167 183.61 / 1)';
const RED_FILL = 'oklch(0.7176 0.221 22.18 / 0.35)';
const RED_OUTLINE = 'oklch(0.7176 0.221 22.18 / 1)';

// Returns true if URL has same domain as current URL, false if not part of app
const urlIsSupported = (url) => {
    return url.startsWith(window.location.origin);
};

const highlightQrCodes = (codes, ctx) => {
    codes.forEach(code => {
        // Get coordinates of each corner
        const corners = code.cornerPoints;
        if (!corners || corners.length !== 4) return;

        // Draw outline around QR code
        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < corners.length; i++) {
            ctx.lineTo(corners[i].x, corners[i].y);
        }
        ctx.closePath();

        // Green outline if URL is part of app, red if unsupported
        const match = urlIsSupported(code.rawValue);
        ctx.strokeStyle = match ? GREEN_OUTLINE : RED_OUTLINE;
        ctx.lineWidth = 4;
        ctx.stroke();
        // Fill with same color, semi-transparent
        ctx.fillStyle = match ? GREEN_FILL : RED_FILL;
        ctx.fill();
    });
};

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
    // Get notification sounds
    const [playMatch] = useSound(completed);
    const [playError] = useSound(error);
    // Track URLs that have already been matched (don't play sounds twice)
    const matchedUrls = useRef([]);
    const matchedErrorUrls = useRef([]);

    const handleScan = (result) => {
        result.forEach(code => {
            if (urlIsSupported(code.rawValue)) {
                // Show button to open scanned URL
                setScannedUrl(code.rawValue);
                // Play sound first time valid QR code is scanned
                if (!matchedUrls.current.includes(code.rawValue)) {
                    playMatch();
                    matchedUrls.current.push(code.rawValue);
                }
            // Play sound first time invalid QR code is scanned
            } else if (!matchedErrorUrls.current.includes(code.rawValue)) {
                playError();
                matchedErrorUrls.current.push(code.rawValue);
            }
        });
    };

    return (
        <div
            className="fixed inset-0 bg-black z-90"
            data-testid="qr-scanner-overlay"
        >
            <Scanner
                onScan={handleScan}
                onError={onExit}
                formats={["qr_code"]}
                components={{
                    tracker: highlightQrCodes,
                    onOff: false,
                    torch: true,
                    zoom: true,
                    finder: true,
                }}
                sound={false}
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
