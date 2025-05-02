import React from 'react';
import PropTypes from 'prop-types';
import { DateTime } from 'luxon';
import { stringMatchesPattern } from 'src/util';

const DatetimeInput = ({ inputRef, value=null, ariaLabel="Timestamp input" }) => {
    return (
        <input
            ref={inputRef}
            className="input my-2 text-center"
            type="datetime-local"
            step="1"
            defaultValue={
                value ? value : DateTime.now().toFormat("yyyy-MM-dd'T'HH:mm:ss")
            }
            aria-label={ariaLabel}
        />
    );
};

DatetimeInput.propTypes = {
    inputRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ]),
    value: stringMatchesPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/),
    ariaLabel: PropTypes.string
};

export default DatetimeInput;
