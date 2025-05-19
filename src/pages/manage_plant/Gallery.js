import React from 'react';
import Lightbox from "yet-another-react-lightbox";
import Captions from "yet-another-react-lightbox/plugins/captions";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";
import "src/css/gallery.css";
import { useSelector, useDispatch } from 'react-redux';
import { timestampToReadable } from 'src/timestampUtils';
import { photoGalleryOpened, photoGalleryIndexChanged } from './timelineSlice';

const Gallery = () => {
    const open = useSelector((state) => state.timeline.photoGalleryOpen);
    const index = useSelector((state) => state.timeline.photoGalleryIndex);
    const photos = useSelector((state) => state.timeline.photos);
    const dispatch = useDispatch();

    return (
        <Lightbox
            open={open}
            close={() => dispatch(photoGalleryOpened({open: false}))}
            plugins={[Captions]}
            index={index}
            on={{
                view: ({ index: currentIndex }) => dispatch(
                    photoGalleryIndexChanged({index: currentIndex})
                )
            }}
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

export default Gallery;
