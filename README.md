# Avatar Generator
A web application for generating and customizing avatars using Midjourney API through Discord integration.
## <img width="1728" alt="Снимок экрана 2025-03-27 в 23 42 08" src="https://github.com/user-attachments/assets/d8dd5529-ab17-4654-b3c7-505133dd80d4" />

## <img width="1728" alt="Снимок экрана 2025-03-27 в 23 42 20" src="https://github.com/user-attachments/assets/48dd3df6-36d6-435c-be2b-f8e10b4ca2c7" />

## Features
- Avatar generation with customizable parameters
- Support for Midjourney v5.x and v6.x
- Reference image support for v6.x
- Seed history for v5.x
- Upscaling functionality
- Responsive UI

## Tech Stack
- Backend: Node.js with Express
- Frontend: Vanilla JavaScript
- Discord API Integration
- Midjourney API Integration

## Prerequisites
- Node.js (v14 or higher)
- Discord Bot Token
- Midjourney Subscription
- Discord Server with Midjourney Bot

## Installation

1. Clone the repository:
```bash
git clone https://github.com/Vsechp/avatar-generator.git
cd avatar-generator
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Configure your environment variables in `.env`:
```env
DISCORD_TOKEN=           # Your Discord bot token
DISCORD_CHANNEL_ID=      # Channel ID where bot will post images
DISCORD_SERVER_ID=       # Your Discord server ID
MIDJOURNEY_DM_CHANNEL_ID=# DM channel ID for seed retrieval
```

5. Start the server:
```bash
npm start
```

6. Open `http://localhost:3000` in your browser

### Environment Variables

- `DISCORD_TOKEN`: Your Discord bot token (required)
- `DISCORD_CHANNEL_ID`: Channel ID where the bot will post images (required)
- `DISCORD_SERVER_ID`: Your Discord server ID (required)
- `MIDJOURNEY_DM_CHANNEL_ID`: DM channel ID for seed retrieval (required for v5.x)
- `PORT`: Server port (optional, defaults to 3000)
- `NODE_ENV`: Environment mode (optional, defaults to development)
- `DEBUG`: Enable debug logging (optional)

## Project Structure 

```
avatar-generator/
├── public/                  # Frontend assets
│   ├── index.html           # Main HTML file for the UI
│   ├── styles.css           # CSS styles for the application
│   └── script.js            # Frontend JavaScript code
├── index.js                 # Main server file with Express and Discord integration
├── .env                     # Environment variables
├── package.json             # Project dependencies and scripts
```
