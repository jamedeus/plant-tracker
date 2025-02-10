import { fireEvent } from '@testing-library/react';
import createMockContext from 'src/testUtils/createMockContext';
import App from '../App';
import { ThemeProvider } from 'src/context/ThemeContext';
import { ErrorModalProvider } from 'src/context/ErrorModalContext';
import { mockContextNoEvents } from './mockContext';

describe('App', () => {
    let app, user;

    beforeAll(() => {
        // Create mock state objects
        createMockContext('plant', mockContextNoEvents.plant);
        createMockContext('notes', mockContextNoEvents.notes);
        createMockContext('group_options', mockContextNoEvents.group_options);
        createMockContext('species_options', mockContextNoEvents.species_options);
        createMockContext('photo_urls', mockContextNoEvents.photo_urls);
    });

    beforeEach(() => {
        // Render app + create userEvent instance to use in tests
        user = userEvent.setup();
        app = render(
            <ThemeProvider>
                <ErrorModalProvider>
                    <App />
                </ErrorModalProvider>
            </ThemeProvider>
        );
    });

    // Original bug: Same state was used for last_watered and last_fertilized,
    // both would update when plant was watered (fertilized should not update)
    it('updates correct relative time when plant is watered', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "action": "water",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            })
        }));

        // Confirm both relative times show "never"
        expect(app.getByText("Never watered")).not.toBeNull();
        expect(app.getByText("Never fertilized")).not.toBeNull();

        // Click water button
        await user.click(app.getByRole("button", {name: "Water"}));

        // Last watered time should change, last fertilized should not
        expect(app.queryByText("Never watered")).toBeNull();
        expect(app.getByText("Never fertilized")).not.toBeNull();
    });

    // Original bug: Same state was used for last_watered and last_fertilized,
    // neither would update when plant was fertilzized (fertilized should update)
    it('updates correct relative time when plant is fertilized', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "action": "fertilize",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            })
        }));

        // Confirm both relative times show "never"
        expect(app.getByText("Never watered")).not.toBeNull();
        expect(app.getByText("Never fertilized")).not.toBeNull();

        // Click fertilize button
        await user.click(app.getByRole("button", {name: "Fertilize"}));

        // Last fertilized time should change, last watered should not
        expect(app.getByText("Never watered")).not.toBeNull();
        expect(app.queryByText("Never fertilized")).toBeNull();
    });

    // Original bug: Repot events did not appear on calendar until page was
    // refreshed because the submit listener did not add them to history state
    it('updates calendar when repot modal is submitted', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "action": "repot",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            })
        }));

        // Confirm no repot events are shown on calendar
        const calendar = app.getByText('March 2024').parentNode.parentNode.parentNode;
        expect(calendar.querySelector('.dot-repot')).toBeNull();

        // Click Repot Modal submit button
        const repotModal = app.getAllByText(/Repot plant/)[1].parentNode;
        const submit = repotModal.querySelector('.btn-success');
        await user.click(submit);

        // Repot event should appear on calendar
        expect(calendar.querySelector('.dot-repot')).not.toBeNull();
    });

    // Original bug: PhotoModal file selection input retained prior selection
    // after uploading photos, confusing UX and easy to upload duplicates
    it('clears the PhotoModal file input after uploading photos', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                "uploaded": "2 photo(s)",
                "failed": [],
                "urls": [
                    {
                        "created": "2024-03-21T10:52:03",
                        "image": "/media/images/photo1.jpg",
                        "thumbnail": "/media/images/photo1_thumb.jpg",
                        "key": 1
                    },
                    {
                        "created": "2024-03-22T10:52:04",
                        "image": "/media/images/photo2.jpg",
                        "thumbnail": "/media/images/photo2_thumb.jpg",
                        "key": 2
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

        // Confirm names of both files appear in document (under file input)
        expect(app.getByText('file1.jpg')).not.toBeNull();
        expect(app.getByText('file2.jpg')).not.toBeNull();

        // Simulate user clicking upload button
        await user.click(app.getByText('Upload'));

        // Confirm both filenames are no longer in document (selection reset)
        await waitFor(() => {
            expect(app.queryByText('file1.jpg')).toBeNull();
            expect(app.queryByText('file2.jpg')).toBeNull();
        });
    });

    // Original bug: EventCalendar added a dot for each event in history, even
    // if another event with the same type existed on the same day. This caused
    // the layout to break if duplicate events were created.
    it('only shows one dot for each event type per calendar day', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                "action": "water",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            })
        }));

        // Click water button, confirm only 1 WaterEvent is displayed
        await user.click(app.getByRole("button", {name: "Water"}));
        expect(app.container.querySelectorAll('.dot-water').length).toBe(1);

        // Click water button again, confirm no additional dot is added
        await user.click(app.getByRole("button", {name: "Water"}));
        expect(app.container.querySelectorAll('.dot-water').length).toBe(1);
    });
});
