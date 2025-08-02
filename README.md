# QuickDesk - Help Desk Ticket Management System

A modern, full-stack help desk ticket management system built with Node.js, Express, MongoDB, and vanilla JavaScript.

## 🚀 Features

- **User Authentication**: Secure login/registration system with JWT tokens
- **Role-Based Access**: Support for Users, Agents, and Admins
- **Ticket Management**: Create, view, and manage support tickets
- **Smart Agent Assignment**: AI-powered agent matching based on ticket content and specializations
- **Real-Time Chat**: Built-in chat system for ticket communication
- **File Attachments**: Support for file uploads with tickets
- **Notification System**: In-app notifications for ticket updates
- **Rating System**: Rate and review agents
- **Admin Panel**: Comprehensive admin interface for user and category management
- **Responsive Design**: Modern, mobile-friendly UI

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB
- **Authentication**: JWT (JSON Web Tokens)
- **File Upload**: Multer
- **Email**: Nodemailer
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Styling**: Modern CSS with Flexbox/Grid

## 📋 Prerequisites

Before running this application, make sure you have the following installed:

- [Node.js](https://nodejs.org/) (v14 or higher)
- [MongoDB](https://www.mongodb.com/try/download/community) (v4.4 or higher)
- [Git](https://git-scm.com/)

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/quickdesk.git
   cd quickdesk
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up MongoDB**
   - Make sure MongoDB is running on your system
   - The application will automatically connect to `mongodb://localhost:27017/quickdesk`

4. **Create uploads directory**
   ```bash
   mkdir uploads
   ```

5. **Start the application**
   ```bash
   npm start
   ```

6. **Access the application**
   - Open your browser and go to `http://localhost:3001`
   - The application will be ready to use!

## 📁 Project Structure

```
quickdesk/
├── public/                 # Frontend files
│   ├── index.html         # Main HTML file
│   ├── script.js          # Frontend JavaScript
│   └── styles.css         # CSS styles
├── uploads/               # File upload directory
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
├── .gitignore            # Git ignore file
└── README.md             # This file
```

## 🔧 Configuration

### Environment Variables (Optional)

You can set the following environment variables:

- `PORT`: Server port (default: 3001)
- `MONGODB_URI`: MongoDB connection string (default: mongodb://localhost:27017/)
- `JWT_SECRET`: JWT secret key (default: 'your-secret-key')

### Admin Keys

To register as an admin, use one of these keys:
- `ADMIN2024`
- `SUPERADMIN`
- `QUICKDESK_ADMIN`

## 👥 User Roles

### User
- Create and manage tickets
- Chat with assigned agents
- Rate agents
- View notifications

### Agent
- View assigned tickets
- Respond to tickets via chat
- Update ticket status
- Manage profile and specializations

### Admin
- Manage all users
- Create and manage categories
- View all tickets
- System administration

## 🔌 API Endpoints

### Authentication
- `POST /api/register` - User registration
- `POST /api/login` - User login

### Tickets
- `GET /api/tickets` - Get all tickets
- `GET /api/tickets/my` - Get user's tickets
- `POST /api/tickets` - Create new ticket
- `GET /api/tickets/:id` - Get single ticket
- `PUT /api/tickets/:id` - Update ticket
- `POST /api/tickets/:id/comments` - Add comment
- `POST /api/tickets/:id/vote` - Vote on ticket

### Chat
- `GET /api/chat/:ticketId` - Get chat messages
- `POST /api/chat/:ticketId/message` - Send message

### Notifications
- `GET /api/notifications` - Get user notifications
- `PUT /api/notifications/:id/read` - Mark notification as read

### Admin
- `GET /api/users` - Get all users
- `GET /api/categories` - Get categories
- `POST /api/categories` - Create category

## 🎯 Key Features Explained

### Smart Agent Assignment
The system uses AI-powered matching to assign the best agent to each ticket based on:
- Ticket description keywords
- Category specializations
- Agent specializations
- Agent ratings and performance

### Real-Time Chat
Built-in chat system allows direct communication between users and agents:
- Real-time message exchange
- Automatic status updates
- Notification system

### File Attachments
Support for file uploads with tickets:
- Secure file storage
- Multiple file types supported
- Automatic file naming

## 🚀 Deployment

### Local Development
```bash
npm run dev  # Uses nodemon for auto-restart
```

### Production
```bash
npm start    # Standard production start
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**QuickDesk Team**
- GitHub: [@yourusername](https://github.com/yourusername)

## 🙏 Acknowledgments

- MongoDB for the database
- Express.js for the web framework
- JWT for authentication
- All contributors and users

## 📞 Support

If you have any questions or need support, please:
1. Check the [Issues](https://github.com/yourusername/quickdesk/issues) page
2. Create a new issue if your problem isn't already listed
3. Contact the development team

---

**Made with ❤️ by the QuickDesk Team** 