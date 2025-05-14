import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import 'src/css/hold_to_confirm.css';

const HoldToConfirm = ({ callback, timeout, buttonText, tooltipText }) => {
    const [holding, setHolding] = useState(false);
    const timerRef = useRef(null);
    const buttonRef = useRef(null);

    const handleHold = () => {
        // Start timer to run callback in timeout milliseconds
        timerRef.current = setTimeout(() => {
            callback();
        }, timeout);
        // Start progres bar animation
        setHolding(true);
    };

    const handleRelease = () => {
        // Cancel callback timer, stop progress bar animation
        clearTimeout(timerRef.current);
        setHolding(false);
        // Remove button focus (for onMouseLeave, prevent still looking clicked
        // after moving cursor outside button without releasing click)
        buttonRef.current.blur();
    };

    return (
        <div
            className={clsx(
                "tooltip hold-to-confirm-tooltip",
                holding && "tooltip-open"
            )}
            data-tip={tooltipText}
        >
            <button
                className={clsx(
                    'btn btn-soft btn-error hold-to-confirm',
                    holding && 'active'
                )}
                style={{ '--hold-duration': `${timeout}ms` }}
                onMouseDown={handleHold}
                onTouchStart={handleHold}
                onMouseUp={handleRelease}
                onMouseLeave={handleRelease}
                onTouchEnd={handleRelease}
                ref={buttonRef}
            >
                <span>
                    {buttonText}
                </span>
            </button>
        </div>
    );
};

HoldToConfirm.propTypes = {
    callback: PropTypes.func.isRequired,
    timeout: PropTypes.number.isRequired,
    buttonText: PropTypes.string.isRequired,
    tooltipText: PropTypes.string.isRequired
};

export default HoldToConfirm;
