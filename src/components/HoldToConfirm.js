import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import 'src/css/hold_to_confirm.css';

// User must click and hold for timeout ms before callback runs
// Shows progress bar animation while held, reverses when released
// Shows tooltip with instructions if tooltipText given and timeout is not 0
// Becomes normal btn-error btn-soft if timeout is 0 (callback runs onClick)
// Runs optional onHoldStart and onHoldStop callbacks when held and released
const HoldToConfirm = ({
    callback,
    timeout,
    buttonText,
    buttonAriaLabel,
    buttonClass,
    tooltipText,
    onHoldStart,
    onHoldStop
}) => {
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
        // Call onHoldStart callback if given
        onHoldStart && onHoldStart();
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
            // Call onHoldStop callback if given
            onHoldStop && onHoldStop();
        }, 750);
    };

    const handleTouchMove = (event) => {
        // Check if touch is outside button
        const touch = event.touches[0];
        const boundingRect = buttonRef.current.getBoundingClientRect();
        const outside = touch.clientX < boundingRect.left ||
                        touch.clientX > boundingRect.right ||
                        touch.clientY < boundingRect.top ||
                        touch.clientY > boundingRect.bottom;

        // Release if touch moved outside button (prevent getting stuck)
        if (holding && outside) {
            handleRelease();
        // Restart if touch moved back inside button
        } else if (!holding && !outside) {
            handleHold();
        }
    };

    return (
        <div
            className={clsx(
                // Show tooltip unless timeout is 0 (no confirmation) or no text
                timeout && tooltipText && "tooltip hold-to-confirm-tooltip",
                showTooltip && "tooltip-open"
            )}
            data-tip={tooltipText}
        >
            <button
                className={clsx(
                    'btn btn-soft btn-error',
                    timeout && 'hold-to-confirm',
                    holding && 'active',
                    buttonClass && buttonClass
                )}
                aria-label={buttonAriaLabel}
                style={{ '--hold-duration': `${timeout}ms` }}
                onMouseDown={handleHold}
                onTouchStart={handleHold}
                onMouseUp={handleRelease}
                onMouseLeave={handleRelease}
                onTouchMove={handleTouchMove}
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
    buttonClass: PropTypes.string,
    buttonAriaLabel: PropTypes.string,
    tooltipText: PropTypes.string,
    onHoldStart: PropTypes.func,
    onHoldStop: PropTypes.func
};

export default HoldToConfirm;
