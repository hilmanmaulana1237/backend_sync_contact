const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATABASE_FILE = path.join(__dirname, 'database.json');

// ========================
// SECURITY CONFIG
// ========================

const API_KEY = 'CSApp2024SecretKey!@#$';
const ENCRYPTION_KEY = crypto.scryptSync('ContactSyncApp2024', 'salt', 32);
const IV_LENGTH = 16;

const SUPERADMIN = {
    username: 'superadmin',
    password: 'super123'
};

// Support email for forgot password
const SUPPORT_EMAIL = 'hilmanm12347050020@gmail.com';

// ========================
// ENCRYPTION
// ========================

function encrypt(text) {
    if (!text) return text;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
    if (!text || !text.includes(':')) return text;
    try {
        const parts = text.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encryptedText = parts[1];
        const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        return text;
    }
}

// ========================
// MIDDLEWARE
// ========================

app.use(cors());
app.use(bodyParser.json());

function validateApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== API_KEY) {
        return res.status(403).json({
            error: 'Access denied. Invalid API key.',
            code: 'INVALID_API_KEY'
        });
    }
    next();
}

app.use('/api', validateApiKey);

// ========================
// HELPER FUNCTIONS
// ========================

function readDatabase() {
    try {
        if (!fs.existsSync(DATABASE_FILE)) {
            fs.writeFileSync(DATABASE_FILE, JSON.stringify([], null, 2));
            return [];
        }
        const data = fs.readFileSync(DATABASE_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading database:', error);
        return [];
    }
}

function writeDatabase(data) {
    try {
        fs.writeFileSync(DATABASE_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing database:', error);
        return false;
    }
}

// ========================
// PUBLIC ENDPOINTS
// ========================

app.get('/', (req, res) => {
    res.json({
        message: 'Corporate Contact Sync API',
        status: 'running',
        secured: true,
        supportEmail: SUPPORT_EMAIL
    });
});

// Get support email for forgot password
app.get('/api/support', (req, res) => {
    res.json({ email: SUPPORT_EMAIL });
});

// ========================
// COMPANY ENDPOINTS
// ========================

app.post('/api/companies', (req, res) => {
    try {
        const { name, username, passcode } = req.body;
        if (!name || !username || !passcode) {
            return res.status(400).json({ error: 'Name, username, and passcode are required' });
        }

        const database = readDatabase();
        const existingUsername = database.find(c => c.username.toLowerCase() === username.toLowerCase());
        if (existingUsername) {
            return res.status(409).json({ error: 'Username already exists' });
        }

        const newCompany = {
            id: uuidv4(),
            name: name.trim(),
            username: username.trim().toLowerCase(),
            passcode: encrypt(passcode),
            contacts: []
        };

        database.push(newCompany);
        writeDatabase(database);

        res.status(201).json({
            message: 'Company registered successfully',
            company: { id: newCompany.id, name: newCompany.name, username: newCompany.username }
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/companies', (req, res) => {
    const database = readDatabase();
    const companiesList = database.map(c => ({ id: c.id, name: c.name, contactCount: c.contacts.length }));
    res.json({ companies: companiesList });
});

// ========================
// ADMIN ENDPOINTS
// ========================

app.post('/api/admin/login', (req, res) => {
    try {
        const { username, passcode } = req.body;
        if (!username || !passcode) {
            return res.status(400).json({ error: 'Username and passcode are required' });
        }

        const database = readDatabase();
        const company = database.find(c => {
            if (!c.username || c.username.toLowerCase() !== username.toLowerCase()) return false;
            const decryptedPasscode = decrypt(c.passcode);
            return decryptedPasscode === passcode || c.passcode === passcode;
        });

        if (!company) {
            return res.status(401).json({ error: 'Invalid username or passcode' });
        }

        res.status(200).json({
            message: 'Login successful',
            company: { id: company.id, name: company.name, username: company.username, contactCount: company.contacts.length }
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update contact (Admin)
app.put('/api/contacts/:companyId/:contactId', (req, res) => {
    try {
        const { companyId, contactId } = req.params;
        const { name, phone, role, email } = req.body;

        const database = readDatabase();
        const companyIndex = database.findIndex(c => c.id === companyId);
        if (companyIndex === -1) return res.status(404).json({ error: 'Company not found' });

        const contactIndex = database[companyIndex].contacts.findIndex(c => c.id === contactId);
        if (contactIndex === -1) return res.status(404).json({ error: 'Contact not found' });

        // Update fields
        if (name) database[companyIndex].contacts[contactIndex].name = name.trim();
        if (phone) database[companyIndex].contacts[contactIndex].phone = phone.trim();
        if (role !== undefined) database[companyIndex].contacts[contactIndex].role = role.trim();
        if (email !== undefined) database[companyIndex].contacts[contactIndex].email = email.trim();

        writeDatabase(database);
        res.status(200).json({
            message: 'Contact updated successfully',
            contact: database[companyIndex].contacts[contactIndex]
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/companies/:id/contacts', (req, res) => {
    try {
        const { id } = req.params;
        const database = readDatabase();
        const company = database.find(c => c.id === id);
        if (!company) return res.status(404).json({ error: 'Company not found' });
        res.status(200).json({ companyName: company.name, contacts: company.contacts });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/contacts', (req, res) => {
    try {
        const { companyId, name, phone, role, email } = req.body;
        if (!companyId || !name || !phone) {
            return res.status(400).json({ error: 'companyId, name, and phone are required' });
        }

        const database = readDatabase();
        const companyIndex = database.findIndex(c => c.id === companyId);
        if (companyIndex === -1) return res.status(404).json({ error: 'Company not found' });

        const existingContact = database[companyIndex].contacts.find(c => c.phone === phone);
        if (existingContact) {
            return res.status(409).json({ error: 'Contact with this phone number already exists' });
        }

        const newContact = {
            id: uuidv4(),
            name: name.trim(),
            phone: phone.trim(),
            role: role ? role.trim() : '',
            email: email ? email.trim() : ''
        };

        database[companyIndex].contacts.push(newContact);
        writeDatabase(database);
        res.status(201).json({ message: 'Contact added successfully', contact: newContact });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/contacts/:companyId/:contactId', (req, res) => {
    try {
        const { companyId, contactId } = req.params;
        const database = readDatabase();
        const companyIndex = database.findIndex(c => c.id === companyId);
        if (companyIndex === -1) return res.status(404).json({ error: 'Company not found' });

        const contactIndex = database[companyIndex].contacts.findIndex(c => c.id === contactId);
        if (contactIndex === -1) return res.status(404).json({ error: 'Contact not found' });

        database[companyIndex].contacts.splice(contactIndex, 1);
        writeDatabase(database);
        res.status(200).json({ message: 'Contact deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ========================
// SUPERADMIN ENDPOINTS
// ========================

app.post('/api/superadmin/login', (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        if (username === SUPERADMIN.username && password === SUPERADMIN.password) {
            res.status(200).json({ message: 'Superadmin login successful', role: 'superadmin' });
        } else {
            res.status(401).json({ error: 'Invalid superadmin credentials' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all companies with passwords (Superadmin only)
app.get('/api/superadmin/companies', (req, res) => {
    try {
        const database = readDatabase();
        const companies = database.map(c => ({
            id: c.id,
            name: c.name,
            username: c.username,
            passcode: decrypt(c.passcode) || c.passcode, // Decrypt for superadmin view
            contactCount: c.contacts.length,
            contacts: c.contacts
        }));
        res.json({ companies });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update company (Superadmin)
app.put('/api/superadmin/companies/:companyId', (req, res) => {
    try {
        const { companyId } = req.params;
        const { name, username, passcode } = req.body;

        const database = readDatabase();
        const companyIndex = database.findIndex(c => c.id === companyId);
        if (companyIndex === -1) return res.status(404).json({ error: 'Company not found' });

        // Check username uniqueness if changing
        if (username && username.toLowerCase() !== database[companyIndex].username.toLowerCase()) {
            const existingUsername = database.find(c => c.username.toLowerCase() === username.toLowerCase() && c.id !== companyId);
            if (existingUsername) {
                return res.status(409).json({ error: 'Username already exists' });
            }
        }

        // Update fields
        if (name) database[companyIndex].name = name.trim();
        if (username) database[companyIndex].username = username.trim().toLowerCase();
        if (passcode) database[companyIndex].passcode = encrypt(passcode);

        writeDatabase(database);
        res.status(200).json({
            message: 'Company updated successfully',
            company: {
                id: database[companyIndex].id,
                name: database[companyIndex].name,
                username: database[companyIndex].username
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete company (Superadmin)
app.delete('/api/superadmin/companies/:companyId', (req, res) => {
    try {
        const { companyId } = req.params;
        const database = readDatabase();
        const companyIndex = database.findIndex(c => c.id === companyId);
        if (companyIndex === -1) return res.status(404).json({ error: 'Company not found' });

        const deletedCompany = database[companyIndex];
        database.splice(companyIndex, 1);
        writeDatabase(database);
        res.status(200).json({
            message: 'Company deleted successfully',
            deletedCompany: { id: deletedCompany.id, name: deletedCompany.name }
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update contact (Superadmin)
app.put('/api/superadmin/contacts/:companyId/:contactId', (req, res) => {
    try {
        const { companyId, contactId } = req.params;
        const { name, phone, role, email } = req.body;

        const database = readDatabase();
        const companyIndex = database.findIndex(c => c.id === companyId);
        if (companyIndex === -1) return res.status(404).json({ error: 'Company not found' });

        const contactIndex = database[companyIndex].contacts.findIndex(c => c.id === contactId);
        if (contactIndex === -1) return res.status(404).json({ error: 'Contact not found' });

        if (name) database[companyIndex].contacts[contactIndex].name = name.trim();
        if (phone) database[companyIndex].contacts[contactIndex].phone = phone.trim();
        if (role !== undefined) database[companyIndex].contacts[contactIndex].role = role.trim();
        if (email !== undefined) database[companyIndex].contacts[contactIndex].email = email.trim();

        writeDatabase(database);
        res.status(200).json({
            message: 'Contact updated successfully',
            contact: database[companyIndex].contacts[contactIndex]
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete contact (Superadmin)
app.delete('/api/superadmin/contacts/:companyId/:contactId', (req, res) => {
    try {
        const { companyId, contactId } = req.params;
        const database = readDatabase();
        const companyIndex = database.findIndex(c => c.id === companyId);
        if (companyIndex === -1) return res.status(404).json({ error: 'Company not found' });

        const contactIndex = database[companyIndex].contacts.findIndex(c => c.id === contactId);
        if (contactIndex === -1) return res.status(404).json({ error: 'Contact not found' });

        database[companyIndex].contacts.splice(contactIndex, 1);
        writeDatabase(database);
        res.status(200).json({ message: 'Contact deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ========================
// EMPLOYEE SYNC
// ========================

app.post('/api/sync', (req, res) => {
    try {
        const { companyName, passcode } = req.body;
        if (!companyName || !passcode) {
            return res.status(400).json({ error: 'companyName and passcode are required' });
        }

        const database = readDatabase();
        const company = database.find(c => {
            if (c.name.toLowerCase() !== companyName.toLowerCase()) return false;
            const decryptedPasscode = decrypt(c.passcode);
            return decryptedPasscode === passcode || c.passcode === passcode;
        });

        if (!company) {
            return res.status(401).json({ error: 'Invalid company name or passcode' });
        }

        res.status(200).json({
            message: 'Sync successful',
            companyName: company.name,
            contacts: company.contacts
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`🔐 API secured with API key`);
    console.log(`📧 Support email: ${SUPPORT_EMAIL}`);
});
