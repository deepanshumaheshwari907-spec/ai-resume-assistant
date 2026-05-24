# ResumeAI 🚀

> **AI-Powered Resume Analyzer & Career Assistant**  
> Get hired faster with AI that knows what recruiters want.

🌐 **Live Demo:** [ai-resume-assistant-cyan.vercel.app](https://ai-resume-assistant-cyan.vercel.app)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔍 **ATS Score Analysis** | Get your exact ATS score with detailed breakdown |
| ✨ **AI Resume Rewrite** | AI rewrites your resume with power verbs & keywords |
| 🎤 **Mock Interview Bot** | Practice with AI interviewer, get real feedback |
| 🎯 **JD Match Score** | See how well your resume matches any job description |
| 📝 **Cover Letter AI** | Generate personalized cover letters in seconds |
| 📊 **Resume History** | Track your improvement over time |
| 📄 **PDF Download** | Download ATS-friendly resume as PDF |

---

## 🛠️ Tech Stack

**Frontend:**
- React.js
- React Router DOM
- Axios
- jsPDF
- Lucide React
- React Hot Toast

**Backend:**
- FastAPI (Python)
- SQLAlchemy
- PostgreSQL (Supabase)
- JWT Authentication
- Groq AI (LLaMA 3)
- pdfplumber

**Deployment:**
- Frontend → Vercel
- Backend → Render
- Database → Supabase

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+
- Groq API Key ([console.groq.com](https://console.groq.com))

### Frontend Setup

```bash
cd frontend
npm install
```

Create `.env` file in `frontend/`:
```
REACT_APP_API_URL=http://127.0.0.1:8000
```

```bash
npm start
```

### Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

Create `.env` file in `backend/`:
```
GROQ_API_KEY=your_groq_api_key_here
SECRET_KEY=your_secret_key_here
DATABASE_URL=sqlite:///./resumeai.db
```

```bash
uvicorn main:app --reload
```

---

## 📁 Project Structure

```
ai-resume-assistant/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Signup.jsx
│   │   │   ├── Terms.jsx
│   │   │   └── NotFound.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── utils/
│   │   │   ├── api.js
│   │   │   └── constants.js
│   │   └── components/
│   │       └── ProtectedRoute.jsx
│   └── public/
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── auth.py
│   └── requirements.txt
└── README.md
```

---

## 🔑 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/signup` | Create account |
| POST | `/auth/login` | Login |
| GET | `/auth/me` | Get current user |
| POST | `/upload-resume` | Analyze resume |
| POST | `/rewrite` | Rewrite resume |
| POST | `/chat` | Mock interview |
| POST | `/match-jd` | JD match score |
| POST | `/cover-letter` | Generate cover letter |
| GET | `/history` | Resume history |

---

## 💰 Pricing

| Plan | Price | Features |
|------|-------|---------|
| Free | ₹0/month | 2 analyses/month, ATS Score |
| Pro | ₹199/month | Unlimited + all features |
| Elite | ₹499/month | Everything + LinkedIn optimization |

---

## 🤝 Contributing

Contributions are welcome! Feel free to open issues and pull requests.

---

## 📄 License

MIT License — feel free to use this project.

---

## 👨‍💻 Built By

**Deepanshu Maheshwari**  
AI & ML Engineering Student  
📧 deepanshumaheshwari907@gmail.com  
🔗 [LinkedIn](https://www.linkedin.com/in/deepanshu-maheshwari/)  
🐙 [GitHub](https://github.com/deepanshumaheshwari907-spec)

---

⭐ **Star this repo if you found it helpful!**