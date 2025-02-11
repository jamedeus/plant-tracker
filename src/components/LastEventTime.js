import PropTypes from 'prop-types';
import { capitalize, pastTense } from 'src/util';
import {
    timestampIsToday,
    timestampToReadable,
    timestampToRelative,
    timestampToRelativeCalendar,
    timestampIsLessThanOneMinuteOld
} from 'src/timestampUtils';

// Return relative sec/min/hours if timestamp on current date in user timezone.
// Return number of days since timestamp if not on current date.
const getDisplayTime = (timestamp) => {
    if (timestampIsLessThanOneMinuteOld(timestamp)) {
        return "just now";
    } else if (timestampIsToday(timestamp)) {
        return timestampToRelative(timestamp);
    } else {
        return timestampToRelativeCalendar(timestamp);
    }
};

// Takes event name and timestamp, formats and returns
// Used to display last watered/fertilized times
const LastEventTime = ({ text, timestamp }) => {
    if (timestamp) {
        return (
            <span title={timestampToReadable(timestamp)}>
                {`${pastTense(capitalize(text))} ${getDisplayTime(timestamp)}`}
            </span>
        );
    } else {
        return `Never ${pastTense(text.toLowerCase())}`;
    }
};

LastEventTime.propTypes = {
    text: PropTypes.string.isRequired,
    timestamp: PropTypes.string
};

export default LastEventTime;
