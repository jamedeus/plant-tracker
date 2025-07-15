import React from 'react';
import { fireEvent } from '@testing-library/react';
import createMockContext from 'src/testUtils/createMockContext';
import bulkCreateMockContext from 'src/testUtils/bulkCreateMockContext';
import NoteModal, { openNoteModal } from '../NoteModal';
import { ReduxProvider } from '../store';
import { PageWrapper } from 'src/index';
import { postHeaders } from 'src/testUtils/headers';
import { mockContext } from './mockContext';

const mockNotes = {
    '2024-02-13T12:00:00': 'this is an existing note',
    '2024-02-12T12:00:00': 'another existing note'
};

const TestComponent = () => {
    return (
        <ReduxProvider>
            <NoteModal />
            <button onClick={() => openNoteModal()}>
                Add New Note
            </button>
            <button onClick={() => openNoteModal({
                timestamp: Object.keys(mockNotes)[0],
                text: Object.values(mockNotes)[0]
            })}>
                Edit Existing Note
            </button>
        </ReduxProvider>
    );
};

describe('Add new note', () => {
    let app, user;

    beforeAll(() => {
        // Create mock state objects
        bulkCreateMockContext(mockContext);
        // Override notes state with mock containing more notes
        createMockContext('notes', mockNotes);
    });

    beforeEach(async () => {
        // Render app + create userEvent instance to use in tests
        user = userEvent.setup();
        app = render(
            <PageWrapper>
                <TestComponent />
            </PageWrapper>
        );

        // Open modal in new note mode
        await user.click(app.getByText('Add New Note'));
    });

    it('sends correct payload when note is saved', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                action: "add_note",
                plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                timestamp: "2024-02-13T12:00:00+00:00",
                note_text: "Some leaves turning yellow, probably watering too often"
            })
        }));

        // Simulate user entering note text and clicking save
        await user.type(
            app.getByRole('textbox'),
            'Some leaves turning yellow, probably watering too often'
        );
        await user.click(app.getByText('Save'));

        // Confirm correct data posted to /add_plant_note endpoint
        expect(fetch).toHaveBeenCalledWith('/add_plant_note', {
            method: 'POST',
            body: JSON.stringify({
                plant_id: '0640ec3b-1bed-4b15-a078-d6e7ec66be12',
                timestamp: '2024-03-01T20:00:00.000Z',
                note_text: 'Some leaves turning yellow, probably watering too often'
            }),
            headers: postHeaders
        });
    });

    it('shows error in modal when API call fails', async () => {
        // Mock fetch function to return arbitrary error message
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({
                error: "failed to save note"
            })
        }));

        // Confirm arbitrary error does not appear on page
        expect(app.queryByText(/failed to save note/)).toBeNull();

        // Simulate user typing note and clicking save
        await user.type(
            app.getByRole('textbox'),
            'Some leaves turning yellow, probably watering too often'
        );
        await user.click(app.getByText('Save'));

        // Confirm modal appeared with arbitrary error text
        expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
        expect(app.queryByText(/failed to save note/)).not.toBeNull();
    });

    it('shows error toast if duplicate note error received', async() => {
        // Mock fetch function to return error response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 409,
            json: () => Promise.resolve({
                error: "note with same timestamp already exists"
            })
        }));

        // Simulate user typing note and clicking save
        await user.type(
            app.getByRole('textbox'),
            'Some leaves turning yellow, probably watering too often'
        );
        await user.click(app.getByText('Save'));
    });

    it('field and character count turn red if character limit exceeded', async() => {
        // Confirm field and character count are not red
        expect(app.getByRole('textbox').classList).not.toContain('textarea-error');
        expect(app.getByText('0 / 500').classList).not.toContain('text-error');

        // Simulate user typing 505 characters
        await user.type(
            app.getByRole('textbox'),
            'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam tristique, nulla vel feugiat venenatis, eros quam pellentesque ipsum, ut venenatis libero ex nec lectus. Vestibulum maximus ullamcorper placerat. Sed porttitor eleifend suscipit. In cursus tempus mi, nec condimentum quam porttitor et. Cras elementum maximus neque eu efficitur. Pellentesque sit amet ante finibus, egestas urna ut, iaculis justo. Phasellus eget nibh imperdiet, tincidunt sapien a, blandit ex. Fusce sed euismod nisi. Phasellus'
        );

        // Confirm field and character count turned red
        expect(app.getByRole('textbox').classList).toContain('textarea-error');
        expect(app.getByText('505 / 500').classList).toContain('text-error');
    });
});


describe('Edit existing note', () => {
    let app, user;

    beforeAll(() => {
        // Create mock state objects
        bulkCreateMockContext(mockContext);
        // Override notes state with mock containing more notes
        createMockContext('notes', mockNotes);
    });

    beforeEach(async () => {
        // Allow fast forwarding (must hold delete note button to confirm)
        jest.useFakeTimers({ doNotFake: ['Date'] });

        // Render app + create userEvent instance to use in tests
        user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        app = render(
            <PageWrapper>
                <TestComponent />
            </PageWrapper>
        );

        // Open modal in edit mode
        await user.click(app.getByText('Edit Existing Note'));
    });

    // Clean up pending timers after each test
    afterEach(() => {
        act(() => jest.runAllTimers());
        jest.useRealTimers();
    });

    it('sends correct payload when note is deleted', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                deleted: ['2024-02-13T12:00:00'],
                failed: [],
                plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            })
        }));

        // Simulate user holding delete button for 1.5 seconds
        const button = app.getByText('Delete');
        fireEvent.mouseDown(button);
        await act(async () => await jest.advanceTimersByTimeAsync(1500));
        fireEvent.mouseUp(button);

        // Confirm correct data posted to /delete_plant_notes endpoint
        expect(fetch).toHaveBeenCalledWith('/delete_plant_notes', {
            method: 'POST',
            body: JSON.stringify({
                plant_id: '0640ec3b-1bed-4b15-a078-d6e7ec66be12',
                timestamps: ['2024-02-13T12:00:00']
            }),
            headers: postHeaders
        });
    });

    it('sends correct payload when note is edited', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                action: "edit_note",
                plant: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                timestamp: "2024-02-13T12:00:00+00:00",
                note_text: "this is an existing note some more details"
            })
        }));

        // Simulate user adding more note text and clicking save
        await user.type(app.getByRole('textbox'), ' some more details');
        await user.click(app.getByText('Save'));

        // Confirm correct data posted to /add_plant_note endpoint
        expect(fetch).toHaveBeenCalledWith('/edit_plant_note', {
            method: 'POST',
            body: JSON.stringify({
                plant_id: '0640ec3b-1bed-4b15-a078-d6e7ec66be12',
                timestamp: '2024-02-13T12:00:00',
                note_text: 'this is an existing note some more details'
            }),
            headers: postHeaders
        });
    });

    it('shows error in modal when delete API call fails', async () => {
        // Mock fetch function to return arbitrary error message
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({
                error: "failed to delete note"
            })
        }));

        // Confirm arbitrary error does not appear on page
        expect(app.queryByText(/failed to delete note/)).toBeNull();

        // Simulate user holding delete button for 1.5 seconds
        const button = app.getByText('Delete');
        fireEvent.mouseDown(button);
        await act(async () => await jest.advanceTimersByTimeAsync(1500));
        fireEvent.mouseUp(button);

        // Confirm modal appeared with arbitrary error text
        expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
        expect(app.queryByText(/failed to delete note/)).not.toBeNull();
    });

    it('shows error in modal when edit API call fails', async () => {
        // Mock fetch function to return arbitrary error message
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({
                error: "failed to edit note"
            })
        }));

        // Confirm arbitrary error does not appear on page
        expect(app.queryByText(/failed to edit note/)).toBeNull();

        // Simulate user clicking delete
        await user.click(app.getByText('Save'));

        // Confirm modal appeared with arbitrary error text
        expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
        expect(app.queryByText(/failed to edit note/)).not.toBeNull();
    });
});
