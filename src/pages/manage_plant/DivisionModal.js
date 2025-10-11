import React, { useState, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { DateTime } from 'luxon';
import { v4 as uuidv4 } from 'uuid';
import { localToUTC } from 'src/utils/timestampUtils';
import sendPostRequest from 'src/utils/sendPostRequest';
import ModalPages from 'src/components/ModalPages';
import DatetimeInput from 'src/components/DatetimeInput';
import { openErrorModal } from 'src/components/ErrorModal';
import Checkmark from 'src/components/Checkmark';
import PlantDetailsForm from 'src/components/PlantDetailsForm';
import DivisionScannerButton from './DivisionScanner';
import { useSelector, } from 'react-redux';
import { LuSplit } from "react-icons/lu";

const numberSuffixMap = {
    1: 'st',
    2: 'nd',
    3: 'rd'
};
const getNumberSuffix = (number) => numberSuffixMap[number] || 'th';

const DivisionModal = ({ close }) => {
    const plantDetails = useSelector((state) => state.plant.plantDetails);

    // Options:
    // - "divide" (shows instructions + DivisionEvent timestamp input)
    // - "register" (shows register instructions + both buttons)
    // - "form" (shows registration form)
    // - "done" (shows success screen, buttons to register another)
    const [modalContents, setModalContents] = useState("divide");

    // Stores /divide_plant response keys used in /register_plant payload
    const [dividedFromId, setDividedFromId] = useState(null);
    const [dividedFromEventId, setDividedFromEventId] = useState(null);
    // Stores UUID of next child plant (scanned from QR code or random UUID)
    const [nextChildId, setNextChildId] = useState(null);
    // Track number registered (shown on "done" page so user knows not looping)
    const [numberRegistered, setNumberRegistered] = useState(0);

    // Refs to access timestamp input + registration form
    const timestampRef = useRef(null);
    const formRef = useRef(null);

    // Part of default description field in registration form
    const today = DateTime.now().toFormat('MMMM d, yyyy');

    // Creates DivisionEvent and stores response keys needed to register child
    const createDivisionEvent = useCallback(async() => {
        const response = await sendPostRequest('/divide_plant', {
            plant_id: plantDetails.uuid,
            timestamp: localToUTC(timestampRef.current.value)
        });
        if (response.ok) {
            const data = await response.json();
            setDividedFromId(data.plant_key);
            setDividedFromEventId(data.division_event_key);
            setModalContents("register");
        } else {
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
        }
    }, [plantDetails.uuid, timestampRef]);

    // Callback receives QR code from scanner confirm button
    const registerFromQrCode = useCallback((uuid) => {
        setNextChildId(uuid);
        setModalContents("form");
    }, []);

    // Generates random UUID and shows registration form (skip QR code scanner)
    const registerWithoutQrCode = useCallback(() => {
        setNextChildId(uuidv4());
        setModalContents("form");
    }, []);

    // Registration form submit handler
    const registerChildPlant = useCallback(async () => {
        const response = await sendPostRequest('/register_plant', {
            uuid: nextChildId,
            ...Object.fromEntries(new FormData(formRef.current)),
            divided_from_id: dividedFromId,
            divided_from_event_id: dividedFromEventId
        });
        if (response.ok) {
            setModalContents("done");
            setNumberRegistered(numberRegistered + 1);
        } else {
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
        }
    }, [nextChildId, dividedFromId, dividedFromEventId, numberRegistered]);

    switch(modalContents) {
        case("divide"):
            return (
                <>
                    {/* Title */}
                    <h3 className="font-bold text-lg leading-8 md:text-xl mb-3">
                        Divide Plant
                    </h3>
                    <ModalPages>
                        {/* Page 1 */}
                        <div className="flex flex-col min-h-52 max-w-86 justify-center gap-8 mx-auto">
                            <span>
                                Dividing a plant lets you register new plants that came from the same parent.
                            </span>
                            <span>
                                This is great for propagating houseplants or splitting up seedling trays into pots.
                            </span>
                        </div>

                        {/* Page 2 */}
                        <div className="flex flex-col min-h-52 max-w-86 justify-center gap-8 mx-auto">
                            <span>
                                Each new plant gets its own timeline with a link to the original at the beginning.
                            </span>
                            {/* <span>
                                You can register as many as you want, each with their own QR code (or add QR codes later).
                            </span> */}
                            {/* <span>
                                You can add a QR code for each plant as you register them, or skip this and add them later.
                            </span> */}
                            <span>
                                You can add a QR code for each plant you register, or skip this and add one later.
                            </span>
                        </div>

                        {/* Page 3 */}
                        <div className="flex flex-col h-full justify-center gap-4">
                            <span>When did you divide your plant?</span>
                            <div className="mx-auto">
                                <DatetimeInput inputRef={timestampRef} />
                            </div>

                            <button
                                className="btn btn-accent text-base mx-auto mt-2"
                                onClick={createDivisionEvent}
                            >
                                <LuSplit className='size-6 mr-2 rotate-90' />
                                Start Dividing
                            </button>
                        </div>
                    </ModalPages>
                </>
            );
        case("register"):
            return (
                <>
                    <h3 className="font-bold text-lg leading-8 md:text-xl mb-3">
                        Divide Plant
                    </h3>
                    <div className="min-h-60 max-w-86 flex flex-col justify-center gap-6 py-4 mx-auto">
                        <span>
                            Now lets register your first new plant!
                        </span>
                        <span className="mb-2">
                            You can start by scanning a QR code sticker, or go right to the registration form.
                        </span>
                        <DivisionScannerButton setScannedUuid={registerFromQrCode} />
                        <button className="btn" onClick={registerWithoutQrCode}>
                            Add QR code later
                        </button>
                    </div>
                </>
            );
        case("form"):
            return (
                <>
                    <h3 className="font-bold text-lg leading-8 md:text-xl mb-3">
                        Register new plant
                    </h3>
                    <div
                        className="flex flex-col w-full max-w-[25rem] gap-4 mx-auto"
                        data-testid="division-modal-form"
                    >
                        <PlantDetailsForm
                            formRef={formRef}
                            name={plantDetails.name ? `${plantDetails.name} prop` : null}
                            species={plantDetails.species}
                            pot_size={plantDetails.pot_size}
                            description={`Divided from ${plantDetails.display_name} on ${today}`}
                        />
                        <button
                            className="btn btn-accent mx-auto my-4"
                            onClick={registerChildPlant}
                        >
                            Register New Plant
                        </button>
                    </div>
                </>
            );
        default:
            return (
                <>
                    <h3 className="font-bold text-lg leading-8 md:text-xl mb-3">
                        {numberRegistered}{getNumberSuffix(numberRegistered)} plant registered!
                    </h3>
                    <div className="flex flex-col min-h-124.5 max-w-[25rem] justify-center mx-auto">
                        <div
                            className="flex flex-col h-full gap-6"
                            data-testid="repot-modal-success"
                        >
                            <div className="mx-auto">
                                <Checkmark className="w-16" />
                            </div>
                            <span>
                                You can register as many as you want
                            </span>
                            <DivisionScannerButton setScannedUuid={registerFromQrCode} />
                            <button className="btn" onClick={registerWithoutQrCode}>
                                Register without QR code
                            </button>
                            <button className="btn mt-8" onClick={close}>
                                Done
                            </button>
                        </div>
                    </div>
                </>
            );
    }
};

DivisionModal.propTypes = {
    close: PropTypes.func.isRequired,
};

export default DivisionModal;
