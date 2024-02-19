import React, { useState, useEffect, useRef } from 'react';

const TrayDetails = ({ name, location }) => {
    return (
        <form id="trayDetails">
            <label className="form-control w-full">
                <div className="label">
                    <span className="label-text-alt">Tray name</span>
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
                    <span className="label-text-alt">Tray location</span>
                </div>
                <input
                    name="location"
                    type="text"
                    className="input w-full input-bordered"
                    defaultValue={location}
                />
            </label>
        </form>
    );
};

export default TrayDetails;
