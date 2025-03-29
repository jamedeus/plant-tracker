import createMockContext from 'src/testUtils/createMockContext';
import { postHeaders } from 'src/testUtils/headers';
import DeletePhotosModal, { openDeletePhotosModal } from '../DeletePhotosModal';
import { TimelineProvider } from '../TimelineContext';
import { PageWrapper } from 'src/index';
import { mockContext } from './mockContext';

const TestComponent = () => {
    // Render app
    return (
        <TimelineProvider formattedEvents={{}}>
            <DeletePhotosModal plantID='0640ec3b-1bed-4b15-a078-d6e7ec66be12' />
            <button onClick={openDeletePhotosModal}>
                Open delete photos modal
            </button>
        </TimelineProvider>
    );
};

describe('DeletePhotosModal', () => {
    let component, user;

    beforeAll(() => {
        // Create mock state objects (used by TimelineContext)
        createMockContext('notes', []);
        createMockContext('photo_urls', mockContext.photo_urls);
    });

    beforeEach(async () => {
        // Render component + create userEvent instance to use in tests
        user = userEvent.setup();
        component = render(
            <PageWrapper>
                <TestComponent />
            </PageWrapper>
        );

        // Open modal
        await user.click(component.getByText('Open delete photos modal'));
        await waitFor(() => {
            expect(component.container.querySelector('#photo1')).not.toBeNull();
        });
    });

    it('disables delete button until at least one photo selected', async() => {
        // Delete button should be disabled
        expect(component.getAllByText('Delete')[0]).toBeDisabled();

        // Select first photo, confirm delete button is enabled
        await user.click(component.getAllByText(/Select/)[0]);
        expect(component.getAllByText('Delete')[0]).not.toBeDisabled();

        // Un-select photo, confirm delete button is disabled
        await user.click(component.getAllByText(/Select/)[0]);
        expect(component.getAllByText('Delete')[0]).toBeDisabled();
    });

    it('closes modal when cancel button clicked', async () => {
        // Click button, confirm HTMLDialogElement method was called
        await user.click(component.getAllByText('Cancel')[0]);
        expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
    });

    it('shows confirmation screen before deleting photos', async () => {
        // Get references to select screen and confirmation screen
        const select = component.container.querySelector('.modal-box').children[1];
        const confirm = component.container.querySelector('.modal-box').children[2];
        // Select screen should be visible, confirmation should be hidden
        expect(select.classList.contains('hidden')).toBe(false);
        expect(confirm.classList.contains('hidden')).toBe(true);

        // Simulate user selecting first photo and clicking delete button
        await user.click(component.getAllByText(/Select/)[0]);
        await user.click(component.getAllByText(/Delete/)[1]);

        // Confirmation screen should now be visible, select should be hidden
        expect(select.classList.contains('hidden')).toBe(true);
        expect(confirm.classList.contains('hidden')).toBe(false);

        // Click cancel button, confirm switches back to select screen
        await user.click(component.getAllByText(/Cancel/)[1]);
        expect(select.classList.contains('hidden')).toBe(false);
        expect(confirm.classList.contains('hidden')).toBe(true);
    });

    it('sends correct payload when photos are deleted', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                "deleted": [1],
                "failed": []
            })
        }));

        // Simulate user selecting first photo
        await user.click(component.getAllByText(/Select/)[0]);

        // Simulate user selecting and then unselecting second photo
        await user.click(component.getAllByText(/Select/)[1]);
        await user.click(component.getAllByText(/Select/)[1]);

        // Simulate user clicking delete button
        // First occurrence of "Delete" is title, second is delete button,
        // third is "Confirm Delete" title, forth is confirm delete button
        await user.click(component.getAllByText(/Delete/)[1]);
        await user.click(component.getAllByText(/Delete/)[3]);

        // Confirm correct data posted to /delete_plant_photos endpoint
        // Should contain key of first photo but not second (unselected)
        expect(fetch).toHaveBeenCalledWith('/delete_plant_photos', {
            method: 'POST',
            body: JSON.stringify({
                "plant_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                "delete_photos": [3]
            }),
            headers: postHeaders
        });
    });

    it('removes selected photos when X clicked at confirmation screen', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                "deleted": [1],
                "failed": []
            })
        }));

        // Simulate user selecting first 2 photos
        await user.click(component.getAllByText(/Select/)[0]);
        await user.click(component.getAllByText(/Select/)[1]);

        // Click first delete button
        await user.click(component.getAllByText(/Delete/)[1]);

        // Click X button next to first photo on confirmation screen
        const confirmScreen = component.getByText('Confirm Delete').parentElement;
        const removeButton = confirmScreen.children[1].children[0].children[0];
        await user.click(removeButton);

        // Click second delete button (confirm delete, makes API call)
        await user.click(component.getAllByText(/Delete/)[3]);

        // Confirm payload only includes key of second photo
        expect(fetch).toHaveBeenCalledWith('/delete_plant_photos', {
            method: 'POST',
            body: JSON.stringify({
                "plant_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                "delete_photos": [2]
            }),
            headers: postHeaders
        });
    });

    it('shows error modal if error received while deleting photos', async() => {
        // Mock fetch function to return arbitrary error
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            json: () => Promise.resolve({
                "error": "failed to delete photos"
            })
        }));

        // Confirm arbitrary error does not appear on page
        expect(component.queryByText(/failed to delete photos/)).toBeNull();

        // Simulate user deleting first photo in history
        // First occurrence of "Delete" is title, second is delete button,
        // third is "Confirm Delete" title, forth is confirm delete button
        await user.click(component.getAllByText(/Select/)[0]);
        await user.click(component.getAllByText(/Delete/)[1]);
        await user.click(component.getAllByText(/Delete/)[3]);

        // Confirm modal appeared with arbitrary error text
        expect(component.queryByText(/failed to delete photos/)).not.toBeNull();
    });
});
