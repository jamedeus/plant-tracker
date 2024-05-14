import React, { useRef } from 'react';
import NoteModal from '../NoteModal';
import { ToastProvider } from 'src/context/ToastContext';
import { ErrorModalProvider } from 'src/context/ErrorModalContext';

const TestComponent = ({ noteText='', noteTime='', editingNote=false }) => {
    const noteModalRef = useRef(null);

    return (
        <NoteModal
            modalRef={noteModalRef}
            plantID={"0640ec3b-1bed-4b15-a078-d6e7ec66be12"}
            addNote={jest.fn()}
            noteText={noteText}
            noteTime={noteTime}
            editingNote={editingNote}
        />
    );
};

describe('Add new note', () => {
    let app, user;

    beforeEach(() => {
        // Render app + create userEvent instance to use in tests
        app = render(
            <ToastProvider>
                <ErrorModalProvider>
                    <TestComponent />
                </ErrorModalProvider>
            </ToastProvider>
        );
        user = userEvent.setup();
    });

    it('sends correct payload when note is saved', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                "action": "add_note",
                "plant": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
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
            body: expect.any(String),
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'X-CSRFToken': undefined,
            }
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
});
