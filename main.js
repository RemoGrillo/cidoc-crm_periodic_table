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
        $('#E1').click();
    });

    $('#showHierarchyTree').click(function(){
        $('#hierarchyModal').modal('show');
    });

    $('#classesbtn').click(function(){
        $('.belongsToClasses').show();
        $('.belongsToProperties').hide();
    });
    $('#propertiesbtn').click(function(){
        $('.belongsToClasses').hide();
        $('.belongsToProperties').show();
    });

    $(document).on('click', '.descsubclass, .descsuperclass', function(){
        let code = $(this).attr("code");
        $('#'+code).click();
    });

    $('#addtoclipboard').click(function(){
        copyToClipboard();
    });

    $('#toggleInverseBtn').click(function(){
        $(this).toggleClass("inversebtn");
       toggleInversePropertiesStatus();
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
    } else {
        $('.inverseproperty').hide();
        $('.straightproperty').show();
    }
    //filterBySearch();
}

function toggleInversePropertiesStatus(){
    showinverse = !showinverse;
    checkInversePropertiesStatus();
}

function cellClick(elem){
    const keycode = $(elem).attr("id");

    $('#clipboardInput').val($(elem).attr("about"));

    $('.cidoccell').removeClass("selectedCell");

    /* HIERARCHY */
    $('#d3container').html("");
    let selectedTreeNode = treegraph.first(function (node) {
        return node.model.code === keycode;
    });

    $(elem).addClass("selectedCell");
    $('#descComment').text(cidoc[keycode]["comment"]);
    $('#descCode').text(keycode);
    $('#descTitle').text(cidoc[keycode]["label"]);
    
    if(keycode.startsWith("P")){
        $('#descDomainRange').show();
        $('#descCodeColor').attr('class', "");
        $('#descDomain').text(cidoc[keycode]["domain"]);
        $('#descProperty').text(cidoc[keycode]["label"]);
        $('#descRange').text(cidoc[keycode]["range"]);
    } else {
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
        addPropertiesAndReferencesToLayout(keycode);
    }
}

function getFilteredCodes(query){
    let corresponding_codes = [];
    $.each(cidoc, function(k,v){
        if(v.label.toUpperCase().includes(query.toUpperCase()) || k.toUpperCase().includes(query.toUpperCase())){
            corresponding_codes.push(k);
        }
    });
    return corresponding_codes;
}

function isEmptyOrSpaces(str){
    return str === null || str.match(/^ *$/) !== null;
}

function filterBySearch(){
    let query = $("#searchinput").val();
    if(isEmptyOrSpaces(query)){
        $('.cidoccell').show();
        checkInversePropertiesStatus();
    } else {
        let query_result = getFilteredCodes(query);
        $('.cidoccell').each(function(){
            if(query_result.includes($(this).attr("id"))){
                if((showinverse && $(this).hasClass("inverseproperty")) || (!showinverse && $(this).hasClass("straightproperty"))){
                    $(this).show();
                }
            } else {
                $(this).hide();
            }
        });
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
    /* TREEMODEL.js sub-optimal solution (with a problem for classes with more than one superclass)
    let superclasses = [];
    let node = treegraph.first(function (node) {
        return node.model.code === code;
    });

    let path = node.getPath();
    $.each(path, function(k,v){
        if ("code" in v.model){
            superclasses.push(v.model.code)
        }
    });
    return superclasses;
     */
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
    //console.log(properties)
    //let htmlstring = "<table class='classPropertiesTable'><thead><tr><th class='thDomain'>Domain</th><th class='thProperty'>Property</th><th class='thRange'>Range</th></thead><tbody><div class='directClassProperties'>" 
    let htmlstring = "<table class='classPropertiesTable'><tbody><div class='directClassProperties'>" 
    $.each(properties, function(index, value){
        htmlstring += "<tr class='classPropertyRow'><td class='tdDomain'>" + code + "</td><td class='tdProperty'><span class='directPropertySpan'>" + cidoc[value].about + "</span></td><td class='tdRange'>" + cidoc[value].range + "</td></tr>";
    })

    //Inherited Properties
    let inheritedProperties = cidoc[code].inheritedProps;
    //console.log(inheritedProperties)
    htmlstring += "<div class='inheritedClassProperties'>" 
    $.each(inheritedProperties, function(index, value){
        $.each(value.props.properties, function(i,ipcode){
            htmlstring += "<tr class='classPropertyRow'><td>" + value.code + "</td><td><span class='inheritedPropertySpan'>" + cidoc[ipcode].about + "</span></td><td>" + cidoc[ipcode].range + "</td></tr>";
        });
    })
    htmlstring += "</div>"
    htmlstring += "</tbody></table>"

    $('#classPropertiesContainer').html(htmlstring)
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
                $('#'+d.data.model.code).click()
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

function highlightSubclassesByClass(code){
    $('.cidoccell').removeClass("highlighted");
    let subclasses = getAllSubclasses(code);
    $.each(subclasses, function(i, subclass){
        //console.log("#"+subclass);
        $('#'+subclass).addClass('highlighted');
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

function classesLayout(code, aclass){
        let color_code = getColorCode(code);

        var html = "<div id='"+ code +"' class='cidoccell classcell " + color_code + "' title='"+ aclass.comment +"' about='"+ aclass.about +"'>";
        //html += "<div class='ccdot' style='background-color:" + color_code + ";'></div>";
        html += "<div class='classsuperclasses'> " + aclass.superclasses.join() + "</div>";
        html += "<div class='classcodes'>" + code + "</div>";
        html += "<div class='classtitle'>" + aclass.label + "</div>";
        html += "<div class='classsubclasses'>" + getAllSubclasses(code) + "</div>";
        html += "</div>";
        $('#classesContainer').append(html);
}

/* PROPERTIES */
function propertiesLayout(code, aproperty){
        let inverseproperty = "straightproperty";

        if(code.endsWith("i")) {
            inverseproperty = "inverseproperty";
        }

        var html = "<div id='"+ code +"' class='cidoccell propertycell "+ inverseproperty + "' title='"+ aproperty.comment +"' about='"+ aproperty.about +"'>";
            html += "<div class='propertysuperproperties'> " + aproperty.superproperties.join() + "</div>";
            html += "<div class='propertycodes'>" + code + "</div>";
            html += "<div class='propertytitle'>" + aproperty.label + "</div>";
            html += "<div class='propertydomain "+ getColorCode(getCode(aproperty.domain)) +"'>" + getCode(aproperty.domain) + "</div>";
            html += "<div class='propertyrange "+ getColorCode(getCode(aproperty.range)) +"'>" + getCode(aproperty.range) + "</div>";
            html += "</div>";
            $('#propertiesContainer').append(html);
}

function generateLayout(){
    $.each(cidoc, function(k,v){
        //If entry is a class (starting with E)
       if(k.startsWith("E")){
           classesLayout(k,v);
       } else {
           propertiesLayout(k,v);
       }
    });
}

