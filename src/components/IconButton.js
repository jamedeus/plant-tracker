import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const IconButton = ({ onClick=null, href=null, title, icon}) => {
    return (
        <a
            className='btn btn-square size-10 min-size-10'
            href={href}
            onClick={onClick}
            title={title}
        >
            <FontAwesomeIcon className='size-4' icon={icon} />
        </a>
    );
};

IconButton.propTypes = {
    onClick: PropTypes.func,
    href: PropTypes.string,
    title: PropTypes.string,
    icon: PropTypes.object.isRequired
};

export default IconButton;
