from flask import Flask, render_template, request, jsonify
import os
import json
import re
import logging
import datetime
import uuid
from transformers import pipeline, AutoTokenizer, AutoModelForCausalLM
from dotenv import load_dotenv

# Setup enhanced logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('project_planner.log')
    ]
)
logger = logging.getLogger(__name__)

# Load environment variables (optional if you set any custom paths)
load_dotenv()

app = Flask(__name__)

# Initialize model once at startup to avoid reloading
print("="*80)
logger.info("Starting application")
logger.info("Loading language model...")
print("Loading DeepSeek model...")
model_name = "deepseek-ai/deepseek-coder-6.7b-base"  # Using DeepSeek model
try:
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForCausalLM.from_pretrained(model_name)
    
    # Text generation pipeline
    generator = pipeline(
        "text-generation",
        model=model,
        tokenizer=tokenizer,
        max_length=4096,
        do_sample=True,
        temperature=0.7,
        top_p=0.95
    )
    logger.info(f"DeepSeek model loaded successfully: {model_name}")
    logger.info(f"Model configuration: max_length=1024, temperature=0.7, top_p=0.95")
except Exception as e:
    logger.error(f"Error loading DeepSeek model: {str(e)}")
    print(f"Error loading DeepSeek model: {str(e)}")
    logger.warning("Falling back to smaller model")
    print("Falling back to smaller model...")
    model_name = "google/flan-t5-base"  # Fallback to smaller model
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    generator = pipeline(
        "text2text-generation", 
        model=model_name,
        tokenizer=tokenizer,
        max_length=1024
    )
    logger.info(f"Fallback model loaded successfully: {model_name}")
    logger.info(f"Fallback model configuration: max_length=1024")
print("="*80)

@app.route('/')
def index():
    logger.info("Serving index page")
    return render_template('index.html')

@app.route('/generate', methods=['POST'])
def generate_mindmap():
    # Log the request with unique ID
    request_id = str(uuid.uuid4())[:8]
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    central_idea = request.json.get('central_idea', '')
    logger.info(f"[{request_id}] Received request to generate project plan for: '{central_idea}'")
    print(f"\n{'='*50}")
    print(f"[{timestamp}] REQUEST ID: {request_id}")
    print(f"[{timestamp}] User input: '{central_idea}'")
    
    if not central_idea:
        logger.error(f"[{request_id}] No central idea provided")
        return jsonify({"error": "No central idea provided"}), 400
    
    try:
        # Use local Hugging Face model to generate project tasks
        prompt = f"""Create a detailed project breakdown for: '{central_idea}'.
        
        I need a structured list of tasks and components needed to complete this project/goal.
        
        Return a JSON object with the following structure: 
        {{
            "central": "{central_idea}",
            "subtopics": [
                {{
                    "name": "First major task or component needed",
                    "children": [
                        {{"name": "Specific step or subtask 1"}},
                        {{"name": "Specific step or subtask 2"}}
                    ]
                }},
                {{
                    "name": "Second major task or component needed",
                    "children": [
                        {{"name": "Specific action item 1"}},
                        {{"name": "Specific action item 2"}}
                    ]
                }}
            ]
        }}
        
        Generate 5-7 major tasks/components with 2-3 specific action items or steps for each.
        Make each task specific, actionable, and directly related to implementing {central_idea}.
        Focus on concrete tasks that would be required to build or implement this project.
        Do not use placeholders like "Task 1" - use specific action-oriented descriptions."""
        
        logger.info(f"[{request_id}] Sending prompt to model (length: {len(prompt)} chars)")
        print(f"[{timestamp}] Sending prompt to model:")
        print(f"{'='*30} PROMPT {'='*30}")
        print(prompt)
        print(f"{'='*70}")
        
        # Log model parameters for this specific request
        logger.info(f"[{request_id}] Model: {model_name}, Temperature: 0.7, Max length: 1024")
        
        # Generate content with the model
        generation_start = datetime.datetime.now()
        mindmap_content = generator(prompt, max_length=1024)[0]['generated_text']
        generation_time = (datetime.datetime.now() - generation_start).total_seconds()
        
        # Log the raw model output
        logger.info(f"[{request_id}] Received response from model (generation time: {generation_time:.2f}s)")
        logger.info(f"[{request_id}] Raw output length: {len(mindmap_content)} chars")
        print(f"[{timestamp}] Raw model output (generated in {generation_time:.2f}s):")
        print(f"{'='*30} MODEL OUTPUT {'='*30}")
        print(mindmap_content)
        print(f"{'='*70}")
        
        # Process the response to make it valid JSON
        # Extract JSON from the response (in case it's wrapped in text)
        json_match = re.search(r'\{.*\}', mindmap_content, re.DOTALL)
        if json_match:
            mindmap_content = json_match.group(0)
            logger.info(f"[{request_id}] Extracted JSON from model output")
        
        # If the model output isn't proper JSON, create a fallback structure
        try:
            mindmap_data = json.loads(mindmap_content)
            logger.info(f"[{request_id}] Successfully parsed JSON from model output")
            
            # Check if we have actual meaningful content or just placeholders
            has_generic_content = False
            for subtopic in mindmap_data.get("subtopics", []):
                if subtopic.get("name", "").lower().startswith(("subtopic", "task", "step", "component")):
                    if len(subtopic.get("name", "").split()) < 3:  # Check if too generic
                        has_generic_content = True
                        logger.warning(f"[{request_id}] Detected generic content in model output")
                        break
            
            # If we detected generic content, use the fallback approach
            if has_generic_content:
                logger.warning(f"[{request_id}] Using fallback due to generic content")
                raise json.JSONDecodeError("Generic content detected", mindmap_content, 0)
                
        except json.JSONDecodeError as e:
            # Create intelligent fallback based on the central idea
            logger.warning(f"[{request_id}] JSON decode error, using fallback tasks: {str(e)}")
            subtopics = create_fallback_tasks(central_idea)
            mindmap_data = {
                "central": central_idea,
                "subtopics": subtopics
            }
            print(f"[{timestamp}] Using fallback task generation")
        
        # Print the final data structure being returned
        print(f"[{timestamp}] Final data structure:")
        print(f"{'='*30} FINAL DATA {'='*30}")
        print(json.dumps(mindmap_data, indent=2))
        print(f"{'='*70}")
        
        task_count = len(mindmap_data.get("subtopics", []))
        subtask_count = sum(len(topic.get("children", [])) for topic in mindmap_data.get("subtopics", []))
        logger.info(f"[{request_id}] Returning response with {task_count} main tasks and {subtask_count} subtasks")
        
        return jsonify(mindmap_data)
    
    except Exception as e:
        error_details = str(e)
        logger.error(f"[{request_id}] Error generating mindmap: {error_details}", exc_info=True)
        print(f"[{timestamp}] ERROR: {error_details}")
        return jsonify({"error": error_details}), 500

@app.route('/generate-subtopics', methods=['POST'])
def generate_subtopics():
    # Log the request with unique ID
    request_id = str(uuid.uuid4())[:8]
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    topic = request.json.get('topic', '')
    logger.info(f"[{request_id}] Received request to generate subtopics for: '{topic}'")
    print(f"\n{'='*50}")
    print(f"[{timestamp}] REQUEST ID: {request_id}")
    print(f"[{timestamp}] User requested subtopics for: '{topic}'")
    
    if not topic:
        logger.error(f"[{request_id}] No topic provided")
        return jsonify({"error": "No topic provided"}), 400
    
    try:
        # Use local Hugging Face model to generate more detailed tasks
        prompt = f"""Break down this task/component into specific action items: '{topic}'
        
        Return a JSON array with 3-5 specific steps or subtasks in the following structure: 
        [
            {{"name": "First specific step to accomplish {topic}"}},
            {{"name": "Second concrete action needed for {topic}"}},
            {{"name": "Third detailed task related to {topic}"}}
        ]
        
        Make each step specific, actionable, and directly related to completing {topic}.
        Each step should be concrete enough that someone would know exactly what to do.
        Use action verbs to start each task description when possible.
        Do not use generic names like "Step 1" or "Subtask"."""
        
        logger.info(f"[{request_id}] Sending prompt for subtopics to model (length: {len(prompt)} chars)")
        print(f"[{timestamp}] Sending subtopic prompt to model:")
        print(f"{'='*30} SUBTOPIC PROMPT {'='*30}")
        print(prompt)
        print(f"{'='*70}")
        
        # Log model parameters for this specific request
        logger.info(f"[{request_id}] Model: {model_name}, Temperature: 0.7, Max length: 512")
        
        # Generate content with the model
        generation_start = datetime.datetime.now()
        subtopics_content = generator(prompt, max_length=512)[0]['generated_text']
        generation_time = (datetime.datetime.now() - generation_start).total_seconds()
        
        # Log the raw model output
        logger.info(f"[{request_id}] Received subtopics response from model (generation time: {generation_time:.2f}s)")
        logger.info(f"[{request_id}] Raw output length: {len(subtopics_content)} chars")
        print(f"[{timestamp}] Raw subtopics model output (generated in {generation_time:.2f}s):")
        print(f"{'='*30} SUBTOPICS OUTPUT {'='*30}")
        print(subtopics_content)
        print(f"{'='*70}")
        
        # Process the response to make it valid JSON
        # Extract JSON from the response (in case it's wrapped in text)
        json_match = re.search(r'\[.*\]', subtopics_content, re.DOTALL)
        if json_match:
            subtopics_content = json_match.group(0)
            logger.info(f"[{request_id}] Extracted JSON array from model output")
        print(subtopics_content)
        
        # If the model output isn't proper JSON, create a fallback structure
        try:
            subtopics_data = json.loads(subtopics_content)
            logger.info(f"[{request_id}] Successfully parsed JSON from subtopics output")
            
            # Check if we have meaningful names or just placeholders
            has_generic_content = False
            for subtopic in subtopics_data:
                if subtopic.get("name", "").lower().startswith(("step", "task", "subtask", "item")):
                    if len(subtopic.get("name", "").split()) < 3:  # Check if too generic
                        has_generic_content = True
                        logger.warning(f"[{request_id}] Detected generic content in subtopics")
                        break
            
            # If we detected generic content, use a better fallback approach
            if has_generic_content:
                logger.warning(f"[{request_id}] Using fallback for subtopics due to generic content")
                raise json.JSONDecodeError("Generic content detected", subtopics_content, 0)
                
        except json.JSONDecodeError:
            # Create fallback subtopics based on the topic
            logger.warning(f"[{request_id}] JSON decode error for subtopics, using fallback")
            subtopics_data = create_task_breakdown(topic)
            print(f"[{timestamp}] Using fallback subtask generation")
            
        print(f"[{timestamp}] Final subtopics data:")
        print(f"{'='*30} FINAL SUBTOPICS {'='*30}")
        print(json.dumps(subtopics_data, indent=2))
        print(f"{'='*70}")
        
        logger.info(f"[{request_id}] Returning {len(subtopics_data)} subtopics")
        return jsonify({"subtopics": subtopics_data})
    
    except Exception as e:
        error_details = str(e)
        logger.error(f"[{request_id}] Error generating subtopics: {error_details}", exc_info=True)
        print(f"[{timestamp}] SUBTOPICS ERROR: {error_details}")
        return jsonify({"error": error_details}), 500

# Function to create fallback tasks based on project type
def create_fallback_tasks(project_idea):
    project_idea_lower = project_idea.lower()
    logger.info(f"Creating fallback tasks for: {project_idea}")
    
    # Default tasks for any project
    tasks = [
        {"name": "Define project requirements", 
         "children": [{"name": "Identify core features"}, {"name": "Define target audience"}]},
        
        {"name": "Design project structure", 
         "children": [{"name": "Create system architecture"}, {"name": "Define data models"}]},
        
        {"name": "Set up development environment", 
         "children": [{"name": "Install necessary tools"}, {"name": "Configure version control"}]},
        
        {"name": "Implement core functionality", 
         "children": [{"name": "Build essential features"}, {"name": "Create minimal viable product"}]},
        
        {"name": "Test and debug", 
         "children": [{"name": "Create test cases"}, {"name": "Fix identified issues"}]},
        
        {"name": "Deploy and launch", 
         "children": [{"name": "Set up hosting environment"}, {"name": "Publish project"}]},
    ]
    
    # Add specific tasks based on project type
    if any(term in project_idea_lower for term in ["website", "web app", "web application", "site"]):
        logger.info(f"Detected website project type for: {project_idea}")
        tasks.insert(2, {
            "name": "Design user interface",
            "children": [{"name": "Create wireframes"}, {"name": "Design responsive layouts"}]
        })
        tasks.append({
            "name": "Optimize for performance",
            "children": [{"name": "Implement caching"}, {"name": "Optimize load times"}]
        })
    
    elif any(term in project_idea_lower for term in ["app", "mobile", "android", "ios"]):
        logger.info(f"Detected mobile app project type for: {project_idea}")
        tasks.insert(2, {
            "name": "Design user experience",
            "children": [{"name": "Create UI mockups"}, {"name": "Design navigation flow"}]
        })
        tasks.append({
            "name": "Prepare for app store submission",
            "children": [{"name": "Create store listings"}, {"name": "Prepare promotional materials"}]
        })
    
    elif any(term in project_idea_lower for term in ["data", "analysis", "analytics"]):
        logger.info(f"Detected data analysis project type for: {project_idea}")
        tasks.insert(1, {
            "name": "Collect and prepare data",
            "children": [{"name": "Identify data sources"}, {"name": "Clean and transform data"}]
        })
        tasks.append({
            "name": "Create visualization dashboard",
            "children": [{"name": "Design key metrics display"}, {"name": "Implement interactive charts"}]
        })
    
    return tasks

# Function to create specific task breakdown
def create_task_breakdown(task):
    task_lower = task.lower()
    logger.info(f"Creating task breakdown for: {task}")
    
    # Generic task breakdowns with action verbs
    if "design" in task_lower:
        logger.info(f"Using design-focused task breakdown for: {task}")
        return [
            {"name": f"Research best practices for {task}"},
            {"name": f"Create initial sketches/mockups"},
            {"name": f"Gather feedback on design"},
            {"name": f"Refine and finalize design"},
            {"name": f"Document design decisions"}
        ]
    
    elif any(word in task_lower for word in ["develop", "implement", "build", "code", "program"]):
        logger.info(f"Using development-focused task breakdown for: {task}")
        return [
            {"name": f"Break down {task} into smaller functions"},
            {"name": f"Write pseudo-code for core logic"},
            {"name": f"Implement baseline functionality"},
            {"name": f"Add error handling and edge cases"},
            {"name": f"Refactor and optimize code"}
        ]
    
    elif any(word in task_lower for word in ["test", "qa", "quality"]):
        logger.info(f"Using testing-focused task breakdown for: {task}")
        return [
            {"name": f"Define test criteria for {task}"},
            {"name": f"Create test cases"},
            {"name": f"Execute manual testing"},
            {"name": f"Implement automated tests if applicable"},
            {"name": f"Document test results"}
        ]
    
    else:
        logger.info(f"Using general task breakdown for: {task}")
        # Default task breakdown with action verbs
        return [
            {"name": f"Research requirements for {task}"},
            {"name": f"Create detailed plan for implementation"},
            {"name": f"Identify potential challenges"},
            {"name": f"Execute core components"},
            {"name": f"Review and refine outcome"}
        ]

if __name__ == '__main__':
    logger.info("Starting Flask development server")
    print("="*80)
    print("Project Planner AI Server started")
    print("Open your browser and go to http://127.0.0.1:5000")
    print("Press CTRL+C to quit")
    print("="*80)
    app.run(debug=True) 