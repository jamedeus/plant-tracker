import React, { useState, memo, useMemo, useEffect, useCallback } from 'react';
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
import sendPostRequest from 'src/utils/sendPostRequest';
import { useSelector, useDispatch } from 'react-redux';
import { timestampToReadable } from 'src/utils/timestampUtils';
import { defaultPhotoChanged, photosDeleted } from './timelineSlice';
import { photoGalleryOpened, photoGalleryIndexChanged } from './interfaceSlice';
import { useIsBreakpointActive } from 'src/hooks/useBreakpoint';
import { showToast } from 'src/components/Toast';
import DropdownMenu from 'src/components/DropdownMenu';
import DropdownButton from 'src/components/DropdownButton';
import LoadingAnimation from 'src/components/LoadingAnimation';
import {
    XMarkIcon,
    StarIcon,
    PlayIcon,
    PauseIcon,
    TrashIcon,
    ArrowRightIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ArrowDownTrayIcon,
    ArrowsPointingInIcon,
    ArrowsPointingOutIcon,
    MagnifyingGlassPlusIcon,
    MagnifyingGlassMinusIcon
} from '@heroicons/react/24/solid';
import { FaEye, FaEyeSlash } from "react-icons/fa";
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
const GalleryDropdown = memo(function GalleryDropdown({ currentSlide, focusMode, toggleFocusMode }) {
    const plantDetails = useSelector((state) => state.plant.plantDetails);
    const dispatch = useDispatch();

    // Controls delete confirmation overlay visibility
    const [showConfirmDelete, setShowConfirmDelete] = useState(false);

    // Sets the current slide as the default photo
    const handleSetDefaultPhoto = async () => {
        document.activeElement.blur();
        const payload = {
            plant_id: plantDetails.uuid,
            photo_key: currentSlide.key
        };
        const onSuccess = (data) => {
            dispatch(defaultPhotoChanged(data.default_photo));
            showToast('Default photo set!', 'green', 2500);
        };
        const onError = () => showToast('Failed to set default photo', 'red', 2500);
        await sendPostRequest('/set_plant_default_photo', payload, onSuccess, onError);
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

    // Shows delete confirmation overlay when dropdown option clicked
    const handleDeletePhotoOption = () => {
        document.activeElement.blur();
        setShowConfirmDelete(true);
    };

    // Deletes photo when user clicks delete in confirmation overlay
    const handleDeletePhoto = async () => {
        setShowConfirmDelete(false);
        const payload = {
            plant_id: plantDetails.uuid,
            delete_photos: [currentSlide.key]
        };
        const onSuccess = (data) => dispatch(photosDeleted(data.deleted));
        const onError = () => showToast('Failed to delete photo', 'red', 2500);
        await sendPostRequest('/delete_plant_photos', payload, onSuccess, onError);
    };

    return (
        <>
            <div className="gallery-dropdown dropdown dropdown-start">
                <DropdownButton
                    className="yarl__button"
                    title="Gallery options"
                >
                    <FaEllipsis className="size-8" />
                </DropdownButton>
                <DropdownMenu>
                    <li><button onClick={toggleFocusMode}>
                        {focusMode ? (
                            <>
                                <FaEyeSlash className="size-4 mr-2" />
                                Focus mode off
                            </>
                        ) : (
                            <>
                                <FaEye className="size-4 mr-2" />
                                Focus mode on
                            </>
                        )}
                    </button></li>
                    <li><button onClick={handleDownloadPhoto}>
                        <ArrowDownTrayIcon className="size-4 mr-2" />
                        Download photo
                    </button></li>
                    <li><button onClick={handleSetDefaultPhoto}>
                        <StarIcon className="size-4 mr-2" />
                        Set default photo
                    </button></li>
                    <li><button onClick={handleDeletePhotoOption}>
                        <TrashIcon className="size-4 mr-2" />
                        Delete photo
                    </button></li>
                </DropdownMenu>
            </div>

            {/* Delete confirmation overlay */}
            {showConfirmDelete && (
                <div className="fixed inset-0 flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-base-100 rounded-box p-6 pt-4 mx-4 text-center">
                        <h3 className="font-bold text-lg mb-4">Delete Photo</h3>
                        <p className="text-base-content/70 mb-6">
                            Are you sure? This cannot be undone.
                        </p>
                        <div className="flex gap-4 justify-center">
                            <button
                                className="btn btn-neutral w-20"
                                onClick={() => setShowConfirmDelete(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-error w-20"
                                onClick={handleDeletePhoto}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
});

GalleryDropdown.propTypes = {
    currentSlide: PropTypes.object,
    focusMode: PropTypes.bool.isRequired,
    toggleFocusMode: PropTypes.func.isRequired
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

    // Controls focus mode (hide thumbnails/captions, dim buttons if true)
    const [focusMode, setFocusMode] = useState(false);
    const toggleFocusMode = useCallback(() => {
        setFocusMode(prev => !prev);
    }, []);

    // Toggle focus mode when user single clicks photo or caption
    useEffect(() => {
        if (!open) return;

        // Track number of clicks within time window (ignore double clicks)
        let clickCount = 0;
        let clickTimer = null;

        const handleMouseUp = (e) => {
            // Only process clicks on photo or caption (not thumbnail)
            if (['yarl__slide_image', 'yarl__slide_description'].includes(
                String(e.target.classList)
            )) {
                // Increment click count
                clickCount++;

                // First click: start timer to enter focus mode if no second
                // click in next 300ms (don't activate on double click zoom)
                if (clickCount === 1) {
                    clickTimer = setTimeout(() => {
                        toggleFocusMode();
                        clickCount = 0;
                    }, 300);

                // Second click: clear timer, don't enter focus mode
                } else {
                    clearTimeout(clickTimer);
                    clickCount = 0;
                }
            }
        };

        // Cancel if mouse moved during click (ignore click and drag)
        // Only fire if button pressed during move (ignore regular move), reset
        // clickCount to -1 (pointerup will fire on release and set to 0)
        const handleMouseMove = (e) => {
            if (e.buttons) {
                clearTimeout(clickTimer);
                clickCount = -1;
            }
        };

        // Add listeners when gallery opened, remove when closed
        document.addEventListener('pointerup', handleMouseUp, true);
        document.addEventListener('pointermove', handleMouseMove, true);
        return () => {
            document.removeEventListener('pointerup', handleMouseUp, true);
            document.removeEventListener('pointermove', handleMouseMove, true);
            if (clickTimer) clearTimeout(clickTimer);
        };
    }, [open, toggleFocusMode]);

    return (
        <Lightbox
            open={open}
            on={{
                // Reset slideHasChanged and focusMode when opened
                entered: () => {
                    setSlideHasChanged(false);
                    setFocusMode(false);
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
                        <GalleryDropdown
                            currentSlide={slides[index]}
                            focusMode={focusMode}
                            toggleFocusMode={toggleFocusMode}
                        />
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
            // slideshowRunning shrinks thumbnails, shows progress bar
            // focusMode hides thumbnails/captions, dims button icons
            className={clsx(
                slideshowRunning ? 'slideshow-running' : null,
                focusMode ? 'focus-mode' : null
            )}
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
