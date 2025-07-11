import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';

const FloatingFooter = ({ visible, children, text }) => {
    // Track displayed text (prevents immediate change when prop changes)
    const [displayedText, setDisplayedText] = useState(text);
    // Text fades in if true, fades out if false
    const [fadeIn, setFadeIn] = useState(true);
    const timerRef = useRef();

    // Fade out old text, fade in new text when text prop changes
    useEffect(() => {
        // Start fade out if text changed
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
    }, [text]);

    return (
        <div
            className={clsx(
                'floating-footer',
                visible ? 'floating-footer-visible' : 'floating-footer-hidden'
            )}
            data-testid='floating-footer'
        >
            <div className="flex flex-col items-center gap-4 w-full">
                {/* Render text div if arg given */}
                {displayedText && (
                    <div className={clsx(
                        "w-70 md:w-82 text-sm md:text-base",
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
    text: PropTypes.string
};

export default FloatingFooter;
