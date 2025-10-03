import { useState, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Scanner } from '@yudiel/react-qr-scanner';
import useSound from 'use-sound';
import error from 'src/sounds/error.mp3';
import completed from 'src/sounds/completed.mp3';
import sendPostRequest from 'src/utils/sendPostRequest';
import 'src/css/qrscanner.css';

const GREEN_FILL = 'oklch(0.7451 0.167 183.61 / 0.35)';
const GREEN_OUTLINE = 'oklch(0.7451 0.167 183.61 / 1)';
const RED_FILL = 'oklch(0.7176 0.221 22.18 / 0.35)';
const RED_OUTLINE = 'oklch(0.7176 0.221 22.18 / 1)';
const GREY_FILL = 'oklch(0.469 0.021108 254.139175 / 0.35)';
const GREY_OUTLINE = 'oklch(0.469 0.021108 254.139175 / 1)';

// Returns true if URL has same domain as current URL, false if not part of app
const urlIsSupported = (url) => {
    try {
        const scannedUrl = new URL(url);
        return scannedUrl.host === window.location.host;
    } catch (e) {
        return false;
    }
};

// Takes scanned URL, returns true if UUID is available, false if already used
const urlIsAvailable = async (url) => {
    const uuid = url.split('/manage/')[1];
    const response = await sendPostRequest('/is_uuid_available', {uuid: uuid});
    return response.ok;
};

// Full-screen QR scanner overlay, lower Z index than navbar (keep nav visible)
// Highlights QR codes with same domain as app with green outline, others red
// When availableOnly is true only highlights QR codes with unused UUIDs
// Renders ScannedUrlButton component when QR code detected withURL and onExit
// callback as props (use ScannedUrlButtonProps to pass additional props)
const QrScanner = ({
    onExit,
    ScannedUrlButton,
    ScannedUrlButtonProps = {},
    availableOnly = false,
    instructionsText = 'Point the camera at a QR code'
}) => {
    const [scannedUrl, setScannedUrl] = useState(null);
    // Get notification sounds
    const [playMatch] = useSound(completed);
    const [playError] = useSound(error);
    // Track URLs that have already been matched (don't play sounds twice)
    const matchedUrls = useRef([]);
    const matchedErrorUrls = useRef([]);
    // Track availability of each scanned URL (don't send request on each frame)
    // Stores objects with validand promise keys (see urlIsValid)
    const availabilityCache = useRef(new Map());

    // Returns object with valid key (true, false, undefined if waiting on
    // promise) and promise key (sets valid key and returns value once resolved)
    //
    // If availableOnly is true promise is an API call that handleScan can await
    // (returns available bool), otherwise it's a placeholder that returns valid
    const urlIsValid = useCallback((url) => {
        let entry = availabilityCache.current.get(url);
        if (entry) return entry;

        // Unsupported URLs are immediately false
        if (!urlIsSupported(url)) {
            entry = { valid: false, promise: Promise.resolve(false) };

        // If not checking availability, immediately true
        } else if (!availableOnly) {
            entry = { valid: true, promise: Promise.resolve(true) };

        // If checking availability start API call, cache with pending promise
        } else {
            entry = { valid: undefined, promise: (async () => {
                try {
                    const available = await urlIsAvailable(url);
                    entry.valid = available;
                    entry.promise = Promise.resolve(available);
                    return available;
                } catch {
                    entry.valid = false;
                    entry.promise = Promise.resolve(false);
                    return false;
                }
            })()};
        }

        availabilityCache.current.set(url, entry);
        return entry;
    }, []);

    const handleScan = (result) => {
        result.forEach(async code => {
            if(await urlIsValid(code.rawValue).promise) {
                // Show button to open scanned URL
                setScannedUrl(new URL(code.rawValue).pathname);
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

    const highlightQrCodes = useCallback((codes, ctx) => {
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

            // Set colors (solid border, fill same color semi-transparent)
            // Green = supported, red = unsupported, grey = waiting on request
            switch (urlIsValid(code.rawValue).valid) {
                case true:
                    ctx.fillStyle = GREEN_FILL;
                    ctx.strokeStyle = GREEN_OUTLINE;
                    break;
                case false:
                    ctx.fillStyle = RED_FILL;
                    ctx.strokeStyle = RED_OUTLINE;
                    break;
                default:
                    ctx.fillStyle = GREY_FILL;
                    ctx.strokeStyle = GREY_OUTLINE;
                    break;
            }
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.fill();
        });
    }, []);

    return (
        <div
            className="fixed inset-0 bg-black z-90 overscroll-none touch-none"
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
            <div
                id="qr-scanner-footer"
                className='absolute bottom-8 left-1/2 -translate-x-1/2'
            >
                {scannedUrl ? (
                    <ScannedUrlButton
                        scannedUrl={scannedUrl}
                        key={scannedUrl}
                        onExit={onExit}
                        {...ScannedUrlButtonProps}
                    />
                ) : (
                    <div className="qr-scanner-instructions">
                        {instructionsText}
                    </div>
                )}
            </div>
        </div>
    );
};

QrScanner.propTypes = {
    onExit: PropTypes.func.isRequired,
    ScannedUrlButton: PropTypes.elementType.isRequired,
    ScannedUrlButtonProps: PropTypes.object,
    availableOnly: PropTypes.bool,
    instructionsText: PropTypes.string
};

export default QrScanner;
