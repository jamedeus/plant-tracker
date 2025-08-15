import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Link } from 'react-router-dom';
import { openPrintModal } from './PrintModal';

// Rendered when both state objects are empty, shows setup instructions
const Setup = () => {
    return (
        <div className="flex flex-col text-center my-auto px-8">
            <p className="text-2xl">No plants found!</p>
            <ul className="steps steps-vertical my-8">
                <li className="step">Print QR codes on sticker paper</li>
                <li className="step">Add a sticker to each plant pot</li>
                <li className="step">Scan codes to register plants!</li>
            </ul>
            <button
                className="btn btn-accent text-lg"
                onClick={openPrintModal}
            >
                Print QR Codes
            </button>
            <p className="text-2xl mt-8 mb-2">No printer?</p>
            <span className="mb-4">You can add a QR code later.</span>
            <Link className="btn btn-accent text-lg" to={`/manage/${uuidv4()}`}>
                Register plant
            </Link>
        </div>
    );
};

export default Setup;
