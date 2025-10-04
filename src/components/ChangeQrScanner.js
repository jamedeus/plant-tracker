import { memo, lazy, Suspense } from 'react';
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
const ScannedUrlButton = ({ scannedUrl, onExit, oldUuid, updateUuid }) => {
    // Makes /change_uuid call to confirm new QR code
    const handleAcceptNewQrCode = async () => {
        const response = await sendPostRequest('/change_uuid', {
            uuid: oldUuid,
            new_id: scannedUrl.split('/manage/')[1]
        });
        // Close scanner and show success toast
        if (response.ok) {
            onExit();
            showToast('QR code changed!', 'green', 3000);
            const data = await response.json();
            updateUuid(data.new_uuid);
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
    scannedUrl: PropTypes.string.isRequired,
    onExit: PropTypes.func.isRequired,
    oldUuid: uuidPropType.isRequired,
    updateUuid: PropTypes.func.isRequired
};

// Button that opens QR scanner (rendered in portal)
const ChangeQrScannerButton = memo(function ChangeQrScannerButton({ oldUuid, updateUuid, isOpen, onOpen, onClose }) {
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
                        ScannedUrlButtonProps={{oldUuid: oldUuid, updateUuid: updateUuid}}
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
    oldUuid: uuidPropType.isRequired,
    updateUuid: PropTypes.func.isRequired,
    isOpen: PropTypes.bool.isRequired,
    onOpen: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired
};

export default ChangeQrScannerButton;
