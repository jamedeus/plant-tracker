import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import ToggleThemeOption from './ToggleThemeOption';

const NavbarDropdownOptions = ({ children }) => {
    return (
        <>
            <li><Link to='/' discover="none">
                Overview
            </Link></li>
            {globalThis.USER_ACCOUNTS_ENABLED && (
                <li><Link to="/accounts/profile/" discover="none">
                    User profile
                </Link></li>
            )}
            {children}
            <ToggleThemeOption />
        </>
    );
};

NavbarDropdownOptions.propTypes = {
    children: PropTypes.node
};

export default NavbarDropdownOptions;
