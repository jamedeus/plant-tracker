import React from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import './floating_footer.css';

const FloatingFooter = ({ visible, children }) => {
    return (
        <div
            className={clsx(
                'floating-footer',
                visible ? 'floating-footer-visible' : 'floating-footer-hidden'
            )}
            data-testid='floating-footer'
        >
            {children}
        </div>
    );
};

FloatingFooter.propTypes = {
    visible: PropTypes.bool.isRequired,
    children: PropTypes.node.isRequired
};

export default FloatingFooter;
