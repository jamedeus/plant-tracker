import PropTypes from 'prop-types';
import clsx from 'clsx';
import { v4 as uuidv4 } from 'uuid';
import { Link } from 'react-router-dom';
import { FaPlus } from 'react-icons/fa6';

const RegisterPageLink = ({ type, className }) => (
    <Link
        className={clsx("btn btn-accent", className && className)}
        to={`/manage/${uuidv4()}${type === 'group' ? '?type=group' : ''}`}
        aria-label={`Register new ${type}`}
        discover="none"
    >
        <FaPlus className="size-5 mr-1" /> {`Register ${type}`}
    </Link>
);

RegisterPageLink.propTypes = {
    type: PropTypes.oneOf(['plant', 'group']).isRequired,
    className: PropTypes.string
};

export default RegisterPageLink;
