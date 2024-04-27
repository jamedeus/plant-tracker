import LastEventTime from '../LastEventTime';

describe('App', () => {
    it('displays "Never watered" when timestamp is null', () => {
        const { getByText } = render(
            <LastEventTime text="Watered" timestamp={null} />
        );
        expect(getByText('Never watered')).toBeInTheDocument();
    });

    it('displays relative time when timestamp is provided', () => {
        const { getByText } = render(
            <LastEventTime text="Water" timestamp={"2024-02-27T00:00:00.000Z"} />
        );
        expect(getByText('Watered 3 days ago')).toBeInTheDocument();
    });
});
