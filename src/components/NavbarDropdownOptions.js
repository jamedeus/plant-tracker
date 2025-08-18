import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import SmartLink from './SmartLink';
import { parseDomContext } from 'src/util';
import ToggleThemeOption from './ToggleThemeOption';

const NavbarDropdownOptions = ({ children }) => {
    const userAccountsEnabled = useMemo(() => (
        parseDomContext("user_accounts_enabled")
    ), []);

    return (
        <>
            <li><SmartLink to='/'>
                Overview
            </SmartLink></li>
            {userAccountsEnabled && (
                <li><SmartLink to="/accounts/profile/">
                    User profile
                </SmartLink></li>
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
