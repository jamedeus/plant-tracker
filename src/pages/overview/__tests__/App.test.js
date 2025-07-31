import { fireEvent, waitFor } from '@testing-library/react';
import createMockContext from 'src/testUtils/createMockContext';
import bulkCreateMockContext from 'src/testUtils/bulkCreateMockContext';
import { postHeaders } from 'src/testUtils/headers';
import { PageWrapper } from 'src/index';
import App from '../App';
import { mockContext } from './mockContext';

jest.mock('print-js');

describe('App', () => {
    let app, user;

    beforeAll(() => {
        // Create mock state objects
        bulkCreateMockContext(mockContext);
        createMockContext('user_accounts_enabled', true);

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
                <App />
            </PageWrapper>
        );
    });

    // Clean up pending timers after each test
    afterEach(() => {
        act(() => jest.runAllTimers());
        jest.useRealTimers();
    });

    it('opens modal when Print QR Codes dropdown option clicked', async () => {
        // Confirm modal has not been opened
        expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled();
        expect(app.queryByText('96 QR codes per sheet')).toBeNull();

        // Click Print QR Codes dropdown option, confirm modal opened
        await user.click(app.getByText("Print QR Codes"));
        expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
        expect(app.queryByText(/QR codes per sheet/)).not.toBeNull();
    });

    it('shows checkboxes and delete button when edit option clicked', async () => {
        // Get reference to footer, confirm hidden (default)
        const floatingFooter = app.getByTestId('edit-mode-footer');
        expect(floatingFooter.classList).toContain('floating-footer-hidden');
        // Checkboxes are rendered underneath card with position: absolute, so
        // they are not visible until margin-left is added to the card wrapper
        expect(app.container.querySelectorAll('.ml-\\[2\\.5rem\\]').length).toBe(0);

        // Click Edit option, confirm buttons and checkboxes appear
        await user.click(app.getByText("Edit"));
        expect(floatingFooter.classList).toContain('floating-footer-visible');
        expect(app.container.querySelectorAll('.ml-\\[2\\.5rem\\]').length).not.toBe(0);

        // Click cancel button, confirm buttons and checkboxes disappear
        await user.click(app.getByRole('button', {name: 'Cancel'}));
        expect(floatingFooter.classList).toContain('floating-footer-hidden');
        expect(app.container.querySelectorAll('.ml-\\[2\\.5rem\\]').length).toBe(0);

        // Click edit option in Plants column dropdown, confirm entered edit mode again
        await user.click(app.getByTestId('edit_plants_option'));
        expect(floatingFooter.classList).toContain('floating-footer-visible');
        expect(app.container.querySelectorAll('.ml-\\[2\\.5rem\\]').length).not.toBe(0);

        // Click Groups column title, confirm exited edit
        await user.click(app.getByText('Groups (2)'));
        expect(floatingFooter.classList).toContain('floating-footer-hidden');
        expect(app.container.querySelectorAll('.ml-\\[2\\.5rem\\]').length).toBe(0);

        // Click Edit option again, confirm footer appeared
        await user.click(app.getByText("Edit"));
        expect(floatingFooter.classList).toContain('floating-footer-visible');

        // Swipe down on footer, confirm footer disappeared
        const footer = app.getByTestId("edit-mode-footer");
        fireEvent.touchStart(footer, {touches: [{ clientX: 50, clientY: 10 }]});
        fireEvent.touchMove(footer, {touches: [{ clientX:  50, clientY: 100 }]});
        fireEvent.touchEnd(footer, {changedTouches: [{ clientX:  50, clientY: 100 }]});
        expect(app.getByTestId("edit-mode-footer").classList).toContain("floating-footer-hidden");
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

        // Click edit option, click first checkbox (plant)
        await user.click(app.getByText("Edit"));
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

    it('sends correct payload when plants are archived', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                archived: ["0640ec3b-1bed-4b15-a078-d6e7ec66be12"],
                failed: []
            })
        }));

        // Click edit option, click first checkbox (plant)
        await user.click(app.getByText("Edit"));
        await user.click(app.getByLabelText('Select Test Plant'));

        // Click archive button in floating div
        await user.click(app.getByText('Archive'));

        // Confirm correct data posted to /bulk_archive_plants_and_groups endpoint
        expect(global.fetch).toHaveBeenCalledWith('/bulk_archive_plants_and_groups', {
            method: 'POST',
            body: JSON.stringify({
                uuids: ["0640ec3b-1bed-4b15-a078-d6e7ec66be12"],
                archived: true
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

        // Click edit option, select first group checkbox
        await user.click(app.getByText("Edit"));
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

    it('sends correct payload when groups are archived', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                archived: ["0640ec3b-1bed-4b15-a078-d6e7ec66be14"],
                failed: []
            })
        }));

        // Click edit option, select first group checkbox
        await user.click(app.getByText("Edit"));
        await user.click(app.getByLabelText('Select Test group'));

        // Click archive button in floating div
        await user.click(app.getByText('Archive'));

        // Confirm correct data posted to /bulk_archive_plants_and_groups endpoint
        expect(global.fetch).toHaveBeenCalledWith('/bulk_archive_plants_and_groups', {
            method: 'POST',
            body: JSON.stringify({
                uuids: ["0640ec3b-1bed-4b15-a078-d6e7ec66be14"],
                archived: true
            }),
            headers: postHeaders
        });
    });

    it('shows error modal when unable to delete plant or group', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 400,
            json: () => Promise.resolve({
                deleted: [],
                failed: ["0640ec3b-1bed-4b15-a078-d6e7ec66be12"]
            })
        }));

        // Confirm error modal is not rendered
        expect(app.queryByText(
            'Failed to delete: 0640ec3b-1bed-4b15-a078-d6e7ec66be12'
        )).toBeNull();

        // Click edit option, click first checkbox
        await user.click(app.getByText("Edit"));
        await user.click(app.getByLabelText('Select Test Plant'));

        // Click delete button in floating div, hold for 2.5 seconds, release
        const button = app.getByRole('button', { name: 'Delete' });
        fireEvent.mouseDown(button);
        await act(async () => await jest.advanceTimersByTimeAsync(2500));
        fireEvent.mouseUp(button);

        // Confirm error modal appeared
        expect(app.queryByText(
            'Failed to delete: 0640ec3b-1bed-4b15-a078-d6e7ec66be12'
        )).not.toBeNull();
    });

    it('shows error modal when unable to archive plant or group', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 400,
            json: () => Promise.resolve({
                archived: [],
                failed: ["0640ec3b-1bed-4b15-a078-d6e7ec66be12"]
            })
        }));

        // Confirm error modal is not rendered
        expect(app.queryByText(
            'Failed to archive: 0640ec3b-1bed-4b15-a078-d6e7ec66be12'
        )).toBeNull();

        // Click edit option, click first checkbox, click archive button
        await user.click(app.getByText("Edit"));
        await user.click(app.getByLabelText('Select Test Plant'));
        await user.click(app.getByText('Archive'));

        // Confirm error modal appeared
        expect(app.queryByText(
            'Failed to archive: 0640ec3b-1bed-4b15-a078-d6e7ec66be12'
        )).not.toBeNull();
    });

    it('removes edit option from dropdown if all plants and groups are deleted', async () => {
        // Mock fetch to simulate successfully deleting both plants
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                deleted: [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                    "0640ec3b-1bed-fb15-a078-d6e7ec66be12"
                ],
                failed: []
            })
        }));

        // Confirm edit option exists
        expect(app.queryByText('Edit')).not.toBeNull();

        // Click edit option, select all plants
        await user.click(app.getByText("Edit"));
        await user.click(app.getByLabelText('Select Test Plant'));
        await user.click(app.getByLabelText('Select Second Test Plant'));

        // Click delete button in floating div, hold for 2.5 seconds, release
        const button = app.getByRole('button', { name: 'Delete' });
        fireEvent.mouseDown(button);
        await act(async () => await jest.advanceTimersByTimeAsync(2500));
        fireEvent.mouseUp(button);

        // Confirm edit option still exists
        expect(app.queryByText('Edit')).not.toBeNull();

        // Mock fetch to simulate successfully deleting both groups
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                deleted: [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be14",
                    "0640ec3b-1bed-4ba5-a078-d6e7ec66be14"
                ],
                failed: []
            })
        }));

        // Click edit option again, select all groups
        await user.click(app.getByText("Edit"));
        await user.click(app.getByLabelText('Select Test group'));
        await user.click(app.getByLabelText('Select Second Test group'));

        // Click delete button in floating div, hold for 2.5 seconds, release
        fireEvent.mouseDown(button);
        await act(async () => await jest.advanceTimersByTimeAsync(2500));
        fireEvent.mouseUp(button);

        // Confirm edit option no longer exists
        expect(app.queryByText('Edit')).toBeNull();
    });

    it('removes edit option from dropdown if all plants and groups are archived', async () => {
        // Mock fetch to simulate successfully archiving both groups
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                archived: [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be14",
                    "0640ec3b-1bed-4ba5-a078-d6e7ec66be14"
                ],
                failed: []
            })
        }));

        // Confirm edit option exists
        expect(app.queryByText('Edit')).not.toBeNull();

        // Click edit option, archive all groups
        await user.click(app.getByText("Edit"));
        await user.click(app.getByLabelText('Select Test group'));
        await user.click(app.getByLabelText('Select Second Test group'));
        await user.click(app.getByText('Archive'));

        // Confirm edit option still exists
        expect(app.queryByText('Edit')).not.toBeNull();

        // Mock fetch to simulate successfully archiving both plants
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                archived: [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                    "0640ec3b-1bed-fb15-a078-d6e7ec66be12"
                ],
                failed: []
            })
        }));

        // Click edit option again, archive all plants
        await user.click(app.getByText("Edit"));
        await user.click(app.getByLabelText('Select Test Plant'));
        await user.click(app.getByLabelText('Select Second Test Plant'));
        await user.click(app.getByText('Archive'));

        // Confirm edit option no longer exists
        expect(app.queryByText('Edit')).toBeNull();
    });

    it('shows checkboxes and event buttons when add events option clicked', async () => {
        // Get reference to footer, confirm hidden (default)
        const floatingFooter = app.getByTestId('add-events-footer');
        expect(floatingFooter.classList).toContain('floating-footer-hidden');
        // Checkboxes are rendered underneath card with position: absolute, so
        // they are not visible until margin-left is added to the card wrapper
        expect(app.container.querySelectorAll('.ml-\\[2\\.5rem\\]').length).toBe(0);

        // Click add events option, confirm checkboxes and buttons appear
        await user.click(app.getByTestId('add_plants_option'));
        expect(floatingFooter.classList).toContain('floating-footer-visible');
        expect(app.container.querySelectorAll('.ml-\\[2\\.5rem\\]').length).not.toBe(0);

        // Click close button, confirm checkboxes and buttons disappear
        await user.click(app.getByTestId('close-add-events-footer'));
        expect(floatingFooter.classList).toContain('floating-footer-hidden');
        expect(app.container.querySelectorAll('.ml-\\[2\\.5rem\\]').length).toBe(0);
    });

    it('sends correct payload when selected plants are watered', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                action: "water",
                timestamp: "2024-03-01T20:00:00.000+00:00",
                plants: [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
                ],
                failed: []
            })
        }));

        // Confirm plants were last watered 4 and 5 days ago respectively
        expect(app.queryAllByText(/5 days ago/).length).toBe(1);
        expect(app.queryAllByText(/4 days ago/).length).toBe(1);
        // Confirm no plants were last watered today
        expect(app.queryAllByText(/Today/).length).toBe(0);

        // Click add events option, select first plant, click water button
        await user.click(app.getByTestId('add_plants_option'));
        await user.click(app.getByLabelText('Select Test Plant'));
        await user.click(app.getByTestId('water-button'));

        // Confirm correct data posted to /bulk_add_plant_events endpoint
        // Should contain UUIDs of both plants in group
        expect(global.fetch).toHaveBeenCalledWith('/bulk_add_plant_events', {
            method: 'POST',
            body: JSON.stringify({
                plants: [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
                ],
                event_type: "water",
                timestamp: "2024-03-01T20:00:00.000Z"
            }),
            headers: postHeaders
        });

        // Confirm selected plant was last watered today
        expect(app.queryAllByText('Today').length).toBe(1);
        expect(app.queryAllByText('5 days ago').length).toBe(0);
        // Confirm unselected plant was still last watered 4 days ago
        expect(app.queryAllByText('4 days ago').length).toBe(1);

        // Confirm toast appeared, floating footer disappeared
        expect(app.queryByText('Plants watered!')).not.toBeNull();
        expect(app.getByTestId('add-events-footer').classList).toContain(
            'floating-footer-hidden'
        );
    });

    it('sends correct payload when selected plants are fertilized', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                action: "fertilize",
                timestamp: "2024-03-01T20:00:00.000+00:00",
                plants: [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
                ],
                failed: []
            })
        }));

        // Click add events option, select first plant, click fertilize button
        await user.click(app.getByTestId('add_plants_option'));
        await user.click(app.getByLabelText('Select Test Plant'));
        await user.click(app.getByTestId('fertilize-button'));

        // Confirm correct data posted to /bulk_add_plant_events endpoint
        // Should contain UUIDs of both plants in group
        expect(global.fetch).toHaveBeenCalledWith('/bulk_add_plant_events', {
            method: 'POST',
            body: JSON.stringify({
                plants: [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
                ],
                event_type: "fertilize",
                timestamp: "2024-03-01T20:00:00.000Z"
            }),
            headers: postHeaders
        });

        // Confirm toast appeared, floating footer disappeared
        expect(app.queryByText('Plants fertilized!')).not.toBeNull();
        expect(app.getByTestId('add-events-footer').classList).toContain(
            'floating-footer-hidden'
        );
    });

    it('sends correct payload when selected plants are pruned', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                action: "prune",
                timestamp: "2024-03-01T20:00:00.000+00:00",
                plants: [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
                ],
                failed: []
            })
        }));

        // Click add events option, select first plant, click prune button
        await user.click(app.getByTestId('add_plants_option'));
        await user.click(app.getByLabelText('Select Test Plant'));
        await user.click(app.getByTestId('prune-button'));

        // Confirm correct data posted to /bulk_add_plant_events endpoint
        // Should contain UUIDs of both plants in group
        expect(global.fetch).toHaveBeenCalledWith('/bulk_add_plant_events', {
            method: 'POST',
            body: JSON.stringify({
                plants: [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
                ],
                event_type: "prune",
                timestamp: "2024-03-01T20:00:00.000Z"
            }),
            headers: postHeaders
        });

        // Confirm toast appeared, floating footer disappeared
        expect(app.queryByText('Plants pruned!')).not.toBeNull();
        expect(app.getByTestId('add-events-footer').classList).toContain(
            'floating-footer-hidden'
        );
    });

    it('does not make request when event buttons clicked if no plants selected', async () => {
        // Click add events option, click water button without selecting any plants
        await user.click(app.getByTestId('add_plants_option'));
        await user.click(app.getByTestId('water-button'));

        // Confirm no request was made
        expect(global.fetch).not.toHaveBeenCalled();

        // Confirm footer did not disappear
        expect(app.getByTestId('add-events-footer').classList).toContain(
            'floating-footer-visible'
        );
    });

    it('updates AddEventsFooter text to show number of selected items', async () => {
        // Click add events option
        await user.click(app.getByTestId('add_plants_option'));

        // Confirm initial instructions text is visible
        await act(async () => await jest.advanceTimersByTimeAsync(150));
        expect(app.queryByText('Select plants to add events')).not.toBeNull();

        // Select first plant, confirm text changed to 1 plant selected
        await user.click(app.getByLabelText('Select Test Plant'));
        await act(async () => await jest.advanceTimersByTimeAsync(150));
        expect(app.queryByText('1 plant selected')).not.toBeNull();
        expect(app.queryByText('Select plants to add events')).toBeNull();

        // Select second plant, confirm text changed to 2 plants selected
        await user.click(app.getByLabelText('Select Second Test Plant'));
        expect(app.queryByText('2 plants selected')).not.toBeNull();

        // Unselect first plant, confirm text changed back to 1 plant selected
        await user.click(app.getByLabelText('Select Test Plant'));
        await act(async () => await jest.advanceTimersByTimeAsync(150));
        expect(app.queryByText('1 plant selected')).not.toBeNull();
    });

    it('shows error modal if error received while bulk adding events', async() => {
        // Mock fetch function to return arbitrary error
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            json: () => Promise.resolve({
                error: "failed to bulk add events"
            })
        }));

        // Confirm arbitrary error does not appear on page
        expect(app.queryByText(/failed to bulk add events/)).toBeNull();

        // Click add events option, select first plant, click water button
        await user.click(app.getByTestId('add_plants_option'));
        await user.click(app.getByLabelText('Select Test Plant'));
        await user.click(app.getByTestId('water-button'));

        // Confirm modal appeared with arbitrary error text
        expect(app.queryByText(/failed to bulk add events/)).not.toBeNull();
    });

    it('fetches new state when user navigates to overview with back button', async () => {
        // Mock fetch function to return expected response
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

        // Confirm fetched correct endpoint
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith('/get_overview_state');
        });
    });

    it('shows alert if unable to fetch new state when user presses back button', async () => {
        // Mock fetch function to return error response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            json: () => Promise.resolve({Error: 'Unexpected'})
        }));
        // Mock alert function that will be called when request fails
        global.alert = jest.fn();

        // Simulate user navigating to page with back button
        const pageshowEvent = new Event('pageshow');
        Object.defineProperty(pageshowEvent, 'persisted', { value: true });
        window.dispatchEvent(pageshowEvent);

        // Confirm fetched correct endpoint
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith('/get_overview_state');
        });

        // Confirm alert was shown
        expect(global.alert).toHaveBeenCalled();
    });

    it('does not fetch new state when other pageshow events are triggered', () => {
        // Simulate pageshow event with persisted == false (ie initial load)
        const pageshowEvent = new Event('pageshow');
        Object.defineProperty(pageshowEvent, 'persisted', { value: false });
        window.dispatchEvent(pageshowEvent);

        // Confirm did not call fetch
        expect(global.fetch).not.toHaveBeenCalled();
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

    it('removes title dropdown if window is resized to desktop breakpoint', async () => {
        // Confirm "Plants" option in dropdown exists
        expect(app.queryByText("Plants")).not.toBeNull();

        // Simulate resizing window past tailwind md breakpoint
        window.innerWidth = 800;
        await act(() => window.dispatchEvent(new Event('resize')));

        // Confirm "Plants" option no longer exists
        await waitFor(() => {
            expect(app.queryByText("Plants")).toBeNull();
        });
    });
});
