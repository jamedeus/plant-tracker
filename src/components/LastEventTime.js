import PropTypes from 'prop-types';
import { capitalize, pastTense } from 'src/util';
import { timestampToRelative, timestampToReadable} from 'src/timestampUtils';

// Takes event name and timestamp, formats and returns
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
    timestamp: PropTypes.string
};

export default LastEventTime;
