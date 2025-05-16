import { memo } from 'react';
import PropTypes from 'prop-types';
import CloseButtonIcon from 'src/components/CloseButtonIcon';
import { useSelector, useDispatch } from 'react-redux';
import { settingChanged, settingsReset } from './settingsSlice';
import DropdownMenu from 'src/components/DropdownMenu';
import { useIsBreakpointActive } from 'src/useBreakpoint';
import 'src/css/settings.css';

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

    return (

        <div className="flex items-center mt-4">
            {/* Setting short description, hover for full description */}
            <span
                className="text-base font-semibold w-150"
                title={settingDescription}
            >
                {settingText}
            </span>
            <div className="flex w-full justify-end">
                <div className="dropdown dropdown-center mr-4">
                    {/* Button shows current value, opens dropdown */}
                    <button
                        tabIndex={0}
                        role="button"
                        aria-label={`Set ${settingText}`}
                        className="btn btn-ghost text-xl font-bold"
                    >
                        {settingOptions.find(opt => opt.value === currentValue).name}
                    </button>
                    {/* Setting options */}
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
        </div>
    );
});

SettingSection.propTypes = {
    settingName: PropTypes.string.isRequired,
    settingText: PropTypes.string.isRequired,
    settingDescription: PropTypes.string.isRequired,
    settingOptions: PropTypes.array.isRequired
};

const ResetAllSettingsButton = () => {
    // Get layout string used to look up default settings for current breakpoint
    const layout = useIsBreakpointActive("md") ? 'desktop' : 'mobile';
    const dispatch = useDispatch();

    return (
        <button
            className="btn btn-error btn-soft w-full"
            onClick={() => dispatch(settingsReset({layout: layout}))}
        >
            Restore Defaults
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
            <div className="drawer-side">
                <div className="flex flex-col text-base-content h-full w-full">
                    {/* Title + close button */}
                    <div className="flex items-center">
                        <span className="text-2xl font-bold mr-auto">
                            Settings
                        </span>
                        <label
                            htmlFor="settings-menu"
                            className="btn btn-ghost btn-circle size-12"
                        >
                            <CloseButtonIcon />
                        </label>
                    </div>
                    {/* Contents */}
                    <div className="mt-8 flex flex-col h-full">
                        {Object.entries(settings).map(([name, settings]) => (
                            <SettingSection
                                key={name}
                                settingName={name}
                                { ...settings }
                            />
                        ))}
                        <div className="mt-auto mx-auto w-72">
                            <ResetAllSettingsButton />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
