import React, { useState, useRef, memo } from 'react';
import PropTypes from 'prop-types';
import DatetimeInput from 'src/components/DatetimeInput';
import { localToUTC } from 'src/utils/timestampUtils';
import sendPostRequest from 'src/utils/sendPostRequest';
import { openErrorModal } from 'src/components/ErrorModal';
import Checkmark from 'src/components/Checkmark';
import LoadingAnimation from 'src/components/LoadingAnimation';
import ModalPages from 'src/components/ModalPages';
import { useSelector, useDispatch } from 'react-redux';
import { eventAdded } from './timelineSlice';
import { plantRepotted } from './plantSlice';
import { changeQrScannerOpened } from './interfaceSlice';
import { TbShovel } from "react-icons/tb";
import { LuScanSearch } from "react-icons/lu";
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

const RepotModal = ({ close }) => {
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

    // Must be "prompt" (show prompt pages), "loading" (spinner), or "done"
    const [modalContents, setModalContents] = useState("prompt");

    // Post user selection to backend, create RepotEvent in database
    const submit = async () => {
        // Read inputs before they unmount
        const new_pot_size = selected === 'custom' ? customPotSize : selected;
        const timestamp = localToUTC(repotTimeRef.current.value);

        // Don't submit with blank custom pot size
        if (!new_pot_size) {
            openErrorModal(
                'Please enter a custom pot size or select a different option'
            );
            return;
        }

        // Replace contents with loading spinner
        setModalContents("loading");

        const response = await sendPostRequest('/repot_plant', {
            plant_id: plantID,
            new_pot_size: parseInt(new_pot_size),
            timestamp: timestamp
        });
        if (response.ok) {
            const data = await response.json();
            // Update plantDetails state, add event to events state
            dispatch(plantRepotted(data.pot_size));
            dispatch(eventAdded({timestamp: data.timestamp, type: 'repot'}));
            // Show success animation + change QR code button
            setModalContents("done");
        } else {
            // Go back to prompt, show error in modal
            setModalContents("prompt");
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
        }
    };

    // Change QR Code button handler, closes modal and opens change QR scanner
    const changeQrCode = () => {
        dispatch(changeQrScannerOpened(true));
        close();
    };

    switch(modalContents) {
        case("prompt"):
            return (
                <ModalPages>
                    {/* Page 1 */}
                    <div className="flex flex-col h-full justify-center gap-2">
                        <span>When did you repot your plant?</span>
                        <div className="mx-auto">
                            <DatetimeInput inputRef={repotTimeRef} />
                        </div>
                    </div>

                    {/* Page 2 */}
                    <>
                        <div
                            className="flex flex-col gap-2"
                            data-testid="pot-size-options"
                            data-next-button={
                                selected === 'custom' && !customPotSize
                                    ? 'disabled'
                                    : null
                            }
                        >
                            <p className="text-md">Select new pot size</p>
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
                                    "pot-size w-32 h-10 md:h-12 p-2 mx-auto",
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
                    </>

                    {/* Page 3 */}
                    <div className="flex flex-col h-full justify-center">
                        <button
                            className="btn btn-accent text-base mx-auto mt-2"
                            onClick={submit}
                        >
                            <TbShovel className='size-6' />
                            Repot Plant
                        </button>
                    </div>
                </ModalPages>
            );
        case("loading"):
            return (
                <div
                    className="flex flex-col h-68 md:h-74 justify-evenly"
                    data-testid="repot-modal-loading"
                >
                    <LoadingAnimation className="mb-6 mx-auto" />
                </div>
            );
        default:
            return (
                <div
                    className="flex flex-col h-68 md:h-74 justify-evenly"
                    data-testid="repot-modal-success"
                >
                    <div className="text-lg font-bold">
                        Plant repotted!
                    </div>
                    <div className="mx-auto">
                        <Checkmark className="w-16" />
                    </div>
                    <button
                        className="btn btn-accent text-base mx-auto"
                        onClick={changeQrCode}
                    >
                        <LuScanSearch className="size-6" />
                        Change QR Code
                    </button>
                </div>
            );
    }
};

RepotModal.propTypes = {
    close: PropTypes.func.isRequired
};

export default RepotModal;
