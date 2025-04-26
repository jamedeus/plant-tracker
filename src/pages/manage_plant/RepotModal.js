import React, { useState, useRef, Fragment, memo } from 'react';
import PropTypes from 'prop-types';
import { RadioGroup } from '@headlessui/react';
import Modal from 'src/components/Modal';
import DatetimeInput from 'src/components/DatetimeInput';
import { localToUTC } from 'src/timestampUtils';
import { sendPostRequest } from 'src/util';
import { openErrorModal } from 'src/components/ErrorModal';
import { openChangeQrModal } from 'src/components/ChangeQrModal';
import { useSelector, useDispatch } from 'react-redux';
import { eventAdded } from './timelineSlice';
import { plantRepotted } from './plantSlice';

let modalRef;

export const openRepotModal = () => {
    modalRef.current.open();
};

// Takes integer pot size, renders round div with number centered
const PotSizeOption = memo(function PotSizeOption({ option }) {
    return (
        <RadioGroup.Option value={option} as={Fragment}>
            <div className='pot-size size-10 md:size-12'>
                <span className="m-auto">{option}</span>
            </div>
        </RadioGroup.Option>
    );
});

PotSizeOption.propTypes = {
    option: PropTypes.number.isRequired
};

const RepotModal = () => {
    modalRef = useRef(null);

    const dispatch = useDispatch();
    const plantID = useSelector((state) => state.plant.plantDetails.uuid);
    const currentPotSize = useSelector((state) => state.plant.plantDetails.pot_size);

    // Pot size options (inches)
    const potSizes = [2, 3, 4, 6, 8, 10, 12, 14, 18, 21];

    // Refs to access custom pot size input, timestamp input
    const customPotRef = useRef(null);
    const repotTimeRef = useRef(null);

    // Default to next size if currentPotSize set, otherwise default to 2in
    const [selected, setSelected] = useState((() => {
        if (currentPotSize && potSizes.includes(parseInt(currentPotSize))) {
            return potSizes[potSizes.indexOf(parseInt(currentPotSize)) + 1];
        } else {
            return 2;
        }
    })());

    const isInt = (value) => {
        return !isNaN(value) &&
        parseInt(Number(value)) == value &&
        !isNaN(parseInt(value, 10));
    };

    // Post user selection to backend, create RepotEvent in database
    const submit = async () => {
        const payload = {
            plant_id: plantID,
            new_pot_size: null,
            timestamp: localToUTC(repotTimeRef.current.value)
        };

        // Selected will be integer value of chosen option, or "custom" if the
        // custom pot size input is selected
        if (isInt(selected)) {
            payload.new_pot_size = parseInt(selected);
        } else {
            payload.new_pot_size = parseInt(customPotRef.current.value);
        }

        const response = await sendPostRequest('/repot_plant', payload);
        if (response.ok) {
            // Update plantDetails state, add event to events state
            dispatch(plantRepotted(payload.new_pot_size));
            dispatch(eventAdded({timestamp: payload.timestamp, type: 'repot'}));
            // Close repot modal, open modal with instructions to change QR code
            modalRef.current.close();
            openChangeQrModal();
        } else {
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
        }
    };

    return (
        <Modal title='Repot plant' ref={modalRef}>
            <div className="mt-4">
                <p>Repot time</p>
                <DatetimeInput inputRef={repotTimeRef} />
            </div>

            <div className="my-8">
                <p className="text-md">New pot size</p>
                <RadioGroup
                    value={selected}
                    onChange={setSelected}
                    className="flex flex-col"
                >
                    <div className="flex justify-center mx-auto">
                        {potSizes.slice(0, 5).map((option) => (
                            <PotSizeOption key={option} option={option} />
                        ))}
                    </div>
                    <div className="flex justify-center mx-auto">
                        {potSizes.slice(5).map((option) => (
                            <PotSizeOption key={option} option={option} />
                        ))}
                    </div>
                    <div className="flex justify-center mx-auto">
                        <RadioGroup.Option value="custom" as={Fragment}>
                            <input
                                ref={customPotRef}
                                className="pot-size w-32 p-2"
                                placeholder="custom"
                            />
                        </RadioGroup.Option>
                    </div>
                </RadioGroup>
            </div>

            <button className="btn btn-accent mx-auto" onClick={submit}>
                Repot
            </button>
        </Modal>
    );
};

export default RepotModal;
