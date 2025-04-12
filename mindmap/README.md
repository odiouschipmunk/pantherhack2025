# MindMapAI

A beautiful web application that transforms central ideas into comprehensive mind maps using locally hosted AI models.

![MindMapAI Demo](static/images/demo.png)

## Features

- Generate detailed mind maps from a central idea
- Uses local Hugging Face models (no API keys needed)
- Beautiful, animated visualization using D3.js
- Download mind maps as PNG images
- Responsive design that works on all devices
- Zoom and pan functionality for exploring large mind maps

## Installation

1. Clone the repository:
```
git clone <repository-url>
cd mindmap
```

2. Create a virtual environment:
```
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```
pip install -r requirements.txt
```

4. (Optional) Configure custom model:
If you want to use a different Hugging Face model, you can create a `.env` file and set the MODEL_NAME:
```
cp .env.example .env
```
Edit the `.env` file to choose your preferred model.

## Usage

1. Start the Flask development server:
```
python app.py
```

2. Open your browser and navigate to `http://127.0.0.1:5000/`

3. Enter your central idea in the input field and click "Generate Mind Map"

4. Explore your mind map - you can zoom in/out and pan around

5. Download the mind map as a PNG image using the "Download as PNG" button

## Technologies Used

- Backend: Python, Flask
- Frontend: HTML, CSS, JavaScript
- Visualization: D3.js
- AI: Hugging Face Transformers
- Animation: CSS transitions and D3 animations

## License

MIT 