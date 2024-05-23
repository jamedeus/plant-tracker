import React from 'react';
import PropTypes from 'prop-types';

const GroupDetailsForm = ({ formRef, name, location, description }) => {
    return (
        <form id="groupDetails" ref={formRef}>
            <label className="form-control w-full">
                <div className="label">
                    <span className="label-text-alt">Group name</span>
                </div>
                <input
                    name="name"
                    type="text"
                    className="input w-full input-bordered"
                    defaultValue={name}
                />
            </label>
            <label className="form-control w-full">
                <div className="label">
                    <span className="label-text-alt">Group location</span>
                </div>
                <input
                    name="location"
                    type="text"
                    className="input w-full input-bordered"
                    defaultValue={location}
                />
            </label>
            <label className="form-control w-full">
                <div className="label">
                    <span className="label-text-alt">Description</span>
                </div>
                <textarea
                    name="description"
                    className="textarea textarea-bordered"
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
    ]),
    name: PropTypes.string,
    location: PropTypes.string,
    description: PropTypes.string
};

export default GroupDetailsForm;
