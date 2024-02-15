import React, { useState, useEffect, useRef } from 'react';

const PlantDetails = ({ name, species, pot_size, description }) => {
    return (
        <form id="plantDetails">
            <label className="form-control w-full">
                <div className="label">
                    <span className="label-text-alt">Plant name</span>
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
                    <span className="label-text-alt">Plant species</span>
                </div>
                <input
                    name="species"
                    type="text"
                    className="input w-full input-bordered"
                    defaultValue={species}
                />
            </label>
            <label className="form-control w-full">
                <div className="label">
                    <span className="label-text-alt">Pot size</span>
                </div>
                <input
                    name="pot_size"
                    type="number"
                    className="input w-full input-bordered"
                    min="1"
                    max="36"
                    defaultValue={pot_size}
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
    )
}

export default PlantDetails;
