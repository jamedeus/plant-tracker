import React from 'react';
import PropTypes from 'prop-types';
import GroupDetails from 'src/components/GroupDetails';
import PlantDetails from 'src/components/PlantDetails';
import clsx from 'clsx';
import plantDetailsProptypes from 'src/types/plantDetailsPropTypes';
import groupDetailsProptypes from 'src/types/groupDetailsPropTypes';

const DetailsCard = ({ name, photo, type, detailsParams }) => {
    return (
        <div className="card p-4 gap-4">
            <span className="text-xl font-bold text-center">
                {name}
            </span>
            {photo && (
                <img
                    className="rounded-xl object-cover aspect-square w-full"
                    src={photo}
                    alt={`${name} photo`}
                    draggable={false}
                />
            )}
            <div className="collapse group">
                {/* Hidden checkbox controls details open/close state */}
                {/* Open by default if no photo, closed if has photo */}
                <input
                    id="showDetails"
                    type="checkbox"
                    className="hidden pointer-events-none"
                    defaultChecked={photo ? false : true}
                />
                {/* Only show open/close details button if has photo */}
                {photo &&
                    <div className="collapse-title min-h-0 text-sm md:text-base">
                        <label
                            tabIndex={-1}
                            htmlFor="showDetails"
                            className={clsx(
                                "transition-opacity duration-300",
                                "group-has-checked:opacity-0"
                            )}
                            aria-label="Show details"
                        >
                            Show details
                        </label>
                    </div>
                }
                <div className="collapse-content mx-auto max-w-72 w-full">
                    {type === "plant" ? (
                        <PlantDetails { ...detailsParams} />
                    ) : (
                        <GroupDetails { ...detailsParams} />
                    )}
                </div>
            </div>
        </div>
    );
};

DetailsCard.propTypes = {
    name: PropTypes.string.isRequired,
    photo: PropTypes.string,
    type: PropTypes.oneOf([
        "plant",
        "group"
    ]).isRequired,
    detailsParams: PropTypes.oneOfType([
        plantDetailsProptypes,
        groupDetailsProptypes
    ]).isRequired
};

export default DetailsCard;
