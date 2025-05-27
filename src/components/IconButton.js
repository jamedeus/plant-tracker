import React from 'react';
import PropTypes from 'prop-types';

const IconButton = ({ onClick=null, href=null, title, children }) => {
    return (
        <a
            className='btn btn-square size-10 min-size-10'
            href={href}
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
