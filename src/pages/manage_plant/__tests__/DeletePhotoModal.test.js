import { useState } from 'react';
import { render, within } from '@testing-library/react';
import userEvent from "@testing-library/user-event";
import createMockContext from 'src/testUtils/createMockContext';
import { postHeaders } from 'src/testUtils/headers';
import DeletePhotosModal, { openDeletePhotosModal } from '../DeletePhotosModal';
import { ToastProvider } from 'src/context/ToastContext';
import { ThemeProvider } from 'src/context/ThemeContext';
import { ErrorModalProvider } from 'src/context/ErrorModalContext';
import { mockContext } from './mockContext';

const TestComponent = () => {
    const [photoUrls, setPhotoUrls] = useState(mockContext.photo_urls);

    // Render app
    return (
        <>
            <DeletePhotosModal
                plantID={"0640ec3b-1bed-4b15-a078-d6e7ec66be12"}
                photoUrls={photoUrls}
                setPhotoUrls={setPhotoUrls}
            />
            <button onClick={openDeletePhotosModal}>
                Open delete photos modal
            </button>
        </>
    );
};

describe('App', () => {
    let component, user;

    beforeEach(() => {
        // Render component + create userEvent instance to use in tests
        component = render(
            <ErrorModalProvider>
                <TestComponent />
            </ErrorModalProvider>
        );
        user = userEvent.setup();
    });

    it('opens modal when openDeletePhotosModal called', async () => {
        // Click button, confirm HTMLDialogElement method was called
        await user.click(component.getByText('Open delete photos modal'));
        expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
    });

    it('closes modal when cancel button clicked', async () => {
        // Click button, confirm HTMLDialogElement method was called
        await user.click(component.getAllByText('Cancel')[0]);
        expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
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
        // First occurence of "Delete" is title, second is delete button,
        // third is "Confirm Delete" title, forth is confirm delete button
        await user.click(component.getAllByText(/Delete/)[1]);
        await user.click(component.getAllByText(/Delete/)[3]);

        // Confirm correct data posted to /delete_plant_photos endpoint
        // Should contain key of first photo but not second (unselected)
        expect(fetch).toHaveBeenCalledWith('/delete_plant_photos', {
            method: 'POST',
            body: JSON.stringify({
                "plant_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                "delete_photos": [1]
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
        // First occurence of "Delete" is title, second is delete button,
        // third is "Confirm Delete" title, forth is confirm delete button
        await user.click(component.getAllByText(/Select/)[0]);
        await user.click(component.getAllByText(/Delete/)[1]);
        await user.click(component.getAllByText(/Delete/)[3]);

        // Confirm modal appeared with arbitrary error text
        expect(component.queryByText(/failed to delete photos/)).not.toBeNull();
    });
});
