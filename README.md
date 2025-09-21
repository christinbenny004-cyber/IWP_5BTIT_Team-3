# Project Evaluation System

Tech: Node.js + Express, MySQL (XAMPP), HTML/CSS/JS (Bootstrap)

## Setup
1. Start MySQL in XAMPP.
2. Create DB and tables:
	- Import `database/schema.sql` in phpMyAdmin or run it in MySQL client.
3. Create `.env` in project root:
```
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=project_eval
JWT_SECRET=change_this_secret
```
4. Install dependencies:
```
npm install
```
5. Run the server (auto-restart):
```
npx nodemon
```
6. Open:
	- Login: http://localhost:3000/pages/login.html

## Roles
- Admin: manage users/projects
- Leader: manage own projects, modules, tasks, members
- Member: update task status

## Notes
- Cookies store JWT for auth. For cross-site use, adjust CORS and cookie options.
- Default UI is minimal; customize styles under `frontend/assets`.
"# IWP_5BTIT_Team-3" 
"# IWP_5BTIT_Team-3" 
"# Project_Eval-5BTIT" 
