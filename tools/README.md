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

# CRMsci 3.2 (Stable) — compatible with CIDOC CRM 7.1.x
curl -L https://cidoc-crm.org/extensions/crmsci/rdfs/3.2/CRMsci_v3.2.rdf -o CRMsci_v3.2.rdf
python3 tools/convert_rdfs_to_json.py CRMsci_v3.2.rdf -o crmsci3.2.json
```

CRMdig references CRMsci (see below), so whenever CRMsci is added, changed or
removed, **regenerate `crmdig5.0.json` too**: whether `D11 → S21_Measurement`
becomes a resolved link or an inert `externalSuperclasses` label is decided at
conversion time.

The converter prints a report: class/property counts, the code prefixes it
found, references resolved by the app at runtime (base-CRM `E*`/`P*` codes), and
any references it moved to `externalSuperclasses`.

## Sources & compatibility

| Ontology | Version | Status | Base CIDOC CRM | Source |
|----------|---------|--------|----------------|--------|
| CRMinf | 1.2.1 (Apr 2026) | Stable | 7.1.3 | `cidoc-crm.org/extensions/crminf/rdfs/1.2.1/CRMinf_v1.2.1.rdf` |
| CRMdig | 5.0 (Oct 2025) | Stable | 7.1.3 | `cidoc-crm.org/extensions/crmdig/rdfs/5.0/CRMdig_v5.0.rdf` |
| CRMsci | 3.2 (Apr 2026) | Stable | 7.1.3 | `cidoc-crm.org/extensions/crmsci/rdfs/3.2/CRMsci_v3.2.rdf` |

All three extensions target CIDOC CRM 7.1.x and are only offered when the base
version selector is set to **7.1** (see `VERSIONS` in `main.js`). They reference
base-CRM classes by versionless URIs (e.g.
`http://www.cidoc-crm.org/cidoc-crm/E7_Activity`), which resolve against
`cidoc7.1.json`.

Counts, checked against the official class & property declarations: CRMinf 14/52,
CRMdig 14/43, CRMsci 28/77. Property counts include the inverse directions
materialised in the RDFS (CRMsci: 39 forward + 38 inverse; `O30_determined_position`
has no inverse because its range is `rdfs:Literal`).

### Cross-model references

The three extensions reference each other, not just base CRM: `S5_Inference_Making`
subclasses CRMinf's `I1_Argumentation`, CRMdig's `D11_Digital_Measurement_Event`
subclasses CRMsci's `S21_Measurement`, and `L1_digitized` subclasses
`O24_measured`. All of these resolve, because every namespace in
`STRIP_NAMESPACES` is reduced to bare codes and the app merges all loaded models
into one dictionary before computing the hierarchy closures.

### External references

References into CRM-family models this app does **not** load (CRMgeo, CRMarchaeo,
CRMba) are recorded under `externalSuperclasses` so the UI can show them as inert,
non-clickable references without breaking the class hierarchy. Adding one of those
models means moving its namespaces from `EXTERNAL_NAMESPACES` to
`STRIP_NAMESPACES` and regenerating every file that referenced it.

## Normalizations

- `rdf:about` / `rdf:resource` of known CRM namespaces → local names.
- `rdfs:comment` flattened to a plain English string.
- `rdfs:label` kept in the `{-xml:lang, #text}` shape the app parser expects.
- Non-CRM datatype URIs (e.g. `rdfs:Literal`) are preserved verbatim.
