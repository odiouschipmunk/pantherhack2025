document.addEventListener('DOMContentLoaded', () => {
    console.log('='.repeat(50));
    console.log('Project Planner AI initialized (GoJS)');
    console.log('='.repeat(50));
    
    // DOM elements
    const centralIdea = document.getElementById('central-idea');
    const generateBtn = document.getElementById('generate-btn');
    const loadingContainer = document.querySelector('.loading-container');
    const mindmapContainer = document.querySelector('.mindmap-container');
    const mindmapElementId = 'mindmap'; // GoJS target div ID
    const downloadBtn = document.getElementById('download-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    const addTopicBtn = document.getElementById('add-topic-btn');
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const zoomResetBtn = document.getElementById('zoom-reset');
    // Modal elements
    const editModal = document.getElementById('edit-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalInput = document.getElementById('modal-input');
    const modalSaveBtn = editModal?.querySelector('.modal-btn-primary');
    const modalCancelBtn = editModal?.querySelector('.modal-btn-cancel');
    const modalCloseBtn = editModal?.querySelector('.modal-close');

    // GoJS specific variables
    let myDiagram = null;
    let G = go.GraphObject.make; // Shorthand

    // Track application state
    let currentMindMapData = null;
    let selectedNodeData = null; // Store data of selected node
    let editingNodeData = null; // Store data of the node being edited/added
    let isAddingNode = false; // Flag to indicate if modal is for adding or editing
    const defaultZoom = 1.0;

    // Console logging configuration (retained)
    const logConfig = {
        enabled: true, level: "info",
        styles: { debug: "color: #9ca3af;", info: "color: #3b82f6; font-weight: bold;", warn: "color: #f59e0b; font-weight: bold;", error: "color: #ef4444; font-weight: bold;", success: "color: #10b981; font-weight: bold;", api: "color: #8b5cf6; font-weight: bold;", event: "color: #ec4899; font-weight: bold;" }
    };
    const logger = {
        debug: (m, ...a) => { if (!logConfig.enabled || ["debug"].indexOf(logConfig.level) === -1) return; console.log(`%c[DEBUG] ${m}`, logConfig.styles.debug, ...a); },
        info: (m, ...a) => { if (!logConfig.enabled || ["debug", "info"].indexOf(logConfig.level) === -1) return; console.log(`%c[INFO] ${m}`, logConfig.styles.info, ...a); },
        warn: (m, ...a) => { if (!logConfig.enabled || ["debug", "info", "warn"].indexOf(logConfig.level) === -1) return; console.warn(`%c[WARN] ${m}`, logConfig.styles.warn, ...a); },
        error: (m, ...a) => { if (!logConfig.enabled || ["debug", "info", "warn", "error"].indexOf(logConfig.level) === -1) return; console.error(`%c[ERROR] ${m}`, logConfig.styles.error, ...a); },
        success: (m, ...a) => { if (!logConfig.enabled) return; console.log(`%c[SUCCESS] ${m}`, logConfig.styles.success, ...a); },
        api: (m, ...a) => { if (!logConfig.enabled) return; console.log(`%c[API] ${m}`, logConfig.styles.api, ...a); },
        event: (m, ...a) => { if (!logConfig.enabled) return; console.log(`%c[EVENT] ${m}`, logConfig.styles.event, ...a); }
    };

    // Notification System (retained)
    const notificationSystem = {
        container: null,
        init() { /* ... initialization ... */ if(this.container) return; this.container = document.createElement('div'); this.container.className = 'notification-container'; document.body.appendChild(this.container); logger.debug('Notification system initialized'); },
        show(message, type = 'info', duration = 3000) { /* ... show logic ... */ const n = document.createElement('div'); n.className = `notification ${type} show`; n.innerHTML = `<div class="notification-message">${message}</div><div class="notification-close">×</div>`; this.container.appendChild(n); const c = n.querySelector('.notification-close'); c.addEventListener('click', () => this.close(n)); if(duration>0) setTimeout(() => this.close(n), duration); logger.info(`Notification shown: ${message} (${type})`); return n; },
        close(notification) { /* ... close logic ... */ notification.classList.remove('show'); setTimeout(() => { if (notification.parentNode) notification.parentNode.removeChild(notification); }, 300); },
        success(m, d) { return this.show(m, 'success', d); }, error(m, d) { return this.show(m, 'error', d); }, info(m, d) { return this.show(m, 'info', d); }
    };

    // Simple unique ID generator
    function generateUniqueId() {
        return 'id_' + Math.random().toString(36).substr(2, 9);
    }

    // Initialize GoJS Diagram
    function initGoJsDiagram() {
        if (myDiagram) {
             logger.warn("GoJS Diagram already initialized.");
             return myDiagram;
        }
        logger.info("Initializing GoJS Diagram");

        try {
            myDiagram = G(go.Diagram, mindmapElementId, {
                initialContentAlignment: go.Spot.Center, // Center content on load
                // Use TreeLayout for a structured mind map
                layout: G(go.TreeLayout, { 
                    angle: 0, // Main axis is horizontal (0=right, 90=down, 180=left, 270=up)
                    arrangement: go.TreeLayout.ArrangementFixedRoots, // Keep root node centered
                    layerSpacing: 80, // Horizontal distance between layers (increased for horizontal layout)
                    nodeSpacing: 20 // Vertical distance between nodes in a layer
                }),
                "undoManager.isEnabled": true, // Enable undo/redo
                "clickCreatingTool.archetypeNodeData": { text: "New Topic", color: "#60A5FA" }, // For potential click-creation
                "commandHandler.archetypeGroupData": null, // Disable group creation via keyboard
                allowDrop: true, // Allow dragging nodes onto other nodes (for re-parenting, optional)
                
                // Handle node selection changes
                "ChangedSelection": (e) => {
                    const selNode = e.diagram.selection.first();
                    if (selNode instanceof go.Node) {
                        selectedNodeData = selNode.data;
                        logger.event(`Node selected: ${selectedNodeData.text} (${selectedNodeData.key})`);
                        // Enable add/delete buttons maybe? (Requires DOM element refs)
                    } else {
                        selectedNodeData = null;
                        logger.event('Background clicked, selection cleared');
                        // Disable add/delete buttons maybe?
                    }
                },
                // Model Changed listener for logging or potential backend sync
                "ModelChanged": (e) => {
                    if (e.isTransactionFinished) {
                         logger.debug("GoJS Transaction finished:", e.change);
                    }
                }
            });

            // Define Node Templates using GoJS syntax

            // --- Tooltip Template ---
            const TooltipTemplate = G(go.Adornment, "Auto",
                G(go.Shape, { fill: "#FFFFE0" }), // Light yellow background
                G(go.TextBlock, { margin: 8, font: "12px Poppins, sans-serif" },
                    new go.Binding("text", "", (data) => data.text) // Bind to the node's text
                )
            );

            // --- Central Node Template ---
            myDiagram.nodeTemplateMap.add("Central",
                G(go.Node, "Auto",
                    { 
                        locationSpot: go.Spot.Center, 
                        selectionObjectName: "PANEL",
                         isTreeExpanded: true,
                         isTreeLeaf: false,
                         toolTip: TooltipTemplate, // Add tooltip
                         // Hover effects (optional, handled by CSS potentially)
                         // mouseEnter: (e, node) => { node.scale = 1.05; },
                         // mouseLeave: (e, node) => { node.scale = 1.0; }
                    },
                     new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
                     // Double click event for editing
                     { doubleClick: (e, node) => openEditModal(node.data) }, 
                    G(go.Panel, "Auto", { name: "PANEL" }, // Panel needed for selectionObjectName
                        G(go.Shape, "RoundedRectangle",
                            { 
                                parameter1: 15, // Corner radius
                                name: "SHAPE", 
                                fill: "#4F46E5", 
                                strokeWidth: 0, // No border needed if fill contrast is good
                                // stroke: "#3730A3",
                                portId: "", // Default port
                                cursor: "pointer",
                            },
                            new go.Binding("fill", "color") // Allow color override from data
                        ),
                        G(go.TextBlock,
                            {
                                font: "bold 14px Poppins, sans-serif",
                                stroke: "#ffffff",
                                margin: 12, // Increased margin
                                wrap: go.TextBlock.WrapFit, // Allow wrapping
                                textAlign: "center",
                                editable: true, // Allow inline editing (double-click)
                                // Additional properties for text editing if needed
                                // textValidation: (textBlock, oldText, newText) => newText.length > 0,
                                // lossFocus: (e, textBlock, tool) => { ... save on loss focus ... }
                            },
                            new go.Binding("text").makeTwoWay() // Bind to 'text' property in data
                        )
                    )
                )
            );

            // --- Subtopic Node Template ---
            myDiagram.nodeTemplateMap.add("Subtopic", // Default template if no category
                G(go.Node, "Auto",
                     { 
                        locationSpot: go.Spot.Center, 
                        selectionObjectName: "PANEL",
                         isTreeExpanded: true,
                         isTreeLeaf: false,
                         toolTip: TooltipTemplate, // Add tooltip
                          // Hover effects (optional)
                         // mouseEnter: (e, node) => { node.scale = 1.05; },
                         // mouseLeave: (e, node) => { node.scale = 1.0; }
                     },
                     new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
                     // Double click event for editing
                     { doubleClick: (e, node) => {
                         if (node.data.category === "Central") {
                             logger.warn("Editing of central node text disabled via modal.");
                             notificationSystem.info("Edit central node text directly on the diagram.");
                             return; // Prevent modal editing for central node (use inline)
                         }
                         openEditModal(node.data);
                       }
                     },
                     G(go.Panel, "Auto", { name: "PANEL" },
                         G(go.Shape, "RoundedRectangle",
                             { 
                                parameter1: 10, // Corner radius
                                name: "SHAPE", 
                                fill: "#60A5FA", 
                                strokeWidth: 0,
                                // stroke: "#3B82F6",
                                portId: "", 
                                cursor: "pointer",
                             },
                             new go.Binding("fill", "color")
                         ),
                         G(go.TextBlock,
                             {
                                font: "13px Poppins, sans-serif",
                                stroke: "#ffffff", // Changed to white for better contrast on blue
                                margin: 10, // Adjusted margin
                                wrap: go.TextBlock.WrapFit, // Allow wrapping
                                textAlign: "center",
                                editable: true
                             },
                             new go.Binding("text").makeTwoWay()
                        )
                    )
                )
            );
            
            // Define Link Template
            myDiagram.linkTemplate = 
                G(go.Link,
                     { 
                         // routing: go.Link.Normal, // Avoids obstacles, good with TreeLayout
                         routing: go.Link.Orthogonal, // Use orthogonal lines
                         corner: 5, // Radius of corners for orthogonal links
                         curve: go.Link.JumpOver, // Links jump over others
                         relinkableFrom: true, // Allow reconnecting links
                         relinkableTo: true,
                         selectionAdorned: false // Don't show selection handles on links
                     },
                    G(go.Shape,
                        { strokeWidth: 2, stroke: "#9CA3AF" }, // Use a neutral gray for links
                        new go.Binding("stroke", "linkColor") // Allow binding link color
                     ),
                     G(go.Shape, // Arrowhead
                        { toArrow: "Triangle", stroke: null, fill: "#9CA3AF", scale: 0.8 }, // Smaller arrowhead
                         new go.Binding("fill", "linkColor")
                     )
                );

            // Define the Model (using TreeModel for parent references)
            myDiagram.model = G(go.TreeModel,
                { 
                    nodeDataArray: [], // Start empty
                    // automatically determine parent relationship from 'parent' property
                    // nodeParentKeyProperty: "parent" // Default is "parent" if using TreeModel
                    // Let GoJS handle undo/redo for model changes
                     modelData: { canUndo: true, canRedo: true } // Enable Undo/Redo tracking
                }
             );
            
            // Add zoom controls functionality
            if (zoomInBtn) zoomInBtn.addEventListener('click', () => { myDiagram.commandHandler.increaseZoom(); logger.event('Zoom In clicked'); });
            if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => { myDiagram.commandHandler.decreaseZoom(); logger.event('Zoom Out clicked'); });
            if (zoomResetBtn) zoomResetBtn.addEventListener('click', () => { myDiagram.commandHandler.zoomToFit(); logger.event('Zoom Reset clicked'); });

            logger.success("GoJS Diagram initialized");
            return myDiagram;
        } catch (error) {
            logger.error("Failed to initialize GoJS Diagram", error);
            notificationSystem.error("Error initializing mind map visualization.");
            return null;
        }
    }

    // Convert API response to GoJS TreeModel format
    function convertToGoJsModel(data) {
        try {
            logger.debug("Converting API data to GoJS model", data);
            const nodeDataArray = [];

            if (!data || !data.central) {
                throw new Error("Invalid API data structure: missing central topic.");
            }

            // Add central node
            const centralKey = generateUniqueId();
            nodeDataArray.push({
                key: centralKey,
                text: data.central,
                category: "Central", // Use the central template
                color: "#4F46E5", // Explicit color
                // isLayoutPositioned: false // Lock central node?
            });

            // Recursively process subtopics
            if (data.subtopics && Array.isArray(data.subtopics)) {
                processSubtopicsForGoJs(data.subtopics, centralKey, nodeDataArray, 1);
            }

            logger.debug("GoJS Conversion complete", { nodeCount: nodeDataArray.length });
            return nodeDataArray;

        } catch (error) {
            logger.error("Error converting API data to GoJS model", error);
            notificationSystem.error("Error processing mind map data", "error");
            return null;
        }
    }

    // Recursive helper for GoJS data conversion
    function processSubtopicsForGoJs(subtopics, parentKey, nodeDataArray, level) {
        const colors = ["#4F46E5", "#60A5FA", "#F59E0B", "#10B981", "#EF4444"];
        const color = colors[Math.min(level, colors.length - 1)];

        subtopics.forEach(subtopic => {
            const id = generateUniqueId();
            let nodeLabel = "Unnamed Topic";
            let childrenToProcess = null;

            if (typeof subtopic === 'string') {
                nodeLabel = subtopic;
            } else if (typeof subtopic === 'object' && subtopic !== null && subtopic.name) {
                nodeLabel = subtopic.name;
                if (subtopic.children && Array.isArray(subtopic.children)) {
                    childrenToProcess = subtopic.children;
                }
            } else {
                logger.warn("Unexpected subtopic format encountered:", subtopic);
            }

            nodeDataArray.push({
                key: id,
                text: nodeLabel,
                parent: parentKey, // Link to parent for TreeModel
                category: "Subtopic", // Use default template
                color: color // Assign color based on level
            });

            if (childrenToProcess) {
                processSubtopicsForGoJs(childrenToProcess, id, nodeDataArray, level + 1);
            }
        });
    }

    // Function to generate the mind map using GoJS
    function generateMindMap(centralIdeaText) {
        logger.api("Generating mind map (GoJS)", { centralIdea: centralIdeaText });
        
        loadingContainer.style.display = 'flex';
        mindmapContainer.style.display = 'none';
        mindmapContainer.classList.remove('active');
        selectedNodeData = null;
        
        if (!myDiagram) {
            myDiagram = initGoJsDiagram();
            if (!myDiagram) {
                loadingContainer.style.display = 'none';
                return;
            }
        }
        
        // Clear previous model
        myDiagram.model.nodeDataArray = []; 
        // For GraphLinksModel, also clear: myDiagram.model.linkDataArray = [];

        fetch('/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ central_idea: centralIdeaText }),
        })
        .then(response => {
            if (!response.ok) {
                logger.error(`HTTP error: ${response.status}`);
                throw new Error(`Server error: ${response.statusText || response.status}`);
            }
            return response.json();
        })
        .then(data => {
            logger.api("Mind map data received", data);
            currentMindMapData = data;
            
            const gojsData = convertToGoJsModel(data);
            
            if (gojsData) {
                myDiagram.startTransaction("loadMindMap");
                myDiagram.model.nodeDataArray = gojsData;
                
                 // Find and potentially lock the central node after data load
                 const centralNode = myDiagram.findNodeForData(myDiagram.model.nodeDataArray[0]);
                 if (centralNode) {
                    // centralNode.isLayoutPositioned = false; // Prevent layout from moving it
                     centralNode.movable = false; // Make it non-movable by user or layout
                     logger.debug("Central node locked.");
                 } else {
                     logger.warn("Could not find central node to lock.");
                 }
                 
                 // Explicitly perform layout after loading data if needed
                 // myDiagram.layoutDiagram(true);
                 
                myDiagram.commitTransaction("loadMindMap");

                logger.success("Mind map data loaded into GoJS Diagram");
                loadingContainer.style.display = 'none';
                mindmapContainer.style.display = 'flex';
                setTimeout(() => { mindmapContainer.classList.add('active'); }, 50);
                notificationSystem.success("Mind map generated successfully");

            } else {
                throw new Error("Failed to convert API data for GoJS.");
            }
        })
        .catch(error => {
            logger.error("Error generating mind map", error);
            loadingContainer.style.display = 'none';
            notificationSystem.error(`Error generating mind map: ${error.message}`, "error", 5000);
            // Ensure diagram is cleared on error too
            if (myDiagram) {
                myDiagram.model.nodeDataArray = [];
            }
        });
    }

    // Add a subtopic to the selected node (using GoJS)
    function addSubtopic() {
        if (!myDiagram) { notificationSystem.warn("Mind map not ready."); return; }
        if (!selectedNodeData) {
            notificationSystem.info("Please select a topic first.");
            return;
        }

        myDiagram.startTransaction("addSubtopic");
        const parentData = selectedNodeData;
        const newId = generateUniqueId();
        const newNodeData = {
            key: newId,
            text: "New Subtopic",
            parent: parentData.key, // Set parent link for TreeModel
            category: "Subtopic",
            // Inherit color or assign based on level?
             // For simplicity, let's use a default color here
             color: "#22D3EE" // Cyan color for new nodes
        };
        myDiagram.model.addNodeData(newNodeData);
        
        // If using GraphLinksModel, add link explicitly:
        // myDiagram.model.addLinkData({ from: parentData.key, to: newId });
        
        // Select the new node and start editing
        const newNode = myDiagram.findNodeForData(newNodeData);
        if (newNode) {
             myDiagram.select(newNode);
             myDiagram.commandHandler.editTextBlock(); // Start editing the selected node's text
        }
        
        myDiagram.commitTransaction("addSubtopic");
        logger.event("Subtopic added", { parentId: parentData.key, newId: newId });
        notificationSystem.success("New topic added. Edit the text now.");
    }

    // Delete the selected node (using GoJS)
    function deleteSelectedNode() {
        if (!myDiagram) { notificationSystem.warn("Mind map not ready."); return; }
        if (!myDiagram.selection.count > 0) {
            notificationSystem.info("Please select a topic to delete.");
            return;
        }
        
        // Prevent deleting the root node
        const selection = myDiagram.selection.first();
         if (selection instanceof go.Node && selection.data.category === "Central") {
             notificationSystem.warn("Cannot delete the central topic.");
             return;
         }
        
        myDiagram.startTransaction("deleteSelection");
        // deleteSelection command handles removing nodes and connected links
        myDiagram.commandHandler.deleteSelection();
        myDiagram.commitTransaction("deleteSelection");
        logger.event("Node(s) deleted");
        notificationSystem.success("Topic deleted successfully");
        selectedNodeData = null; // Clear selection data
    }

    // Function to download the mind map (using GoJS export)
    function downloadMindMap() {
        if (!myDiagram) {
            notificationSystem.error("Mind map is not available for download.");
            return;
        }
        
        try {
            logger.info("Preparing mind map for download (GoJS)");
            notificationSystem.info("Preparing download...", "info", 2000);

            // GoJS Export to PNG Blob
            myDiagram.makeImageData({
                scale: 1.5, // Increase scale for better resolution
                background: "white",
                returnType: "blob",
                callback: (blob) => {
                    if (blob) {
                        // Use FileSaver.js (if included) or create manual link
                        // saveAs(blob, "mindmap.png"); // Requires FileSaver.js
                        
                        // Manual download link method:
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.style.display = "none";
                        a.href = url;
                        a.download = "mindmap.png";
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        a.remove();
                        
                        logger.success("Mind map downloaded as PNG");
                        notificationSystem.success("Download complete.", "success");
                    } else {
                        throw new Error("GoJS failed to generate image data.");
                    }
                }
            });
            // TODO: Add SVG export option maybe?
             // const svg = myDiagram.makeSvg({ scale: 1, background: "white" });

        } catch (error) {
            logger.error("Error downloading mind map (GoJS)", error);
            notificationSystem.error(`Error downloading mind map: ${error.message}`, "error");
        }
    }

    // Generate subtopics for a selected node (using GoJS)
    function generateSubtopicsForSelected() {
        if (!myDiagram) { notificationSystem.warn("Mind map not ready."); return; }
        if (!selectedNodeData) {
            notificationSystem.info("Please select a topic to generate subtopics for.");
            return;
        }

        const nodeData = selectedNodeData;
        const nodeName = nodeData.text;

        logger.api("Generating subtopics (GoJS)", { topic: nodeName });
        const loadingNotification = notificationSystem.show("Generating subtopics...", "info", 0); // Indefinite

        fetch('/generate-subtopics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic: nodeName }),
        })
        .then(response => {
            notificationSystem.close(loadingNotification);
            if (!response.ok) {
                logger.error(`HTTP error: ${response.status}`);
                throw new Error(`Server error: ${response.statusText || response.status}`);
            }
            return response.json();
        })
        .then(data => {
            logger.api("Subtopics data received", data);
            
            if (data.subtopics && data.subtopics.length > 0) {
                myDiagram.startTransaction("generateSubtopics");
                const parentKey = nodeData.key;
                // Determine level for color - find node depth
                const parentNode = myDiagram.findNodeForKey(parentKey);
                 let level = 1; // Assume level 1 if parent is root or not found
                 if (parentNode) {
                    let count = 0;
                    let n = parentNode;
                    while (n.findTreeParentNode()) {
                        count++;
                        n = n.findTreeParentNode();
                    }
                     level = count + 1; 
                 }
                 const colors = ["#4F46E5", "#60A5FA", "#F59E0B", "#10B981", "#EF4444"];
                 const subtopicColor = colors[Math.min(level, colors.length - 1)];
                 
                 let addedCount = 0;
                 data.subtopics.forEach(subtopic => {
                     const newId = generateUniqueId();
                     let nodeLabel = (typeof subtopic === 'string') ? subtopic :
                                     (typeof subtopic === 'object' && subtopic.name) ? subtopic.name :
                                     "Unnamed Topic";
                     myDiagram.model.addNodeData({
                         key: newId,
                         text: nodeLabel,
                         parent: parentKey,
                         category: "Subtopic",
                         color: subtopicColor
                     });
                     addedCount++;
                 });
                 myDiagram.commitTransaction("generateSubtopics");
                 
                 logger.success(`Added ${addedCount} subtopics to node`);
                 notificationSystem.success(`Added ${addedCount} subtopics`, "success");
                 // GoJS layout should update automatically
            } else {
                logger.warn("No subtopics received from API");
                notificationSystem.warn("No subtopics were generated.");
            }
        })
        .catch(error => {
            notificationSystem.close(loadingNotification);
            logger.error("Error generating subtopics", error);
            notificationSystem.error(`Error generating subtopics: ${error.message}`, "error", 5000);
        });
    }

    // --- Modal Handling ---
    function openModal(title, inputText = '') {
        if (!editModal) return;
        modalTitle.textContent = title;
        modalInput.value = inputText;
        editModal.classList.add('open');
        modalInput.focus(); // Focus input field
        logger.event(`Modal opened: ${title}`);
    }

    function closeModal() {
        if (!editModal) return;
        editModal.classList.remove('open');
        editingNodeData = null; // Clear editing state
        isAddingNode = false;
        logger.event('Modal closed');
    }

    function openEditModal(nodeData) {
        if (!nodeData) return;
        // Prevent opening modal for central node if inline editing is preferred
        if (nodeData.category === "Central") { 
             logger.info("Direct edit preferred for central node.");
             // Optionally focus the node in the diagram for direct editing
             const node = myDiagram?.findNodeForData(nodeData);
             if (node) {
                 myDiagram.commandHandler.editTextBlock(node.findObject("TextBlock"));
             }
             return;
        }
        editingNodeData = nodeData;
        isAddingNode = false;
        openModal(`Edit Topic: ${nodeData.text.substring(0, 20)}...`, nodeData.text);
    }

    function openAddModal() {
         if (!selectedNodeData && myDiagram?.model.nodeDataArray.length > 0) {
             // If nothing selected, default to adding child to central node
             const centralNode = myDiagram.findNodeForKey(myDiagram.model.nodeDataArray[0].key);
             if (centralNode) {
                 selectedNodeData = centralNode.data;
                 logger.info("No node selected, defaulting parent to central node.");
             } else {
                 notificationSystem.error("Cannot add topic: Central node not found.");
                 return;
             }
         } else if (!selectedNodeData) {
             notificationSystem.error("Cannot add topic: Select a parent node first.");
             return; // Can't add if nothing is selected and diagram is empty
         }

        editingNodeData = null; // No existing data to edit
        isAddingNode = true;
        openModal(`Add Subtopic to: ${selectedNodeData.text.substring(0, 20)}...`);
    }

    function handleModalSave() {
        const newText = modalInput.value.trim();
        if (!newText) {
            notificationSystem.warn("Please enter text for the topic.");
            modalInput.focus();
            return;
        }

        if (!myDiagram) return;

        myDiagram.startTransaction("Save Modal Edit");
        try {
            if (isAddingNode) {
                // Add new node
                const parentData = selectedNodeData;
                if (!parentData) { throw new Error("Parent node data not found for adding."); }
                
                const newNodeData = {
                    key: generateUniqueId(),
                    text: newText,
                    parent: parentData.key, // Link to parent using TreeModel convention
                    color: "#60A5FA" // Default subtopic color
                    // category: "Subtopic" // Default category
                };
                myDiagram.model.addNodeData(newNodeData);
                logger.success(`Node added: ${newText} (Parent: ${parentData.text})`);
                notificationSystem.success(`Added subtopic: ${newText}`);
                // Optional: Select the new node
                 const newNode = myDiagram.findNodeForData(newNodeData);
                 if (newNode) myDiagram.select(newNode);

            } else if (editingNodeData) {
                // Edit existing node
                myDiagram.model.setDataProperty(editingNodeData, "text", newText);
                logger.success(`Node edited: ${editingNodeData.key} to "${newText}"`);
                notificationSystem.success(`Topic updated: ${newText}`);
            }
            closeModal();
        } catch (error) {
            logger.error("Error saving modal changes:", error);
            notificationSystem.error("Failed to save changes.");
        } finally {
            myDiagram.commitTransaction("Save Modal Edit");
        }
    }

    // --- Event Listeners Setup ---
    function initEventListeners() {
        logger.debug("Initializing event listeners");

        // Generate Button
        if (generateBtn && centralIdea) {
            document.getElementById('project-form').addEventListener('submit', (e) => {
                e.preventDefault(); // Prevent actual form submission
                const ideaText = centralIdea.value.trim();
                if (ideaText) {
                    logger.event(`Generate button clicked for: "${ideaText}"`);
                    generateMindMap(ideaText);
                } else {
                    notificationSystem.warn("Please enter a project idea.");
                    centralIdea.focus();
                }
            });
        }

        // Refresh Button
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                logger.event('Refresh button clicked');
                if (confirm("Start a new project plan? This will clear the current diagram.")) {
                    if (myDiagram) {
                        myDiagram.model = G(go.TreeModel, { nodeDataArray: [] }); // Reset model
                    }
                    currentMindMapData = null;
                    selectedNodeData = null;
                    centralIdea.value = ''; // Clear input
                    mindmapContainer.style.display = 'none'; // Hide map
                    loadingContainer.style.display = 'none'; // Hide loading
                    centralIdea.focus();
                    notificationSystem.info("Project cleared. Enter a new idea.");
                }
            });
        }

        // Add Topic Button
        if (addTopicBtn) {
             addTopicBtn.addEventListener('click', () => {
                logger.event('Add Topic button clicked');
                openAddModal();
            });
        }

        // Download Button
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                logger.event('Download button clicked');
                downloadMindMap(); 
            });
        }

        // Modal Buttons
        if (modalSaveBtn) {
            modalSaveBtn.addEventListener('click', handleModalSave);
        }
        if (modalCancelBtn) {
            modalCancelBtn.addEventListener('click', closeModal);
        }
        if (modalCloseBtn) {
            modalCloseBtn.addEventListener('click', closeModal);
        }

        // Close modal on Escape key
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && editModal?.classList.contains('open')) {
                closeModal();
            }
        });

        // Close modal on background click
        if (editModal) {
            editModal.addEventListener('click', (e) => {
                if (e.target === editModal) { // Check if the click is on the backdrop
                    closeModal();
                }
            });
        }

        // Add keyboard shortcuts (Optional)
        document.addEventListener('keydown', (e) => {
            if (!myDiagram || !selectedNodeData) return;

            // Example: Delete node on 'Delete' key
            if (e.key === 'Delete' || e.key === 'Backspace') {
                 // Prevent browser back navigation on Backspace
                if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                    e.preventDefault(); 
                    deleteSelectedNode();
                }
            }
            // Example: Edit node on 'F2' key
            if (e.key === 'F2') {
                e.preventDefault();
                openEditModal(selectedNodeData);
            }
            // Example: Add child node on 'Insert' key
            if (e.key === 'Insert') {
                e.preventDefault();
                openAddModal(); // Assumes current selection is the parent
            }
        });

        logger.debug("Event listeners initialized");
    }
    
    // Initialize the application
    function init() {
        notificationSystem.init();
        initEventListeners();
        centralIdea.focus();
        logger.info('Application initialized (GoJS)');
        // Note: GoJS Diagram is initialized on first generation or explicitly if needed.
    }
    
    // Start the app
    init();

}); // End DOMContentLoaded 