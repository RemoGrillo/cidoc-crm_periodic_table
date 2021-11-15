# The CIDOC-crm Periodic Table (alpha)
An interactive, dinamically generated interface for the documentation of the CIDOC-CRM.

### Scope

The goal of this interface would be attained if it afforded an improved accessibility of information of the conceptual model. 

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

### Future releases 

* Higher level grouping of classes (in a real periodic table fashion)
* Permalinks for Classes and Properties
* A reasoner-powered to test consistency of triples