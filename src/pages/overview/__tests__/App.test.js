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
        jest.useFakeTimers();

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
        const floatingFooter = app.getByTestId('floating-footer');
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

        // Click Plants column title, confirm entered edit mode again
        await user.click(app.getByText('Plants (2)'));
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
        const footer = app.getByTestId("floating-footer");
        fireEvent.touchStart(footer, {touches: [{ clientX: 50, clientY: 10 }]});
        fireEvent.touchMove(footer, {touches: [{ clientX:  50, clientY: 100 }]});
        fireEvent.touchEnd(footer, {changedTouches: [{ clientX:  50, clientY: 100 }]});
        expect(app.getByTestId("floating-footer").classList).toContain("floating-footer-hidden");
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
