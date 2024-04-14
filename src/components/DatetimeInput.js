import React from 'react';
import PropTypes from 'prop-types';
import { DateTime } from 'luxon';

const DatetimeInput = ({ inputRef }) => {
    return (
        <input
            ref={inputRef}
            className="input input-bordered mx-auto my-2"
            type="datetime-local"
            step="1"
            defaultValue={DateTime.now().toFormat("yyyy-MM-dd'T'HH:mm:ss")}
        />
    );
};

DatetimeInput.propTypes = {
    inputRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ])
};

export default DatetimeInput;
