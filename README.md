# Furniture Room Visualizer — MERN

- **Frontend:** React + TypeScript + Vite + Tailwind + shadcn/ui
- **Backend:** Node.js + Express + MongoDB + JWT
- **2D Editor:** Cursor drag + rotate + **resize handles (8 handles)** + grid + snap + L-shape notch rules
- **3D View:** **Real WebGL (Three.js / React Three Fiber)** with lighting + soft shadows + orbit/zoom + reset
- **Portfolio:** Save / load / delete designs per designer
- **Export:** Export **2D PNG** and **3D PNG** (exports current view)

## Demo login
- Email: `designer@furniture.com`
- Password: `designer`

## Run (step by step)

Front+Back Create .env / .env.example

### 1) Start MongoDB
From the project root:
```bash
docker compose up -d
```

### 2) Start backend
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```
Backend runs at: `http://localhost:4100/health   /   http://localhost:4100`

### 3) Start frontend
```bash
cd ../frontend
cp .env.example .env
npm install
npm run dev
```
Frontend runs at: `http://localhost:5173`

