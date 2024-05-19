import PropTypes from 'prop-types';
import {
    capitalize,
    pastTense,
    timestampToRelative,
    timestampToReadable
} from 'src/util';

// Takes event name and timestmap, formats and returns
// Used to display last watered/fertilized times
const LastEventTime = ({ text, timestamp }) => {
    if (timestamp) {
        return (
            <span title={timestampToReadable(timestamp)}>
                {`${pastTense(capitalize(text))} ${timestampToRelative(timestamp)}`}
            </span>
        );
    } else {
        return `Never ${pastTense(text.toLowerCase())}`;
    }
};

LastEventTime.propTypes = {
    text: PropTypes.string,
    timestmap: PropTypes.string
};

export default LastEventTime;
