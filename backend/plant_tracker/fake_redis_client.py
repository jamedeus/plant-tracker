'''Mock client used to run unit tests without a redis server'''

import fakeredis
from django_redis.client import DefaultClient

class FakeRedisClient(DefaultClient):
    '''Mock client used to run unit tests without a redis server.'''

    _client = None

    def get_client(self, write=True, tried=None, show_index=False):
        '''Returns fakeredis client instead of real client.'''
        if self._client is None:
            # Make a new in-memory FakeStrictRedis instance
            fake_server = fakeredis.FakeServer()
            self._client = fakeredis.FakeStrictRedis(server=fake_server)

        if show_index:
            return self._client, 0
        return self._client
