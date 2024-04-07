import React, { useState, useRef } from 'react';
import { render, fireEvent } from '@testing-library/react';
import userEvent from "@testing-library/user-event";
import PhotoModal from '../PhotoModal';
import { mockContext } from './mockContext';

const TestComponent = () => {
    const photoModalRef = useRef(null);
    const [photoUrls, setPhotoUrls] = useState(mockContext.photo_urls);

    // Render app
    return <PhotoModal
        modalRef={photoModalRef}
        plantID={"0640ec3b-1bed-4b15-a078-d6e7ec66be12"}
        addPlantPhotoUrls={jest.fn()}
    />;
};

describe('App', () => {
    let app, user;

    beforeEach(() => {
        // Render app + create userEvent instance to use in tests
        app = render(
            <TestComponent />
        );
        user = userEvent.setup();
    });

    it('sends correct payload when photos are uploaded', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                "uploaded": "2 photo(s)",
                "urls": [
                    {
                        "created": "2024:03:21 10:52:03",
                        "url": "/media/images/photo1.jpg"
                    },
                    {
                        "created": "2024:03:22 10:52:03",
                        "url": "/media/images/photo2.jpg"
                    },
                ]
            })
        }));

        // Create 2 mock files
        const file1 = new File(['file1'], 'file1.jpg', { type: 'image/jpeg' });
        const file2 = new File(['file2'], 'file2.jpg', { type: 'image/jpeg' });

        // Simulate user clicking input and selecting mock files
        const fileInput = app.getByTestId('photo-input');
        fireEvent.change(fileInput, { target: { files: [file1, file2] } });

        // Simulate user clicking upload button
        await user.click(app.getByText('Upload'));

        // Confirm correct data posted to /add_plant_photos endpoint
        expect(fetch).toHaveBeenCalledWith('/add_plant_photos', {
            method: 'POST',
            body: expect.any(FormData),
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'X-CSRFToken': undefined,
            }
        });

        // Confirm FormData contains the correct files
        const formData = fetch.mock.calls[0][1].body;
        expect(formData.get('photo_0')).toEqual(file1);
        expect(formData.get('photo_1')).toEqual(file2);
    });

    it('removes selected files in PhotoModal when X buttons are clicked', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                "uploaded": "2 photo(s)",
                "urls": [
                    {
                        "created": "2024:03:21 10:52:03",
                        "url": "/media/images/photo1.jpg"
                    }
                ]
            })
        }));

        // Create 2 mock files
        const file1 = new File(['file1'], 'file1.jpg', { type: 'image/jpeg' });
        const file2 = new File(['file2'], 'file2.jpg', { type: 'image/jpeg' });

        // Simulate user clicking input and selecting both mock files
        const fileInput = app.getByTestId('photo-input');
        fireEvent.change(fileInput, { target: { files: [file1, file2] } });

        // Simulate user clicking delete button next to second file in list
        const fileToRemove = app.getByText('file2.jpg');
        const removeButton = fileToRemove.parentNode.parentNode.children[0].children[0];
        await user.click(removeButton);

        // Confirm second file no longer shown on page
        expect(app.queryByText('file2.jpg')).toBeNull();

        // Simulate user clicking upload button
        await user.click(app.getByText('Upload'));

        // Confirm FormData posted to backend only contains first file
        const formData = fetch.mock.calls[0][1].body;
        expect(formData.get('photo_0')).toEqual(file1);
        expect(formData.get('photo_1')).toBeNull();
    });
});
