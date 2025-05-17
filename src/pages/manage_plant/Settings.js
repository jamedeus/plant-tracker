import { memo, useState } from 'react';
import PropTypes from 'prop-types';
import CloseButtonIcon from 'src/components/CloseButtonIcon';
import { useSelector, useDispatch } from 'react-redux';
import { settingChanged, settingsReset } from './settingsSlice';
import DropdownMenu from 'src/components/DropdownMenu';
import { useIsBreakpointActive } from 'src/useBreakpoint';
import 'src/css/settings.css';
import clsx from 'clsx';

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
        settingText: "Show full date in timeline",
        settingDescription: "Whether the full date is always visible or hidden in tooltip",
        settingOptions: [
            { name: 'Show', value: true },
            { name: 'Tooltip', value: false }
        ],
        default: {
            desktop: true,
            mobile: false
        }
    }
};

// Takes setting name and layout (mobile or desktop), returns default value
export const getDefaultSettingValue = (setting, layout) => {
    return settings[setting].default[layout];
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
            className="btn btn-error btn-soft w-full"
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

const Settings = () => {
    return (
        <div className="drawer z-99">
            {/* Hidden checkbox controls open state */}
            {/* Must add label somewhere with htmlFor targeting this */}
            <input
                id="settings-menu"
                type="checkbox"
                className="drawer-toggle"
            />
            <div className="drawer-side flex flex-col gap-8 max-h-screen">
                {/* Title + close button */}
                <div className="flex items-center w-full">
                    <h2 className="text-2xl font-bold ml-2 md:ml-4 mr-auto">
                        Settings
                    </h2>
                    <label
                        htmlFor="settings-menu"
                        className="btn btn-ghost btn-circle size-12"
                    >
                        <CloseButtonIcon />
                    </label>
                </div>
                {/* Contents */}
                <div className="settings-grid w-full gap-4 pl-4 md:px-8">
                    {Object.entries(settings).map(([name, settings]) => (
                        <SettingSection
                            key={name}
                            settingName={name}
                            { ...settings }
                        />
                    ))}
                </div>
                <div className="mt-auto mb-4 mx-auto w-full max-w-72">
                    <ResetAllSettingsButton />
                </div>
            </div>
        </div>
    );
};

export default Settings;
