import React, { useRef, useState, useEffect, Fragment } from 'react';
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

        // Simulate user deleting first photo in history
        // First occurence of "Delete" is title, second is delete button,
        // third is "Confirm Delete" title, forth is confirm delete button
        await user.click(component.getAllByText(/Select/)[0]);
        await user.click(component.getAllByText(/Delete/)[1]);
        await user.click(component.getAllByText(/Delete/)[3]);

        // Confirm correct data posted to /delete_plant_photos endpoint
        expect(fetch).toHaveBeenCalledWith('/delete_plant_photos', {
            method: 'POST',
            body: JSON.stringify({
                "plant_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                "delete_photos": [1]
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
