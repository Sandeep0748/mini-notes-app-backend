const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const corsOptions = {
  origin: [
    'https://mini-notes-app-frontend.vercel.app',
    'https://mini-notes-app-frontend-7ni499ced-sandeep0748s-projects.vercel.app',
    'http://localhost:3000'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// MongoDB Connection
let isConnected = false;
const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 15000,
  socketTimeoutMS: 45000,
  maxPoolSize: 5,
  minPoolSize: 1,
  retryWrites: true,
  w: 'majority',
};

const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    console.log('✓ Using existing MongoDB connection');
    return;
  }
  
  try {
    console.log('Attempting to connect to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, mongooseOptions);
    isConnected = true;
    console.log('✓ MongoDB connected successfully');
  } catch (err) {
    console.error('✗ MongoDB connection error:', err.message);
    isConnected = false;
    throw err;
  }
};

// Connect to DB on startup
connectDB().catch(err => console.error('Initial connection error:', err.message));

// Note Schema
const noteSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  createdDate: {
    type: Date,
    default: Date.now,
  },
  updatedDate: {
    type: Date,
    default: Date.now,
  },
});

const Note = mongoose.model('Note', noteSchema);

// Routes

// Middleware to ensure DB connection
const ensureDBConnection = async (req, res, next) => {
  try {
    const readyState = mongoose.connection.readyState;
    
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    if (readyState !== 1) {
      console.log(`Connection state: ${readyState}, attempting to reconnect...`);
      isConnected = false;
      await connectDB();
    }
    next();
  } catch (error) {
    console.error('Database connection check failed:', error.message);
    return res.status(503).json({ 
      message: 'Database unavailable. Please ensure: 1) MongoDB URI is correct 2) IP 0.0.0.0/0 is whitelisted in MongoDB Atlas', 
      error: error.message 
    });
  }
};

app.use(ensureDBConnection);

// GET all notes
app.get('/api/notes', async (req, res) => {
  try {
    const search = req.query.search || '';
    const notes = await Note.find({
      title: { $regex: search, $options: 'i' }
    }).sort({ createdDate: -1 }).maxTimeMS(30000);
    res.json(notes);
  } catch (error) {
    console.error('Error fetching notes:', error.message);
    res.status(500).json({ 
      message: 'Error fetching notes', 
      error: error.message 
    });
  }
});

// GET a single note
app.get('/api/notes/:id', async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }
    res.json(note);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST create a new note
app.post('/api/notes', async (req, res) => {
  try {
    const { title, description } = req.body;
    
    // Validate input
    if (!title || !description) {
      return res.status(400).json({ message: 'Title and description are required' });
    }

    const note = new Note({
      title: title.trim(),
      description: description.trim(),
    });

    const newNote = await note.save({ maxTimeMS: 30000 });
    res.status(201).json(newNote);
  } catch (error) {
    console.error('Error creating note:', error.message);
    res.status(400).json({ 
      message: 'Error creating note', 
      error: error.message 
    });
  }
});

// PUT update a note
app.put('/api/notes/:id', async (req, res) => {
  try {
    const note = await Note.findById(req.params.id, {}, { maxTimeMS: 30000 });
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    if (req.body.title) note.title = req.body.title;
    if (req.body.description) note.description = req.body.description;
    note.updatedDate = Date.now();

    const updatedNote = await note.save({ maxTimeMS: 30000 });
    res.json(updatedNote);
  } catch (error) {
    console.error('Error updating note:', error.message);
    res.status(400).json({ 
      message: 'Error updating note', 
      error: error.message 
    });
  }
});

// DELETE a note
app.delete('/api/notes/:id', async (req, res) => {
  try {
    const note = await Note.findByIdAndDelete(req.params.id, { maxTimeMS: 30000 });
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }
    res.json({ message: 'Note deleted' });
  } catch (error) {
    console.error('Error deleting note:', error.message);
    res.status(500).json({ 
      message: 'Error deleting note', 
      error: error.message 
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'Backend is running',
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// Only listen in development (local)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`✓ Server running on http://localhost:${PORT}`);
  });
}

// Export for Vercel serverless
module.exports = app;
