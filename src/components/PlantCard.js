import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/16/solid';
import { timestampToRelative } from 'src/util';

const PlantCard = ({ name, uuid, species, description, pot_size, last_watered }) => {
    // Track details collapse open state
    const [open, setOpen] = useState(false);

    // Button handler toggles collapse state, prevents click propagating
    // to card (redirects to manage_plant page)
    const toggle = (e) => {
        setOpen(!open);
        e.stopPropagation();
    };

    const Details = () => {
        return (
            <div className="collapse-content px-16">
                <p className={species ? 'flex' : 'hidden'}>
                    <span className="font-semibold">Species:</span>
                    <span className="ml-auto">{species}</span>
                </p>
                <p className={pot_size ? 'flex' : 'hidden'}>
                    <span className="font-semibold">Pot size:</span>
                    <span className="ml-auto">{pot_size}</span>
                </p>
                <div className={description ? 'text-center' : 'hidden'}>
                    <p className="font-semibold mt-3">Description:</p>
                    <p className="text-sm line-clamp-6">{description}</p>
                </div>
            </div>
        );
    };

    const NoDetails = () => {
        return (
            <div className="collapse-content px-16">
                <p className="text-center">No details</p>
            </div>
        );
    };

    // Renders collapse with Plant details, opened with arrow button
    const DetailsSection = () => {
        return (
            <div className="collapse bg-neutral">
                <input
                    type="checkbox"
                    className="hidden"
                    onChange={toggle}
                    defaultChecked={open}
                />
                {(() => {
                    if (!species && !pot_size && !description) {
                        return <NoDetails />;
                    } else {
                        return <Details />;
                    }
                })()}
            </div>
        );
    };

    return (
        <div
            className="card bg-neutral text-neutral-content mx-auto w-full dropdown relative"
            onClick={() => window.location.href = `/manage/${uuid}`}
        >
            <div className="card-body text-center">
                <h2 className="card-title mx-auto pr-8 indent-8 line-clamp-1">
                    {name}
                </h2>
                {(() => {
                    if (last_watered) {
                        return <p>Watered {timestampToRelative(last_watered)}</p>;
                    } else {
                        return <p>Never watered</p>;
                    }
                })()}
            </div>
            <button
                tabIndex={0}
                role="button"
                className="btn btn-sm btn-circle btn-ghost absolute right-2 top-8 z-40"
                onClick={(e) => toggle(e)}
            >
                {(() => {
                    switch(open) {
                        case(true):
                            return <ChevronUpIcon className="w-8 h-8" />;
                        case(false):
                            return <ChevronDownIcon className="w-8 h-8" />;
                    }
                })()}
            </button>
            <DetailsSection />
        </div>
    );
};

PlantCard.propTypes = {
    name: PropTypes.string,
    uuid: PropTypes.string,
    species: PropTypes.string,
    description: PropTypes.string,
    pot_size: PropTypes.number,
    last_watered: PropTypes.string
};

export default PlantCard;
