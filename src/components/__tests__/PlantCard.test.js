import PlantCard from '../PlantCard';

describe('PlantCard with water event', () => {
    let component, user;

    beforeEach(() => {
        // Render component + create userEvent instance to use in tests
        component = render(
            <PlantCard
                name={"Test Plant"}
                uuid={"0640ec3b-1bed-4b15-a078-d6e7ec66be12"}
                species={"Calathea"}
                description={"Mother plant"}
                pot_size={12}
                last_watered={"2024-02-27T05:45:44+00:00"}
                thumbnail={"/media/thumbnails/photo1_thumb.jpg"}
            />
        );
        user = userEvent.setup();
    });

    it('shows the correct information', () => {
        expect(component.getByText('Test Plant').nodeName).toBe('H2');
        expect(component.getByText('4 days ago')).toBeInTheDocument();
        expect(component.queryByText('Calathea')).toBeInTheDocument();
        expect(component.queryByText('Mother plant')).toBeInTheDocument();
    });

    it('flips chevron icon when details collapse is opened', async () => {
        // Confirm that ChevronDownIcon is present, ChevronUpIcon is not
        const icon = component.container.querySelectorAll('svg')[1];
        expect(icon.innerHTML.includes('M4.22')).toBe(true);
        expect(icon.innerHTML.includes('M11.78')).toBe(false);

        // Click button, confirm that icon changes to ChevronUpIcon
        await user.click(component.container.querySelector('.btn-close'));
        const newIcon = component.container.querySelectorAll('svg')[1];
        expect(newIcon.innerHTML.includes('M4.22')).toBe(false);
        expect(newIcon.innerHTML.includes('M11.78')).toBe(true);
    });

    it('redirects to manage plant page when clicked', async () => {
        // Click inside div, confirm redirected to manage page
        await user.click(component.getByText('Test Plant'));
        expect(window.location.href).toBe(
            '/manage/0640ec3b-1bed-4b15-a078-d6e7ec66be12'
        );
    });

    it('shows water icon and time since the plant was last watered', () => {
        // Confirm that FA droplet icon is present
        expect(component.container.querySelector('.fa-droplet')).toBeInTheDocument();
        expect(component.getByText(/4 days ago/)).toBeInTheDocument();
    });
});


describe('PlantCard with no water event', () => {
    let component;

    beforeEach(() => {
        component = render(
            <PlantCard
                name={"Test Plant"}
                uuid={"0640ec3b-1bed-4b15-a078-d6e7ec66be12"}
                species={"Calathea"}
                description={"Mother plant"}
                pot_size={12}
                last_watered={null}
                thumbnail={"/media/thumbnails/photo1_thumb.jpg"}
            />
        );
    });

    it('says "never watered" with no icon if plant was never watered', () => {
        // Confirm icon and relative time are not present
        expect(component.container.querySelector('.fa-droplet')).toBeNull();
        expect(component.queryByText(/3 days ago/)).toBeNull();
        // Confirm "Never watered" is present
        expect(component.getByText(/Never watered/)).toBeInTheDocument();
    });
});


describe('PlantCard last watered time display', () => {
    // Helper function takes ISO timetamp, returns rendered component
    const renderWithTimestamp = (timestamp) => {
        return render(
            <PlantCard
                name={"Test Plant"}
                uuid={"0640ec3b-1bed-4b15-a078-d6e7ec66be12"}
                species={"Calathea"}
                description={"Mother plant"}
                pot_size={12}
                last_watered={timestamp}
                thumbnail={"/media/thumbnails/photo1_thumb.jpg"}
            />
        );
    };

    // Takes rendered component, returns span containing icon and last_watered text
    const getLastWateredSpan = (component) => {
        return component.container.querySelector('.fa-droplet').parentElement;
    };

    it('says "Today" if plant was watered during current calendar day', () => {
        // Render with timestamp 5 minutes before current time mock
        let component = renderWithTimestamp("2024-03-01T11:55:00-08:00")
        expect(within(getLastWateredSpan(component)).getByText(
            "Today"
        )).toBeInTheDocument();

        // Render with timestamp 1 minute after midnight on mocked day
        component = renderWithTimestamp("2024-03-01T00:01:00-08:00")
        expect(within(getLastWateredSpan(component)).getByText(
            "Today"
        )).toBeInTheDocument();
    });

    it('says "Yesterday" if plant was watered during previous calendar day', () => {
        // Render with timestamp 1 day and 5 minutes before current time mock
        let component = renderWithTimestamp("2024-02-29T11:55:00-08:00")
        expect(within(getLastWateredSpan(component)).getByText(
            "Yesterday"
        )).toBeInTheDocument();

        // Render with timestamp 1 minute after midnight on previous day
        component = renderWithTimestamp("2024-02-29T00:01:00-08:00")
        expect(within(getLastWateredSpan(component)).getByText(
            "Yesterday"
        )).toBeInTheDocument();
    });

    it('says number of calendar days since last watered if earlier than yesterday', () => {
        // Render with timestamp 2 day and 20 hours before current time mock
        let component = renderWithTimestamp("2024-02-27T16:00:00-08:00");
        // Should say 3 days even though less than 72 hours ago (goes by calendar day)
        // Should NOT say "last month" (confusing since its only a few days)
        expect(within(getLastWateredSpan(component)).getByText(
            "3 days ago"
        )).toBeInTheDocument();

        // Render with timestamp 3 day and 11 hours 59 minutes before current time mock
        component = renderWithTimestamp("2024-02-27T00:01:00-08:00");
        // Should still say 3 days even though over 72 hours ago
        expect(within(getLastWateredSpan(component)).getByText(
            "3 days ago"
        )).toBeInTheDocument();
    });

    it('says number of months since last watered if >30 days ago', () => {
        // Render with timestamp 31 day before current time mock
        let component = renderWithTimestamp("2024-01-30T12:00:00-08:00");
        expect(within(getLastWateredSpan(component)).getByText(
            "1 month ago"
        )).toBeInTheDocument();

        // Render with timestamp 57 days before current time mock
        component = renderWithTimestamp("2024-01-04T12:00:00-08:00");
        // Should still say 1 month ago (until actually > 2 months)
        expect(within(getLastWateredSpan(component)).getByText(
            "1 month ago"
        )).toBeInTheDocument();

        // Render with timestamp 78 days before current time mock
        component = renderWithTimestamp("2023-12-14T12:00:00-08:00");
        // Should say 2 month ago (NOT "last year") even though it is prior year
        expect(within(getLastWateredSpan(component)).getByText(
            "2 months ago"
        )).toBeInTheDocument();
    });

    it('says number of years since last watered if >365 days ago', () => {
        // Render with timestamp 360 day before current time mock
        let component = renderWithTimestamp("2023-03-07T12:00:00-08:00");
        // Should say 11 months ago (not quite a year yet)
        expect(within(getLastWateredSpan(component)).getByText(
            "11 months ago"
        )).toBeInTheDocument();

        // Render with timestamp 366 days before current time mock
        component = renderWithTimestamp("2023-03-01T12:00:00-08:00");
        expect(within(getLastWateredSpan(component)).getByText(
            "1 year ago"
        )).toBeInTheDocument();

        // Render with timestamp 750 days before current time mock
        component = renderWithTimestamp("2022-02-10T12:00:00-08:00");
        expect(within(getLastWateredSpan(component)).getByText(
            "2 years ago"
        )).toBeInTheDocument();
    });
});
