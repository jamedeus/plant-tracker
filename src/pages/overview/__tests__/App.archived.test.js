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

        // Mock window.location to simulate archived overview
        delete window.location;
        window.location = new URL('https://plants.lan/archived');

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
                "deleted": "uuid"
            })
        }));

        // Click edit option, click first checkbox (plant)
        await user.click(app.getByText("Edit"));
        await user.click(app.container.querySelectorAll('label.cursor-pointer')[0]);

        // Click delete button in floating div
        await user.click(app.getByText('Delete'));

        // Confirm correct data posted to /delete_plant endpoint
        expect(global.fetch).toHaveBeenCalledWith('/delete_plant', {
            method: 'POST',
            body: JSON.stringify({
                "plant_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            }),
            headers: postHeaders
        });
    });

    it('sends correct payload when plants are un-archived', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "updated": "uuid"
            })
        }));

        // Click edit option, click first checkbox (plant)
        await user.click(app.getByText("Edit"));
        await user.click(app.container.querySelectorAll('label.cursor-pointer')[0]);

        // Click archive button in floating div
        await user.click(app.getByText('Un-archive'));

        // Confirm correct data posted to /delete_plant endpoint
        expect(global.fetch).toHaveBeenCalledWith('/archive_plant', {
            method: 'POST',
            body: JSON.stringify({
                plant_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
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
                "deleted": "uuid"
            })
        }));

        // Click edit option, click second checkbox (group)
        await user.click(app.getByText("Edit"));
        await user.click(app.container.querySelectorAll('label.cursor-pointer')[1]);

        // Click delete button in floating div
        await user.click(app.getByText('Delete'));

        // Confirm correct data posted to /delete_group endpoint
        expect(global.fetch).toHaveBeenCalledWith('/delete_group', {
            method: 'POST',
            body: JSON.stringify({
                "group_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be14"
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
                "updated": "uuid"
            })
        }));

        // Click edit option, click second checkbox (group)
        await user.click(app.getByText("Edit"));
        await user.click(app.container.querySelectorAll('label.cursor-pointer')[1]);

        // Click archive button in floating div
        await user.click(app.getByText('Un-archive'));

        // Confirm correct data posted to /delete_group endpoint
        expect(global.fetch).toHaveBeenCalledWith('/archive_group', {
            method: 'POST',
            body: JSON.stringify({
                group_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be14",
                archived: false
            }),
            headers: postHeaders
        });
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
