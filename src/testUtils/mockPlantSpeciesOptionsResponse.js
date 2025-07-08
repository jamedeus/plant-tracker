// Mocks fetch to return /get_plant_species_options response (requested by
// PlantDetailsForm automatically when mounted)
const mockPlantSpeciesOptionsResponse = () => {
    global.fetch = jest.fn(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
            options: [
                "Parlor Palm",
                "Spider Plant",
                "Calathea"
            ]
        })
    }));
};

export default mockPlantSpeciesOptionsResponse;
