const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

if (!getApps().length) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT environment variable is not set.'
    );
  }

  initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  });
}

async function verifyToken(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      message: 'Missing or invalid Authorization header.',
    });
  }

  let decoded;

  try {
    decoded = await getAuth().verifyIdToken(token);
  } catch (error) {
    console.error('Token verification failed:', error.code || error.message);

    return res.status(401).json({
      message: 'Invalid or expired token.',
    });
  }

  try {
    const snap = await getFirestore()
      .collection('users')
      .doc(decoded.uid)
      .get();

    if (!snap.exists) {
      return res.status(403).json({
        message: 'No user profile found for this account.',
      });
    }

    req.user = {
      uid: decoded.uid,
      email: decoded.email || '',
      role: snap.data().role,
    };

    next();
  } catch (error) {
    console.error('Role lookup failed:', error.message);

    return res.status(500).json({
      message: 'Unable to verify user role.',
    });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: 'You do not have permission to do this.',
      });
    }

    next();
  };
}

module.exports = { verifyToken, requireRole };