import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { v4 as uuidv4 } from 'uuid';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import sendPostRequest from 'src/utils/sendPostRequest';
import { showToast } from 'src/components/Toast';

const RemoveQrModal = memo(function RemoveQrModal({ close }) {
    const navigate = useNavigate();
    const uuid = useSelector((state) => state.plant.plantDetails.uuid);

    // Change to a random UUID, close modal, update URL
    const submit = async () => {
        const payload = { uuid: uuid, new_id: uuidv4() };
        const onSuccess = (data) => {
            showToast('QR code removed', 'green', 2000);
            navigate(`/manage/${data.new_uuid}`, { replace: true });
            close();
        };
        await sendPostRequest('/change_uuid', payload, onSuccess);
    };

    return (
        <>
            <div className="flex flex-col justify-evenly gap-8 my-8 mx-auto">
                <span>
                    After removing the QR code you&lsquo;ll be able to reuse
                    the sticker for a new plant.
                </span>

                <span>
                    Scanning it will no longer bring you to this history page,
                    but you can still find it on the archive page.
                </span>
            </div>

            <div className="modal-action mt-4">
                <button className="btn" onClick={close}>
                    Cancel
                </button>
                <button className="btn btn-accent" onClick={submit}>
                    Remove
                </button>
            </div>
        </>
    );
});

RemoveQrModal.propTypes = {
    close: PropTypes.func.isRequired
};

export default RemoveQrModal;
