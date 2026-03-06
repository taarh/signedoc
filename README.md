<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/e225db70-e565-40d7-a701-ba1566bbbea4

## Run Locally

**Prerequisites:**  Node.js, MongoDB (local or remote).

1. Start MongoDB (e.g. on port 27017).
2. Copy `.env.example` to `.env` and set at least `MONGO_URI=mongodb://localhost:27017/signflow` (and optionally `GEMINI_API_KEY`, `APP_URL`).
3. Install dependencies: `npm install`
4. Run the app: `npm run dev`

App runs at http://localhost:3000.

**With Docker:** run `docker compose up -d` to start the app and a local MongoDB in containers. Data and uploads persist in Docker volumes.
