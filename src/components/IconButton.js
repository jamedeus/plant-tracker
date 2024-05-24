import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const IconButton = ({ onClick=null, href=null, title=null, icon}) => {
    return (
        <a
            className={"btn btn-square h-10 w-10 min-h-10 min-w-10"}
            href={href}
            onClick={onClick}
            title={title}
        >
            <FontAwesomeIcon className={"w-4 h-4"} icon={icon} />
        </a>
    );
};

IconButton.propTypes = {
    onClick: PropTypes.func,
    href: PropTypes.string,
    title: PropTypes.string,
    icon: PropTypes.object
};

export default IconButton;
