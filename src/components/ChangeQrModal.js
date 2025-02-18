import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import Modal from 'src/components/Modal';
import { sendPostRequest } from 'src/util';
import { showErrorModal } from 'src/components/ErrorModal';

let changeQrModalRef;

export const openChangeQrModal = () => {
    changeQrModalRef.current.showModal();
};

const ChangeQrModal = ({ uuid }) => {
    changeQrModalRef = useRef(null);

    const submit = async () => {
        const response = await sendPostRequest(
            '/change_qr_code',
            {uuid: uuid}
        );
        if (response.ok) {
            changeQrModalRef.current.close();
        } else {
            const error = await response.json();
            showErrorModal(JSON.stringify(error));
        }
    };

    return (
        <Modal dialogRef={changeQrModalRef} title='Change QR Code'>
            <div className="min-h-36 flex flex-col justify-evenly mx-auto">
                <p>
                    Get your new QR code ready, then click OK.
                </p>

                <p>
                    You will have 15 minutes to scan the new QR code.
                </p>
            </div>

            <button className="btn btn-success mx-auto mt-4" onClick={submit}>
                OK
            </button>
        </Modal>
    );
};

ChangeQrModal.propTypes = {
    uuid: PropTypes.string.isRequired
};

export default ChangeQrModal;
