"""Import every domain model so ``Base.metadata`` and the SQLAlchemy mapper
registry are fully populated. Alembic's ``env.py`` imports this module —
never import individual domain model modules there directly, or a newly
added entity would silently be missing from autogenerate.
"""

from idy_thread.db.base import Base  # noqa: F401
from idy_thread.domain.brands.models import Brand  # noqa: F401
from idy_thread.domain.colors.models import Color  # noqa: F401
from idy_thread.domain.imports.models import (  # noqa: F401
    FieldMapping,
    ImportBatch,
    RawRecord,
    SourceFile,
    SourceWorksheet,
)
from idy_thread.domain.manufacturers.models import Manufacturer, ManufacturerAlias  # noqa: F401
from idy_thread.domain.product_lines.models import ProductLine  # noqa: F401
from idy_thread.domain.quality.models import DataQualityIssue  # noqa: F401
from idy_thread.domain.sources.models import Source  # noqa: F401
from idy_thread.domain.threads.models import Thread, ThreadIdentifier  # noqa: F401
