import React from 'react';
import PropTypes from 'prop-types';

const FloatingFooter = ({ visible, children }) => {
    if (visible) {
        return (
            <div className='floating-footer'>
                {children}
            </div>
        );
    }
};

FloatingFooter.propTypes = {
    visible: PropTypes.bool.isRequired,
    children: PropTypes.node.isRequired
};

export default FloatingFooter;
