import React, { useRef, memo } from 'react';
import PropTypes from 'prop-types';
import Modal from 'src/components/Modal';
import DatetimeInput from 'src/components/DatetimeInput';
import { localToUTC } from 'src/timestampUtils';
import { sendPostRequest } from 'src/util';
import { openErrorModal } from 'src/components/ErrorModal';
import { useSelector, } from 'react-redux';

let modalRef;

export const openDivisionModal = () => {
    modalRef.current.open();
};

const DivisionModal = () => {
    modalRef = useRef(null);

    const plantID = useSelector((state) => state.plant.plantDetails.uuid);

    // Ref to access timestamp input
    const timestampRef = useRef(null);

    const submit = async () => {
        const payload = {
            plant_id: plantID,
            timestamp: localToUTC(timestampRef.current.value)
        };
        const response = await sendPostRequest('/divide_plant', payload);
        if (response.ok) {
            modalRef.current.close();
        } else {
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
        }
    };

    return (
        <Modal title='Divide Plant' ref={modalRef}>
            <div className="min-h-36 max-w-86 flex flex-col justify-evenly gap-6 mx-auto">
                <div>
                    <DatetimeInput inputRef={timestampRef} />
                </div>
                <p>
                    Dividing a plant lets you register new plants with a link to the parent plant in their history.
                </p>
                <p>
                    This is great for splitting up seedling trays into pots, or dividing house plants.
                </p>
                <p>
                    Each new plant gets its own QR code. We recommend putting QR codes on all the new pots before continuing.
                </p>

                <p>
                    Once you&lsquo;re ready press OK - you&lsquo;ll have 15 minutes to scan the new QR codes.
                </p>
            </div>

            <div className="modal-action mt-6">
                <button className="btn btn-accent" onClick={submit}>
                    OK
                </button>
            </div>
        </Modal>
    );
};

export default DivisionModal;
