import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

const IconButton = ({ onClick=null, href=null, title, children }) => {
    if (href) {
        return (
            <Link
                className='btn btn-square size-10 min-size-10'
                to={href}
                onClick={onClick}
                title={title}
                tabIndex={0}
            >
                {children}
            </Link>
        );
    }
    return (
        <a
            className='btn btn-square size-10 min-size-10'
            onClick={onClick}
            title={title}
            tabIndex={0}
        >
            {children}
        </a>
    );
};

IconButton.propTypes = {
    onClick: PropTypes.func,
    href: PropTypes.string,
    title: PropTypes.string,
    children: PropTypes.node.isRequired
};

export default IconButton;
