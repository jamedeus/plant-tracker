import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import ToggleThemeOption from './ToggleThemeOption';
import { FaHome, FaUser } from "react-icons/fa";

const NavbarDropdownOptions = ({ children }) => {
    return (
        <>
            <li><Link to='/' discover="none">
                Overview
                <FaHome className="size-4 ml-4" />
            </Link></li>
            {globalThis.USER_ACCOUNTS_ENABLED && (
                <li><Link to="/accounts/profile/" discover="none">
                    User profile
                    <FaUser className="size-4 ml-4" />
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
