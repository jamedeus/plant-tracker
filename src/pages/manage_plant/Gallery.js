import React, { useState, useMemo } from 'react';
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Captions from "yet-another-react-lightbox/plugins/captions";
import Download from "yet-another-react-lightbox/plugins/download";
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
    ArrowDownTrayIcon,
    ArrowsPointingInIcon,
    ArrowsPointingOutIcon,
    MagnifyingGlassPlusIcon,
    MagnifyingGlassMinusIcon
} from '@heroicons/react/24/solid';
import { DateTime } from 'luxon';

// Takes reference to element, returns true if within current viewport and not
// behind navbar/timeline sticky header (64 + 72 = 136px)
const elementIsVisible = (element) => {
    const rect = element.getBoundingClientRect();
    return rect.top >= 136 && rect.bottom <= window.innerHeight;
};

const Gallery = () => {
    // Controls open state, set to true when timeline PhotoThumbnail clicked
    const open = useSelector((state) => state.timeline.photoGalleryOpen);
    // Controls initially visible photo (updates as carousel moves).
    // Used to open clicked photo + remember last-viewed photo when reopened.
    const index = useSelector((state) => state.timeline.photoGalleryIndex);
    // Controls slideshow delay (user-configurable in settings)
    const delay = useSelector((state) => state.settings.gallerySlideshowDelay);
    // Controls whether captions with photo date are visible
    const caption = useSelector((state) => state.settings.galleryShowPhotoDate);
    // Controls whether timeline scrolls to last photo when gallery closed
    const scroll = useSelector((state) => state.settings.galleryScrollToPhoto);
    // Array of objects each representing 1 existing photo
    const photos = useSelector((state) => state.timeline.photos);
    const dispatch = useDispatch();

    // True if desktop layout, false if mobile
    const desktop = useIsBreakpointActive('md');

    // Shows progress animation if true
    const [slideshowRunning, setSlideshowRunning] = useState(false);

    // Track if slide has changed since opening (don't scroll timeline to
    // last-viewed photo unless slide has changed)
    const [slideHasChanged, setSlideHasChanged] = useState(false);

    // Get thumbnail + container heights for current layout
    // Pre-computing container height fixes animation stutter on mobile
    const thumbnailSize = desktop ? 100 : 80;
    const thumbnailContainerHeight = thumbnailSize + 32;

    // Build slides array, only update when redux photos state changes
    const slides = useMemo(() => photos.map(photo => ({
        src: photo.image,
        thumbnail: photo.thumbnail,
        description: timestampToReadable(photo.timestamp).split('-')[1].trim(),
        imageFit: 'contain',
        key: photo.key
    })), [photos]);

    return (
        <Lightbox
            open={open}
            on={{
                // Reset slideHasChanged when opened
                entered: () => {
                    setSlideHasChanged(false);
                },

                // Scroll timeline to last-viewed photo before closing
                exiting: () => {
                    // Only scroll if user setting enabled and slide changed
                    if (scroll && slideHasChanged) {
                        // Get yyyy-MM-dd date of last-viewed photo
                        const currentSlide = slides[index];
                        const currentSlideDate = DateTime.fromFormat(
                            currentSlide.description,
                            'MMMM d, yyyy'
                        ).toFormat('yyyy-MM-dd');

                        // Get timeline row containing last-viewed photo
                        const timelineRow = document.querySelector(
                            `[data-date="${currentSlideDate}"]`
                        );

                        // Only scroll if timeline row is outside viewport
                        if (!elementIsVisible(timelineRow)) {
                            timelineRow?.scrollIntoView({
                                behavior: "smooth",
                                block: "start"
                            });
                        }
                    }
                },

                // Close gallery
                exited: () => dispatch(photoGalleryOpened({ open: false })),

                // Track current slide each time slide changes
                view: ({ index: currentIndex }) => {
                    // Don't set slideHasChanged when lightbox first opens
                    if (currentIndex !== index) {
                        setSlideHasChanged(true);
                    }
                    dispatch(photoGalleryIndexChanged({ index: currentIndex }));
                },

                // Start progress animation when slideshow starts
                slideshowStart: () => {
                    setSlideshowRunning(true);
                },

                // Stop progress animation when slideshow stops
                slideshowStop: () => {
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
                iconDownload: () => <ArrowDownTrayIcon className="size-8" />,
                iconExitFullscreen: () => <ArrowsPointingInIcon className="size-8" />,
                iconEnterFullscreen: () => <ArrowsPointingOutIcon className="size-8" />,
                // Match loading animation used in rest of app
                iconLoading: () => <LoadingAnimation />,
                // Render progress bar if slideshow is running
                // Key changes on each slide (remount, start animation over)
                controls: () => {
                    if (slideshowRunning) {
                        return (
                            <div
                                key={index}
                                className="slideshow_progress_bar"
                                style={{
                                    "--slideshow-delay": `${delay}ms`
                                }}
                            />
                        );
                    }
                }
            }}
            labels={{
                Next: "Next photo",
                Prev: "Previous photo",
                Close: "Close photo gallery",
                Play: "Play photo slideshow",
                Pause: "Pause photo slideshow",
                Download: "Download plant photo"
            }}
            controller={{
                closeOnPullDown: true,
                closeOnBackdropClick: true
            }}
            plugins={[
                Zoom,
                ...(caption ? [Captions] : []),
                Download,
                Slideshow,
                Thumbnails,
                Fullscreen
            ]}
            toolbar={{
                buttons: [
                    "download",
                    "slideshow",
                    "fullscreen",
                    "close"
                ]
            }}
            index={index}
            slides={slides}
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
                    "--thumbnail-container-height": `${thumbnailContainerHeight}px`,
                    "--yarl__thumbnails_thumbnail_background": "transparent",
                },
                root: {
                    "--yarl__color_backdrop": "color-mix(in oklab, var(--color-base-200)75%, #0000)",
                    WebkitBackdropFilter: "blur(8px) saturate(180%)",
                    backdropFilter: "blur(8px) saturate(180%)"
                },
                slide: {
                    placeholder: {
                        backgroundColor: "color-mix(in oklab, var(--color-base-200)75%, #0000)",
                        WebkitBackdropFilter: "blur(8px) saturate(180%)",
                        backdropFilter: "blur(8px) saturate(180%)"
                    }
                }
            }}
        />
    );
};

export default Gallery;
