import renderer from 'react-test-renderer';
import Timeline from '../Timeline';
import { ErrorModalProvider } from 'src/context/ErrorModalContext';

const mockEvents = {
    "water": [
        "2024-04-17T21:21:41+00:00",
        "2024-04-16T22:19:47+00:00",
        "2024-04-15T22:27:59+00:00",
        "2024-04-14T22:08:58+00:00",
        "2024-04-14T19:02:53+00:00",
        "2024-04-13T22:08:58+00:00",
        "2024-04-12T18:00:52+00:00",
        "2024-04-11T19:04:20+00:00",
        "2024-03-26T02:49:18+00:00",
        "2024-03-25T02:50:21+00:00",
        "2024-03-24T01:51:30+00:00",
        "2024-03-23T05:20:10+00:00",
        "2024-03-22T01:51:30+00:00",
        "2024-03-17T21:21:41+00:00",
        "2024-03-13T07:35:00+00:00",
        "2024-02-17T22:21:41+00:00",
        "2024-01-17T22:21:41+00:00",
        "2023-12-17T22:21:41+00:00",
        "2023-11-23T01:38:19+00:00",
        "2023-11-22T01:38:19+00:00",
        "2023-11-21T01:38:19+00:00",
        "2023-11-17T22:21:41+00:00",
        "2023-10-17T21:21:41+00:00",
        "2023-09-17T21:21:41+00:00",
        "2023-08-17T21:21:41+00:00",
        "2023-07-17T21:21:41+00:00",
        "2023-06-17T21:21:41+00:00",
        "2023-05-17T21:21:41+00:00",
        "2023-04-17T21:21:41+00:00",
        "2023-03-17T21:21:41+00:00",
        "2023-02-17T22:21:41+00:00",
        "2023-01-17T22:21:41+00:00"
    ],
    "fertilize": [
        "2024-04-14T01:36:43+00:00",
        "2024-04-01T05:17:43+00:00",
        "2024-03-26T02:49:18+00:00",
        "2024-03-24T01:51:30+00:00",
        "2024-03-23T05:20:10+00:00",
        "2024-03-22T01:51:30+00:00",
        "2023-11-23T01:38:19+00:00",
        "2023-11-22T01:38:19+00:00",
        "2023-11-18T01:38:19+00:00"
    ],
    "prune": [
        "2024-04-14T01:36:43+00:00",
        "2024-03-26T02:49:18+00:00",
        "2024-03-25T02:50:21+00:00",
        "2023-11-18T01:38:19+00:00"
    ],
    "repot": [
        "2024-04-12T19:33:57+00:00",
        "2024-03-13T22:20:00+00:00"
    ]
};

const mockPhotoUrls = [
    {
        "created": "2024-03-25T15:28:39+00:00",
        "image": "/media/images/IMG_8103.jpeg",
        "thumbnail": "/media/thumbnails/IMG_8103_thumb.jpg",
        "key": 24
    },
    {
        "created": "2024-03-25T15:28:36+00:00",
        "image": "/media/images/IMG_8102.jpeg",
        "thumbnail": "/media/thumbnails/IMG_8102_thumb.jpg",
        "key": 25
    },
    {
        "created": "2024-03-25T15:28:33+00:00",
        "image": "/media/images/IMG_8101.jpeg",
        "thumbnail": "/media/thumbnails/IMG_8101_thumb.jpg",
        "key": 26
    },
    {
        "created": "2024-03-25T14:34:15+00:00",
        "image": "/media/images/IMG_8098.jpeg",
        "thumbnail": "/media/thumbnails/IMG_8098_thumb.jpg",
        "key": 23
    },
    {
        "created": "2024-03-25T14:34:10+00:00",
        "image": "/media/images/IMG_8097.jpeg",
        "thumbnail": "/media/thumbnails/IMG_8097_thumb.jpg",
        "key": 21
    },
    {
        "created": "2024-03-25T13:28:54+00:00",
        "image": "/media/images/IMG_8095.jpeg",
        "thumbnail": "/media/thumbnails/IMG_8095_thumb.jpg",
        "key": 20
    },
    {
        "created": "2024-03-25T13:28:46+00:00",
        "image": "/media/images/IMG_8094.jpeg",
        "thumbnail": "/media/thumbnails/IMG_8094_thumb.jpg",
        "key": 22
    },
    {
        "created": "2024-03-25T13:28:41+00:00",
        "image": "/media/images/IMG_8093.jpeg",
        "thumbnail": "/media/thumbnails/IMG_8093_thumb.jpg",
        "key": 27
    },
    {
        "created": "2024-03-25T13:28:30+00:00",
        "image": "/media/images/IMG_8092.jpeg",
        "thumbnail": "/media/thumbnails/IMG_8092_thumb.jpg",
        "key": 28
    },
    {
        "created": "2024-03-25T13:28:19+00:00",
        "image": "/media/images/IMG_8091.jpeg",
        "thumbnail": "/media/thumbnails/IMG_8091_thumb.jpg",
        "key": 29
    },
    {
        "created": "2024-03-25T13:27:00+00:00",
        "image": "/media/images/IMG_8090.jpeg",
        "thumbnail": "/media/thumbnails/IMG_8090_thumb.jpg",
        "key": 30
    },
    {
        "created": "2024-03-25T13:26:48+00:00",
        "image": "/media/images/IMG_8089.jpeg",
        "thumbnail": "/media/thumbnails/IMG_8089_thumb.jpg",
        "key": 31
    },
    {
        "created": "2024-02-21T21:21:17+00:00",
        "image": "/media/images/IMG_7598.jpeg",
        "thumbnail": "/media/thumbnails/IMG_7598_thumb.jpg",
        "key": 45
    },
    {
        "created": "2023-11-21T11:57:26+00:00",
        "image": "/media/images/IMG_5866.jpeg",
        "thumbnail": "/media/thumbnails/IMG_5866_thumb.jpg",
        "key": 46
    },
    {
        "created": "2023-09-12T01:59:28+00:00",
        "image": "/media/images/IMG_5040.jpeg",
        "thumbnail": "/media/thumbnails/IMG_5040_thumb.jpg",
        "key": 17
    },
    {
        "created": "2023-08-24T04:43:30+00:00",
        "image": "/media/images/IMG_4813.jpeg",
        "thumbnail": "/media/thumbnails/IMG_4813_thumb.jpg",
        "key": 16
    },
    {
        "created": "2008-08-22T19:00:43+00:00",
        "image": "/media/images/IMG_4811.jpeg",
        "thumbnail": "/media/thumbnails/IMG_4811_thumb.jpeg",
        "key": 44
    }
];

describe('App', () => {
    it('matches snapshot', () => {
        // Render Timeline, confirm matches snapshot
        const component = renderer.create(
            <ErrorModalProvider>
                <Timeline events={mockEvents} photoUrls={mockPhotoUrls} />
            </ErrorModalProvider>
        );
        let tree = component.toJSON();
        expect(tree).toMatchSnapshot();
    });
});
