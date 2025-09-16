import React, { useEffect, useRef, useState } from 'react';
import { useSwipeable } from 'react-swipeable';
import PropTypes from 'prop-types';
import { XMarkIcon } from '@heroicons/react/16/solid';
import { useCloseWithEscKey } from 'src/hooks/useCloseWithEscKey';
import clsx from 'clsx';

const FloatingFooter = ({
    visible,
    children,
    text,
    fadeText,
    onClose,
    closeButton,
    closeButtonAriaLabel='Close floating footer',
    testId='floating-footer'
}) => {
    // Track displayed text (prevents immediate change when prop changes)
    const [displayedText, setDisplayedText] = useState(text);
    // Text fades in if true, fades out if false
    const [fadeIn, setFadeIn] = useState(true);
    const timerRef = useRef();

    // Fade out old text, fade in new text when text prop changes
    useEffect(() => {
        // Update immediately if fade disabled
        if (!fadeText) {
            setDisplayedText(text);
            setFadeIn(true);
            return;
        }

        // Start fading out if text changed
        if (text !== displayedText) {
            setFadeIn(false);
            // Clear any previous timer
            clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                setDisplayedText(text);
                setFadeIn(true);
            }, 150);
        // Prevent getting stuck on opacity-0 if text changed then changed back
        } else {
            setFadeIn(true);
            clearTimeout(timerRef.current);
        }
        return () => clearTimeout(timerRef.current);
    }, [text, fadeText]);

    // Close footer by swiping down (if onClose callback given)
    const handlers = useSwipeable({
        onSwipedDown: onClose,
        ...{
            delta: 50,
            preventScrollOnSwipe: true,
            trackMouse: true,
        },
    });

    // Close footer by pressing escape key
    useCloseWithEscKey(visible, onClose);

    return (
        <div
            className={clsx(
                'floating-footer',
                visible ? 'floating-footer-visible' : 'floating-footer-hidden'
            )}
            data-testid={testId}
            {...handlers}
        >
            <div className="relative flex flex-col items-center gap-4 w-full">
                {/* Render close button if arg given */}
                {closeButton && (
                    <button
                        className="absolute -top-2 -right-2 btn-close size-6"
                        onClick={onClose}
                        data-testid={`close-${testId}`}
                        style={{
                            '--btn-bg': 'color-mix(in oklab,var(--color-base-content)20%,#0000)'
                        }}
                        aria-label={closeButtonAriaLabel}
                    >
                        <XMarkIcon className="size-5" />
                    </button>
                )}

                {/* Render text div if arg given */}
                {displayedText && (
                    <div className={clsx(
                        "w-70 md:w-82 text-sm md:text-base select-none",
                        "text-center text-base-content font-semibold",
                        "transition-opacity duration-150 ease",
                        fadeIn ? 'opacity-100 duration-200' : 'opacity-0'
                    )}>
                        {displayedText}
                    </div>
                )}

                <div className="flex flex-row justify-center gap-8">
                    {children}
                </div>
            </div>
        </div>
    );
};

FloatingFooter.propTypes = {
    visible: PropTypes.bool.isRequired,
    children: PropTypes.node.isRequired,
    text: PropTypes.string,
    fadeText: PropTypes.bool,
    onClose: PropTypes.func,
    closeButton: PropTypes.bool,
    closeButtonAriaLabel: PropTypes.string,
    testId: PropTypes.string
};

export default FloatingFooter;
