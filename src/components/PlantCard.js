import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/16/solid'

const PlantCard = ({ name, uuid, species, description, pot_size }) => {
    // Track details collapse open state
    const [open, setOpen] = useState(false);

    // Button handler toggles collapse state, prevents click propagating
    // to card (redirects to manage_plant page)
    const toggle = (e) => {
        setOpen(!open);
        e.stopPropagation();
    };

    // Renders collapse with Plant details, opened with info button
    const DetailsSection = () => {
        return (
            <div className="collapse bg-neutral">
                <input
                    type="checkbox"
                    className="hidden"
                    onChange={toggle}
                    defaultChecked={open}
                />
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
                        <p>{description}</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div
            className="card bg-neutral text-neutral-content mx-auto w-full dropdown relative"
            onClick={() => window.location.href = `/manage/${uuid}`}
        >
            <div className="card-body text-center">
                <h2 className="card-title mx-auto">{name}</h2>
            </div>
            <button
                tabIndex={0}
                role="button"
                className="btn btn-sm btn-circle btn-ghost absolute right-4 top-4 z-40"
                onClick={(e) => toggle(e)}
            >
                {(() => {
                    switch(open) {
                        case(true):
                            return <ChevronUpIcon />
                        case(false):
                            return <ChevronDownIcon />
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
    pot_size: PropTypes.string
};

export default PlantCard;
