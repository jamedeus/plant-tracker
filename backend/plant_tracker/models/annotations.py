'''Reusable annotations shared by multiple models.'''

from django.db import models
from django.db.models import Case, When, Subquery, OuterRef, Count, Q


def unnamed_index_annotation(model, null_fields):
    '''Takes model and list of fields that are null on unnamed entries.

    Adds unnamed_index attribute (int if item unnamed, None if named) used as
    sequential identifier in "Unnamed plant/group n" display names.

    Uses a subquery that counts all unnamed entries created before the item
    being annotated (returns correct index when called on filtered queryset).
    '''

    # Build filter with each field that must be null for an item to be unnamed
    null_filters = {f'{field}__isnull': True for field in null_fields}

    # Filter matches the item being annotated and all items created before it
    # (uses primary key to break ties if timestamps are identical)
    created_filter = (
        Q(created__lt=OuterRef('created')) |
        (Q(created=OuterRef('created')) & Q(pk__lte=OuterRef('pk')))
    )

    # Counts all unnamed items owned by user up to the item being annotated
    count_subquery = Subquery(
        model.objects
            # Filter to items owned by same user with correct null fields
            .filter(user_id=OuterRef('user_id'), **null_filters)
            # Filter to item being annotated + all items created before it
            .filter(created_filter)
            # Reset ordering inherritted from parent query (this doesn't add an
            # ORDER BY, it removes one if it exists and does nothing otherwise)
            .order_by()
            # Collapse to single row (required before counting)
            .values('user_id')
            # Annotate sequential IDs
            .annotate(idx=Count('pk'))
            .values('idx'),
        output_field=models.IntegerField()
    )

    # Case statement only runs count_subquery if item matches null filters
    return {'unnamed_index': Case(
        When(**null_filters, then=count_subquery),
        default=None,
        output_field=models.IntegerField()
    )}
