import { memo, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';
import { showToast } from './Toast';
import { openErrorModal } from './ErrorModal';
import LoadingAnimation from './LoadingAnimation';
import sendPostRequest from 'src/utils/sendPostRequest';
import uuidPropType from 'src/types/uuidPropType';
import clsx from 'clsx';

// Dynamic import (don't request webpack bundle until scanner opened)
const QrScanner = lazy(
    () => import(/* webpackChunkName: "qr-scanner" */ './QrScanner')
);

// Button shown at bottom of scanner when URL detected (navigates to URL)
// Gets scannedUrl and onExit from QrScanner, oldUuid from ScannedUrlButtonProps
// (must be passed to ChangeQrScannerButton by parent)
const ScannedUrlButton = ({ onExit, scannedUrl, oldUuid }) => {
    const navigate = useNavigate();
    // Makes /change_uuid call to confirm new QR code
    const handleAcceptNewQrCode = async () => {
        const response = await sendPostRequest('/change_uuid', {
            uuid: oldUuid,
            new_id: scannedUrl.split('/manage/')[1]
        });
        // Close scanner, show success toast, update current URL (revalidates)
        if (response.ok) {
            onExit();
            showToast('QR code changed!', 'green', 3000);
            const data = await response.json();
            navigate(
                window.location.pathname.replace(oldUuid, data.new_uuid),
                { replace: true }
            );
        } else {
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
        }
    };

    return (
        <button
            className='btn btn-accent rounded-full text-lg'
            onClick={handleAcceptNewQrCode}
            data-testid="confirm-new-qr-code-button"
        >
            Confirm
        </button>
    );
};

ScannedUrlButton.propTypes = {
    onExit: PropTypes.func.isRequired,
    scannedUrl: PropTypes.string.isRequired,
    oldUuid: uuidPropType.isRequired
};

// Button that opens QR scanner in change QR mode (rendered in portal)
const ChangeQrScannerButton = memo(function ChangeQrScannerButton({
    isOpen,
    onOpen,
    onClose,
    oldUuid
}) {
    return (
        <>
            <button className="btn h-8 mt-4 w-full" onClick={onOpen}>
                Change QR Code
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
                        onExit={onClose}
                        ScannedUrlButton={ScannedUrlButton}
                        ScannedUrlButtonProps={{ oldUuid: oldUuid }}
                        availableOnly={true}
                        instructionsText='Scan the new QR code'
                    />
                </Suspense>,
                document.body
            )}
        </>
    );
});

ChangeQrScannerButton.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onOpen: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
    oldUuid: uuidPropType.isRequired
};

export default ChangeQrScannerButton;
