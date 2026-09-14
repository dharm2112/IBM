# conftest.py — project root
# Adds the repository root to sys.path so that `src.*` imports resolve correctly
# when running pytest from the project root.
import sys
from pathlib import Path

# Insert the workspace root (parent of src/) so `from src.ai...` works
sys.path.insert(0, str(Path(__file__).parent))
