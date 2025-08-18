import React from 'react';
import PropTypes from 'prop-types';
import { useInRouterContext, Link as RouterLink } from 'react-router-dom';

// Renders <Link> tag, falls back to <a href> if not in react-router context
// Allows non-SPA builds to share components like NavbarDropdownOptions.js
const SmartLink = ({ to, children, ...rest }) => {
    const inRouter = useInRouterContext();

    if (inRouter) {
        return (
            <RouterLink to={to} {...rest}>
                {children}
            </RouterLink>
        );
    }

    return (
        <a href={to} {...rest}>
            {children}
        </a>
    );
};


SmartLink.propTypes = {
    to: PropTypes.string.isRequired,
    children: PropTypes.node.isRequired,
};

export default SmartLink;
