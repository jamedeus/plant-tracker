import React, { useState, useRef, memo } from 'react';
import PropTypes from 'prop-types';
import DatetimeInput from 'src/components/DatetimeInput';
import { localToUTC } from 'src/utils/timestampUtils';
import sendPostRequest from 'src/utils/sendPostRequest';
import { openErrorModal } from 'src/components/ErrorModal';
import { useSelector, useDispatch } from 'react-redux';
import { eventAdded } from './timelineSlice';
import { plantRepotted } from './plantSlice';
import 'src/css/repot_modal.css';
import clsx from 'clsx';

// Pot size options (inches)
const POT_SIZES = [2, 3, 4, 6, 8, 10, 12, 14, 18, 21];

const PotSizeOption = memo(function PotSizeOption({ option, isSelected, setSelected }) {
    return (
        <div
            className={clsx(
                "pot-size size-10 md:size-12 m-2",
                isSelected && "pot-size-selected"
            )}
            title={`${option} inch pot`}
            onClick={() => setSelected(option)}
        >
            <span className="m-auto">{option}</span>
        </div>
    );
});

PotSizeOption.propTypes = {
    option: PropTypes.number.isRequired,
    isSelected: PropTypes.bool.isRequired,
    setSelected: PropTypes.func.isRequired
};

const RepotModal = ({ openChangeQrModal, close }) => {
    const dispatch = useDispatch();
    const plantID = useSelector((state) => state.plant.plantDetails.uuid);
    const currentPotSize = useSelector((state) => state.plant.plantDetails.pot_size);

    // Ref to access timestamp input
    const repotTimeRef = useRef(null);

    // Default to next size if currentPotSize set, otherwise default to 2 inch
    const [selected, setSelected] = useState((() => {
        if (currentPotSize && POT_SIZES.includes(parseInt(currentPotSize))) {
            return POT_SIZES[POT_SIZES.indexOf(parseInt(currentPotSize)) + 1];
        } else {
            return 2;
        }
    })());

    const [customPotSize, setCustomPotSize] = useState('');

    // Post user selection to backend, create RepotEvent in database
    const submit = async () => {
        const new_pot_size = selected === 'custom' ? customPotSize : selected;

        // Don't submit with blank custom pot size
        if (!new_pot_size) {
            openErrorModal(
                'Please enter a custom pot size or select a different option'
            );
            return;
        }

        const response = await sendPostRequest('/repot_plant', {
            plant_id: plantID,
            new_pot_size: parseInt(new_pot_size),
            timestamp: localToUTC(repotTimeRef.current.value)
        });
        if (response.ok) {
            const data = await response.json();
            // Update plantDetails state, add event to events state
            dispatch(plantRepotted(data.pot_size));
            dispatch(eventAdded({timestamp: data.timestamp, type: 'repot'}));
            // Close repot modal, open modal with instructions to change QR code
            close();
            openChangeQrModal();
        } else {
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
        }
    };

    return (
        <>
            <div className="mt-4">
                <p>Repot time</p>
                <DatetimeInput inputRef={repotTimeRef} />
            </div>

            <div className="flex flex-col my-8">
                <p className="text-md mb-2">New pot size</p>
                <div className="grid grid-cols-5 mx-auto">
                    {POT_SIZES.map((option) => (
                        <PotSizeOption
                            key={option}
                            option={option}
                            isSelected={selected === option}
                            setSelected={setSelected}
                        />
                    ))}
                </div>
                <input
                    className={clsx(
                        "pot-size w-32 h-10 md:h-12 p-2 mx-auto my-2",
                        selected === "custom" && "pot-size-selected"
                    )}
                    placeholder="custom"
                    type="text"
                    inputMode="numeric"
                    value={customPotSize}
                    onFocus={() => setSelected("custom")}
                    onInput={(e) => {
                        setCustomPotSize(e.target.value.replace(
                            /\D+/g, ''
                        ).slice(0, 2));
                    }}
                />
            </div>

            <div className="modal-action mt-0">
                <button className="btn btn-accent" onClick={submit}>
                    Repot
                </button>
            </div>
        </>
    );
};

RepotModal.propTypes = {
    openChangeQrModal: PropTypes.func.isRequired,
    close: PropTypes.func.isRequired
};

export default RepotModal;
