# ♟️ 3D Chess — Real-Time Multiplayer Chess in the Browser

![3D Chess Banner]https://photos.app.goo.gl/Hk2zztuntRGuvibD8 <!-- Replace with your actual game screenshot or banner image -->

<div align="center">

✨ A **beautifully rendered** 3D chess game built with **Three.js**, powered by real-time multiplayer using **Socket.IO**. Play online with friends or watch the board come to life!

[![Made with Three.js](https://img.shields.io/badge/3D-Three.js-blue)](https://threejs.org/)
[![Powered by Vite](https://img.shields.io/badge/Bundler-Vite-yellow)](https://vitejs.dev/)
[![Socket.IO](https://img.shields.io/badge/Realtime-Socket.IO-red)](https://socket.io/)

</div>

---

## 🚀 Features

- 🎮 **Immersive 3D Graphics**: Realistic pieces, smooth lighting, shadows, and camera control
- 🌐 **Real-time Multiplayer**: Battle opponents live over the web using Socket.IO
- ✅ **Complete Chess Logic**: Castling, en passant, promotion, checks, and legal move enforcement
- 🔄 **Reconnect Support**: Disconnected? No worries — jump right back into your match
- 📱 **Responsive Design**: Optimized for both desktop and mobile
- 📜 **Game History**: Track moves, captured pieces, and see the flow of the game
- 🧠 **Game Controls**: Resign, offer draws, flip board — play your way!

---

## 🧱 Tech Stack

| Layer        | Technology                      |
| ------------ | ------------------------------- |
| 🎨 Frontend  | `Three.js`, `GSAP`, `Vite`       |
| ♟️ Logic     | `chess.js`                      |
| 🔌 Realtime  | `Socket.IO`                     |
| ⚙️ Backend   | `Node.js`                        |

---

## 🕹️ How to Play

1. **Create Game**: Click **"Create New Game"** to generate a room
2. **Invite Opponent**: Share the unique **Game ID**
3. **Join Game**: Enter the Game ID on the join screen
4. **Make Moves**: 
    - Click a piece ➝ Click a highlighted tile
    - Legal moves are auto-validated

---

## 🧭 Controls

| Action            | Input                                     |
|-------------------|--------------------------------------------|
| Select / Move     | **Left Click** on piece & destination      |
| Rotate Camera     | **Drag Mouse**                             |
| Zoom              | **Mouse Wheel**                            |
| Flip Board        | **Toggle Button**                          |
| Mobile Support    | **On-screen controls included**            |

---

## 🎨 Game Features

- 🟢 **Legal Move Highlights**
- 🔥 **Animated Piece Movement**
- ⚠️ **Check & Checkmate Indicators**
- ♻️ **Captured Pieces Tracker**
- 🧾 **Move History Panel**
- 💬 **Draw / Resign Options**
- 🔄 **Flip Perspective Feature**

---

## 💻 Local Installation

### 🔧 Prerequisites

- [Node.js](https://nodejs.org/) (v14+)
- npm or yarn

### 📦 Setup

```bash
git clone https://github.com/yourusername/3d_chess.git
cd 3d_chess
```

Install dependencies:

```bash
npm install
# or
yarn
```

Start development server:

```bash
npm run dev
# or
yarn dev
```

Start backend server:

```bash
node server/server.js
```

Now open your browser at `http://localhost:5173`

---

## 🚀 Deployment

### 🖼️ Frontend

Build static assets:

```bash
npm run build
```

Deploy `dist/` folder using Vercel, Netlify, GitHub Pages, or Render.

### 🔌 Backend

Run server on any Node.js host (Render, Heroku, VPS, etc.):

```bash
node server/server.js
```

---

## 📁 Project Structure

```
3d_chess/
├── /public/          # Static assets (textures, sounds, etc.)
├── /src/             # Three.js-based frontend code
│   ├── main.js       # Main game logic
│   └── style.css     # Styling
├── /server/          # Node.js + Socket.IO backend
│   └── server.js     # WebSocket game server
```

---

## 🌟 Roadmap

- ⏱️ Timers and time control (blitz/classical)
- 📊 ELO rating system
- 🧠 Single-player AI opponent
- 🎥 Game recording & replay
- 🧬 Multiple 3D environments/themes
- 🎵 Sound effects and music

---


## 🙏 Acknowledgments

- [Three.js](https://threejs.org/) for 3D rendering
- [chess.js](https://github.com/jhlywa/chess.js) for rule logic
- [Socket.IO](https://socket.io/) for realtime connections
- [GSAP](https://greensock.com/gsap/) for smooth animations

---

<div align="center">
Made with ❤️ by <strong>Vivek Mishra</strong>
</div>
