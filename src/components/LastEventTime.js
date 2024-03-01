import PropTypes from 'prop-types';
import { capitalize, pastTense, timestampToRelative } from 'src/util';

// Takes event name and timestmap, formats and returns
// Used to display last watered/fertilized times
const LastEventTime = ({ text, timestamp }) => {
    switch(timestamp) {
        case null:
        case undefined:
            return `Never ${pastTense(text.toLowerCase())}`;
        default:
            return `${pastTense(capitalize(text))} ${timestampToRelative(timestamp)}`;
    }
};

LastEventTime.propTypes = {
    text: PropTypes.string,
    timestmap: PropTypes.string
};

export default LastEventTime;
