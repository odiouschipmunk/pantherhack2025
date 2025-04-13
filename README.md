# Project Planner AI

An interactive web application that uses Azure AI (Phi-4-mini) to help break down project ideas into actionable tasks and subtasks.

## Features

- **AI-Powered Planning**: Generate comprehensive project plans from simple ideas
- **Interactive Mind Maps**: Visualize your project structure in an intuitive format
- **Expandable Tasks**: Click on any task to break it down further into subtasks
- **Downloadable Plans**: Export your project plan as an SVG file
- **Enhanced Logging**: Detailed logging for debugging and monitoring

## Technologies Used

- **Backend**: Flask (Python)
- **Frontend**: HTML, CSS, JavaScript
- **Visualization**: D3.js for interactive mind maps
- **AI Model**: Azure AI Inference with Phi-4-mini-instruct

## Setup Instructions

### Prerequisites

- Python 3.8+
- GitHub Account (for API token)
- Azure AI Inference API access

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/project-planner-ai.git
cd project-planner-ai
```

2. Set up a virtual environment
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies
```bash
pip install -r mindmap/requirements.txt
```

4. Set up environment variables
Create a `.env` file in the root directory with the following:
```
GITHUB_TOKEN=your_github_token_here
```

### Getting a GitHub Token for Azure AI

1. Go to your GitHub account settings
2. Navigate to Developer Settings > Personal access tokens
3. Generate a new token with appropriate permissions
4. Copy this token to your `.env` file

### Running the Application

```bash
cd mindmap
python app.py
```

Then open your browser and go to `http://127.0.0.1:5000`

## Usage

1. Enter your project idea in the input field
2. Click "Plan Project" to generate the initial mind map
3. Click on any task to break it down further into subtasks
4. Use the "Download Plan" button to export your mind map as an SVG file
5. Use the "New Project" button to start over

## Developer Notes

- The console logging system provides detailed information about the application's behavior
- Open your browser's developer console (F12) to see the logs
- You can adjust the logging level in the script.js file

## License

This project is open source and available under the [MIT License](LICENSE).

## Acknowledgements

- Azure AI for providing the Phi-4-mini-instruct model
- D3.js for the visualization library 