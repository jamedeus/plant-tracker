import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import parseDomContext from 'src/utils/parseDomContext';
import ToggleThemeOption from './ToggleThemeOption';

const NavbarDropdownOptions = ({ children }) => {
    const userAccountsEnabled = useMemo(() => (
        parseDomContext("user_accounts_enabled")
    ), []);

    return (
        <>
            <li><Link to='/'>
                Overview
            </Link></li>
            {userAccountsEnabled && (
                <li><Link to="/accounts/profile/">
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
