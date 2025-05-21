import React, { useRef, useState } from 'react';
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
import {
    XMarkIcon,
    PlayIcon,
    PauseIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ArrowsPointingInIcon,
    ArrowsPointingOutIcon,
    MagnifyingGlassPlusIcon,
    MagnifyingGlassMinusIcon
} from '@heroicons/react/24/solid';

const Gallery = () => {
    // Controls open state, set to true when timeline PhotoThumbnail clicked
    const open = useSelector((state) => state.timeline.photoGalleryOpen);
    // Controls initially visible photo (does not update as carousel moves).
    // Used to open clicked photo + remember last-viewed photo when closing.
    const index = useSelector((state) => state.timeline.photoGalleryIndex);
    // Controls slideshow delay (user-configurable in settings)
    const delay = useSelector((state) => state.settings.gallerySlideshowDelay);
    // Controls whether captions with photo date are visible
    const caption = useSelector((state) => state.settings.galleryShowPhotoDate);
    // Array of objects each representing 1 existing photo
    const photos = useSelector((state) => state.timeline.photos);
    const dispatch = useDispatch();

    // True if desktop layout, false if mobile
    const desktop = useIsBreakpointActive('md');

    // Use to access current state (visible slide index, url, etc)
    const controllerRef = useRef(null);

    // Used for progress animation
    const [slideshowRunning, setSlideshowRunning] = useState(false);
    const [progressBarKey, setProgressBarKey] = useState(0);

    // Get thumbnail + container heights for current layout
    // Pre-computing container height fixes animation stutter on mobile
    const thumbnailSize = desktop ? 100 : 80;
    const thumbnailContainerHeight = thumbnailSize + 32;

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

                view: () => {
                    // When slideshow changes slides: change progress bar key to
                    // force render (start animation over), set new index (state
                    // change causes re-render, will go back to whaetever slide
                    // is saved in photoGalleryIndex state).
                    //
                    // Would be simpler to set index every time slide changes
                    // but this causes render that breaks thumbnail animation.
                    if (slideshowRunning) {
                        const {
                            currentIndex,
                            currentSlide
                        } = controllerRef.current.getLightboxState();
                        dispatch(photoGalleryIndexChanged({ index: currentIndex }));
                        setProgressBarKey(currentSlide.key);
                    }
                },

                slideshowStart: () => {
                    // Start on current slide
                    const { currentIndex } = controllerRef.current.getLightboxState();
                    dispatch(photoGalleryIndexChanged({ index: currentIndex }));
                    // Start progress animation for first slide
                    setSlideshowRunning(true);
                },

                slideshowStop: () => {
                    // Stop progress animation
                    setSlideshowRunning(false);
                },
            }}
            render={{
                // Custom icons (match icons used in rest of the app)
                iconPrev: () => <ChevronLeftIcon className="size-8" />,
                iconNext: () => <ChevronRightIcon className="size-8" />,
                iconZoomIn: () => <MagnifyingGlassPlusIcon className="size-8" />,
                iconZoomOut: () => <MagnifyingGlassMinusIcon className="size-8" />,
                iconSlideshowPlay: () => <PlayIcon className="size-8" />,
                iconSlideshowPause: () => <PauseIcon className="size-8" />,
                iconClose: () => <XMarkIcon className="size-8" />,
                iconExitFullscreen: () => (<ArrowsPointingInIcon className="size-8" />),
                iconEnterFullscreen: () => <ArrowsPointingOutIcon className="size-8" />,
                // Match loading animation used in rest of app
                iconLoading: () => <LoadingAnimation />,
                // Render progress bar if slideshow is running
                // Key changes on each slide (remount, start animation over)
                controls: () => {
                    if (slideshowRunning) {
                        return (
                            <div
                                key={progressBarKey}
                                className="slideshow_progress_bar"
                                style={{
                                    "--slideshow-delay": `${delay}ms`
                                }}
                            />
                        );
                    }
                }
            }}
            controller={{
                ref: controllerRef,
                closeOnPullDown: true
            }}
            plugins={[
                Zoom,
                ...(caption ? [Captions] : []),
                Slideshow,
                Thumbnails,
                Fullscreen
            ]}
            toolbar={{
                buttons: ["close"]
            }}
            index={index}
            slides={photos.map(photo => ({
                src: photo.image,
                thumbnail: photo.thumbnail,
                description: timestampToReadable(photo.timestamp).split('-')[1],
                imageFit: 'contain',
                key: photo.key
            }))}
            thumbnails={{
                width: thumbnailSize,
                height: thumbnailSize,
                border: 0,
                padding: 0,
                imageFit: 'cover',
                vignette: true,
            }}
            slideshow={{
                delay: delay
            }}
            zoom={{
                // Limit zoom to 50% on mobile
                maxZoomPixelRatio: desktop ? 1 : 0.5
            }}
            // Set class that causes thumbnails to shrink when slideshow starts
            className={slideshowRunning ? 'slideshow-running' : null}
            // Set pre-computed height var used in thumbnail shrink transition
            // Fixes stutter on mobile caused by using calc() for initial height
            styles={{
                thumbnailsContainer: {
                    "--thumbnail-container-height": `${thumbnailContainerHeight}px`
                }
            }}
        />
    );
};

export default Gallery;
