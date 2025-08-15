import { fireEvent } from '@testing-library/react';
import createMockContext from 'src/testUtils/createMockContext';
import mockCurrentURL from 'src/testUtils/mockCurrentURL';
import { postHeaders } from 'src/testUtils/headers';
import { PageWrapper } from 'src/index';
import App from '../App';
import { mockContext } from './mockContext';

describe('App', () => {
    let app, user;

    beforeAll(() => {
        // Minimal DOM context needed
        createMockContext('user_accounts_enabled', true);

        // Mock window.location to simulate archived overview
        mockCurrentURL('https://plants.lan/archived', '/archived');

        // Mock width to force mobile layout (renders title nav dropdown)
        window.innerWidth = 750;
    });

    beforeEach(() => {
        // Allow fast forwarding (must hold delete button to confirm)
        jest.useFakeTimers({ doNotFake: ['Date'] });

        // Clear sessionStorage (cached sortDirection, sortKey)
        sessionStorage.clear();
        // Render app + create userEvent instance to use in tests
        user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        app = render(
            <PageWrapper>
                <App
                    initialPlants={Object.fromEntries(
                        Object.entries(mockContext.plants).map(
                            ([uuid, plant]) => [ uuid, { ...plant, archived: true } ]
                        )
                    )}
                    initialGroups={Object.fromEntries(
                        Object.entries(mockContext.groups).map(
                            ([uuid, group]) => [ uuid, { ...group, archived: true } ]
                        )
                    )}
                    initialShowArchive={mockContext.show_archive}
                />
            </PageWrapper>
        );
    });

    // Clean up pending timers after each test
    afterEach(() => {
        act(() => jest.runAllTimers());
        jest.useRealTimers();
    });

    it('shows checkboxes and delete button when edit option clicked', async () => {
        // Get reference to footer, confirm hidden (default)
        const floatingFooter = app.getByTestId('edit-mode-footer');
        expect(floatingFooter.classList).toContain('floating-footer-hidden');
        // Checkboxes are rendered underneath card with position: absolute, so
        // they are not visible until margin-left is added to the card wrapper
        expect(app.container.querySelectorAll('.ml-\\[2\\.5rem\\]').length).toBe(0);

        // Click plants column title, confirm buttons and checkboxes appear
        await user.click(app.getByText('Plants (2)'));
        expect(floatingFooter.classList).toContain('floating-footer-visible');
        expect(app.container.querySelectorAll('.ml-\\[2\\.5rem\\]').length).not.toBe(0);

        // Click cancel button, confirm buttons and checkboxes disappear
        await user.click(app.getByRole('button', {name: 'Cancel'}));
        expect(floatingFooter.classList).toContain('floating-footer-hidden');
        expect(app.container.querySelectorAll('.ml-\\[2\\.5rem\\]').length).toBe(0);
    });

    it('sends correct payload when plants are deleted', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                deleted: ["0640ec3b-1bed-4b15-a078-d6e7ec66be12"],
                failed: []
            })
        }));

        // Click plants column title, click first checkbox (plant)
        await user.click(app.getByText('Plants (2)'));
        await user.click(app.getByLabelText('Select Test Plant'));

        // Click delete button in floating div, hold for 2.5 seconds, release
        const button = app.getByRole('button', { name: 'Delete' });
        fireEvent.mouseDown(button);
        await act(async () => await jest.advanceTimersByTimeAsync(2500));
        fireEvent.mouseUp(button);

        // Confirm correct data posted to /bulk_delete_plants_and_groups endpoint
        expect(global.fetch).toHaveBeenCalledWith('/bulk_delete_plants_and_groups', {
            method: 'POST',
            body: JSON.stringify({
                uuids: ["0640ec3b-1bed-4b15-a078-d6e7ec66be12"]
            }),
            headers: postHeaders
        });
    });

    it('sends correct payload when plants are un-archived', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                archived: ["0640ec3b-1bed-4b15-a078-d6e7ec66be12"],
                failed: []
            })
        }));

        // Click plants column title, click first checkbox (plant)
        await user.click(app.getByText('Plants (2)'));
        await user.click(app.getByLabelText('Select Test Plant'));

        // Click un-archive button in floating div
        await user.click(app.getByText('Un-archive'));

        // Confirm correct data posted to /bulk_archive_plants_and_groups endpoint
        expect(global.fetch).toHaveBeenCalledWith('/bulk_archive_plants_and_groups', {
            method: 'POST',
            body: JSON.stringify({
                uuids: ["0640ec3b-1bed-4b15-a078-d6e7ec66be12"],
                archived: false
            }),
            headers: postHeaders
        });
    });

    it('sends correct payload when groups are deleted', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                deleted: ["0640ec3b-1bed-4b15-a078-d6e7ec66be14"],
                failed: []
            })
        }));

        // Click groups column title, select first group checkbox
        await user.click(app.getByText('Groups (2)'));
        await user.click(app.getByLabelText('Select Test group'));

        // Click delete button in floating div, hold for 2.5 seconds, release
        const button = app.getByRole('button', { name: 'Delete' });
        fireEvent.mouseDown(button);
        await act(async () => await jest.advanceTimersByTimeAsync(2500));
        fireEvent.mouseUp(button);

        // Confirm correct data posted to /bulk_delete_plants_and_groups endpoint
        expect(global.fetch).toHaveBeenCalledWith('/bulk_delete_plants_and_groups', {
            method: 'POST',
            body: JSON.stringify({
                uuids: ["0640ec3b-1bed-4b15-a078-d6e7ec66be14"]
            }),
            headers: postHeaders
        });
    });

    it('scrolls to plants column when title dropdown is clicked', async () => {
        // Click Plants title dropdown, confirm scrollIntoView was called
        await user.click(app.getByText("Plants"));
        expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
    });

    it('scrolls to groups column when title dropdown is clicked', async () => {
        // Click Plants title dropdown, confirm scrollIntoView was called
        await user.click(app.getByText("Groups"));
        expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
    });

    it('sends correct payload when groups are un-archived', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                archived: ["0640ec3b-1bed-4b15-a078-d6e7ec66be14"],
                failed: []
            })
        }));

        // Click groups column title, select first group checkbox
        await user.click(app.getByText('Groups (2)'));
        await user.click(app.getByLabelText('Select Test group'));

        // Click un-archive button in floating div
        await user.click(app.getByText('Un-archive'));

        // Confirm correct data posted to /bulk_archive_plants_and_groups endpoint
        expect(global.fetch).toHaveBeenCalledWith('/bulk_archive_plants_and_groups', {
            method: 'POST',
            body: JSON.stringify({
                uuids: ["0640ec3b-1bed-4b15-a078-d6e7ec66be14"],
                archived: false
            }),
            headers: postHeaders
        });
    });

    it('redirects to overview when last plant/group is un-archived', async () => {
        // Mock fetch to simulate successfully un-archiving all plants and groups
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                archived: [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                    "0640ec3b-1bed-fb15-a078-d6e7ec66be12",
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be14",
                    "0640ec3b-1bed-4ba5-a078-d6e7ec66be14"
                ],
                failed: []
            })
        }));

        // Click groups column title, click all checkboxes (2 plants 2 groups)
        await user.click(app.getByText('Groups (2)'));
        await user.click(app.getByLabelText('Select Test Plant'));
        await user.click(app.getByLabelText('Select Second Test Plant'));
        await user.click(app.getByLabelText('Select Test group'));
        await user.click(app.getByLabelText('Select Second Test group'));

        // Click un-archive button in floating div
        await user.click(app.getByText('Un-archive'));

        // Confirm redirected to overview
        expect(window.location.href).toBe('/');
    });

    // Regression test: When overview and archived overview were merged the
    // useEffect containing handleBackButton was not modified, so the archived
    // overview would request main overview state and turn into non-archived
    // overview when the back button was pressed.
    it('does NOT fetch main overview state when user navigates to archive with back button', async () => {
        // Mock fetch function to return /get_overview_state response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                plants: mockContext.plants,
                groups: mockContext.groups
            })
        }));

        // Simulate user navigating to overview page with back button
        const pageshowEvent = new Event('pageshow');
        Object.defineProperty(pageshowEvent, 'persisted', { value: true });
        window.dispatchEvent(pageshowEvent);

        // Confirm fetched archived overview state, not main overview state
        expect(global.fetch).toHaveBeenCalledWith('/get_archived_overview_state');
        expect(global.fetch).not.toHaveBeenCalledWith('/get_overview_state');
    });
});
