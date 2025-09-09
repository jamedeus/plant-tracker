import GroupDetails from '../GroupDetails';

describe('GroupDetails', () => {
    it('displays correct details', () => {
        const { getByText, queryByText } = render(
            <GroupDetails
                created='2024-02-13T12:00:00+00:00'
                location='Middle shelf'
                description='Used for propagation'
            />
        );
        expect(getByText('Middle shelf')).toBeInTheDocument();
        expect(getByText('Used for propagation')).toBeInTheDocument();
        expect(queryByText('No details')).toBeNull();
    });

    it('does not render location row if argument is null', () => {
        const { queryByText } = render(
            <GroupDetails
                created='2024-02-13T12:00:00+00:00'
                location={null}
                description='Used for propagation'
            />
        );
        expect(queryByText('Location:')).toBeNull();
        expect(queryByText('Description:')).toBeInTheDocument();
    });

    it('does not render description row if argument is null', () => {
        const { queryByText } = render(
            <GroupDetails
                created='2024-02-13T12:00:00+00:00'
                location='Middle shelf'
                description={null}
            />
        );
        expect(queryByText('Location:')).toBeInTheDocument();
        expect(queryByText('Description:')).toBeNull();
    });

    it('displays "No details" when both arguments are null', () => {
        const { getByText, queryByText } = render(
            <GroupDetails
                created='2024-02-13T12:00:00+00:00'
                location={null}
                description={null}
            />
        );
        expect(getByText('No details')).toBeInTheDocument();
        expect(queryByText('Location')).toBeNull();
    });
});
