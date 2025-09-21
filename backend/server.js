const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const path = require('path');
const { exec } = require('child_process');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { initDb } = require('./models/db');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const projectRoutes = require('./routes/projects');
const teamRoutes = require('./routes/teams');

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use('/assets', express.static(path.join(__dirname, '..', 'frontend', 'assets')));
app.use('/pages', express.static(path.join(__dirname, '..', 'frontend', 'pages')));

app.get('/', (req, res) => {
	res.redirect('/pages/login.html');
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/teams', teamRoutes);

// Global error handler
app.use((err, req, res, next) => {
	console.error(err);
	res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const URL = process.env.RAILWAY_STATIC_URL || `http://localhost:${PORT}`;

initDb()
	.then(() => {
		app.listen(PORT, HOST, () => {
			console.log(`🚀 Server running on ${HOST}:${PORT}`);
			console.log(`🌐 Application URL: ${URL}`);
			if (process.env.NODE_ENV !== 'production') {
				console.log(`📱 Login Page: ${URL}/pages/login.html`);
			}
			if (process.platform === 'win32') {
				exec(`start ${URL}`, (error) => {
					if (error) {
						console.log('💡 Please manually open:', URL);
					} else {
						console.log('🌐 Browser launched automatically!');
					}
				});
			}
			// Auto-launch browser (macOS)
			else if (process.platform === 'darwin') {
				exec(`open ${URL}`, (error) => {
					if (error) {
						console.log('💡 Please manually open:', URL);
					} else {
						console.log('🌐 Browser launched automatically!');
					}
				});
			}
			// Auto-launch browser (Linux)
			else {
				exec(`xdg-open ${URL}`, (error) => {
					if (error) {
						console.log('💡 Please manually open:', URL);
					} else {
						console.log('🌐 Browser launched automatically!');
					}
				});
			}
		});
	})
	.catch((err) => {
		console.error('Failed to initialize database:', err);
		process.exit(1);
	});
