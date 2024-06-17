import React from 'react';
import PropTypes from 'prop-types';

const FloatingFooter = ({ visible, children }) => {
    if (visible) {
        return (
            <div className={`sticky bottom-4 mx-auto my-4 p-4 bg-gray-600/50
                            rounded-box shadow shadow-inner z-50`}>
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
