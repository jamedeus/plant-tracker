import React, { useId, memo } from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import { ChevronDownIcon } from '@heroicons/react/16/solid';
import GroupDetails from 'src/components/GroupDetails';

const GroupCard = memo(function GroupCard({
    display_name,
    plants,
    uuid,
    location,
    description,
    linkPage=true,
    archived=false
}) {
    // ID for hidden checkbox that controls details collapse open/close state
    const checkboxId = useId();

    return (
        <a
            href={linkPage ? `/manage/${uuid}` : null}
            className={clsx(
                'collapse card-collapse bg-neutral group',
                archived && 'grayscale',
                linkPage && 'cursor-pointer'
            )}
        >
            {/* Hidden checkbox controls open/close state */}
            <input
                id={checkboxId}
                type="checkbox"
                className="hidden pointer-events-none"
            />

            <div className='collapse-title !p-0 min-w-0 min-h-0'>
                <div className='card text-neutral-content relative'>
                    {/* Card body */}
                    <div className='card-body cursor-default max-w-full text-center'>
                        <h2 className='card-title line-clamp-1 break-words px-8'>
                            {display_name}
                        </h2>
                        <p>Contains {plants} plants</p>
                    </div>

                    {/* Button opens/closes collapse with details */}
                    <label
                        tabIndex={-1}
                        role="button"
                        htmlFor={checkboxId}
                        className="btn-close absolute right-2 top-8 z-40"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <ChevronDownIcon className={clsx(
                            "w-8 h-8 transition-transform duration-200",
                            "rotate-0 group-has-[:checked]:rotate-180"
                        )} />
                    </label>
                </div>
            </div>
            {/* Group details collapse, closed until button clicked */}
            <div className="collapse-content break-all">
                <div className="pt-4">
                    <GroupDetails
                        location={location}
                        description={description}
                    />
                </div>
            </div>
        </a>
    );
});

GroupCard.propTypes = {
    display_name: PropTypes.string.isRequired,
    plants: PropTypes.number.isRequired,
    uuid: PropTypes.string.isRequired,
    location: PropTypes.string,
    description: PropTypes.string,
    linkPage: PropTypes.bool,
    archived: PropTypes.bool
};

export default GroupCard;
