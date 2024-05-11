import React from 'react';
import PropTypes from 'prop-types';
import { DateTime } from 'luxon';
import { stringMatchesPattern } from 'src/util';

const DatetimeInput = ({ inputRef, value=null }) => {
    return (
        <input
            ref={inputRef}
            className="input input-bordered mx-auto my-2"
            type="datetime-local"
            step="1"
            defaultValue={
                value ? value : DateTime.now().toFormat("yyyy-MM-dd'T'HH:mm:ss")
            }
        />
    );
};

DatetimeInput.propTypes = {
    inputRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ]),
    value: stringMatchesPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
};

export default DatetimeInput;
