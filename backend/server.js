import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import mongoose from 'mongoose';
import createAuthRouter from './routes/auth.js';
import fs from 'fs';
import { verifyToken, requireDBA, requireAdmin } from './middleware/auth.js';
import { upload, parseNestedFields } from './middleware/upload.js';
import nodemailer from 'nodemailer';

dotenv.config();

const app = express();
app.use(cors());
// Explicitly enable CORS preflight for all routes
app.options('*', cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global error handler for JSON parsing errors
app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    console.error('JSON parsing error:', error.message);
    return res.status(400).json({ message: 'Invalid JSON format' });
  }
  next();
});

const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://gogtekulam:gogtekul@cluster0.t3c0jt6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const dbName = process.env.MONGODB_DB || 'test';
// Permanent collection for approved members (kept as 'members' per requirements)
const collectionName = 'members';
// Temporary collection for new registrations awaiting approval
// Default matches your DB: test.Heirarchy_form
const tempCollectionName = process.env.TEMP_COLLECTION_NAME || 'Heirarchy_form';
const newsCollectionName = 'news';
const eventsCollectionName = 'events';
const photosCollectionName = 'photos';
const sheetsCollectionName = 'members';

let client;
let db;

async function connectToMongo() {
  if (db) return db;
  client = new MongoClient(mongoUri);
  await client.connect();
  db = client.db(dbName);
  try {
    // Ensure unique index for dedupe on GogteKulamandalFamily
    await db.collection(collectionName).createIndex({ _sheetRowKey: 1 }, { unique: true, name: 'uniq_sheet_row_key' });
  } catch (e) {
    // ignore index errors if already exists
  }
  return db;
}

// Email helper
function createMailer() {
  const user = process.env.EMAIL_USER || process.env.GMAIL_USER || 'gogtekulam@gmail.com';
  const pass = process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    console.warn('Email credentials missing. Set EMAIL_USER and EMAIL_PASS (or GMAIL_USER and GMAIL_APP_PASSWORD).');
  }
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });
  return { transporter, from: process.env.EMAIL_FROM || user };
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$%*?';
  const len = 8 + Math.floor(Math.random() * 5); // 8–12
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// Utility: convert flat objects with dot-notation keys into nested objects
// Example: { 'personalDetails.firstName': 'Abhinav', 'parentsInformation.fatherFirstName': 'Umesh' }
// becomes { personalDetails: { firstName: 'Abhinav' }, parentsInformation: { fatherFirstName: 'Umesh' } }
function nestObject(flatObj) {
  if (!flatObj || typeof flatObj !== 'object') return flatObj;
  const nested = {};

  // First, copy non-dot keys shallowly (they may be objects already)
  Object.keys(flatObj).forEach((key) => {
    if (!key.includes('.')) {
      // If the value is an object, clone it to avoid mutation of original
      nested[key] = flatObj[key] && typeof flatObj[key] === 'object' && !Array.isArray(flatObj[key])
        ? { ...flatObj[key] }
        : flatObj[key];
    }
  });

  // Then process dotted keys and merge into nested structure
  Object.keys(flatObj).forEach((key) => {
    if (!key.includes('.')) return;
    const parts = key.split('.');
    let cursor = nested;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      if (isLast) {
        // Assign value, overwriting only if necessary
        cursor[part] = flatObj[key];
      } else {
        if (!cursor[part] || typeof cursor[part] !== 'object' || Array.isArray(cursor[part])) {
          cursor[part] = {};
        }
        cursor = cursor[part];
      }
    }
  });

  return nested;
}

// Initialize mongoose (used for the optional example route using Model.save())
try {
  mongoose.connect(mongoUri, { dbName, autoIndex: false });
  // Create a permissive schema so we can save arbitrary member shapes
  const memberSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
  // Use the same collectionName so saved docs are in the same place as inserts
  mongoose.models.Member || mongoose.model('Member', memberSchema, collectionName);
} catch (e) {
  console.warn('Mongoose init warning:', e && e.message ? e.message : e);
}





app.get('/api/family/members', async (req, res) => {
  try {
    const database = await connectToMongo();
    const collection = database.collection(collectionName);
    let query = {};
    
    // Handle level filtering for root members
    if (req.query.level) {
      const level = parseInt(req.query.level);
      query.level = level;
    }
    
    const members = await collection.find(query).toArray();
    console.log(`[family] db=${dbName} coll=${collectionName} query=${JSON.stringify(query)} count=${members.length}`);
    res.json({ members });
  } catch (err) {
    console.error('Error fetching members:', err);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Fetch members by multiple serial numbers (for children)
app.post('/api/family/members/by-sernos', async (req, res) => {
  try {
    const { serNos } = req.body;
    if (!Array.isArray(serNos) || serNos.length === 0) {
      return res.json({ members: [] });
    }

    const database = await connectToMongo();
    const collection = database.collection(collectionName);
    
    // Convert serNos to appropriate types (number or string)
    const normalizedSerNos = serNos.map(sn => {
      const num = Number(sn);
      return Number.isNaN(num) ? String(sn) : num;
    });
    
    const query = {
      $or: [
        { serNo: { $in: serNos } },
        { serNo: { $in: normalizedSerNos } }
      ]
    };
    
    const members = await collection.find(query).toArray();
    console.log(`[family] Fetched ${members.length} members by serNos:`, serNos);
    res.json({ members });
  } catch (err) {
    console.error('Error fetching members by serNos:', err);
    res.status(500).json({ error: 'Failed to fetch members by serial numbers' });
  }
});

// Fetch a single member by serial number (for spouse)
app.get('/api/family/members/by-serno/:serNo', async (req, res) => {
  try {
    const { serNo } = req.params;
    const database = await connectToMongo();
    const collection = database.collection(collectionName);
    
    // Try both number and string versions
    const num = Number(serNo);
    const searchValues = Number.isNaN(num) ? [String(serNo)] : [num, String(serNo)];
    
    const query = {
      serNo: { $in: searchValues }
    };
    
    const member = await collection.findOne(query);
    console.log(`[family] Fetched member by serNo ${serNo}:`, member ? 'found' : 'not found');
    res.json({ member });
  } catch (err) {
    console.error('Error fetching member by serNo:', err);
    res.status(500).json({ error: 'Failed to fetch member by serial number' });
  }
});

// New endpoint for visual family tree - returns all members
app.get('/api/family/members-new', async (req, res) => {
  try {
    const database = await connectToMongo();
    const collection = database.collection(collectionName);
    
    const members = await collection.find({}).toArray();
    console.log(`[family] Fetched all members for visual tree: ${members.length}`);
    res.json(members);
  } catch (err) {
    console.error('Error fetching all members:', err);
    res.status(500).json({ error: 'Failed to fetch all members' });
  }
});

// Search members for parent autocomplete (from approved 'members' collection)
app.get('/api/family/search', async (req, res) => {
  try {
    const { query, vansh } = req.query;

    const q = (query || '').toString().trim();
    if (!q) return res.status(200).json({ success: true, data: [] });
    if (!vansh) return res.status(200).json({ success: true, data: [] });

    const database = await connectToMongo();
    const collection = database.collection(collectionName); // 'members'

    const regex = new RegExp(q, 'i');
    const vanshNum = Number(vansh);
    const vanshOr = Number.isNaN(vanshNum)
      ? [ { vansh }, { 'personalDetails.vansh': vansh } ]
      : [ { vansh: vanshNum }, { vansh: vansh.toString() }, { 'personalDetails.vansh': vanshNum }, { 'personalDetails.vansh': vansh.toString() } ];

    // Search across nested and legacy name fields
    const nameOr = [
      { 'personalDetails.firstName': regex },
      { 'personalDetails.middleName': regex },
      { 'personalDetails.lastName': regex },
      { firstName: regex },
      { middleName: regex },
      { lastName: regex },
      { name: regex },
      { 'First Name': regex },
      { 'Middle Name': regex },
      { 'Last Name': regex },
    ];

    const members = await collection.find({ $and: [ { $or: nameOr }, { $or: vanshOr } ] })
      .limit(10)
      .toArray();

    const data = members.map((m) => {
      const personal = m.personalDetails || {};
      const first = personal.firstName || m.firstName || m['First Name'] || '';
      const middle = personal.middleName || m.middleName || m['Middle Name'] || '';
      const last = personal.lastName || m.lastName || m['Last Name'] || '';
      const name = (m.name || `${first} ${middle} ${last}`).replace(/\s+/g, ' ').trim();
      const email = personal.email || m.email || '';
      const mobile = personal.mobileNumber || personal.alternateMobileNumber || m.mobileNumber || m.phoneNumber || '';
      const profileImage = personal.profileImage || m.profileImage || null;
      const dob = personal.dateOfBirth || m.dateOfBirth || '';
      const serNo = m.serNo ?? personal.serNo ?? m.SerNo ?? null;
      return { serNo, firstName: first, middleName: middle, lastName: last, name, email, mobileNumber: mobile, dateOfBirth: dob, profileImage };
    });

    console.log(`[family] search q="${q}" vansh=${vansh} -> ${data.length}`);
    res.json({ success: true, data });
  } catch (err) {
    console.error('Error searching members:', err);
    res.status(500).json({ success: false, data: [], error: 'Failed to search members' });
  }
});

// Get all relationships (static relationships from database)
app.get('/api/family/all-relationships', async (req, res) => {
  try {
    const database = await connectToMongo();
    const collection = database.collection(collectionName);
    
    // Get all members and extract relationships
    const members = await collection.find({}).toArray();
    const relationships = [];
    
    members.forEach(member => {
      // Add spouse relationships
      if (member.spouseSerNo) {
        relationships.push({
          fromSerNo: member.serNo,
          toSerNo: member.spouseSerNo,
          relation: 'Spouse',
          relationMarathi: 'पती/पत्नी'
        });
      }
      
      // Add parent-child relationships
      if (member.sonDaughterSerNo && Array.isArray(member.sonDaughterSerNo)) {
        member.sonDaughterSerNo.forEach(childSerNo => {
          relationships.push({
            fromSerNo: member.serNo,
            toSerNo: childSerNo,
            relation: 'Child',
            relationMarathi: 'मुल/मुलगी'
          });
        });
      }
      
      // Add father relationship
      if (member.fatherSerNo) {
        relationships.push({
          fromSerNo: member.fatherSerNo,
          toSerNo: member.serNo,
          relation: 'Child',
          relationMarathi: 'मुल/मुलगी'
        });
      }
    });
    
    console.log(`[family] Generated ${relationships.length} static relationships`);
    res.json(relationships);
  } catch (err) {
    console.error('Error fetching relationships:', err);
    res.status(500).json({ error: 'Failed to fetch relationships' });
  }
});

// Dynamic relations endpoint - calculates relationships dynamically
app.get('/api/family/dynamic-relations/:serNo', async (req, res) => {
  try {
    const { serNo } = req.params;
    const database = await connectToMongo();
    const collection = database.collection(collectionName);
    
    // Convert serNo to number
    const memberSerNo = parseInt(serNo);
    
    // Get the target member
    const targetMember = await collection.findOne({
      $or: [{ serNo: memberSerNo }, { serNo: String(memberSerNo) }]
    });
    
    if (!targetMember) {
      return res.status(404).json({ error: 'Member not found' });
    }
    
    // Get all members for relationship calculation
    const allMembers = await collection.find({}).toArray();
    
    // Calculate dynamic relationships
    const dynamicRelations = [];
    
    allMembers.forEach(member => {
      if (member.serNo === targetMember.serNo) return; // Skip self
      
      const relation = calculateRelationship(targetMember, member, allMembers);
      if (relation) {
        dynamicRelations.push({
          related: member,
          relationEnglish: relation.english,
          relationMarathi: relation.marathi,
          relationshipPath: relation.path || []
        });
      }
    });
    
    console.log(`[family] Calculated ${dynamicRelations.length} dynamic relations for serNo ${serNo}`);
    res.json(dynamicRelations);
  } catch (err) {
    console.error('Error calculating dynamic relations:', err);
    res.status(500).json({ error: 'Failed to calculate dynamic relations' });
  }
});

// Helper function to calculate relationship between two members
function calculateRelationship(person1, person2, allMembers) {
  // Create a map for quick lookup
  const memberMap = new Map();
  allMembers.forEach(member => {
    memberMap.set(member.serNo, member);
  });
  
  // Direct relationships
  
  // Spouse
  if (person1.spouseSerNo === person2.serNo || person2.spouseSerNo === person1.serNo) {
    return { english: 'Spouse', marathi: 'पती/पत्नी' };
  }
  
  // Parent-Child
  if (person1.fatherSerNo === person2.serNo) {
    return { english: 'Father', marathi: 'वडील' };
  }
  if (person2.fatherSerNo === person1.serNo) {
    return { english: 'Son/Daughter', marathi: 'मुल/मुलगी' };
  }
  
  // Children
  if (person1.sonDaughterSerNo && person1.sonDaughterSerNo.includes(person2.serNo)) {
    return { english: 'Son/Daughter', marathi: 'मुल/मुलगी' };
  }
  if (person2.sonDaughterSerNo && person2.sonDaughterSerNo.includes(person1.serNo)) {
    return { english: 'Father/Mother', marathi: 'वडील/आई' };
  }
  
  // Siblings (same father)
  if (person1.fatherSerNo && person2.fatherSerNo && person1.fatherSerNo === person2.fatherSerNo) {
    return { english: 'Sibling', marathi: 'भाऊ/बहीण' };
  }
  
  // Grandparent-Grandchild
  const person1Father = memberMap.get(person1.fatherSerNo);
  const person2Father = memberMap.get(person2.fatherSerNo);
  
  if (person1Father && person1Father.fatherSerNo === person2.serNo) {
    return { english: 'Grandfather', marathi: 'आजोबा' };
  }
  if (person2Father && person2Father.fatherSerNo === person1.serNo) {
    return { english: 'Grandson/Granddaughter', marathi: 'नातू/नात' };
  }
  
  // Uncle-Nephew/Niece
  if (person1Father && person2.fatherSerNo === person1Father.serNo) {
    return { english: 'Uncle/Aunt', marathi: 'काका/मावशी' };
  }
  if (person2Father && person1.fatherSerNo === person2Father.serNo) {
    return { english: 'Nephew/Niece', marathi: 'पुतणा/पुतणी' };
  }
  
  // Cousins (same grandfather)
  if (person1Father && person2Father && 
      person1Father.fatherSerNo && person2Father.fatherSerNo &&
      person1Father.fatherSerNo === person2Father.fatherSerNo) {
    return { english: 'Cousin', marathi: 'चुलत भाऊ/बहीण' };
  }
  
  // If no direct relationship found, return null
  return null;
}

// DBA CRUD Operations for Family Members
// Get all family members (DBA only)
app.get('/api/dba/family-members', verifyToken, requireDBA, async (req, res) => {
  try {
    const database = await connectToMongo();
    const collection = database.collection(collectionName);
    const members = await collection.find({}).toArray();
    res.json({ members });
  } catch (err) {
    console.error('Error fetching family members:', err);
    res.status(500).json({ error: 'Failed to fetch family members' });
  }
});

// Create new family member (DBA only)
app.post('/api/dba/family-members', verifyToken, requireDBA, async (req, res) => {
  try {
    // Accept flat dot-notated keys from the frontend and nest them
    const memberData = nestObject(req.body);
    const database = await connectToMongo();
    const collection = database.collection(collectionName);
    
    // Add timestamps
    memberData.createdAt = new Date();
    memberData.updatedAt = new Date();
    
    const result = await collection.insertOne(memberData);
    res.status(201).json({ 
      message: 'Family member created successfully',
      member: { ...memberData, _id: result.insertedId }
    });
  } catch (err) {
    console.error('Error creating family member:', err);
    res.status(500).json({ error: 'Failed to create family member' });
  }
});

// Update family member (DBA only)
app.put('/api/dba/family-members/:id', verifyToken, requireDBA, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const database = await connectToMongo();
    const collection = database.collection(collectionName);
    
    // Add update timestamp
    updateData.updatedAt = new Date();
    
    const result = await collection.updateOne(
      { _id: new (await import('mongodb')).ObjectId(id) },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Family member not found' });
    }
    
    res.json({ message: 'Family member updated successfully' });
  } catch (err) {
    console.error('Error updating family member:', err);
    res.status(500).json({ error: 'Failed to update family member' });
  }
});

// Delete family member (DBA only)
app.delete('/api/dba/family-members/:id', verifyToken, requireDBA, async (req, res) => {
  try {
    const { id } = req.params;
    const database = await connectToMongo();
    const collection = database.collection(collectionName);
    
    const result = await collection.deleteOne({ _id: new (await import('mongodb')).ObjectId(id) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Family member not found' });
    }
    
    res.json({ message: 'Family member deleted successfully' });
  } catch (err) {
    console.error('Error deleting family member:', err);
    res.status(500).json({ error: 'Failed to delete family member' });
  }
});

// Get family member by ID (DBA only)
app.get('/api/dba/family-members/:id', verifyToken, requireDBA, async (req, res) => {
  try {
    const { id } = req.params;
    const database = await connectToMongo();
    const collection = database.collection(collectionName);
    
    const member = await collection.findOne({ _id: new (await import('mongodb')).ObjectId(id) });
    
    if (!member) {
      return res.status(404).json({ error: 'Family member not found' });
    }
    
    res.json({ member });
  } catch (err) {
    console.error('Error fetching family member:', err);
    res.status(500).json({ error: 'Failed to fetch family member' });
  }
});

// Test endpoint to check if API is working
app.get('/api/dba/test', verifyToken, requireDBA, async (req, res) => {
  res.json({ message: 'DBA API is working', timestamp: new Date().toISOString() });
});

// Get member relationships (DBA only)
app.get('/api/dba/member-relationships/:id', verifyToken, requireDBA, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Fetching relationships for member ID:', id);
    
    const database = await connectToMongo();
    const collection = database.collection(collectionName);
    
    // Try to find member by ObjectId first, then by string ID
    let member;
    try {
      member = await collection.findOne({ _id: new (await import('mongodb')).ObjectId(id) });
    } catch (objectIdError) {
      console.log('ObjectId conversion failed, trying string match:', objectIdError.message);
      member = await collection.findOne({ _id: id });
    }
    
    if (!member) {
      console.log('Member not found with ID:', id);
      return res.status(404).json({ error: 'Member not found' });
    }
    
    console.log('Found member:', member.name || member.firstName || 'Unknown');
    
    // Get all members for relationship calculation
    const allMembers = await collection.find({}).toArray();
    console.log('Total members in database:', allMembers.length);
    
    // Calculate relationships
    const relationships = [];
    
    allMembers.forEach(otherMember => {
      if (otherMember._id.toString() === member._id.toString()) return; // Skip self
      
      const relation = calculateRelationship(member, otherMember, allMembers);
      if (relation) {
        relationships.push({
          member: {
            id: otherMember._id,
            name: otherMember.name || (otherMember.firstName && otherMember.lastName ? `${otherMember.firstName} ${otherMember.lastName}` : otherMember.firstName || otherMember.lastName || 'Unknown'),
            status: otherMember.status || 'Unknown'
          },
          relationEnglish: relation.english,
          relationMarathi: relation.marathi
        });
      }
    });
    
    console.log('Found relationships:', relationships.length);
    
    res.json({
      member: {
        id: member._id,
        name: member.name || (member.firstName && member.lastName ? `${member.firstName} ${member.lastName}` : member.firstName || member.lastName || 'Unknown'),
        status: member.status || 'Unknown'
      },
      relationships
    });
  } catch (err) {
    console.error('Error fetching member relationships:', err);
    res.status(500).json({ error: 'Failed to fetch member relationships', details: err.message });
  }
});

// Get database statistics (DBA only)
app.get('/api/dba/stats', verifyToken, requireDBA, async (req, res) => {
  try {
    const database = await connectToMongo();
    const collection = database.collection(collectionName);
    
    const totalMembers = await collection.countDocuments();
    const livingMembers = await collection.countDocuments({ status: 'living' });
    const deceasedMembers = await collection.countDocuments({ status: 'deceased' });
    
    // Get recent additions (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentAdditions = await collection.countDocuments({ 
      createdAt: { $gte: thirtyDaysAgo } 
    });
    
    res.json({
      totalMembers,
      livingMembers,
      deceasedMembers,
      recentAdditions
    });
  } catch (err) {
    console.error('Error fetching database stats:', err);
    res.status(500).json({ error: 'Failed to fetch database statistics' });
  }
});

// Simple test endpoint (no auth required)
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is running', timestamp: new Date().toISOString() });
});

app.use('/api/auth', createAuthRouter(connectToMongo));

// Admin routes
app.get('/api/admin/stats', verifyToken, requireAdmin, async (req, res) => {
  try {
    const database = await connectToMongo();
    const approvedColl = database.collection(collectionName);
    const pendingColl = database.collection(tempCollectionName);

    const [totalMembers, pendingApprovals] = await Promise.all([
      approvedColl.countDocuments({}),
      pendingColl.countDocuments({})
    ]);

    res.json({
      totalMembers,
      pendingApprovals,
      approvedMembers: totalMembers,
      rejectedRequests: 0
    });
  } catch (err) {
    console.error('Error fetching admin stats:', err);
    res.status(500).json({ error: 'Failed to fetch admin statistics' });
  }
});

// Admin family management routes
app.get('/api/admin/family-members', verifyToken, requireAdmin, async (req, res) => {
  try {
    const db = await connectToMongo();
    const familyCollection = db.collection(collectionName);
    
    const members = await familyCollection.find({}).toArray();
    res.json(members);
  } catch (err) {
    console.error('Error fetching family members:', err);
    res.status(500).json({ error: 'Failed to fetch family members' });
  }
});

// Admin news management routes
app.get('/api/admin/news', verifyToken, requireAdmin, async (req, res) => {
  try {
    res.json([]);
  } catch (err) {
    console.error('Error fetching news:', err);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

// Admin registrations: list pending from temporary collection
app.get('/api/admin/registrations', verifyToken, requireAdmin, async (req, res) => {
  try {
    const database = await connectToMongo();
    const tempColl = database.collection(tempCollectionName);
    const docs = await tempColl.find({}).sort({ createdAt: -1 }).toArray();
    res.json({ registrations: docs });
  } catch (err) {
    console.error('Error fetching pending registrations:', err);
    res.status(500).json({ error: 'Failed to fetch pending registrations' });
  }
});

// Admin approve a registration: move doc from temp -> members
app.post('/api/admin/registrations/:id/approve', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const database = await connectToMongo();
    const tempColl = database.collection(tempCollectionName);
    const approvedColl = database.collection(collectionName);

    const { ObjectId } = await import('mongodb');
    let _id;
    try {
      const raw = id && typeof id === 'string' ? id : String(id || '').trim();
      const fromJson = (() => { try { const obj = JSON.parse(raw); return obj && obj.$oid; } catch { return null; } })();
      _id = new ObjectId(fromJson || raw);
    } catch {
      return res.status(400).json({ error: 'Invalid registration id' });
    }

    const doc = await tempColl.findOne({ _id });
    if (!doc) return res.status(404).json({ error: 'Registration not found' });

    const approvedDoc = { ...doc, isapproved: true, approvedAt: new Date() };
    delete approvedDoc._id;

    try {
      const insertResult = await approvedColl.insertOne(approvedDoc);

      // Create credentials and email
      const personal = approvedDoc.personalDetails || {};
      const first = (personal.firstName || approvedDoc.firstName || 'member').toString().trim().replace(/\s+/g, ' ');
      const serNo = approvedDoc.serNo ?? personal.serNo ?? '000';
      const username = `${first}_${serNo}`.replace(/\s+/g, '_');
      const password = generatePassword();
      const email = (personal.email || approvedDoc.email || approvedDoc.gmail || '').toString().trim();

      // Upsert into login collection (by email and/or username)
      {
        const loginCollName = process.env.MONGODB_LOGIN_COLLECTION || 'login';
        const loginColl = database.collection(loginCollName);
        const { default: bcrypt } = await import('bcryptjs');
        const hash = await bcrypt.hash(password, 10);
        const filter = { $or: [] };
        if (email) filter.$or.push({ email }, { gmail: email }, { Email: email }, { userEmail: email });
        if (username) filter.$or.push({ username }, { Username: username }, { login: username }, { Login: username });
        if (filter.$or.length > 0) {
          const setDoc = { username, password: hash, updatedAt: new Date() };
          if (email) setDoc.email = email;
          const upRes = await loginColl.updateOne(filter, { $set: setDoc, $setOnInsert: { createdAt: new Date(), role: 'member' } }, { upsert: true });
          console.log('[approve] login upsert', { collection: loginCollName, matched: upRes.matchedCount, modified: upRes.modifiedCount, upsertedId: upRes.upsertedId || null, username, email });
        } else {
          console.warn('[approve] Skipping login upsert: no email/username available');
        }
      }

      // Send email (non-blocking but awaited; failures don't break approval)
      if (email) {
        try {
          const { transporter, from } = createMailer();
          await transporter.sendMail({
            from,
            to: email,
            subject: 'Account Approval and Login Credentials — Gogte Kulamandal',
            text: `Dear ${first},\n\nWe are pleased to inform you that your account on the Gogte Kulamandal Portal has been successfully approved. You may now log in using the credentials provided below:\n\nUsername: ${username}\nTemporary Password: ${password}\n\nFor security reasons, please ensure that you change your password immediately after your first login.\n\nYou can access your account by visiting the Gogte Kulamandal member login page.\n\nIf you encounter any issues, please contact our Support Team at gogtekulam@gmail.com or reply to this email.\n\nWarm regards,\nGogte Kulamandal Admin Team\nGogte Family Heritage Portal`,
            html: `
              <p>Dear ${first},</p>
              <p>We are pleased to inform you that your account on the <strong>Gogte Kulamandal Portal</strong> has been successfully approved. You may now log in using the credentials provided below:</p>
              <p><strong>Username:</strong> ${username}<br/>
              <strong>Temporary Password:</strong> ${password}</p>
              <p>For security reasons, please ensure that you change your password immediately after your first login. This helps protect your account and personal information.</p>
              <p>You can access your account by visiting the Gogte Kulamandal member login page.</p>
              <p>If you encounter any issues while logging in or updating your password, please contact the Gogte Kulamandal Support Team at <a href="mailto:gogtekulam@gmail.com">gogtekulam@gmail.com</a> or reply to this email for assistance.</p>
              <p>Warm regards,<br/>
              <strong>Gogte Kulamandal Admin Team</strong><br/>
              Gogte Family Heritage Portal</p>
            `
          });
        } catch (mailErr) {
          console.warn('Email sending failed for approval:', mailErr && mailErr.message ? mailErr.message : mailErr);
        }
      }

      await tempColl.deleteOne({ _id });
      return res.json({ success: true, memberId: insertResult.insertedId });
    } catch (e) {
      // Handle duplicate key by updating existing member using best-guess natural keys
      if (e && e.code === 11000) {
        const personal = approvedDoc.personalDetails || {};
        const email = personal.email || approvedDoc.email || approvedDoc.gmail || null;
        const serNo = approvedDoc.serNo ?? personal.serNo ?? null;
        const sheetKey = approvedDoc._sheetRowKey || null;
        const filters = [];
        if (sheetKey) filters.push({ _sheetRowKey: sheetKey });
        if (serNo !== null && serNo !== undefined) filters.push({ serNo: serNo }, { 'personalDetails.serNo': serNo });
        if (email) filters.push({ email }, { gmail: email }, { 'personalDetails.email': email });

        const filter = filters.length ? { $or: filters } : {};
        const result = await approvedColl.updateOne(filter, { $set: approvedDoc }, { upsert: Object.keys(filter).length === 0 });

        // Create credentials and email as in insert path
        {
          const first = (personal.firstName || approvedDoc.firstName || 'member').toString().trim().replace(/\s+/g, ' ');
          const finalSer = approvedDoc.serNo ?? personal.serNo ?? '000';
          const username = `${first}_${finalSer}`.replace(/\s+/g, '_');
          const password = generatePassword();
          const loginCollName = process.env.MONGODB_LOGIN_COLLECTION || 'login';
          const loginColl = database.collection(loginCollName);
          const { default: bcrypt } = await import('bcryptjs');
          const hash = await bcrypt.hash(password, 10);

          const filter = { $or: [] };
          if (email) filter.$or.push({ email }, { gmail: email }, { Email: email }, { userEmail: email });
          filter.$or.push({ username }, { Username: username }, { login: username }, { Login: username });

          const setDoc = { username, password: hash, updatedAt: new Date() };
          if (email) setDoc.email = email;
          const upRes2 = await loginColl.updateOne(filter, { $set: setDoc, $setOnInsert: { createdAt: new Date(), role: 'member' } }, { upsert: true });
          console.log('[approve/dup] login upsert', { collection: loginCollName, matched: upRes2.matchedCount, modified: upRes2.modifiedCount, upsertedId: upRes2.upsertedId || null, username, email });

          if (email) {
            try {
              const { transporter, from } = createMailer();
              await transporter.sendMail({
                from,
                to: email,
                subject: 'Account Approval and Login Credentials — Gogte Kulamandal',
                text: `Dear ${first},\n\nWe are pleased to inform you that your account on the Gogte Kulamandal Portal has been successfully approved. You may now log in using the credentials provided below:\n\nUsername: ${username}\nTemporary Password: ${password}\n\nFor security reasons, please ensure that you change your password immediately after your first login.\n\nYou can access your account by visiting the Gogte Kulamandal member login page.\n\nIf you encounter any issues, please contact our Support Team at gogtekulam@gmail.com or reply to this email.\n\nWarm regards,\nGogte Kulamandal Admin Team\nGogte Family Heritage Portal`
              });
            } catch (mailErr) {
              console.warn('Email sending failed for approval (dup path):', mailErr && mailErr.message ? mailErr.message : mailErr);
            }
          }
        }

        await tempColl.deleteOne({ _id });
        return res.json({ success: true, upserted: result.upsertedId || null, matchedCount: result.matchedCount });
      }
      console.error('Error approving registration (insert/update):', e);
      return res.status(500).json({ error: 'Failed to approve registration' });
    }
  } catch (err) {
    console.error('Error approving registration:', err);
    res.status(500).json({ error: 'Failed to approve registration' });
  }
});

// Hierarchical Family Tree Endpoint - Single Root Node (Fixed for nested schema)
app.get('/api/family/hierarchical-tree', async (req, res) => {
  try {
    const database = await connectToMongo();
    const collection = database.collection(collectionName);
    const allMembers = await collection.find({}).toArray();
    
    console.log(`[HIERARCHICAL] Building single-root tree from ${allMembers.length} members`);
    
    // Helper function to get full name from nested structure
    function getFullName(member) {
      // Try nested schema first (newer format)
      if (member.personalDetails) {
        const first = member.personalDetails.firstName || '';
        const middle = member.personalDetails.middleName || '';
        const last = member.personalDetails.lastName || '';
        return `${first} ${middle} ${last}`.trim().replace(/\s+/g, ' ');
      }
      // Fallback to flat structure (older format)
      const first = member["First Name"] || member.firstName || '';
      const middle = member["Middle Name"] || member.middleName || '';
      const last = member["Last Name"] || member.lastName || '';
      return `${first} ${middle} ${last}`.trim().replace(/\s+/g, ' ');
    }

    // Helper function to get father's name from nested structure
    function getFatherName(member) {
      // Try nested schema first
      if (member.parentsInformation) {
        const first = member.parentsInformation.fatherFirstName || '';
        const middle = member.parentsInformation.fatherMiddleName || '';
        const last = member.parentsInformation.fatherLastName || '';
        return `${first} ${middle} ${last}`.trim().replace(/\s+/g, ' ');
      }
      // Fallback to flat structure
      const first = member["Father 's First Name "] || member["Father's First Name"] || '';
      const last = member["Father 's Last Name "] || member["Father's Last Name"] || '';
      return `${first} ${last}`.trim().replace(/\s+/g, ' ');
    }

    // Helper to get spouse name
    function getSpouseName(member) {
      if (member.marriedDetails) {
        const first = member.marriedDetails.spouseFirstName || '';
        const last = member.marriedDetails.spouseLastName || '';
        return `${first} ${last}`.trim().replace(/\s+/g, ' ');
      }
      return '';
    }

    // Helper to get gender
    function getGender(member) {
      if (member.personalDetails) return member.personalDetails.gender || 'Unknown';
      return member.Gender || 'Unknown';
    }

    // Create a map of all people by serNo (primary key)
    const memberMap = new Map();
    const childrenMap = new Map(); // Map of fatherSerNo to array of children
    
    allMembers.forEach(member => {
      if (member.serNo !== undefined && member.serNo !== null) {
        memberMap.set(member.serNo, member);
        
        // Build children map for faster lookups
        const fatherSerNo = member.fatherSerNo;
        if (fatherSerNo !== undefined && fatherSerNo !== null && fatherSerNo !== '') {
          if (!childrenMap.has(fatherSerNo)) {
            childrenMap.set(fatherSerNo, []);
          }
          childrenMap.get(fatherSerNo).push(member);
        }
      }
    });

    // Helper function to build tree node in CardFamilyTree format
    function buildTreeNode(member, processed = new Set()) {
      if (!member || processed.has(member.serNo)) {
        return null;
      }
      processed.add(member.serNo);

      const fullName = getFullName(member);
      const fatherSerNo = member.fatherSerNo;
      const spouseName = getSpouseName(member);

      // Get children - use pre-built map for O(1) lookup instead of O(n)
      const children = [];
      const memberChildren = childrenMap.get(member.serNo) || [];
      memberChildren.forEach(childMember => {
        if (!processed.has(childMember.serNo)) {
          const childNode = buildTreeNode(childMember, processed);
          if (childNode) children.push(childNode);
        }
      });

      return {
        name: fullName || `Member #${member.serNo}`,
        attributes: {
          serNo: member.serNo,
          gender: getGender(member),
          spouse: spouseName,
          vansh: member.vansh || '',
          dob: member.personalDetails?.dateOfBirth || member['Date of Birth'] || '',
          email: member.personalDetails?.email || member.Email || ''
        },
        children: children
      };
    }

    // Find root member (someone with no father or serNo 1)
    let rootMember = null;
    
    // First, try to find serNo 1 as root
    for (const member of allMembers) {
      if (member.serNo === 1 || member.serNo === '1') {
        rootMember = member;
        console.log(`[HIERARCHICAL] Using serNo 1 as root: ${getFullName(member)}`);
        break;
      }
    }

    // If no serNo 1, find someone with no father
    if (!rootMember) {
      for (const member of allMembers) {
        if (!member.fatherSerNo || member.fatherSerNo === null || member.fatherSerNo === '') {
          rootMember = member;
          console.log(`[HIERARCHICAL] Using natural root (no father): ${getFullName(member)}`);
          break;
        }
      }
    }

    // Build the tree
    let treeRoot = null;
    if (rootMember) {
      treeRoot = buildTreeNode(rootMember);
    }

    console.log(`[HIERARCHICAL] Tree built successfully. Root: ${rootMember ? getFullName(rootMember) : 'None'}`);

    res.json(treeRoot || {
      name: 'No Family Data',
      attributes: { serNo: 0, gender: 'Unknown', spouse: '', vansh: '' },
      children: []
    });
    
  } catch (err) {
    console.error('Error building single-root hierarchical tree:', err);
    res.status(500).json({ error: 'Failed to build hierarchical family tree' });
  }
});

// Family member registration endpoint - handles comprehensive family form
const uploadFields = upload.fields([
  { name: "personalDetails.profileImage", maxCount: 1 },
  { name: "divorcedDetails.spouseProfileImage", maxCount: 1 },
  { name: "marriedDetails.spouseProfileImage", maxCount: 1 },
  { name: "remarriedDetails.spouseProfileImage", maxCount: 1 },
  { name: "widowedDetails.spouseProfileImage", maxCount: 1 },
  { name: "parentsInformation.fatherProfileImage", maxCount: 1 },
  { name: "parentsInformation.motherProfileImage", maxCount: 1 },
]);

app.post('/api/family/register', uploadFields, parseNestedFields, async (req, res) => {
  try {
    console.log('📥 POST /api/family/register - Family member registration received');
    
    const database = await connectToMongo();
    const collection = database.collection(tempCollectionName);

    // Convert uploaded files to base64
    const filesData = {};
    if (req.files) {
      Object.entries(req.files).forEach(([fieldPath, files]) => {
        const parsed = fieldPath.split('.');
        const property = parsed.pop();
        const parentPath = parsed.join('.');

        filesData[parentPath] = filesData[parentPath] || {};
        if (files && files.length > 0) {
          const file = files[0];
          filesData[parentPath][property] = {
            data: file.buffer.toString('base64'),
            mimeType: file.mimetype,
            originalName: file.originalname,
          };
        }
      });
    }

    // Merge file data into body
    const mergeData = (base, updates) => {
      const result = Array.isArray(base) ? [...base] : { ...base };
      Object.keys(updates).forEach((key) => {
        if (updates[key] && typeof updates[key] === 'object' && !Array.isArray(updates[key])) {
          const existingValue = base?.[key] && typeof base[key] === 'object' ? base[key] : {};
          result[key] = mergeData(existingValue, updates[key]);
        } else {
          result[key] = updates[key];
        }
      });
      return result;
    };

    let payload = req.body;
    if (Object.keys(filesData).length > 0) {
      Object.keys(filesData).forEach((key) => {
        const keys = key.split('.');
        let pointer = payload;
        keys.forEach((k, index) => {
          if (index === keys.length - 1) {
            pointer[k] = mergeData(pointer[k] || {}, filesData[key]);
          } else {
            if (!pointer[k]) pointer[k] = {};
            pointer = pointer[k];
          }
        });
      });
    }

  // Ensure dotted keys are nested correctly
  payload = nestObject(payload);

  // Add timestamp
  payload.createdAt = new Date();
  payload.updatedAt = new Date();

    // Insert the family member
    const result = await collection.insertOne(payload);
    
    console.log(`✅ Family member registered successfully with ID: ${result.insertedId}`);
    res.status(201).json({
      message: 'Family member registered successfully',
      memberId: result.insertedId,
    });
  } catch (err) {
    console.error('❌ Error registering family member:', err);
    res.status(500).json({ error: 'Failed to register family member', details: err.message });
  }
});

// (removed duplicate /api/family/search handler; single authoritative handler defined earlier)

// Family member registration endpoint - accepts multipart form data with images
app.post('/api/family/add', upload.any(), parseNestedFields, async (req, res) => {
  try {
    const parsedData = req.parsedFields || req.body;
    
    const database = await connectToMongo();
    const collection = database.collection(tempCollectionName);
    
    // Process images - convert to base64 with MIME type
    const processedData = { ...parsedData };
    
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        const fieldName = file.fieldname;
        const base64Data = file.buffer.toString('base64');
        const mimeType = file.mimetype;
        
        // Store as object with data and mimeType for proper reconstruction
        processedData[fieldName] = {
          data: base64Data,
          mimeType: mimeType,
          filename: file.originalname
        };
      });
    }
    
  // Ensure dotted keys are nested correctly
  const processedNested = nestObject(processedData);

  // Add timestamps
  processedNested.createdAt = new Date();
  processedNested.updatedAt = new Date();
    
    const result = await collection.insertOne(processedNested);
    
    res.json({
      success: true,
      message: 'Family member registered successfully!',
      id: result.insertedId,
      data: processedNested
    });
  } catch (err) {
    console.error('Error registering family member:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to register family member: ' + err.message
    });
  }
});

// Example Mongoose-backed create route that demonstrates using await new Model(formattedData).save()
app.post('/api/dba/family-members-mongoose', verifyToken, requireDBA, async (req, res) => {
  try {
    // Convert flat dotted keys into nested objects
    const formatted = nestObject(req.body || {});

    // Use the permissive Member model we initialized above
    const Member = mongoose.models.Member;
    if (!Member) {
      return res.status(500).json({ error: 'Mongoose Member model not initialized' });
    }

    const member = new Member(formatted);
    const saved = await member.save();

    res.status(201).json({ message: 'Member saved via Mongoose', member: saved });
  } catch (err) {
    console.error('Error saving member via Mongoose:', err);
    res.status(500).json({ error: 'Failed to save member via Mongoose', details: err.message });
  }
});

// ===================== Events APIs =====================
// Create event (authenticated). Accepts multipart images and dotted keys
app.post('/api/events', verifyToken, upload.any(), async (req, res) => {
  try {
    const database = await connectToMongo();
    const events = database.collection(eventsCollectionName);

    const raw = req.body || {};
    const processed = { ...raw };

    // Images -> array of { data, mimeType, filename }
    const images = [];
    const filesArr = Array.isArray(req.files)
      ? req.files
      : (req.files ? Object.values(req.files).flat() : []);
    for (const f of filesArr) {
      if (!f) continue;
      images.push({ data: f.buffer.toString('base64'), mimeType: f.mimetype, filename: f.originalname });
    }
    // If client sends single eventImage via form field, keep it
    if (processed.eventImage && typeof processed.eventImage === 'object' && processed.eventImage.data) {
      images.unshift(processed.eventImage);
      delete processed.eventImage;
    }

    // Ensure dotted keys are nested and timestamps added
    const nested = nestObject(processed);
    nested.eventImages = images;
    nested.createdAt = new Date();
    nested.updatedAt = new Date();
    nested.createdBy = req.user?.sub || null;

    // Try to store creator name and serNo for better display
    try {
      const members = database.collection(process.env.MONGODB_COLLECTION || 'members');
      const emailToken = (req.user?.email || '').toString().trim().toLowerCase();
      const serNoToken = req.user?.serNo ?? null;
      let memberDoc = null;
      if (serNoToken !== null && serNoToken !== undefined) {
        const sNum = Number(serNoToken);
        memberDoc = await members.findOne({ $or: [
          { serNo: sNum }, { serNo: String(serNoToken) },
          { 'personalDetails.serNo': sNum }, { 'personalDetails.serNo': String(serNoToken) }
        ]});
      }
      if (!memberDoc && emailToken) {
        const rx = new RegExp(`^${escapeRegex(emailToken)}$`, 'i');
        memberDoc = await members.findOne({ $or: [
          { 'personalDetails.email': rx }, { email: rx }, { gmail: rx }
        ]});
      }
      if (memberDoc) {
        const p = memberDoc.personalDetails || {};
        const first = p.firstName || memberDoc.firstName || memberDoc.FirstName || '';
        const middle = p.middleName || memberDoc.middleName || memberDoc.MiddleName || '';
        const last = p.lastName || memberDoc.lastName || memberDoc.LastName || '';
        nested.createdByName = [first, middle, last].filter(Boolean).join(' ').trim() || (memberDoc.name && String(memberDoc.name).trim()) || 'Member';
        nested.createdBySerNo = memberDoc.serNo ?? p.serNo ?? null;
      }
    } catch (_) {}

    // Normalize boolean + arrays
    if (nested.visibleToAllVansh !== undefined) {
      nested.visibleToAllVansh = String(nested.visibleToAllVansh).toLowerCase() === 'true' || nested.visibleToAllVansh === true;
    }
    if (nested.visibleVanshNumbers && !Array.isArray(nested.visibleVanshNumbers)) {
      const str = String(nested.visibleVanshNumbers || '').trim();
      nested.visibleVanshNumbers = str ? str.split(',').map(s => s.trim()).filter(Boolean) : [];
    }

    const result = await events.insertOne(nested);
    console.log('[events] created', { id: result.insertedId?.toString?.(), title: nested.title, createdBy: nested.createdBy });
    return res.status(201).json({ success: true, id: result.insertedId, event: nested });
  } catch (err) {
    console.error('Error creating event:', err && err.message ? err.message : err);
    return res.status(500).json({ success: false, error: 'Failed to create event', details: err?.message || null });
  }
});

// List events (public)
app.get('/api/events', async (req, res) => {
  try {
    const database = await connectToMongo();
    const events = database.collection(eventsCollectionName);
    const docs = await events.find({}).sort({ fromDate: 1, createdAt: -1 }).limit(200).toArray();

    // Enrich with createdByName
    const byIds = Array.from(new Set(docs.map(d => d.createdBy).filter(Boolean)));
    const names = new Map();
    try {
      const usersColl = await (async () => {
        try { return (await getUsersCollection(database)); } catch { return null; }
      })();
      const loginCollName = process.env.MONGODB_LOGIN_COLLECTION || 'login';
      const loginColl = database.collection(loginCollName);
      const membersColl = database.collection(process.env.MONGODB_COLLECTION || 'members');
      const { ObjectId } = await import('mongodb');
      for (const id of byIds) {
        let name = '';
        try {
          const objId = new ObjectId(String(id));
          const userDoc = usersColl ? await usersColl.findOne({ _id: objId }) : null;
          if (userDoc) {
            const p = userDoc.personalDetails || {};
            const first = p.firstName || userDoc.firstName || userDoc.FirstName || '';
            const middle = p.middleName || userDoc.middleName || userDoc.MiddleName || '';
            const last = p.lastName || userDoc.lastName || userDoc.LastName || '';
            name = [first, middle, last].filter(Boolean).join(' ').trim();
          }
          if (!name) {
            const loginDoc = await loginColl.findOne({ _id: objId });
            if (loginDoc) {
              // Try to resolve via members by email from login doc
              const email = (loginDoc.email || loginDoc.gmail || loginDoc.Email || loginDoc.userEmail || '').toString().trim();
              if (email) {
                const rx = new RegExp(`^${escapeRegex(email)}$`, 'i');
                const mem = await membersColl.findOne({ $or: [
                  { 'personalDetails.email': rx }, { email: rx }, { gmail: rx }
                ]});
                if (mem) {
                  const p2 = mem.personalDetails || {};
                  const f2 = p2.firstName || mem.firstName || mem.FirstName || '';
                  const m2 = p2.middleName || mem.middleName || mem.MiddleName || '';
                  const l2 = p2.lastName || mem.lastName || mem.LastName || '';
                  name = [f2, m2, l2].filter(Boolean).join(' ').trim();
                }
              }
              if (!name) {
                const uname = loginDoc.username || loginDoc.login || loginDoc.Username || loginDoc.Login || '';
                name = uname ? String(uname).split('_')[0] : '';
              }
            }
          }
        } catch (_) {}
        if (!name) name = 'Member';
        names.set(id, name);
      }
    } catch (_) {}

    // Try resolving by createdBySerNo if still missing
    const members = database.collection(process.env.MONGODB_COLLECTION || 'members');
    const out = await Promise.all(docs.map(async d => {
      if (d.createdByName && String(d.createdByName).trim()) return d;
      let name = names.get(d.createdBy) || '';
      if (!name && (d.createdBySerNo !== undefined && d.createdBySerNo !== null)) {
        const sNum = Number(d.createdBySerNo);
        const mem = await members.findOne({ $or: [
          { serNo: sNum }, { serNo: String(d.createdBySerNo) },
          { 'personalDetails.serNo': sNum }, { 'personalDetails.serNo': String(d.createdBySerNo) }
        ]});
        if (mem) {
          const p = mem.personalDetails || {};
          const f = p.firstName || mem.firstName || mem.FirstName || '';
          const m = p.middleName || mem.middleName || mem.MiddleName || '';
          const l = p.lastName || mem.lastName || mem.LastName || '';
          name = [f,m,l].filter(Boolean).join(' ').trim();
        }
      }
      return { ...d, createdByName: name || 'Member' };
    }));
    
    // out is array of docs
    return res.json({ events: out });
  } catch (err) {
    console.error('Error listing events:', err);
    return res.status(500).json({ error: 'Failed to list events' });
  }
});

// ===================== News APIs =====================
// Create news (authenticated)
app.post('/api/news', verifyToken, upload.any(), async (req, res) => {
  try {
    const database = await connectToMongo();
    const news = database.collection(newsCollectionName);

    const raw = req.body || {};
    const processed = { ...raw };
    const filesArr = Array.isArray(req.files)
      ? req.files
      : (req.files ? Object.values(req.files).flat() : []);
    const images = [];
    for (const f of filesArr) {
      if (!f) continue;
      images.push({ data: f.buffer.toString('base64'), mimeType: f.mimetype, filename: f.originalname });
    }
    const nested = nestObject(processed);
    nested.newsImages = images;
    nested.createdAt = new Date();
    nested.updatedAt = new Date();
    nested.createdBy = req.user?.sub || null;

    // Resolve author (reuse members logic)
    try {
      const members = database.collection(process.env.MONGODB_COLLECTION || 'members');
      const emailToken = (req.user?.email || '').toString().trim().toLowerCase();
      const serNoToken = req.user?.serNo ?? null;
      let memberDoc = null;
      if (serNoToken !== null && serNoToken !== undefined) {
        const sNum = Number(serNoToken);
        memberDoc = await members.findOne({ $or: [
          { serNo: sNum }, { serNo: String(serNoToken) },
          { 'personalDetails.serNo': sNum }, { 'personalDetails.serNo': String(serNoToken) }
        ]});
      }
      if (!memberDoc && emailToken) {
        const rx = new RegExp(`^${escapeRegex(emailToken)}$`, 'i');
        memberDoc = await members.findOne({ $or: [
          { 'personalDetails.email': rx }, { email: rx }, { gmail: rx }
        ]});
      }
      if (memberDoc) {
        const p = memberDoc.personalDetails || {};
        const f = p.firstName || memberDoc.firstName || memberDoc.FirstName || '';
        const m = p.middleName || memberDoc.middleName || memberDoc.MiddleName || '';
        const l = p.lastName || memberDoc.lastName || memberDoc.LastName || '';
        nested.createdByName = [f,m,l].filter(Boolean).join(' ').trim() || (memberDoc.name && String(memberDoc.name).trim()) || 'Member';
        nested.createdBySerNo = memberDoc.serNo ?? p.serNo ?? null;
      }
    } catch (_) {}

    const result = await news.insertOne(nested);
    console.log('[news] created', { id: result.insertedId?.toString?.(), title: nested.title, createdBy: nested.createdBy });
    return res.status(201).json({ success: true, id: result.insertedId, news: nested });
  } catch (err) {
    console.error('Error creating news:', err && err.message ? err.message : err);
    return res.status(500).json({ success: false, error: 'Failed to create news', details: err?.message || null });
  }
});

// List news (public)
app.get('/api/news', async (req, res) => {
  try {
    const database = await connectToMongo();
    const news = database.collection(newsCollectionName);
    const docs = await news.find({}).sort({ createdAt: -1 }).limit(300).toArray();

    // Enrich authors similar to events
    const byIds = Array.from(new Set(docs.map(d => d.createdBy).filter(Boolean)));
    const names = new Map();
    const usersColl = await (async () => { try { return (await getUsersCollection(database)); } catch { return null; }})();
    const loginColl = database.collection(process.env.MONGODB_LOGIN_COLLECTION || 'login');
    const members = database.collection(process.env.MONGODB_COLLECTION || 'members');
    const { ObjectId } = await import('mongodb');
    for (const id of byIds) {
      let nm = '';
      try {
        const objId = new ObjectId(String(id));
        const userDoc = usersColl ? await usersColl.findOne({ _id: objId }) : null;
        if (userDoc) {
          const p = userDoc.personalDetails || {};
          const f = p.firstName || userDoc.firstName || userDoc.FirstName || '';
          const m = p.middleName || userDoc.middleName || userDoc.MiddleName || '';
          const l = p.lastName || userDoc.lastName || userDoc.LastName || '';
          nm = [f,m,l].filter(Boolean).join(' ').trim();
        }
        if (!nm) {
          const loginDoc = await loginColl.findOne({ _id: objId });
          if (loginDoc) {
            const email = (loginDoc.email || loginDoc.gmail || loginDoc.Email || loginDoc.userEmail || '').toString().trim();
            if (email) {
              const rx = new RegExp(`^${escapeRegex(email)}$`, 'i');
              const mem = await members.findOne({ $or: [ { 'personalDetails.email': rx }, { email: rx }, { gmail: rx } ]});
              if (mem) {
                const p2 = mem.personalDetails || {};
                const f2 = p2.firstName || mem.firstName || mem.FirstName || '';
                const m2 = p2.middleName || mem.middleName || mem.MiddleName || '';
                const l2 = p2.lastName || mem.lastName || mem.LastName || '';
                nm = [f2,m2,l2].filter(Boolean).join(' ').trim();
              }
            }
            if (!nm) {
              const uname = loginDoc.username || loginDoc.login || loginDoc.Username || loginDoc.Login || '';
              nm = uname ? String(uname).split('_')[0] : '';
            }
          }
        }
      } catch {}
      names.set(id, nm || 'Member');
    }

    const out = await Promise.all(docs.map(async d => {
      if (d.createdByName && String(d.createdByName).trim()) return d;
      let name = names.get(d.createdBy) || '';
      if (!name && (d.createdBySerNo !== undefined && d.createdBySerNo !== null)) {
        const sNum = Number(d.createdBySerNo);
        const mem = await members.findOne({ $or: [
          { serNo: sNum }, { serNo: String(d.createdBySerNo) },
          { 'personalDetails.serNo': sNum }, { 'personalDetails.serNo': String(d.createdBySerNo) }
        ]});
        if (mem) {
          const p = mem.personalDetails || {};
          const f = p.firstName || mem.firstName || mem.FirstName || '';
          const m = p.middleName || mem.middleName || mem.MiddleName || '';
          const l = p.lastName || mem.lastName || mem.LastName || '';
          name = [f,m,l].filter(Boolean).join(' ').trim();
        }
      }
      return { ...d, createdByName: name || 'Member' };
    }));

    return res.json({ news: out });
  } catch (err) {
    console.error('Error listing news:', err);
    return res.status(500).json({ error: 'Failed to list news' });
  }
});

// ===================== Photos APIs =====================
// Create photos (authenticated). Accepts multipart images under field name 'photoImages'
app.post('/api/photos', verifyToken, upload.any(), async (req, res) => {
  try {
    const database = await connectToMongo();
    const photos = database.collection(photosCollectionName);

    const raw = req.body || {};
    const processed = { ...raw };

    const images = [];
    const filesArr = Array.isArray(req.files) ? req.files : (req.files ? Object.values(req.files).flat() : []);
    for (const f of filesArr) {
      if (!f) continue;
      images.push({ data: f.buffer.toString('base64'), mimeType: f.mimetype, filename: f.originalname });
    }

    const nested = nestObject(processed);
    nested.photoImages = images;
    nested.createdAt = new Date();
    nested.updatedAt = new Date();
    nested.createdBy = req.user?.sub || null;

    // Optional external URL support when no uploads provided
    if ((!nested.photoImages || nested.photoImages.length === 0) && nested.imageUrl) {
      nested.externalImageUrl = String(nested.imageUrl);
    }

    // Resolve author similar to events/news
    try {
      const members = database.collection(process.env.MONGODB_COLLECTION || 'members');
      const emailToken = (req.user?.email || '').toString().trim().toLowerCase();
      const serNoToken = req.user?.serNo ?? null;
      let memberDoc = null;
      if (serNoToken !== null && serNoToken !== undefined) {
        const sNum = Number(serNoToken);
        memberDoc = await members.findOne({ $or: [
          { serNo: sNum }, { serNo: String(serNoToken) },
          { 'personalDetails.serNo': sNum }, { 'personalDetails.serNo': String(serNoToken) }
        ]});
      }
      if (!memberDoc && emailToken) {
        const rx = new RegExp(`^${escapeRegex(emailToken)}$`, 'i');
        memberDoc = await members.findOne({ $or: [
          { 'personalDetails.email': rx }, { email: rx }, { gmail: rx }
        ]});
      }
      if (memberDoc) {
        const p = memberDoc.personalDetails || {};
        const f = p.firstName || memberDoc.firstName || memberDoc.FirstName || '';
        const m = p.middleName || memberDoc.middleName || memberDoc.MiddleName || '';
        const l = p.lastName || memberDoc.lastName || memberDoc.LastName || '';
        nested.createdByName = [f,m,l].filter(Boolean).join(' ').trim() || (memberDoc.name && String(memberDoc.name).trim()) || 'Member';
        nested.createdBySerNo = memberDoc.serNo ?? p.serNo ?? null;
      }
    } catch (_) {}

    const result = await photos.insertOne(nested);
    console.log('[photos] created', { id: result.insertedId?.toString?.(), title: nested.title, createdBy: nested.createdBy, images: nested.photoImages?.length || 0 });
    return res.status(201).json({ success: true, id: result.insertedId, photo: nested });
  } catch (err) {
    console.error('Error creating photo:', err && err.message ? err.message : err);
    return res.status(500).json({ success: false, error: 'Failed to create photo', details: err?.message || null });
  }
});

// List photos (public)
app.get('/api/photos', async (req, res) => {
  try {
    const database = await connectToMongo();
    const photos = database.collection(photosCollectionName);
    const docs = await photos.find({}).sort({ createdAt: -1 }).limit(500).toArray();

    // Enrich createdByName lazily similar to news/events (best-effort)
    const byIds = Array.from(new Set(docs.map(d => d.createdBy).filter(Boolean)));
    const names = new Map();
    try {
      const usersColl = await (async () => { try { return (await getUsersCollection(database)); } catch { return null; }})();
      const loginColl = database.collection(process.env.MONGODB_LOGIN_COLLECTION || 'login');
      const members = database.collection(process.env.MONGODB_COLLECTION || 'members');
      const { ObjectId } = await import('mongodb');
      for (const id of byIds) {
        let nm = '';
        try {
          const objId = new ObjectId(String(id));
          const userDoc = usersColl ? await usersColl.findOne({ _id: objId }) : null;
          if (userDoc) {
            const p = userDoc.personalDetails || {};
            const f = p.firstName || userDoc.firstName || userDoc.FirstName || '';
            const m = p.middleName || userDoc.middleName || userDoc.MiddleName || '';
            const l = p.lastName || userDoc.lastName || userDoc.LastName || '';
            nm = [f,m,l].filter(Boolean).join(' ').trim();
          }
          if (!nm) {
            const loginDoc = await loginColl.findOne({ _id: objId });
            if (loginDoc) {
              const email = (loginDoc.email || loginDoc.gmail || loginDoc.Email || loginDoc.userEmail || '').toString().trim();
              if (email) {
                const rx = new RegExp(`^${escapeRegex(email)}$`, 'i');
                const mem = await members.findOne({ $or: [ { 'personalDetails.email': rx }, { email: rx }, { gmail: rx } ]});
                if (mem) {
                  const p2 = mem.personalDetails || {};
                  const f2 = p2.firstName || mem.firstName || mem.FirstName || '';
                  const m2 = p2.middleName || mem.middleName || mem.MiddleName || '';
                  const l2 = p2.lastName || mem.lastName || mem.LastName || '';
                  nm = [f2,m2,l2].filter(Boolean).join(' ').trim();
                }
              }
              if (!nm) {
                const uname = loginDoc.username || loginDoc.login || loginDoc.Username || loginDoc.Login || '';
                nm = uname ? String(uname).split('_')[0] : '';
              }
            }
          }
        } catch {}
        names.set(id, nm || 'Member');
      }
    } catch {}

    const out = docs.map(d => {
      const imageUrls = Array.isArray(d.photoImages) && d.photoImages.length > 0
        ? d.photoImages.map(img => `data:${img.mimeType};base64,${img.data}`)
        : (Array.isArray(d.imageUrls) ? d.imageUrls : (d.externalImageUrl ? [d.externalImageUrl] : []));
      const createdByName = d.createdByName && String(d.createdByName).trim() ? d.createdByName : (names.get(d.createdBy) || 'Member');
      return { ...d, imageUrls, imageUrl: imageUrls[0] || '', createdByName };
    });

    return res.json({ photos: out });
  } catch (err) {
    console.error('Error listing photos:', err);
    return res.status(500).json({ error: 'Failed to list photos' });
  }
});

// Admin: Regenerate and resend credentials for a member/user in login collection
app.post('/api/admin/credentials/resend', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { identifier } = req.body || {};
    const id = String(identifier || '').trim();
    if (!id) return res.status(400).json({ error: 'identifier required (email or username)' });

    const dbx = await connectToMongo();
    const loginColl = dbx.collection(process.env.MONGODB_LOGIN_COLLECTION || 'login');
    const regex = new RegExp(`^${escapeRegex(id.toLowerCase())}$`, 'i');
    const user = await loginColl.findOne({ $or: [
      { email: regex }, { gmail: regex }, { Email: regex }, { userEmail: regex },
      { username: regex }, { Username: regex }, { login: regex }, { Login: regex }
    ]});
    if (!user) return res.status(404).json({ error: 'User not found in login collection' });

    const username = user.username || user.Username || user.login || user.Login || 'member';
    const tempPassword = generatePassword();
    const { default: bcrypt } = await import('bcryptjs');
    const hash = await bcrypt.hash(tempPassword, 10);
    await loginColl.updateOne({ _id: user._id }, { $set: { username, password: hash, updatedAt: new Date() } });

    // Optionally email if we have address
    const email = user.email || user.gmail || user.Email || user.userEmail || '';
    if (email) {
      try {
        const { transporter, from } = createMailer();
        await transporter.sendMail({
          from,
          to: email,
          subject: 'Account Approval and Login Credentials — Gogte Kulamandal',
          text: `Dear ${username.split('_')[0]},\n\nYour credentials have been regenerated.\n\nUsername: ${username}\nTemporary Password: ${tempPassword}\n\nPlease change your password after first login.`,
        });
      } catch (e) {
        console.warn('[admin/credentials/resend] email failed:', e && e.message ? e.message : e);
      }
    }

    return res.json({ success: true, username, tempPassword });
  } catch (err) {
    console.error('[admin/credentials/resend] error:', err);
    return res.status(500).json({ error: 'Failed to resend credentials' });
  }
});

// Admin: Check a login attempt against the login collection (debug)
app.post('/api/admin/credentials/check', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { identifier, password } = req.body || {};
    const id = String(identifier || '').trim();
    const pw = String(password || '').trim();
    if (!id || !pw) return res.status(400).json({ error: 'identifier and password required' });

    const dbx = await connectToMongo();
    const coll = dbx.collection(process.env.MONGODB_LOGIN_COLLECTION || 'login');
    const regex = new RegExp(`^${escapeRegex(id.toLowerCase())}$`, 'i');
    const doc = await coll.findOne({ $or: [
      { email: regex }, { gmail: regex }, { Email: regex }, { userEmail: regex },
      { username: regex }, { Username: regex }, { login: regex }, { Login: regex }
    ]});
    if (!doc) return res.json({ ok: false, reason: 'not_found' });
    const stored = doc.password ? String(doc.password) : '';
    let ok = false;
    if (stored.startsWith('$2')) {
      const { default: bcrypt } = await import('bcryptjs');
      ok = await bcrypt.compare(pw, stored);
    } else {
      ok = stored === pw;
    }
    return res.json({ ok, userId: String(doc._id), matchedPasswordField: stored ? 'password' : null });
  } catch (err) {
    console.error('[admin/credentials/check] error:', err);
    return res.status(500).json({ error: 'check_failed' });
  }
});
const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
  console.log(`Test endpoint: http://localhost:${port}/api/test`);
});
