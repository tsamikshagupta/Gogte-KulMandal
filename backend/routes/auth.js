import express from 'express';
import jwt from 'jsonwebtoken';

export default function createAuthRouter(connectToMongo) {
  const router = express.Router();

  async function getUsersCollection(db) {
    const configured = (process.env.MONGODB_LOGIN_COLLECTION || process.env.MONGODB_USERS_COLLECTION || process.env.MONGODB_COLLECTION || '').trim();
    const candidates = [];
    if (configured) candidates.push(configured);
    candidates.push('login', 'Login', 'users', 'Users');
    const available = await db.listCollections({}, { nameOnly: true }).toArray().catch(() => []);
    const names = available.map(entry => entry.name);
    for (const candidate of candidates) {
      if (names.includes(candidate)) {
        return db.collection(candidate);
      }
    }
    const normalized = new Map(names.map(name => [name.replace(/[\s_]/g, '').toLowerCase(), name]));
    for (const candidate of candidates) {
      const match = normalized.get(candidate.replace(/[\s_]/g, '').toLowerCase());
      if (match) {
        return db.collection(match);
      }
    }
    return db.collection(candidates[0] || 'login');
  }

  function sanitizeEmailValue(value) {
    const str = String(value || '').trim();
    return str;
  }

  function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function findFieldValue(source, fields) {
    for (const field of fields) {
      if (source[field] !== undefined && source[field] !== null && source[field] !== '') {
        return source[field];
      }
    }
    const lookup = new Map();
    for (const key of Object.keys(source)) {
      lookup.set(key.replace(/[\s_]/g, '').toLowerCase(), source[key]);
    }
    for (const field of fields) {
      const key = field.replace(/[\s_]/g, '').toLowerCase();
      if (lookup.has(key)) {
        return lookup.get(key);
      }
    }
    return null;
  }

  const emailFields = [
    'email',
    'Email',
    'gmail',
    'Gmail',
    'username',
    'Username',
    'userEmail',
    'UserEmail',
    'emailId',
    'EmailId',
    'EmailID',
    'emailID',
    'Email Address',
    'Email address',
    'Email_Address',
    'EmailAddress',
    'email_address',
    'emailAddress',
    'login',
    'Login',
    'primaryEmail',
    'PrimaryEmail'
  ];

  const passwordFields = [
    'password',
    'Password',
    'pass',
    'Pass',
    'pwd',
    'Pwd',
    'passwordHash',
    'PasswordHash',
    'Password Hash',
    'Passcode',
    'PassCode'
  ];

  router.post('/register', async (req, res) => {
    try {
      const { firstName, lastName, email, password, confirmPassword, phoneNumber, dateOfBirth, gender, occupation } = req.body;
      const sanitizedEmail = sanitizeEmailValue(email);
      if (!sanitizedEmail || !password || !firstName || !lastName) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      if (password !== confirmPassword) {
        return res.status(400).json({ message: 'Passwords do not match' });
      }
      const db = await connectToMongo();
      const users = await getUsersCollection(db);
      const emailLower = sanitizedEmail.toLowerCase();
      const emailRegex = new RegExp(`^${escapeRegex(emailLower)}$`, 'i');
      const existing = await users.findOne({
        $or: emailFields.map(field => ({ [field]: emailRegex }))
      });
      if (existing) {
        return res.status(409).json({ message: 'Email already registered' });
      }
      const doc = {
        firstName,
        lastName,
        email: emailLower,
        gmail: emailLower,
        password,
        phoneNumber: phoneNumber || '',
        dateOfBirth: dateOfBirth || '',
        gender: gender || '',
        occupation: occupation || '',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const result = await users.insertOne(doc);
      const userId = result.insertedId;
      const token = jwt.sign({ sub: String(userId), email: doc.email }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
      return res.status(201).json({
        message: 'Registration successful',
        token,
        user: { id: String(userId), firstName: doc.firstName, lastName: doc.lastName, email: doc.email }
      });
    } catch (err) {
      console.error('[auth] register error', err);
      return res.status(500).json({ message: 'Registration failed' });
    }
  });

  router.post('/login', async (req, res) => {
    try {
      const rawLogin = req.body?.email || req.body?.username || req.body?.login || req.body?.userEmail || '';
      console.log('[auth] login attempt:', { login: rawLogin, hasPassword: !!req.body.password });
      const sanitizedEmailInput = sanitizeEmailValue(rawLogin);
      const inputPassword = String(req.body.password || '').trim();
      if (!sanitizedEmailInput || !inputPassword) {
        console.log('[auth] login failed: missing email or password');
        return res.status(400).json({ message: 'Email and password are required' });
      }
      if (sanitizedEmailInput === process.env.DBA_EMAIL && inputPassword === process.env.DBA_PASSWORD) {
        const token = jwt.sign({
          sub: 'dba_admin',
          email: sanitizedEmailInput,
          role: 'dba'
        }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
        return res.json({
          message: 'DBA Login successful',
          token,
          user: {
            id: 'dba_admin',
            firstName: 'Database',
            lastName: 'Administrator',
            email: sanitizedEmailInput,
            role: 'dba'
          }
        });
      }
      if (sanitizedEmailInput === process.env.ADMIN_EMAIL && inputPassword === process.env.ADMIN_PASSWORD) {
        const token = jwt.sign({
          sub: 'admin_user',
          email: sanitizedEmailInput,
          role: 'admin'
        }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
        return res.json({
          message: 'Admin Login successful',
          token,
          user: {
            id: 'admin_user',
            firstName: 'System',
            lastName: 'Administrator',
            email: sanitizedEmailInput,
            role: 'admin'
          }
        });
      }
      const db = await connectToMongo();
      // 1) Prefer explicit login collection for username/email login
      const loginCollName = (process.env.MONGODB_LOGIN_COLLECTION || 'login').trim();
      let users = null;
      if (loginCollName) {
        try {
          const collNames = (await db.listCollections({}, { nameOnly: true }).toArray()).map(x => x.name);
          if (collNames.includes(loginCollName)) {
            users = db.collection(loginCollName);
          }
        } catch (_) {}
      }
      // 2) Fallback: dynamic detection as before
      if (!users) {
        users = await getUsersCollection(db);
      }
      const normalizedEmail = sanitizedEmailInput.toLowerCase();
      const emailRegex = new RegExp(`^${escapeRegex(normalizedEmail)}$`, 'i');
      console.log('[auth] using collection:', users?.collectionName || 'unknown');

      const candidateFields = [...emailFields, 'username', 'Username', 'login', 'Login'];
      let user = await users.findOne({
        $or: [
          ...candidateFields.map(field => ({ [field]: emailRegex })),
          ...candidateFields.map(field => ({ [field]: sanitizedEmailInput }))
        ]
      });

      // Fallback: use aggregation to match toLower across all candidate fields
      if (!user) {
        const candidates = candidateFields;
        const pipeline = [
          {
            $addFields: {
              __ids: candidates.map(f => ({ f, v: { $ifNull: [`$${f}`, ''] } }))
            }
          },
          {
            $match: {
              __ids: {
                $elemMatch: {
                  v: { $type: 'string' },
                  $expr: { $eq: [{ $toLower: '$$this.v' }, normalizedEmail] }
                }
              }
            }
          },
          { $limit: 1 }
        ];
        user = await users.aggregate(pipeline).next();
      }
      if (!user) {
        const pipeline = [
          {
            $addFields: {
              __emails: emailFields.map(field => ({ field, value: { $ifNull: [`$${field}`, ''] } }))
            }
          },
          {
            $match: {
              __emails: {
                $elemMatch: {
                  value: { $type: 'string' },
                  $expr: {
                    $eq: [
                      { $toLower: '$$this.value' },
                      normalizedEmail
                    ]
                  }
                }
              }
            }
          },
          { $limit: 1 }
        ];
        user = await users.aggregate(pipeline).next();
      }
      if (!user) {
        console.log('[auth] login: user not found for email', sanitizedEmailInput);
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      const storedPasswordValue = findFieldValue(user, passwordFields);
      const storedPassword = storedPasswordValue !== null && storedPasswordValue !== undefined ? String(storedPasswordValue) : '';
      let ok = false;
      if (storedPassword.startsWith('$2')) {
        const { default: bcrypt } = await import('bcryptjs');
        ok = await bcrypt.compare(inputPassword, storedPassword);
      } else {
        ok = storedPassword === inputPassword;
      }
      if (!ok) {
        console.log('[auth] login: password mismatch', {
          userId: user._id?.toString?.() || 'unknown',
          matchedPasswordField: passwordFields.find(field => user[field] !== undefined && user[field] !== null && user[field] !== '') || null
        });
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      const resolvedEmailValue = findFieldValue(user, emailFields) || sanitizedEmailInput;
      const resolvedRole = user.role || user.Role || user.userRole || 'user';
      const serNo = user.serNo || user.SerNo || user.serno || null;
      const token = jwt.sign({
        sub: String(user._id),
        email: String(resolvedEmailValue).toLowerCase(),
        role: resolvedRole,
        serNo: serNo
      }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
      return res.json({
        message: 'Login successful',
        token,
        user: {
          id: String(user._id),
          firstName: user.firstName || user.FirstName || user.firstname || '',
          lastName: user.lastName || user.LastName || user.lastname || '',
          email: String(resolvedEmailValue).toLowerCase(),
          role: resolvedRole,
          serNo: serNo
        }
      });
    } catch (err) {
      console.error('[auth] login error', err);
      return res.status(500).json({ message: 'Login failed' });
    }
  });

  router.get('/me', async (req, res) => {
    try {
      const auth = req.headers.authorization || '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
      if (!token) return res.status(401).json({ message: 'Missing token' });
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
      if (payload.sub === 'dba_admin') {
        return res.json({
          id: 'dba_admin',
          name: 'Database Administrator',
          email: payload.email,
          role: 'dba'
        });
      }
      const db = await connectToMongo();

      // Prefer resolving from permanent members collection to get full name
      const membersCollName = (process.env.MONGODB_COLLECTION || 'members').trim() || 'members';
      const members = db.collection(membersCollName);
      const serNoToken = payload.serNo !== undefined && payload.serNo !== null ? payload.serNo : null;
      const emailToken = (payload.email || '').toString().trim().toLowerCase();

      let member = null;
      if (serNoToken !== null) {
        const sNum = Number(serNoToken);
        const bySerNo = [
          { serNo: sNum },
          { serNo: String(serNoToken) },
          { 'personalDetails.serNo': sNum },
          { 'personalDetails.serNo': String(serNoToken) }
        ];
        member = await members.findOne({ $or: bySerNo });
      }
      if (!member && emailToken) {
        const emailRegex = new RegExp(`^${escapeRegex(emailToken)}$`, 'i');
        member = await members.findOne({
          $or: [
            { 'personalDetails.email': emailRegex },
            { email: emailRegex },
            { gmail: emailRegex },
          ]
        });
      }

      // Try to enrich name using login collection as well
      const loginCollName = (process.env.MONGODB_LOGIN_COLLECTION || 'login').trim() || 'login';
      const loginColl = db.collection(loginCollName);
      const loginUser = emailToken ? await loginColl.findOne({ $or: [
        { email: new RegExp(`^${escapeRegex(emailToken)}$`, 'i') },
        { gmail: new RegExp(`^${escapeRegex(emailToken)}$`, 'i') },
        { Email: new RegExp(`^${escapeRegex(emailToken)}$`, 'i') },
        { userEmail: new RegExp(`^${escapeRegex(emailToken)}$`, 'i') }
      ]}) : null;

      // Fallback to original collection search if needed
      let user = member;
      if (!user) {
        const users = await getUsersCollection(db);
        try {
          user = await users.findOne({ _id: new (await import('mongodb')).ObjectId(payload.sub) });
        } catch (_) {
          user = null;
        }
      }
      if (!user) return res.status(404).json({ message: 'User not found' });

      const resolvedEmailValue = findFieldValue(user, emailFields) || user.email || user.Email || '';
      const resolvedRole = user.role || user.Role || user.userRole || 'user';
      const serNo = user.serNo || user.SerNo || user.serno || null;
      const personal = user.personalDetails || {};
      const first = personal.firstName || user.firstName || user.FirstName || '';
      const middle = personal.middleName || user.middleName || user.MiddleName || '';
      const last = personal.lastName || user.lastName || user.LastName || '';
      let displayName = [first, middle, last].filter(Boolean).join(' ').trim() || (user.name && String(user.name).trim()) || '';
      if (!displayName && loginUser && (loginUser.username || loginUser.login || loginUser.Username || loginUser.Login)) {
        const uname = loginUser.username || loginUser.login || loginUser.Username || loginUser.Login;
        const base = String(uname).split('_')[0];
        displayName = base || '';
      }
      return res.json({
        id: String(user._id),
        name: displayName,
        firstName: first,
        middleName: middle,
        lastName: last,
        email: String(resolvedEmailValue).toLowerCase(),
        role: resolvedRole,
        serNo: serNo
      });
    } catch (err) {
      console.error('[auth] me error', err);
      return res.status(401).json({ message: 'Invalid token' });
    }
  });

  return router;
}
