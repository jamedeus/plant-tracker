import React from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';

const FloatingFooter = ({ visible, children, text }) => {
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
                {text && (
                    <div className={clsx(
                        "w-70 md:w-82 text-center",
                        "text-sm md:text-base font-semibold text-base-content"
                    )}>
                        {text}
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
