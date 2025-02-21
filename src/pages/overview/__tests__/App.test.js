import createMockContext from 'src/testUtils/createMockContext';
import { postHeaders } from 'src/testUtils/headers';
import { PageWrapper } from 'src/index';
import App from '../App';
import { mockContext } from './mockContext';

jest.mock('print-js');

describe('App', () => {
    let app, user;

    beforeAll(() => {
        // Create mock state objects
        createMockContext('plants', mockContext.plants);
        createMockContext('groups', mockContext.groups);

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

    it('opens modal when Print QR Codes dropdown option clicked', async () => {
        // Confirm modal has not been opened
        expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled();

        // Click Print QR Codes dropdown option, confirm modal opened
        await user.click(app.getByText("Print QR Codes"));
        expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
    });

    it('shows checkboxes and delete button when edit option clicked', async () => {
        // Confirm delete button and checkboxes are not visible
        expect(app.queryByText('Delete')).toBeNull();
        expect(app.container.querySelectorAll('.radio').length).toBe(0);

        // Confirm plant and group cards have href to manage page
        expect(
            app.getByText('Test Plant').parentElement.parentElement.parentElement
        ).toHaveAttribute('href', '/manage/0640ec3b-1bed-4b15-a078-d6e7ec66be12');
        expect(
            app.getByText('Test group').parentElement.parentElement.parentElement
        ).toHaveAttribute('href', '/manage/0640ec3b-1bed-4b15-a078-d6e7ec66be14');

        // Click Edit option, confirm buttons and checkboxes appear
        await user.click(app.getByText("Edit"));
        expect(app.getByText('Delete').nodeName).toBe('BUTTON');
        expect(app.container.querySelectorAll('.radio').length).not.toBe(0);

        // Confirm cards no longer have href
        expect(
            app.getByText('Test Plant').parentElement.parentElement.parentElement
        ).not.toHaveAttribute('href');
        expect(
            app.getByText('Test group').parentElement.parentElement.parentElement
        ).not.toHaveAttribute('href');

        // Click cancel button, confirm buttons and checkboxes disappear
        const buttonDiv = app.container.querySelector('.sticky.bottom-4');
        await user.click(within(buttonDiv).getByText('Cancel'));
        expect(app.queryByText('Delete')).toBeNull();
        expect(app.container.querySelectorAll('.radio').length).toBe(0);
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
        await user.click(app.container.querySelectorAll('.radio')[0]);

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

    it('sends correct payload when plants are archived', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "updated": "uuid"
            })
        }));

        // Click edit option, click first checkbox (plant)
        await user.click(app.getByText("Edit"));
        await user.click(app.container.querySelectorAll('.radio')[0]);

        // Click archive button in floating div
        await user.click(app.getByText('Archive'));

        // Confirm correct data posted to /delete_plant endpoint
        expect(global.fetch).toHaveBeenCalledWith('/archive_plant', {
            method: 'POST',
            body: JSON.stringify({
                plant_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
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
                "deleted": "uuid"
            })
        }));

        // Click edit option, click second checkbox (group)
        await user.click(app.getByText("Edit"));
        await user.click(app.container.querySelectorAll('.radio')[1]);

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

    it('sends correct payload when groups are archived', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "updated": "uuid"
            })
        }));

        // Click edit option, click second checkbox (group)
        await user.click(app.getByText("Edit"));
        await user.click(app.container.querySelectorAll('.radio')[1]);

        // Click archive button in floating div
        await user.click(app.getByText('Archive'));

        // Confirm correct data posted to /delete_group endpoint
        expect(global.fetch).toHaveBeenCalledWith('/archive_group', {
            method: 'POST',
            body: JSON.stringify({
                group_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be14",
                archived: true
            }),
            headers: postHeaders
        });
    });

    it('fetches new state when user navigates to overview with back button', async () => {
        // Mock fetch function to return expected response
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

        // Confirm fetched correct endpoint
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith('/get_overview_state');
        });
    });

    it('shows alert if unable to fetch new state when user presses back button', async () => {
        // Mock fetch function to return error response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            json: () => Promise.resolve({'Error': 'Unexpected'})
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
        window.dispatchEvent(new Event('resize'));

        // Confirm "Plants" option no longer exists
        await waitFor(() => {
            expect(app.queryByText("Plants")).toBeNull();
        });
    });
});
