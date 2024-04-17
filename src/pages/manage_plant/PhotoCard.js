import React from 'react';
import PropTypes from 'prop-types';
import { timestampToRelative } from 'src/util';

const PhotoCard = ({image_url, thumbnail_url, created}) => {
    return (
        <div className="card card-compact bg-neutral text-neutral-content mb-4 p-2">
            <a href={image_url}>
                <p className="text-lg text-center font-bold mb-2" title={created}>
                    {timestampToRelative(created)}
                </p>
                <img className="rounded-2xl" src={thumbnail_url} alt={created} />
            </a>
        </div>
    );
};

PhotoCard.propTypes = {
    image_url: PropTypes.string,
    thumbnail_url: PropTypes.string,
    created: PropTypes.string
};

export default PhotoCard;
