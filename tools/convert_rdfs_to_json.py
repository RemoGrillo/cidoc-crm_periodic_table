#!/usr/bin/env python3
"""Convert a CIDOC-CRM extension RDFS (RDF/XML) file into the JSON convention
used by the periodic table app (same shape as cidoc7.1.json: attributes
prefixed with "-", text nodes as "#text", repeated children as arrays).

Normalizations applied:
- rdf:about / rdf:resource URIs of known CRM namespaces are stripped to local
  names ("http://www.cidoc-crm.org/cidoc-crm/E7_Activity" -> "E7_Activity"),
  so the app can resolve references by code across ontologies.
- References into CRM-family models NOT shipped with the app (CRMsci, ...) are
  moved from rdfs:subClassOf to a display-only "externalSuperclasses" list.
- rdfs:comment is flattened to a plain string (English preferred).

Usage:
    python3 convert_rdfs_to_json.py CRMinf_v1.2.1.rdf -o ../crminf1.2.1.json
"""

import argparse
import json
import sys
import xml.etree.ElementTree as ET

RDF = "{http://www.w3.org/1999/02/22-rdf-syntax-ns#}"
RDFS = "{http://www.w3.org/2000/01/rdf-schema#}"
XML = "{http://www.w3.org/XML/1998/namespace}"

# Namespaces whose local names the app resolves by code (loaded ontologies)
STRIP_NAMESPACES = [
    "http://www.cidoc-crm.org/cidoc-crm/",
    "http://www.cidoc-crm.org/extensions/crminf/",
    "http://www.cidoc-crm.org/extensions/crmdig/",
    "http://www.ics.forth.gr/isl/CRMinf/",
    "http://www.ics.forth.gr/isl/CRMdig/",
]

# CRM-family models the app does NOT load: references become inert labels
EXTERNAL_NAMESPACES = {
    "http://www.cidoc-crm.org/extensions/crmsci/": "CRMsci",
    "http://www.ics.forth.gr/isl/CRMsci/": "CRMsci",
    "http://www.cidoc-crm.org/extensions/crmgeo/": "CRMgeo",
    "http://www.cidoc-crm.org/extensions/crmarchaeo/": "CRMarchaeo",
    "http://www.cidoc-crm.org/extensions/crmba/": "CRMba",
}


def classify_resource(value):
    """Return (kind, normalized) with kind in {'local', 'external', 'other'}."""
    for ns in STRIP_NAMESPACES:
        if value.startswith(ns):
            return "local", value[len(ns):]
    for ns, model in EXTERNAL_NAMESPACES.items():
        if value.startswith(ns):
            return "external", "%s (%s)" % (value[len(ns):], model)
    if "://" not in value:
        return "local", value  # already a local name
    return "other", value  # e.g. rdfs:Literal, xsd datatypes: keep as-is


def convert_labels(elem):
    labels = []
    for label in elem.findall(RDFS + "label"):
        lang = label.get(XML + "lang", "en")
        labels.append({"-xml:lang": lang, "#text": (label.text or "").strip()})
    if not labels:
        return None
    return labels[0] if len(labels) == 1 else labels


def convert_comment(elem):
    comments = []
    for comment in elem.findall(RDFS + "comment"):
        text = "".join(comment.itertext()).strip()
        lang = comment.get(XML + "lang", "en")
        comments.append((lang, text))
    if not comments:
        return None
    for lang, text in comments:
        if lang == "en":
            return text
    return comments[0][1]


def convert_entry(elem, report):
    about = elem.get(RDF + "about", "")
    kind, about_local = classify_resource(about)
    if kind != "local":
        report["skipped"].append(about)
        return None

    entry = {"-rdf:about": about_local}

    label = convert_labels(elem)
    if label is not None:
        entry["rdfs:label"] = label

    comment = convert_comment(elem)
    if comment is not None:
        entry["rdfs:comment"] = comment

    for tag, key in ((RDFS + "subClassOf", "rdfs:subClassOf"),
                     (RDFS + "subPropertyOf", "rdfs:subPropertyOf")):
        refs = []
        for sub in elem.findall(tag):
            value = sub.get(RDF + "resource", "")
            ref_kind, normalized = classify_resource(value)
            if ref_kind == "external":
                entry.setdefault("externalSuperclasses", []).append(normalized)
                report["external"].append("%s -> %s" % (about_local, normalized))
            else:
                if ref_kind == "other":
                    report["unexpected"].append("%s -> %s" % (about_local, value))
                refs.append({"-rdf:resource": normalized})
        if refs:
            entry[key] = refs[0] if len(refs) == 1 else refs

    for tag, key in ((RDFS + "domain", "rdfs:domain"), (RDFS + "range", "rdfs:range")):
        sub = elem.find(tag)
        if sub is not None:
            value = sub.get(RDF + "resource", "")
            ref_kind, normalized = classify_resource(value)
            if ref_kind == "external":
                report["unexpected"].append("%s %s -> external %s" % (about_local, key, value))
                normalized = value
            entry[key] = {"-rdf:resource": normalized}

    referenced = []
    for key in ("rdfs:subClassOf", "rdfs:subPropertyOf", "rdfs:domain", "rdfs:range"):
        value = entry.get(key)
        if isinstance(value, dict):
            referenced.append(value["-rdf:resource"])
        elif isinstance(value, list):
            referenced.extend(ref["-rdf:resource"] for ref in value)
    report["referenced"].update(r for r in referenced if "://" not in r)

    return entry


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", help="RDFS (RDF/XML) file to convert")
    parser.add_argument("-o", "--output", required=True, help="output JSON path")
    args = parser.parse_args()

    root = ET.parse(args.input).getroot()
    report = {"skipped": [], "external": [], "unexpected": [], "referenced": set()}

    classes = []
    for elem in root.findall(RDFS + "Class"):
        entry = convert_entry(elem, report)
        if entry is not None:
            classes.append(entry)

    properties = []
    for elem in root.findall(RDF + "Property"):
        entry = convert_entry(elem, report)
        if entry is not None:
            properties.append(entry)

    output = {"rdf:RDF": {
        "-xml:base": root.get(XML + "base", ""),
        "rdfs:Class": classes,
        "rdf:Property": properties,
    }}

    with open(args.output, "w", encoding="utf-8") as fh:
        json.dump(output, fh, ensure_ascii=False, indent=1)
        fh.write("\n")

    defined = {entry["-rdf:about"].split("_")[0] for entry in classes + properties}
    unresolved = sorted({ref.split("_")[0] for ref in report["referenced"]} - defined)
    print("%s -> %s" % (args.input, args.output))
    print("  classes: %d, properties: %d" % (len(classes), len(properties)))
    print("  code prefixes defined: %s" % sorted({code[0] for code in defined}))
    print("  references outside this file (resolved by the app at runtime): %s" % unresolved)
    if report["external"]:
        print("  moved to externalSuperclasses: %s" % report["external"])
    if report["skipped"]:
        print("  skipped entries (non-CRM about): %s" % report["skipped"])
    if report["unexpected"]:
        print("  UNEXPECTED references (check!): %s" % report["unexpected"])


if __name__ == "__main__":
    sys.exit(main())
