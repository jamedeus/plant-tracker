import { memo, useState, useRef, useImperativeHandle, forwardRef, Fragment } from 'react';
import PropTypes from 'prop-types';
import CloseButtonIcon from 'src/components/CloseButtonIcon';
import { useSelector, useDispatch } from 'react-redux';
import { settingChanged, settingsReset } from './settingsSlice';
import DropdownMenu from 'src/components/DropdownMenu';
import { useIsBreakpointActive } from 'src/useBreakpoint';
import 'src/css/settings.css';
import clsx from 'clsx';

// Maps section names to array of setting names (must be settings object keys)
const sections = {
    Timeline: [
        "timelineFullDate",
        "collapsedNoteLines",
    ],
    "Photo Gallery": [
        "galleryShowPhotoDate",
        "gallerySlideshowDelay",
    ],
    Other: [
        "holdToConfirmDelay"
    ]
};

// Keys must match a settingsSlice state key
const settings = {
    collapsedNoteLines: {
        settingText: "Closed note visible lines",
        settingDescription: "Number of line shown in the timeline when a note is closed",
        settingOptions: [
            { name: 1, value: 1 },
            { name: 2, value: 2 },
            { name: 3, value: 3 },
            { name: 4, value: 4 },
            { name: "All", value: "All" }
        ],
        default: {
            desktop: 1,
            mobile: 3
        }
    },
    timelineFullDate: {
        settingText: "Show full dates",
        settingDescription: "Whether the full date is always visible or hidden in tooltip",
        settingOptions: [
            { name: 'Show', value: true },
            { name: 'Tooltip', value: false }
        ],
        default: {
            desktop: true,
            mobile: false
        }
    },
    gallerySlideshowDelay: {
        settingText: "Slideshow delay (seconds)",
        settingDescription: "How many seconds each photo is shown in the photo gallery slideshow",
        settingOptions: [
            { name: 1, value: 1000 },
            { name: 2, value: 2000 },
            { name: 3, value: 3000 },
            { name: 4, value: 4000 },
            { name: 5, value: 5000 },
        ],
        default: {
            desktop: 3000,
            mobile: 3000
        }
    },
    galleryShowPhotoDate: {
        settingText: "Show photo dates",
        settingDescription: "Whether the gallery renders a semi-transparent label with the date each photo was taken on",
        settingOptions: [
            { name: 'Yes', value: true },
            { name: 'No', value: false },
        ],
        default: {
            desktop: true,
            mobile: false
        }
    },
    holdToConfirmDelay: {
        settingText: "Hold to delete note (seconds)",
        settingDescription: "How many seconds the delete button must be held to delete a note (prevents accidents)",
        settingOptions: [
            { name: 0, value: 0 },
            { name: 0.5, value: 500 },
            { name: 1.5, value: 1500 },
            { name: 2.5, value: 2500 },
        ],
        default: {
            desktop: 1500,
            mobile: 1500
        }
    }
};

// Takes setting name and layout (mobile or desktop), returns default value
export const getDefaultSettingValue = (setting, layout) => {
    return settings[setting].default[layout];
};

// Takes layout (mobile or desktop)
// Returns full settings object with values loaded from saved user settings (or
// default values for settings user has not set)
export const loadUserSettings = (layout) => {
    const savedSettings = JSON.parse(localStorage.getItem(
        "manage_plant_settings",
    ) || '{}');
    return Object.fromEntries(
        Object.keys(settings).map(settingName => ([
            settingName,
            savedSettings[settingName] ?? getDefaultSettingValue(settingName, layout)
        ]))
    );
};

const SettingSection = memo(function SettingSection({
    settingName,
    settingText,
    settingDescription,
    settingOptions
}) {
    const dispatch = useDispatch();
    const currentValue = useSelector((state) => state.settings[settingName]);
    const currentValueName = settingOptions.find(opt => (
        opt.value === currentValue
    )).name;

    return (

        <>
            {/* Setting short description, hover for full description */}
            <div
                className="flex items-center font-semibold"
                title={settingDescription}
            >
                {settingText}
            </div>
            {/* Button shows current value, opens dropdown with options */}
            <div className="flex items-center">
                <div className="dropdown dropdown-center mx-auto">
                    <button
                        tabIndex={0}
                        role="button"
                        aria-label={`Set ${settingText}`}
                        className="btn btn-ghost text-xl font-bold"
                    >
                        {currentValueName}
                    </button>
                    <DropdownMenu className="min-w-24 mt-2">
                        {settingOptions.map((option) =>  (
                            <li key={option.value}>
                                <button
                                    className="flex justify-center"
                                    aria-label={
                                        `Set ${settingText} to ${option.name}`
                                    }
                                    onClick={() => {
                                        // Change setting
                                        dispatch(settingChanged({
                                            setting: settingName,
                                            value: option.value
                                        }));
                                        // Remove focus (close dropdown)
                                        document.activeElement.blur();
                                    }}
                                >
                                    {option.name}
                                </button>
                            </li>
                        ))}
                    </DropdownMenu>
                </div>
            </div>
        </>
    );
});

SettingSection.propTypes = {
    settingName: PropTypes.string.isRequired,
    settingText: PropTypes.string.isRequired,
    settingDescription: PropTypes.string.isRequired,
    settingOptions: PropTypes.array.isRequired
};

const ResetAllSettingsButton = () => {
    const layout = useIsBreakpointActive("md") ? 'desktop' : 'mobile';
    const dispatch = useDispatch();

    const [clicked, setClicked] = useState(false);

    // Fade out default text when clicked, show "Done!" for 1 second, revert
    const handleClick = () => {
        setClicked(true);
        dispatch(settingsReset({layout: layout}));
        setTimeout(() => setClicked(false), 1000);
    };

    return (
        <button
            className="btn btn-error btn-soft w-full relative"
            onClick={handleClick}
            data-testid="restore_default_settings_button"
        >
            {/* Default text, fades out when button clicked */}
            <span className={clsx(
                'transition-opacity duration-300 ease-in-out',
                clicked ? 'opacity-0' : 'opacity-100 delay-100'
            )}>
                Restore Defaults
            </span>

            {/* Positioned over default text, fades in when button clicked */}
            <span className={clsx(
                'absolute inset-0 flex items-center justify-center',
                'transition-opacity duration-300 ease-in-out',
                clicked ? 'opacity-100 delay-100' : 'opacity-0'
            )}>
                Done!
            </span>
        </button>
    );
};

const Settings = forwardRef(function Settings(_, ref) {
    const dialogRef = useRef(null);

    useImperativeHandle(ref, () => ({
        open: () => dialogRef.current.showModal()
    }));

    return (
        <dialog className="settings-menu group" ref={dialogRef}>
            {/* Full screen overlay when menu open (click outside to close) */}
            {/* Tabindex sets initial focus (will open dropdown otherwise) */}
            <div
                tabIndex={0}
                onClick={() => dialogRef.current.close()}
                className="fixed inset-0 cursor-pointer not-group-open:hidden"
                data-testid="settings-menu-overlay"
            />
            <div className="settings-contents">
                {/* Title + close button */}
                <div className="flex items-center w-full">
                    <h2 className="text-3xl font-bold ml-2 md:ml-4 mr-auto">
                        Settings
                    </h2>
                    <button
                        className="btn btn-ghost btn-circle size-12"
                        onClick={() => dialogRef.current.close()}
                        data-testid="settings-menu-close-button"
                    >
                        <CloseButtonIcon />
                    </button>
                </div>
                {/* Contents */}
                <div className="settings-grid w-full gap-4 pl-5 md:px-8">
                    {Object.entries(sections).map(([section, settingNames]) => (
                        <Fragment key={section}>
                            <div className="settings-section-header">
                                {section}
                            </div>
                            {settingNames.map(name => (
                                <SettingSection
                                    key={name}
                                    settingName={name}
                                    { ...settings[name] }
                                />
                            ))}
                        </Fragment>
                    ))}
                </div>
                <div className="mt-auto mb-4 mx-auto w-full max-w-72">
                    <ResetAllSettingsButton />
                </div>
            </div>
        </dialog>
    );
});

export default Settings;
