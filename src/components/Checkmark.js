import PropTypes from 'prop-types';
import clsx from 'clsx';
import 'src/css/checkmark.css';

const Checkmark = ({ className }) => (
    <svg
        className={clsx('checkmark', className)}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-hidden="true"
    >
        <circle className="checkmark__circle" cx="12" cy="12" r="9.5" pathLength="100" />
        <path className="checkmark__check" d="M7.6 12.6 10.3 15.4 15.8 9.8" pathLength="100" />
    </svg>
);

Checkmark.propTypes = {
    className: PropTypes.string,
    style: PropTypes.object
};

export default Checkmark;
