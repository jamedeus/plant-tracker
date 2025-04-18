import React, { useId, memo } from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import { ChevronDownIcon } from '@heroicons/react/16/solid';

// Renders card representing a Plant or Group entry
// - uuid: Plant or Group uuid (used for manage page link)
// - title: Large title text (Plant or Group display name)
// - subtitle: Normal sized text under title (last watered, plants in group)
// - details: Contents of details dropdown, hidden until expand button clicked
// - thumbnail: Image rendered on left side of card
// - archived: Card appears in grayscale if true, otherwise normal
const InstanceCard = memo(function InstanceCard({
    uuid,
    title,
    subtitle,
    details,
    thumbnail,
    archived
}) {
    // ID for hidden checkbox that controls details collapse open/close state
    const checkboxId = useId();

    return (
        <a
            href={`/manage/${uuid}`}
            className={clsx(
                'collapse card-collapse bg-neutral cursor-pointer group',
                archived && 'grayscale'
            )}
        >
            {/* Hidden checkbox controls open/close state */}
            <input
                id={checkboxId}
                type="checkbox"
                className="hidden pointer-events-none"
            />

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
                        'card-body cursor-default max-w-full',
                        thumbnail ? 'my-auto text-start' : 'text-center'
                    )}>
                        <h2 className={clsx(
                            'card-title line-clamp-1 break-words',
                            thumbnail ? 'pr-8' : 'text-center px-8'
                        )}>
                            {title}
                        </h2>
                        {subtitle}
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
            {/* Details collapse, closed until button clicked */}
            <div className="collapse-content min-w-0">
                <div className="pt-4">
                    {details}
                </div>
            </div>
        </a>
    );
});

InstanceCard.propTypes = {
    uuid: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    subtitle: PropTypes.node.isRequired,
    details: PropTypes.node.isRequired,
    thumbnail: PropTypes.string,
    archived: PropTypes.bool
};

export default InstanceCard;
