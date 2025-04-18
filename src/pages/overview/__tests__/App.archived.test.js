import createMockContext from 'src/testUtils/createMockContext';
import { postHeaders } from 'src/testUtils/headers';
import { PageWrapper } from 'src/index';
import App from '../App';
import { mockContext } from './mockContext';

describe('App', () => {
    let app, user;

    beforeAll(() => {
        // Create mock state objects (flip all archived bools to true)
        createMockContext('plants', mockContext.plants.map(plant => (
            { ...plant, archived: true }
        )));
        createMockContext('groups', mockContext.groups.map(group => (
            { ...group, archived: true }
        )));
        createMockContext('user_accounts_enabled', true);

        // Mock window.location to simulate archived overview
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: {
                ...window.location,
                href: 'https://plants.lan/',
                pathname: '/archived',
                assign: jest.fn()
            }
        });

        // Mock width to force mobile layout (renders title nav dropdown)
        window.innerWidth = 750;
    });

    beforeEach(() => {
        // Clear sessionStorage (cached sortDirection, sortKey)
        sessionStorage.clear();
        // Render app + create userEvent instance to use in tests
        user = userEvent.setup();
        app = render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );
    });

    it('redirects to user profile when dropdown option is clicked', async () => {
        // Click User profile dropdown option, confirm redirected
        await user.click(app.getByText('User profile'));
        expect(window.location.href).toBe('/accounts/profile/');
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
        const buttonDiv = app.container.querySelector('.floating-footer');
        await user.click(within(buttonDiv).getByText('Cancel'));
        expect(floatingFooter.classList).toContain('floating-footer-hidden');
        expect(app.container.querySelectorAll('.ml-\\[2\\.5rem\\]').length).toBe(0);
    });

    it('sends correct payload when plants are deleted', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "deleted": ["0640ec3b-1bed-4b15-a078-d6e7ec66be12"],
                "failed": []
            })
        }));

        // Click edit option, click first checkbox (plant)
        await user.click(app.getByText("Edit"));
        await user.click(app.container.querySelectorAll('label.cursor-pointer')[0]);

        // Click delete button in floating div
        await user.click(app.getByText('Delete'));

        // Confirm correct data posted to /bulk_delete_plants_and_groups endpoint
        expect(global.fetch).toHaveBeenCalledWith('/bulk_delete_plants_and_groups', {
            method: 'POST',
            body: JSON.stringify({
                "uuids": ["0640ec3b-1bed-4b15-a078-d6e7ec66be12"]
            }),
            headers: postHeaders
        });
    });

    it('sends correct payload when plants are un-archived', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "archived": ["0640ec3b-1bed-4b15-a078-d6e7ec66be12"],
                "failed": []
            })
        }));

        // Click edit option, click first checkbox (plant)
        await user.click(app.getByText("Edit"));
        await user.click(app.container.querySelectorAll('label.cursor-pointer')[0]);

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
                "deleted": ["0640ec3b-1bed-4b15-a078-d6e7ec66be14"],
                "failed": []
            })
        }));

        // Click edit option, select first group checkbox
        await user.click(app.getByText("Edit"));
        const groupsCol = app.getByText('Groups (2)').parentElement;
        await user.click(groupsCol.querySelectorAll('label.cursor-pointer')[0]);

        // Click delete button in floating div
        await user.click(app.getByText('Delete'));

        // Confirm correct data posted to /bulk_delete_plants_and_groups endpoint
        expect(global.fetch).toHaveBeenCalledWith('/bulk_delete_plants_and_groups', {
            method: 'POST',
            body: JSON.stringify({
                "uuids": ["0640ec3b-1bed-4b15-a078-d6e7ec66be14"]
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
                "archived": ["0640ec3b-1bed-4b15-a078-d6e7ec66be14"],
                "failed": []
            })
        }));

        // Click edit option, select first group checkbox
        await user.click(app.getByText("Edit"));
        const groupsCol = app.getByText('Groups (2)').parentElement;
        await user.click(groupsCol.querySelectorAll('label.cursor-pointer')[0]);

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
                "archived": [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                    "0640ec3b-1bed-fb15-a078-d6e7ec66be12",
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be14",
                    "0640ec3b-1bed-4ba5-a078-d6e7ec66be14"
                ],
                "failed": []
            })
        }));

        // Click edit option, click all checkboxes (2 plants 2 groups)
        await user.click(app.getByText("Edit"));
        await user.click(app.container.querySelectorAll('label.cursor-pointer')[0]);
        await user.click(app.container.querySelectorAll('label.cursor-pointer')[1]);
        await user.click(app.container.querySelectorAll('label.cursor-pointer')[2]);
        await user.click(app.container.querySelectorAll('label.cursor-pointer')[3]);

        // Click un-archive button in floating div
        await user.click(app.getByText('Un-archive'));

        // Confirm redirected to overview
        expect(window.location.href).toBe('/');
    });

    // Regression test: When overview and archived overview were merged the
    // useEffect containing handleBackButton was not modified, so the archived
    // overview would request main overview state and turn into non-archived
    // overview when the back button was pressed.
    it('does NOT fetch new state when user navigates to archive with back button', async () => {
        // Mock fetch function to return /get_overview_state response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "plants": mockContext.plants,
                "groups": mockContext.groups
            })
        }));

        // Simulate user navigating to overview page with back button
        const pageshowEvent = new Event('pageshow');
        Object.defineProperty(pageshowEvent, 'persisted', { value: true });
        window.dispatchEvent(pageshowEvent);

        // Confirm did NOT fetch new state
        expect(global.fetch).not.toHaveBeenCalled();
    });
});
