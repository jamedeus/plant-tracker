import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { parseDomContext } from 'src/util';
import ToggleThemeOption from './ToggleThemeOption';

const NavbarDropdownOptions = ({ children }) => {
    const userAccountsEnabled = useMemo(() => (
        parseDomContext("user_accounts_enabled")
    ), []);

    return (
        <>
            <li><a href='/'>
                Overview
            </a></li>
            {userAccountsEnabled && (
                <li><a href="/accounts/profile/">
                    User profile
                </a></li>
            )}
            {children}
            <ToggleThemeOption />
        </>
    );
};

NavbarDropdownOptions.propTypes = {
    children: PropTypes.node,
};

export default NavbarDropdownOptions;
