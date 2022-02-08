var cidoc = {};
var treegraph = {};
var showinverse = false;
var experimentMode = false;
var experimentObject = {
    "domain": "",
    "property": "",
    "range":"",
    "selecting":""
}
var waitForSelection = false;


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

        $('#describer').flip({
            trigger: "manual"
        });

        $('#inspectbtn').hide();
        
        //Visualization initializers
        $('#propertiesContainer').hide();
        $('#classesbtn').hide();
        $('#descDomainRange').hide();
        $('#toggleInverseBtn').hide();
        $('#descDomainRangeSeparator').hide();
        checkInversePropertiesStatus();
        
        //Add click listeners
        $('.cidoccell').click(function(){cellClick($(this))});

        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);
        const code = urlParams.get('code')
        console.log(code);
        if(code !== null){
            $('[code="' + code + '"]').click();
        } else {
            //Show first class as first
            $('[code="E1"]').click();
        }


    });

    $('#showHierarchyTree').click(function(){
        $('#hierarchyModal').modal('show');
    });

    $('#experimentbtn').click(function(){
        $('#describer').flip('toggle');
        experimentMode = true;
        $('#experimentbtn').hide();
        $('#inspectbtn').show();
        $( ".front" ).animate({
            opacity: 0,
        }, 200);
        $( ".back" ).animate({
           opacity: 1,
        }, 200);
    });

    $('#inspectbtn').click(function(){
        $('#describer').flip('toggle');
        experimentMode = false;
        $('#inspectbtn').hide();
        $('#experimentbtn').show();
        $( ".front" ).animate({
            opacity: 1,
        }, 200);
        $( ".back" ).animate({
           opacity: 0,
        }, 200);
    });

    $('#experiment_domain_add').click(function(){
        experimentAdd("domain");
    });

    $('#experiment_property_add').click(function(){
        experimentAdd("property");
    });

    $('#experiment_range_add').click(function(){
        experimentAdd("range");
    });

    $('#experiment_domain_remove').click(function(){
        experimentRemove("domain");
    })
    $('#experiment_property_remove').click(function(){
        experimentRemove("property");
    })
    $('#experiment_range_remove').click(function(){
        experimentRemove("range");
    });

    $('.experiment_remove').hide();
    $('#experiment_description').hide();
    $('#experiment_code_container').hide();

    $(document).keyup(function(e) {
        if (e.key === "Escape") { // escape key maps to keycode `27`
           experimentSelectionMode("","off");
       }
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
        copyToClipboard("inspect");
    });

    $('#toggleInverseBtn').click(function(){
        let previouslyDisplayedCode = currentlyShownCellCode();
            if(previouslyDisplayedCode.endsWith("i")){
                let straightcode = previouslyDisplayedCode.substring(0, previouslyDisplayedCode.length -1);
                if(cidoc[straightcode]){
                    cellClick(straightcode, true);
                } else {
                    cellClick("[code='P1']");
                }
            } else {
                let inversecode = previouslyDisplayedCode + "i";
                if(cidoc[inversecode]){
                    cellClick(inversecode, true);
                } else {
                    cellClick("[code='P1i']");
                }
            }
    });

    $("#searchinput").on('input', function(){
        filterBySearch();
    });

    /* TOP FIXER SCROLL */
    // var fixmeTop = $('#describer').offset().top;
    // $(window).scroll(function() {
    //     var currentScroll = $(window).scrollTop();
    //     if (currentScroll >= fixmeTop) {
    //         $('#describer').css({
    //             position: 'fixed',
    //             top: '0',
    //             right: '20px'
    //         });
    //     } else {
    //         $('#describer').css({
    //             position: 'static'
    //         });
    //     }
    // });
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
    $('.experimental').show();
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
    if(isCidocProperty(code)){
        $('.belongsToClasses').hide();
        $('.belongsToProperties').show();
        setInversePropertiesStatus(code.endsWith("i"));
        checkInversePropertiesStatus();
    } else if (isCidocClass(code)){
        $('.belongsToClasses').show();
        $('.belongsToProperties').hide();
    }
}

function isCidocName(string){
    let regex = /^[E,P,L,D]\d{1,3}.*\_.*/gm
    return(regex.test(string));
}

//TODO: genera dinamicamente prime lettere
function isCidocCode(code){
    let regex = /^[E,P,L,D]\d{1,3}/gm
    return(regex.test(code))
}

function isCidocClass(code){
    //TODO: dinamically find letters and kind from json
    return (code.startsWith("E") || code.startsWith("D"));
}

function isCidocProperty(code){
    return (code.startsWith("P") || code.startsWith("L"));
}

function getCode(cidocName){
    if(isCidocClass(cidocName) || isCidocProperty(cidocName)){
        return cidocName.split("_")[0];
    } else {
        console.log("ERROR: " + cidocName + " is not a cidoc Name!")
    }
}

function getCompatibleClassesByProperty(){
    let experimentSelectables = [];
    let pcode = experimentObject["property"];
    let pdomain_or_range_list = [cidoc[pcode][experimentObject.selecting]];
    let pdomain_or_range_code = pdomain_or_range_list[0]; 
    
    if(isCidocName(pdomain_or_range_code)){
        pdomain_or_range_code = getCode(pdomain_or_range_list[0]);
        pdomain_or_range_list[0] = pdomain_or_range_code;
        let subclasses = getAllRecursiveSubclassesWrapper(pdomain_or_range_code);
        console.log("subclasses")
        console.log(subclasses)
        pdomain_or_range_list = pdomain_or_range_list.concat(subclasses);
    }

    $.each(cidoc, function(key, value){
        if(isCidocClass(key)){
            if(pdomain_or_range_list.includes(key)){
                experimentSelectables.push(key);
            }
        }
    });

    // console.log("Here's the experiment selectables:")
    // console.log(experimentSelectables);
    return experimentSelectables;
}

function getCompatiblePropertiesByClasses(){
    let experimentSelectables = [];
//    console.log( experimentObject)
    $.each(cidoc,function(key,value){
        if(isCidocProperty(key)){
            if(experimentObject.range !== "" && experimentObject.domain !== ""){
                let domain_subclasses_list = []
                let range_subclasses_list = []
                if(isCidocName(value.domain)){
                    let domain_code = getCode(value.domain);
                    domain_subclasses_list = getAllRecursiveSubclassesWrapper(domain_code)
                    domain_subclasses_list.push(domain_code)
                }
                if(isCidocName(value.range)){
                    let range_code = getCode(value.range);
                    range_subclasses_list = getAllRecursiveSubclassesWrapper(range_code)
                    range_subclasses_list.push(range_code)
                }
                // console.log("range_subclasses_list")
                // console.log(range_subclasses_list)
                // console.log("domain_subclasses_list")
                // console.log(domain_subclasses_list)
                // console.log("experimentObject")
                // console.log(experimentObject)

                if(domain_subclasses_list.includes(experimentObject.domain) && range_subclasses_list.includes(experimentObject.range)){
                    experimentSelectables.push(key);
                }
            } else if (experimentObject.range == "" && experimentObject.domain == ""){
                $.each(cidoc, function(k,v){
                    experimentSelectables.push(k);
                });
            } else {
                if(experimentObject.domain !== ""){
                    if(isCidocName(value.domain)){
                        let domain_code = getCode(value.domain);
                        let subclasses_list = getAllRecursiveSubclassesWrapper(domain_code)
                        subclasses_list.push(domain_code)
                        if(subclasses_list.includes(experimentObject.domain)){
                            if(experimentSelectables.indexOf(key) === -1) experimentSelectables.push(key);
                        }
    
                    }
                }
                if(experimentObject.range !== ""){
                    if(isCidocName(value.range)){
                        let range_code = getCode(value.range);
                        let subclasses_list = getAllRecursiveSubclassesWrapper(range_code)
                        subclasses_list.push(range_code)
                        if(subclasses_list.includes(experimentObject.range)){
                            if (experimentSelectables.indexOf(key) === -1) experimentSelectables.push(key);
                        }
                    }
                }
            }
        }
    })
    // console.log("Experiment Selectables")
    // console.log(experimentSelectables);
    return experimentSelectables;
}

function experimentSelectionMode(onOrOff){
    if(onOrOff == "on"){
        waitForSelection = true;
        if(experimentObject.selecting == "domain" || experimentObject.selecting == "range" ){
            $('.belongsToClasses').show();
            $('.belongsToProperties').hide();
        } else {
            $('.cidoccell').show();
            $('.belongsToClasses').hide();
            $('.belongsToProperties').show();
        }

        let experimentSelectables = [];

        if(experimentObject.selecting == "property"){
            experimentSelectables = getCompatiblePropertiesByClasses();

        } else {
            if(experimentObject["property"] == ""){
                $('#classesContainer > .classcell').each(function(){
                    $(this).removeClass('selectedCell')
                    $(this).removeClass('highlighted');
                    experimentSelectables.push($(this).attr("code"));
                });
            } else {
                experimentSelectables = getCompatibleClassesByProperty();
            }
    
            // console.log("experimentSelectables")
            // console.log(experimentSelectables)
        }

            
        $.each(cidoc, function(k,v){
            if(experimentSelectables.includes(k)){
                $('[code="'+k+'"]').addClass("experimentallyHighlighted");
            } else {
                $('[code="'+k+'"]').addClass("experimentallyNotHighlighted");
            }
        });

        $('#describer').addClass("experimentallyNotHighlighted");
        $('#menuRow').addClass("experimentallyNotHighlighted");
        $('#menuHr').addClass("experimentallyNotHighlighted");

    //If turning off
    } else {
        waitForSelection = false;
        $('*').removeClass("experimentallyNotHighlighted");
        $('*').removeClass("experimentallyHighlighted");
        experimentObject["selecting"] = "";
        $('[code="E1"]').click();
        experimentDescriptionUpdate();
        $('.experimental').show();
    }
}

function experimentAdd(triplePart){
    //let propertyLayout = propertiesLayout("P1", true);
    experimentObject.selecting = triplePart;
    $('#clipboardMessage').text("Select a " + experimentObject.selecting + ".");
    $("#clipboardMessage").fadeIn(150, function(){$("#clipboardMessage").fadeOut(3000)});
    experimentSelectionMode("on");
}

function experimentRemove(triplePart){
    experimentObject[triplePart] = "";
    $('#experiment_'+ triplePart).find('.cidoccell').remove();
    $('#experiment_'+  triplePart + '_remove').hide();
    $('#experiment_'+  triplePart + '_add').show();
    experimentDescriptionUpdate();
}

function startsWithVowel(word){
    var vowels = ("aeiouAEIOU"); 
    return vowels.indexOf(word[0]) !== -1;
 }

function experimentDescriptionUpdate(){
    if(experimentObject.domain !== "" && experimentObject.property !== "" && experimentObject.range !== ""){
        let domain = cidoc[experimentObject.domain].label;
        let property = cidoc[experimentObject.property].label;
        let range = cidoc[experimentObject.range].label;


        property_nl = property.startsWith("has ") ? property.replace("has ", "has, as a ")+"," : property;
        property_nl = property.startsWith("had ") ? property.replace("had ", "had, as a ")+"," : property;

        let domainArticle = startsWithVowel(domain) ? "an " : "a ";
        let rangeArticle = startsWithVowel(range) ? "an " : "a ";

        let template = "This triple asserts that ";
        template += domainArticle + domain + " " + property_nl + " " + rangeArticle + range + ".";
    
        $('#experiment_description').hide()
        $('#experiment_description').html(template)
        $('#experiment_description').fadeIn(1000);


        /* TRIPLE CODE */

        let experiment_code_string = "crm:" + cidoc[experimentObject.domain].about + " crm:" + cidoc[experimentObject.property].about + " crm:" + cidoc[experimentObject.range].about + "."

        $('#experiment_code').html(experiment_code_string);
        $('#experiment_code_container').fadeIn(1000);
    } else {
        $('#experiment_description').fadeOut(400);
        $('#experiment_code_container').fadeOut(400);
    }
}

function cellClick(elem, simulated=false){
    if(waitForSelection && experimentMode){
        // console.log('experiment_' + experimentObject["selecting"]);
        let code = $(elem).attr("code");
        let layout = experimentObject.selecting == "property" ? propertiesLayout(code, true) : classesLayout(code, true);
        $('#experiment_' + experimentObject["selecting"]).append(layout);
        experimentObject[experimentObject.selecting] = code;
        // console.log($('#experiment_'+ experimentObject["selecting"] + '_remove').length);
        $('#experiment_'+ experimentObject["selecting"] + "_remove").show();
        $('#experiment_'+ experimentObject["selecting"] + "_add").hide();
        experimentSelectionMode("off");
    } else {
        $("#searchinput").val("");
        filterBySearch("");
        let keycode;
        $('.cidoccell').removeClass("selectedCell");
    
        if(simulated){
            keycode = elem;
        } else {
            keycode = $(elem).attr("code");
        }

        var refresh = window.location.protocol + "//" + window.location.host + window.location.pathname + '?code=' + keycode;    
        window.history.pushState({ path: refresh }, '', refresh);
    
        //window.location.href = '?code=' + keycode;
    
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
        
        if(isCidocProperty(keycode)){
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
            $('#descProperty').html(propertiesLayout(keycode));
            $('.cidoccell').unbind("click");
            $('.cidoccell').click(function(){cellClick($(this))});
    
            //Sometimes we have RDF classes as domain or range. We need to check that before casting the cidoc class layout
            if(isCidocName(cidoc[keycode]["domain"])){
                $('#descDomain').html(classesLayout(getCode(cidoc[keycode]["domain"])));
                $('.cidoccell').click(function(){cellClick($(this))});
            } else {
                $('#descDomain').html(nonCidocClassesLayout(cidoc[keycode]["domain"]));
            }
            if(isCidocName(cidoc[keycode]["range"])){
                $('#descRange').html(classesLayout(getCode(cidoc[keycode]["range"])));
                $('.cidoccell').click(function(){cellClick($(this))});
            } else {
                $('#descRange').html(nonCidocClassesLayout(cidoc[keycode]["range"]));
            }
    
        } else if (isCidocClass(keycode)) {
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
}

function getSearchedCodes(query){
    let corresponding_codes = [];
    $.each(cidoc, function(k,v){
        // console.log(k)
        // console.log(v)
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
        let query_result = getSearchedCodes(query);
        console.log(query_result);
        $('.cidoccell').each(function(){
            if(query_result.includes($(this).attr("code"))){
                $(this).show();
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
       if(isCidocProperty(k)){
            if(isCidocName(v.domain)){
                if(getCode(v.domain) === code){
                    props.properties.push(k);
                }
            }
            if(isCidocName(v.range)){
                if(getCode(v.range) === code){
                    props.references.push(k);
                }
            }
       }
    });
    return props;
}

function addPropertiesAndReferencesToJson(){
    $.each(cidoc, function(k,v){
        if(isCidocClass(k)){
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
        if(isCidocClass(k)){
            $.each(cidoc_colorcodes, function(superclass, value){
                if(hasSuperclass(k, superclass)){
                    colorcodes.push(value)
                }
            })
            cidoc[k]["colorcodes"] = colorcodes;
        }
    });

    $.each(cidoc, function(k,v){
        if(isCidocClass(k)){
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
        let range;
        if (isCidocName(cidoc[value].range)){
            range = classesLineLayout(getCode(cidoc[value].range));
        } else {
            range = nonCidocConversion(cidoc[value].range);
        }

        htmlstring += "<tr class='classPropertyRow'>";
        htmlstring += "<td class='tdDomain'>" +  classesLineLayout(code) + "</td>";
        htmlstring += "<td class='tdProperty'><span class='directPropertySpan' onclick='cellClick(\""+ value +"\", true)'>" + propertiesLineLayout(value) + "</span></td>";
        htmlstring += "<td class='tdRange'>" + range + "</td></tr>";
    })
    //Inherited Properties
    let inheritedProperties = cidoc[code].inheritedProps;
    htmlstring += "<div class='inheritedClassProperties'>" 
    $.each(inheritedProperties, function(index, value){
        $.each(value.props.properties, function(i,ipcode){
            let range;
            if (isCidocName(cidoc[ipcode].range)){
                range = classesLineLayout(getCode(cidoc[ipcode].range));
            } else {
                range = nonCidocConversion(cidoc[ipcode].range);
            }
    
            htmlstring += "<tr class='classPropertyRow'><td>" + classesLineLayout(value.code) + "</td><td><span class='inheritedPropertySpan' onclick='cellClick(\""+ ipcode +"\", true)'>" + propertiesLineLayout(ipcode) + "</span></td><td>" + range + "</td></tr>";
        });
    })
    htmlstring += "</div>"
    htmlstring += "</tbody></table>"

    let htmlstring2 = "";
    //References
    let references = cidoc[code].props[0].props.references;
    htmlstring2 += "<table class='classReferencesTable'><tbody><div class='directClassReferences'>" 
    $.each(references, function(index, value){
        let domain;
        if (isCidocName(cidoc[value].domain)){
            domain = classesLineLayout(getCode(cidoc[value].domain));
        } else {
            domain = nonCidocConversion(cidoc[value].domain);
        }

        let range;
        if (isCidocName(cidoc[value].range)){
            range = classesLineLayout(getCode(cidoc[value].range));
        } else {
            range = nonCidocConversion(cidoc[value].range);
        }
        htmlstring2 += "<tr class='classReferenceRow'><td class='tdDomain'>" + domain + "</td><td class='tdProperty'><span class='directReferenceSpan' onclick='cellClick(\""+ value +"\", true)'>" + propertiesLineLayout(value) + "</span></td><td class='tdRange'>" + range + "</td></tr>";
    })

    //Inherited References
    if(cidoc[code].inheritedProps[0]){
        let inheritedReferences = cidoc[code].inheritedProps;
        htmlstring2 += "<div class='inheritedClassReferences'>" 
        $.each(inheritedReferences, function(index, value){
            $.each(value.props.references, function(i,ipcode){
                let domain;
                if (isCidocName(cidoc[ipcode].domain)){
                    domain = classesLineLayout(getCode(cidoc[ipcode].domain));
                } else {
                    domain = nonCidocConversion(cidoc[ipcode].domain);
                }

                let range;
                range = classesLineLayout(value.code);
                
                htmlstring2 += "<tr class='classReferenceRow'><td class='tdDomain'>" + domain  + "</td><td class='tdProperty'><span class='inheritedReferenceSpan' onclick='cellClick(\""+ ipcode +"\", true)'>" + propertiesLineLayout(ipcode) + "</span></td><td class='tdRange'>" + range + "</td></tr>";
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
            if(isCidocClass(k)){
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

function highlightSubclassesByClass(code){
    $('.cidoccell').removeClass("highlighted");
    let subclasses = getAllRecursiveSubclassesWrapper(code);
    $.each(subclasses, function(i, subclass){
        $('[code="'+subclass+'"]').addClass('highlighted');
    });
}

function takeDataFromEntry(entry){
    let currentcode = {}
    if(isCidocName(entry["-rdf:about"])){
        currentcode = getCode(entry["-rdf:about"]);
    }
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

function copyToClipboard(what){
    if(what == "code"){
        let copyText = $('#experiment_code').text();
        navigator.clipboard.writeText(copyText);
        $('#clipboardMessage').text("Copied triple to clipboard.");
        $("#clipboardMessage").fadeIn(150, function(){$("#clipboardMessage").fadeOut(3000)});
    } else {
        let copyText = $('#clipboardInput').val();
        navigator.clipboard.writeText(copyText);
        $('#clipboardMessage').text("Copied \"" + copyText + "\" to clipboard.");
        $("#clipboardMessage").fadeIn(150, function(){$("#clipboardMessage").fadeOut(3000)});
    }
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

function getColorCode(code){
    let color_code = "none"
    if(isCidocClass(code)){
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

function classesLayout(code, experiment=false){
    if(isCidocCode(code)){
        let color_code = getColorCode(code);
        let classObject = cidoc[code];
        let experimentClass = experiment ? "experimental": "";
        let onClick = experiment ? "onClick='experimentRemove(\""+ experimentObject.selecting + "\")'" : "";

        var html = "<div code='"+ code +"' class='cidoccell classcell " + color_code + " " + experimentClass + "' " + onClick + "title='"+ classObject.comment +"' about='"+ classObject.about +"'>";
        //html += "<div class='ccdot' style='background-color:" + color_code + ";'></div>";
        html += "<div class='classsuperclasses'> " + classObject.superclasses.join() + "</div>";
        html += "<div class='classcodes'>" + code + "</div>";
        html += "<div class='classlevel level" + getClassLevel(code, 0) + "'></div>";
        html += "<div class='classtitle'>" + classObject.label + "</div>";
        html += "<div class='classsubclasses'>" + getAllSubclasses(code) + "</div>";
        html += "</div>";
        return html;
    }
}

function classesLineLayout(code){
    let color_code = getColorCode(code);
    let html = "<div code='" + code + "' class='cidocline classline " + color_code + " title='"+ cidoc[code].comment +"'>";
    html += "<span class='cidoclineCode'>" + code + "</span>";
    html += "<span class='cidoclineLabel'>" + cidoc[code].label + "</span>";
    html += "</div>"
    return html;
}

function propertiesLineLayout(code){
    //NON-CIDOC management
    let propertyDomainCode
    let propertyRangeCode
    if(isCidocName(cidoc[code].domain)){
        propertyDomainCode = getCode(cidoc[code].domain)
    } else {
        propertyDomainCode = nonCidocConversion(cidoc[code].domain)
    }
    if(isCidocName(cidoc[code].range)){
        propertyRangeCode = getCode(cidoc[code].range)
    } else {
        propertyRangeCode = nonCidocConversion(cidoc[code].range)
    }
    
    //Build template
    let html = "<div code='" + code + "' class='cidocline propertyline' title='"+ cidoc[code].comment +"'>";
    html += "<div class='cidoclineDomain "+ getColorCode(propertyDomainCode) +"'></div>"
    html += "<div class='cidoclineName'><span class='cidoclineCode'>" + code + "</span>";
    html += "<span class='cidoclineLabel'>" + cidoc[code].label + "</span></div>";
    html += "<div class='cidoclineRange " + getColorCode(propertyRangeCode) + "'></div>"
    html += "</div>"
    return html;
}

function nonCidocConversion(string){
    if(string.startsWith("http://")){
        return string.split("#")[1];
    }
}

function nonCidocClassesLayout(string){
    let resultString = nonCidocConversion(string);
    return "<div class='nonCidocCode'>" + resultString + "</div>";
}

/* PROPERTIES */
function propertiesLayout(code, experimental=false){
        let aproperty = cidoc[code];
        let propertyDirection = "straightproperty";
        if(code.endsWith("i")) {
            propertyDirection = "inverseproperty";
        }

        let experimentalClass = experimental ? "experimental" : "";
        let onClick = experimental ? "onClick='experimentRemove(\""+ experimentObject.selecting + "\")'" : "";


        //NON-CIDOC management
        if(isCidocName(aproperty.domain)){
            propertyDomainCode = getCode(aproperty.domain)
        } else {
            propertyDomainCode = nonCidocConversion(aproperty.domain)
        }

        if(isCidocName(aproperty.range)){
            propertyRangeCode = getCode(aproperty.range)
        } else {
            propertyRangeCode = nonCidocConversion(aproperty.range)
        }

        propertyDomainLabel = "";
        propertyRangeLabel = "";

        if(isCidocClass(propertyDomainCode)){
            propertyDomainLabel = cidoc[propertyDomainCode].label;
        }
        if(isCidocClass(propertyRangeCode)){
            propertyRangeLabel = cidoc[propertyRangeCode].label;
        }



        var html = "<div code='"+ code +"' class='cidoccell propertycell "+ propertyDirection + " " + experimentalClass + "' "+ onClick +" title='"+ aproperty.comment +"' about='"+ aproperty.about +"'>";
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
       if(isCidocClass(k)){
        $('#classesContainer').append(classesLayout(k));
       } else {
        $('#propertiesContainer').append(propertiesLayout(k));
       }
    });
}

