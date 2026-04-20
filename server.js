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

const connectDB = async () => {
  if (isConnected) return;
  
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log('✓ MongoDB connected');
  } catch (err) {
    console.error('✗ MongoDB connection error:', err);
    throw err;
  }
};

// Connect to DB on startup
connectDB().catch(err => console.error('Initial connection error:', err));

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
  if (!isConnected) {
    try {
      await connectDB();
    } catch (error) {
      return res.status(500).json({ message: 'Database connection failed', error: error.message });
    }
  }
  next();
};

app.use(ensureDBConnection);

// GET all notes
app.get('/api/notes', async (req, res) => {
  try {
    const search = req.query.search || '';
    const notes = await Note.find({
      title: { $regex: search, $options: 'i' }
    }).sort({ createdDate: -1 });
    res.json(notes);
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ message: 'Error fetching notes', error: error.message });
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

    const newNote = await note.save();
    res.status(201).json(newNote);
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(400).json({ message: 'Error creating note', error: error.message });
  }
});

// PUT update a note
app.put('/api/notes/:id', async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    if (req.body.title) note.title = req.body.title;
    if (req.body.description) note.description = req.body.description;
    note.updatedDate = Date.now();

    const updatedNote = await note.save();
    res.json(updatedNote);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// DELETE a note
app.delete('/api/notes/:id', async (req, res) => {
  try {
    const note = await Note.findByIdAndDelete(req.params.id);
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }
    res.json({ message: 'Note deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Backend is running' });
});

app.listen(PORT, () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
});
