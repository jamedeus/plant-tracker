import React from 'react';
import { showPrintModal } from './PrintModal';

// Rendered when both state objects are empty, shows setup instructions
const Setup = () => {
    return (
        <div className="flex flex-col mx-auto text-center my-auto px-8">
            <p className="text-2xl">No plants found!</p>
            <ul className="steps steps-vertical my-8">
                <li className="step">Print QR codes on sticker paper</li>
                <li className="step">Add a sticker to each plant pot</li>
                <li className="step">Scan codes to register plants!</li>
            </ul>
            <button
                className="btn btn-accent text-lg"
                onClick={showPrintModal}
            >
                Print QR Codes
            </button>
        </div>
    );
};

export default Setup;
