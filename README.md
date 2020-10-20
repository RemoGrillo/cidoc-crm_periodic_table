# Ontological Periodic Table
An infographical generated documentation of ontologies - CIDOC in particular - in a periodic table fashion.

### Scope

Its goal would be attained if it afforded an improved accessibility of information or even a pleasure of consultation to one who used it during modeling.
The same information is present, for instance, in the Cidoc-CRM official documentation and website.
The difference is in the way this information is presented to the user, namely, in a single page (instead of a big hypertext documentation) together with the interactivity and the little utilities available.

### How

The interface content is dinamically generated from the Cidoc-CRM RDFS file (in JSON format).
All the data processing is done on the client side, entirely with javascript.

### Functions

* One page visualization of the entire ontology
* Search/Filter by name or code 
* Select single Class and Property to see details
* Highlight immediate relations on the table
* D3.js visualization of hierarchies
* Show all relations recursively
* Copy to clipboard of the selected class/property
* Switch between Class/Properties/Inverse