// Simulated django context, parsed into state object
export const mockContext = {
    group: {
        uuid: "0640ec3b-1bed-4b15-a078-d6e7ec66be14",
        created: "2023-12-26T01:25:12+00:00",
        name: "Test group",
        display_name: "Test group",
        location: "Middle shelf",
        description: null,
        plants: 3
    },
    details: {
        "0640ec3b-1bed-4b15-a078-d6e7ec66be12": {
            name: "Test Plant",
            display_name: "Test Plant",
            uuid: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
            created: "2023-12-26T01:25:12+00:00",
            species: "Calathea",
            description: "This is a plant with a long description with",
            pot_size: 4,
            last_watered: "2024-02-29T12:45:44+00:00",
            last_fertilized: "2024-03-01T05:45:44+00:00",
            thumbnail: null,
            archived: false
        },
        "19f65fa0-1c75-4cba-b590-0c9b5b315fcc": {
            name: null,
            display_name: "Unnamed Spider Plant",
            uuid: "19f65fa0-1c75-4cba-b590-0c9b5b315fcc",
            created: "2023-12-27T01:25:12+00:00",
            species: "Spider Plant",
            description: null,
            pot_size: 2,
            last_watered: "2024-02-29T12:45:44+00:00",
            last_fertilized: "2024-03-01T05:45:44+00:00",
            thumbnail: "/media/thumbnails/photo_thumb.webp",
            archived: true
        },
        "26a9fc1f-ef04-4b0f-82ca-f14133fa3b16": {
            name: "Newest plant",
            display_name: "Newest plant",
            uuid: "26a9fc1f-ef04-4b0f-82ca-f14133fa3b16",
            created: "2023-12-28T01:25:12+00:00",
            species: "null",
            description: null,
            pot_size: null,
            last_watered: null,
            last_fertilized: null,
            thumbnail: null,
            archived: false
        },
    },
    options: [
        {
            uuid: "0640ec3b-1bed-4b15-a078-d6e7ec66be16",
            created: "2024-02-26T01:25:12+00:00",
            name: "Another test plant",
            display_name: "Another test plant",
            species: null,
            description: null,
            pot_size: 4,
            last_watered: null,
            last_fertilized: null,
            thumbnail: "/media/thumbnails/photo2_thumb.webp",
            archived: false
        },
        {
            uuid: "0640ec3b-1bed-4b15-a078-d6e7ec66be69",
            created: "2023-12-26T01:25:12+00:00",
            name: "Third test plant",
            display_name: "Third test plant",
            species: null,
            description: null,
            pot_size: null,
            last_watered: null,
            last_fertilized: null,
            thumbnail: "/media/thumbnails/photo3_thumb.webp",
            archived: false
        },
        {
            uuid: "102d1a8c-07e6-4ece-bac7-60ed6a95a463",
            created: "2022-12-26T01:25:12+00:00",
            name: null,
            display_name: "Unnamed Fern",
            species: null,
            description: null,
            pot_size: null,
            last_watered: null,
            last_fertilized: "2022-03-01T05:45:44+00:00",
            thumbnail: null,
            archived: true
        }
    ]
};
