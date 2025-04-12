document.addEventListener('DOMContentLoaded', () => {
    console.log('='.repeat(50));
    console.log('Application initialized');
    console.log('='.repeat(50));
    
    const centralIdea = document.getElementById('central-idea');
    const generateBtn = document.getElementById('generate-btn');
    const loadingContainer = document.querySelector('.loading-container');
    const mindmapContainer = document.querySelector('.mindmap-container');
    const downloadBtn = document.getElementById('download-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    
    // Store the current mind map data
    let currentMindMapData = null;
    // Store all nodes for easy access
    let allNodes = [];
    // Store all links for easy access
    let allLinks = [];
    
    // Create SVG element for the mind map
    const width = 1000;
    const height = 600;
    const svg = d3.select("#mindmap")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("class", "mindmap-svg")
        .append("g")
        .attr("transform", `translate(${width/2},${height/2})`);
    
    // Add a toggle subtopics button if it doesn't exist
    if (!document.getElementById('toggleSubtopicsBtn')) {
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'toggleSubtopicsBtn';
        toggleBtn.textContent = 'Hide Subtopics';
        toggleBtn.className = 'toggle-btn';
        document.querySelector('.global-actions').appendChild(toggleBtn);
    }
    
    // Add loading spinner if it doesn't exist
    if (!document.getElementById('loadingSpinner')) {
        const loadingSpinner = document.createElement('div');
        loadingSpinner.id = 'loadingSpinner';
        loadingSpinner.className = 'spinner';
        loadingContainer.prepend(loadingSpinner);
    }
    
    // Track the currently selected node
    let selectedNode = null;
    
    // Global variables
    let root;
    let nodes = {};
    let activeNodeId = null;
    let showSubtopics = true;
    
    // Console logging configuration
    const logConfig = {
        enabled: true,
        logLevel: 'info', // 'debug', 'info', 'warn', 'error'
        colorStyle: {
            debug: 'color: #9A9A9A',
            info: 'color: #0078D7',
            warn: 'color: #FF8C00',
            error: 'color: #E81123',
            success: 'color: #107C10',
            api: 'color: #6B2EB8',
            event: 'color: #008080'
        }
    };
    
    // Logging functions
    const logger = {
        debug: function(message, data) {
            if (logConfig.enabled && (logConfig.logLevel === 'debug')) {
                if (data) {
                    console.debug(`%c[DEBUG] ${message}`, logConfig.colorStyle.debug, data);
                } else {
                    console.debug(`%c[DEBUG] ${message}`, logConfig.colorStyle.debug);
                }
            }
        },
        
        info: function(message, data) {
            if (logConfig.enabled && (['debug', 'info'].includes(logConfig.logLevel))) {
                if (data) {
                    console.info(`%c[INFO] ${message}`, logConfig.colorStyle.info, data);
                } else {
                    console.info(`%c[INFO] ${message}`, logConfig.colorStyle.info);
                }
            }
        },
        
        warn: function(message, data) {
            if (logConfig.enabled && (['debug', 'info', 'warn'].includes(logConfig.logLevel))) {
                if (data) {
                    console.warn(`%c[WARN] ${message}`, logConfig.colorStyle.warn, data);
                } else {
                    console.warn(`%c[WARN] ${message}`, logConfig.colorStyle.warn);
                }
            }
        },
        
        error: function(message, data) {
            if (logConfig.enabled) {
                if (data) {
                    console.error(`%c[ERROR] ${message}`, logConfig.colorStyle.error, data);
                } else {
                    console.error(`%c[ERROR] ${message}`, logConfig.colorStyle.error);
                }
            }
        },
        
        success: function(message, data) {
            if (logConfig.enabled && (['debug', 'info'].includes(logConfig.logLevel))) {
                if (data) {
                    console.info(`%c[SUCCESS] ${message}`, logConfig.colorStyle.success, data);
                }
            }
        },
        
        event: function(message, data) {
            if (logConfig.enabled && (['debug', 'info', 'warn'].includes(logConfig.logLevel))) {
                if (data) {
                    console.info(`%c[EVENT] ${message}`, logConfig.colorStyle.event, data);
                } else {
                    console.info(`%c[EVENT] ${message}`, logConfig.colorStyle.event);
                }
            }
        },
        
        api: function(message, data) {
            if (logConfig.enabled && (['debug', 'info', 'warn'].includes(logConfig.logLevel))) {
                if (data) {
                    console.info(`%c[API] ${message}`, logConfig.colorStyle.api, data);
                } else {
                    console.info(`%c[API] ${message}`, logConfig.colorStyle.api);
                }
            }
        }
    };
    
    // Event listener for generate button
    generateBtn.addEventListener('click', () => {
        const idea = centralIdea.value.trim();
        if (idea) {
            logger.event("Generate button clicked", { centralIdea: idea });
            generateMindMap(idea);
        } else {
            logger.warn("Generate button clicked with empty central idea");
            alert('Please enter a central idea');
        }
    });
    
    // Event listener for refresh button
    refreshBtn.addEventListener('click', () => {
        logger.event("Refresh button clicked");
        centralIdea.value = '';
        centralIdea.focus();
    });
    
    // Event listener for download button
    downloadBtn.addEventListener('click', () => {
        logger.event("Download button clicked");
        if (svg) {
            downloadMindMap();
        } else {
            logger.warn("Download attempted with no mindmap generated");
            alert('Please generate a mind map first');
        }
    });
    
    // Function to toggle visibility of subtopics
    document.getElementById('toggleSubtopicsBtn').addEventListener('click', function() {
        logger.event("Toggle subtopics button clicked", { currentState: showSubtopics });
        showSubtopics = !showSubtopics;
        if (root) {
            updateButtonText();
            updateVisibility(root);
        }
    });
    
    // Function to create the mind map
    function generateMindMap(centralIdea) {
        logger.api("Generating mind map", { centralIdea });
        
        // Show loading spinner
        loadingContainer.style.display = 'flex';
        
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
            
            // Clear existing mind map
            svg.selectAll("*").remove();
            
            // Reset nodes object
            nodes = {};
            
            // Create hierarchical data structure
            root = d3.hierarchy(data);
            
            // Store each node in the nodes object with its ID as key
            storeNodes(root);
            
            // Create the mind map visualization
            createMindMap();
            
            // Hide loading spinner
            loadingContainer.style.display = 'none';
            
            // Show mindmap container
            mindmapContainer.style.display = 'block';
            
            logger.success("Mind map generated successfully");
        })
        .catch(error => {
            logger.error("Error generating mind map", error);
            
            // Hide loading spinner
            loadingContainer.style.display = 'none';
            
            alert('Error generating mind map: ' + error.message);
        });
    }
    
    // Function to store all nodes in the nodes object
    function storeNodes(node) {
        if (node) {
            // Generate a unique ID if not present
            if (!node.data.id) {
                node.data.id = generateNodeId();
            }
            
            // Store the node in the nodes object
            nodes[node.data.id] = node;
            
            // Recursively store child nodes
            if (node.children) {
                node.children.forEach(child => storeNodes(child));
            }
        }
    }
    
    // Function to generate subtopics
    function generateSubtopics(nodeId) {
        const node = nodes[nodeId];
        if (!node) {
            logger.error("Cannot generate subtopics - node not found", { nodeId });
            return;
        }
        
        logger.api("Generating subtopics", { nodeId, topic: node.data.name });
        
        // Show loading indicator
        node.data.isLoading = true;
        updateNode(node);
        
        // Make API request
        fetch('/generate-subtopics', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ topic: node.data.name }),
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
            
            // Hide loading indicator
            node.data.isLoading = false;
            
            // Add child nodes
            if (data.subtopics && data.subtopics.length > 0) {
                // Check for existing children
                if (!node.children) {
                    node.children = [];
                }
                
                // Add new subtopics
                data.subtopics.forEach(subtopic => {
                    const childNode = {
                        name: subtopic.name,
                        id: generateNodeId(),
                        type: 'subtopic'
                    };
                    
                    node.children.push(childNode);
                    
                    // Store the new node
                    const hierarchyNode = d3.hierarchy(childNode);
                    hierarchyNode.depth = node.depth + 1;
                    hierarchyNode.parent = node;
                    
                    nodes[childNode.id] = hierarchyNode;
                });
                
                logger.info(`Added ${data.subtopics.length} subtopics to node`, { nodeId });
                
                // Update the visualization
                updateMindMap();
            } else {
                logger.warn("No subtopics received from API", { nodeId });
                alert('No subtopics were generated');
            }
            
            // Update the node appearance
            updateNode(node);
        })
        .catch(error => {
            logger.error("Error generating subtopics", { nodeId, error });
            
            // Hide loading indicator
            node.data.isLoading = false;
            updateNode(node);
            
            alert('Error generating subtopics: ' + error.message);
        });
    }
    
    // Function to create the mind map visualization
    function createMindMap() {
        logger.info("Creating mind map visualization");
        
        // Clear any existing visualization
        svg.selectAll("*").remove();
        
        // Create the tree layout
        const treeLayout = d3.tree()
            .size([800, 400])
            .separation((a, b) => (a.parent == b.parent ? 1 : 1.2));
        
        // Apply the layout to the hierarchy
        treeLayout(root);
        
        // Add links between nodes
        const links = svg.selectAll(".link")
            .data(root.links())
            .enter()
            .append("path")
            .attr("class", "link")
            .attr("d", d3.linkHorizontal()
                .x(d => d.y)
                .y(d => d.x));
        
        // Add node groups
        const nodeGroups = svg.selectAll(".node")
            .data(root.descendants())
            .enter()
            .append("g")
            .attr("class", d => `node ${d.data.type || ""}`)
            .attr("data-id", d => d.data.id)
            .attr("transform", d => `translate(${d.y},${d.x})`)
            .on("click", handleNodeClick);
        
        // Add node circles
        nodeGroups.append("circle")
            .attr("r", 5)
            .attr("class", d => getNodeClass(d));
        
        // Add node labels
        nodeGroups.append("text")
            .attr("dy", "0.31em")
            .attr("x", d => d.children ? -8 : 8)
            .attr("text-anchor", d => d.children ? "end" : "start")
            .text(d => d.data.name)
            .each(function(d) {
                // Wrap text if too long
                wrapText(this, 150);
            });
        
        logger.success("Mind map visualization created");
    }
    
    // Function to handle node click
    function handleNodeClick(event, d) {
        logger.event("Node clicked", { 
            nodeId: d.data.id, 
            name: d.data.name,
            type: d.data.type || "main",
            depth: d.depth
        });
        
        // Prevent event from bubbling up
        event.stopPropagation();
        
        // Set active node
        setActiveNode(d.data.id);
        
        // Generate subtopics if not already loaded or loading
        if (!d.children && !d.data.isLoading) {
            generateSubtopics(d.data.id);
        }
    }
    
    // Function to set active node
    function setActiveNode(nodeId) {
        // Remove active class from previous active node
        if (activeNodeId && nodes[activeNodeId]) {
            d3.select(`g[data-id="${activeNodeId}"]`)
                .select("circle")
                .classed("active", false);
        }
        
        // Set new active node
        activeNodeId = nodeId;
        
        // Add active class to new active node
        if (activeNodeId && nodes[activeNodeId]) {
            d3.select(`g[data-id="${activeNodeId}"]`)
                .select("circle")
                .classed("active", true);
            
            logger.debug("Active node set", { activeNodeId });
        }
    }
    
    // Function to update a node's appearance
    function updateNode(node) {
        const nodeGroup = d3.select(`g[data-id="${node.data.id}"]`);
        
        // Update node circle appearance
        nodeGroup.select("circle")
            .attr("class", getNodeClass(node));
    }
    
    // Function to get node class based on node state
    function getNodeClass(node) {
        let classes = [];
        
        if (node.data.id === activeNodeId) {
            classes.push("active");
        }
        
        if (node.data.isLoading) {
            classes.push("loading");
        }
        
        if (node.data.type) {
            classes.push(node.data.type);
        }
        
        return classes.join(" ");
    }
    
    // Function to update the mind map visualization
    function updateMindMap() {
        logger.info("Updating mind map visualization");
        
        // Recalculate the layout
        const treeLayout = d3.tree()
            .size([800, 400])
            .separation((a, b) => (a.parent == b.parent ? 1 : 1.2));
        
        treeLayout(root);
        
        // Update links
        const links = svg.selectAll(".link")
            .data(root.links(), d => d.target.data.id);
        
        // Remove old links
        links.exit().remove();
        
        // Add new links
        links.enter()
            .append("path")
            .attr("class", "link")
            .merge(links)
            .transition()
            .duration(500)
            .attr("d", d3.linkHorizontal()
                .x(d => d.y)
                .y(d => d.x));
        
        // Update nodes
        const nodeGroups = svg.selectAll(".node")
            .data(root.descendants(), d => d.data.id);
        
        // Remove old nodes
        nodeGroups.exit().remove();
        
        // Add new nodes
        const newNodeGroups = nodeGroups.enter()
            .append("g")
            .attr("class", d => `node ${d.data.type || ""}`)
            .attr("data-id", d => d.data.id)
            .attr("transform", d => {
                // Position new nodes at their parent's position initially
                const parent = d.parent || { y: 0, x: 0 };
                return `translate(${parent.y},${parent.x})`;
            })
            .on("click", handleNodeClick);
        
        // Add circles to new nodes
        newNodeGroups.append("circle")
            .attr("r", 5)
            .attr("class", d => getNodeClass(d));
        
        // Add text to new nodes
        newNodeGroups.append("text")
            .attr("dy", "0.31em")
            .attr("x", d => d.children ? -8 : 8)
            .attr("text-anchor", d => d.children ? "end" : "start")
            .text(d => d.data.name)
            .each(function(d) {
                // Wrap text if too long
                wrapText(this, 150);
            });
        
        // Update all nodes' positions
        svg.selectAll(".node")
            .transition()
            .duration(500)
            .attr("transform", d => `translate(${d.y},${d.x})`);
        
        logger.success("Mind map visualization updated");
    }
    
    // Function to download the mind map
    function downloadMindMap() {
        try {
            logger.info("Preparing mind map for download");
            
            // Get the SVG element
            const svgElement = document.querySelector('svg');
            
            // Get SVG as string
            const serializer = new XMLSerializer();
            let svgString = serializer.serializeToString(svgElement);
            
            // Add XML declaration
            svgString = '<?xml version="1.0" standalone="no"?>\r\n' + svgString;
            
            // Create a blob
            const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            const svgUrl = URL.createObjectURL(svgBlob);
            
            // Create download link
            const downloadLink = document.createElement('a');
            downloadLink.href = svgUrl;
            downloadLink.download = 'mindmap.svg';
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            
            logger.success("Mind map downloaded successfully");
        } catch (error) {
            logger.error("Error downloading mind map", error);
            alert('Error downloading mind map: ' + error.message);
        }
    }
    
    // Function to wrap text to prevent long labels
    function wrapText(textElement, width) {
        const text = d3.select(textElement);
        const words = text.text().split(/\s+/).reverse();
        const lineHeight = 1.1; // ems
        const y = text.attr("y");
        const x = text.attr("x");
        const dy = parseFloat(text.attr("dy"));
        
        let line = [];
        let lineNumber = 0;
        let word = words.pop();
        let tspan = text.text(null).append("tspan").attr("x", x).attr("y", y).attr("dy", dy + "em");
        
        while (word) {
            line.push(word);
            tspan.text(line.join(" "));
            if (tspan.node().getComputedTextLength() > width) {
                line.pop();
                tspan.text(line.join(" "));
                line = [word];
                tspan = text.append("tspan").attr("x", x).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
            }
            word = words.pop();
        }
    }
    
    // Function to update visibility of subtopics
    function updateVisibility(node) {
        logger.debug("Updating subtopics visibility", { showSubtopics });
        
        // Update all subtopic nodes
        d3.selectAll(".node.subtopic")
            .style("opacity", showSubtopics ? 1 : 0.3);
        
        // Update all links to subtopic nodes
        d3.selectAll(".link")
            .filter(d => d.target.data.type === "subtopic")
            .style("opacity", showSubtopics ? 1 : 0.3);
    }
    
    // Function to update button text
    function updateButtonText() {
        const toggleButton = document.getElementById('toggleSubtopicsBtn');
        toggleButton.textContent = showSubtopics ? 'Hide Subtopics' : 'Show Subtopics';
        logger.debug("Updated toggle button text", { showSubtopics });
    }
    
    // Function to generate a unique node ID
    function generateNodeId() {
        return 'node-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
    }
    
    // Display console message on page load
    logger.info("Project Planner application initialized");
    logger.debug("Debug logging enabled - set logConfig.logLevel to 'info' to disable debug messages");
}); 