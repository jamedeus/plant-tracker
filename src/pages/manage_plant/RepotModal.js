import React, { useState, useRef, Fragment, memo } from 'react';
import PropTypes from 'prop-types';
import { RadioGroup } from '@headlessui/react';
import Modal from 'src/components/Modal';
import DatetimeInput from 'src/components/DatetimeInput';
import { localToUTC } from 'src/timestampUtils';
import { sendPostRequest } from 'src/util';
import { openErrorModal } from 'src/components/ErrorModal';
import { useSelector } from 'react-redux';
import clsx from 'clsx';

let modalRef;

export const openRepotModal = () => {
    modalRef.current.open();
};

// Takes integer pot size, renders round div with number centered
const PotSizeOption = memo(function PotSizeOption({ option }) {
    return (
        <RadioGroup.Option value={option} as={Fragment}>
            {({ checked }) => (
                <div className={clsx(
                    'pot-size w-10 h-10 md:w-12 md:h-12',
                    checked ? 'pot-size-selected' : 'bg-base-300'
                )}>
                    <span className="m-auto">{option}</span>
                </div>
            )}
        </RadioGroup.Option>
    );
});

PotSizeOption.propTypes = {
    option: PropTypes.number.isRequired
};

const RepotModal = ({ handleRepot }) => {
    modalRef = useRef(null);

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
            // Update plant state pot_size, add repot event to history
            handleRepot(payload.new_pot_size, payload.timestamp);
            modalRef.current.close();
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
                            {({ checked }) => (
                                <input
                                    ref={customPotRef}
                                    className={clsx(
                                        'pot-size w-32',
                                        checked ? 'pot-size-selected' : 'bg-base-300'
                                    )}
                                    placeholder="custom"
                                />
                            )}
                        </RadioGroup.Option>
                    </div>
                </RadioGroup>
            </div>

            <button className="btn btn-success mx-auto" onClick={submit}>
                Repot
            </button>
        </Modal>
    );
};

RepotModal.propTypes = {
    handleRepot: PropTypes.func.isRequired
};

export default RepotModal;
