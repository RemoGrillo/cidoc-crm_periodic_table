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

/* The describer card has three modes: the front face (inspect) and two
   panels on the back face (experiment, path finder). One menu button opens
   the back face; the tabs inside switch between the two back panels. */
var describerMode = "inspect";
var lastBackMode = "experiment";
var pathfinderMode = false;
var pathObject = {
    "start": "",
    "end": "",
    "selecting": ""
}


//Higher-level color families: anchor class -> CSS class name (colors live in
//style.css as --<label> custom properties, the single source of truth).
const cidoc_colorcodes = {
    "E4":  { label: "TemporalEntity" },
    "E18": { label: "PhysicalThings" },
    "E39": { label: "Actors" },
    "E28": { label: "ConceptualObjects" },
    "E41": { label: "Appellations" },
    "E53": { label: "Places" },
    "E55": { label: "Types" }
}

/* ONTOLOGY REGISTRY */

const ONTOLOGIES = {
    crm:    { label: "CRM",       prefix: "crm",    ns: "http://www.cidoc-crm.org/cidoc-crm/",         cssClass: "ont-crm",    order: 0 },
    crminf: { label: "CRMinf",    prefix: "crminf", ns: "http://www.cidoc-crm.org/extensions/crminf/", cssClass: "ont-crminf", order: 1 },
    crmdig: { label: "CRMdig",    prefix: "crmdig", ns: "http://www.cidoc-crm.org/extensions/crmdig/", cssClass: "ont-crmdig", order: 2 }
};

//Code letter -> kind and home ontology (E7 -> crm class, J2 -> crminf property...)
const CODE_PREFIXES = {
    E: { kind: "class",    ont: "crm" },
    P: { kind: "property", ont: "crm" },
    I: { kind: "class",    ont: "crminf" },
    J: { kind: "property", ont: "crminf" },
    D: { kind: "class",    ont: "crmdig" },
    L: { kind: "property", ont: "crmdig" }
};

//Which extension release goes with which base release (verified against the
//official RDFS files: CRMinf 1.2.1 and CRMdig 5.0 both target CIDOC CRM 7.1.x).
const VERSIONS = {
    "7.1": {
        base: "cidoc7.1.json",
        extensions: {
            crminf: { file: "crminf1.2.1.json", version: "1.2.1", status: "available", note: "CRMinf 1.2.1 (Stable), targets CIDOC CRM 7.1.3" },
            crmdig: { file: "crmdig5.0.json",   version: "5.0",   status: "available", note: "CRMdig 5.0 (Stable), targets CIDOC CRM 7.1.3" }
        }
    },
    "6.2.1": {
        base: "cidoc6.2.1.json",
        extensions: {
            crminf: { status: "unavailable", note: "CRMinf machine-readable releases require CIDOC CRM 7.1.x (switch version to 7.1)" },
            crmdig: { status: "unavailable", note: "CRMdig 5.0 requires CIDOC CRM 7.1.x (switch version to 7.1)" }
        }
    }
};

var currentVersion = "7.1";
var enabledOntologies = { crm: true, crminf: false, crmdig: false };

function ontologyOf(code){
    if(cidoc[code] && cidoc[code].ontology) return cidoc[code].ontology;
    let prefixEntry = CODE_PREFIXES[String(code)[0]];
    return prefixEntry ? prefixEntry.ont : null;
}

function isOntologyEnabled(ont){
    return enabledOntologies[ont] === true;
}

//Loaded AND belonging to an enabled ontology
function isEntryVisible(code){
    if(!cidoc[code]) return false;
    let ont = ontologyOf(code);
    return ont === null ? true : isOntologyEnabled(ont);
}

//First visible class or (straight) property, in table order: replaces the
//hardcoded E1/P1 fallbacks, which stop existing when CIDOC CRM is toggled off.
function firstVisibleCode(kind){
    let found = null;
    $.each(cidoc, function(k,v){
        if(found) return;
        let matches = (kind === "class") ? isCidocClass(k) : (isCidocProperty(k) && !k.endsWith("i"));
        if(matches && isEntryVisible(k)){
            found = k;
        }
    });
    return found;
}

function turtlePrefixFor(code){
    let ont = ontologyOf(code);
    return (ont && ONTOLOGIES[ont]) ? ONTOLOGIES[ont].prefix : "crm";
}

$(document).ready(function(){
    $('#cidocVersionSelect').on('change', function() {
        mainStart($(this).val());
    });

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

    $('#showHierarchyTree').click(function(){
        $('#hierarchyModal').modal('show');
    });

    //Single menu entry point to the back face; the tabs inside switch sub-modes
    $('#exploreBtn').click(function(){
        setDescriberMode(lastBackMode);
    });

    $('#inspectbtn').click(function(){
        setDescriberMode("inspect");
    });

    $('#experimentTab').click(function(){
        setDescriberMode("experiment");
    });

    $('#pathTab').click(function(){
        setDescriberMode("path");
    });

    /* PATH FINDER controls */
    $('#path_start_add').click(function(){
        pathObject.selecting = "start";
        $('#clipboardMessage').text("Select a starting class.");
        $("#clipboardMessage").fadeIn(150, function(){$("#clipboardMessage").fadeOut(3000)});
        pathSelectionMode("on");
    });
    $('#path_end_add').click(function(){
        pathObject.selecting = "end";
        $('#clipboardMessage').text("Select a target class.");
        $("#clipboardMessage").fadeIn(150, function(){$("#clipboardMessage").fadeOut(3000)});
        pathSelectionMode("on");
    });
    $('#path_start_remove').click(function(){ pathRemove("start"); });
    $('#path_end_remove').click(function(){ pathRemove("end"); });
    $('#pathDepthSelect').on('change', runPathSearchIfReady);
    $('#pathLooseCheckbox').on('change', runPathSearchIfReady);

    //Hovering a result shows its path on the periodic table
    $(document).on('mouseenter', '.pathResultChain', function(){
        let codes = ($(this).attr('data-codes') || "").split(",");
        codes.forEach(function(code){
            $('#classesContainer [code="' + code + '"], #propertiesContainer [code="' + code + '"]').addClass('pathHighlighted');
        });
        $('body').addClass('pathHovering');
    });
    $(document).on('mouseleave', '.pathResultChain', function(){
        $('.pathHighlighted').removeClass('pathHighlighted');
        $('body').removeClass('pathHovering');
    });

    //Accordion: collapse/expand a step group
    $(document).on('click', '.pathGroupHeader', function(){
        $(this).closest('.pathGroup').toggleClass('pathGroupCollapsed');
    });

    //Clicking a chip in a result opens it in the describer
    $(document).on('click', '.pathResultChain .cidocline[code]', function(){
        let code = $(this).attr('code');
        setDescriberMode("inspect");
        cellClick(code, true);
    });

    $(document).on('click', '.pathTurtleCopy', function(e){
        e.stopPropagation();
        let chain = ($(this).closest('.pathResultChain').attr('data-chain') || "").split(",");
        if(chain.length < 3) return;
        navigator.clipboard.writeText(buildInstanceTurtle(chain));
        $('#clipboardMessage').text("Copied path to clipboard as Turtle.");
        $("#clipboardMessage").fadeIn(150, function(){$("#clipboardMessage").fadeOut(3000)});
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
        if (e.key === "Escape") {
            if(pathfinderMode){
                pathSelectionMode("off");
            } else {
                experimentSelectionMode("off");
            }
       }
   });
   $('#classesbtn').click(function(){
        $('.belongsToClasses').show();
        $('.belongsToProperties').hide();
        $('[code="' + firstVisibleCode("class") + '"]').click();
    });
    $('#propertiesbtn').click(function(){
        $('.belongsToClasses').hide();
        $('.belongsToProperties').show();
        $('[code="' + firstVisibleCode("property") + '"]').click();
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
                    cellClick(firstVisibleCode("property"), true);
                }
            } else {
                let inversecode = previouslyDisplayedCode + "i";
                if(cidoc[inversecode]){
                    cellClick(inversecode, true);
                } else {
                    let fallback = firstVisibleCode("property");
                    cellClick(cidoc[fallback + "i"] ? fallback + "i" : fallback, true);
                }
            }
    });

    $("#searchinput").on('input', function(){
        filterBySearch();
    });

    //Single delegated handlers: they survive version switches and re-renders.
    //Experiment-box cells (.experimental) have their own inline remove handler.
    $(document).on('click', '.cidoccell:not(.experimental)', function(){
        cellClick($(this));
    });

    $(document).on('click', '.descsubclass, .descsuperclass', function(){
        let code = $(this).attr("code");
        $('[code="'+code+'"]').click();
    });

    $(document).on('click', '.ontToggle:not(.disabledOntToggle)', function(){
        let ont = $(this).attr("data-ont");
        setOntologyEnabled(ont, !isOntologyEnabled(ont));
    });

   mainStart();
});

var loadSeq = 0;
var loadedOntologies = {};   //ont id -> true once its file has been merged into cidoc

function mainStart(cidocVersion="7.1"){
    //Stale-response guard: only the latest requested load may render.
    const mySeq = ++loadSeq;

    currentVersion = cidocVersion;

    /* URL state: ?ont=crm,crminf, ?code=I1 and ?path=E21,E53.
       Read BEFORE the reset below: pathClear() rewrites the ?path= param. */
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const ontParam = urlParams.get('ont');
    const pathParam = urlParams.get('path');

    cidoc = {};
    treegraph = {};
    loadedOntologies = {};
    showinverse = false;
    if(describerMode !== "inspect"){
        setDescriberMode("inspect");
    }
    experimentObject = {
        "domain": "",
        "property": "",
        "range":"",
        "selecting":""
    }
    pathObject = {
        "start": "",
        "end": "",
        "selecting": ""
    }
    waitForSelection = false;
    experimentClear();
    pathClear();

    $('#classesContainer').html("");
    $('#propertiesContainer').html("");
    if(ontParam !== null){
        $.each(enabledOntologies, function(ont){ enabledOntologies[ont] = false; });
        ontParam.split(",").forEach(function(ont){
            if(ONTOLOGIES[ont.trim()]) enabledOntologies[ont.trim()] = true;
        });
    }
    //A deep-linked code implies its ontology
    if(code && CODE_PREFIXES[code[0]]){
        enabledOntologies[CODE_PREFIXES[code[0]].ont] = true;
    }
    if(pathParam !== null){
        pathParam.split(",").forEach(function(pathCode){
            if(pathCode && CODE_PREFIXES[pathCode[0]]){
                enabledOntologies[CODE_PREFIXES[pathCode[0]].ont] = true;
            }
        });
    }
    if(Object.keys(enabledOntologies).every(function(ont){ return !enabledOntologies[ont]; })){
        enabledOntologies.crm = true;
    }

    /* Base file + every extension available for this base version.
       All of them are always fetched: the toggles only affect visibility. */
    const versionConfig = VERSIONS[cidocVersion];
    let files = [{ ont: "crm", url: versionConfig.base }];
    $.each(versionConfig.extensions, function(ont, extension){
        if(extension.status === "available"){
            files.push({ ont: ont, url: extension.file });
        }
    });

    Promise.allSettled(files.map(function(f){
        return Promise.resolve($.getJSON(f.url)).then(function(data){ return { ont: f.ont, data: data }; });
    })).then(function(results){
        if(mySeq !== loadSeq) return;

        //allSettled preserves input order, so entries merge grouped by ontology
        results.forEach(function(result, index){
            if(result.status === "fulfilled"){
                parseOntology(result.value.data, result.value.ont);
                loadedOntologies[result.value.ont] = true;
            } else {
                console.warn("Could not load " + files[index].url + ":", result.reason);
            }
        });

        //An ontology that is not loaded cannot stay enabled
        $.each(enabledOntologies, function(ont, enabled){
            if(enabled && !loadedOntologies[ont]) enabledOntologies[ont] = false;
        });
        if(Object.keys(enabledOntologies).every(function(ont){ return !enabledOntologies[ont]; })){
            enabledOntologies.crm = true;
        }

        calculateSubclasses();
        addPropertiesAndReferencesToJson();
        addColorcodesToJson();
        buildPathIndexes();

        generateLayout();
        createTree();

        renderOntologyToggles();
        applyOntologyVisibility();
        checkInversePropertiesStatus();

        if(code !== null && cidoc[code]){
            $('[code="' + code + '"]').click();
        } else {
            //Show first class as first
            $('[code="' + firstVisibleCode("class") + '"]').click();
        }

        //Deep-linked path search (?path=E21,E53)
        if(pathParam !== null){
            let pathCodes = pathParam.split(",");
            if(pathCodes.length === 2 && isCidocClass(pathCodes[0]) && isCidocClass(pathCodes[1])
                && cidoc[pathCodes[0]] && cidoc[pathCodes[1]]){
                setDescriberMode("path");
                setPathSlot("start", pathCodes[0]);
                setPathSlot("end", pathCodes[1]);
            }
        }
    });
}

/* ONTOLOGY TOGGLES */

function renderOntologyToggles(){
    let container = $('#ontologyToggles');
    container.html("");
    let ontOrder = Object.keys(ONTOLOGIES).sort(function(a,b){ return ONTOLOGIES[a].order - ONTOLOGIES[b].order; });
    ontOrder.forEach(function(ont){
        let extension = ont === "crm" ? null : ((VERSIONS[currentVersion].extensions || {})[ont] || { status: "unavailable" });

        let available = loadedOntologies[ont] === true;
        let cssClasses = "ontToggle " + ONTOLOGIES[ont].cssClass;
        //The version lives in the tooltip and in the describer tag, not the chip
        let title = (extension && extension.note) ? extension.note : "";
        if(!available){
            cssClasses += " disabledOntToggle";
            if(!title) title = ONTOLOGIES[ont].label + " is not available for this CIDOC CRM version";
        } else if(isOntologyEnabled(ont)){
            cssClasses += " activeOntToggle";
        }

        container.append(
            "<span class='" + cssClasses + "' data-ont='" + ont + "' title='" + escapeAttr(title) + "'>" +
            "<span class='ontToggleSwatch'></span>" +
            ONTOLOGIES[ont].label +
            "</span>"
        );
    });
}

function setOntologyEnabled(ont, enabled){
    if(!ONTOLOGIES[ont]) return;
    if(enabled && !loadedOntologies[ont]) return;
    if(!enabled && isOntologyEnabled(ont)){
        //Never turn off the last visible ontology
        let enabledCount = Object.keys(enabledOntologies).filter(function(o){ return enabledOntologies[o]; }).length;
        if(enabledCount <= 1) return;
    }
    if(enabledOntologies[ont] === enabled) return;
    enabledOntologies[ont] = enabled;

    applyOntologyVisibility();
    renderOntologyToggles();

    //Experiment and path slots holding entries that are no longer visible are cleared
    ["domain","property","range"].forEach(function(part){
        if(experimentObject[part] !== "" && !isEntryVisible(experimentObject[part])){
            experimentRemove(part);
        }
    });
    ["start","end"].forEach(function(which){
        if(pathObject[which] !== "" && !isEntryVisible(pathObject[which])){
            pathRemove(which);
        }
    });
    runPathSearchIfReady();

    //Keep ?ont= in sync (replace, not push: toggling is not a navigation step)
    let urlParams = syncOntologyUrlParam(new URLSearchParams(window.location.search));
    window.history.replaceState({}, '', window.location.pathname + "?" + urlParams.toString());

    filterBySearch();

    //Refresh the describer: re-select the current cell, or fall back if hidden
    let selected = currentlyShownCellCode();
    if(cidoc[selected] && isEntryVisible(selected)){
        cellClick(selected, true);
    } else if(cidoc[selected]){
        let fallback = firstVisibleCode(isCidocProperty(selected) ? "property" : "class");
        if(fallback) cellClick(fallback, true);
    }
}

function applyOntologyVisibility(){
    $.each(ONTOLOGIES, function(ont, config){
        $('body').toggleClass("hide-ont-" + ont, !isOntologyEnabled(ont));
    });
}

//Writes the enabled set into a URLSearchParams; the default (base CRM only)
//keeps permalinks clean by omitting the parameter.
function syncOntologyUrlParam(urlParams){
    let enabledList = Object.keys(enabledOntologies).filter(function(o){ return enabledOntologies[o]; });
    if(enabledList.length === 1 && enabledList[0] === "crm"){
        urlParams.delete("ont");
    } else {
        urlParams.set("ont", enabledList.join(","));
    }
    return urlParams;
}

//Copy of a TreeModel subtree without the nodes of disabled ontologies
//(kept in the same {model, children} shape the d3 renderers consume)
function visibleTreeCopy(node){
    let copy = { model: node.model, children: [] };
    node.children.forEach(function(child){
        if(isEntryVisible(child.model.code)){
            copy.children.push(visibleTreeCopy(child));
        }
    });
    return copy;
}

function checkInversePropertiesStatus(){
    //Use css('display','') rather than .show(): .show() stamps display:block
    //inline on cells that are CSS-hidden by an ontology filter, which then
    //overrides their inline-grid/inline-block layout once the filter is lifted.
    if(showinverse){
        $('.inverseproperty').css('display', '');
        $('.straightproperty').hide();
        $('#toggleInverseBtn').addClass('activatedInversion');
    } else {
        $('.inverseproperty').hide();
        $('.straightproperty').css('display', '');
        $('#toggleInverseBtn').removeClass('activatedInversion');
    }
    $('.experimental').css('display', '');
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

//Code-shape checks are derived from CODE_PREFIXES, so new ontologies only
//need a registry entry.
function isCidocName(string){
    if(typeof string !== "string") return false;
    let regex = new RegExp("^[" + Object.keys(CODE_PREFIXES).join("") + "]\\d{1,3}.*_.*");
    return regex.test(string);
}

function isCidocCode(code){
    if(typeof code !== "string") return false;
    let regex = new RegExp("^[" + Object.keys(CODE_PREFIXES).join("") + "]\\d{1,3}");
    return regex.test(code);
}

function isCidocClass(code){
    if(!isCidocCode(code)) return false;
    return CODE_PREFIXES[code[0]].kind === "class";
}

function isCidocProperty(code){
    if(!isCidocCode(code)) return false;
    return CODE_PREFIXES[code[0]].kind === "property";
}

function getCode(cidocName){
    if(isCidocClass(cidocName) || isCidocProperty(cidocName)){
        return cidocName.split("_")[0];
    } else {
        console.warn("getCode: " + cidocName + " is not a cidoc Name");
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
        pdomain_or_range_list = pdomain_or_range_list.concat(subclasses);
    }

    $.each(cidoc, function(key, value){
        if(isCidocClass(key)){
            if(pdomain_or_range_list.includes(key)){
                experimentSelectables.push(key);
            }
        }
    });

    return experimentSelectables.filter(function(code){ return isEntryVisible(code); });
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
                //No domain/range constraint: every property is selectable
                experimentSelectables.push(key);
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
    return experimentSelectables.filter(function(code){ return isEntryVisible(code); });
}

function experimentSelectionMode(onOrOff){
    if(onOrOff == "on"){
        waitForSelection = true;
        if(experimentObject.selecting == "domain" || experimentObject.selecting == "range" ){
            $('.belongsToClasses').show();
            $('.belongsToProperties').hide();
        } else {
            $('.cidoccell').css('display', '');
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
                    let cellCode = $(this).attr("code");
                    if(isEntryVisible(cellCode)){
                        experimentSelectables.push(cellCode);
                    }
                });
            } else {
                experimentSelectables = getCompatibleClassesByProperty();
            }
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
        $('[code="' + firstVisibleCode("class") + '"]').click();
        experimentDescriptionUpdate();
        $('.experimental').css('display', '');
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

function experimentClear(){
    let tripleparts = ["domain", "range", "property"];
    for(let partIndex in tripleparts){
        experimentRemove(tripleparts[partIndex]);
    }
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

        property = property.startsWith("has ") ? property.replace("has ", "has, as a ")+"," : property;
        property = property.startsWith("had ") ? property.replace("had ", "had, as a ")+"," : property;

        let domainArticle = startsWithVowel(domain) ? "an " : "a ";
        let rangeArticle = startsWithVowel(range) ? "an " : "a ";

        let template = "This triple asserts that ";
        template += domainArticle + domain + " " + property + " " + rangeArticle + range + ".";
    
        $('#experiment_description').hide()
        $('#experiment_description').html(template)
        $('#experiment_description').fadeIn(1000);


        /* TRIPLE CODE
           A real, parsable Turtle example: CIDOC properties apply to
           INSTANCES, so the snippet builds one instead of asserting a
           (meaningless) triple between the classes themselves. */

        $('#experiment_code').text(buildInstanceTurtle([experimentObject.domain, experimentObject.property, experimentObject.range]));
        $('#experiment_code_container').fadeIn(1000);
    } else {
        $('#experiment_description').fadeOut(400);
        $('#experiment_code_container').fadeOut(400);
    }
}

/* DESCRIBER MODES */

function setDescriberMode(mode){
    if(mode === describerMode) return;
    let wasBack = describerMode !== "inspect";
    let willBack = mode !== "inspect";
    describerMode = mode;
    experimentMode = (mode === "experiment");
    pathfinderMode = (mode === "path");
    if(willBack) lastBackMode = mode;

    //Back face: show one sub-panel, mark the active tab
    $('#experimentContainer').toggleClass('activePanel', mode === "experiment");
    $('#pathfinderContainer').toggleClass('activePanel', mode === "path");
    $('#experimentTab').toggleClass('activeBackTab', mode === "experiment");
    $('#pathTab').toggleClass('activeBackTab', mode === "path");

    //Menu: one entry point to the back, one to return to inspect
    $('#exploreBtn').toggle(mode === "inspect");
    $('#inspectbtn').toggle(mode !== "inspect");

    //Flip only when crossing between the front and the back face
    if(wasBack !== willBack){
        $('#describer').flip('toggle');
        $(".front").animate({ opacity: willBack ? 0 : 1 }, 200);
        $(".back").animate({ opacity: willBack ? 1 : 0 }, 200);
    }
}

/* PATH FINDER
   Finds property chains connecting two classes:
   A -P1-> C1 -P2-> ... -Pn-> B.
   Inverse properties are ordinary entries in the data model, so the graph is
   naturally bidirectional and every hop carries its readable direction. */

const PATH_FRONTIER_CAP = 600;   //beam width per search level
const PATH_RESULTS_CAP = 100;

var propertiesByDomain = {};
var propertiesByRange = {};
var propertySpecificity = {};

function buildPathIndexes(){
    propertiesByDomain = {};
    propertiesByRange = {};
    propertySpecificity = {};
    $.each(cidoc, function(k,v){
        if(!isCidocProperty(k)) return;
        if(!isCidocName(v.domain) || !isCidocName(v.range)) return;
        let domainCode = getCode(v.domain);
        let rangeCode = getCode(v.range);
        if(!cidoc[domainCode] || !cidoc[rangeCode]) return;
        (propertiesByDomain[domainCode] = propertiesByDomain[domainCode] || []).push(k);
        (propertiesByRange[rangeCode] = propertiesByRange[rangeCode] || []).push(k);
        //Deeper domain/range classes = more specific property = ranked higher
        propertySpecificity[k] = getClassLevel(domainCode, 0) + getClassLevel(rangeCode, 0);
    });
}

function upLineage(code){
    return [code].concat(cidoc[code].recursiveSuperclasses || []);
}

function inversePropertyOf(code){
    return code.endsWith("i") ? code.substring(0, code.length - 1) : code + "i";
}

function pathSpecificityScore(props){
    return props.reduce(function(sum, p){ return sum + (propertySpecificity[p] || 0); }, 0);
}

//Bidirectional meet-in-the-middle search. "loose" also allows hops that are
//only valid when the intermediate instance is of a more specific class
//(downcasts, common in real CRM modeling); strict chains are always valid.
function findPaths(startCode, endCode, maxDepth, loose){
    let truncated = false;

    function capLevel(levelPaths){
        if(levelPaths.length > PATH_FRONTIER_CAP){
            truncated = true;
            levelPaths.sort(function(a,b){ return pathSpecificityScore(b.props) - pathSpecificityScore(a.props); });
            return levelPaths.slice(0, PATH_FRONTIER_CAP);
        }
        return levelPaths;
    }

    //Properties applicable to an instance of the given class as SUBJECT
    function outgoing(classCode){
        let lineage = upLineage(classCode);
        if(loose) lineage = lineage.concat(getAllRecursiveSubclassesWrapper(classCode));
        let out = [];
        lineage.forEach(function(c){
            (propertiesByDomain[c] || []).forEach(function(p){
                if(isEntryVisible(p)) out.push(p);
            });
        });
        return out;
    }

    //Properties that can legally have an instance of the given class as OBJECT
    function arrivingAt(classCode){
        let lineage = upLineage(classCode);
        if(loose) lineage = lineage.concat(getAllRecursiveSubclassesWrapper(classCode));
        let res = [];
        lineage.forEach(function(c){
            (propertiesByRange[c] || []).forEach(function(p){
                if(isEntryVisible(p)) res.push(p);
            });
        });
        return res;
    }

    //Properties whose range guarantees (strict) or allows (loose) an instance
    //that can act as subject of a chain starting at headDomainCode
    function prependable(headDomainCode){
        let lineage = [headDomainCode].concat(getAllRecursiveSubclassesWrapper(headDomainCode));
        if(loose) lineage = lineage.concat(cidoc[headDomainCode].recursiveSuperclasses || []);
        let res = [];
        lineage.forEach(function(c){
            (propertiesByRange[c] || []).forEach(function(p){
                if(isEntryVisible(p)) res.push(p);
            });
        });
        return res;
    }

    let maxForward = Math.ceil(maxDepth / 2);
    let maxBackward = Math.floor(maxDepth / 2);

    //Forward frontier: partial chains from the start class
    let forward = [[{ props: [], end: startCode }]];
    for(let f = 1; f <= maxForward; f++){
        let next = [];
        forward[f-1].forEach(function(state){
            outgoing(state.end).forEach(function(p){
                if(state.props.length && p === inversePropertyOf(state.props[state.props.length - 1])) return;
                next.push({ props: state.props.concat([p]), end: getCode(cidoc[p].range) });
            });
        });
        forward.push(capLevel(next));
    }

    //Backward frontier: chain suffixes that legally end on the target class
    let backward = [[]];
    if(maxBackward >= 1){
        backward.push(capLevel(arrivingAt(endCode).map(function(p){
            return { props: [p], head: getCode(cidoc[p].domain) };
        })));
        for(let b = 2; b <= maxBackward; b++){
            let next = [];
            backward[b-1].forEach(function(state){
                prependable(state.head).forEach(function(q){
                    if(q === inversePropertyOf(state.props[0])) return;
                    next.push({ props: [q].concat(state.props), head: getCode(cidoc[q].domain) });
                });
            });
            backward.push(capLevel(next));
        }
    }

    //Join the frontiers, one total length at a time
    let results = [];
    let seen = new Set();
    function pushResult(props){
        let key = props.join(",");
        if(seen.has(key)) return;
        seen.add(key);
        results.push(props);
    }

    for(let totalLength = 1; totalLength <= maxDepth; totalLength++){
        let f = Math.ceil(totalLength / 2);
        let b = totalLength - f;
        if(f >= forward.length || b >= backward.length) continue;

        if(b === 0){
            //Forward-only: does the last hop legally reach the target?
            forward[f].forEach(function(state){
                let ok = upLineage(endCode).includes(state.end)
                    || (loose && getAllRecursiveSubclassesWrapper(endCode).includes(state.end));
                if(ok) pushResult(state.props);
            });
        } else {
            let suffixesByHead = {};
            backward[b].forEach(function(suffix){
                (suffixesByHead[suffix.head] = suffixesByHead[suffix.head] || []).push(suffix);
            });
            forward[f].forEach(function(state){
                let joinClasses = upLineage(state.end);
                if(loose) joinClasses = joinClasses.concat(getAllRecursiveSubclassesWrapper(state.end));
                joinClasses.forEach(function(joinClass){
                    (suffixesByHead[joinClass] || []).forEach(function(suffix){
                        if(state.props.length && suffix.props[0] === inversePropertyOf(state.props[state.props.length - 1])) return;
                        pushResult(state.props.concat(suffix.props));
                    });
                });
            });
        }
    }

    results.sort(function(a,b){
        return a.length - b.length || pathSpecificityScore(b) - pathSpecificityScore(a);
    });
    let total = results.length;
    if(results.length > PATH_RESULTS_CAP){
        truncated = true;
        results = results.slice(0, PATH_RESULTS_CAP);
    }
    return { paths: results, truncated: truncated, total: total };
}

//Classes to display between the hops: the range of each property, or the next
//property's domain when it is more specific (only possible in loose mode)
function pathDisplayChain(startCode, endCode, props){
    let chain = [startCode];
    for(let i = 0; i < props.length; i++){
        if(i === props.length - 1){
            chain.push(props[i], endCode);
        } else {
            let rangeCode = getCode(cidoc[props[i]].range);
            let nextDomainCode = getCode(cidoc[props[i+1]].domain);
            let intermediate = (nextDomainCode !== rangeCode && upLineage(nextDomainCode).includes(rangeCode))
                ? nextDomainCode : rangeCode;
            chain.push(props[i], intermediate);
        }
    }
    return chain;
}

//Parsable, instance-based Turtle for a chain [class, prop, class, prop, ...]
function buildInstanceTurtle(chain){
    let usedOntologies = [];
    chain.forEach(function(code){
        let ont = ontologyOf(code);
        if(ont && ONTOLOGIES[ont] && !usedOntologies.includes(ont)) usedOntologies.push(ont);
    });

    let lines = usedOntologies.map(function(ont){
        return "@prefix " + ONTOLOGIES[ont].prefix + ": <" + ONTOLOGIES[ont].ns + "> .";
    });
    lines.push("@prefix ex: <http://example.org/> .");
    lines.push("");

    function term(code){ return turtlePrefixFor(code) + ":" + cidoc[code].about; }

    let body = "ex:example_1 a " + term(chain[0]);
    let openBrackets = 0;
    for(let i = 1; i < chain.length; i += 2){
        body += " ;\n" + "    ".repeat((i + 1) / 2) + term(chain[i]) + " [ a " + term(chain[i+1]);
        openBrackets++;
    }
    body += " ]".repeat(openBrackets) + " .";
    lines.push(body);
    return lines.join("\n");
}

function pathSelectionMode(onOrOff){
    if(onOrOff == "on"){
        waitForSelection = true;
        $('.belongsToClasses').show();
        $('.belongsToProperties').hide();
        $.each(cidoc, function(k,v){
            if(isCidocClass(k) && isEntryVisible(k)){
                $('[code="'+k+'"]').addClass("experimentallyHighlighted");
            } else {
                $('[code="'+k+'"]').addClass("experimentallyNotHighlighted");
            }
        });
        $('#describer').addClass("experimentallyNotHighlighted");
        $('#menuRow').addClass("experimentallyNotHighlighted");
        $('#menuHr').addClass("experimentallyNotHighlighted");
    } else {
        waitForSelection = false;
        $('*').removeClass("experimentallyNotHighlighted");
        $('*').removeClass("experimentallyHighlighted");
        pathObject.selecting = "";
    }
}

function setPathSlot(which, code){
    $('#path_' + which).find('.cidoccell').remove();
    pathObject[which] = code;
    //Reuse the experiment cell layout; removal goes through the slot's X overlay
    let chip = $(classesLayout(code, true)).removeAttr("onclick");
    $('#path_' + which).append(chip);
    $('#path_' + which + '_remove').show();
    $('#path_' + which + '_add').hide();
    syncPathUrlParam();
    runPathSearchIfReady();
}

function pathRemove(which){
    pathObject[which] = "";
    $('#path_' + which).find('.cidoccell').remove();
    $('#path_' + which + '_remove').hide();
    $('#path_' + which + '_add').show();
    syncPathUrlParam();
    renderPathResults(null);
}

function pathClear(){
    pathRemove("start");
    pathRemove("end");
}

function syncPathUrlParam(){
    let urlParams = new URLSearchParams(window.location.search);
    if(pathObject.start !== "" && pathObject.end !== ""){
        urlParams.set("path", pathObject.start + "," + pathObject.end);
    } else {
        urlParams.delete("path");
    }
    window.history.replaceState({}, '', window.location.pathname + "?" + urlParams.toString());
}

function runPathSearchIfReady(){
    if(pathObject.start === "" || pathObject.end === ""){
        renderPathResults(null);
        return;
    }
    let maxDepth = parseInt($('#pathDepthSelect').val(), 10) || 3;
    let loose = $('#pathLooseCheckbox').is(':checked');
    renderPathResults(findPaths(pathObject.start, pathObject.end, maxDepth, loose));
}

function renderPathResults(result){
    let container = $('#path_results');
    if(result === null){
        container.html("");
        return;
    }
    if(result.paths.length === 0){
        container.html("<div id='pathNoResults'>No paths found within " + $('#pathDepthSelect').val() + " steps. Try more steps or include specializations.</div>");
        return;
    }

    let groups = {};
    result.paths.forEach(function(props){
        (groups[props.length] = groups[props.length] || []).push(props);
    });

    let lengths = Object.keys(groups).sort(function(a,b){ return a - b; });
    let html = "";
    lengths.forEach(function(len, groupIndex){
        let label = len == 1 ? "Direct" : "Via " + (len - 1) + (len == 2 ? " class" : " classes");
        //Only the first group is expanded by default; deeper groups can be large
        let collapsed = groupIndex > 0 ? " pathGroupCollapsed" : "";
        html += "<div class='pathGroup" + collapsed + "'>";
        html += "<div class='pathGroupHeader'>"
            + "<i class='fas fa-chevron-down pathGroupChevron'></i>"
            + "<span>" + label + "</span>"
            + "<span class='pathGroupCount'>" + groups[len].length + " path" + (groups[len].length === 1 ? "" : "s") + "</span>"
            + "</div>";
        html += "<div class='pathGroupBody'>";
        groups[len].forEach(function(props){
            let chain = pathDisplayChain(pathObject.start, pathObject.end, props);
            //For table highlighting, inverse properties also light up their direct cell
            let highlightCodes = chain.slice();
            props.forEach(function(p){
                if(p.endsWith("i")) highlightCodes.push(p.substring(0, p.length - 1));
            });
            html += "<div class='pathResultChain' data-chain='" + chain.join(",") + "' data-codes='" + highlightCodes.join(",") + "'>";
            chain.forEach(function(code, index){
                if(index % 2 === 0){
                    html += classesLineLayout(code);
                } else {
                    html += "<span class='pathArrow'><i class='fas fa-long-arrow-alt-right'></i></span>"
                        + propertiesLineLayout(code)
                        + "<span class='pathArrow'><i class='fas fa-long-arrow-alt-right'></i></span>";
                }
            });
            html += "<span class='pathTurtleCopy' title='Copy as Turtle'><img src='assets/copy-regular.svg' alt='copy' width='14px'></span>";
            html += "</div>";
        });
        html += "</div></div>";
    });

    if(result.truncated){
        html += "<div id='pathTruncatedNote'>Showing the " + result.paths.length + " most specific of " + (result.total > result.paths.length ? result.total + "+" : result.total) + " paths.</div>";
    }
    container.html(html);
}

function cellClick(elem, simulated=false){
    if(waitForSelection && experimentMode){
        let code = $(elem).attr("code");
        let layout = experimentObject.selecting == "property" ? propertiesLayout(code, true) : classesLayout(code, true);
        $('#experiment_' + experimentObject["selecting"]).append(layout);
        experimentObject[experimentObject.selecting] = code;
        $('#experiment_'+ experimentObject["selecting"] + "_remove").show();
        $('#experiment_'+ experimentObject["selecting"] + "_add").hide();
        experimentSelectionMode("off");
    } else if(waitForSelection && pathfinderMode){
        let code = simulated ? elem : $(elem).attr("code");
        if(cidoc[code] && isCidocClass(code) && pathObject.selecting !== ""){
            setPathSlot(pathObject.selecting, code);
        }
        pathSelectionMode("off");
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

        if(!cidoc[keycode]) return;

        //Selecting an entry of a disabled ontology re-enables it (auto-reveal):
        //covers describer chips, tables, d3 nodes and ?code= deep links alike.
        let targetOnt = ontologyOf(keycode);
        if(targetOnt && loadedOntologies[targetOnt] && !isOntologyEnabled(targetOnt)){
            enabledOntologies[targetOnt] = true;
            applyOntologyVisibility();
            renderOntologyToggles();
        }

        let urlParams = syncOntologyUrlParam(new URLSearchParams(window.location.search));
        urlParams.set('code', keycode);
        var refresh = window.location.protocol + "//" + window.location.host + window.location.pathname + '?' + urlParams.toString();
        window.history.pushState({ path: refresh }, '', refresh);

        $('[code="' + keycode + '"]').addClass("selectedCell");
        toggleViewFromCode(keycode);

        $('#clipboardInput').val(cidoc[keycode]["about"]);

        let ontEntry = ONTOLOGIES[targetOnt];
        let extensionInfo = targetOnt !== "crm" ? ((VERSIONS[currentVersion].extensions || {})[targetOnt] || {}) : {};
        $('#descOntology').text(ontEntry ? ontEntry.label + (extensionInfo.version ? " " + extensionInfo.version : "") : "");
        $('#descOntology').attr("class", ontEntry ? "descOntologyTag " + ontEntry.cssClass : "");

        /* HIERARCHY */
        $('#d3container').html("");
        let selectedTreeNode = treegraph.first(function (node) {
            return node.model.code === keycode;
        });
        let comment = commentFor(keycode);
        $('#descCode').text(keycode);
        $('#descTitle').text(cidoc[keycode]["label"]);

        if(isCidocProperty(keycode)){
            /* PROPERTIES */
            setInversePropertiesStatus(keycode.endsWith("i"));
            $('#descDomainRange').show();
            $('#descCodeColor').attr('class', "");
            $('#descProperty').html(propertiesLayout(keycode));

            //Sometimes we have RDF classes as domain or range. We need to check that before casting the cidoc class layout
            if(isCidocName(cidoc[keycode]["domain"])){
                $('#descDomain').html(classesLayout(getCode(cidoc[keycode]["domain"])));
            } else {
                $('#descDomain').html(nonCidocClassesLayout(cidoc[keycode]["domain"]));
            }
            if(isCidocName(cidoc[keycode]["range"])){
                $('#descRange').html(classesLayout(getCode(cidoc[keycode]["range"])));
            } else {
                $('#descRange').html(nonCidocClassesLayout(cidoc[keycode]["range"]));
            }

        } else if (isCidocClass(keycode)) {
            /* CLASSES */
            $('#descCodeColor').attr('class', "");
            $('#descCodeColor').addClass(getColorCode(keycode))
            /* Superclasses */
            let superclasses = cidoc[keycode]["superclasses"];

            let superhtml = "<div>";
            $.each(superclasses, function(k,v){
                if(!cidoc[v]) return;
                let label = cidoc[v]["label"];
                let ontClass = ONTOLOGIES[ontologyOf(v)] ? ONTOLOGIES[ontologyOf(v)].cssClass : "";
                superhtml += "<a class='descsuperclass " + ontClass + "' code='"+v+"'>" + v + " - " + label + "</a>";
            });
            //Superclasses living in models not included in this app (e.g. CRMsci)
            $.each(cidoc[keycode]["externalSuperclasses"] || [], function(k,v){
                superhtml += "<a class='descsuperclass externalRef' title='Defined in an external CRM extension not included here'>" + escapeAttr(v) + "</a>";
            });
            superhtml += "</div>";
            $('#superclasses').html(superhtml);
    
            highlightSubclassesByClass(keycode);
            if(selectedTreeNode){
                generateTreeGraph(visibleTreeCopy(selectedTreeNode));
            }
            $('#treelist').html("");
            createSubclassesList(keycode);
    
            centerCharts();
            //TODO: tabella con orizzontali i livelli di profondità, verticale le famiglie o viceversa ()
            addPropertiesAndReferencesToLayout(keycode);
        }
    
        $('#descComment').text(comment);
    }
}

//Comment of an entry, falling back to where the documentation actually lives:
//inverse properties are documented on their direct counterpart, shortcut
//properties (P81a, P82b, ...) on their superproperty. Always returns a string.
function commentFor(code){
    if(!cidoc[code]) return "";
    if(cidoc[code].comment) return String(cidoc[code].comment);
    if(code.endsWith("i")){
        let straight = code.substring(0, code.length - 1);
        if(cidoc[straight] && cidoc[straight].comment) return String(cidoc[straight].comment);
    }
    if(cidoc[code].superproperties && cidoc[code].superproperties.length > 0){
        let superproperty = cidoc[code].superproperties[0];
        if(cidoc[superproperty] && cidoc[superproperty].comment) return String(cidoc[superproperty].comment);
    }
    return "";
}

function getSearchedCodes(query){
    let corresponding_codes = [];
    let q = query.toUpperCase();
    $.each(cidoc, function(k,v){
        if(!isEntryVisible(k)) return;
        let searchable = (v.label || "") + " " + commentFor(k);
        if(searchable.toUpperCase().includes(q)){
            corresponding_codes.push(k);
        }
    });
    return corresponding_codes;
}

function isEmptyOrSpaces(str){
    return str === null || str.match(/^ *$/) !== null;
}

//Comments go into HTML attributes (title): quotes and angle brackets must not
//break the markup.
function escapeAttr(str){
    return String(str == null ? "" : str)
        .replace(/&/g, "&amp;")
        .replace(/'/g, "&#39;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function filterBySearch(){
    let query = $("#searchinput").val();
    if(isEmptyOrSpaces(query)){
        $('.cidoccell').css('display', '');
        checkInversePropertiesStatus();
    } else {
        let query_result = getSearchedCodes(query);
        $('.cidoccell').each(function(){
            if(query_result.includes($(this).attr("code"))){
                $(this).css('display', '');
            } else {
                $(this).hide();
            }
        });
        //Search results must still respect the inverse-properties toggle
        if(showinverse){
            $('#propertiesContainer .straightproperty').hide();
        } else {
            $('#propertiesContainer .inverseproperty').hide();
        }
    }
}

//Hierarchy depth of a class: with multiple inheritance, the deepest path wins.
function getClassLevel(code, level){
    if(!cidoc[code] || cidoc[code]["superclasses"].length === 0){
        return level;
    }
    let levels = cidoc[code]["superclasses"]
        .filter(function(superclass){ return cidoc[superclass]; })
        .map(function(superclass){ return getClassLevel(superclass, level + 1); });
    return levels.length > 0 ? Math.max.apply(null, levels) : level;
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
    if(!cidoc[code]) return;
    if(cidoc[code]["superclasses"].length > 0){
        $.each(cidoc[code]["superclasses"], function(k,v){
            if(!cidoc[v]) return;
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
}

function addPropertiesAndReferencesToLayout(code){
    //Direct Properties
    let properties = cidoc[code].props[0]["props"]["properties"];
    let htmlstring = "<table class='classPropertiesTable'><tbody>"
    $.each(properties, function(index, value){
        if(!isEntryVisible(value)) return;
        let range;
        if (isCidocName(cidoc[value].range)){
            range = classesLineLayout(getCode(cidoc[value].range));
        } else {
            range = nonCidocConversion(cidoc[value].range);
        }

        htmlstring += "<tr class='classPropertyRow directClassProperties'>";
        htmlstring += "<td class='tdDomain'>" +  classesLineLayout(code) + "</td>";
        htmlstring += "<td class='tdProperty'><span class='directPropertySpan' onclick='cellClick(\""+ value +"\", true)'>" + propertiesLineLayout(value) + "</span></td>";
        htmlstring += "<td class='tdRange'>" + range + "</td></tr>";
    })
    //Inherited Properties
    let inheritedProperties = cidoc[code].inheritedProps;
    $.each(inheritedProperties, function(index, value){
        $.each(value.props.properties, function(i,ipcode){
            if(!isEntryVisible(ipcode)) return;
            let range;
            if (isCidocName(cidoc[ipcode].range)){
                range = classesLineLayout(getCode(cidoc[ipcode].range));
            } else {
                range = nonCidocConversion(cidoc[ipcode].range);
            }

            htmlstring += "<tr class='classPropertyRow inheritedClassProperties'><td>" + classesLineLayout(value.code) + "</td><td><span class='inheritedPropertySpan' onclick='cellClick(\""+ ipcode +"\", true)'>" + propertiesLineLayout(ipcode) + "</span></td><td>" + range + "</td></tr>";
        });
    })
    htmlstring += "</tbody></table>"

    //References
    let references = cidoc[code].props[0].props.references;
    let htmlstring2 = "<table class='classReferencesTable'><tbody>"
    $.each(references, function(index, value){
        if(!isEntryVisible(value)) return;
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
        htmlstring2 += "<tr class='classReferenceRow directClassReferences'><td class='tdDomain'>" + domain + "</td><td class='tdProperty'><span class='directReferenceSpan' onclick='cellClick(\""+ value +"\", true)'>" + propertiesLineLayout(value) + "</span></td><td class='tdRange'>" + range + "</td></tr>";
    })

    //Inherited References
    let inheritedReferences = cidoc[code].inheritedProps;
    $.each(inheritedReferences, function(index, value){
        $.each(value.props.references, function(i,ipcode){
            if(!isEntryVisible(ipcode)) return;
            let domain;
            if (isCidocName(cidoc[ipcode].domain)){
                domain = classesLineLayout(getCode(cidoc[ipcode].domain));
            } else {
                domain = nonCidocConversion(cidoc[ipcode].domain);
            }

            let range;
            range = classesLineLayout(value.code);

            htmlstring2 += "<tr class='classReferenceRow inheritedClassReferences'><td class='tdDomain'>" + domain  + "</td><td class='tdProperty'><span class='inheritedReferenceSpan' onclick='cellClick(\""+ ipcode +"\", true)'>" + propertiesLineLayout(ipcode) + "</span></td><td class='tdRange'>" + range + "</td></tr>";
        });
    })
    htmlstring2 += "</tbody></table>"

    $('#classPropertiesContainer').html(htmlstring)
    $('#classReferencesContainer').html(htmlstring2)
}

function centerCharts(){
    let myDiv = $("#d3container");
    var containerwidth = myDiv.width();
    let canvaswidth = myDiv.find('svg').width();
    myDiv.animate({scrollLeft: Math.abs(containerwidth-canvaswidth)/2});
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
    if(!cidoc[code]) return;
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
    let root = tree.parse({code:"__root__", children:[]});

    //Track, per class, which superclasses it has already been attached under,
    //so multiple inheritance attaches the class under EVERY parent (not just
    //the ones that happened to exist on the first pass).
    let attachedUnder = {};
    let classcodes = [];
    $.each(cidoc, function(k,v){
        if(isCidocClass(k)){
            classcodes.push(k);
            attachedUnder[k] = [];
        }
    });

    //Bounded loop: a superclass referenced but never loaded (e.g. a disabled
    //ontology or an external model) must not freeze the browser.
    let completed = false;
    let pass = 0;
    while (!completed && pass <= classcodes.length) {
        completed = true;
        pass++;
        classcodes.forEach(function(k){
            let resolvableSuperclasses = cidoc[k]["superclasses"].filter(function(superclass){
                return cidoc[superclass];
            });
            if(resolvableSuperclasses.length === 0){
                //Hierarchy root (E1, or a class whose parents are not loaded)
                if(attachedUnder[k].length === 0){
                    root.addChild(tree.parse({code:k, children:[]}));
                    attachedUnder[k].push("__root__");
                }
            } else {
                resolvableSuperclasses.forEach(function(superclass){
                    if(attachedUnder[k].includes(superclass)) return;
                    let attacher = root.first(function (node) {
                        return node.model.code === superclass;
                    });
                    if (attacher == null) {
                        completed = false;
                    } else {
                        attacher.addChild(tree.parse({code:k, children:[]}));
                        attachedUnder[k].push(superclass);
                    }
                });
            }
        });
    }

    //Anything still orphaned (unresolvable hierarchy) becomes a root child
    classcodes.forEach(function(k){
        if(attachedUnder[k].length === 0){
            console.warn("createTree: unresolved superclasses for " + k + ", attaching to root");
            root.addChild(tree.parse({code:k, children:[]}));
        }
    });

    treegraph = root;
}

function getTreeFromCode(code){
    return treegraph.first(function (node) {
        return node.model.code === code;
    });
}

function createSubclassesList(code){
    let tree = visibleTreeCopy(getTreeFromCode(code));

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

function takeDataFromEntry(entry, ont="crm"){
    if(!entry["-rdf:about"] || !isCidocName(entry["-rdf:about"])){
        console.warn("Skipping entry with unrecognized rdf:about: " + entry["-rdf:about"]);
        return;
    }
    let currentcode = getCode(entry["-rdf:about"]);
    cidoc[currentcode] = {};

    /* about */
    cidoc[currentcode]["about"] = entry["-rdf:about"];

    /* ONTOLOGY the entry belongs to */
    cidoc[currentcode]["ontology"] = ont;

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
            superproperties.push(getCode(entry["rdfs:subPropertyOf"]["-rdf:resource"]));
        }
        cidoc[currentcode]["superproperties"] = superproperties.filter(function(code){ return !!code; });
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
        cidoc[currentcode]["superclasses"] = superclasses.filter(function(code){ return !!code; });
    }

    /* SUPERCLASSES living in ontologies that are not part of this app (e.g. CRMsci) */
    if("externalSuperclasses" in entry){
        cidoc[currentcode]["externalSuperclasses"] = entry["externalSuperclasses"];
    }

    /* Comments  */
    if("rdfs:comment" in entry){
        let comment = entry["rdfs:comment"];
        if(comment && typeof comment === "object"){
            comment = comment["#text"] || "";
        }
        cidoc[currentcode]["comment"] = comment;
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

function parseOntology(data, ont="crm"){
    data["rdf:RDF"]["rdf:Property"].forEach(function(entry){
        takeDataFromEntry(entry, ont);
    });
    data["rdf:RDF"]["rdfs:Class"].forEach(function(entry){
        takeDataFromEntry(entry, ont);
    });
}

function getColorCode(code){
    let color_code = "none"
    if(code && isCidocClass(code) && cidoc[code] && cidoc[code].colorcodes){
        if(cidoc[code].colorcodes.length == 1){
            color_code = cidoc[code].colorcodes[0].label;
        }
        if(cidoc[code].colorcodes.length == 2){
            color_code = cidoc[code].colorcodes[1].label;
        }
    }
    return color_code;
}

function classesLayout(code, experiment=false){
    if(isCidocCode(code) && cidoc[code]){
        let color_code = getColorCode(code);
        let classObject = cidoc[code];
        let experimentClass = experiment ? "experimental": "";
        let ontClass = ONTOLOGIES[ontologyOf(code)] ? ONTOLOGIES[ontologyOf(code)].cssClass : "";
        let onClick = experiment ? "onClick='experimentRemove(\""+ experimentObject.selecting + "\")'" : "";
        let level = getClassLevel(code, 0);
        var html = "<div code='"+ code +"' class='cidoccell classcell " + color_code + " " + ontClass + " " + experimentClass + "' " + onClick + " title='"+ escapeAttr(commentFor(code)) +"' about='"+ escapeAttr(classObject.about) +"'>";
        html += "<div class='classsuperclasses'> " + classObject.superclasses.join() + "</div>";
        html += "<div class='classcodes'>" + code + "</div>";
        html += "<div class='classlevel level" + level + "'></div>";
        html += "<div class='classtitle'>" + classObject.label + "</div>";
        html += "<div class='classsubclasses'>" + getAllSubclasses(code) + "</div>";
        html += "</div>";
        return html;
    }
}

function classesLineLayout(code){
    if(!cidoc[code]){
        //Reference to a model that is not part of this app (e.g. CRMsci)
        return "<div class='cidocline classline none externalRef' title='Defined in an external CRM extension not included here'><span class='cidoclineCode'>" + escapeAttr(code) + "</span></div>";
    }
    let color_code = getColorCode(code);
    let ontClass = ONTOLOGIES[ontologyOf(code)] ? ONTOLOGIES[ontologyOf(code)].cssClass : "";
    let html = "<div code='" + code + "' class='cidocline classline " + color_code + " " + ontClass + "' title='"+ escapeAttr(commentFor(code)) +"'>";
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
    let lineOntClass = ONTOLOGIES[ontologyOf(code)] ? ONTOLOGIES[ontologyOf(code)].cssClass : "";
    let html = "<div code='" + code + "' class='cidocline propertyline " + lineOntClass + "' title='"+ escapeAttr(commentFor(code)) +"'>";
    html += "<div class='cidoclineDomain "+ getColorCode(propertyDomainCode) +"'></div>"
    html += "<div class='cidoclineName'><span class='cidoclineCode'>" + code + "</span>";
    html += "<span class='cidoclineLabel'>" + cidoc[code].label + "</span></div>";
    html += "<div class='cidoclineRange " + getColorCode(propertyRangeCode) + "'></div>"
    html += "</div>"
    return html;
}

function nonCidocConversion(string){
    if(typeof string !== "string" || string === ""){
        return "";
    }
    if(string.includes("#")){
        return string.split("#")[1];
    }
    if(string.startsWith("http")){
        return string.split("/").pop();
    }
    return string;
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
        let ontClass = ONTOLOGIES[ontologyOf(code)] ? ONTOLOGIES[ontologyOf(code)].cssClass : "";
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



        var html = "<div code='"+ code +"' class='cidoccell propertycell "+ propertyDirection + " " + ontClass + " " + experimentalClass + "' "+ onClick +" title='"+ escapeAttr(commentFor(code)) +"' about='"+ escapeAttr(aproperty.about) +"'>";
            html += "<div class='propertysuperproperties'> " + aproperty.superproperties.join() + "</div>";
            html += "<div class='propertycodes'>" + code + "</div>";
            html += "<div class='propertytitle'>" + aproperty.label + "</div>";
            html += "<div class='propertydomain "+ getColorCode(propertyDomainCode) +"'>" + "<div class='propertyDomainCode'>" + propertyDomainCode + "</div><div class='propertyDomainLabel'>" + propertyDomainLabel + "</div></div>";
            html += "<div class='propertyrange "+ getColorCode(propertyRangeCode) +"'>" + "<div class='propertyDomainRange'>" + propertyRangeCode + "</div><div class='propertyRangeLabel'>" + propertyRangeLabel + "</div></div>";
            html += "</div>";
        return html;
}

function generateLayout(){
    //One group per ontology, in registry order, with a section header for extensions
    let ontOrder = Object.keys(ONTOLOGIES).sort(function(a,b){ return ONTOLOGIES[a].order - ONTOLOGIES[b].order; });
    ontOrder.forEach(function(ont){
        if(!loadedOntologies[ont]) return;

        let classesHtml = "";
        let propertiesHtml = "";
        $.each(cidoc, function(k,v){
            if(ontologyOf(k) !== ont) return;
            if(isCidocClass(k)){
                classesHtml += classesLayout(k);
            } else if(isCidocProperty(k)){
                propertiesHtml += propertiesLayout(k);
            }
        });

        if(ont !== "crm"){
            let extension = (VERSIONS[currentVersion].extensions || {})[ont] || {};
            let headerLabel = ONTOLOGIES[ont].label + (extension.version ? " " + extension.version : "");
            $('#classesContainer').append("<div class='ontologySectionHeader " + ONTOLOGIES[ont].cssClass + " belongsToClasses'>" + headerLabel + "</div>");
            $('#propertiesContainer').append("<div class='ontologySectionHeader " + ONTOLOGIES[ont].cssClass + " belongsToProperties'>" + headerLabel + "</div>");
        }
        $('#classesContainer').append(classesHtml);
        $('#propertiesContainer').append(propertiesHtml);
    });
}

