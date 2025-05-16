import createMockContext from 'src/testUtils/createMockContext';
import bulkCreateMockContext from 'src/testUtils/bulkCreateMockContext';
import App from '../App';
import { PageWrapper } from 'src/index';
import { mockContext } from './mockContext';

describe('Settings menu', () => {
    let app, user;

    // Takes setting name, reads from localStorage and returns value
    const getSavedSettingValue = (setting) => {
        const savedSettings = JSON.parse(
            localStorage.getItem("manage_plant_settings") || '{}'
        );
        return savedSettings[setting];
    };

    beforeAll(() => {
        // Create mock state objects
        bulkCreateMockContext(mockContext);
        createMockContext('user_accounts_enabled', true);
    });

    beforeEach(() => {
        // Clear localStorage (saved settings from last test)
        localStorage.clear();

        // Render app + create userEvent instance to use in tests
        user = userEvent.setup();
        app = render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );
    });

    it('changes number of collapsed note visible lines when collapsedNoteLines changed', async () => {
        // Confirm collapsed note shows 1 line
        expect(
            app.getByTitle('04:44 AM - February 26, 2024').classList
        ).toContain('line-clamp-1');
        // Confirm setting is not set in localStorage
        expect(getSavedSettingValue('collapsedNoteLines')).toBe(undefined);

        // Click collapsedNoteLines settings dropdown, select option "All"
        await user.click(app.getByLabelText('Set Closed note visible lines'));
        await user.click(app.getByLabelText('Set Closed note visible lines to All'));

        // Confirm collapsed note shows all lines
        await waitFor(() => {
            expect(
                app.getByTitle('04:44 AM - February 26, 2024').classList
            ).toContain('line-clamp-none');
        });
        // Confirm new setting was written to localStorage
        expect(getSavedSettingValue('collapsedNoteLines')).toBe('All');

        // Change collapsedNoteLines to "2"
        await user.click(app.getByLabelText('Set Closed note visible lines'));
        await user.click(app.getByLabelText('Set Closed note visible lines to 2'));

        // Confirm collapsed note shows 2 lines
        await waitFor(() => {
            expect(
                app.getByTitle('04:44 AM - February 26, 2024').classList
            ).toContain('line-clamp-2');
        });
        // Confirm new setting was written to localStorage
        expect(getSavedSettingValue('collapsedNoteLines')).toBe(2);
    });

    it('does not collapse expanded notes when collapsedNoteLines changed', async () => {
        // Click note (expand), confirm shows all lines
        await user.click(app.getByText('One of the older leaves is starting to turn yellow'));
        expect(
            app.getByTitle('04:44 AM - February 26, 2024').classList
        ).toContain('line-clamp-none');

        // Change closed note visible lines to "2"
        await user.click(app.getByLabelText('Set Closed note visible lines'));
        await user.click(app.getByLabelText('Set Closed note visible lines to 2'));
        // Confirm new setting was written to localStorage
        expect(getSavedSettingValue('collapsedNoteLines')).toBe(2);

        // Confirm all lines of expanded note still visible
        expect(
            app.getByTitle('04:44 AM - February 26, 2024').classList
        ).toContain('line-clamp-none');
    });

    it('changes TimelineTimestamp full date visibility when timelineFullDate changed', async () => {
        // Confirm setting is not set in localStorage
        expect(getSavedSettingValue('timelineFullDate')).toBe(undefined);

        // Get first full date span, confirm visible
        const fullDate = app.container.querySelectorAll('.timeline-timestamp > span')[0];
        expect(fullDate.classList).not.toContain('hidden');

        // Change collapsedNoteLines to "Tooltip"
        await user.click(app.getByLabelText('Set Show full date in timeline'));
        await user.click(app.getByLabelText('Set Show full date in timeline to Tooltip'));

        // Confirm full date span was hidden (makes tooltip visible with CSS)
        expect(fullDate.classList).toContain('hidden');
        // Confirm setting changed
        expect(getSavedSettingValue('timelineFullDate')).toBe(false);

        // Change collapsedNoteLines to "Show"
        await user.click(app.getByLabelText('Set Show full date in timeline'));
        await user.click(app.getByLabelText('Set Show full date in timeline to Show'));

        // Confirm full date span is visible (hides tooltip with CSS)
        expect(fullDate.classList).not.toContain('hidden');
        // Confirm setting changed
        expect(getSavedSettingValue('timelineFullDate')).toBe(true);
    });
});

describe('Settings default values', () => {
    let app, user;

    // Takes setting name and value, overwrites setting in localStorage
    const setSavedSettingValue = (setting, value) => {
        const savedSettings = JSON.parse(
            localStorage.getItem("manage_plant_settings") || '{}'
        );
        localStorage.setItem("manage_plant_settings", JSON.stringify({
            ...savedSettings,
            [setting]: value
        }));
    };

    // Renders app (call in tests after mocking window size, localStorage, etc)
    const renderApp = () => {
        user = userEvent.setup();
        app = render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );
    };

    beforeAll(() => {
        // Create mock state objects
        bulkCreateMockContext(mockContext);
        createMockContext('user_accounts_enabled', true);
    });

    beforeEach(() => {
        // Clear localStorage (saved settings from last test)
        localStorage.clear();
    });

    it('defaults collapsedNoteLines to 1 on desktop', async () => {
        // Set width greater than tailwind md breakpoint, render app
        window.innerWidth = 800;
        renderApp();

        // Confirm collapsed note shows 1 line
        expect(
            app.getByTitle('04:44 AM - February 26, 2024').classList
        ).toContain('line-clamp-1');
    });

    it('defaults collapsedNoteLines to 3 on mobile', async () => {
        // Set width less than tailwind md breakpoint, render app
        window.innerWidth = 400;
        renderApp();

        // Confirm collapsed note shows 3 lines
        expect(
            app.getByTitle('04:44 AM - February 26, 2024').classList
        ).toContain('line-clamp-3');
    });

    it('ignores default value if collapsedNoteLines exists in localStorage', async () => {
        // Set width greater than tailwind md breakpoint
        window.innerWidth = 800;
        // Set collapsedNoteLines to "All" in localStorage
        setSavedSettingValue('collapsedNoteLines', 'All');
        // Render app
        renderApp();
        // Confirm collapsed note shows all lines (not default)
        expect(
            app.getByTitle('04:44 AM - February 26, 2024').classList
        ).toContain('line-clamp-none');
    });

    it('defaults timelineFullDate to true on desktop', async () => {
        // Set width greater than tailwind md breakpoint, render app
        window.innerWidth = 800;
        renderApp();

        // Get first full date span, confirm visible
        const fullDate = app.container.querySelectorAll('.timeline-timestamp > span')[0];
        expect(fullDate.classList).not.toContain('hidden');
    });

    it('defaults timelineFullDate to false on mobile', async () => {
        // Set width greater than tailwind md breakpoint, render app
        window.innerWidth = 400;
        renderApp();

        // Get first full date span, confirm hidden
        const fullDate = app.container.querySelectorAll('.timeline-timestamp > span')[0];
        expect(fullDate.classList).toContain('hidden');
    });

    it('ignores default value if timelineFullDate exists in localStorage', async () => {
        // Set width greater than tailwind md breakpoint
        window.innerWidth = 800;
        // Set timelineFullDate to false in localStorage
        setSavedSettingValue('timelineFullDate', false);
        // Render app
        renderApp();
        // Get first full date span, confirm hidden (not default)
        const fullDate = app.container.querySelectorAll('.timeline-timestamp > span')[0];
        expect(fullDate.classList).toContain('hidden');
    });

    it('restores default values when Restore Defaults button clicked', async () => {
        // Set width greater than tailwind md breakpoint
        window.innerWidth = 800;
        // Set non-default settings, render app
        setSavedSettingValue('timelineFullDate', false);
        setSavedSettingValue('collapsedNoteLines', 'All');
        renderApp();

        // Confirm timelineFullDate setting applied
        const fullDate = app.container.querySelectorAll('.timeline-timestamp > span')[0];
        expect(fullDate.classList).toContain('hidden');
        // Confirm collapsedNoteLines setting applied
        const collapsedNote = app.getByTitle('04:44 AM - February 26, 2024');
        expect(collapsedNote.classList).toContain('line-clamp-none');

        // Click Restore Defaults button
        await user.click(app.getByRole('button', {name: 'Restore Defaults'}));

        // Confirm reverted to default values for md breakpoint
        expect(fullDate.classList).not.toContain('hidden');
        expect(collapsedNote.classList).toContain('line-clamp-1');

        // Confirm localStorage was cleared
        expect(localStorage.getItem("manage_plant_settings")).toBeNull();
    });
});
