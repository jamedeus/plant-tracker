import React from 'react';
import PropTypes from 'prop-types';
import Lightbox from "yet-another-react-lightbox";
import Captions from "yet-another-react-lightbox/plugins/captions";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";
import "src/css/gallery.css";
import { useSelector } from 'react-redux';
import { timestampToReadable } from 'src/timestampUtils';

const Gallery = ({ open, setOpen }) => {
    const photos = useSelector((state) => state.timeline.photos);

    return (
        <Lightbox
            open={open}
            close={() => setOpen(false)}
            plugins={[Captions]}
            captions={{
                showToggle: true,
                descriptionTextAlign: 'center'
            }}
            slides={photos.map(photo => ({
                src: photo.thumbnail,
                description: timestampToReadable(photo.timestamp),
                imageFit: 'contain',
            }))}
        />
    );
};

Gallery.propTypes = {
    open: PropTypes.bool.isRequired,
    setOpen: PropTypes.func.isRequired
};

export default Gallery;
