from flask import Flask, render_template, request, jsonify
import os
import json
import re
from transformers import pipeline, AutoTokenizer, AutoModelForCausalLM
from dotenv import load_dotenv

# Load environment variables (optional if you set any custom paths)
load_dotenv()

app = Flask(__name__)

# Initialize model once at startup to avoid reloading
print("Loading Hugging Face model...")
model_name = "google/flan-t5-base"  # A smaller model for faster loading and inference
tokenizer = AutoTokenizer.from_pretrained(model_name)
generator = pipeline(
    "text2text-generation", 
    model=model_name,
    tokenizer=tokenizer,
    max_length=1024
)
print("Model loaded successfully!")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/generate', methods=['POST'])
def generate_mindmap():
    central_idea = request.json.get('central_idea', '')
    
    if not central_idea:
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
        
        # Generate content with the model
        mindmap_content = generator(prompt, max_length=1024)[0]['generated_text']
        
        # Process the response to make it valid JSON
        # Extract JSON from the response (in case it's wrapped in text)
        json_match = re.search(r'\{.*\}', mindmap_content, re.DOTALL)
        if json_match:
            mindmap_content = json_match.group(0)
        
        # If the model output isn't proper JSON, create a fallback structure
        try:
            mindmap_data = json.loads(mindmap_content)
            
            # Check if we have actual meaningful content or just placeholders
            has_generic_content = False
            for subtopic in mindmap_data.get("subtopics", []):
                if subtopic.get("name", "").lower().startswith(("subtopic", "task", "step", "component")):
                    if len(subtopic.get("name", "").split()) < 3:  # Check if too generic
                        has_generic_content = True
                        break
            
            # If we detected generic content, use the fallback approach
            if has_generic_content:
                raise json.JSONDecodeError("Generic content detected", mindmap_content, 0)
                
        except json.JSONDecodeError:
            # Create intelligent fallback based on the central idea
            subtopics = create_fallback_tasks(central_idea)
            mindmap_data = {
                "central": central_idea,
                "subtopics": subtopics
            }
        
        return jsonify(mindmap_data)
    
    except Exception as e:
        print(f"Error generating mindmap: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/generate-subtopics', methods=['POST'])
def generate_subtopics():
    topic = request.json.get('topic', '')
    
    if not topic:
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
        
        # Generate content with the model
        subtopics_content = generator(prompt, max_length=512)[0]['generated_text']
        
        # Process the response to make it valid JSON
        # Extract JSON from the response (in case it's wrapped in text)
        json_match = re.search(r'\[.*\]', subtopics_content, re.DOTALL)
        if json_match:
            subtopics_content = json_match.group(0)
        
        # If the model output isn't proper JSON, create a fallback structure
        try:
            subtopics_data = json.loads(subtopics_content)
            
            # Check if we have meaningful names or just placeholders
            has_generic_content = False
            for subtopic in subtopics_data:
                if subtopic.get("name", "").lower().startswith(("step", "task", "subtask", "item")):
                    if len(subtopic.get("name", "").split()) < 3:  # Check if too generic
                        has_generic_content = True
                        break
            
            # If we detected generic content, use a better fallback approach
            if has_generic_content:
                raise json.JSONDecodeError("Generic content detected", subtopics_content, 0)
                
        except json.JSONDecodeError:
            # Create fallback subtopics based on the topic
            subtopics_data = create_task_breakdown(topic)
        
        return jsonify({"subtopics": subtopics_data})
    
    except Exception as e:
        print(f"Error generating subtopics: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Function to create fallback tasks based on project type
def create_fallback_tasks(project_idea):
    project_idea_lower = project_idea.lower()
    
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
        tasks.insert(2, {
            "name": "Design user interface",
            "children": [{"name": "Create wireframes"}, {"name": "Design responsive layouts"}]
        })
        tasks.append({
            "name": "Optimize for performance",
            "children": [{"name": "Implement caching"}, {"name": "Optimize load times"}]
        })
    
    elif any(term in project_idea_lower for term in ["app", "mobile", "android", "ios"]):
        tasks.insert(2, {
            "name": "Design user experience",
            "children": [{"name": "Create UI mockups"}, {"name": "Design navigation flow"}]
        })
        tasks.append({
            "name": "Prepare for app store submission",
            "children": [{"name": "Create store listings"}, {"name": "Prepare promotional materials"}]
        })
    
    elif any(term in project_idea_lower for term in ["data", "analysis", "analytics"]):
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
    
    # Generic task breakdowns with action verbs
    if "design" in task_lower:
        return [
            {"name": f"Research best practices for {task}"},
            {"name": f"Create initial sketches/mockups"},
            {"name": f"Gather feedback on design"},
            {"name": f"Refine and finalize design"},
            {"name": f"Document design decisions"}
        ]
    
    elif any(word in task_lower for word in ["develop", "implement", "build", "code", "program"]):
        return [
            {"name": f"Break down {task} into smaller functions"},
            {"name": f"Write pseudo-code for core logic"},
            {"name": f"Implement baseline functionality"},
            {"name": f"Add error handling and edge cases"},
            {"name": f"Refactor and optimize code"}
        ]
    
    elif any(word in task_lower for word in ["test", "qa", "quality"]):
        return [
            {"name": f"Define test criteria for {task}"},
            {"name": f"Create test cases"},
            {"name": f"Execute manual testing"},
            {"name": f"Implement automated tests if applicable"},
            {"name": f"Document test results"}
        ]
    
    else:
        # Default task breakdown with action verbs
        return [
            {"name": f"Research requirements for {task}"},
            {"name": f"Create detailed plan for implementation"},
            {"name": f"Identify potential challenges"},
            {"name": f"Execute core components"},
            {"name": f"Review and refine outcome"}
        ]

if __name__ == '__main__':
    app.run(debug=True) 