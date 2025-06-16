// Simulated django context, parsed into state object
export const mockContext = {
    plants: {
        "0640ec3b-1bed-4b15-a078-d6e7ec66be12": {
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
        "0640ec3b-1bed-fb15-a078-d6e7ec66be12": {
            name: "Second Test Plant",
            display_name: "Second Test Plant",
            uuid: "0640ec3b-1bed-fb15-a078-d6e7ec66be12",
            created: "2023-12-28T01:25:12+00:00",
            species: "Fittonia",
            description: "",
            pot_size: 2,
            last_watered: "2024-02-27T02:44:12+00:00",
            last_fertilized: "2024-02-27T02:44:12+00:00",
            thumbnail: "/media/thumbnails/photo2_thumb.webp",
            archived: false,
            group: {
                name: "Test group",
                uuid: "0640ec3b-1bed-4b15-a078-d6e7ec66be14"
            }
        }
    },
    groups: {
        "0640ec3b-1bed-4b15-a078-d6e7ec66be14": {
            uuid: "0640ec3b-1bed-4b15-a078-d6e7ec66be14",
            created: "2023-12-26T01:25:12+00:00",
            name: "Test group",
            display_name: "Test group",
            location: "Middle shelf",
            plants: 4,
            archived: false
        },
        "0640ec3b-1bed-4ba5-a078-d6e7ec66be14": {
            uuid: "0640ec3b-1bed-4ba5-a078-d6e7ec66be14",
            created: "2023-12-28T01:25:12+00:00",
            name: "Second Test group",
            display_name: "Second Test group",
            location: "",
            plants: 6,
            archived: false
        }
    },
    show_archive: true
};
