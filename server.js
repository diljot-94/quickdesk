const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const nodemailer = require('nodemailer');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3001;

// MongoDB configuration
const MONGODB_URI = 'mongodb://localhost:27017/';
const DB_NAME = 'quickdesk';

let db = null;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// JWT Secret
const JWT_SECRET = 'your-secret-key';

// Connect to MongoDB
async function connectToMongoDB() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DB_NAME);
    console.log('Connected to MongoDB');

    // Initialize default categories if they don't exist
    const categoriesCollection = db.collection('categories');
    const categoryCount = await categoriesCollection.countDocuments();
    
    if (categoryCount === 0) {
      const defaultCategories = [
        { id: 1, name: 'Hardware Support', specializations: ['printer', 'computer', 'laptop', 'hardware', 'repair'] },
        { id: 2, name: 'Software Support', specializations: ['software', 'application', 'program', 'installation'] },
        { id: 3, name: 'Network Support', specializations: ['network', 'internet', 'wifi', 'connection'] },
        { id: 4, name: 'Account Support', specializations: ['account', 'login', 'password', 'access'] },
        { id: 5, name: 'General Support', specializations: ['general', 'help', 'support', 'question'] }
      ];
      
      await categoriesCollection.insertMany(defaultCategories);
      console.log('Default categories initialized');
    }
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

// Find best matching agents based on ticket description and category
async function findBestMatchingAgents(ticketDescription, categoryId) {
  try {
    const usersCollection = db.collection('users');
    const categoriesCollection = db.collection('categories');
    
    // Get category specializations
    const category = await categoriesCollection.findOne({ id: categoryId });
    const categorySpecializations = category ? category.specializations || [] : [];
    
    // Get all agents
    const agents = await usersCollection.find({ role: 'agent' }).toArray();
    
    let agentScores = [];
    
    for (const agent of agents) {
      const agentSpecializations = agent.specializations || [];
      let score = 0;
      
      // Check ticket description against agent specializations
      const descriptionLower = ticketDescription.toLowerCase();
      for (const specialization of agentSpecializations) {
        if (descriptionLower.includes(specialization.toLowerCase())) {
          score += 2;
        }
      }
      
      // Check category specializations against agent specializations
      for (const categorySpec of categorySpecializations) {
        if (agentSpecializations.some(spec => 
          spec.toLowerCase().includes(categorySpec.toLowerCase()) ||
          categorySpec.toLowerCase().includes(spec.toLowerCase())
        )) {
          score += 1;
        }
      }
      
      // Add rating bonus (higher rating = higher score)
      const rating = agent.profile ? agent.profile.rating : 0;
      score += rating * 0.5;
      
      if (score > 0) {
        agentScores.push({
          agent,
          score,
          rating: rating,
          specializations: agentSpecializations
        });
      }
    }
    
    // Sort by score (highest first)
    agentScores.sort((a, b) => b.score - a.score);
    
    return agentScores;
  } catch (error) {
    console.error('Error finding best matching agents:', error);
    return [];
  }
}

// Find best matching agent (for backward compatibility)
async function findBestMatchingAgent(ticketDescription, categoryId) {
  const agentScores = await findBestMatchingAgents(ticketDescription, categoryId);
  return agentScores.length > 0 ? agentScores[0].agent : null;
}

// Email notification function
async function sendEmailNotification(userEmail, subject, message) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'your-email@gmail.com',
        pass: 'your-app-password'
      }
    });

    const mailOptions = {
      from: 'your-email@gmail.com',
      to: userEmail,
      subject: subject,
      text: message
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Email sending error:', error);
  }
}

// In-app notification system
async function createNotification(userId, type, title, message, data = {}) {
  try {
    const notificationsCollection = db.collection('notifications');
    const notification = {
      _id: new ObjectId(),
      id: uuidv4(),
      userId,
      type, // 'agent_response', 'ticket_assigned', 'ticket_updated', etc.
      title,
      message,
      data,
      read: false,
      createdAt: new Date()
    };
    
    await notificationsCollection.insertOne(notification);
    return notification;
  } catch (error) {
    console.error('Create notification error:', error);
  }
}

// Get user notifications
async function getUserNotifications(userId) {
  try {
    const notificationsCollection = db.collection('notifications');
    const notifications = await notificationsCollection
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    
    return notifications;
  } catch (error) {
    console.error('Get notifications error:', error);
    return [];
  }
}

// User registration
app.post('/api/register', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    const { username, email, password, role, specializations, adminKey } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check admin key for admin registration
    if (role === 'admin') {
      const ADMIN_KEYS = ['ADMIN2024', 'SUPERADMIN', 'QUICKDESK_ADMIN']; // You can change these keys
      if (!adminKey || !ADMIN_KEYS.includes(adminKey)) {
        return res.status(403).json({ error: 'Invalid admin key' });
      }
    }

    const usersCollection = db.collection('users');

    // Check if user already exists
    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with profile data
    const user = {
      _id: new ObjectId(),
      id: uuidv4(),
      username,
      email,
      password: hashedPassword,
      role: role || 'user',
      specializations: specializations || [],
      // Agent profile data
      profile: role === 'agent' ? {
        rating: 0,
        totalRatings: 0,
        completedTickets: 0,
        responseTime: 0,
        bio: '',
        experience: '',
        skills: specializations || []
      } : null,
      createdAt: new Date()
    };

    // Generate token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Remove password from response
    delete user.password;

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// User login
app.post('/api/login', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const usersCollection = db.collection('users');

    // Find user
    const user = await usersCollection.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Remove password from response
    delete user.password;

    res.json({
      message: 'Login successful',
      token,
      user
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get dashboard stats
app.get('/api/stats', authenticateToken, async (req, res) => {
    try {
        const ticketsCollection = db.collection('tickets');
        
        // Get stats based on user role
        let query = {};
        if (req.user.role === 'user') {
            query.createdBy = req.user.id;
        } else if (req.user.role === 'agent') {
            query.assignedTo = req.user.id;
        }
        // Admin can see all tickets
        
        const totalTickets = await ticketsCollection.countDocuments(query);
        const openTickets = await ticketsCollection.countDocuments({ ...query, status: 'open' });
        const resolvedTickets = await ticketsCollection.countDocuments({ ...query, status: 'resolved' });
        
        res.json({
            totalTickets,
            openTickets,
            resolvedTickets
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get all tickets (for dashboard)
app.get('/api/tickets', authenticateToken, async (req, res) => {
    try {
        const { page = 1, search = '', status = '', category = '', sort = 'recent' } = req.query;
        const pageNum = parseInt(page);
        const limit = 10;
        const skip = (pageNum - 1) * limit;

        const ticketsCollection = db.collection('tickets');
        const categoriesCollection = db.collection('categories');

        // Build query
        let query = {};

        if (search) {
            query.$or = [
                { subject: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        if (status) {
            query.status = status;
        }

        if (category) {
            query.categoryId = parseInt(category);
        }

        // Build sort
        let sortOption = {};
        switch (sort) {
            case 'recent':
                sortOption = { createdAt: -1 };
                break;
            case 'oldest':
                sortOption = { createdAt: 1 };
                break;
            case 'most-comments':
                sortOption = { 'comments.length': -1 };
                break;
            case 'most-votes':
                sortOption = { upvotes: -1 };
                break;
        }

        const tickets = await ticketsCollection
            .find(query)
            .sort(sortOption)
            .skip(skip)
            .limit(limit)
            .toArray();

        const totalTickets = await ticketsCollection.countDocuments(query);
        const totalPages = Math.ceil(totalTickets / limit);

        res.json({
            tickets,
            totalPages,
            page: pageNum,
            totalTickets
        });
    } catch (error) {
        console.error('Get tickets error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get user's tickets (My Tickets)
app.get('/api/tickets/my', authenticateToken, async (req, res) => {
  try {
    const { page = 1, search = '', status = '', category = '', sort = 'recent' } = req.query;
    const pageNum = parseInt(page);
    const limit = 10;
    const skip = (pageNum - 1) * limit;

    const ticketsCollection = db.collection('tickets');

    // Build query - only tickets created by current user
    let query = { createdBy: req.user.id };
    
    if (search) {
      query.$or = [
        { subject: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) {
      query.status = status;
    }
    
    if (category) {
      query.categoryId = parseInt(category);
    }

    // Build sort
    let sortOption = {};
    switch (sort) {
      case 'recent':
        sortOption = { createdAt: -1 };
        break;
      case 'oldest':
        sortOption = { createdAt: 1 };
        break;
      case 'most-comments':
        sortOption = { 'comments.length': -1 };
        break;
      case 'most-votes':
        sortOption = { upvotes: -1 };
        break;
    }

    const tickets = await ticketsCollection
      .find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .toArray();

    const totalTickets = await ticketsCollection.countDocuments(query);
    const totalPages = Math.ceil(totalTickets / limit);

    res.json({
      tickets,
      totalPages,
      page: pageNum,
      totalTickets
    });
  } catch (error) {
    console.error('Get my tickets error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create ticket
app.post('/api/tickets', authenticateToken, upload.single('attachment'), async (req, res) => {
  try {
    const { subject, description, categoryId } = req.body;
    
    // Find the best matching agents
    const agentScores = await findBestMatchingAgents(description, parseInt(categoryId));
    const assignedAgent = agentScores.length > 0 ? agentScores[0].agent : null;
    
    const ticket = {
      _id: new ObjectId(),
      id: uuidv4(),
      subject,
      description,
      categoryId: parseInt(categoryId),
      status: 'open',
      createdBy: req.user.id,
      assignedTo: assignedAgent ? assignedAgent.id : null,
      assignedAgentName: assignedAgent ? assignedAgent.username : null,
      attachment: req.file ? req.file.filename : null,
      upvotes: 0,
      downvotes: 0,
      comments: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const ticketsCollection = db.collection('tickets');
    await ticketsCollection.insertOne(ticket);

    // Create notification for user about best service providers
    if (agentScores.length > 0) {
      const topAgents = agentScores.slice(0, 3); // Top 3 agents
      await createNotification(
        req.user.id,
        'best_providers',
        'Best Service Providers Found',
        `We found ${topAgents.length} expert agents for your request`,
        {
          ticketId: ticket.id,
          agents: topAgents.map(a => ({
            id: a.agent.id,
            name: a.agent.username,
            rating: a.rating,
            specializations: a.specializations,
            score: a.score
          }))
        }
      );
    }

    // Send email notification to assigned agent
    if (assignedAgent) {
      await sendEmailNotification(
        assignedAgent.email,
        'New Ticket Assigned',
        `You have been assigned a new ticket: ${subject}`
      );
      
      // Create notification for assigned agent
      await createNotification(
        assignedAgent.id,
        'ticket_assigned',
        'New Ticket Assigned',
        `You have been assigned ticket: ${subject}`,
        { ticketId: ticket.id }
      );
    }

    res.status(201).json({
      message: 'Ticket created successfully',
      ticket,
      bestProviders: agentScores.slice(0, 3).map(a => ({
        id: a.agent.id,
        name: a.agent.username,
        rating: a.rating,
        specializations: a.specializations,
        score: a.score
      }))
    });
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single ticket
app.get('/api/tickets/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const ticketsCollection = db.collection('tickets');
    
    const ticket = await ticketsCollection.findOne({ id });
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json(ticket);
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update ticket
app.put('/api/tickets/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, assignedTo } = req.body;
    
    const ticketsCollection = db.collection('tickets');
    
    const updateData = {
      ...(status && { status }),
      ...(assignedTo && { assignedTo }),
      updatedAt: new Date()
    };

    const result = await ticketsCollection.updateOne(
      { id },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json({ message: 'Ticket updated successfully' });
  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add comment to ticket
app.post('/api/tickets/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    
    const ticketsCollection = db.collection('tickets');
    
    const comment = {
      id: uuidv4(),
      content,
      createdBy: req.user.id,
      createdAt: new Date()
    };

    await ticketsCollection.updateOne(
      { id },
      { $push: { comments: comment } }
    );

    res.json({ message: 'Comment added successfully', comment });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Vote on ticket
app.post('/api/tickets/:id/vote', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { vote } = req.body;
    
    const ticketsCollection = db.collection('tickets');
    
    const updateField = vote === 'up' ? 'upvotes' : 'downvotes';
    
    await ticketsCollection.updateOne(
      { id },
      { $inc: { [updateField]: 1 } }
    );

    res.json({ message: 'Vote recorded successfully' });
  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get categories
app.get('/api/categories', authenticateToken, async (req, res) => {
  try {
    const categoriesCollection = db.collection('categories');
    const categories = await categoriesCollection.find({}).toArray();
    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create category (admin only)
app.post('/api/categories', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { name } = req.body;
    const categoriesCollection = db.collection('categories');
    
    const category = {
      id: Date.now(),
      name,
      specializations: [],
      createdAt: new Date()
    };

    await categoriesCollection.insertOne(category);
    res.status(201).json({ message: 'Category created successfully', category });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get users (admin only)
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const usersCollection = db.collection('users');
    const users = await usersCollection.find({}, { projection: { password: 0 } }).toArray();
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Chat routes
app.get('/api/chat/:ticketId', authenticateToken, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticketsCollection = db.collection('tickets');
    const chatsCollection = db.collection('chats');
    
    const ticket = await ticketsCollection.findOne({ id: ticketId });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Check if user has access to this ticket
    if (req.user.role === 'user' && ticket.createdBy !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (req.user.role === 'agent' && ticket.assignedTo !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get or create chat
    let chat = await chatsCollection.findOne({ ticketId });
    if (!chat) {
      chat = {
        _id: new ObjectId(),
        ticketId,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await chatsCollection.insertOne(chat);
    }

    res.json({
      ticket,
      chat: chat.messages,
      agent: ticket.assignedAgentName
    });
  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/chat/:ticketId/message', authenticateToken, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { content } = req.body;
    
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const ticketsCollection = db.collection('tickets');
    const chatsCollection = db.collection('chats');
    
    const ticket = await ticketsCollection.findOne({ id: ticketId });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Check if user has access to this ticket
    if (req.user.role === 'user' && ticket.createdBy !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (req.user.role === 'agent' && ticket.assignedTo !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const message = {
      id: uuidv4(),
      content: content.trim(),
      sender: req.user.id,
      senderName: req.user.username || req.user.email,
      senderRole: req.user.role,
      timestamp: new Date()
    };

    // Add message to chat
    await chatsCollection.updateOne(
      { ticketId },
      { 
        $push: { messages: message },
        $set: { updatedAt: new Date() }
      },
      { upsert: true }
    );

    // Update ticket status to in-progress if it's open
    if (ticket.status === 'open') {
      await ticketsCollection.updateOne(
        { id: ticketId },
        { $set: { status: 'in-progress', updatedAt: new Date() } }
      );
    }

    // Create notification when agent responds to user
    if (req.user.role === 'agent' && ticket.createdBy !== req.user.id) {
      await createNotification(
        ticket.createdBy,
        'agent_response',
        'Agent Response',
        `${req.user.username} responded to your ticket: ${ticket.subject}`,
        { 
          ticketId: ticket.id,
          agentId: req.user.id,
          agentName: req.user.username
        }
      );
    }

    // Create notification when user responds to agent
    if (req.user.role === 'user' && ticket.assignedTo) {
      await createNotification(
        ticket.assignedTo,
        'user_response',
        'User Response',
        `${req.user.username} responded to ticket: ${ticket.subject}`,
        { 
          ticketId: ticket.id,
          userId: req.user.id,
          userName: req.user.username
        }
      );
    }

    res.json(message);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user notifications
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const notifications = await getUserNotifications(req.user.id);
    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Mark notification as read
app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const notificationsCollection = db.collection('notifications');
    
    await notificationsCollection.updateOne(
      { id, userId: req.user.id },
      { $set: { read: true } }
    );
    
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Rate an agent
app.post('/api/agents/:agentId/rate', authenticateToken, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { rating, comment } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    
    const usersCollection = db.collection('users');
    const agent = await usersCollection.findOne({ id: agentId, role: 'agent' });
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    // Update agent rating
    const currentRating = agent.profile ? agent.profile.rating : 0;
    const totalRatings = agent.profile ? agent.profile.totalRatings : 0;
    const newTotalRatings = totalRatings + 1;
    const newRating = ((currentRating * totalRatings) + rating) / newTotalRatings;
    
    await usersCollection.updateOne(
      { id: agentId },
      { 
        $set: { 
          'profile.rating': newRating,
          'profile.totalRatings': newTotalRatings
        }
      }
    );
    
    // Create rating record
    const ratingsCollection = db.collection('ratings');
    await ratingsCollection.insertOne({
      _id: new ObjectId(),
      agentId,
      userId: req.user.id,
      rating,
      comment,
      createdAt: new Date()
    });
    
    res.json({ 
      message: 'Rating submitted successfully',
      newRating: newRating,
      totalRatings: newTotalRatings
    });
  } catch (error) {
    console.error('Rate agent error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get agent profile
app.get('/api/agents/:agentId/profile', authenticateToken, async (req, res) => {
  try {
    const { agentId } = req.params;
    const usersCollection = db.collection('users');
    
    const agent = await usersCollection.findOne(
      { id: agentId, role: 'agent' },
      { projection: { password: 0 } }
    );
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    res.json(agent);
  } catch (error) {
    console.error('Get agent profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start server
async function startServer() {
  await connectToMongoDB();
  
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

startServer(); 