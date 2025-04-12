document.addEventListener('DOMContentLoaded', () => {
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
    // Store the SVG and D3 force simulation
    let svg = null;
    let simulation = null;
    // Track the currently selected node
    let selectedNode = null;
    
    // Event listener for generate button
    generateBtn.addEventListener('click', () => {
        const idea = centralIdea.value.trim();
        
        if (!idea) {
            alert('Please enter a central idea');
            return;
        }
        
        // Show loading animation
        loadingContainer.classList.add('active');
        mindmapContainer.classList.remove('active');
        
        // API call to generate mind map
        fetch('/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ central_idea: idea })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // Store the mind map data
            currentMindMapData = data;
            
            // Hide loading animation and show mind map
            loadingContainer.classList.remove('active');
            mindmapContainer.classList.add('active');
            
            // Create the mind map visualization
            createForceDirectedMindMap(data);
        })
        .catch(error => {
            console.error('Error:', error);
            loadingContainer.classList.remove('active');
            alert('An error occurred while generating the mind map. Please try again.');
        });
    });
    
    // Event listener for refresh button
    refreshBtn.addEventListener('click', () => {
        centralIdea.value = '';
        mindmapContainer.classList.remove('active');
        centralIdea.focus();
    });
    
    // Event listener for download button
    downloadBtn.addEventListener('click', () => {
        downloadMindMap();
    });
    
    // Function to create mind map using D3.js force-directed layout
    function createForceDirectedMindMap(data) {
        // Clear previous mind map
        document.getElementById('mindmap').innerHTML = '';
        allNodes = [];
        allLinks = [];
        
        // Set up the SVG container
        const width = document.getElementById('mindmap').clientWidth;
        const height = 600;
        
        // Create SVG element
        svg = d3.select('#mindmap')
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .attr('viewBox', [-width/2, -height/2, width, height])
            .classed('mindmap-svg', true);
        
        // Add a background rect for drag events
        const background = svg.append('rect')
            .attr('width', width)
            .attr('height', height)
            .attr('x', -width/2)
            .attr('y', -height/2)
            .attr('fill', 'transparent');
        
        // Add zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.1, 3])
            .on('zoom', zoomed);
        
        svg.call(zoom);
        
        function zoomed(event) {
            g.attr('transform', event.transform);
        }
        
        // Create main group for all elements
        const g = svg.append('g');
        
        // Build nodes and links for the force simulation
        const centralNode = { 
            id: 'central',
            name: data.central, 
            type: 'central', 
            fixed: true,
            x: 0,
            y: 0,
            children: []
        };
        
        allNodes.push(centralNode);
        
        // Create subtopic nodes
        data.subtopics.forEach((subtopic, i) => {
            const subtopicNode = { 
                id: `subtopic-${i}`,
                name: subtopic.name, 
                type: 'subtopic', 
                parent: centralNode,
                children: [],
                expanded: false
            };
            
            allNodes.push(subtopicNode);
            allLinks.push({ source: centralNode, target: subtopicNode });
            centralNode.children.push(subtopicNode);
            
            // Create child nodes
            subtopic.children.forEach((child, j) => {
                const childNode = { 
                    id: `child-${i}-${j}`,
                    name: child.name, 
                    type: 'child', 
                    parent: subtopicNode,
                    children: []
                };
                
                allNodes.push(childNode);
                allLinks.push({ source: subtopicNode, target: childNode });
                subtopicNode.children.push(childNode);
            });
        });
        
        // Create a group for links
        const linkGroup = g.append('g')
            .attr('class', 'links');
        
        // Create a group for nodes
        const nodeGroup = g.append('g')
            .attr('class', 'nodes');
        
        // Initialize the force simulation
        simulation = d3.forceSimulation(allNodes)
            .force('link', d3.forceLink(allLinks).id(d => d.id).distance(d => {
                // Different distances based on node types
                if (d.source.type === 'central' && d.target.type === 'subtopic') {
                    return 150;
                } else {
                    return 80;
                }
            }))
            .force('charge', d3.forceManyBody().strength(d => {
                // Different repulsion based on node types
                if (d.type === 'central') return -1000;
                if (d.type === 'subtopic') return -300;
                return -150;
            }))
            .force('center', d3.forceCenter(0, 0))
            .force('collide', d3.forceCollide().radius(d => {
                // Different collision radius based on node types
                if (d.type === 'central') return 60;
                if (d.type === 'subtopic') return 40;
                return 30;
            }));
        
        // Create lines for links with gradient effect
        const link = linkGroup.selectAll('.link')
            .data(allLinks)
            .enter()
            .append('path')
            .attr('class', 'link')
            .attr('stroke-width', 2)
            .attr('stroke', '#ccc')
            .attr('fill', 'none')
            .attr('opacity', 0)
            .transition()
            .duration(1000)
            .delay((d, i) => i * 50)
            .attr('opacity', 1);
        
        // Create node elements
        const node = nodeGroup.selectAll('.node')
            .data(allNodes)
            .enter()
            .append('g')
            .attr('class', d => `node ${d.type}`)
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended))
            .on('click', nodeClicked)
            .on('dblclick', nodeDblClicked);
        
        // Add circles to nodes with appropriate styles
        node.append('circle')
            .attr('r', d => {
                if (d.type === 'central') return 50;
                if (d.type === 'subtopic') return 35;
                return 25;
            })
            .attr('fill', d => {
                if (d.type === 'central') return '#6c63ff';
                if (d.type === 'subtopic') return 'rgba(108, 99, 255, 0.2)';
                return 'white';
            })
            .attr('stroke', '#6c63ff')
            .attr('stroke-width', 3)
            .attr('opacity', 0)
            .transition()
            .duration(1000)
            .delay((d, i) => i * 100)
            .attr('opacity', 1);
        
        // Add expand button to subtopic nodes
        node.filter(d => d.type === 'subtopic')
            .append('circle')
            .attr('class', 'expand-btn')
            .attr('r', 10)
            .attr('cx', 25)
            .attr('cy', 25)
            .attr('fill', '#6c63ff')
            .attr('stroke', 'white')
            .attr('stroke-width', 2)
            .attr('cursor', 'pointer')
            .on('click', expandNode);
        
        // Add plus sign to expand button
        node.filter(d => d.type === 'subtopic')
            .append('text')
            .attr('class', 'expand-icon')
            .attr('x', 25)
            .attr('y', 25)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .attr('fill', 'white')
            .attr('font-size', '14px')
            .attr('pointer-events', 'none')
            .text('+');
        
        // Add editable text to nodes
        node.append('foreignObject')
            .attr('class', 'node-label-container')
            .attr('width', d => {
                if (d.type === 'central') return 120;
                if (d.type === 'subtopic') return 100;
                return 80;
            })
            .attr('height', d => {
                if (d.type === 'central') return 80;
                if (d.type === 'subtopic') return 60;
                return 50;
            })
            .attr('x', d => {
                if (d.type === 'central') return -60;
                if (d.type === 'subtopic') return -50;
                return -40;
            })
            .attr('y', d => {
                if (d.type === 'central') return -40;
                if (d.type === 'subtopic') return -30;
                return -25;
            })
            .append('xhtml:div')
            .attr('class', 'node-label')
            .attr('contentEditable', 'true')
            .style('width', '100%')
            .style('height', '100%')
            .style('display', 'flex')
            .style('align-items', 'center')
            .style('justify-content', 'center')
            .style('text-align', 'center')
            .style('color', d => d.type === 'central' ? 'white' : 'black')
            .style('font-size', d => {
                if (d.type === 'central') return '16px';
                if (d.type === 'subtopic') return '14px';
                return '12px';
            })
            .style('font-weight', d => d.type === 'central' ? 'bold' : 'normal')
            .style('padding', '5px')
            .style('border-radius', '4px')
            .style('background', 'transparent')
            .style('outline', 'none')
            .style('cursor', 'text')
            .text(d => d.name)
            .on('input', function(event, d) {
                d.name = this.textContent;
            })
            .on('keydown', function(event) {
                // Prevent event propagation to avoid triggering node events
                event.stopPropagation();
            });
        
        // Update simulation on each tick
        simulation.on('tick', () => {
            // Fix central node position if needed
            allNodes[0].x = 0;
            allNodes[0].y = 0;
            
            // Update link positions
            link.attr('d', d => {
                const dx = d.target.x - d.source.x;
                const dy = d.target.y - d.source.y;
                const dr = Math.sqrt(dx * dx + dy * dy);
                return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
            });
            
            // Update node positions
            node.attr('transform', d => `translate(${d.x}, ${d.y})`);
        });
        
        // Functions for node dragging
        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }
        
        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }
        
        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            if (d.type !== 'central') {
                d.fx = null;
                d.fy = null;
            }
        }
        
        // Function to handle node click (select node)
        function nodeClicked(event, d) {
            // Prevent default to avoid text editing conflicts
            event.preventDefault();
            
            // If clicking on the same node, deselect it
            if (selectedNode === d) {
                deselectNode();
                return;
            }
            
            // Deselect previous node if any
            deselectNode();
            
            // Select the clicked node
            selectedNode = d;
            d3.select(this).select('circle')
                .transition()
                .duration(300)
                .attr('stroke', '#ff6b6b')
                .attr('stroke-width', 4);
            
            // Show node actions menu
            showNodeActions(d);
        }
        
        // Function to handle node double-click (edit text)
        function nodeDblClicked(event, d) {
            // Focus on the text content
            d3.select(this).select('.node-label').node().focus();
        }
        
        // Function to deselect the currently selected node
        function deselectNode() {
            if (selectedNode) {
                // Reset node appearance
                svg.selectAll('.node')
                    .select('circle')
                    .transition()
                    .duration(300)
                    .attr('stroke', '#6c63ff')
                    .attr('stroke-width', 3);
                
                // Hide node actions menu
                hideNodeActions();
                
                selectedNode = null;
            }
        }
        
        // Function to handle expand button click
        function expandNode(event, d) {
            // Stop the event from bubbling up to avoid selecting the node
            event.stopPropagation();
            
            if (d.expanded) {
                // Already expanded, do nothing
                return;
            }
            
            // Show loading indicator
            d3.select(this.parentNode)
                .select('.expand-icon')
                .text('...');
            
            // Call API to generate more subtopics
            fetch('/generate-subtopics', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ topic: d.name })
            })
            .then(response => response.json())
            .then(data => {
                // Add new nodes and links
                addNewSubtopics(d, data.subtopics);
                
                // Mark as expanded
                d.expanded = true;
                
                // Change expand button to done
                d3.select(this.parentNode)
                    .select('.expand-icon')
                    .text('✓');
            })
            .catch(error => {
                console.error('Error:', error);
                // Reset button state
                d3.select(this.parentNode)
                    .select('.expand-icon')
                    .text('+');
                
                alert('Failed to generate subtopics. Please try again.');
            });
        }
        
        // Function to add new subtopics to a node
        function addNewSubtopics(parentNode, subtopics) {
            const newNodes = [];
            const newLinks = [];
            
            // Create new nodes and links
            subtopics.forEach((topic, i) => {
                const newNode = {
                    id: `child-${parentNode.id}-${parentNode.children.length + i}`,
                    name: topic.name,
                    type: 'child',
                    parent: parentNode,
                    children: []
                };
                
                newNodes.push(newNode);
                newLinks.push({ source: parentNode, target: newNode });
                
                // Add to parent's children
                parentNode.children.push(newNode);
            });
            
            // Add new nodes to the simulation
            allNodes = allNodes.concat(newNodes);
            allLinks = allLinks.concat(newLinks);
            
            // Add new links
            const newLinkElements = linkGroup.selectAll('.link')
                .data(allLinks)
                .enter()
                .append('path')
                .attr('class', 'link')
                .attr('stroke-width', 2)
                .attr('stroke', '#ccc')
                .attr('fill', 'none')
                .attr('opacity', 0)
                .transition()
                .duration(500)
                .attr('opacity', 1);
            
            // Add new nodes
            const newNodeElements = nodeGroup.selectAll('.node')
                .data(allNodes)
                .enter()
                .append('g')
                .attr('class', d => `node ${d.type}`)
                .call(d3.drag()
                    .on('start', dragstarted)
                    .on('drag', dragged)
                    .on('end', dragended))
                .on('click', nodeClicked)
                .on('dblclick', nodeDblClicked);
            
            // Add circles to new nodes
            newNodeElements.append('circle')
                .attr('r', 25)
                .attr('fill', 'white')
                .attr('stroke', '#6c63ff')
                .attr('stroke-width', 3)
                .attr('opacity', 0)
                .transition()
                .duration(500)
                .attr('opacity', 1);
            
            // Add text to new nodes
            newNodeElements.append('foreignObject')
                .attr('class', 'node-label-container')
                .attr('width', 80)
                .attr('height', 50)
                .attr('x', -40)
                .attr('y', -25)
                .append('xhtml:div')
                .attr('class', 'node-label')
                .attr('contentEditable', 'true')
                .style('width', '100%')
                .style('height', '100%')
                .style('display', 'flex')
                .style('align-items', 'center')
                .style('justify-content', 'center')
                .style('text-align', 'center')
                .style('color', 'black')
                .style('font-size', '12px')
                .style('padding', '5px')
                .style('border-radius', '4px')
                .style('background', 'transparent')
                .style('outline', 'none')
                .style('cursor', 'text')
                .text(d => d.name)
                .on('input', function(event, d) {
                    d.name = this.textContent;
                })
                .on('keydown', function(event) {
                    event.stopPropagation();
                });
            
            // Update the simulation with new nodes
            simulation.nodes(allNodes);
            simulation.force('link').links(allLinks);
            simulation.alpha(1).restart();
        }
        
        // Function to show node actions menu
        function showNodeActions(node) {
            // Create actions menu if it doesn't exist
            if (!document.querySelector('.node-actions')) {
                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'node-actions';
                
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Delete Node';
                deleteBtn.onclick = () => deleteSelectedNode();
                
                const colorBtn = document.createElement('button');
                colorBtn.textContent = 'Change Color';
                colorBtn.onclick = () => changeNodeColor();
                
                actionsDiv.appendChild(deleteBtn);
                actionsDiv.appendChild(colorBtn);
                
                document.querySelector('.mindmap-container').appendChild(actionsDiv);
            }
            
            // Show the menu
            document.querySelector('.node-actions').classList.add('active');
        }
        
        // Function to hide node actions menu
        function hideNodeActions() {
            const actionsMenu = document.querySelector('.node-actions');
            if (actionsMenu) {
                actionsMenu.classList.remove('active');
            }
        }
        
        // Function to delete the selected node
        function deleteSelectedNode() {
            if (!selectedNode || selectedNode.type === 'central') {
                return; // Don't delete central node
            }
            
            // Remove the node and its children from the data
            const removeNodeAndChildren = (node) => {
                // First remove all children recursively
                if (node.children && node.children.length > 0) {
                    [...node.children].forEach(child => {
                        removeNodeAndChildren(child);
                    });
                }
                
                // Remove links connected to this node
                allLinks = allLinks.filter(link => 
                    link.source.id !== node.id && link.target.id !== node.id
                );
                
                // Remove node from its parent's children array
                if (node.parent) {
                    node.parent.children = node.parent.children.filter(child => 
                        child.id !== node.id
                    );
                }
                
                // Remove node from allNodes
                allNodes = allNodes.filter(n => n.id !== node.id);
            };
            
            removeNodeAndChildren(selectedNode);
            
            // Update the visualization
            updateVisualization();
            
            // Deselect the node
            deselectNode();
        }
        
        // Function to change the color of selected node
        function changeNodeColor() {
            if (!selectedNode) return;
            
            // Array of colors to cycle through
            const colors = [
                '#6c63ff', // Original color
                '#ff6b6b', // Red
                '#32d296', // Green
                '#f39c12', // Orange
                '#3498db'  // Blue
            ];
            
            // Get current color from the selected node
            const selectedNodeElement = svg.selectAll('.node')
                .filter(d => d === selectedNode);
            
            const currentCircle = selectedNodeElement.select('circle');
            const currentColor = currentCircle.attr('stroke') || colors[0];
            
            // Find next color in the array
            let nextColorIndex = (colors.indexOf(currentColor) + 1) % colors.length;
            if (nextColorIndex === -1) nextColorIndex = 0;
            
            // Apply new color
            selectedNodeElement.select('circle')
                .transition()
                .duration(300)
                .attr('stroke', colors[nextColorIndex]);
        }
        
        // Function to update the visualization after data changes
        function updateVisualization() {
            // Update links
            const linkSelection = linkGroup.selectAll('.link')
                .data(allLinks, d => `${d.source.id}-${d.target.id}`);
            
            linkSelection.exit().transition().duration(300)
                .attr('opacity', 0)
                .remove();
            
            // Update nodes
            const nodeSelection = nodeGroup.selectAll('.node')
                .data(allNodes, d => d.id);
            
            nodeSelection.exit().transition().duration(300)
                .attr('opacity', 0)
                .remove();
            
            // Update simulation
            simulation.nodes(allNodes);
            simulation.force('link').links(allLinks);
            simulation.alpha(1).restart();
        }
        
        // Register click on background to deselect node
        background.on('click', () => {
            deselectNode();
        });
    }
    
    // Function to download mind map as PNG
    function downloadMindMap() {
        const svgElement = document.querySelector('#mindmap svg');
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = function() {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            const pngFile = canvas.toDataURL('image/png');
            const downloadLink = document.createElement('a');
            
            downloadLink.download = `mindmap-${new Date().toISOString().slice(0, 10)}.png`;
            downloadLink.href = pngFile;
            downloadLink.click();
        };
        
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    }
}); 