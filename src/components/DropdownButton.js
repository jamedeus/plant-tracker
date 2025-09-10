import React, { memo } from 'react';
import PropTypes from 'prop-types';

const DropdownButton = memo(function DropdownButton({ className, title, onClick, children }) {
    return (
        <div
            tabIndex={0}
            role="button"
            className={className}
            title={title}
            aria-label={title}
            onPointerDown={onClick}
        >
            {children}
        </div>
    );
});

DropdownButton.propTypes = {
    className: PropTypes.string,
    title: PropTypes.string,
    onClick: PropTypes.func,
    children: PropTypes.node.isRequired
};

export default DropdownButton;
