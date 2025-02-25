import React from 'react';
import PropTypes from 'prop-types';

// Rendered when both state objects are empty, shows setup instructions
const Setup = ({ printModalRef }) => {
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
                onClick={() => printModalRef.current.open()}
            >
                Print QR Codes
            </button>
        </div>
    );
};

Setup.propTypes = {
    printModalRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.array }),
    ]).isRequired
};

export default Setup;
