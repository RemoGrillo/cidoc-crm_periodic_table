var cidoc = {};
var treegraph = {};
var showinverse = false;


var palette = ["48aadb","003d5b","bf531d","cba415","657153"];

//Higher-level-colors
const cidoc_colorcodes = {
    //Azure
    "E4":{
        color: "#48aadb",
        label: "TemporalEntity"
    },
    //Brown
    "E18":{
        color: "#003d5b",
        label: "PhysicalThings"
    },
    "E39":{
        color: "#bf531d",
        label: "Actors"
    },
    //Yellow
    "E28":{
        color: "#ffe200",
        label: "ConceptualObjects"
    },
    "E41":{
        color: "green",
        label: "Appellations"
    },
    "E53":{
        color: "#cba415",
        label: "Places"
    },
    "E55":{
        color: "#657153",
        label: "Types"
    }
}

$(document).ready(function(){
    $.getJSON("cidoc.json", function(data){
        generateJson(data);
        addPropertiesAndReferencesToJson();
        addColorcodesToJson();
        generateLayout();
        createTree();
        //generateTreeGraph(treegraph);
        $('#propertiesContainer').hide();
        $('#classesbtn').hide();
        $('#descDomainRange').hide();
        $('#toggleInverseBtn').hide();
        $('#descDomainRangeSeparator').hide();
        checkInversePropertiesStatus();

        $('.cidoccell').click(function(){cellClick($(this))});
        $('[code="E1"]').click();
    });

    $('#showHierarchyTree').click(function(){
        $('#hierarchyModal').modal('show');
    });

    $('#classesbtn').click(function(){
        $('.belongsToClasses').show();
        $('.belongsToProperties').hide();
        $('[code=E1]').click();
    });
    $('#propertiesbtn').click(function(){
        $('.belongsToClasses').hide();
        $('.belongsToProperties').show();
        $('[code=P1]').click();
    });

    $(document).on('click', '.descsubclass, .descsuperclass', function(){
        let code = $(this).attr("code");
        $('[code="'+code+'"]').click();
    });

    $('#addtoclipboard').click(function(){
        copyToClipboard();
    });

    $('#toggleInverseBtn').click(function(){
        let previouslyDisplayedCode = currentlyShownCellCode();
            if(previouslyDisplayedCode.endsWith("i")){
                let straightcode = previouslyDisplayedCode.substring(0, previouslyDisplayedCode.length -1);
                toggleInversePropertiesStatus();
                cellClick(straightcode, true);
            } else {
                let inverse = previouslyDisplayedCode + "i";
                toggleInversePropertiesStatus();
                cellClick(inverse, true);
            }
    });

    $("#searchinput").on('input', function(){
        filterBySearch();
    });

    var fixmeTop = $('#describer').offset().top;
    $(window).scroll(function() {
        var currentScroll = $(window).scrollTop();
        if (currentScroll >= fixmeTop) {
            $('#describer').css({
                position: 'fixed',
                top: '0',
                right: '20px'
            });
        } else {
            $('#describer').css({
                position: 'static'
            });
        }
    });
});

function checkInversePropertiesStatus(){
    if(showinverse){
        $('.inverseproperty').show();
        $('.straightproperty').hide();
        $('#toggleInverseBtn').addClass('activatedInversion');
    } else {
        $('.inverseproperty').hide();
        $('.straightproperty').show();
        $('#toggleInverseBtn').removeClass('activatedInversion');
    }
    //filterBySearch();
}

function currentlyShownCellCode(){
    return $("#descCode").text();
}

function toggleInversePropertiesStatus(){
    showinverse = !showinverse;
    checkInversePropertiesStatus();
}

function setInversePropertiesStatus(boole){
    if(boole){
        $('#toggleInverseBtn').removeClass("activatedInversion");
        $('#toggleInverseBtn').addClass("activatedInversion");
    } else {
        $('#toggleInverseBtn').removeClass("activatedInversion");
    }
    showinverse = boole;
}

function toggleViewFromCode(code){
    if(code.startsWith("P")){
        $('.belongsToClasses').hide();
        $('.belongsToProperties').show();
        setInversePropertiesStatus(code.endsWith("i"));
        checkInversePropertiesStatus();
    } else if (code.startsWith("E")){
        $('.belongsToClasses').show();
        $('.belongsToProperties').hide();
    }
}

function cellClick(elem, simulated=false){
    $("#searchinput").val("");
    filterBySearch("");
    let keycode;
    $('.cidoccell').removeClass("selectedCell");

    if(simulated){
        console.log("Simulated")
        keycode = elem;
    } else {
        keycode = $(elem).attr("code");
    }
    $('[code="' + keycode + '"]').addClass("selectedCell");
    toggleViewFromCode(keycode);

    $('#clipboardInput').val($(elem).attr("about"));


    /* HIERARCHY */
    $('#d3container').html("");
    let selectedTreeNode = treegraph.first(function (node) {
        return node.model.code === keycode;
    });
    let comment = "";
    $('#descCode').text(keycode);
    $('#descTitle').text(cidoc[keycode]["label"]);
    
    if(keycode.startsWith("P")){
        /* PROPERTIES */
        if(keycode.endsWith("i")){
            comment = cidoc[keycode.substring(0, keycode.length - 1)]["comment"];
            setInversePropertiesStatus(true);
        } else {
            comment = cidoc[keycode]["comment"];
            setInversePropertiesStatus(false);
        }
        $('#descDomainRange').show();
        $('#descCodeColor').attr('class', "");
        $('#descDomain').html(classesLayout(getCode(cidoc[keycode]["domain"])));
        $('#descProperty').html(propertiesLayout(keycode));
        $('#descRange').html(classesLayout(getCode(cidoc[keycode]["range"])));
        $('.cidoccell').unbind("click");
        $('.cidoccell').click(function(){cellClick($(this))});

    } else if (keycode.startsWith("E")) {
        comment = cidoc[keycode]["comment"];
        /* CLASSES */
        $('#descCodeColor').attr('class', "");
        $('#descCodeColor').addClass(getColorCode(keycode))
        /* Superclasses */
        let superclasses = cidoc[keycode]["superclasses"];

        let superhtml = "<div>";
        $.each(superclasses, function(k,v){
            let label = cidoc[v]["label"];
            superhtml += "<a class='descsuperclass' code='"+v+"'>" + v + " - " + label + "</a>";
        });
        superhtml += "</div>";
        $('#superclasses').html(superhtml);

        //createDescSubclasses(keycode);
        highlightSubclassesByClass(keycode);
        generateTreeGraph(selectedTreeNode);
        $('#treelist').html("");
        createSubclassesList(keycode);

        centerCharts();
        //TODO: tabella con orizzontali i livelli di profondità, verticale le famiglie o viceversa ()
        addPropertiesAndReferencesToLayout(keycode);
    }

    $('#descComment').text(comment);
}

function getFilteredCodes(query){
    let corresponding_codes = [];
    $.each(cidoc, function(k,v){
        console.log(k)
        console.log(v)
        //Inverse properties don't have comments (they are in the corresponding direct property)
        if(k.endsWith("i")){
            if (v.label.toUpperCase().includes(query.toUpperCase())|| cidoc[k.substring(0, k.length - 1)].comment.toUpperCase().includes(query.toUpperCase())){
                corresponding_codes.push(k);
            }
        } else if (v.label.toUpperCase().includes(query.toUpperCase()) || v.comment.toUpperCase().includes(query.toUpperCase())){
            corresponding_codes.push(k);
        }
    });
    return corresponding_codes;
}

function isEmptyOrSpaces(str){
    return str === null || str.match(/^ *$/) !== null;
}

function filterBySearch(){
    $('.cidoccell').show();
    let query = $("#searchinput").val();
    if(isEmptyOrSpaces(query)){
        $('.cidoccell').show();
        checkInversePropertiesStatus();
    } else {
        let query_result = getFilteredCodes(query);
        console.log(query_result);
        $('.cidoccell').each(function(){
            if(query_result.includes($(this).attr("code"))){
                //if((showinverse && $(this).hasClass("inverseproperty")) || (!showinverse && $(this).hasClass("straightproperty"))){
                    $(this).show();
                //}
            } else {
                $(this).hide();
            }
        });
    }
    //$('.cidoccell:visible').first().click();
}

function getClassLevel(code, level){
    if(cidoc[code]["superclasses"].length > 0){
        for (const v of cidoc[code]["superclasses"]) {
            level = level + 1;
            return getClassLevel(v, level);
        }
    } else {
        return level;
    }
}

function getAllSuperclassesWrapper(code){
    var superclasses = [];
    getAllSuperclasses(code, superclasses);
    //Remove duplicates
    let filtered = superclasses.filter(function(item, pos) {
        return superclasses.indexOf(item) == pos;
    });
    return filtered;
}

function getAllSuperclasses(code, superclasses){
    if(cidoc[code]["superclasses"].length > 0){
        $.each(cidoc[code]["superclasses"], function(k,v){
            superclasses.push(v);
            getAllSuperclasses(v, superclasses);
        })
    }
}

//HasSuperclass or is ITSELF that code (TODO: move it elsewhere, where hassuperclass is called)
function hasSuperclass(code, superclass){
    return cidoc[code].recursiveSuperclasses.includes(superclass) || code == superclass;
}

function getAllPropertiesAndReferences(code){
    let props = {"properties": [], "references":[]};
    $.each(cidoc, function(k,v){
       if(k.startsWith("P")){
           if(getCode(v.domain) === code){
               props.properties.push(k);
           }
           if(getCode(v.range) === code){
               props.references.push(k);
           }
       }
    });
    return props;
}

function addPropertiesAndReferencesToJson(){
    $.each(cidoc, function(k,v){
        if(k.startsWith("E")){
            let superclasses = getAllSuperclassesWrapper(k);
            cidoc[k]["recursiveSuperclasses"] = superclasses;
            cidoc[k]["props"] = [];
            cidoc[k]["inheritedProps"] = [];

            let props = getAllPropertiesAndReferences(k);
            cidoc[k]["props"].push({"code":k, "props": props});

            $.each(cidoc[k]["recursiveSuperclasses"], function(key,value){
                let inheritedProps = getAllPropertiesAndReferences(value);
                cidoc[k]["inheritedProps"].push({"code":value, "props": inheritedProps});
            });
        }
    });
}

function addColorcodesToJson(){
    $.each(cidoc, function(k,v){
        let colorcodes = [];
        if(k.startsWith("E")){
            $.each(cidoc_colorcodes, function(superclass, value){
                if(hasSuperclass(k, superclass)){
                    colorcodes.push(value)
                }
            })
            cidoc[k]["colorcodes"] = colorcodes;
        }
    });

    $.each(cidoc, function(k,v){
        if(k.startsWith("E")){
            if(cidoc[k].colorcodes.length > 1){
                //console.log("Found: " + k + " length: " + cidoc[k].colorcodes.length)
                //console.log(cidoc[k])
            }
        }
    });
}

function addPropertiesAndReferencesToLayout(code){
    //Direct Properties
    let properties = cidoc[code].props[0]["props"]["properties"];
    let htmlstring = "<table class='classPropertiesTable'><tbody><div class='directClassProperties'>" 
    $.each(properties, function(index, value){
        htmlstring += "<tr class='classPropertyRow'><td class='tdDomain'>" + code + "</td><td class='tdProperty'><span class='directPropertySpan' onclick='cellClick(\""+ value +"\", true)'>" + cidoc[value].about + "</span></td><td class='tdRange'>" + cidoc[value].range + "</td></tr>";
    })
    //Inherited Properties
    let inheritedProperties = cidoc[code].inheritedProps;
    htmlstring += "<div class='inheritedClassProperties'>" 
    $.each(inheritedProperties, function(index, value){
        $.each(value.props.properties, function(i,ipcode){
            htmlstring += "<tr class='classPropertyRow'><td>" + value.code + "</td><td><span class='inheritedPropertySpan' onclick='cellClick(\""+ ipcode +"\", true)'>" + cidoc[ipcode].about + "</span></td><td>" + cidoc[ipcode].range + "</td></tr>";
        });
    })
    htmlstring += "</div>"
    htmlstring += "</tbody></table>"

    let htmlstring2 = "";
    //References
    let references = cidoc[code].props[0].props.references;
    htmlstring2 += "<table class='classReferencesTable'><tbody><div class='directClassReferences'>" 
    $.each(references, function(index, value){
        htmlstring2 += "<tr class='classReferenceRow'><td class='tdDomain'>" + cidoc[value].domain + "</td><td class='tdProperty'><span class='directReferenceSpan' onclick='cellClick(\""+ value +"\", true)'>" + cidoc[value].about + "</span></td><td class='tdRange'>" + cidoc[value].range + "</td></tr>";
    })

    //Inherited References
    if(cidoc[code].inheritedProps[0]){
        let inheritedReferences = cidoc[code].inheritedProps;
        htmlstring2 += "<div class='inheritedClassReferences'>" 
        $.each(inheritedReferences, function(index, value){
            $.each(value.props.references, function(i,ipcode){
                htmlstring2 += "<tr class='classReferenceRow'><td class='tdDomain'>" + getCode(cidoc[ipcode].domain)  + "</td><td class='tdProperty'><span class='inheritedReferenceSpan' onclick='cellClick(\""+ ipcode +"\", true)'>" + cidoc[ipcode].about + "</span></td><td class='tdRange'>" + value.code + "</td></tr>";
            });
        })
        htmlstring2 += "</div>"
        htmlstring2 += "</tbody></table>"
    }

    $('#classPropertiesContainer').html(htmlstring)
    $('#classReferencesContainer').html(htmlstring2)
}

function centerCharts(){
    let myDiv = $("#d3container");
    var containerwidth = myDiv.width();
    let canvaswidth = myDiv.find('svg').width();
    myDiv.animate({scrollLeft: Math.abs(containerwidth-canvaswidth)/2});
}

function createDescSubclasses(keycode){
    /* Subclasses */
    let subclasses = getAllSubclasses(keycode);
    let subhtml = "<div>";
    $.each(subclasses, function(k,v){
        let label = cidoc[v]["label"];
        subhtml += "<a class='descsubclass' code='"+v+"'>" + v + " - " + label + "</a>";
    });
    subhtml += "</div>";
    $('#subclasses').html(subhtml);
}

function getAllSubclasses(code){
    let subclasses = [];
    $.each(cidoc, function(k,v){
        if(v["superclasses"].includes(code)){
            subclasses.push(k);
        }
    });
    return subclasses;
}

function getAllRecursiveSubclassesWrapper(code){
    var subclasses = [];
    getAllRecursiveSubclasses(code, subclasses);
    //Remove duplicates
    let filtered = subclasses.filter(function(item, pos) {
        return subclasses.indexOf(item) == pos;
    });
    return filtered;
}

function getAllRecursiveSubclasses(code, subclasses){
    if(cidoc[code]["subclasses"].length > 0){
        $.each(cidoc[code]["subclasses"], function(k,v){
            subclasses.push(v);
            getAllRecursiveSubclasses(v, subclasses);
        })
    }
}

function createTree(){
    /* CLASSES */
    let tree = new TreeModel();
    let root = tree.parse({});

    let completed = false;
    while (!completed) {
        completed = true;
        $.each(cidoc, function(k,v){
            if(k.startsWith("E")){
                // DOES THE NODE IN THE TREE ALREADY EXIST?
                var found = root.first(function (node) {
                    return node.model.code === k;
                });
                if (found == null){
                    // IT DOESN'T EXIST! SO CREATE IT

                    // IF IT'S E1
                    if(v["superclasses"].length === 0){
                        let first = tree.parse({code:k, children:[]});
                        root.addChild(first)
                    // IF IT'S NOT E1, FIND THE ATTACHER
                    } else {
                        $.each(v["superclasses"], function(index,superclass){
                            let attacher = root.first(function (node) {
                                return node.model.code === superclass;
                            });

                            //IF AT LEAST ONE ATTACHER SUPERCLASS DOESN'T EXIST, WE MUST REITERATE ALL THE CIDOC
                            if (attacher == null) {
                                completed = false;
                            } else {
                                let newchild = tree.parse({code:k, children:[]});
                                attacher.addChild(newchild);
                            }
                        });
                    }
                }
            }
        });
    }

    console.log("Result of tree:");
    console.log(root);
    treegraph = root.children[0];

}

function getTreeFromCode(code){
    return treegraph.first(function (node) {
        return node.model.code === code;
    });
}

function createSubclassesList(code){
    let tree = getTreeFromCode(code);
    let albero = new TreeModel();

    function treeList() {
        let margin = {top: 0, right: 20, bottom: 30, left: 0};
        let width = 1000;
        let barHeight = 15;
        let i = 0;
        let duration = 500;
        let nodeEnterTransition = d3.transition()
            .duration(duration)
            .ease(d3.easeLinear);

        function chart(selection) {

            const data = selection.datum();
            const height1 = 1000;

            // Building svg

            let svg = selection
                .selectAll('svg')
                .data([data])
                .enter().append('svg').style("height", height1 + 'px');

            svg.append("g")
                .attr("width", width)
                .attr("transform", `translate(${margin.left}, ${margin.top})`);

            svg = svg.merge(svg);
            let root = d3.hierarchy(data);
            root.x0 = 0;
            root.y0 = 0;
            update(root);

            function update(source) {

                // Compute the flattened node list.
                var nodes = root.descendants();

                var height = Math.max(1000, nodes.length * barHeight + margin.top + margin.bottom);

                d3.select("svg").transition()
                    .attr("height", height);

                var index = 0;
                root.eachBefore((n) => {
                    n.x = ++index * barHeight;
                    n.y = n.depth * barHeight/2 + 10;
                });

                // Update the nodes…
                var node = svg.selectAll(".node")
                    .data(nodes, (d) => d.id || (d.id = ++i));

                var nodeEnter = node.enter().append("g")
                    .attr("class", "node")
                    .attr("transform", `translate(${source.y0}, ${source.x0})`)
                    .on("click", click);

                // adding arrows
                nodeEnter.append('text')
                    .attr('x', -10)
                    .attr('y', 2)
                    .attr('fill', 'black')
                    .attr('class', 'arrow')
                    .attr('class', 'fas')
                    .attr('font-size', '12px')
                    .text((d) => d.children ? '\uf107' : d._children ? '\uf105' : "");

/*                // adding file or folder
                nodeEnter.append('text')
                    .attr('x', -10)
                    .attr('y', 2)
                    .attr('fill', (d) => d.children || d._children ? '#131313' : '#464646')
                    .attr('class', 'fas')
                    .attr('font-size', '12px')
                    .text((d) => d.children || d._children ? '\uf07b' : '\uf15b');*/

                // adding file or folder names
                nodeEnter.append("text")
                    .attr("dy", 3.5)
                    .attr("dx", 5.5)
                    .text((d) => d.data.model.code + " - " + cidoc[d.data.model.code]["label"])
                    .on("mouseover", function (d) {
                        d3.select(this).classed("selected", true);
                    })
                    .on("mouseout", function (d) {
                        d3.selectAll(".selected").classed("selected", false);
                    });



                // Transition nodes to their new position.
                nodeEnter.transition(nodeEnterTransition)
                    .attr("transform", (d) => "translate(" + d.y + "," + d.x + ")")
                    .style("opacity", 1);

                node.transition()
                    .duration(duration)
                    .attr("transform", (d) => "translate(" + d.y + "," + d.x + ")")
                    .style("opacity", 1);


                // Transition exiting nodes to the parent's new position.
                node.exit().transition()
                    .duration(duration)
                    .attr("transform", () => "translate(" + source.y + "," + source.x + ")")
                    .style("opacity", 0)
                    .remove();


                // Stash the old positions for transition.
                root.each((d) => {
                    d.x0 = d.x;
                    d.y0 = d.y;
                });
            }

            // Toggle children on click.
            function click(d) {
                $('[code="'+d.data.model.code+'"]').click()
                /*
                if (d.children) {
                    d._children = d.children;
                    d.children = null;
                } else {
                    d.children = d._children;
                    d._children = null;
                }
                d3.select(this).remove()
                update(d);
                 */
            }
        }

        chart.width = function (_) {
            return arguments.length ? ((width = _) , chart) : width;
        };
        chart.margin = function (_) {
            return arguments.length ? ((margin = _) , chart) : margin;
        };
        return chart
    }

    const sample = treeList();
    d3.select("#treelist").datum(tree).call(sample);

    //document.getElementById('treelist').scrollIntoView();
}

//Generate the general tree graph visualization
function generateTreeGraph(treeData){
    // set the dimensions and margins of the diagram
    var margin = {top: 50, right: 10, bottom: 50, left: 10},
        width = 1500,
        height = 400;

// declares a tree layout and assigns the size
    var treemap = d3.tree()
        .size([width, height]);

//  assigns the data to a hierarchy using parent-child relationships
    var nodes = d3.hierarchy(treeData);

// maps the node data to the tree layout
    nodes = treemap(nodes);

// append the svg obgect to the body of the page
// appends a 'group' element to 'svg'
// moves the 'group' element to the top left margin
    var svg = d3.select("#d3container").append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom),
        g = svg.append("g")
            .attr("transform",
                "translate(" + margin.left + "," + margin.top + ")");

// adds the links between the nodes

    var link = g.selectAll(".link")
        .data( nodes.descendants().slice(1))
        .enter().append("path")
        .attr("class", "link")
        .attr("d", function(d) {
            return "M" + d.x + "," + d.y
                + "C" + d.x + "," + (d.y + d.parent.y) / 2
                + " " + d.parent.x + "," +  (d.y + d.parent.y) / 2
                + " " + d.parent.x + "," + d.parent.y;
        });

// adds each node as a group
    var node = g.selectAll(".node")
        .data(nodes.descendants())
        .enter().append("g")
        .attr("class", function(d) {
            return "node" +
                (d.children ? " node--internal" : " node--leaf"); })
        .attr("transform", function(d) {
            return "translate(" + d.x + "," + d.y + ")"; });

// adds the circle to the node
    node.append("circle")
        .attr("r", 3);

// adds the text to the node
    node.append("text")
        .attr("dy", ".35em")
        .attr("y", function(d) { return d.children ? -20 : 20; })
        .style("text-anchor", "middle")
        .text(function(d) { return (d.data.model.code); });
}


function calculateSubclasses(){
    $.each(cidoc, function(k,v){
        cidoc[k]["subclasses"] = getAllSubclasses(k);
    })
}

function isCidocCode(code){
    let regex = /^[E,P]\d{1,3}/gm
    return(regex.test(code))
}

function highlightSubclassesByClass(code){
    $('.cidoccell').removeClass("highlighted");
    let subclasses = getAllRecursiveSubclassesWrapper(code);
    $.each(subclasses, function(i, subclass){
        $('[code="'+subclass+'"]').addClass('highlighted');
    });
}

function takeDataFromEntry(entry){
    let currentcode = getCode(entry["-rdf:about"]);
    cidoc[currentcode] = {};

    /* about */
    cidoc[currentcode]["about"] = entry["-rdf:about"];

    /* LABEL */
    cidoc[currentcode]["label"] = "";
    if("rdfs:label" in entry) {
        if (Array.isArray(entry["rdfs:label"])) {
            entry["rdfs:label"].forEach(function (obj) {
                if (obj["-xml:lang"] === "en") {
                    cidoc[currentcode]["label"] = obj["#text"]
                }
            });
        } else {
            cidoc[currentcode]["label"] = entry["rdfs:label"]["#text"];
        }
    }

    /* SUPERPROPERTIES */
    let superproperties = [];
    cidoc[currentcode]["superproperties"] = [];
    if("rdfs:subPropertyOf" in entry){
        if(Array.isArray(entry["rdfs:subPropertyOf"])){
            entry["rdfs:subPropertyOf"].forEach(function(superproperty){
                superproperties.push(getCode(superproperty["-rdf:resource"]));
            });
        } else {
            superproperties.push(entry["rdfs:subPropertyOf"]["-rdf:resource"])
        }
        cidoc[currentcode]["superproperties"] = superproperties;
    }


    /* SUPERCLASSES */
    let superclasses = [];
    cidoc[currentcode]["superclasses"] = [];
    if("rdfs:subClassOf" in entry){
        if(Array.isArray(entry["rdfs:subClassOf"])){
            entry["rdfs:subClassOf"].forEach(function(superclass){
                superclasses.push(getCode(superclass["-rdf:resource"]))
            });
        } else {
            superclasses.push(getCode(entry["rdfs:subClassOf"]["-rdf:resource"]))
        }
        cidoc[currentcode]["superclasses"] = superclasses;
    }


    /* Comments  */
    if("rdfs:comment" in entry){
        cidoc[currentcode]["comment"] = entry["rdfs:comment"];
    }

    if("rdfs:domain" in entry){
        cidoc[currentcode]["domain"] = entry["rdfs:domain"]["-rdf:resource"];
    }

    if("rdfs:range" in entry){
        cidoc[currentcode]["range"] = entry["rdfs:range"]["-rdf:resource"];
    }
}

function copyToClipboard(){
        let copyText = $('#clipboardInput').val();
        navigator.clipboard.writeText(copyText);


        $('#clipboardMessage').text("Copied \"" + copyText + "\" to clipboard.");
        $("#clipboardMessage").fadeIn(150, function(){$("#clipboardMessage").fadeOut(3000)});
}

function generateJson(data){
    data["rdf:RDF"]["rdf:Property"].forEach(function(entry){
        takeDataFromEntry(entry);
    });
    data["rdf:RDF"]["rdfs:Class"].forEach(function(entry){
        takeDataFromEntry(entry);
    });

    calculateSubclasses();
    console.log("Cidoc:");
    console.log(cidoc);
}

function getCode(string){
    if(string.startsWith("E") || string.startsWith("P")){
        return string.split("_")[0];
    }
    //If it's a link (assuming it's rdf) return the last part 
    if(string.startsWith("http://")){
        return string.split("#")[1];
    }
}

function getColorCode(code){
    if(code.startsWith("E") || code.startsWith("P")){
        let color_code = "none"
        if(cidoc[code].colorcodes.length == 1){
            color_code = cidoc[code].colorcodes[0].label;
        }
        if(cidoc[code].colorcodes.length == 2){
            color_code = cidoc[code].colorcodes[1].label;
        }
    return color_code
    }
    return null;
}

function classesLayout(code){
    if(isCidocCode(code)){
        let color_code = getColorCode(code);
        let classObject = cidoc[code]

        var html = "<div code='"+ code +"' class='cidoccell classcell " + color_code + "' title='"+ classObject.comment +"' about='"+ classObject.about +"'>";
        //html += "<div class='ccdot' style='background-color:" + color_code + ";'></div>";
        html += "<div class='classsuperclasses'> " + classObject.superclasses.join() + "</div>";
        html += "<div class='classcodes'>" + code + "</div>";
        html += "<div class='classlevel level" + getClassLevel(code, 0) + "'></div>";
        html += "<div class='classtitle'>" + classObject.label + "</div>";
        html += "<div class='classsubclasses'>" + getAllSubclasses(code) + "</div>";
        html += "</div>";
        return html;
    } else {
        return "<div class='nonCidocCode'>" + code + "</div>";
    }
}

/* PROPERTIES */
function propertiesLayout(code){
        let aproperty = cidoc[code];
        let propertyDirection = "straightproperty";
        if(code.endsWith("i")) {
            propertyDirection = "inverseproperty";
        }

        propertyDomainCode = getCode(aproperty.domain)
        propertyRangeCode = getCode(aproperty.range)
        propertyDomainLabel = "";
        propertyRangeLabel = "";

        if(propertyDomainCode.startsWith("E") || propertyDomainCode.startsWith("P")){
            propertyDomainLabel = cidoc[propertyDomainCode].label;
        }
        if(propertyRangeCode.startsWith("E") || propertyRangeCode.startsWith("P")){
            propertyRangeLabel = cidoc[propertyRangeCode].label;
        }



        var html = "<div code='"+ code +"' class='cidoccell propertycell "+ propertyDirection + "' title='"+ aproperty.comment +"' about='"+ aproperty.about +"'>";
            html += "<div class='propertysuperproperties'> " + aproperty.superproperties.join() + "</div>";
            html += "<div class='propertycodes'>" + code + "</div>";
            html += "<div class='propertytitle'>" + aproperty.label + "</div>";
            html += "<div class='propertydomain "+ getColorCode(propertyDomainCode) +"'>" + "<div class='propertyDomainCode'>" + propertyDomainCode + "</div><div class='propertyDomainLabel'>" + propertyDomainLabel + "</div></div>";
            html += "<div class='propertyrange "+ getColorCode(propertyRangeCode) +"'>" + "<div class='propertyDomainRange'>" + propertyRangeCode + "</div><div class='propertyRangeLabel'>" + propertyRangeLabel + "</div></div>";
            html += "</div>";
        return html;
}

function generateLayout(){
    $.each(cidoc, function(k,v){
        //If entry is a class (starting with E)
       if(k.startsWith("E")){
        $('#classesContainer').append(classesLayout(k));
       } else {
        $('#propertiesContainer').append(propertiesLayout(k));
       }
    });
}

