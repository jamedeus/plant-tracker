import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import Modal from 'src/components/Modal';
import { sendPostRequest } from 'src/util';
import { useErrorModal } from 'src/context/ErrorModalContext';

let changeQrModalRef;

export const openChangeQrModal = () => {
    changeQrModalRef.current.showModal();
};

const ChangeQrModal = ({ plantID }) => {
    changeQrModalRef = useRef(null);

    // Get hook to show error modal
    const { showErrorModal } = useErrorModal();

    const submit = async () => {
        const response = await sendPostRequest(
            '/change_qr_code',
            {plant_id: plantID}
        );
        if (response.ok) {
            changeQrModalRef.current.close();
        } else {
            const error = await response.json();
            showErrorModal(JSON.stringify(error));
        }
    };

    return (
        <Modal dialogRef={changeQrModalRef} title={"Change QR Code"}>
            <div className="min-h-36 flex flex-col justify-center mx-auto">
                <p>
                    Click the OK button when you&apos;re ready,
                    then scan the new QR code within 15 minutes.
                </p>
            </div>

            <button className="btn btn-success mx-auto" onClick={submit}>
                OK
            </button>
        </Modal>
    );
};

ChangeQrModal.propTypes = {
    plantID: PropTypes.string
};

export default ChangeQrModal;
