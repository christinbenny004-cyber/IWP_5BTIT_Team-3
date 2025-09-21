const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
	const token = req.cookies.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
	if (!token) return res.status(401).json({ message: 'Unauthorized' });
	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
		req.user = decoded;
		next();
	} catch (err) {
		return res.status(401).json({ message: 'Invalid token' });
	}
}

function authorize(roles = []) {
	return (req, res, next) => {
		if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
		if (roles.length && !roles.includes(req.user.role)) {
			return res.status(403).json({ message: 'Forbidden' });
		}
		next();
	};
}

module.exports = { authenticate, authorize };
