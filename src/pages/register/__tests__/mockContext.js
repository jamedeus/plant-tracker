// Simulated django context, parsed into state object
export const mockContext = {
    new_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
};

export const mockDividingFrom = {
    plant_details: {
        name: "Test Plant",
        display_name: "Test Plant",
        uuid: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
        created: "2023-12-26T01:25:12+00:00",
        species: "Calathea",
        description: "",
        pot_size: 4,
        last_watered: "2024-02-26T02:44:12+00:00",
        last_fertilized: "2024-02-26T02:44:12+00:00",
        thumbnail: "/media/thumbnails/photo_thumb.webp",
        archived: false,
        group: null
    },
    default_photo: {
        set: false,
        timestamp: "2024-02-26T02:44:12+00:00",
        image: "/media/images/photo.jpeg",
        thumbnail: "/media/thumbnails/photo_thumb.webp",
        preview: "/media/previews/photo_preview.webp",
        key: "1337"
    },
    plant_key: "234",
    event_key: "893"
};

export const mockChangingPlantQrCode = {
    changing_qr_code: {
        type: "plant",
        instance: {
            uuid: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
            created: "2023-12-26T01:25:12+00:00",
            name: "Test Plant",
            display_name: "Test Plant",
            species: "Calathea",
            thumbnail: "/media/thumbnails/photo_thumb.webp",
            pot_size: 4,
            description: "This is a plant with a long description",
            last_watered: "2024-03-01T05:45:44+00:00",
            last_fertilized: "2024-03-01T05:45:44+00:00",
            archived: false,
            group: null
        },
        new_uuid: "07919189-514d-4ec1-a967-8af553dfa7e8",
        preview: "/media/previews/photo_preview.webp",
    }
};

export const mockChangingGroupQrCode = {
    changing_qr_code: {
        type: "group",
        instance: {
            uuid: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
            created: "2023-12-26T01:25:12+00:00",
            name: "Test Group",
            display_name: "Test Group",
            location: "Nowhere",
            description: null,
            plants: 2,
            archived: false
        },
        new_uuid: "07919189-514d-4ec1-a967-8af553dfa7e8"
    }
};
