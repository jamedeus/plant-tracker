import React, { memo } from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';

// Styled <ul> wrapper, takes <li> options
const DropdownMenu = memo(function DropdownMenu({ children, className, menuRef }) {
    return (
        <ul
            tabIndex={0}
            className={clsx(
                "dropdown-content menu z-90 shadow-sm bg-base-300 rounded-box",
                className && className
            )}
            ref={menuRef}
        >
            {children}
        </ul>
    );
});

DropdownMenu.propTypes = {
    children: PropTypes.node,
    className: PropTypes.string,
    menuRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ])
};

export default DropdownMenu;
