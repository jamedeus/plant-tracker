import mockCurrentURL from 'src/testUtils/mockCurrentURL';
import Timeline from '../Timeline';
import { ReduxProvider } from '../store';
import DeleteModeFooter from '../DeleteModeFooter';
import { ErrorModal } from 'src/components/ErrorModal';
import { mockContext, mockContextNoEvents } from './mockContext';

describe('Timeline regressions', () => {
    beforeEach(() => {
        // Mock window.location (querystring parsed when page loads)
        mockCurrentURL('https://plants.lan/manage/e1393cfd-0133-443a-97b1-06bb5bd3fcca');
    });

    // Switch back to real timers after each test
    afterEach(() => {
        jest.useRealTimers();
    });

    // Original bug: If a month contained photos/notes but no events it would
    // appear at the bottom of QuickNavigation menu options, not chronological
    // order. This happened because buildNavigationOptions (store.js) assumed
    // timelineDays keys were chronological (they used to be) and did not sort
    // the finished array the way addNavigationOption (timelineSlice.js) does.
    it('renders quick navigation month names in chronological order', async () => {
        // Create mock context with events in all months except December and May,
        // a single photo in December, and a single note in May
        const initialState = {
            ...mockContext,
            events: {
                water: [
                    "2023-11-11T19:04:20+00:00",
                    "2023-10-26T02:49:18+00:00",
                    "2023-09-17T22:21:41+00:00",
                    "2023-08-17T22:21:41+00:00",
                    "2023-07-11T19:04:20+00:00",
                    "2023-06-26T02:49:18+00:00",
                    "2023-04-17T22:21:41+00:00",
                    "2023-03-17T22:21:41+00:00",
                    "2023-02-11T19:04:20+00:00",
                    "2023-01-26T02:49:18+00:00",
                ],
                fertilize: [],
                prune: [],
                repot: []
            },
            photos: {
                1: {
                    timestamp: "2023-12-21T11:57:26+00:00",
                    photo: "/media/images/IMG_5866.jpeg",
                    thumbnail: "/media/thumbnails/IMG_5866_thumb.webp",
                    preview: "/media/previews/IMG_5866_preview.webp",
                    key: 46
                },
            },
            notes: {
                "2023-05-25T15:28:39+00:00": "Fertilized with a balanced 10-10-10 fertilizer."
            }
        };
        globalThis.USER_ACCOUNTS_ENABLED = true;

        // Render, get reference to to 2023 month options in QuickNavigation menu
        const app = render(
            <>
                <ReduxProvider initialState={initialState}>
                    <Timeline />
                </ReduxProvider>
                <ErrorModal />
            </>
        );
        const history = app.getByText(/History/).closest('.dropdown');
        const year = within(history).getByText(/2023/).closest('details');
        const months = year.querySelector('ul');

        // Confirm month names are in reverse chronological order
        expect(months.children[0].textContent).toBe('December');
        expect(months.children[1].textContent).toBe('November');
        expect(months.children[2].textContent).toBe('October');
        expect(months.children[3].textContent).toBe('September');
        expect(months.children[4].textContent).toBe('August');
        expect(months.children[5].textContent).toBe('July');
        expect(months.children[6].textContent).toBe('June');
        expect(months.children[7].textContent).toBe('May');
        expect(months.children[8].textContent).toBe('April');
        expect(months.children[9].textContent).toBe('March');
        expect(months.children[10].textContent).toBe('February');
        expect(months.children[11].textContent).toBe('January');
    });

    // Original bug: If a plant had 2 or more DivisionEvents on the same day
    // only the children from the most-recent DivisionEvent would be shown. This
    // was because buildTimelineDays overwrote the existing dividedInto value
    // instead of concatenating the new array.
    it('shows child plants from multiple DivisionEvents on the same day', async () => {
        // Render with mock context with multiple DivisionEvents on the same day,
        // confirm "Divided into" text only appears once
        const app = render(
            <>
                <ReduxProvider initialState={{
                    ...mockContext,
                    division_events: {
                        "2024-02-11T04:19:23+00:00": [
                            {
                                name: "Child plant 1",
                                uuid: "cc3fcb4f-120a-4577-ac87-ac6b5bea8968"
                            },
                        ],
                        "2024-02-11T04:20:23+00:00": [
                            {
                                name: "Child plant 2",
                                uuid: "cc3fcb4f-120a-4577-ac87-ac6b5bea8969"
                            },
                        ]
                    }
                }}>
                    <Timeline />
                </ReduxProvider>
                <ErrorModal />
            </>
        );
        expect(app.getAllByText('Divided into:').length).toBe(1);

        // Confirm both child plants were rendered (not just second)
        expect(app.getByRole('link', {name: 'Child plant 1'})).not.toBeNull();
        expect(app.getByRole('link', {name: 'Child plant 2'})).not.toBeNull();
    });

    // Original bug: The timelineSlice removeDateKeyIfEmpty helper function only
    // checked if events, photos, or notes existed before removing a dateKey. If
    // a dividedFrom marker still existed it would disappear when the last event
    // was deleted from the same day (until the page was reloaded).
    it('does not remove timeline day when a dividedFrom marker still exists', async () => {
        // Allow fast forwarding (must hold delete button to confirm)
        jest.useFakeTimers({ doNotFake: ['Date'] });

        // Render with mock context with a single divided_from marker and repot
        // event on the same day (simulates child plant just registered)
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        const app = render(
            <>
                <ReduxProvider initialState={{
                    ...mockContextNoEvents,
                    events: {
                        ...mockContextNoEvents.events,
                        repot: ["2024-02-11T04:19:23+00:00"]
                    },
                    divided_from: {
                        name: "Parent plant",
                        uuid: "cc3fcb4f-120a-4577-ac87-ac6b5bea8968",
                        timestamp: "2024-02-11T04:19:23+00:00"
                    }
                }}>
                    <Timeline />
                    <DeleteModeFooter />
                </ReduxProvider>
                <ErrorModal />
            </>
        );

        // Confirm "Divided from" marker and repot event are in timeline
        expect(app.getByText('Divided from')).toBeInTheDocument();
        expect(app.getByTitle('2024-02-11T04:19:23+00:00')).toBeInTheDocument();
        expect(app.getByTitle('2024-02-11T04:19:23+00:00')).toHaveTextContent('Repoted');

        // Mock fetch to return response when repot event is deleted
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                deleted: {
                    water: [],
                    fertilize: [],
                    prune: [],
                    repot: ["2024-02-11T04:19:23+00:00"]
                },
                failed: []
            })
        }));

        // Enter delete mode, select repot event
        await user.click(app.getByText('Delete mode'));
        await user.click(within(app.getByTestId("2024-02-10-events")).getByText("Repoted"));

        // Hold delete button for 1.5 seconds, confirm repot event is deleted
        const button = app.getByText('Delete');
        fireEvent.mouseDown(button);
        await act(async () => await jest.advanceTimersByTimeAsync(1500));
        fireEvent.mouseUp(button);
        expect(global.fetch).toHaveBeenCalled();

        // Confirm repot event was deleted, "Divided from" marker still exists
        expect(app.getByText('Divided from')).toBeInTheDocument();
        expect(app.queryByTitle('Repoted')).toBeNull();
        expect(app.queryByTitle('2024-02-11T04:19:23+00:00')).toBeNull();
    });

    // Original bug: The timelineSlice removeDateKeyIfEmpty helper function only
    // checked if events, photos, or notes existed before removing a dateKey. If
    // DivisionEvent(s) still existed it would disappear when the last event was
    // deleted from the same day (until the page was reloaded).
    it('does not remove timeline day when a DivisionEvent still exists', async () => {
        // Allow fast forwarding (must hold delete button to confirm)
        jest.useFakeTimers({ doNotFake: ['Date'] });

        // Render with mock context with 2 DivisionEvents and a repot event on
        // the same day (common if roots were split while plant was repotted)
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        const app = render(
            <>
                <ReduxProvider initialState={{
                    ...mockContextNoEvents,
                    events: {
                        ...mockContextNoEvents.events,
                        repot: ["2024-02-11T04:19:23+00:00"]
                    },
                    division_events: {
                        "2024-02-11T04:19:23+00:00": [
                            {name: "Child plant 1", uuid: "cc3fcb4f-120a-4577-ac87-ac6b5bea8969"},
                            {name: "Child plant 2", uuid: "cc3fcb4f-120a-4577-ac87-ac6b5bea8968"}
                        ]
                    }
                }}>
                    <Timeline />
                    <DeleteModeFooter />
                </ReduxProvider>
                <ErrorModal />
            </>
        );

        // Confirm "Divided into" marker and repot event are in timeline
        expect(app.getByText(/Divided into/)).toBeInTheDocument();
        expect(app.getByTitle('2024-02-11T04:19:23+00:00')).toBeInTheDocument();
        expect(app.getByTitle('2024-02-11T04:19:23+00:00')).toHaveTextContent('Repoted');

        // Mock fetch to return response when repot event is deleted
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                deleted: {
                    water: [],
                    fertilize: [],
                    prune: [],
                    repot: ["2024-02-11T04:19:23+00:00"]
                },
                failed: []
            })
        }));

        // Enter delete mode, select repot event
        await user.click(app.getByText('Delete mode'));
        await user.click(within(app.getByTestId("2024-02-10-events")).getByText("Repoted"));

        // Hold delete button for 1.5 seconds, confirm repot event is deleted
        const button = app.getByText('Delete');
        fireEvent.mouseDown(button);
        await act(async () => await jest.advanceTimersByTimeAsync(1500));
        fireEvent.mouseUp(button);
        expect(global.fetch).toHaveBeenCalled();

        // Confirm repot event was deleted, "Divided into" marker still exists
        expect(app.getByText(/Divided into/)).toBeInTheDocument();
        expect(app.queryByTitle('Repoted')).toBeNull();
        expect(app.queryByTitle('2024-02-11T04:19:23+00:00')).toBeNull();
    });
});
