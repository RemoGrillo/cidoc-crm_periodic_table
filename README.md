# The CIDOC-crm Periodic Table (alpha)
An interactive, dinamically generated interface for the documentation of the CIDOC Conceptual Reference Model.

You can try it [here](https://remogrillo.github.io/cidoc-crm_periodic_table/).

### Scope

The goal of this interface would be attained if it afforded an improved accessibility of the conceptual model. 

You can find complete information in the official Cidoc-CRM documentation. However, the difference between this interface and the documentation itself lays in the way in which information is presented to the user - namely, in a single web-page (instead of a long documentation), with interactivity, utilities, and visually useful features available.

### How

The interface content is dinamically generated from the Cidoc-CRM implementation in RDF.
There is no server-side computation, all the data processing and reasoning is done client side, entirely in javascript.

### Functions

* One page visualization of the entire Conceptual Reference Model
* Search/Filter by name or code 
* Inspect single Classes and Properties to see details
* Highlight immediate relations on the table 
* D3.js infographic visualization of hierarchies
* Show all relations, recursively, for every class and property
* Clipboard (a copy/paste function, pretty useful during modeling)
* Switch between Properties and Inverse Properties
* **Extension ontologies**: toggle CRMinf and CRMdig on/off (any combination), on top of the base CIDOC-CRM (version 7.1)
* **Experiment mode** produces a valid, instance-based Turtle example with the correct `@prefix` declarations

### Ontologies & versions

| Ontology | Versions available | Notes |
|----------|--------------------|-------|
| CIDOC-CRM (base) | 7.1, 6.2.1 | selected from the version dropdown |
| CRMinf (argumentation) | 1.2.1 | available when base = 7.1 |
| CRMdig (digital provenance) | 5.0 | available when base = 7.1 |

The extension data (`crminf1.2.1.json`, `crmdig5.0.json`) is generated from the
official RDFS files by `tools/convert_rdfs_to_json.py` — see [tools/README.md](tools/README.md)
for sources and regeneration commands.

The URL captures state: `?ont=crm,crminf&code=I1` opens the table with CIDOC-CRM
and CRMinf enabled, focused on class I1. A `?code=` for an extension entry
auto-enables its ontology.

### Future releases 

* Higher level grouping of classes (in a real periodic table fashion)
* A reasoner-powered sandbox, useful to test consistency of triples