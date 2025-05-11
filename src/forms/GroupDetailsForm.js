import React from 'react';
import PropTypes from 'prop-types';

const GroupDetailsForm = ({ formRef, name, location, description }) => {
    return (
        <form id="groupDetails" ref={formRef} className="flex flex-col gap-4">
            <label>
                <span>Group name</span>
                <input
                    name="name"
                    type="text"
                    className="input w-full"
                    defaultValue={name}
                />
            </label>
            <label>
                <span>Group location</span>
                <input
                    name="location"
                    type="text"
                    className="input w-full"
                    defaultValue={location}
                />
            </label>
            <label>
                <span>Description</span>
                <textarea
                    name="description"
                    className="textarea w-full"
                    defaultValue={description}
                />
            </label>
        </form>
    );
};

GroupDetailsForm.propTypes = {
    formRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ]).isRequired,
    name: PropTypes.string,
    location: PropTypes.string,
    description: PropTypes.string
};

export default GroupDetailsForm;
