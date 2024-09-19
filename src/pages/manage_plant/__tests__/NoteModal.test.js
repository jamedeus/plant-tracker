import React, { useRef, useState } from 'react';
import createMockContext from 'src/testUtils/createMockContext';
import NoteModal from '../NoteModal';
import { ToastProvider } from 'src/context/ToastContext';
import { ErrorModalProvider } from 'src/context/ErrorModalContext';
import { postHeaders } from 'src/testUtils/headers';

const TestComponent = () => {
    const modalRef = useRef(null);
    const [notes, setNotes] = useState([
        {text: 'this is an existing note', timestamp: '2024-02-13T12:00:00'},
        {text: 'another existing note', timestamp: '2024-02-12T12:00:00'}
    ]);

    return (
        <>
            <NoteModal
                plantID={"0640ec3b-1bed-4b15-a078-d6e7ec66be12"}
                notes={notes}
                setNotes={setNotes}
                ref={modalRef}
            />
            <button onClick={() => modalRef.current.open()}>
                Add New Note
            </button>
            <button onClick={() => modalRef.current.open(notes[0])}>
                Edit Existing Note
            </button>
        </>
    );
};

describe('Add new note', () => {
    let app, user;

    beforeAll(() => {
        // Create mock state object
        createMockContext('notes', []);
    });

    beforeEach(async () => {
        // Render app + create userEvent instance to use in tests
        user = userEvent.setup();
        app = render(
            <ToastProvider>
                <ErrorModalProvider>
                    <TestComponent />
                </ErrorModalProvider>
            </ToastProvider>
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
                "action": "add_note",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                "timestamp": "2024-02-13T12:00:00+00:00",
                "note_text": "Some leaves turning yellow, probably watering too often"
            })
        }));

        // Simulate user entering note text and clicking save
        await user.type(
            app.container.querySelector('.textarea'),
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
                "error": "failed to save note"
            })
        }));

        // Confirm arbitrary error does not appear on page
        expect(app.queryByText(/failed to save note/)).toBeNull();

        // Simulate user typing note and clicking save
        await user.type(
            app.container.querySelector('.textarea'),
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
                "error": "note with same timestamp already exists"
            })
        }));

        // Simulate user typing note and clicking save
        await user.type(
            app.container.querySelector('.textarea'),
            'Some leaves turning yellow, probably watering too often'
        );
        await user.click(app.getByText('Save'));
    });

    it('field and character count turn red if character limit exceeded', async() => {
        // Confirm field and character count are not red
        expect(
            app.container.querySelector('.textarea').classList
        ).not.toContain('textarea-error');
        expect(app.getByText('0 / 500').classList).not.toContain('text-error');

        // Simulate user typing 505 characters
        await user.type(
            app.container.querySelector('.textarea'),
            'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam tristique, nulla vel feugiat venenatis, eros quam pellentesque ipsum, ut venenatis libero ex nec lectus. Vestibulum maximus ullamcorper placerat. Sed porttitor eleifend suscipit. In cursus tempus mi, nec condimentum quam porttitor et. Cras elementum maximus neque eu efficitur. Pellentesque sit amet ante finibus, egestas urna ut, iaculis justo. Phasellus eget nibh imperdiet, tincidunt sapien a, blandit ex. Fusce sed euismod nisi. Phasellus'
        );

        // Confirm field and character count turned red
        expect(
            app.container.querySelector('.textarea').classList
        ).toContain('textarea-error');
        expect(app.getByText('505 / 500').classList).toContain('text-error');
    });
});


describe('Edit existing note', () => {
    let app, user;

    beforeAll(() => {
        // Create mock state object
        createMockContext('notes', []);
    });

    beforeEach(async () => {
        // Render app + create userEvent instance to use in tests
        user = userEvent.setup();
        app = render(
            <ToastProvider>
                <ErrorModalProvider>
                    <TestComponent />
                </ErrorModalProvider>
            </ToastProvider>
        );

        // Open modal in edit mode
        await user.click(app.getByText('Edit Existing Note'));
    });

    it('sends correct payload when note is deleted', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                "deleted": "note",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            })
        }));

        // Simulate user clicking delete button
        await user.click(app.getByText('Delete'));

        // Confirm correct data posted to /add_plant_note endpoint
        expect(fetch).toHaveBeenCalledWith('/delete_plant_note', {
            method: 'POST',
            body: JSON.stringify({
                plant_id: '0640ec3b-1bed-4b15-a078-d6e7ec66be12',
                timestamp: '2024-02-13T12:00:00'
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
                "action": "edit_note",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                "timestamp": "2024-02-13T12:00:00+00:00",
                "note_text": "this is an existing note some more details"
            })
        }));

        // Simulate user adding more note text and clicking save
        await user.type(
            app.container.querySelector('.textarea'),
            ' some more details'
        );
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
                "error": "failed to delete note"
            })
        }));

        // Confirm arbitrary error does not appear on page
        expect(app.queryByText(/failed to delete note/)).toBeNull();

        // Simulate user clicking delete
        await user.click(app.getByText('Delete'));

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
                "error": "failed to edit note"
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
