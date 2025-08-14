import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import ToggleThemeOption from './ToggleThemeOption';

const NavbarDropdownOptions = ({ children }) => {
    // Fetch user accounts enabled bool from backend
    const userAccountsEnabled = useMemo(async () => {
        const response = await fetch('/get_app_config');
        if (!response.ok) return false;
        const config = await response.json();
        return Boolean(config.user_accounts_enabled);
    });

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
    children: PropTypes.node
};

export default NavbarDropdownOptions;
