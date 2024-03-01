import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/16/solid';
import LastEventTime from 'src/components/LastEventTime';
import PlantDetails from 'src/components/PlantDetails';

const PlantCard = ({ name, uuid, species, description, pot_size, last_watered }) => {
    // Track details collapse open state
    const [open, setOpen] = useState(false);

    // Button handler toggles collapse state, prevents click propagating
    // to card (redirects to manage_plant page)
    const toggle = (e) => {
        setOpen(!open);
        e.stopPropagation();
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
                <div className="collapse-content px-16">
                    <PlantDetails
                        species={species}
                        pot_size={pot_size}
                        description={description}
                    />
                </div>
            </div>
        );
    };

    return (
        <div
            className="card bg-neutral text-neutral-content mx-auto relative"
            onClick={() => window.location.href = `/manage/${uuid}`}
        >
            <div className="card-body text-center">
                <h2 className="card-title mx-auto pr-8 indent-8 line-clamp-1">
                    {name}
                </h2>
                <LastEventTime text="watered" timestamp={last_watered} />
            </div>
            <button
                tabIndex={0}
                role="button"
                className="btn-close absolute right-2 top-8 z-40"
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
