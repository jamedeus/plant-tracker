import React, { memo } from 'react';
import PropTypes from 'prop-types';
import sendPostRequest from 'src/utils/sendPostRequest';
import { openErrorModal } from 'src/components/ErrorModal';
import uuidPropType from 'src/types/uuidPropType';

const ChangeQrModal = memo(function ChangeQrModal({ uuid, close }) {
    const submit = async () => {
        const response = await sendPostRequest('/change_qr_code', {
            uuid: uuid
        });
        if (response.ok) {
            close();
        } else {
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
        }
    };

    return (
        <>
            <div className="min-h-36 flex flex-col justify-evenly mx-auto">
                <p>
                    Get your new QR code ready, then click OK.
                </p>

                <p>
                    You will have 15 minutes to scan the new QR code.
                </p>
            </div>

            <div className="modal-action mt-4">
                <button className="btn btn-accent" onClick={submit}>
                    OK
                </button>
            </div>
        </>
    );
});

ChangeQrModal.propTypes = {
    uuid: uuidPropType.isRequired,
    close: PropTypes.func.isRequired
};

export default ChangeQrModal;
