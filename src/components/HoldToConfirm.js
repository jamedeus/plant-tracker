import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import 'src/css/hold_to_confirm.css';

// User must click and hold for timeout ms before callback runs
// Shows tooltip with instructions, progress bar animation while held
// Becomes normal btn-error btn-soft if timeout is 0 (callback runs onClick)
const HoldToConfirm = ({ callback, timeout, buttonText, tooltipText }) => {
    const [holding, setHolding] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const timerRef = useRef(null);
    const buttonRef = useRef(null);

    const handleHold = () => {
        // Start timer to run callback in timeout milliseconds
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            callback();
        }, timeout);
        // Start progress bar animation, show tooltip
        setHolding(true);
        setShowTooltip(true);
    };

    const handleRelease = () => {
        // Cancel callback timer, stop progress bar animation
        clearTimeout(timerRef.current);
        setHolding(false);
        // Remove button focus (for onMouseLeave, prevent still looking clicked
        // after moving cursor outside button without releasing click)
        buttonRef.current.blur();
        // Keep tooltip visible long enough for user to read text
        timerRef.current = setTimeout(() => {
            setShowTooltip(false);
        }, 750);
    };

    return (
        <div
            className={clsx(
                // Show tooltip unless timeout is 0 (no confirmation)
                timeout && "tooltip hold-to-confirm-tooltip",
                showTooltip && "tooltip-open"
            )}
            data-tip={tooltipText}
        >
            <button
                className={clsx(
                    'btn btn-soft btn-error',
                    timeout && 'hold-to-confirm',
                    holding && 'active'
                )}
                style={{ '--hold-duration': `${timeout}ms` }}
                onMouseDown={handleHold}
                onTouchStart={handleHold}
                onMouseUp={handleRelease}
                onMouseLeave={handleRelease}
                onTouchEnd={handleRelease}
                // Only add onClick if timeout is 0 (no confirmation)
                onClick={!timeout ? handleHold : null}
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
