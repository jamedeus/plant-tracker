import bulkCreateMockContext from 'src/testUtils/bulkCreateMockContext';
import { postHeaders } from 'src/testUtils/headers';
import DeletePhotosModal, { openDeletePhotosModal } from '../DeletePhotosModal';
import { ReduxProvider } from '../store';
import { PageWrapper } from 'src/index';
import { mockContext } from './mockContext';

const TestComponent = () => {
    // Render app
    return (
        <ReduxProvider>
            <DeletePhotosModal plantID='0640ec3b-1bed-4b15-a078-d6e7ec66be12' />
            <button onClick={openDeletePhotosModal}>
                Open delete photos modal
            </button>
        </ReduxProvider>
    );
};

describe('DeletePhotosModal', () => {
    let component, user;

    beforeAll(() => {
        // Create mock state objects (used by ReduxProvider)
        bulkCreateMockContext(mockContext);
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
        expect(component.getByTestId('delete_photos')).toBeDisabled();

        // Select first photo, confirm delete button is enabled
        await user.click(component.getByTestId('select_photo_3'));
        expect(component.getByTestId('delete_photos')).not.toBeDisabled();

        // Un-select photo, confirm delete button is disabled
        await user.click(component.getByTestId('select_photo_3'));
        expect(component.getByTestId('delete_photos')).toBeDisabled();
    });

    it('shows confirmation screen before deleting photos', async () => {
        // Get references to select screen and confirmation screen
        const select = component.getByTestId('delete-photos-select');
        const confirm = component.getByTestId('delete-photos-confirm');
        // Select screen should be visible, confirmation should be hidden
        expect(select.classList).not.toContain('hidden');
        expect(confirm.classList).toContain('hidden');

        // Simulate user selecting first photo and clicking delete button
        await user.click(component.getByTestId('select_photo_3'));
        await user.click(component.getByTestId('delete_photos'));

        // Confirmation screen should now be visible, select should be hidden
        expect(select.classList).toContain('hidden');
        expect(confirm.classList).not.toContain('hidden');

        // Click cancel button, confirm switches back to select screen
        await user.click(component.getAllByText(/Cancel/)[1]);
        expect(select.classList).not.toContain('hidden');
        expect(confirm.classList).toContain('hidden');
    });

    it('sends correct payload when photos are deleted', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                deleted: [2],
                failed: []
            })
        }));

        // Simulate user selecting and then unselecting first photo
        await user.click(component.getByTestId('select_photo_3'));
        await user.click(component.getByTestId('select_photo_3'));

        // Simulate user selecting second photo
        await user.click(component.getByTestId('select_photo_2'));

        // Simulate user clicking delete button, confirm delete button
        await user.click(component.getByTestId('delete_photos'));
        await user.click(component.getByTestId('confirm_delete_photos'));

        // Confirm correct data posted to /delete_plant_photos endpoint
        // Should contain key of first photo but not second (unselected)
        expect(fetch).toHaveBeenCalledWith('/delete_plant_photos', {
            method: 'POST',
            body: JSON.stringify({
                plant_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                delete_photos: [2]
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
                deleted: [2],
                failed: []
            })
        }));

        // Simulate user selecting first 2 photos
        await user.click(component.getByTestId('select_photo_3'));
        await user.click(component.getByTestId('select_photo_2'));

        // Click first delete button
        await user.click(component.getByTestId('delete_photos'));

        // Click X button next to first photo on confirmation screen
        const confirmScreen = component.getByTestId('delete-photos-confirm');
        const removeButton = confirmScreen.querySelector('svg');
        await user.click(removeButton);

        // Click second delete button (confirm delete, makes API call)
        await user.click(component.getByTestId('confirm_delete_photos'));

        // Confirm payload only includes key of second photo
        expect(fetch).toHaveBeenCalledWith('/delete_plant_photos', {
            method: 'POST',
            body: JSON.stringify({
                plant_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                delete_photos: [2]
            }),
            headers: postHeaders
        });
    });

    it('leaves confirmation screen when last selected photo is unselected', async () => {
        // Simulate user selecting first 2 photos
        await user.click(component.getByTestId('select_photo_3'));
        await user.click(component.getByTestId('select_photo_2'));

        // Click first delete button, confirm confirmation screen visible
        await user.click(component.getByTestId('delete_photos'));
        const confirmScreen = component.getByTestId('delete-photos-confirm');
        expect(confirmScreen.classList).not.toContain('hidden');

        // Click first photo X button, confirm still on confirmation screen
        await user.click(confirmScreen.querySelector('svg'));
        expect(confirmScreen.classList).not.toContain('hidden');

        // Click second photo X button, confirm returned to first screen
        await user.click(confirmScreen.querySelector('svg'));
        expect(confirmScreen.classList).toContain('hidden');
    });

    it('shows error modal if error received while deleting photos', async() => {
        // Mock fetch function to return arbitrary error
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            json: () => Promise.resolve({
                error: "failed to delete photos"
            })
        }));

        // Confirm arbitrary error does not appear on page
        expect(component.queryByText(/failed to delete photos/)).toBeNull();

        // Simulate user deleting first photo in history
        await user.click(component.getByTestId('select_photo_3'));
        await user.click(component.getByTestId('delete_photos'));
        await user.click(component.getByTestId('confirm_delete_photos'));

        // Confirm modal appeared with arbitrary error text
        expect(component.queryByText(/failed to delete photos/)).not.toBeNull();
    });
});
