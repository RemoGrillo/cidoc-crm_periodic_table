# Data conversion tools

The app renders ontologies from JSON files that mirror the structure of the
official CIDOC-CRM RDFS files (attributes prefixed with `-`, text nodes as
`#text`). `convert_rdfs_to_json.py` produces those JSON files from the official
RDF/XML sources.

## Regenerating the extension data

Download the official RDFS files and run the converter (Python 3, standard
library only — no dependencies):

```sh
# CRMinf 1.2.1 (Stable) — compatible with CIDOC CRM 7.1.x
curl -L https://cidoc-crm.org/extensions/crminf/rdfs/1.2.1/CRMinf_v1.2.1.rdf -o CRMinf_v1.2.1.rdf
python3 tools/convert_rdfs_to_json.py CRMinf_v1.2.1.rdf -o crminf1.2.1.json

# CRMdig 5.0 (Stable) — compatible with CIDOC CRM 7.1.x
curl -L https://cidoc-crm.org/extensions/crmdig/rdfs/5.0/CRMdig_v5.0.rdf -o CRMdig_v5.0.rdf
python3 tools/convert_rdfs_to_json.py CRMdig_v5.0.rdf -o crmdig5.0.json
```

The converter prints a report: class/property counts, the code prefixes it
found, references resolved by the app at runtime (base-CRM `E*`/`P*` codes), and
any references it moved to `externalSuperclasses`.

## Sources & compatibility

| Ontology | Version | Status | Base CIDOC CRM | Source |
|----------|---------|--------|----------------|--------|
| CRMinf | 1.2.1 (Apr 2026) | Stable | 7.1.3 | `cidoc-crm.org/extensions/crminf/rdfs/1.2.1/CRMinf_v1.2.1.rdf` |
| CRMdig | 5.0 (Oct 2025) | Stable | 7.1.3 | `cidoc-crm.org/extensions/crmdig/rdfs/5.0/CRMdig_v5.0.rdf` |

Both extensions target CIDOC CRM 7.1.x and are only offered when the base
version selector is set to **7.1** (see `VERSIONS` in `main.js`). They reference
base-CRM classes by versionless URIs (e.g.
`http://www.cidoc-crm.org/cidoc-crm/E7_Activity`), which resolve against
`cidoc7.1.json`.

### External references

A few CRMdig entries subclass CRMsci classes (e.g. `D11_Digital_Measurement_Event`
→ `S21_Measurement`), a model not shipped with this app. The converter records
these under `externalSuperclasses` so the UI can show them as inert, non-clickable
references without breaking the class hierarchy.

## Normalizations

- `rdf:about` / `rdf:resource` of known CRM namespaces → local names.
- `rdfs:comment` flattened to a plain English string.
- `rdfs:label` kept in the `{-xml:lang, #text}` shape the app parser expects.
- Non-CRM datatype URIs (e.g. `rdfs:Literal`) are preserved verbatim.
