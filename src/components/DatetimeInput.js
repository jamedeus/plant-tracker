import React from 'react';
import { DateTime } from 'luxon';

const DatetimeInput = ({ id }) => {
    return (
        <input
            id={id}
            className="input input-bordered mx-auto my-2"
            type="datetime-local"
            step="1"
            defaultValue={DateTime.now().toFormat("yyyy-MM-dd'T'HH:mm:ss")}
        />
    )
}

export default DatetimeInput;
