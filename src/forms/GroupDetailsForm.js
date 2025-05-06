import React from 'react';
import PropTypes from 'prop-types';

const GroupDetailsForm = ({ formRef, name, location, description }) => {
    return (
        <form id="groupDetails" ref={formRef} className="flex flex-col gap-4">
            <fieldset>
                <legend>Group name</legend>
                <input
                    name="name"
                    type="text"
                    className="input w-full"
                    defaultValue={name}
                />
            </fieldset>
            <fieldset>
                <legend>Group Location</legend>
                <input
                    name="location"
                    type="text"
                    className="input w-full"
                    defaultValue={location}
                />
            </fieldset>
            <fieldset>
                <legend>Description</legend>
                <textarea
                    name="description"
                    className="textarea w-full"
                    defaultValue={description}
                />
            </fieldset>
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
