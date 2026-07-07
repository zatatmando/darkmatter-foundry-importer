# Issue #1 — Extract AcroForm fields from a Dark Matter character PDF

## Acceptance criteria
- Reads PDF bytes without uploading them anywhere.
- Enumerates Widget annotations across every page.
- Returns a `Record<string, string>` keyed by the PDF's field names.
- Correctly extracts Theron's name, class, species, HP, and Credits.
- Includes a local inspection command for discovering future PDF template fields.

## Manual test
Place `Theron.pdf` outside the repository or in a gitignored local folder, then run:

```bash
npm run inspect:pdf -- /full/path/to/Theron.pdf
```

The command should report the field count and create `Theron.fields.json`.

## Automated fixture test
```bash
DMFI_TEST_PDF=/full/path/to/Theron.pdf npm test
```

The PDF itself should not be committed.
