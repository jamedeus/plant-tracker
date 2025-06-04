/* ==========================================================================
 * Portions of this file were adapted from yet-another-react-lightbox
 * Original Copyright (c) 2022 Igor Danchenko
 * Licensed under the MIT License – see ../../../LICENSES/yet-another-react-lightbox-license.txt.
 * Source: https://unpkg.com/yet-another-react-lightbox@3.23.2/dist/plugins/slideshow/index.js
 * ==========================================================================
 *
 * Custom yet-another-react-lightbox slideshow plugin with an extra toolbar
 * button to toggle the slideshow direction.
 */

import * as React from "react";
// Must use absolute path (not exported by module)
import {
    makeUseContext,
    useLightboxState,
    useTimeouts,
    useEvents,
    useController,
    useEventCallback,
    cleanup,
    createIcon,
    useLightboxProps,
    useLoseFocus,
    IconButton,
    addToolbarButton,
    createModule,
} from "src/../node_modules/yet-another-react-lightbox/dist/index.js";
import {
    SLIDE_STATUS_LOADING,
    SLIDE_STATUS_PLAYING,
    SLIDE_STATUS_ERROR,
    SLIDE_STATUS_COMPLETE,
    ACTIVE_SLIDE_LOADING,
    ACTIVE_SLIDE_PLAYING,
    ACTIVE_SLIDE_ERROR,
    ACTIVE_SLIDE_COMPLETE,
} from "src/../node_modules/yet-another-react-lightbox/dist/types.js";

const PLUGIN_SLIDESHOW_TOGGLE = "SlideshowToggle";

const defaultSlideshowProps = {
    autoplay: false,
    delay: 3000,
    ref: null,
};
const resolveSlideshowProps = (slideshow) => ({
    ...defaultSlideshowProps,
    ...slideshow,
});

const SlideshowToggleContext = React.createContext(null);
const useSlideshowToggle = makeUseContext(
    "useSlideshowToggle",
    "SlideshowToggleContext",
    SlideshowToggleContext,
);

function SlideshowToggleContextProvider({ slideshowToggle, carousel: { finite }, on, children }) {
    const { autoplay, delay, ref } = resolveSlideshowProps(slideshowToggle);
    const wasPlaying = React.useRef(autoplay);
    const [playing, setPlaying] = React.useState(autoplay);
    // Add state to control slideshow direction (reverse direction if false)
    const [slideshowForward, setSlideshowForward] = React.useState(true);
    const scheduler = React.useRef(undefined);
    const slideStatus = React.useRef(undefined);
    const { slides, currentIndex } = useLightboxState();
    const { setTimeout, clearTimeout } = useTimeouts();
    const { subscribe } = useEvents();
    const { next, prev } = useController();

    const disabled = slides.length === 0 || (
        finite && (slideshowForward ? currentIndex === slides.length - 1 : currentIndex === 0)
    );
    const play = React.useCallback(() => {
        if (!playing && !disabled) {
            setPlaying(true);
        }
    }, [playing, disabled]);
    const pause = React.useCallback(() => {
        if (playing) {
            setPlaying(false);
        }
    }, [playing]);

    // Add callback to toggle slideshow direction
    // Toggles slideshowForward state + calls slideshowDirectionChanged lifecycle method
    const toggleDirection = React.useCallback(() => {
        setSlideshowForward(currentDirection => {
            const newDirection = !currentDirection;
            on.slideshowDirectionChanged?.(newDirection);
            return newDirection;
        });
    }, [on]);

    const cancelScheduler = React.useCallback(() => {
        clearTimeout(scheduler.current);
        scheduler.current = undefined;
    }, [clearTimeout]);

    const scheduleNextSlide = useEventCallback(() => {
        cancelScheduler();
        if (!playing ||
            disabled ||
            slideStatus.current === SLIDE_STATUS_LOADING ||
            slideStatus.current === SLIDE_STATUS_PLAYING
        ) {
            return;
        }
        scheduler.current = setTimeout(() => {
            if (playing) {
                slideStatus.current = undefined;
                // Call next or prev depending on direction state
                slideshowForward ? next() : prev();
            }
        }, delay);
    });

    // Add direction state to dependencies array
    React.useEffect(scheduleNextSlide, [currentIndex, playing, slideshowForward, scheduleNextSlide]);
    React.useEffect(() => {
        if (playing && disabled) {
            setPlaying(false);
        }
    }, [currentIndex, playing, disabled]);
    const onSlideshowStart = useEventCallback(() => { var _a; return (_a = on.slideshowStart) === null || _a === void 0 ? void 0 : _a.call(on); });
    const onSlideshowStop = useEventCallback(() => { var _a; return (_a = on.slideshowStop) === null || _a === void 0 ? void 0 : _a.call(on); });
    React.useEffect(() => {
        if (playing) {
            onSlideshowStart();
        }
        else if (wasPlaying.current) {
            onSlideshowStop();
        }
        wasPlaying.current = playing;
    }, [playing, onSlideshowStart, onSlideshowStop]);
    React.useEffect(() => cleanup(cancelScheduler, subscribe(ACTIVE_SLIDE_LOADING, () => {
        slideStatus.current = SLIDE_STATUS_LOADING;
        cancelScheduler();
    }), subscribe(ACTIVE_SLIDE_PLAYING, () => {
        slideStatus.current = SLIDE_STATUS_PLAYING;
        cancelScheduler();
    }), subscribe(ACTIVE_SLIDE_ERROR, () => {
        slideStatus.current = SLIDE_STATUS_ERROR;
        scheduleNextSlide();
    }), subscribe(ACTIVE_SLIDE_COMPLETE, () => {
        slideStatus.current = SLIDE_STATUS_COMPLETE;
        scheduleNextSlide();
    })), [subscribe, cancelScheduler, scheduleNextSlide]);
    // Add slideshowForward state and toggleDirection callback to exports
    const context = React.useMemo(() => ({
        playing,
        disabled,
        slideshowForward,
        play,
        pause,
        toggleDirection
    }), [playing, disabled, slideshowForward, play, pause, toggleDirection]);
    React.useImperativeHandle(ref, () => context, [context]);
    return React.createElement(SlideshowToggleContext.Provider, { value: context }, children);
}

const PlayIcon = createIcon("Play", React.createElement("path", { d: "M8 5v14l11-7z" }));
const PauseIcon = createIcon("Pause", React.createElement("path", { d: "M6 19h4V5H6v14zm8-14v14h4V5h-4z" }));
// Dummy icon (must override)
const ToggleIcon = createIcon("Toggle direction", React.createElement("path", { d: "" }));

function SlideshowButton() {
    const { playing, disabled, play, pause } = useSlideshowToggle();
    const { render } = useLightboxProps();
    const focusListeners = useLoseFocus(useController().focus, disabled);
    if (render.buttonSlideshow) {
        return React.createElement(React.Fragment, null, render.buttonSlideshow({ playing, disabled, play, pause }));
    }
    return (React.createElement(IconButton, { label: playing ? "Pause" : "Play", icon: playing ? PauseIcon : PlayIcon, renderIcon: playing ? render.iconSlideshowPause : render.iconSlideshowPlay, onClick: playing ? pause : play, disabled: disabled, ...focusListeners }));
}

// Add second toolbar button to toggle slideshow direction
function ToggleDirectionButton() {
    const { disabled, toggleDirection } = useSlideshowToggle();
    const { render } = useLightboxProps();
    if (render.buttonSlideshowToggle) {
        return React.createElement(React.Fragment, null, render.buttonSlideshowToggle({ disabled, toggleDirection }));
    }
    return (React.createElement(IconButton, { label: "Toggle direction", icon: ToggleIcon, renderIcon: render.iconSlideshowToggle, onClick: toggleDirection, disabled: disabled }));
}

// Keep buttons grouped together
function SlideshowButtonsGroup() {
    return (
        <>
            <ToggleDirectionButton />
            <SlideshowButton />
        </>
    );
}

function SlideshowToggle({ augment, addModule }) {
    augment(({ slideshowToggle, toolbar, ...restProps }) => ({
        toolbar: addToolbarButton(toolbar, PLUGIN_SLIDESHOW_TOGGLE, React.createElement(SlideshowButtonsGroup, null)),
        slideshowToggle: resolveSlideshowProps(slideshowToggle),
        ...restProps,
    }));
    addModule(createModule(PLUGIN_SLIDESHOW_TOGGLE, SlideshowToggleContextProvider));
}

export default SlideshowToggle;
