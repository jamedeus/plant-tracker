import React, { useState, memo } from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import WaterIcon from 'src/components/WaterIcon';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/16/solid';
import PlantDetails from 'src/components/PlantDetails';
import { capitalize } from 'src/util';
import { timestampToRelativeCalendar, timestampToReadable} from 'src/timestampUtils';

const PlantCard = memo(function PlantCard({ display_name, uuid, species, description, pot_size, last_watered, thumbnail, linkPage=true, archived=false }) {
    // Track details collapse open state
    const [open, setOpen] = useState(false);

    // Button handler toggles collapse state, prevents click propagating
    // to card (redirects to manage_plant page unless linkPage arg is false)
    const toggle = (e) => {
        setOpen(!open);
        e.preventDefault();
        e.stopPropagation();
    };

    return (
        <a
            href={linkPage ? `/manage/${uuid}` : null}
            className={clsx(
                'collapse bg-neutral',
                archived && 'grayscale',
                linkPage && 'cursor-pointer',
                open ? 'collapse-open' : 'collapse-close'
            )}
        >
            <div className='collapse-title !p-0 min-w-0 min-h-0'>
                <div className='card card-side text-neutral-content relative'>
                    {thumbnail && (
                        <figure className="h-24 w-20 min-h-20 min-w-20 rounded-b-none">
                            <img
                                loading="lazy"
                                src={thumbnail}
                                className="w-full h-full object-cover"
                            />
                        </figure>
                    )}

                    {/* Card body */}
                    <div className={clsx(
                        'card-body cursor-default',
                        thumbnail ? 'my-auto text-start' : 'text-center'
                    )}>
                        <h2 className={clsx(
                            'card-title line-clamp-1',
                            thumbnail ? 'pr-8' : 'mx-auto px-8'
                        )}>
                            {display_name}
                        </h2>
                        {last_watered ? (
                            <span
                                title={timestampToReadable(last_watered)}
                                className='line-clamp-1'
                            >
                                <WaterIcon />
                                {capitalize(
                                    timestampToRelativeCalendar(last_watered, true)
                                )}
                            </span>
                        ) : (
                            <span>Never watered</span>
                        )}
                    </div>

                    {/* Button opens/closes collapse with details */}
                    <button
                        tabIndex={0}
                        role="button"
                        className="btn-close absolute right-2 top-8 z-40"
                        onClick={(e) => toggle(e)}
                    >
                        {open
                            ? <ChevronUpIcon className="w-8 h-8" />
                            : <ChevronDownIcon className="w-8 h-8" />
                        }
                    </button>
                </div>
            </div>
            {/* Plant details collapse, closed until button clicked */}
            <div className="collapse-content">
                <div className="pt-4">
                    <PlantDetails
                        species={species}
                        pot_size={pot_size}
                        description={description}
                    />
                </div>
            </div>
        </a>
    );
});

PlantCard.propTypes = {
    display_name: PropTypes.string.isRequired,
    uuid: PropTypes.string.isRequired,
    species: PropTypes.string,
    description: PropTypes.string,
    pot_size: PropTypes.number,
    last_watered: PropTypes.string,
    thumbnail: PropTypes.string,
    linkPage: PropTypes.bool,
    archived: PropTypes.bool
};

export default PlantCard;
