import createMockContext from 'src/testUtils/createMockContext';
import bulkCreateMockContext from 'src/testUtils/bulkCreateMockContext';
import Timeline from '../Timeline';
import { ReduxProvider } from '../store';
import { PageWrapper } from 'src/index';
import { mockContext } from './mockContext';

describe('Timeline regressions', () => {
    // Original bug: If a month contained photos/notes but no events it would
    // appear at the bottom of QuickNavigation menu options, not chronological
    // order. This happened because buildNavigationOptions (store.js) assumed
    // timelineDays keys were chronological (they used to be) and did not sort
    // the finished array the way addNavigationOption (timelineSlice.js) does.
    it('renders quick navigation month names in chronological order', async () => {
        // Create mock context with events in all months except December and May
        bulkCreateMockContext(mockContext);
        createMockContext('user_accounts_enabled', true);
        createMockContext('events', {
            "water": [
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
            "fertilize": [],
            "prune": [],
            "repot": []
        });
        // Create mock context with a single photo in December
        createMockContext('photos', [
            {
                "timestamp": "2023-12-21T11:57:26+00:00",
                "image": "/media/images/IMG_5866.jpeg",
                "thumbnail": "/media/thumbnails/IMG_5866_thumb.webp",
                "preview": "/media/previews/IMG_5866_preview.webp",
                "key": 46
            },
        ]);
        // Create mock context with a single note in May
        createMockContext('notes', [
            {
                "timestamp": "2023-05-25T15:28:39+00:00",
                "text": "Fertilized with a balanced 10-10-10 fertilizer."
            },
        ]);

        // Render, get reference to to 2023 month options in QuickNavigation menu
        const app = render(
            <PageWrapper>
                <ReduxProvider>
                    <Timeline />
                </ReduxProvider>
            </PageWrapper>
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
});
