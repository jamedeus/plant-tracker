import mockFetchResponse from './mockFetchResponse';

// Mocks fetch to return /get_plant_species_options response (requested by
// PlantDetailsForm automatically when mounted)
const mockPlantSpeciesOptionsResponse = () => mockFetchResponse({
    options: [
        "Parlor Palm",
        "Spider Plant",
        "Calathea"
    ]
});

export default mockPlantSpeciesOptionsResponse;
