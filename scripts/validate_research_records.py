#!/usr/bin/env python3
"""Repository entry for the validator shipped inside danta-proposal-guide."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'skills/danta-proposal-guide/scripts'))
from validate_research_records import main

if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (OSError, ValueError, KeyError) as exc:
        print('Could not validate records: ' + str(exc), file=sys.stderr)
        raise SystemExit(1)
