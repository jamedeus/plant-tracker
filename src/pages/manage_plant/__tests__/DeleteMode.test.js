import mockCurrentURL from 'src/testUtils/mockCurrentURL';
import mockFetchResponse from 'src/testUtils/mockFetchResponse';
import { postHeaders } from 'src/testUtils/headers';
import { ErrorModal } from 'src/components/ErrorModal';
import App from '../App';
import { mockContext } from './mockContext';
import { fireEvent } from '@testing-library/react';

describe('Delete mode', () => {
    let app, user;

    beforeAll(() => {
        // Simulate SINGLE_USER_MODE disabled on backend
        globalThis.USER_ACCOUNTS_ENABLED = true;
    });

    beforeEach(() => {
        // Allow fast forwarding (must hold delete button to confirm)
        jest.useFakeTimers({ doNotFake: ['Date'] });

        // Mock window.location (querystring parsed when page loads)
        mockCurrentURL('https://plants.lan/manage/e1393cfd-0133-443a-97b1-06bb5bd3fcca');

        // Render app + create userEvent instance to use in tests
        user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        app = render(
            <>
                <App initialState={{ ...mockContext, events: {
                    ...mockContext.events,
                    prune: ["2024-01-01T15:45:44+00:00"],
                    repot: ["2024-01-01T15:45:44+00:00"],
                } }} />
                <ErrorModal />
            </>
        );
    });

    // Clean up pending timers after each test
    afterEach(() => {
        act(() => jest.runAllTimers());
        jest.useRealTimers();
    });

    it('shows DeleteModeFooter when option clicked', async () => {
        // Confirm footer is hidden
        expect(app.getByTestId("floating-footer").classList).toContain("floating-footer-hidden");
        // Click dropdown option, confirm footer appeared
        await user.click(app.getByText('Edit timeline'));
        expect(app.getByTestId("floating-footer").classList).toContain("floating-footer-visible");
        // Click cancel button, confirm footer disappeared
        await user.click(app.getByRole('button', {name: 'Cancel'}));
        expect(app.getByTestId("floating-footer").classList).toContain("floating-footer-hidden");
    });

    it('closes DeleteModeFooter when user swipes down', async () => {
        // Click dropdown option, confirm footer appeared
        await user.click(app.getByText('Edit timeline'));
        expect(app.getByTestId("floating-footer").classList).toContain("floating-footer-visible");

        // Swipe down on footer, confirm footer disappeared
        const footer = app.getByTestId("floating-footer");
        fireEvent.touchStart(footer, {touches: [{ clientX: 50, clientY: 10 }]});
        fireEvent.touchMove(footer, {touches: [{ clientX:  50, clientY: 100 }]});
        fireEvent.touchEnd(footer, {changedTouches: [{ clientX:  50, clientY: 100 }]});
        expect(app.getByTestId("floating-footer").classList).toContain("floating-footer-hidden");
    });

    it('updates instructions text to show number of selected items', async () => {
        // Enter delete mode
        await user.click(app.getByText('Edit timeline'));

        // Confirm initial instructions text is visible
        await act(async () => await jest.advanceTimersByTimeAsync(150));
        expect(app.queryByText('Select timeline items to delete')).not.toBeNull();

        // Select water event, confirm text changed to 1 item selected
        await user.click(
            within(app.getByTestId("2024-03-01-events")).getByText("Watered")
        );
        await act(async () => await jest.advanceTimersByTimeAsync(150));
        expect(app.queryByText('1 item selected')).not.toBeNull();
        expect(app.queryByText('Select timeline items to delete')).toBeNull();

        // Select photo, confirm text changed to 2 items selected
        await user.click(app.getByTitle('02:52 AM - March 22, 2024'));
        expect(app.queryByText('2 items selected')).not.toBeNull();

        // Select note, confirm text changed to 3 items selected
        await user.click(app.getByText('Fertilized with dilute 10-15-10 liquid fertilizer'));
        expect(app.queryByText('3 items selected')).not.toBeNull();

        // Unselect event, confirm text changed back to 2 items selected
        await user.click(
            within(app.getByTestId("2024-03-01-events")).getByText("Watered")
        );
        await act(async () => await jest.advanceTimersByTimeAsync(150));
        expect(app.queryByText('2 items selected')).not.toBeNull();

        // Unselect photo, confirm text changed back to 1 item selected
        await user.click(app.getByTitle('02:52 AM - March 22, 2024'));
        await act(async () => await jest.advanceTimersByTimeAsync(150));
        expect(app.queryByText('1 item selected')).not.toBeNull();

        // Unselect note, confirm text changed back to instructions
        await user.click(app.getByText('Fertilized with dilute 10-15-10 liquid fertilizer'));
        await act(async () => await jest.advanceTimersByTimeAsync(150));
        expect(app.queryByText('Select timeline items to delete')).not.toBeNull();
        expect(app.queryByText('1 item selected')).toBeNull();
    });

    it('sends correct payload when events are deleted', async () => {
        // Mock fetch function to return expected response
        mockFetchResponse({
            deleted: {
                water: ["2024-03-01T15:45:44+00:00"],
                fertilize: ["2024-03-01T15:45:44+00:00"],
                prune: ["2024-01-01T15:45:44+00:00"],
                repot: ["2024-01-01T15:45:44+00:00"]
            },
            failed: []
        });

        // Enter delete mode
        await user.click(app.getByText('Edit timeline'));

        // Select newest water event
        await user.click(
            within(app.getByTestId("2024-03-01-events")).getByText("Watered")
        );

        // Click second newest water event twice (un-select), should not be in payload
        await user.click(
            within(app.getByTestId("2024-02-29-events")).getByText("Watered")
        );
        await user.click(
            within(app.getByTestId("2024-02-29-events")).getByText("Watered")
        );

        // Select newest fertilize, prune, and repot events
        await user.click(
            within(app.getByTestId("2024-03-01-events")).getByText("Fertilized")
        );
        await user.click(
            within(app.getByTestId("2024-01-01-events")).getByText("Pruned")
        );
        await user.click(
            within(app.getByTestId("2024-01-01-events")).getByText("Repoted")
        );

        // Simulate user holding delete button for 1.5 seconds
        const button = app.getByText('Delete');
        fireEvent.mouseDown(button);
        await act(async () => await jest.advanceTimersByTimeAsync(1500));
        fireEvent.mouseUp(button);

        // Confirm correct data posted to /bulk_delete_plant_events endpoint
        expect(global.fetch).toHaveBeenCalledWith('/bulk_delete_plant_events', {
            method: 'POST',
            body: JSON.stringify({
                plant_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                events: {
                    water: ["2024-03-01T15:45:44+00:00"],
                    fertilize: ["2024-03-01T15:45:44+00:00"],
                    prune: ["2024-01-01T15:45:44+00:00"],
                    repot: ["2024-01-01T15:45:44+00:00"]
                }
            }),
            headers: postHeaders
        });
    });

    it('sends correct payload when notes are deleted', async () => {
        // Mock fetch function to return expected response
        mockFetchResponse({
            deleted: ["2024-03-01T15:45:44+00:00"],
            failed: []
        });

        // Enter delete mode
        await user.click(app.getByText('Edit timeline'));

        // Click note twice (un-select), should not be in payload
        await user.click(app.getByText('One of the older leaves is starting to turn yellow'));
        await user.click(app.getByText('One of the older leaves is starting to turn yellow'));

        // Click another note
        await user.click(app.getByText('Fertilized with dilute 10-15-10 liquid fertilizer'));

        // Simulate user holding delete button for 1.5 seconds
        const button = app.getByText('Delete');
        fireEvent.mouseDown(button);
        await act(async () => await jest.advanceTimersByTimeAsync(1500));
        fireEvent.mouseUp(button);

        // Confirm correct data posted to /delete_plant_notes endpoint
        expect(global.fetch).toHaveBeenCalledWith('/delete_plant_notes', {
            method: 'POST',
            body: JSON.stringify({
                plant_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                timestamps: ["2024-03-01T15:45:44+00:00"]
            }),
            headers: postHeaders
        });
    });

    it('sends correct payload when photos are deleted', async () => {
        // Mock fetch function to return expected response
        mockFetchResponse({
            deleted: [2],
            failed: []
        });

        // Enter delete mode
        await user.click(app.getByText('Edit timeline'));

        // Click photo 3 twice (un-select), should not be in payload
        await user.click(app.getByTitle('02:52 AM - March 23, 2024'));
        await user.click(app.getByTitle('02:52 AM - March 23, 2024'));

        // Click photo 2
        await user.click(app.getByTitle('02:52 AM - March 22, 2024'));

        // Simulate user holding delete button for 1.5 seconds
        const button = app.getByText('Delete');
        fireEvent.mouseDown(button);
        await act(async () => await jest.advanceTimersByTimeAsync(1500));
        fireEvent.mouseUp(button);

        // Confirm correct data posted to /delete_plant_photos endpoint
        expect(global.fetch).toHaveBeenCalledWith('/delete_plant_photos', {
            method: 'POST',
            body: JSON.stringify({
                plant_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                delete_photos: [2]
            }),
            headers: postHeaders
        });
    });

    it('sends correct payloads when events, photos, and notes are deleted', async () => {
        // Mock fetch function to return all expected responses
        global.fetch = jest.fn()
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    deleted: {
                        water: ["2024-03-01T15:45:44+00:00"],
                        fertilize: [],
                        prune: [],
                        repot: []
                    },
                    failed: []
                })
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({
                    deleted: [2],
                    failed: []
                })
            }))
            .mockImplementationOnce(() => Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({
                    deleted: ["2024-03-01T15:45:44+00:00"],
                    failed: []
                })
            }));

        // Enter delete mode
        await user.click(app.getByText('Edit timeline'));

        // Select one water event, one photo, and one note, hold delete button
        await user.click(
            within(app.getByTestId("2024-03-01-events")).getByText("Watered")
        );
        await user.click(app.getByTitle('02:52 AM - March 22, 2024'));
        await user.click(app.getByText('Fertilized with dilute 10-15-10 liquid fertilizer'));
        const button = app.getByText('Delete');
        fireEvent.mouseDown(button);
        await act(async () => await jest.advanceTimersByTimeAsync(1500));
        fireEvent.mouseUp(button);

        // Confirm correct data posted to all endpoints
        expect(global.fetch).toHaveBeenCalledTimes(3);
        expect(global.fetch).toHaveBeenNthCalledWith(1, '/bulk_delete_plant_events', {
            method: 'POST',
            body: JSON.stringify({
                plant_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                events: {
                    water: ["2024-03-01T15:45:44+00:00"],
                    fertilize: [],
                    prune: [],
                    repot: []
                }
            }),
            headers: postHeaders
        });
        expect(global.fetch).toHaveBeenNthCalledWith(2, '/delete_plant_photos', {
            method: 'POST',
            body: JSON.stringify({
                plant_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                delete_photos: [2]
            }),
            headers: postHeaders
        });
        expect(global.fetch).toHaveBeenNthCalledWith(3, '/delete_plant_notes', {
            method: 'POST',
            body: JSON.stringify({
                plant_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                timestamps: ["2024-03-01T15:45:44+00:00"]
            }),
            headers: postHeaders
        });
    });

    it('clears selection when cancel button clicked', async () => {
        // Enter delete mode, select newest water event, photo, and note
        await user.click(app.getByText('Edit timeline'));
        await user.click(
            within(app.getByTestId("2024-03-01-events")).getByText("Watered")
        );
        await user.click(app.getByTitle('02:52 AM - March 22, 2024'));
        await user.click(app.getByText('Fertilized with dilute 10-15-10 liquid fertilizer'));

        // Click cancel button (hide footer)
        await user.click(app.getByRole('button', {name: 'Cancel'}));

        // Start selecting again, select second newest water event
        await user.click(app.getByText('Edit timeline'));
        await user.click(
            within(app.getByTestId("2024-02-29-events")).getByText("Watered")
        );

        // Mock fetch function to return expected response
        mockFetchResponse({
            deleted: {
                water: ["2024-02-29T10:20:15+00:00"],
                fertilize: [],
                prune: [],
                repot: []
            },
            failed: []
        });

        // Hold delete button, confirm only second newest event (selected in
        // current session) posted (confirms first session selection was cleared)
        const button = app.getByText('Delete');
        fireEvent.mouseDown(button);
        await act(async () => await jest.advanceTimersByTimeAsync(1500));
        fireEvent.mouseUp(button);
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch).toHaveBeenCalledWith('/bulk_delete_plant_events', {
            method: 'POST',
            body: JSON.stringify({
                plant_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                events: {
                    water: ["2024-02-29T10:20:15+00:00"],
                    fertilize: [],
                    prune: [],
                    repot: []
                }
            }),
            headers: postHeaders
        });
    });

    it('shows error modal if error received while deleting event', async () => {
        // Mock fetch function to return arbitrary error
        mockFetchResponse({error: "failed to delete event"}, 400);

        // Confirm error modal is not rendered
        expect(app.queryByTestId('error-modal-body')).toBeNull();

        // Simulate user deleting newest water event
        await user.click(app.getByText('Edit timeline'));
        await user.click(
            within(app.getByTestId("2024-03-01-events")).getByText("Watered")
        );
        const button = app.getByText('Delete');
        fireEvent.mouseDown(button);
        await act(async () => await jest.advanceTimersByTimeAsync(1500));
        fireEvent.mouseUp(button);
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Confirm modal appeared with arbitrary error text
        expect(app.getByTestId('error-modal-body')).toBeInTheDocument();
        expect(app.getByTestId('error-modal-body')).toHaveTextContent(
            'failed to delete event'
        );
    });

    it('shows error modal if error received while deleting photo', async () => {
        // Mock fetch function to return arbitrary error
        mockFetchResponse({error: "failed to delete photos"}, 400);

        // Confirm error modal is not rendered
        expect(app.queryByTestId('error-modal-body')).toBeNull();

        // Simulate user deleting a photo
        await user.click(app.getByText('Edit timeline'));
        await user.click(app.getByTitle('02:52 AM - March 22, 2024'));
        const button = app.getByText('Delete');
        fireEvent.mouseDown(button);
        await act(async () => await jest.advanceTimersByTimeAsync(1500));
        fireEvent.mouseUp(button);
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Confirm modal appeared with arbitrary error text
        expect(app.getByTestId('error-modal-body')).toBeInTheDocument();
        expect(app.getByTestId('error-modal-body')).toHaveTextContent(
            'failed to delete photos'
        );
    });

    it('shows error modal if error received while deleting note', async () => {
        // Mock fetch function to return arbitrary error
        mockFetchResponse({error: "failed to delete note"}, 400);

        // Confirm error modal is not rendered
        expect(app.queryByTestId('error-modal-body')).toBeNull();

        // Simulate user deleting a note
        await user.click(app.getByText('Edit timeline'));
        await user.click(app.getByText('Fertilized with dilute 10-15-10 liquid fertilizer'));
        const button = app.getByText('Delete');
        fireEvent.mouseDown(button);
        await act(async () => await jest.advanceTimersByTimeAsync(1500));
        fireEvent.mouseUp(button);
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Confirm modal appeared with arbitrary error text
        expect(app.getByTestId('error-modal-body')).toBeInTheDocument();
        expect(app.getByTestId('error-modal-body')).toHaveTextContent(
            'failed to delete note'
        );
    });
});
