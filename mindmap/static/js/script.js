document.addEventListener('DOMContentLoaded', () => {
    console.log('='.repeat(50));
    console.log('Project Planner AI initialized');
    console.log('='.repeat(50));
    
    // DOM elements
    const centralIdea = document.getElementById('central-idea');
    const generateBtn = document.getElementById('generate-btn');
    const loadingContainer = document.querySelector('.loading-container');
    const mindmapContainer = document.querySelector('.mindmap-container');
    const downloadBtn = document.getElementById('download-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    const addTopicBtn = document.getElementById('add-topic-btn');
    const contextMenu = document.getElementById('context-menu');
    const editModal = document.getElementById('edit-modal');
    const editNodeText = document.getElementById('edit-node-text');
    const modalSave = document.getElementById('modal-save');
    const modalCancel = document.getElementById('modal-cancel');
    const modalClose = document.querySelector('.modal-close');
    const modalTitle = document.querySelector('.modal-title');
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const zoomResetBtn = document.getElementById('zoom-reset');
    
    // Track application state
    let currentMindMapData = null;
    let cy = null; // Cytoscape instance instead of myDiagram
    let selectedNode = null;
    let editingNodeData = null;
    let editCallback = null;
    let defaultZoom = 1.0;
    
    // Register the Cytoscape extensions
    if (window.cytoscape) {
        // Register fcose layout if available
        if (window.cytoscapeFcose) {
            cytoscape.use(window.cytoscapeFcose);
        }
        
        // Register cose-bilkent layout if available
        if (window.cytoscapeCoseBilkent) {
            cytoscape.use(window.cytoscapeCoseBilkent);
        }
        
        // Register svg export extension if available
        if (window.cytoscapeSvg) {
            cytoscape.use(window.cytoscapeSvg);
        }
    }
    
    // Console logging configuration
    const logConfig = {
        enabled: true,
        level: "info", // debug, info, warn, error
        styles: {
            debug: "color: #9ca3af; font-weight: normal;",
            info: "color: #3b82f6; font-weight: bold;",
            warn: "color: #f59e0b; font-weight: bold;",
            error: "color: #ef4444; font-weight: bold;",
            success: "color: #10b981; font-weight: bold;",
            api: "color: #8b5cf6; font-weight: bold;",
            event: "color: #ec4899; font-weight: bold;"
        }
    };
    
    // Create logger object
    const logger = {
        debug: function(message, ...args) {
            if (!logConfig.enabled || ["debug"].indexOf(logConfig.level) === -1) return;
            console.log(`%c[DEBUG] ${message}`, logConfig.styles.debug, ...args);
        },
        info: function(message, ...args) {
            if (!logConfig.enabled || ["debug", "info"].indexOf(logConfig.level) === -1) return;
            console.log(`%c[INFO] ${message}`, logConfig.styles.info, ...args);
        },
        warn: function(message, ...args) {
            if (!logConfig.enabled || ["debug", "info", "warn"].indexOf(logConfig.level) === -1) return;
            console.warn(`%c[WARN] ${message}`, logConfig.styles.warn, ...args);
        },
        error: function(message, ...args) {
            if (!logConfig.enabled || ["debug", "info", "warn", "error"].indexOf(logConfig.level) === -1) return;
            console.error(`%c[ERROR] ${message}`, logConfig.styles.error, ...args);
        },
        success: function(message, ...args) {
            if (!logConfig.enabled) return;
            console.log(`%c[SUCCESS] ${message}`, logConfig.styles.success, ...args);
        },
        api: function(message, ...args) {
            if (!logConfig.enabled) return;
            console.log(`%c[API] ${message}`, logConfig.styles.api, ...args);
        },
        event: function(message, ...args) {
            if (!logConfig.enabled) return;
            console.log(`%c[EVENT] ${message}`, logConfig.styles.event, ...args);
        }
    };
    
    // Notification System
    const notificationSystem = {
        container: null,
        
        init() {
            this.container = document.createElement('div');
            this.container.className = 'notification-container';
            document.body.appendChild(this.container);
            logger.debug('Notification system initialized');
        },
        
        show(message, type = 'info', duration = 3000) {
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            
            notification.innerHTML = `
                <div class="notification-message">${message}</div>
                <div class="notification-close">×</div>
            `;
            
            this.container.appendChild(notification);
            
            // Trigger reflow and add show class
            notification.offsetHeight;
            notification.classList.add('show');
            
            // Add event listener for close button
            const closeBtn = notification.querySelector('.notification-close');
            closeBtn.addEventListener('click', () => this.close(notification));
            
            // Auto remove after duration
            if (duration > 0) {
                setTimeout(() => this.close(notification), duration);
            }
            
            logger.info(`Notification shown: ${message} (${type})`);
            return notification;
        },
        
        close(notification) {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        },
        
        success(message, duration) {
            return this.show(message, 'success', duration);
        },
        
        error(message, duration) {
            return this.show(message, 'error', duration);
        },
        
        info(message, duration) {
            return this.show(message, 'info', duration);
        }
    };
    
    // Node editing modal system
    const nodeEditingModal = {
        modal: null,
        input: null,
        saveButton: null,
        cancelButton: null,
        currentNodeData: null,
        
        init() {
            // Create modal if it doesn't exist
            if (!this.modal) {
                const modalHTML = `
                    <div class="modal" id="nodeEditModal">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h3 class="modal-title">Edit Node</h3>
                            </div>
                            <div class="modal-body">
                                <input type="text" class="modal-input" id="nodeEditInput" placeholder="Enter text">
                            </div>
                            <div class="modal-footer">
                                <button class="modal-button modal-cancel" id="nodeEditCancel">Cancel</button>
                                <button class="modal-button modal-save" id="nodeEditSave">Save</button>
                            </div>
                        </div>
                    </div>
                `;
                
                const modalContainer = document.createElement('div');
                modalContainer.innerHTML = modalHTML;
                document.body.appendChild(modalContainer.firstElementChild);
                
                this.modal = document.getElementById('nodeEditModal');
                this.input = document.getElementById('nodeEditInput');
                this.saveButton = document.getElementById('nodeEditSave');
                this.cancelButton = document.getElementById('nodeEditCancel');
                
                this.setupEventListeners();
                logger.debug('Node editing modal initialized');
            }
        },
        
        setupEventListeners() {
            this.saveButton.addEventListener('click', () => this.saveEdit());
            this.cancelButton.addEventListener('click', () => this.close());
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) this.close();
            });
        },
        
        open(nodeData) {
            this.currentNodeData = nodeData;
            this.input.value = nodeData.text;
            this.modal.classList.add('open');
            this.input.focus();
            logger.event('Node edit modal opened', { nodeId: nodeData.key });
        },
        
        close() {
            this.modal.classList.remove('open');
            this.currentNodeData = null;
            logger.debug('Node edit modal closed');
        },
        
        saveEdit() {
            if (!this.currentNodeData || !this.input.value.trim()) {
                return;
            }
            
            const newText = this.input.value.trim();
            const nodeData = this.currentNodeData;
            
            if (cy) {
                const node = cy.getElementById(nodeData.key);
                if (node) {
                    node.data('label', newText);
                    logger.event('Node text edited', { 
                        nodeId: nodeData.key, 
                        oldText: nodeData.text, 
                        newText: newText 
                    });
                    
                    notificationSystem.success("Node updated successfully");
                }
            }
            
            this.close();
        }
    };
    
    // Show notifications instead of alerts
    function showNotification(message, type = 'info', duration = 4000) {
        // Check if notification-container exists, if not create it
        let container = document.querySelector('.notification-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'notification-container';
            document.body.appendChild(container);
        }
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.setAttribute('role', 'alert');
        
        // Add icon based on type
        const icon = getIconForType(type);
        
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-message">${icon} ${message}</div>
            </div>
            <div class="notification-close">×</div>
        `;
        
        // Add to container
        container.appendChild(notification);
        
        // Add show class after small delay to trigger animation
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Add event listener for close button
        const closeButton = notification.querySelector('.notification-close');
        closeButton.addEventListener('click', () => {
            closeNotification(notification);
        });
        
        // Automatically close after duration
        if (duration) {
            setTimeout(() => {
                closeNotification(notification);
            }, duration);
        }
        
        return notification;
    }
    
    // Get icon for notification type
    function getIconForType(type) {
        let iconClass = '';
        switch(type) {
            case 'success': iconClass = 'fa-check-circle'; break;
            case 'warning': iconClass = 'fa-exclamation-triangle'; break;
            case 'error': iconClass = 'fa-times-circle'; break;
            case 'info':
            default: iconClass = 'fa-info-circle';
        }
        return `<i class="fas ${iconClass}"></i>`;
    }
    
    // Close notification with animation
    function closeNotification(notification) {
        notification.style.animation = 'fade-out 0.3s forwards';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }
    
    // Open modal for editing node text
    function openModal(title, currentText, callback) {
        modalTitle.textContent = title;
        editNodeText.value = currentText;
        editCallback = callback;
        
        editModal.classList.add('open');
        editNodeText.focus();
        editNodeText.select();
        
        logger.debug(`Modal opened: ${title}`);
    }
    
    // Close modal
    function closeModal() {
        editModal.classList.remove('open');
        editCallback = null;
        logger.debug('Modal closed');
    }
    
    // Update node text
    function updateNodeText(key, newText) {
        if (cy) {
            const node = cy.getElementById(key);
            if (node) {
                node.data('label', newText);
                logger.event("Node text updated", { key, newText });
                showNotification("Topic updated successfully", "success");
            }
        }
    }
    
    // Initialize Cytoscape diagram
    function initDiagram() {
        logger.info("Initializing Cytoscape diagram");
        
        // Define node and edge styles
        const stylesheet = [
            {
                selector: 'node',
                style: {
                    'background-color': 'data(color)',
                    'label': 'data(label)',
                    'text-valign': 'center',
                    'text-halign': 'center',
                    'text-wrap': 'wrap',
                    'text-max-width': '160px',
                    'font-family': 'Poppins, sans-serif',
                    'font-size': '14px',
                    'color': '#ffffff',
                    'text-outline-width': 1,
                    'text-outline-color': function(ele) {
                        return ele.data('color');
                    },
                    'text-outline-opacity': 0.4,
                    'border-color': function(ele) {
                        const color = ele.data('color');
                        return color ? color.replace(')', ', 0.4)').replace('rgb', 'rgba') : 'rgba(96, 165, 250, 0.4)';
                    },
                    'border-width': '3px',
                    'border-opacity': 0.8,
                    'shape': function(ele) {
                        const level = ele.data('level') || 0;
                        if (level === 0) return 'ellipse'; // Keep ellipse for level 0 default
                        if (level === 1) return 'round-rectangle';
                        return 'round-tag';
                    },
                    'width': 'label',
                    'height': 'label',
                    'padding': '16px', // Reduced padding slightly on subtopics
                    
                    'box-shadow': '0 3px 5px rgba(0, 0, 0, 0.08)',
                    'transition-property': 'background-color, border-color, border-width, width, height, opacity, shape, padding',
                    'transition-duration': '0.4s',
                    'transition-timing-function': 'ease-in-out'
                }
            },
            {
                selector: 'node.central',
                style: {
                    'shape': 'ellipse', // Explicitly set shape here too
                    'font-weight': 'bold',
                    'font-size': '14px',
                    'text-max-width': '140px',
                    'padding': '15px',
                    'border-width': 4,
                    'background-opacity': 0.95,
                    'background-color': '#5D5FEF',
                    'border-opacity': 0.6,
                    'z-index': 100
                }
            },
            {
                selector: 'node:selected',
                style: {
                    'border-width': function(ele) {
                        const level = ele.data('level') || 0;
                        return level === 0 ? 6 : 5;
                    },
                    'border-color': function(ele) {
                        const color = ele.data('color');
                        return color ? color.replace(')', ', 0.8)').replace('rgb', 'rgba') : 'rgba(96, 165, 250, 0.8)';
                    },
                    'border-opacity': 1,
                    'box-shadow': '0 0 15px rgba(93, 95, 239, 0.6)',
                    'z-index': 999
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': function(ele) {
                        const source = ele.source();
                        const level = source.data('level') || 0;
                        return 3 - (level * 0.5);
                    },
                    'line-color': function(ele) {
                        const target = ele.target();
                        const color = target.data('color');
                        return color ? color.replace(')', ', 0.5)').replace('rgb', 'rgba') : 'rgba(165, 180, 252, 0.5)';
                    },
                    'curve-style': 'bezier',
                    'target-arrow-shape': 'triangle',
                    'target-arrow-color': function(ele) {
                        const target = ele.target();
                        const color = target.data('color');
                        return color || '#A5B4FC';
                    },
                    'arrow-scale': 0.6,
                    'opacity': 0.7,
                    'transition-property': 'line-color, width, opacity',
                    'transition-duration': '0.3s'
                }
            },
            {
                selector: 'edge:selected',
                style: {
                    'width': 3.5,
                    'opacity': 1,
                    'line-color': '#818CF8',
                    'target-arrow-color': '#818CF8'
                }
            }
        ];
        
        // Initialize cytoscape
        cy = cytoscape({
            container: document.getElementById('mindmap'),
            style: stylesheet,
            minZoom: 0.15,
            maxZoom: 3,
            wheelSensitivity: 0.3,
            layout: {
                name: 'preset'
            },
            elements: [],
        });
        
        // Set up event handlers
        
        // Node selection event
        cy.on('tap', 'node', function(evt) {
            const node = evt.target;
            selectedNode = node;
            logger.event(`Node selected: ${node.data('label')} (${node.id()})`);
        });
        
        // Background click (deselection)
        cy.on('tap', function(evt) {
            if (evt.target === cy) {
                selectedNode = null;
                logger.event('Background clicked, selection cleared');
            }
        });
        
        // Double click for editing
        cy.on('dbltap', 'node', function(evt) {
            const node = evt.target;
            const nodeData = {
                key: node.id(),
                text: node.data('label'),
                level: node.data('level')
            };
            
            editingNodeData = nodeData;
            const title = node.data('level') === 0 ? "Edit Central Topic" : "Edit Topic";
            
            openModal(title, nodeData.text, (newText) => {
                if (newText && newText.trim() !== "") {
                    updateNodeText(nodeData.key, newText);
                }
            });
            
            logger.event(`Node double-clicked: ${node.data('label')} (${node.id()})`);
        });
        
        // Add a visual effect for node selection
        cy.on('select', 'node', function(evt) {
            const node = evt.target;
            
            const animation = node.animation({
                style: { 
                    'border-width': node.data('level') === 0 ? 6 : 5,
                    'scale': 1.08
                },
                duration: 300,
                easing: 'ease-out'
            });
            
            animation.play().promise('completed').then(() => {
                node.animation({
                    style: { 
                        'border-width': node.data('level') === 0 ? 4 : 3,
                        'scale': 1
                    },
                    duration: 300,
                    easing: 'ease-out'
                }).play();
            });
        });
        
        logger.success("Cytoscape diagram initialized");
        return cy;
    }
    
    // Generate a unique ID
    function generateUniqueId() {
        return 'id_' + Math.random().toString(36).substr(2, 9);
    }
    
    // Add a subtopic to the selected node
    function addSubtopic(node) {
        if (!node) {
            logger.warn("No node selected to add subtopic");
            showNotification("Please select a node first", "warning");
            return;
        }

        const parentId = node.id();
        const newId = generateUniqueId();
        const parentLevel = node.data('level') || 0;
        
        // Determine the color based on level
        const colors = ["#5D5FEF", "#60A5FA", "#F59E0B", "#10B981", "#EF4444"];
        const color = colors[Math.min(parentLevel + 1, colors.length - 1)];
        
        // Calculate position slightly offset from parent
        const parentPos = node.position();
        const angle = Math.random() * Math.PI * 2; // Random angle
        const distance = 150; // Distance from parent
        const xOffset = Math.cos(angle) * distance;
        const yOffset = Math.sin(angle) * distance;
        
        // Create a new node
        cy.add([
            { 
                group: 'nodes', 
                data: { 
                    id: newId, 
                    label: "New Subtopic", 
                    parent: parentId,
                    level: parentLevel + 1,
                    color: color
                },
                position: {
                    x: parentPos.x + xOffset,
                    y: parentPos.y + yOffset
                },
                classes: `level-${parentLevel + 1}`
            },
            { 
                group: 'edges', 
                data: { 
                    source: parentId, 
                    target: newId 
                } 
            }
        ]);
        
        // Apply layout to reorganize
        runLayout(cy);
        
        // Select the new node
        const newNode = cy.getElementById(newId);
        newNode.select();
        
        // Open edit modal for the new node
        openModal("Edit New Subtopic", "New Subtopic", (newText) => {
            if (newText && newText.trim() !== "") {
                updateNodeText(newId, newText);
            }
        });
        
        logger.event("Subtopic added", { parentId, newId });
    }
    
    // Handle add subtopics request
    function handleAddSubtopics(nodeId, nodeName) {
        const node = cy.getElementById(nodeId);
        if (node && node.length > 0) {
            // Show a loading notification
            const notification = showNotification("Generating subtopics...", "info");
            
            // Call the API to generate subtopics
            generateSubtopics(node);
        }
    }
    
    // Delete a node
    function deleteNode(nodeId) {
        // Don't delete the central node
        const node = cy.getElementById(nodeId);
        if (!node || node.length === 0) return;
        
        if (node.data('level') === 0) {
            showNotification("Cannot delete the central topic", "warning");
            logger.warn("Attempted to delete central node", { id: nodeId });
            return;
        }
        
        // First, identify all descendant nodes that need to be removed
        const descendantsSelector = `node[?parent = "${nodeId}"]`;
        let descendants = cy.$(descendantsSelector);
        
        // Recursively get all descendants
        function getAllDescendants(nodes) {
            const childIds = nodes.map(n => n.id());
            if (childIds.length === 0) return cy.collection();
            
            const directDescendants = cy.$(childIds.map(id => `node[?parent = "${id}"]`).join(', '));
            if (directDescendants.length === 0) return nodes;
            
            return nodes.union(getAllDescendants(directDescendants));
        }
        
        // Get complete set of descendants
        if (descendants.length > 0) {
            descendants = getAllDescendants(descendants);
        }
        
        // Create a collection with the node and all descendants
        const nodesToRemove = node.union(descendants);
        
        // Find all connected edges
        const edges = cy.edges().filter(edge => 
            nodesToRemove.contains(edge.source()) || 
            nodesToRemove.contains(edge.target())
        );
        
        // Remove edges and nodes with animation
        edges.forEach(edge => {
            edge.style('opacity', 0);
        });
        
        // Animate node removal
        nodesToRemove.forEach(node => {
            node.animate({
                style: { opacity: 0, scale: 0.5 },
                duration: 300,
                easing: 'ease-out'
            });
        });
        
        // After animation completes, remove the elements
        setTimeout(() => {
            cy.remove(edges);
            cy.remove(nodesToRemove);
            
            // Apply layout
            runLayout(cy);
            
            logger.event("Nodes deleted", { count: nodesToRemove.length });
            showNotification(`${nodesToRemove.length > 1 ? 'Topics' : 'Topic'} deleted`, "success");
        }, 300);
    }
    
    // Run the layout with animation using a circular layout approach
    function runLayout(cy, options = {}) {
        // Use circle layout as the primary attempt
        let layoutName = 'circle';
        logger.info(`Attempting layout: ${layoutName}`);

        try {
            const layoutOptions = {
                name: layoutName,
                fit: true,
                padding: 100, // Even more padding
                animate: true,
                animationDuration: 1000,
                animationEasing: 'ease-out',
                radius: function( nodes ){ 
                    // Calculate radius based on node count and try to space them out
                    const baseRadius = 150;
                    const nodeCount = nodes.filter(n => n.data('level') === 1).length;
                    return baseRadius + (nodeCount * 20); // Increase radius based on number of nodes
                },
                startAngle: 3/2 * Math.PI,
                avoidOverlap: true,
                nodeDimensionsIncludeLabels: true,
                spacingFactor: 1.2, // Increase spacing between nodes on the circle
                
                ...options
            };

            const layout = cy.layout(layoutOptions);

            layout.on('layoutstart', () => logger.debug('Circle layout starting'));
            layout.on('layoutstop', () => logger.debug('Circle layout finished'));

            layout.run();
            return layout;
        } catch (error) {
            logger.error(`Error running circle layout: ${error.message}`);
            
            // Fallback to concentric layout if circle fails
            layoutName = 'concentric';
            logger.warn(`Falling back to layout: ${layoutName}`);
            try {
                const layoutOptions = {
                    name: layoutName,
                    fit: true,
                    padding: 80,
                    animate: true,
                    animationDuration: 1200,
                    animationEasing: 'ease-out',
                    concentric: function(node) {
                        return 10 - (node.data('level') || 0);
                    },
                    levelWidth: function(nodes) {
                        const maxLevel = nodes.max(n => n.data('level') || 0).value;
                        if (maxLevel <= 1) return 1.5;
                        return 2.5;
                    },
                    minNodeSpacing: 100,
                    startAngle: 3/2 * Math.PI,
                    sweep: undefined,
                    clockwise: true,
                    avoidOverlap: true,
                    nodeDimensionsIncludeLabels: true,
                    ...options
                };
                const layout = cy.layout(layoutOptions);
                layout.on('layoutstart', () => logger.debug('Concentric layout starting'));
                layout.on('layoutstop', () => logger.debug('Concentric layout finished'));
                layout.run();
                return layout;
            } catch (e) {
                logger.error(`Error running concentric layout: ${e.message}`);
                
                // Fallback to cose if concentric also fails
                layoutName = 'cose';
                logger.warn(`Falling back to layout: ${layoutName}`);
                try {
                    const layout = cy.layout({
                        name: 'cose',
                        animate: true,
                        fit: true,
                        padding: 80,
                        randomize: true,
                        componentSpacing: 120,
                        nodeRepulsion: node => 30000,
                        idealEdgeLength: edge => 150,
                        nodeOverlap: 20,
                        nestingFactor: 1.2,
                        gravity: 30,
                        numIter: 1500,
                        avoidOverlap: true,
                        nodeDimensionsIncludeLabels: true,
                        ...options
                    }).run();
                    logger.debug('Cose layout finished');
                    return layout;
                } catch (e2) {
                    logger.error(`Failed to run cose layout: ${e2.message}`);
                    
                    // Last resort grid
                    layoutName = 'grid';
                    logger.warn(`Falling back to layout: ${layoutName}`);
                    try {
                        return cy.layout({ 
                            name: 'grid', 
                            animate: true, 
                            fit: true,
                            padding: 50
                        }).run();
                    } catch (e3) {
                        logger.error(`Failed to run any layout: ${e3.message}`);
                    }
                }
            }
        }
    }
    
    // Convert API response to Cytoscape model
    function convertToCytoscapeModel(data) {
        try {
            logger.debug("Converting API data to Cytoscape model", data);
            
            const elements = [];
            
            // Add central node
            const centralId = generateUniqueId();
            elements.push({ 
                group: 'nodes',
                data: { 
                    id: centralId, 
                    label: data.central,
                    level: 0,
                    color: "#5D5FEF"
                },
                classes: 'central'
            });
            
            // Process all subtopics recursively
            if (data.subtopics && Array.isArray(data.subtopics)) {
                processSubtopics(data.subtopics, centralId, elements, 1);
            }
            
            logger.debug("Conversion complete", { 
                nodeCount: elements.filter(el => el.group === 'nodes').length,
                edgeCount: elements.filter(el => el.group === 'edges').length,
                centralNode: data.central 
            });
            
            return elements;
        } catch (error) {
            logger.error("Error converting API data to Cytoscape model", error);
            showNotification("Error processing mind map data", "error");
            return null;
        }
    }
    
    // Recursively process subtopics for Cytoscape
    function processSubtopics(subtopics, parentId, elements, level) {
        // Define colors for different levels
        const colors = ["#5D5FEF", "#60A5FA", "#F59E0B", "#10B981", "#EF4444"];
        const color = colors[Math.min(level, colors.length - 1)];
        
        subtopics.forEach(subtopic => {
            const id = generateUniqueId();
            let nodeLabel = "Unnamed Topic"; // Default label in case of unexpected format
            let childrenToProcess = null;

            // Check if the subtopic is a string or an object with a name
            if (typeof subtopic === 'string') {
                nodeLabel = subtopic; // Use the string directly as the label
                // Strings don't have children in this structure
            } else if (typeof subtopic === 'object' && subtopic !== null && subtopic.name) {
                nodeLabel = subtopic.name; // Use the name property
                // Check if this object has children to process recursively
                if (subtopic.children && Array.isArray(subtopic.children)) {
                    childrenToProcess = subtopic.children;
                }
            } else {
                // Log a warning if the format is unexpected
                logger.warn("Unexpected subtopic format encountered:", subtopic);
            }

            // Add this subtopic node
            elements.push({ 
                group: 'nodes',
                data: { 
                    id: id, 
                    label: nodeLabel, // Use the determined label
                    parent: parentId,
                    level: level,
                    color: color
                },
                classes: `level-${level}`
            });
            
            // Add edge connecting to parent
            elements.push({
                group: 'edges',
                data: {
                    source: parentId,
                    target: id
                }
            });
            
            // Process children if they were found in an object
            if (childrenToProcess) {
                processSubtopics(childrenToProcess, id, elements, level + 1);
            }
        });
    }
    
    // Initialize event listeners
    function initEventListeners() {
        // Existing event listeners
        generateBtn.addEventListener('click', () => {
            const idea = centralIdea.value.trim();
            if (idea) {
                generateMindMap(idea);
            } else {
                showNotification("Please enter a project idea", "warning");
            }
        });
        
        centralIdea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const idea = centralIdea.value.trim();
                if (idea) {
                    generateMindMap(idea);
                } else {
                    showNotification("Please enter a project idea", "warning");
                }
            }
        });
        
        downloadBtn.addEventListener('click', downloadMindMap);
        
        refreshBtn.addEventListener('click', () => {
            location.reload();
        });
        
        addTopicBtn.addEventListener('click', () => {
            if (selectedNode) {
                addSubtopic(selectedNode);
            } else {
                showNotification("Please select a node first", "info");
            }
        });
        
        modalSave.addEventListener('click', () => {
            const newText = editNodeText.value.trim();
            if (newText && editingNodeData) {
                if (editCallback) {
                    editCallback(newText);
                    editCallback = null;
                }
                closeModal();
            } else {
                showNotification("Please enter valid text", "warning");
            }
        });
        
        modalCancel.addEventListener('click', closeModal);
        modalClose.addEventListener('click', closeModal);
        
        // Zoom control event listeners
        zoomInBtn.addEventListener('click', () => {
            if (cy) {
                cy.zoom(cy.zoom() * 1.2);
                cy.center();
                logger.event('Zoom in clicked, new zoom: ' + cy.zoom());
            }
        });
        
        zoomOutBtn.addEventListener('click', () => {
            if (cy) {
                cy.zoom(cy.zoom() * 0.8);
                cy.center();
                logger.event('Zoom out clicked, new zoom: ' + cy.zoom());
            }
        });
        
        zoomResetBtn.addEventListener('click', () => {
            if (cy) {
                cy.zoom(defaultZoom);
                cy.center();
                logger.event('Zoom reset clicked');
            }
        });
    }
    
    // Initialize the app
    function init() {
        // Initialize the notification system
        notificationSystem.init();
        
        // Initialize event listeners
        initEventListeners();
        
        // Set focus on the central idea input
        centralIdea.focus();
        
        logger.info('Application initialized');
    }
    
    // Start the app
    init();
    
    // Function to create the mind map with improved animations
    function generateMindMap(centralIdea) {
        logger.api("Generating mind map", { centralIdea });
        
        // Show loading spinner
        loadingContainer.style.display = 'flex';
        mindmapContainer.style.display = 'none';
        mindmapContainer.classList.remove('active');
        
        // Make API request
        fetch('/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ central_idea: centralIdea }),
        })
        .then(response => {
            if (!response.ok) {
                logger.error(`HTTP error: ${response.status}`);
                throw new Error(`HTTP error: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            logger.api("Mind map data received", data);
            
            // Store data for debugging
            console.log("Raw data from API:", JSON.stringify(data, null, 2));
            currentMindMapData = data;
            
            // Initialize cytoscape if not already done
            if (!cy) {
                cy = initDiagram();
            } else {
                // Clear existing elements
                cy.elements().remove();
            }
            
            // Convert data to Cytoscape elements and add them
            const elements = convertToCytoscapeModel(data);
            if (elements && elements.length > 0) {
                // Add elements to the graph
                cy.add(elements);
                
                // Apply layout with animation
                runLayout(cy);
                
                // Animate nodes appearing one by one
                const nodes = cy.nodes();
                
                // Start with all nodes hidden
                nodes.style('opacity', 0);
                
                // First show the central node
                const centralNode = cy.nodes('.central');
                centralNode.style('opacity', 1);
                
                // Then animate the first level nodes
                setTimeout(() => {
                    cy.nodes('[level = 1]').animate({
                        style: { opacity: 1 },
                        duration: 300,
                        easing: 'ease-out'
                    });
                    
                    // Then animate deeper level nodes
                    setTimeout(() => {
                        cy.nodes('[level > 1]').animate({
                            style: { opacity: 1 },
                            duration: 500,
                            easing: 'ease-out'
                        });
                        
                        // Finally animate the edges
                        setTimeout(() => {
                            cy.edges().animate({
                                style: { opacity: 1 },
                                duration: 400,
                                easing: 'ease-out'
                            });
                        }, 200);
                    }, 200);
                }, 300);
                
                // Hide loading spinner
                loadingContainer.style.display = 'none';
                
                // Show mindmap container with animation
                mindmapContainer.style.display = 'flex';
                setTimeout(() => {
                    mindmapContainer.classList.add('active');
                }, 50);
                
                logger.success("Mind map generated successfully");
                showNotification("Mind map generated successfully", "success");
            } else {
                throw new Error("Failed to convert API data to diagram model");
            }
        })
        .catch(error => {
            logger.error("Error generating mind map", error);
            console.error("Detailed error:", error);
            
            // Hide loading spinner
            loadingContainer.style.display = 'none';
            
            showNotification(`Error generating mind map: ${error.message}`, "error");
        });
    }
    
    // Function to download the mind map
    function downloadMindMap() {
        try {
            logger.info("Preparing mind map for download");
            showNotification("Preparing download...", "info");
            
            if (!cy) {
                throw new Error("Mind map is not initialized");
            }
            
            // Use cytoscape-svg extension if available
            if (cy.svg) {
                const svgContent = cy.svg({
                    scale: 1.5,
                    full: true,
                    bg: '#f8fafc',
                    quality: 1.0
                });
                
                // Add svg header and styles
                const styleAddition = `
                    <style>
                        .central { font-weight: bold; font-size: 16px; }
                        text { font-family: "Poppins", Arial, sans-serif; fill: white; }
                    </style>
                `;
                
                // Insert style right after the svg opening tag
                const svgWithStyles = svgContent.replace('<svg', '<svg ' + styleAddition + ' ');
                
                // Create blob and download
                const blob = new Blob([svgWithStyles], {type: 'image/svg+xml;charset=utf-8'});
                saveAs(blob, 'mindmap.svg');
                
                logger.success("Mind map downloaded successfully");
                showNotification("Mind map downloaded successfully", "success");
            } else {
                // Fallback method using canvas
                const png = cy.png({
                    output: 'blob',
                    scale: 2.0,
                    bg: '#f8fafc',
                    full: true
                });
                
                // Create download link
                const url = URL.createObjectURL(png);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'mindmap.png';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                logger.success("Mind map downloaded as PNG");
                showNotification("Mind map downloaded as PNG", "success");
            }
        } catch (error) {
            logger.error("Error downloading mind map", error);
            showNotification(`Error downloading mind map: ${error.message}`, "error");
        }
    }
    
    // Generate subtopics for a node
    function generateSubtopics(node) {
        if (!node) return;
        
        const nodeName = node.data('label');
        const nodeId = node.id();
        logger.api("Generating subtopics", { topic: nodeName });
        
        // Make API request to generate subtopics
        fetch('/generate-subtopics', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ topic: nodeName }),
        })
        .then(response => {
            if (!response.ok) {
                logger.error(`HTTP error: ${response.status}`);
                throw new Error(`HTTP error: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            logger.api("Subtopics data received", data);
            console.log("Subtopics raw data:", JSON.stringify(data, null, 2));
            
            // Add subtopics to the node
            if (data.subtopics && data.subtopics.length > 0) {
                const parentLevel = node.data('level') || 0;
                
                // Define colors for different levels
                const colors = ["#5D5FEF", "#60A5FA", "#F59E0B", "#10B981", "#EF4444"];
                const color = colors[Math.min(parentLevel + 1, colors.length - 1)];
                
                // Calculate positions around the parent node
                const parentPos = node.position();
                const radius = 180; // Distance from parent
                const elements = [];
                
                data.subtopics.forEach((subtopic, index) => {
                    const newId = generateUniqueId();
                    const angle = (2 * Math.PI * index) / data.subtopics.length;
                    const x = parentPos.x + radius * Math.cos(angle);
                    const y = parentPos.y + radius * Math.sin(angle);
                    
                    // Add node
                    elements.push({ 
                        group: 'nodes',
                        data: {
                            id: newId,
                            label: subtopic.name,
                            parent: nodeId,
                            level: parentLevel + 1,
                            color: color
                        },
                        position: { x, y },
                        classes: `level-${parentLevel + 1}`
                    });
                    
                    // Add edge
                    elements.push({
                        group: 'edges',
                        data: {
                            source: nodeId,
                            target: newId
                        }
                    });
                });
                
                // Add all elements at once
                cy.add(elements);
                
                // Run layout
                runLayout(cy);
                
                // Animate new elements appearing
                const newNodes = cy.nodes(`[parent = "${nodeId}"]`).filter(n => n.data('level') === parentLevel + 1);
                const newEdges = cy.edges().filter(e => e.data('source') === nodeId && newNodes.contains(e.target()));
                
                // Start with new elements hidden
                newNodes.style('opacity', 0);
                newEdges.style('opacity', 0);
                
                // Animate nodes appearing
                newNodes.animate({
                    style: { opacity: 1, scale: [0.5, 1] },
                    duration: 500,
                    easing: 'ease-out'
                });
                
                // Then animate edges appearing
                setTimeout(() => {
                    newEdges.animate({
                        style: { opacity: 1 },
                        duration: 400,
                        easing: 'ease-out'
                    });
                }, 200);
                
                logger.success(`Added ${data.subtopics.length} subtopics to node`);
                showNotification(`Added ${data.subtopics.length} subtopics`, "success");
            } else {
                logger.warn("No subtopics received from API");
                showNotification("No subtopics were generated", "warning");
            }
        })
        .catch(error => {
            logger.error("Error generating subtopics", error);
            console.error("Subtopics error details:", error);
            showNotification(`Error generating subtopics: ${error.message}`, "error");
        });
    }
}); 