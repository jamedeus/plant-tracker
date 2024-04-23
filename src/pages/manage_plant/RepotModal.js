import React, { useState, useRef, Fragment } from 'react';
import PropTypes from 'prop-types';
import { RadioGroup } from '@headlessui/react';
import Modal from 'src/components/Modal';
import DatetimeInput from 'src/components/DatetimeInput';
import { sendPostRequest } from 'src/util';
import { useErrorModal } from 'src/context/ErrorModalContext';

let repotModalRef;

export const openRepotModal = () => {
    repotModalRef.current.showModal();
};

const RepotModal = ({ plantID, currentPotSize, handleRepot }) => {
    repotModalRef = useRef(null);

    // Pot size options (inches)
    const potSizes = [2, 3, 4, 6, 8, 10, 12, 14, 18, 21];

    // Refs to access custom pot size input, timestamp input
    const customPotRef = useRef(null);
    const repotTimeRef = useRef(null);

    // Get hook to show error modal
    const { showErrorModal } = useErrorModal();

    // Default to next size if currentPotSize set, otherwise default to 2in
    const [selected, setSelected] = useState((() => {
        if (currentPotSize && potSizes.includes(currentPotSize)) {
            return potSizes[potSizes.indexOf(currentPotSize) + 1];
        } else {
            return 2;
        }
    })());

    // Takes integer pot size, renders round div with number centered
    const PotSizeOption = ({ option }) => {
        return (
            <RadioGroup.Option value={option} as={Fragment}>
                {({ checked }) => (
                    <div
                        className={`pot-size w-10 h-10 md:w-12 md:h-12 ${
                            checked ? 'pot-size-selected' : 'bg-base-300'
                        }`}
                    >
                        <span className="m-auto">{option}</span>
                    </div>
                )}
            </RadioGroup.Option>
        );
    };

    PotSizeOption.propTypes = {
        option: PropTypes.number
    };

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
            timestamp: repotTimeRef.current.value
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
            repotModalRef.current.close();
        } else {
            const error = await response.json();
            showErrorModal(JSON.stringify(error));
        }
    };

    return (
        <Modal dialogRef={repotModalRef} title={"Repot plant"}>
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
                                    className={`pot-size w-32 ${checked ?
                                        'pot-size-selected' : 'bg-base-300'
                                    }`}
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
    plantID: PropTypes.string,
    currentPotSize: PropTypes.number,
    handleRepot: PropTypes.func
};

export default RepotModal;
