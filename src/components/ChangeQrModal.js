import React, { useRef, memo } from 'react';
import PropTypes from 'prop-types';
import Modal from 'src/components/Modal';
import { sendPostRequest } from 'src/util';
import { openErrorModal } from 'src/components/ErrorModal';

let modalRef;

export const openChangeQrModal = () => {
    modalRef.current.open();
};

const ChangeQrModal = memo(function ChangeQrModal({ uuid }) {
    modalRef = useRef(null);

    const submit = async () => {
        const response = await sendPostRequest(
            '/change_qr_code',
            {uuid: uuid}
        );
        if (response.ok) {
            modalRef.current.close();
        } else {
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
        }
    };

    return (
        <Modal title='Change QR Code' ref={modalRef}>
            <div className="min-h-36 flex flex-col justify-evenly mx-auto">
                <p>
                    Get your new QR code ready, then click OK.
                </p>

                <p>
                    You will have 15 minutes to scan the new QR code.
                </p>
            </div>

            <button className="btn btn-accent mx-auto mt-4" onClick={submit}>
                OK
            </button>
        </Modal>
    );
});

ChangeQrModal.propTypes = {
    uuid: PropTypes.string.isRequired
};

export default ChangeQrModal;
