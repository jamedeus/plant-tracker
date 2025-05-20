import React, { useRef } from 'react';
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Captions from "yet-another-react-lightbox/plugins/captions";
import Slideshow from "yet-another-react-lightbox/plugins/slideshow";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";
import "src/css/gallery.css";
import { useSelector, useDispatch } from 'react-redux';
import { timestampToReadable } from 'src/timestampUtils';
import { photoGalleryOpened, photoGalleryIndexChanged } from './timelineSlice';
import { useIsBreakpointActive } from 'src/useBreakpoint';
import LoadingAnimation from 'src/components/LoadingAnimation';

const Gallery = () => {
    // Controls open state, set to true when timeline PhotoThumbnail clicked
    const open = useSelector((state) => state.timeline.photoGalleryOpen);
    // Controls initially visible photo (does not update as carousel moves).
    // Used to open clicked photo + remember last-viewed photo when closing.
    const index = useSelector((state) => state.timeline.photoGalleryIndex);
    // Controls slideshow delay (user-configurable in settings)
    const delay = useSelector((state) => state.settings.gallerySlideshowDelay);
    // Array of objects each representing 1 existing photo
    const photos = useSelector((state) => state.timeline.photos);
    const dispatch = useDispatch();

    // True if desktop layout, false if mobile
    const desktop = useIsBreakpointActive('md');

    // Use to access current state (visible slide index, url, etc)
    const controllerRef = useRef(null);

    return (
        <Lightbox
            open={open}
            on={{
                exiting: () => {
                    const {
                        currentIndex,
                        currentSlide
                    } = controllerRef.current.getLightboxState();

                    // Save current photo index for next time gallery is opened
                    dispatch(photoGalleryIndexChanged({ index: currentIndex }));

                    // Scroll timeline to last-view photo
                    document.querySelector(
                        `[data-timeline-thumbnail="${currentSlide.thumbnail}"]`
                    )?.scrollIntoView({ behavior: "smooth", block: "start" });
                },
                // Close gallery
                exited: () => dispatch(photoGalleryOpened({ open: false })),
            }}
            render={{ iconLoading: () => <LoadingAnimation /> }}
            controller={{
                ref: controllerRef,
                closeOnPullDown: true
            }}
            plugins={[
                Zoom,
                Captions,
                Slideshow,
                Thumbnails,
                Fullscreen
            ]}
            toolbar={{
                buttons: ["close"]
            }}
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
            slideshow={{
                delay: delay
            }}
            zoom={{
                // Limit zoon to 50% on mobile
                maxZoomPixelRatio: desktop ? 1 : 0.5
            }}
        />
    );
};

export default Gallery;
