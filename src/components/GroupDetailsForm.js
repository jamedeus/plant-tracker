import React from 'react';
import PropTypes from 'prop-types';

const GroupDetailsForm = ({ formRef, name, location, description }) => {
    return (
        <form id="groupDetails" ref={formRef} className="flex flex-col gap-4">
            <label className="relative">
                <span>Group name</span>
                <input
                    name="name"
                    type="text"
                    className="input w-full"
                    defaultValue={name}
                    pattern=".{0,50}"
                />
                <p className="invalid-input-label" aria-hidden="true">
                    too long!
                </p>
            </label>
            <label className="relative">
                <span>Group location</span>
                <input
                    name="location"
                    type="text"
                    className="input w-full"
                    defaultValue={location}
                    pattern=".{0,50}"
                />
                <p className="invalid-input-label" aria-hidden="true">
                    too long!
                </p>
            </label>
            <label className="relative">
                <span>Description</span>
                <textarea
                    name="description"
                    className="textarea w-full"
                    defaultValue={description}
                    onInput={(e) => e.target.value.length > 500 ? (
                        e.target.setCustomValidity("Too long")
                    ) : (
                        e.target.setCustomValidity("")
                    )}
                />
                <p className="invalid-input-label" aria-hidden="true">
                    too long!
                </p>
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
