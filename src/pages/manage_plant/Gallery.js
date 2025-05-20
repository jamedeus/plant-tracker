import React from 'react';
import Lightbox from "yet-another-react-lightbox";
import Captions from "yet-another-react-lightbox/plugins/captions";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";
import "src/css/gallery.css";
import { useSelector, useDispatch } from 'react-redux';
import { timestampToReadable } from 'src/timestampUtils';
import { photoGalleryOpened } from './timelineSlice';
import { useIsBreakpointActive } from 'src/useBreakpoint';

const Gallery = () => {
    const open = useSelector((state) => state.timeline.photoGalleryOpen);
    const index = useSelector((state) => state.timeline.photoGalleryIndex);
    const photos = useSelector((state) => state.timeline.photos);
    const dispatch = useDispatch();

    // True if desktop layout, false if mobile
    const desktop = useIsBreakpointActive('md');

    return (
        <Lightbox
            open={open}
            close={() => dispatch(photoGalleryOpened({open: false}))}
            plugins={[Captions, Thumbnails]}
            index={index}
            captions={{
                showToggle: true,
                descriptionTextAlign: 'center'
            }}
            slides={photos.map(photo => ({
                src: photo.image,
                thumbnail: photo.thumbnail,
                description: timestampToReadable(photo.timestamp),
                imageFit: 'contain',
            }))}
            thumbnails={{
                width: desktop ? 100 : 80,
                height: desktop ? 100 : 80,
                border: 0,
                padding: 0,
                imageFit: 'cover',
                vignette: true,
            }}
        />
    );
};

export default Gallery;
