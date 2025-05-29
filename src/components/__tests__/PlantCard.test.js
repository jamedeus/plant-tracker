import PlantCard from '../PlantCard';

describe('PlantCard with water event', () => {
    let component, user;

    beforeEach(() => {
        // Render component + create userEvent instance to use in tests
        user = userEvent.setup();
        component = render(
            <PlantCard
                display_name='Test Plant'
                uuid='0640ec3b-1bed-4b15-a078-d6e7ec66be12'
                species='Calathea'
                description='Mother plant'
                pot_size={12}
                last_watered='2024-02-27T05:45:44+00:00'
                thumbnail='/media/thumbnails/photo1_thumb.webp'
            />
        );
    });

    it('shows the correct information', () => {
        expect(component.getByText('Test Plant').nodeName).toBe('H2');
        expect(component.getByText('4 days ago')).toBeInTheDocument();
        expect(component.queryByText('Calathea')).toBeInTheDocument();
        expect(component.queryByText('Mother plant')).toBeInTheDocument();
    });

    it('expands/collapses details when arrow button is clicked', async () => {
        // Confirm that hidden checkbox that controls collapse is not checked
        expect(component.container.querySelector('input').checked).toBeFalse();

        // Click button, confirm checkbox is now checked
        await user.click(component.container.querySelector('.btn-close'));
        expect(component.container.querySelector('input').checked).toBeTrue();

        // Click button again, confirm checkbox is no longer checked
        await user.click(component.container.querySelector('.btn-close'));
        expect(component.container.querySelector('input').checked).toBeFalse();
    });

    it('redirects to manage plant page when clicked', async () => {
        // Confirm card has correct href
        expect(component.getByRole('link')).toHaveAttribute(
            'href',
            '/manage/0640ec3b-1bed-4b15-a078-d6e7ec66be12'
        );
    });

    it('shows water icon and time since the plant was last watered', () => {
        // Confirm that FA droplet icon is present
        expect(component.container.querySelector('.fa-inline.text-info')).toBeInTheDocument();
        expect(component.getByText(/4 days ago/)).toBeInTheDocument();
    });
});


describe('PlantCard with no water event', () => {
    let component;

    beforeEach(() => {
        component = render(
            <PlantCard
                display_name='Test Plant'
                uuid='0640ec3b-1bed-4b15-a078-d6e7ec66be12'
                species='Calathea'
                description='Mother plant'
                pot_size={12}
                last_watered={null}
                thumbnail='/media/thumbnails/photo1_thumb.webp'
            />
        );
    });

    it('says "never watered" with no icon if plant was never watered', () => {
        // Confirm icon and relative time are not present
        expect(component.container.querySelector('.fa-inline.text-info')).toBeNull();
        expect(component.queryByText(/3 days ago/)).toBeNull();
        // Confirm "Never watered" is present
        expect(component.getByText(/Never watered/)).toBeInTheDocument();
    });
});


describe('PlantCard last watered time display', () => {
    // Helper function takes ISO timestamp, returns rendered component
    const renderWithTimestamp = (timestamp) => {
        return render(
            <PlantCard
                display_name='Test Plant'
                uuid='0640ec3b-1bed-4b15-a078-d6e7ec66be12'
                species='Calathea'
                description='Mother plant'
                pot_size={12}
                last_watered={timestamp}
                thumbnail='/media/thumbnails/photo1_thumb.webp'
            />
        );
    };

    // Takes rendered component, returns span containing icon and last_watered text
    const getLastWateredSpan = (component) => {
        return component.container.querySelector('.fa-inline.text-info').parentElement;
    };

    it('says "Today" if plant was watered during current calendar day', () => {
        // Render with timestamp 5 minutes before current time mock
        let component = renderWithTimestamp("2024-03-01T11:55:00-08:00");
        expect(getLastWateredSpan(component).textContent).toBe("Today");

        // Render with timestamp 1 minute after midnight on mocked day
        component = renderWithTimestamp("2024-03-01T00:01:00-08:00");
        expect(getLastWateredSpan(component).textContent).toBe("Today");
    });

    it('says "Yesterday" if plant was watered during previous calendar day', () => {
        // Render with timestamp 1 day and 5 minutes before current time mock
        let component = renderWithTimestamp("2024-02-29T11:55:00-08:00");
        expect(getLastWateredSpan(component).textContent).toBe("Yesterday");

        // Render with timestamp 1 minute after midnight on previous day
        component = renderWithTimestamp("2024-02-29T00:01:00-08:00");
        expect(getLastWateredSpan(component).textContent).toBe("Yesterday");
    });

    it('says number of calendar days since last watered if earlier than yesterday', () => {
        // Render with timestamp 2 day and 20 hours before current time mock
        let component = renderWithTimestamp("2024-02-27T16:00:00-08:00");
        // Should say 3 days even though less than 72 hours ago (goes by calendar day)
        // Should NOT say "last month" (confusing since its only a few days)
        expect(getLastWateredSpan(component).textContent).toBe("3 days ago");

        // Render with timestamp 3 day and 11 hours 59 minutes before current time mock
        component = renderWithTimestamp("2024-02-27T00:01:00-08:00");
        // Should still say 3 days even though over 72 hours ago
        expect(getLastWateredSpan(component).textContent).toBe("3 days ago");
    });

    it('says number of months since last watered if >30 days ago', () => {
        // Render with timestamp 31 day before current time mock
        let component = renderWithTimestamp("2024-01-30T12:00:00-08:00");
        expect(getLastWateredSpan(component).textContent).toBe("1 month ago");

        // Render with timestamp 57 days before current time mock
        component = renderWithTimestamp("2024-01-04T12:00:00-08:00");
        // Should still say 1 month ago (until actually > 2 months)
        expect(getLastWateredSpan(component).textContent).toBe("1 month ago");

        // Render with timestamp 78 days before current time mock
        component = renderWithTimestamp("2023-12-14T12:00:00-08:00");
        // Should say 2 month ago (NOT "last year") even though it is prior year
        expect(getLastWateredSpan(component).textContent).toBe("2 months ago");
    });

    it('says number of years since last watered if >365 days ago', () => {
        // Render with timestamp 360 day before current time mock
        let component = renderWithTimestamp("2023-03-07T12:00:00-08:00");
        // Should say 11 months ago (not quite a year yet)
        expect(getLastWateredSpan(component).textContent).toBe("11 months ago");

        // Render with timestamp 366 days before current time mock
        component = renderWithTimestamp("2023-03-01T12:00:00-08:00");
        expect(getLastWateredSpan(component).textContent).toBe("1 year ago");

        // Render with timestamp 750 days before current time mock
        component = renderWithTimestamp("2022-02-10T12:00:00-08:00");
        expect(getLastWateredSpan(component).textContent).toBe("2 years ago");
    });
});
