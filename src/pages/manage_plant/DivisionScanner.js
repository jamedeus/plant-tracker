import { useCallback, memo, lazy, Suspense } from 'react';
import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';
import LoadingAnimation from 'src/components/LoadingAnimation';
import { useSelector, useDispatch } from 'react-redux';
import { divisionScannerOpened } from './interfaceSlice';
import { openDivisionModal, closeDivisionModal } from './modals';
import clsx from 'clsx';

// Dynamic import (don't request webpack bundle until scanner opened)
const QrScanner = lazy(
    () => import(/* webpackChunkName: "qr-scanner" */ 'src/components/QrScanner')
);

// Button shown at bottom of scanner when URL detected, passes UUID to DivisionModal
// Gets scannedUrl and onExit from QrScanner, setScannedUuid from ScannedUrlButtonProps
// (must be passed to DivisionScannerButton by parent)
const ScannedUrlButton = ({ onExit, scannedUrl, setScannedUuid }) => {
    const onConfirm = () => {
        setScannedUuid(scannedUrl.split('/manage/')[1]);
        onExit();
    };

    return (
        <button
            className='btn btn-accent rounded-full text-lg'
            onClick={onConfirm}
            data-testid="confirm-new-qr-code-button"
        >
            Confirm
        </button>
    );
};

ScannedUrlButton.propTypes = {
    onExit: PropTypes.func.isRequired,
    scannedUrl: PropTypes.string.isRequired,
    setScannedUuid: PropTypes.func.isRequired
};

// Button that opens QR scanner to get new plant UUID for DivisionModal(rendered in portal)
const DivisionScannerButton = memo(function DivisionScannerButton({ setScannedUuid }) {
    const dispatch = useDispatch();
    const isOpen = useSelector((state) => state.interface.divisionScannerOpen);

    const open = useCallback(() => {
        // Close DivisionModal (will cover scanner)
        closeDivisionModal();
        dispatch(divisionScannerOpened(true));
    }, [dispatch]);

    const close = useCallback(() => {
        // Reopen DivisionModal (was closed when scanner opened)
        openDivisionModal();
        dispatch(divisionScannerOpened(false));
    }, [dispatch]);

    return (
        <>
            <button className="btn btn-accent" onClick={open}>
                Register with QR code
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
                        onExit={close}
                        ScannedUrlButton={ScannedUrlButton}
                        ScannedUrlButtonProps={{ setScannedUuid: setScannedUuid }}
                        availableOnly={true}
                        instructionsText='Scan the QR code for your new plant'
                    />
                </Suspense>,
                document.body
            )}
        </>
    );
});

DivisionScannerButton.propTypes = {
    setScannedUuid: PropTypes.func.isRequired
};

export default DivisionScannerButton;
