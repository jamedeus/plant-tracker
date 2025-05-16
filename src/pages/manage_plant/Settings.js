import { memo } from 'react';
import PropTypes from 'prop-types';
import CloseButtonIcon from 'src/components/CloseButtonIcon';
import { useSelector, useDispatch } from 'react-redux';
import { settingChanged } from './settingsSlice';
import DropdownMenu from 'src/components/DropdownMenu';

const settings = [
    {
        settingName: "collapsedNoteLines",
        settingText: "Closed note visible lines",
        settingDescription: "Number of line shown in the timeline when a note is closed",
        settingOptions: [
            { name: 1, value: 1 },
            { name: 2, value: 2 },
            { name: 3, value: 3 },
            { name: 4, value: 4 },
            { name: "All", value: "All" }
        ]
    }
];

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
                        aria-label="Set visible lines per note"
                        className="btn btn-ghost text-xl font-bold"
                    >
                        {currentValue}
                    </button>
                    {/* Setting options */}
                    <DropdownMenu className="min-w-24 mt-2">
                        {settingOptions.map((option) =>  (
                            <li key={option.value}>
                                <button
                                    className="flex justify-center"
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
                {/* Off-click overlay */}
                <label
                    htmlFor="settings-menu"
                    aria-label="close sidebar"
                    className="drawer-overlay"
                />
                <div className="flex flex-col bg-base-200 text-base-content min-h-full w-80 md:w-128 p-4">
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
                    <div className="mt-8 flex flex-col">
                        {settings.map((setting) => (
                            <SettingSection
                                key={setting.settingName}
                                { ...setting }
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
