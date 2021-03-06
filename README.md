# The CIDOC-crm Periodic Table (alpha)
An infographical, interactive, dinamically generated documentation of CIDOC in a periodic table fashion.

### Scope

The goal of this interface would be attained if it afforded an improved accessibility of information or even a pleasure of consultation to one who used it during modeling.
The same information is present, for instance, in the Cidoc-CRM official documentation and website.
The difference is in the way this information is presented to the user, namely, in a single page (instead of a big hypertext documentation) together with the interactivity and the little utilities available.

### How

The interface content is dinamically generated from the Cidoc-CRM RDFS file (v6.2.1) (in JSON format).
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

### Future releases 

* Fullscreen Hierarchy visualization on hover
* Permalinks for Classes and Properties
* A sandbox with a reasoner to test consistency of triplets 