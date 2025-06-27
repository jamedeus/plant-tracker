'''Reusable annotations shared by multiple models.'''

from django.db.models import F, Window
from django.db.models.functions import RowNumber


def unnamed_index_annotation():
    '''Adds unnamed_index attribute (sequential ints) to items with is_unnamed=True.'''
    return {'unnamed_index': Window(
        expression=RowNumber(),
        partition_by=[F('is_unnamed')],
        order_by=F('created').asc(),
    )}
