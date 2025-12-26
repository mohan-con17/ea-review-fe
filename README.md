# EA Review MAF – React UI

## Overview
This project contains the **React.js frontend** for the EA Review MAF platform.  
The UI is responsible for rendering architecture review results, live review status, similarity scores, and agent-driven insights exposed by the backend FastAPI service.

The application is designed for local development with a clean, modular React setup.

---

## Tech Stack
- **React.js (18+)**
- **JavaScript** (based on project setup)
- **Node.js (18 LTS recommended)**
- **npm** or **yarn**
- **Material UI (MUI)** (if applicable)
- **Axios / Fetch** for API communication

---

## Prerequisites
Ensure the following are installed on your local machine:
- Node.js 18.x or later
- npm (bundled with Node.js) or yarn
- Git

Verify installation:
```bash
node -v
npm -v
```

---

## Steps to Run Locally

### 1. Clone the Repository
```bash
git clone <repository-url>
cd ea-review-maf-ui
```

### 2. Install Dependencies
Using **npm**:
```bash
npm install
```

Or using **yarn**:
```bash
yarn install
```

---

### 3. Configure Environment Variables (If Applicable)
Create a `.env` file in the root directory and configure backend API details:
```env
REACT_APP_API_BASE_URL=http://127.0.0.1:8000
```

> Restart the server after updating environment variables.


### 4. Start the Development Server
Using **npm**:
```bash
npm run dev
```

The application will start on:
```
http://localhost:5173
```

## Project Structure (High-Level)
```
ea-review-maf-ui/
│── src/
│   ├── components/       # Reusable UI components
│   ├── pages/            # Page-level components
│   ├── services/         # API service calls
│   ├── hooks/            # Custom React hooks
│   ├── styles/           # Global and component styles
│   └── App.jsx           # Application entry
│── public/
│── package.json
│── README.md
```
