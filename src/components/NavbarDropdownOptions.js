import { useTheme } from 'src/context/ThemeContext';
import PropTypes from 'prop-types';

const NavbarDropdownOptions = ({ children }) => {
    const { ToggleThemeOption } = useTheme();

    return (
        <>
            <li><a onClick={() => window.location.href = "/"}>
                Overview
            </a></li>
            <li><a onClick={() => window.location.href = "/accounts/profile/"}>
                User profile
            </a></li>
            {children}
            <ToggleThemeOption />
        </>
    );
};

NavbarDropdownOptions.propTypes = {
    children: PropTypes.node,
};

export default NavbarDropdownOptions;
