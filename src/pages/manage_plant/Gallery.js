import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Captions from "yet-another-react-lightbox/plugins/captions";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import SlideshowToggle from "./SlideshowToggle";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";
import "src/css/gallery.css";
import { sendPostRequest } from 'src/util';
import { useSelector, useDispatch } from 'react-redux';
import { timestampToReadable } from 'src/timestampUtils';
import { defaultPhotoChanged } from './timelineSlice';
import { photoGalleryOpened, photoGalleryIndexChanged } from './interfaceSlice';
import { useIsBreakpointActive } from 'src/useBreakpoint';
import { showToast } from 'src/components/Toast';
import DropdownMenu from 'src/components/DropdownMenu';
import LoadingAnimation from 'src/components/LoadingAnimation';
import {
    XMarkIcon,
    StarIcon,
    PlayIcon,
    PauseIcon,
    ArrowRightIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ArrowDownTrayIcon,
    ArrowsPointingInIcon,
    ArrowsPointingOutIcon,
    MagnifyingGlassPlusIcon,
    MagnifyingGlassMinusIcon
} from '@heroicons/react/24/solid';
import { FaEllipsis } from 'react-icons/fa6';
import { DateTime } from 'luxon';
import clsx from 'clsx';

// Takes reference to element, returns true if within current viewport and not
// behind navbar/timeline sticky header (64 + 72 = 136px)
const elementIsVisible = (element) => {
    const rect = element.getBoundingClientRect();
    return rect.top >= 136 && rect.bottom <= window.innerHeight;
};

// CSS progress bar animation (runs once when mounted, change key to force
// remount and restart animation)
const SlideshowProgressBar = ({ delay, slideshowForward }) => {
    return (
        <div
            className={clsx(
                "slideshow_progress_bar",
                !slideshowForward && "reverse"
            )}
            style={{
                "--slideshow-delay": `${delay}ms`
            }}
        />
    );
};

SlideshowProgressBar.propTypes = {
    delay: PropTypes.number.isRequired,
    slideshowForward: PropTypes.bool.isRequired
};

// Top-right corner dropdown menu
const GalleryDropdown = ({ currentSlide }) => {
    const plantDetails = useSelector((state) => state.plant.plantDetails);
    const dispatch = useDispatch();

    // Sets the current slide as the default photo
    const handleSetDefaultPhoto = async () => {
        document.activeElement.blur();
        const response = await sendPostRequest('/set_plant_default_photo', {
            plant_id: plantDetails.uuid,
            photo_key: currentSlide.key
        });
        if (response.ok) {
            const data = await response.json();
            dispatch(defaultPhotoChanged(data.default_photo));
            showToast('Default photo set!', 'green', 2500);
        } else {
            showToast('Failed to set default photo', 'red', 2500);
        }
    };

    // Opens native share sheet on mobile, saves to downloads folder on desktop
    const handleDownloadPhoto = async () => {
        // Close dropdown menu
        document.activeElement.blur();

        // Build filename with plant name and timestamp
        const plantName = plantDetails.name;
        const photoDate = currentSlide.description;
        const filename = `${plantName}_photo_${photoDate}.jpg`;

        // Check if native share sheet is supported (mobile)
        if (navigator.share && navigator.canShare) {
            // Fetch the image as a blob
            const response = await fetch(currentSlide.src);
            if (!response.ok) {
                console.error('Unable to download photo:');
                showToast('Failed to download photo', 'red', 2500);
                return;
            }

            // Create file with plant name and timestamp in filename
            const blob = await response.blob();
            const file = new File([blob], filename, { type: 'image/jpeg' });

            // Share as file if supported (recipient doesn't need authentication)
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: filename,
                    text: `This is a photo of my plant ${plantName} on ${photoDate}`
                });
            // Fallback to URL otherwise (only saving to disk will work)
            } else {
                await navigator.share({
                    title: filename,
                    text: `This is a photo of my plant ${plantName} on ${photoDate}`,
                    url: currentSlide.src
                });
            }
        // Save photo to disk (desktop)
        } else {
            const link = document.createElement('a');
            link.href = currentSlide.src;
            link.download = filename;
            link.click();
        }
    };

    return (
        <div className="gallery-dropdown dropdown dropdown-start">
            <div
                tabIndex={0}
                role="button"
                className="yarl__button"
                aria-label="Gallery options"
            >
                <FaEllipsis className="size-8" />
            </div>
            <DropdownMenu>
                <li><button
                    className="flex justify-end"
                    onClick={handleDownloadPhoto}
                >
                    <ArrowDownTrayIcon className="size-4 mr-auto" />
                    Download photo
                </button></li>
                <li><button
                    className="flex justify-end"
                    onClick={handleSetDefaultPhoto}
                >
                    <StarIcon className="size-4 mr-auto" />
                    Set default photo
                </button></li>
            </DropdownMenu>
        </div>
    );
};

GalleryDropdown.propTypes = {
    currentSlide: PropTypes.object
};

const Gallery = () => {
    // Controls open state, set to true when timeline PhotoThumbnail clicked
    const open = useSelector((state) => state.interface.photoGalleryOpen);
    // Controls initially visible photo (updates as carousel moves).
    // Used to open clicked photo + remember last-viewed photo when reopened.
    const index = useSelector((state) => state.interface.photoGalleryIndex);
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
    const [slideshowForward, setSlideshowForward] = useState(true);

    // Track if slide has changed since opening (don't scroll timeline to
    // last-viewed photo unless slide has changed)
    const [slideHasChanged, setSlideHasChanged] = useState(false);

    // Get thumbnail + container heights for current layout
    // Pre-computing container height fixes animation stutter on mobile
    const thumbnailSize = desktop ? 100 : 80;
    const thumbnailContainerHeight = thumbnailSize + 32;

    // Build slides array, only update when redux photos state changes
    const slides = useMemo(() => photos.map(photo => ({
        src: photo.photo,
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

                // Reverse progress animation direction when direction toggled
                slideshowDirectionChanged: newDirection => {
                    setSlideshowForward(newDirection);
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
                iconSlideshowToggle: () => <ArrowRightIcon className={clsx(
                    "size-8 transition-transform duration-300",
                    slideshowForward ? "rotate-0" : "rotate-180"
                )} />,
                iconClose: () => <XMarkIcon className="size-8" />,
                iconExitFullscreen: () => <ArrowsPointingInIcon className="size-8" />,
                iconEnterFullscreen: () => <ArrowsPointingOutIcon className="size-8" />,
                // Match loading animation used in rest of app
                iconLoading: () => <LoadingAnimation />,
                // Render custom top-left corner dropdown button
                // Render slideshow progress bar if slideshow is running
                controls: () =>
                    <>
                        <GalleryDropdown currentSlide={slides[index]} />
                        {slideshowRunning && (
                            // Key changes on each slide or when direction
                            // changes (remount, start animation over)
                            <SlideshowProgressBar
                                key={String(`${index}${slideshowForward}`)}
                                delay={delay}
                                slideshowForward={slideshowForward}
                            />
                        )}
                    </>

            }}
            labels={{
                Next: "Next photo",
                Previous: "Previous photo",
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
                SlideshowToggle,
                Thumbnails,
                Fullscreen
            ]}
            toolbar={{
                buttons: [
                    "SlideshowToggle",
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
            slideshowToggle={{
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
