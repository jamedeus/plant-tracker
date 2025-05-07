import React, { memo } from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';

// Styled <ul> wrapper, takes <li> options
const DropdownMenu = memo(function DropdownMenu({ children, className }) {
    return (
        <ul
            tabIndex={0}
            className={clsx(
                "dropdown-content menu z-99 shadow-sm bg-base-300 rounded-box",
                className && className
            )}
        >
            {children}
        </ul>
    );
});

DropdownMenu.propTypes = {
    children: PropTypes.node,
    className: PropTypes.string
};

export default DropdownMenu;
