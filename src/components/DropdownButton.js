import React, { memo } from 'react';
import PropTypes from 'prop-types';

const DropdownButton = memo(function DropdownButton({ className, title, onClick, children }) {
    // Close dropdown if button clicked again while open (remove focus)
    const handlePointerDown = (e) => {
        if (document.activeElement === e.currentTarget) {
            e.preventDefault();
            document.activeElement.blur();
        }
    };

    return (
        <div
            tabIndex={0}
            role="button"
            className={className}
            title={title}
            aria-label={title}
            onClick={onClick}
            onPointerDown={handlePointerDown}
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
