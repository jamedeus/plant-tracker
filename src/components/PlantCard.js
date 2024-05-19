import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDroplet } from '@fortawesome/free-solid-svg-icons';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/16/solid';
import PlantDetails from 'src/components/PlantDetails';
import { timestampToRelativeCalendar, capitalize } from 'src/util';

const PlantCard = ({ name, uuid, species, description, pot_size, last_watered, thumbnail, linkPage=true }) => {
    // Track details collapse open state
    const [open, setOpen] = useState(false);

    // Button handler toggles collapse state, prevents click propagating
    // to card (redirects to manage_plant page unless linkPage arg is false)
    const toggle = (e) => {
        setOpen(!open);
        e.stopPropagation();
    };

    // Click handler, redirects to manage_plant unless linkPage arg is false
    const manageLink = () => {
        window.location.href = `/manage/${uuid}`;
    };

    // Renders collapse with Plant details, opened with arrow button
    const DetailsSection = () => {
        return (
            <div className={
                `collapse bg-neutral rounded-t-none cursor-default
                ${open ? "pt-4" : ""}`
            }>
                <input
                    type="checkbox"
                    className="hidden"
                    onChange={toggle}
                    defaultChecked={open}
                />
                <div className="collapse-content">
                    <PlantDetails
                        species={species}
                        pot_size={pot_size}
                        description={description}
                    />
                </div>
            </div>
        );
    };

    const Thumbnail = () => {
        return (
            <figure className="h-24 w-20 min-h-20 min-w-20">
                <img src={thumbnail} className="w-full h-full object-cover" />
            </figure>
        );
    };

    const LastWatered = () => {
        if (last_watered) {
            return (
                <span>
                    <FontAwesomeIcon
                        icon={faDroplet}
                        className="mr-2 text-info"
                    />
                    {capitalize(timestampToRelativeCalendar(last_watered, true))}
                </span>
            );
        } else {
            return <span>Never watered</span>;
        }
    };

    const Body = () => {
        switch(thumbnail) {
            case(null):
                return (
                    <div className="card-body text-center cursor-default">
                        <h2 className="card-title mx-auto px-8 line-clamp-1">
                            {name}
                        </h2>
                        <LastWatered />
                    </div>
                );
            default:
                return (
                    <div className="card-body my-auto text-start cursor-default">
                        <h2 className="card-title line-clamp-1 pr-8">
                            {name}
                        </h2>
                        <LastWatered />
                    </div>
                );
        }
    };

    return (
        <>
            <div
                className={
                    `card card-side bg-neutral text-neutral-content mx-auto relative
                    ${open ? "rounded-b-none" : ""} ${linkPage ? 'cursor-pointer' : ''}`
                }
                onClick={linkPage ? manageLink : null}
            >
                {(() => {
                    switch(thumbnail) {
                        case(null):
                            return null;
                        default:
                            return <Thumbnail />;
                    }
                })()}

                <Body />

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
            </div>
            <DetailsSection />
        </>
    );
};

PlantCard.propTypes = {
    name: PropTypes.string,
    uuid: PropTypes.string,
    species: PropTypes.string,
    description: PropTypes.string,
    pot_size: PropTypes.number,
    last_watered: PropTypes.string,
    thumbnail: PropTypes.string,
    linkPage: PropTypes.bool
};

export default PlantCard;
