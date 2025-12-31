const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");
const { createClient } = require("redis");
const path = require("path");

const app = express();

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "../public")));
app.use(cors());
app.use(bodyParser.json());

const API_KEY = "CSApp2024SecretKey!@#$";
const ENCRYPTION_KEY = crypto.scryptSync("ContactSyncApp2024", "salt", 32);
const IV_LENGTH = 16;

const SUPERADMIN = {
  username: "superadmin",
  password: "super123",
};

// Redis connection
const REDIS_URL = process.env.REDIS_URL || "redis://default:tzHpJhCPIvOURTAYdnqTe0QoNd2AUywR@redis-17846.c292.ap-southeast-1-1.ec2.cloud.redislabs.com:17846";
const DB_KEY = "contact_sync_database";

let redisClient = null;

// Initialize Redis connection
async function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({
      url: REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 500)
      }
    });

    redisClient.on('error', (err) => console.error('Redis Client Error:', err));
    redisClient.on('connect', () => console.log('✅ Connected to Redis'));

    await redisClient.connect();
  }
  return redisClient;
}

// Helper functions for database
async function readDatabase() {
  try {
    const client = await getRedisClient();
    const data = await client.get(DB_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Error reading database:", error);
    return [];
  }
}

async function writeDatabase(data) {
  try {
    const client = await getRedisClient();
    await client.set(DB_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error("Error writing database:", error);
    return false;
  }
}

// ========================
// ENCRYPTION
// ========================

function encrypt(text) {
  if (!text) return text;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decrypt(text) {
  if (!text || !text.includes(":")) return text;
  try {
    const parts = text.split(":");
    const iv = Buffer.from(parts[0], "hex");
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
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
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || apiKey !== API_KEY) {
    return res.status(403).json({
      error: "Access denied. Invalid API key.",
      code: "INVALID_API_KEY",
    });
  }
  next();
}

app.use("/api", validateApiKey);

// ========================
// ENDPOINTS
// ========================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.post("/api/companies", async (req, res) => {
  try {
    const { name, username, passcode } = req.body;
    if (!name || !username || !passcode) {
      return res
        .status(400)
        .json({ error: "Name, username, and passcode are required" });
    }

    const database = await readDatabase();
    const existingUsername = database.find(
      (c) => c.username && c.username.toLowerCase() === username.toLowerCase()
    );
    if (existingUsername) {
      return res.status(409).json({ error: "Username already exists" });
    }

    const newCompany = {
      id: uuidv4(),
      name: name.trim(),
      username: username.trim().toLowerCase(),
      passcode: encrypt(passcode),
      contacts: [],
    };

    database.push(newCompany);
    await writeDatabase(database);
    res.status(201).json({
      message: "Company registered successfully",
      company: {
        id: newCompany.id,
        name: newCompany.name,
        username: newCompany.username,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/admin/login", async (req, res) => {
  try {
    const { username, passcode } = req.body;
    if (!username || !passcode) {
      return res
        .status(400)
        .json({ error: "Username and passcode are required" });
    }

    const database = await readDatabase();
    const company = database.find((c) => {
      if (!c.username || c.username.toLowerCase() !== username.toLowerCase())
        return false;
      const decryptedPasscode = decrypt(c.passcode);
      return decryptedPasscode === passcode || c.passcode === passcode;
    });

    if (!company) {
      return res.status(401).json({ error: "Invalid username or passcode" });
    }

    res.status(200).json({
      message: "Login successful",
      company: {
        id: company.id,
        name: company.name,
        username: company.username,
        contactCount: company.contacts.length,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/superadmin/login", (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" });
    }

    if (username === SUPERADMIN.username && password === SUPERADMIN.password) {
      res
        .status(200)
        .json({ message: "Superadmin login successful", role: "superadmin" });
    } else {
      res.status(401).json({ error: "Invalid superadmin credentials" });
    }
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/superadmin/companies", async (req, res) => {
  try {
    const database = await readDatabase();
    const companies = database.map((c) => ({
      id: c.id,
      name: c.name,
      username: c.username,
      contactCount: c.contacts.length,
      contacts: c.contacts,
    }));
    res.json({ companies });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/api/superadmin/companies/:companyId", async (req, res) => {
  try {
    const { companyId } = req.params;
    const database = await readDatabase();
    const companyIndex = database.findIndex((c) => c.id === companyId);
    if (companyIndex === -1)
      return res.status(404).json({ error: "Company not found" });

    const deletedCompany = database[companyIndex];
    database.splice(companyIndex, 1);
    await writeDatabase(database);
    res
      .status(200)
      .json({
        message: "Company deleted successfully",
        deletedCompany: { id: deletedCompany.id, name: deletedCompany.name },
      });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete(
  "/api/superadmin/contacts/:companyId/:contactId",
  async (req, res) => {
    try {
      const { companyId, contactId } = req.params;
      const database = await readDatabase();
      const companyIndex = database.findIndex((c) => c.id === companyId);
      if (companyIndex === -1)
        return res.status(404).json({ error: "Company not found" });

      const contactIndex = database[companyIndex].contacts.findIndex(
        (c) => c.id === contactId
      );
      if (contactIndex === -1)
        return res.status(404).json({ error: "Contact not found" });

      database[companyIndex].contacts.splice(contactIndex, 1);
      await writeDatabase(database);
      res.status(200).json({ message: "Contact deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

app.post("/api/contacts", async (req, res) => {
  try {
    const { companyId, name, phone, role, email } = req.body;
    if (!companyId || !name || !phone) {
      return res
        .status(400)
        .json({ error: "companyId, name, and phone are required" });
    }

    const database = await readDatabase();
    const company = database.find((c) => c.id === companyId);
    if (!company) return res.status(404).json({ error: "Company not found" });

    const existingContact = company.contacts.find((c) => c.phone === phone);
    if (existingContact) {
      return res
        .status(409)
        .json({ error: "Contact with this phone number already exists" });
    }

    const newContact = {
      id: uuidv4(),
      name: name.trim(),
      phone: phone.trim(),
      role: role ? role.trim() : "",
      email: email ? email.trim() : "",
    };

    company.contacts.push(newContact);
    await writeDatabase(database);
    res
      .status(201)
      .json({ message: "Contact added successfully", contact: newContact });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/sync", async (req, res) => {
  try {
    const { companyName, passcode } = req.body;
    if (!companyName || !passcode) {
      return res
        .status(400)
        .json({ error: "companyName and passcode are required" });
    }

    const database = await readDatabase();
    const company = database.find((c) => {
      if (c.name.toLowerCase() !== companyName.toLowerCase()) return false;
      const decryptedPasscode = decrypt(c.passcode);
      return decryptedPasscode === passcode || c.passcode === passcode;
    });

    if (!company) {
      return res
        .status(401)
        .json({ error: "Invalid company name or passcode" });
    }

    res
      .status(200)
      .json({
        message: "Sync successful",
        companyName: company.name,
        contacts: company.contacts,
      });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/companies", async (req, res) => {
  try {
    const database = await readDatabase();
    const companiesList = database.map((c) => ({
      id: c.id,
      name: c.name,
      contactCount: c.contacts.length,
    }));
    res.json({ companies: companiesList });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/companies/:id/contacts", async (req, res) => {
  try {
    const { id } = req.params;
    const database = await readDatabase();
    const company = database.find((c) => c.id === id);
    if (!company) return res.status(404).json({ error: "Company not found" });
    res
      .status(200)
      .json({ companyName: company.name, contacts: company.contacts });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/api/contacts/:companyId/:contactId", async (req, res) => {
  try {
    const { companyId, contactId } = req.params;
    const database = await readDatabase();
    const company = database.find((c) => c.id === companyId);
    if (!company) return res.status(404).json({ error: "Company not found" });

    const contactIndex = company.contacts.findIndex((c) => c.id === contactId);
    if (contactIndex === -1)
      return res.status(404).json({ error: "Contact not found" });

    company.contacts.splice(contactIndex, 1);
    await writeDatabase(database);
    res.status(200).json({ message: "Contact deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = app;
